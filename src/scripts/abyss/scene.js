// The dive itself, generated rather than filmed.
//
// A single fullscreen raymarch renders the water column: a light gradient
// falling away into black, god rays raking down from the surface, and
// drifting murk. One uniform — `depth`, 0 at the surface and 1 at the
// seafloor — drives every part of it, which is what keeps the visuals, the
// depth readout in ocean.js and the scrim agreeing with each other. The old
// build had to keep a video playhead, a shader uniform and a DOM counter in
// sync by hand; here they are all reading the same number.
//
// Everything is authored in TSL so the one graph compiles to WGSL on WebGPU
// and GLSL on the WebGL2 fallback.
import { Scene, OrthographicCamera, Mesh, PlaneGeometry, Points, BufferGeometry, BufferAttribute, AdditiveBlending } from 'three';
import { MeshBasicNodeMaterial, PointsNodeMaterial } from 'three/webgpu';
import {
  Fn, vec2, vec3, vec4, float, uniform, screenUV, Loop, attribute, pointUV,
  mix, smoothstep, clamp, pow, exp, dot, normalize, length,
  sin, fract, positionLocal, mx_fractal_noise_float, mx_noise_float,
} from 'three/tsl';

/** Raymarch steps per tier. This is the single biggest cost lever. */
const STEPS = { low: 18, mid: 30, high: 44 };
/** Marine snow budget per tier. */
const SNOW = { low: 900, mid: 2600, high: 5200 };

// The abyss palette. Kept here rather than in the shader body so the whole
// colour story of the dive is readable in one place.
const SURFACE_TINT = vec3(0.09, 0.26, 0.36); // shallow water, lit from above
const MID_TINT = vec3(0.03, 0.12, 0.26); // the blue that outlasts the light
const ABYSS_TINT = vec3(0.004, 0.012, 0.035); // not pure black — pure black reads as "broken"
const RAY_TINT = vec3(0.55, 0.85, 0.95); // god rays skew cyan, never white

