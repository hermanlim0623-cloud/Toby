// What moves through the machine: data motes carried on a flow field, and a
// swarm of packets that decides where to go by looking at its neighbours.
//
// Both are simulated on the GPU. Position and velocity live in storage
// buffers that never travel back to JavaScript; a compute pass advances them
// each frame and the vertex stage reads the same buffer. That is the whole
// reason this can be real simulation rather than animation: nothing is
// uploaded per frame, so the cost of a particle is a few ALU ops instead of a
// slot in a buffer the CPU has to rewrite.
//
// WebGL2 has no compute shaders at all, so it gets an analytic fallback: the
// same look, derived from time and a per-particle seed, with no simulation
// behind it. The swarm is dropped there entirely — packets that cannot see
// their neighbours are just drifting confetti, and confetti that claims to be
// a routing swarm is worse than no swarm.
import {
  Points, BufferGeometry, BufferAttribute, AdditiveBlending, Vector3,
} from 'three';
import { PointsNodeMaterial } from 'three/webgpu';
import {
  Fn, vec3, vec4, float, instancedArray, instanceIndex, pointUV,
  mix, smoothstep, clamp, pow, sin, cos, fract, length,
  attribute, positionLocal, If, Loop, mx_noise_vec3,
} from 'three/tsl';
import { SIGNAL_TINT, daylightAt } from './field.js';

const MOTES = { low: 1200, mid: 4000, high: 9000 };
const SWARM = { low: 0, mid: 260, high: 520 };

// The slab the motes occupy. It travels with the camera and they wrap inside
// it, so a few thousand cover the whole descent.
const FIELD = new Vector3(70, 46, 70);

/**
 * Curl of a noise field — a velocity field that is divergence-free by
 * construction, which is what makes it look like something circulating
 * rather than like particles sliding down a gradient. Straight noise has
 * sources and sinks: particles pile up in its valleys and thin out on its
 * peaks, and the field reads as wind over terrain. Curl has neither, so the
 * motes circulate without ever collecting into clumps.
 */
const curl = Fn(([p]) => {
  const e = float(0.35);
  const dx = vec3(e, 0, 0);
  const dy = vec3(0, e, 0);
  const dz = vec3(0, 0, e);

  const x0 = mx_noise_vec3(p.sub(dx)); const x1 = mx_noise_vec3(p.add(dx));
  const y0 = mx_noise_vec3(p.sub(dy)); const y1 = mx_noise_vec3(p.add(dy));
  const z0 = mx_noise_vec3(p.sub(dz)); const z1 = mx_noise_vec3(p.add(dz));

  return vec3(
    y1.z.sub(y0.z).sub(z1.y.sub(z0.y)),
    z1.x.sub(z0.x).sub(x1.z.sub(x0.z)),
    x1.y.sub(x0.y).sub(y1.x.sub(y0.x)),
  ).div(e.mul(2.0));
});

/** Wraps a coordinate into [-half, half] so the field is seamless. */
const wrap = Fn(([v, half]) => fract(v.div(half.mul(2.0)).add(0.5)).sub(0.5).mul(half.mul(2.0)));

