// The medium behind everything: a raymarched volume of haze and scan light,
// drawn first and never writing depth, so the architecture and the motes sit
// in front of it.
//
// It used to be the whole scene and carried a hand-rolled virtual camera. Now
// there is a real one, so the rays are derived from its actual matrices —
// which is what lets the shafts hold still in the world while the camera
// turns past them. A fullscreen shader with an invented focal length cannot
// do that; the light would swim with the view and give the trick away.
//
// It is also cheaper than it was. With geometry in front of it, most of what
// this pass used to carry alone is now carried by things that occlude it.
//
// It is installed as the scene's `backgroundNode` rather than as a mesh. A
// quad sized in clip space is the same thing as the screen only under an
// orthographic camera; hand it a perspective one and it becomes an actual
// 2x2 rectangle sitting at the world origin, covering a patch of the view
// and leaving the clear colour everywhere else.
import {
  Fn, vec2, vec3, vec4, float, screenUV, Loop,
  mix, smoothstep, clamp, pow, exp, dot, normalize, length, sin, fract,
  mx_fractal_noise_float, mx_noise_float,
} from 'three/tsl';
import {
  SIGNAL_TINT, depthAt, daylightAt, mediumAt, backdropAt,
} from './field.js';

/** Raymarch steps per tier. Still the single biggest cost lever in the scene. */
const STEPS = { low: 12, mid: 20, high: 30 };

export function createAtmosphere({ tier, uniforms }) {
  const steps = STEPS[tier];

  /**
   * Density of the medium at a world point. Two octaves at different scales
   * and drift speeds: the coarse one is the slow body of it, the fine one
   * gives it a structure that catches the scan light.
   */
  const haze = Fn(([p]) => {
    const drift = uniforms.time.mul(0.035);
    const coarse = mx_fractal_noise_float(p.mul(0.045).add(vec3(0, drift.negate(), 0)), 3, 2.0, 0.5, 1.0);
    const fine = mx_noise_float(p.mul(0.19).add(vec3(drift, drift.mul(0.5), 0)));
    return coarse.mul(0.7).add(fine.mul(0.3)).mul(0.5).add(0.5);
  });

  /**
   * Scan light: vertical beams running the height of the machine. Sampled in
   * the horizontal plane only, so the beams stay vertical as the camera
   * descends through them instead of swimming around — sampling in full 3D
   * here is the classic mistake that turns volumetric light into drifting fog
   * blobs. The offsets push the noise origin well off-axis: centred on zero,
   * a symmetric field reads as pleated fabric rather than as instrumentation.
   */
  const shafts = Fn(([p]) => {
    const sway = sin(uniforms.time.mul(0.1).add(p.y.mul(0.025))).mul(0.3);
    const q = vec3(p.x.mul(0.15).add(sway).add(31.7), p.z.mul(0.05).add(11.3), float(0));
    const wide = mx_fractal_noise_float(q, 2, 2.0, 0.5, 1.0).mul(0.5).add(0.5);
    const fine = mx_noise_float(q.mul(2.7)).mul(0.5).add(0.5);
    // This exponent is the single control that decides "shafts of light"
    // versus "bright haze".
    return pow(clamp(wide.mul(0.75).add(fine.mul(0.25)), 0.0, 1.0), float(8.0));
  });

  const render = Fn(() => {
    // The ray for this pixel, reconstructed from the live camera. `ndc` is
    // the pixel in clip space; scaling by tan(fov/2) turns it into a
    // direction in view space, and the camera's world matrix rotates it into
    // the world the shafts live in.
    const ndc = screenUV.sub(0.5).mul(2.0).toVar();
    const viewDir = vec3(
      ndc.x.mul(uniforms.tanHalfFov).mul(uniforms.aspect),
      ndc.y.mul(uniforms.tanHalfFov),
      float(-1.0),
    );
    const rd = normalize(uniforms.cameraBasis.mul(viewDir)).toVar();
    const ro = uniforms.cameraPos;

    const camDepth = depthAt(ro.y).toVar();

    // The medium behind the march. A complete image on its own: looking up
    // toward the entry surface is bright, looking down is the floor. It stays
    // out of the integration deliberately — background light multiplied by
    // per-step absorption gets crushed to nothing, which is what flattens
    // most first attempts at a scene like this. The geometry's fog resolves
    // to this same function, so structure and medium meet without a seam.
    const bg = backdropAt(rd, camDepth).toVar();

    const acc = vec3(0).toVar();
    const beams = float(0).toVar();
    const transmittance = float(1).toVar();

    // The march covers the far half of the view frustum; the near half is
    // where the geometry lives and would be hidden by it anyway.
    const stepLen = float(220.0 / steps);

    Loop(steps, ({ i }) => {
      const t = float(i).mul(stepLen).add(6.0);
      const p = ro.add(rd.mul(t)).toVar();

      const localDepth = depthAt(p.y).toVar();
      const medium = mediumAt(localDepth).toVar();

      // Suspended matter thins with depth — the abyss is clearer than the
      // productive water near the surface, and it needs to be, or the deepest
      // part of the dive turns into a uniform grey wall.
      const density = haze(p).mul(0.014).mul(mix(float(1.0), float(0.4), localDepth)).toVar();

      const absorbed = density.mul(stepLen);
      acc.addAssign(medium.mul(absorbed).mul(transmittance).mul(1.6));

      // Beam light gets its own accumulator with its own coefficient rather
      // than being folded into the medium's colour: it is light passing
      // *through* the volume, so it should survive thin haze rather than
      // needing dense haze to be visible at all. It also fades downward, or a
      // beam reads as a hanging curtain instead of light from above.
      const fromAbove = pow(clamp(rd.y.mul(0.5).add(0.62), 0.0, 1.0), float(2.2));
      beams.addAssign(
        shafts(p).mul(daylightAt(localDepth)).mul(fromAbove)
          .mul(exp(t.mul(-0.008))).mul(transmittance).mul(stepLen).mul(0.09),
      );

      transmittance.mulAssign(exp(absorbed.negate().mul(1.1)));
    });

    const col = bg.mul(transmittance).add(acc).add(SIGNAL_TINT.mul(beams)).toVar();

    // The closing sequence floods the signal back in as the cycle completes.
    col.addAssign(SIGNAL_TINT.mul(pow(uniforms.surfaceRush, float(1.8))).mul(0.6));

    // Vignette — cheap, and it is what keeps the white body copy legible over
    // the brightest part of the field.
    const vig = smoothstep(1.3, 0.3, length(screenUV.sub(0.5).mul(vec2(uniforms.aspect, 1.0))));
    col.mulAssign(mix(float(0.5), float(1.0), vig));

    // A dither of well under one 8-bit step. Banding is extremely visible in
    // a dark near-monochrome gradient like this one, and this removes it free.
    const dither = fract(sin(dot(screenUV, vec2(12.9898, 78.233))).mul(43758.5453))
      .sub(0.5).mul(float(1.0 / 255.0));

    return vec4(col.add(dither), 1.0);
  });

  return {
    /** Assigned to `scene.backgroundNode`. */
    node: render(),
  };
}