export function createAbyssScene({ tier, prefersReducedMotion }) {
  const scene = new Scene();
  // An orthographic camera with a 2x2 plane is just a delivery mechanism for
  // a fullscreen fragment pass; the "camera" the visitor perceives is built
  // inside the shader from `depth`, so there is no object to move.
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const uniforms = {
    depth: uniform(0),
    time: uniform(0),
    aspect: uniform(1),
    // shutdown.js scrubs this to 1 as the camera "pulls back" to the
    // surface at the end of the page.
    surfaceRush: uniform(0),
    // Pointer parallax, eased in the controller rather than here.
    parallax: uniform(vec2(0, 0)),
  };

  const steps = STEPS[tier];

  // --- The water column -----------------------------------------------

  /**
   * Density of suspended murk at a point. Two noise octaves at different
   * scales and drift speeds: the coarse one gives the slow body of the
   * water, the fine one gives it a surface that catches the god rays.
   */
  const murk = Fn(([p]) => {
    const drift = uniforms.time.mul(0.035);
    const coarse = mx_fractal_noise_float(p.mul(0.45).add(vec3(0, drift.negate(), 0)), 3, 2.0, 0.5, 1.0);
    const fine = mx_noise_float(p.mul(1.9).add(vec3(drift, drift.mul(0.5), 0)));
    return coarse.mul(0.7).add(fine.mul(0.3)).mul(0.5).add(0.5);
  });

  /**
   * God rays. The shafts are a noise field sampled in the plane *across* the
   * descent, so they stay vertical as you fall through them instead of
   * swimming around — sampling in 3D here is the classic mistake that makes
   * volumetric light look like fog blobs rather than beams.
   */
  /**
   * God rays. The shafts are sampled in the plane *across* the descent, not
   * in full 3D, so they stay vertical as you fall through them instead of
   * swimming around — sampling in 3D here is the classic mistake that makes
   * volumetric light look like drifting fog blobs rather than beams.
   */
  const shafts = Fn(([p]) => {
    const sway = sin(uniforms.time.mul(0.1).add(p.y.mul(0.25))).mul(0.3);
    // The offsets matter more than they look. Sampling around x = 0 puts the
    // noise field's origin dead centre of the screen, and a symmetric field
    // there reads as pleated fabric rather than daylight. Pushing the origin
    // well off-axis breaks the mirror.
    const q = vec3(p.x.mul(1.5).add(sway).add(31.7), p.z.mul(0.5).add(11.3), float(0));
    const wide = mx_fractal_noise_float(q, 2, 2.0, 0.5, 1.0).mul(0.5).add(0.5);
    // A second, finer band splits the wide shafts so they don't all read as
    // the same object at the same distance.
    const fine = mx_noise_float(q.mul(2.7)).mul(0.5).add(0.5);
    const bands = wide.mul(0.75).add(fine.mul(0.25));
    // Sharpen the noise into beams rather than clouds. This exponent is the
    // single control that decides "shafts of light" versus "bright haze".
    return pow(clamp(bands, 0.0, 1.0), float(8.0));
  });

  const render = Fn(() => {
    // Screen ray. The 1.6 is the virtual focal length — wider than a
    // photographic lens, because a slightly over-wide view sells "inside a
    // volume" better than a correct one does.
    const ndc = screenUV.sub(0.5).mul(2.0).mul(vec2(uniforms.aspect, 1.0)).toVar();
    ndc.addAssign(uniforms.parallax);
    const rd = normalize(vec3(ndc.x, ndc.y, float(-1.6))).toVar();

    const d = uniforms.depth.toVar();

    // How much daylight is still reaching this depth. Exponential, because
    // that is how water actually eats light — and it is why the first third
    // of the scroll changes so much more than the last third.
    const light = exp(d.mul(-3.2)).toVar();

    // The water behind the march. This is a real image on its own: looking
    // up toward the surface is bright, looking down is the abyss. It is
    // kept out of the integration on purpose — background light that is
    // multiplied by per-step absorption gets crushed to nothing, which is
    // what flattens most first attempts at a scene like this.
    const upward = clamp(rd.y.mul(0.5).add(0.5), 0.0, 1.0).toVar();
    const deepTint = mix(MID_TINT, ABYSS_TINT, smoothstep(0.1, 0.75, d));
    const bg = mix(
      deepTint,
      mix(deepTint, SURFACE_TINT, light),
      pow(upward, float(3.4)),
    ).toVar();

    // Ray origin descends through the noise field, so the murk genuinely
    // scrolls past the viewer rather than being faded between two states.
    const ro = vec3(0.0, d.mul(-16.0), 0.0).toVar();

    const acc = vec3(0).toVar(); // in-scattered murk
    const beams = float(0).toVar(); // in-scattered shaft light, kept separate
    const transmittance = float(1).toVar();

    const stepLen = float(0.42);

    Loop(steps, ({ i }) => {
      const t = float(i).mul(stepLen).add(0.15);
      const p = ro.add(rd.mul(t)).toVar();

      const localDepth = clamp(d.add(t.mul(0.01)), 0.0, 1.0);
      const water = mix(
        mix(SURFACE_TINT, MID_TINT, smoothstep(0.0, 0.4, localDepth)),
        ABYSS_TINT,
        smoothstep(0.3, 0.9, localDepth),
      ).toVar();

      // Suspended matter. Thins with depth — the abyss is clearer than the
      // productive water near the surface, and it needs to be, or the
      // deepest part of the dive turns into a uniform grey wall.
      const density = murk(p).mul(0.30).mul(mix(float(1.0), float(0.4), localDepth)).toVar();

      const absorbed = density.mul(stepLen);
      acc.addAssign(water.mul(absorbed).mul(transmittance).mul(0.9));

      // Shaft light is accumulated on its own term with its own coefficient
      // rather than being folded into the water colour: it is light passing
      // *through* the volume, so it should survive thin water rather than
      // require dense water to be visible at all.
      // Beams fade downward as well as with distance. Without this they are
      // uniform top to bottom, which is what makes a shaft read as a
      // hanging curtain instead of light falling from somewhere above.
      const fromAbove = pow(clamp(rd.y.mul(0.5).add(0.62), 0.0, 1.0), float(2.2));
      beams.addAssign(
        shafts(p).mul(light).mul(fromAbove).mul(exp(t.mul(-0.16)))
          .mul(transmittance).mul(stepLen).mul(4.0),
      );

      transmittance.mulAssign(exp(absorbed.negate().mul(1.1)));
    });

    const col = bg.mul(transmittance).add(acc).add(RAY_TINT.mul(beams)).toVar();

    // The closing "rush to the surface" floods light back in.
    col.addAssign(RAY_TINT.mul(pow(uniforms.surfaceRush, float(1.8))).mul(0.6));

    // Vignette. Cheap, and it is what keeps the white body copy legible over
    // the brightest part of the column.
    const vig = smoothstep(1.3, 0.3, length(screenUV.sub(0.5).mul(vec2(uniforms.aspect, 1.0))));
    col.mulAssign(mix(float(0.32), float(1.0), vig));

    // Filmic-ish shoulder, then a dither. Banding is extremely visible in a
    // dark near-monochrome gradient like this one, and an ordered dither of
    // well under one 8-bit step removes it for free.
    const tone = col.div(col.add(0.9));
    const dither = fract(sin(dot(screenUV, vec2(12.9898, 78.233))).mul(43758.5453)).sub(0.5).mul(float(1.0 / 255.0));

    return vec4(tone.add(dither), 1.0);
  });

  const columnMaterial = new MeshBasicNodeMaterial();
  columnMaterial.colorNode = render();
  columnMaterial.depthTest = false;
  columnMaterial.depthWrite = false;
  columnMaterial.toneMapped = false;

  const column = new Mesh(new PlaneGeometry(2, 2), columnMaterial);
  column.frustumCulled = false;
  scene.add(column);

  // --- Marine snow ------------------------------------------------------
  // The particles that make the volume feel occupied. They are the part the
  // preloader treats as non-blocking: the column alone is a complete image,
  // so these can arrive a beat after the visitor is already on the page.

  let snow = null;

  function addMarineSnow() {
    if (snow || prefersReducedMotion) return;
    const count = SNOW[tier];
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // A slab rather than a cube: wide and tall, shallow in z, so particles
      // stay within the band the camera actually looks through.
      positions[i * 3] = (Math.random() - 0.5) * 3.4;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 2.6;
      positions[i * 3 + 2] = Math.random() * -1.2;
      seeds[i] = Math.random();
    }

    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(positions, 3));
    geo.setAttribute('seed', new BufferAttribute(seeds, 1));

    const mat = new PointsNodeMaterial();
    mat.transparent = true;
    mat.depthTest = false;
    mat.depthWrite = false;
    mat.blending = AdditiveBlending;
    mat.toneMapped = false;

    // Vertical wrap in the shader rather than on the CPU: nothing is
    // uploaded per frame, the whole field is a function of time and a
    // per-particle seed.
    const seed = attribute('seed', 'float');
    const fall = uniforms.time.mul(0.04).mul(seed.mul(0.6).add(0.4)).add(uniforms.depth.mul(2.2));
    const y = fract(positionLocal.y.mul(0.5).add(0.5).add(fall)).sub(0.5).mul(2.6);
    const sway = sin(uniforms.time.mul(0.3).add(seed.mul(9.0))).mul(0.03);

    mat.positionNode = vec3(positionLocal.x.add(sway), y, positionLocal.z);

    // Size spread has to be wide, and weighted toward the small end. An even
    // spread gives every particle roughly the same size on screen, which is
    // what makes a field like this read as a starfield instead of as matter
    // suspended at different distances. Nearer particles (less negative z)
    // are drawn larger, which is the other half of that depth read.
    const near = positionLocal.z.mul(0.5).add(1.0);
    mat.sizeNode = pow(seed, float(2.2)).mul(7.0).add(0.8).mul(near);

    // Snow is lit by whatever light is left, plus a floor so the deepest
    // part of the dive still has something moving in it.
    const lit = exp(uniforms.depth.mul(-2.2)).mul(0.5).add(0.12);
    const twinkle = sin(uniforms.time.mul(1.4).add(seed.mul(20.0))).mul(0.25).add(0.75);
    // A round, soft sprite rather than the default square: at these sizes a
    // hard-edged point is unmistakably a pixel, and the whole illusion is
    // that these are particles drifting in water.
    // `pointUV`, not `uv()`. A point sprite's local coordinate is its own
    // thing; `uv()` on a Points geometry resolves to the vertex attribute,
    // which for a one-vertex-per-particle buffer is constant — every sprite
    // then samples a single value and the whole field silently vanishes.
    const falloff = smoothstep(0.5, 0.08, pointUV.sub(0.5).length());
    const alpha = seed.mul(0.6).add(0.3).mul(lit).mul(twinkle).mul(falloff);
    mat.colorNode = vec4(RAY_TINT, alpha);

    snow = new Points(geo, mat);
    snow.frustumCulled = false;
    scene.add(snow);
  }

  function dispose() {
    column.geometry.dispose();
    columnMaterial.dispose();
    if (snow) {
      snow.geometry.dispose();
      snow.material.dispose();
    }
  }

  return { scene, camera, uniforms, addMarineSnow, dispose };
}