function createMotes({ count, uniforms, hasCompute }) {
  const material = new PointsNodeMaterial();
  material.transparent = true;
  material.depthWrite = false;
  material.blending = AdditiveBlending;
  material.toneMapped = false;
  material.fog = false;

  const geometry = new BufferGeometry();
  let compute = null;

  // Seeds double as the per-particle character: size, brightness, and how
  // strongly the flow pushes this one around.
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) seeds[i] = Math.random();

  if (hasCompute) {
    const initial = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      initial[i * 3] = (Math.random() - 0.5) * FIELD.x;
      initial[i * 3 + 1] = (Math.random() - 0.5) * FIELD.y;
      initial[i * 3 + 2] = (Math.random() - 0.5) * FIELD.z;
    }
    const positions = instancedArray(initial, 'vec3');
    const seedBuffer = instancedArray(seeds, 'float');

    compute = Fn(() => {
      const p = positions.element(instanceIndex);
      const seed = seedBuffer.element(instanceIndex);

      // Advection by the flow field, plus a steady downward bias. Without it
      // the field alone would hold everything in place forever and the
      // descent would lose its direction — motes should be *going* somewhere.
      const flow = curl(p.mul(0.035).add(vec3(0, uniforms.time.mul(0.04), 0)));
      const drift = flow.mul(seed.mul(0.5).add(0.5)).mul(0.5);
      const sink = vec3(0, seed.mul(-0.35).sub(0.12), 0);

      p.addAssign(drift.add(sink).mul(uniforms.delta));

      // Wrap inside the slab. The slab itself is placed around the camera at
      // draw time, so this is the only containment the simulation needs.
      p.assign(vec3(
        wrap(p.x, float(FIELD.x / 2)),
        wrap(p.y, float(FIELD.y / 2)),
        wrap(p.z, float(FIELD.z / 2)),
      ));
    })().compute(count);

    material.positionNode = positions.element(instanceIndex);
    material.sizeNode = pow(seedBuffer.element(instanceIndex), float(2.2)).mul(9.0).add(1.0);

    const seedN = seedBuffer.element(instanceIndex);
    material.colorNode = moteColor(seedN, uniforms);
    // A Points draw still needs vertices to iterate; the positions come from
    // the storage buffer, so the attribute is only a count.
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3));
  } else {
    // Analytic fallback. Each particle is a fixed home position plus a
    // wandering offset — no state, no simulation, but the same silhouette.
    const home = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      home[i * 3] = (Math.random() - 0.5) * FIELD.x;
      home[i * 3 + 1] = (Math.random() - 0.5) * FIELD.y;
      home[i * 3 + 2] = (Math.random() - 0.5) * FIELD.z;
    }
    geometry.setAttribute('position', new BufferAttribute(home, 3));
    geometry.setAttribute('seed', new BufferAttribute(seeds, 1));

    const seed = attribute('seed', 'float');
    const fall = uniforms.time.mul(seed.mul(0.5).add(0.3));
    const y = wrap(positionLocal.y.sub(fall), float(FIELD.y / 2));
    const swayX = sin(uniforms.time.mul(0.3).add(seed.mul(9.0))).mul(0.8);
    const swayZ = cos(uniforms.time.mul(0.24).add(seed.mul(13.0))).mul(0.8);

    material.positionNode = vec3(positionLocal.x.add(swayX), y, positionLocal.z.add(swayZ));
    material.sizeNode = pow(seed, float(2.2)).mul(9.0).add(1.0);
    material.colorNode = moteColor(seed, uniforms);
  }

  const points = new Points(geometry, material);
  points.frustumCulled = false;
  return { points, compute, material, geometry };
}

/**
 * Motes are lit by whatever signal is left, with a floor so the deepest part
 * of the descent still has something moving in it. `pointUV` — not `uv()` — is
 * the sprite-local coordinate: `uv()` on a Points geometry resolves to the
 * vertex attribute, which for one vertex per particle is constant, and every
 * sprite then samples a single value and the whole field silently vanishes.
 */
function moteColor(seed, uniforms) {
  const lit = daylightAt(uniforms.depth).mul(0.6).add(0.14);
  const twinkle = sin(uniforms.time.mul(1.4).add(seed.mul(20.0))).mul(0.25).add(0.75);
  const falloff = smoothstep(0.5, 0.08, pointUV.sub(0.5).length());
  return vec4(SIGNAL_TINT, seed.mul(0.5).add(0.25).mul(lit).mul(twinkle).mul(falloff));
}

/**
 * The swarm. Three rules, evaluated against every other packet: keep away
 * from the ones that are too close, match the heading of the ones nearby, and
 * steer toward where the group's centre is. The O(n^2) neighbour loop is the
 * honest version and is affordable at these counts precisely because it never
 * leaves the GPU; a spatial hash would be the right answer at ten times this
 * many, and would cost more code than it saves here.
 */
