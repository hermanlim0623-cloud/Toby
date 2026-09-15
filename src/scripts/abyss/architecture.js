// The structure the descent passes through: two vast walls of stacked strata
// and a floor, displaced into shape on the GPU.
//
// This is the geometry that makes the descent three-dimensional. The walls
// supply parallax — the near one slides past far faster than the far one as
// the camera drifts — and parallax is the one cue a fullscreen shader can
// never fake, however good its fog is.
//
// The shape is deliberately *built* rather than eroded. Where a natural
// surface wants smooth fractal noise, this wants terracing: long horizontal
// bands with hard steps between them, like decks of a structure too big to
// see the top of. The layering is what says "machine" rather than "cave", and
// it comes almost entirely from quantising the broad noise into steps instead
// of leaving it continuous.
//
// Displacement happens in the vertex shader rather than being baked into the
// buffer on the CPU. That keeps startup cheap — no per-vertex JS loop before
// the first frame, which the boot sequence is waiting on — and it means the
// detail scales per tier by changing subdivision alone.
import { Mesh, PlaneGeometry, DoubleSide, Group } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import {
  Fn, vec3, vec4, float, positionLocal, positionWorld,
  mix, smoothstep, clamp, pow, fract, floor, abs, sin,
  mx_fractal_noise_float, mx_noise_float,
  cameraPosition, length, normalize, cross, dFdx, dFdy, sign, dot,
} from 'three/tsl';
import {
  WORLD_DEPTH, STRUCTURE_TINT, SIGNAL_TINT,
  depthAt, submerge, ambientAt,
} from './field.js';

/** Wall subdivision per tier — the detail lever for geometry. */
const SEGMENTS = { low: [24, 72], mid: [40, 130], high: [64, 200] };

const WALL_HALF_WIDTH = 46;
const WALL_HEIGHT = WORLD_DEPTH + 60;
// The wall mesh is lifted so it spans the whole descent; the vertex shader
// needs the same offset to know how deep any given vertex actually is.
const WALL_ORIGIN_Y = -WORLD_DEPTH / 2 + 20;

/** Height of one stratum. Also the spacing of the seams that light them. */
const DECK = 7.0;

/**
 * Displacement for a point on a wall, in world units.
 *
 * Positive is always *into* the corridor. Each wall's mesh rotation already
 * mirrors it, so the two sides must not be given opposite signs here — doing
 * that pushes the second wall outwards and inverts its shape, which reads as
 * a corridor with one side missing.
 */
const strataHeight = Fn(([sample, worldY, sideSeed]) => {
  // The corridor narrows through the middle of the descent and opens again at
  // the bottom, so the journey has a waist rather than being a uniform shaft.
  const d = depthAt(worldY);
  const pinch = smoothstep(0.05, 0.45, d).mul(smoothstep(1.0, 0.62, d)).mul(13.0);

  // Broad profile, then quantised into decks. Rounding the noise to a step is
  // the whole trick: the same field left continuous reads as rock, and
  // stepped reads as something that was assembled.
  const broad = mx_fractal_noise_float(sample.mul(0.011).add(sideSeed.mul(40.0)), 2, 2.1, 0.5, 1.0).mul(9.0);
  const stepped = floor(broad.div(2.2)).mul(2.2);

  // A shallow bevel inside each deck, so the faces are not perfectly flat and
  // catch the ambient at slightly different angles down the wall.
  const withinDeck = fract(worldY.div(DECK)).sub(0.5);
  const bevel = abs(withinDeck).mul(-1.4);

  // Fine panelling — only resolves close up, and keeps the mid distance from
  // looking like untextured blocks.
  const panels = mx_noise_float(sample.mul(0.16).add(sideSeed.mul(5.0))).mul(0.5);

  return stepped.add(bevel).add(panels).add(pinch);
});

/**
 * A surface normal recovered from the displaced geometry.
 *
 * Screen-space derivatives rather than an analytic normal: the displacement
 * is layered and quantised, differentiating that by hand would be a lot of
 * shader for this, and the derivative version is exact for whatever the
 * vertex stage actually produced — including on the low tier, where an
 * analytic normal would describe detail the mesh does not have.
 *
 * The result is turned to face the camera. `cross` gives a normal whose sign
 * follows the triangle's winding, and on a double-sided wall half of those
 * point into the structure; lit with the wrong sign, they come out black.
 */
const surfaceNormal = Fn(() => {
  const n = normalize(cross(dFdx(positionWorld), dFdy(positionWorld))).toVar();
  return n.mul(sign(dot(n, cameraPosition.sub(positionWorld))));
});

/**
 * The seams between decks: a thin emissive line every DECK units, with a
 * slow pulse travelling down it.
 *
 * This is the single element that makes the structure read as powered rather
 * than as ruins, and it is also the only place the accent colour appears in
 * the geometry at all — which is why it can be this bright without the scene
 * tipping into neon.
 */
const deckSeam = Fn(([worldY, time]) => {
  const withinDeck = fract(worldY.div(DECK));
  const line = smoothstep(0.045, 0.0, abs(withinDeck.sub(0.5)));
  // A slow travelling brightness, so the seams are not a static grid.
  const travel = sin(worldY.mul(0.08).sub(time.mul(0.7))).mul(0.5).add(0.5);
  return line.mul(travel.mul(0.75).add(0.25));
});