function createSwarm({ count, uniforms }) {
  const initialPos = new Float32Array(count * 3);
  const initialVel = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    initialPos[i * 3] = (Math.random() - 0.5) * 26;
    initialPos[i * 3 + 1] = (Math.random() - 0.5) * 14;
    initialPos[i * 3 + 2] = (Math.random() - 0.5) * 26;
    initialVel[i * 3] = (Math.random() - 0.5) * 2;
    initialVel[i * 3 + 1] = (Math.random() - 0.5) * 0.4;
    initialVel[i * 3 + 2] = (Math.random() - 0.5) * 2;
  }

  const positions = instancedArray(initialPos, 'vec3');
  const velocities = instancedArray(initialVel, 'vec3');

  const SEPARATION = float(2.2);
  const NEIGHBOUR = float(7.0);
  const MAX_SPEED = float(6.5);

  const compute = Fn(() => {
    const p = positions.element(instanceIndex);
    const v = velocities.element(instanceIndex);

    const separate = vec3(0).toVar();
    const align = vec3(0).toVar();
    const cohere = vec3(0).toVar();
    const near = float(0).toVar();

    Loop(count, ({ i }) => {
      // Compared as indices, not as floats: these are buffer slots, and at
      // a few thousand particles a float comparison is a precision question
      // it has no business being.
      If(i.notEqual(instanceIndex), () => {
        const other = positions.element(i);
        const toOther = other.sub(p).toVar();
        const dist = length(toOther).toVar();

        If(dist.lessThan(NEIGHBOUR).and(dist.greaterThan(0.0001)), () => {
          near.addAssign(1.0);
          align.addAssign(velocities.element(i));
          cohere.addAssign(other);
          If(dist.lessThan(SEPARATION), () => {
            separate.subAssign(toOther.div(dist.mul(dist)));
          });
        });
      });
    });

    const steer = vec3(0).toVar();
    If(near.greaterThan(0.0), () => {
      steer.addAssign(align.div(near).sub(v).mul(0.6));
      steer.addAssign(cohere.div(near).sub(p).mul(0.35));
    });
    steer.addAssign(separate.mul(5.0));

    // A slow wandering attractor keeps the swarm travelling instead of
    // settling into a stable ball, and keeps it near the camera's descent.
    const target = vec3(
      sin(uniforms.time.mul(0.11)).mul(16.0),
      sin(uniforms.time.mul(0.07)).mul(5.0),
      cos(uniforms.time.mul(0.09)).mul(16.0),
    );
    steer.addAssign(target.sub(p).mul(0.25));

    v.addAssign(steer.mul(uniforms.delta));

    const speed = length(v).toVar();
    If(speed.greaterThan(MAX_SPEED), () => { v.assign(v.div(speed).mul(MAX_SPEED)); });

    p.addAssign(v.mul(uniforms.delta));
  })().compute(count);

  const material = new PointsNodeMaterial();
  material.transparent = true;
  material.depthWrite = false;
  material.toneMapped = false;
  material.fog = false;

  material.positionNode = positions.element(instanceIndex);
  // Packets read as flecks, not as objects. At the distance the camera keeps,
  // a modelled one would be three pixels of detail nobody sees; what actually
  // sells a swarm is the coherent motion, which is exactly what the
  // simulation above provides.
  material.sizeNode = float(5.0);
  material.colorNode = Fn(() => {
    const speed = clamp(length(velocities.element(instanceIndex)).div(MAX_SPEED), 0.0, 1.0);
    const lit = daylightAt(uniforms.depth).mul(0.8).add(0.06);
    const falloff = smoothstep(0.5, 0.1, pointUV.sub(0.5).length());
    // They brighten as they accelerate, so the swarm reads as carrying
    // something rather than as drifting.
    const flash = mix(float(0.35), float(1.0), speed);
    return vec4(mix(SIGNAL_TINT, vec3(1.0, 1.0, 1.0), speed), flash.mul(lit).mul(falloff));
  })();

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3));
  const points = new Points(geometry, material);
  points.frustumCulled = false;

  return { points, compute, material, geometry };
}

export function createParticles({ tier, uniforms, hasCompute, prefersReducedMotion }) {
  if (prefersReducedMotion) return null;

  const parts = [];
  const computes = [];

  const motes = createMotes({ count: MOTES[tier], uniforms, hasCompute });
  parts.push(motes);
  if (motes.compute) computes.push(motes.compute);

  const swarmCount = hasCompute ? SWARM[tier] : 0;
  if (swarmCount > 0) {
    const swarm = createSwarm({ count: swarmCount, uniforms });
    parts.push(swarm);
    computes.push(swarm.compute);
  }

  return {
    objects: parts.map((p) => p.points),
    computes,
    /** The mote slab rides with the camera so it is always where the eye is. */
    follow(cameraPosition) {
      motes.points.position.copy(cameraPosition);
    },
    dispose() {
      parts.forEach((p) => { p.geometry.dispose(); p.material.dispose(); });
    },
  };
}