function createWall({ segments, side, uniforms }) {
  const [wSeg, hSeg] = segments;
  const geo = new PlaneGeometry(120, WALL_HEIGHT, wSeg, hSeg);
  const material = new MeshBasicNodeMaterial();
  material.side = DoubleSide;
  material.toneMapped = false;
  material.fog = false;

  const sideSeed = float(side);

  material.positionNode = Fn(() => {
    // The plane is authored flat in XY and stood up by the mesh's own
    // rotation, so displacement pushes along local Z, which becomes the
    // corridor's X once rotated.
    const p = positionLocal.toVar();
    // Sampled in a space that does not move with the mesh, so the structure
    // keeps its shape rather than crawling as anything animates.
    const sample = vec3(p.x, p.y, sideSeed.mul(100.0));
    p.z.addAssign(strataHeight(sample, p.y.add(WALL_ORIGIN_Y), sideSeed));
    return p;
  })();

  material.colorNode = Fn(() => {
    const depth = depthAt(positionWorld.y).toVar();
    const n = surfaceNormal().toVar();
    const lit = ambientAt(n.y, depth).toVar();

    // Up-facing deck tops catch what light there is; the vertical faces stay
    // dark. That contrast is most of what makes the wall read as stacked
    // horizontal layers rather than as one tall grey surface.
    const facingUp = pow(clamp(n.y, 0.0, 1.0), float(2.0));
    const structure = mix(STRUCTURE_TINT, STRUCTURE_TINT.mul(3.6).add(0.02), facingUp).toVar();

    const surfaceColor = structure.mul(lit.mul(3.0).add(0.10)).toVar();
    // The seams are added after the ambient term rather than multiplied by
    // it: they are emissive, so they should be just as visible at the bottom
    // of the descent, where there is no ambient left to multiply.
    surfaceColor.addAssign(SIGNAL_TINT.mul(deckSeam(positionWorld.y, uniforms.time)).mul(0.16));

    const toFragment = positionWorld.sub(cameraPosition).toVar();
    return vec4(
      submerge(surfaceColor, length(toFragment), normalize(toFragment), depthAt(cameraPosition.y)),
      1.0,
    );
  })();

  const mesh = new Mesh(geo, material);
  mesh.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
  mesh.position.set(side * WALL_HALF_WIDTH, WALL_ORIGIN_Y, 0);
  // The walls are taller than the frustum everywhere on the path, and culling
  // a displaced mesh against its undisplaced bounds pops it out of view at
  // glancing angles — cheaper to just always draw the two meshes.
  mesh.frustumCulled = false;
  return mesh;
}

function createFloor({ segments }) {
  const [wSeg] = segments;
  // Far wider than the corridor needs, because the floor's own edge must
  // never fall inside the view: fog hides distance, but it cannot hide a
  // perfectly straight boundary where the mesh simply stops.
  const geo = new PlaneGeometry(700, 700, wSeg, wSeg);
  const material = new MeshBasicNodeMaterial();
  material.toneMapped = false;
  material.fog = false;

  material.positionNode = Fn(() => {
    const p = positionLocal.toVar();
    const relief = mx_fractal_noise_float(vec3(p.x, p.y, float(7.0)).mul(0.028), 3, 2.0, 0.5, 1.0);
    p.z.addAssign(relief.mul(3.2));
    return p;
  })();

  material.colorNode = Fn(() => {
    const depth = float(1.0);
    const n = surfaceNormal();
    // The output floor is the brightest thing this deep — it is the end of
    // the descent, and the visitor should be able to tell they have arrived.
    const plate = STRUCTURE_TINT.mul(4.2).add(0.02).mul(ambientAt(n.y, depth).mul(4.0).add(0.35)).toVar();

    // A slow grid resolving out of the plate, the one place the machine's
    // own geometry is stated outright rather than implied.
    const grid = smoothstep(0.02, 0.0, abs(fract(positionWorld.x.div(24.0)).sub(0.5)))
      .add(smoothstep(0.02, 0.0, abs(fract(positionWorld.z.div(24.0)).sub(0.5))));
    plate.addAssign(SIGNAL_TINT.mul(clamp(grid, 0.0, 1.0)).mul(0.05));

    const toFragment = positionWorld.sub(cameraPosition).toVar();
    return vec4(
      submerge(plate, length(toFragment), normalize(toFragment), depthAt(cameraPosition.y)),
      1.0,
    );
  })();

  const mesh = new Mesh(geo, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -WORLD_DEPTH;
  mesh.frustumCulled = false;
  return mesh;
}

export function createArchitecture({ tier, uniforms }) {
  const segments = SEGMENTS[tier];
  const group = new Group();
  const parts = [
    createWall({ segments, side: 1, uniforms }),
    createWall({ segments, side: -1, uniforms }),
    createFloor({ segments }),
  ];
  parts.forEach((m) => group.add(m));

  return {
    group,
    dispose() {
      parts.forEach((m) => { m.geometry.dispose(); m.material.dispose(); });
    },
  };
}
