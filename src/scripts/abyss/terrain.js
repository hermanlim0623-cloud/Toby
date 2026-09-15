// The canyon: two rock walls and a seafloor, displaced into shape on the GPU.
//
// This is the geometry that makes the dive three-dimensional. The walls are
// what supply parallax — the near one slides past far faster than the far one
// as the camera drifts across the canyon — and parallax is the one cue a
// fullscreen shader can never fake, however good its fog is.
//
// Displacement happens in the vertex shader rather than being baked into the
// buffer on the CPU. That keeps startup cheap (no per-vertex JS loop before
// the first frame, which the preloader is waiting on) and it means wall
// detail scales per tier by changing subdivision alone.
import { Mesh, PlaneGeometry, DoubleSide, Group } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import {
  Fn, vec3, vec4, float, positionLocal, positionWorld,
  mix, smoothstep, clamp, pow, mx_fractal_noise_float, mx_noise_float,
  cameraPosition, length, normalize, cross, dFdx, dFdy, sign, dot,
} from 'three/tsl';
import {
  WORLD_DEPTH, SILT_TINT, RAY_TINT, depthAt, daylightAt, submerge, ambientAt,
} from './water.js';

/** Wall subdivision per tier — the detail lever for geometry. */
const SEGMENTS = { low: [24, 60], mid: [40, 110], high: [64, 170] };

const WALL_HALF_WIDTH = 46;
const WALL_HEIGHT = WORLD_DEPTH + 60;
// The wall mesh is lifted so it spans the whole dive; the vertex shader needs
// the same offset to know how deep any given vertex actually is.
const WALL_ORIGIN_Y = -WORLD_DEPTH / 2 + 20;

/**
 * Rock displacement for a point on a wall, in world units.
 *
 * Layered so the silhouette reads at every distance: a broad profile that
 * decides where the canyon pinches, a mid band of ledges, and a fine crust
 * that only resolves up close.
 *
 * Positive is always *into* the canyon. Each wall's mesh rotation already
 * mirrors it, so the two sides must not be given opposite signs here — doing
 * that pushes the second wall outwards and inverts its shape, which reads as
 * a canyon with one side missing.
 */
const rockHeight = Fn(([sample, worldY, sideSeed]) => {
  // The canyon narrows through the middle of the dive and opens again at the
  // bottom, so the descent has a waist rather than being a uniform shaft.
  const d = depthAt(worldY);
  const pinch = smoothstep(0.05, 0.45, d).mul(smoothstep(1.0, 0.62, d)).mul(13.0);

  const broad = mx_fractal_noise_float(sample.mul(0.012).add(sideSeed.mul(40.0)), 3, 2.1, 0.5, 1.0).mul(9.0);
  const ledges = mx_fractal_noise_float(sample.mul(0.055).add(sideSeed.mul(11.0)), 3, 2.3, 0.5, 1.0).mul(2.6);
  const crust = mx_noise_float(sample.mul(0.22).add(sideSeed.mul(5.0))).mul(0.55);

  return broad.add(ledges).add(crust).add(pinch);
});

/**
 * A surface normal recovered from the displaced geometry.
 *
 * Screen-space derivatives rather than an analytic normal: the displacement
 * is three octaves of noise deep, differentiating that by hand would be a lot
 * of shader for a surface this rough, and the derivative version is exact for
 * whatever the vertex stage actually produced — including on the low tier,
 * where an analytic normal would describe detail the mesh does not have.
 *
 * The result is turned to face the camera. `cross` gives a normal whose sign
 * follows the triangle's winding, and on a double-sided wall half of those
 * point into the rock; lit with the wrong sign, they come out black.
 */
const surfaceNormal = Fn(() => {
  const n = normalize(cross(dFdx(positionWorld), dFdy(positionWorld))).toVar();
  return n.mul(sign(dot(n, cameraPosition.sub(positionWorld))));
});

function createWall({ segments, side }) {
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
    // canyon's X once rotated.
    const p = positionLocal.toVar();
    // Sampled in a space that does not move with the mesh, so the rock keeps
    // its shape rather than crawling as anything animates.
    const sample = vec3(p.x, p.y, sideSeed.mul(100.0));
    p.z.addAssign(rockHeight(sample, p.y.add(WALL_ORIGIN_Y), sideSeed));
    return p;
  })();

  material.colorNode = Fn(() => {
    const depth = depthAt(positionWorld.y).toVar();
    const n = surfaceNormal().toVar();
    const lit = ambientAt(n.y, depth).toVar();

    // Rock is not one colour: ledges that face up collect pale silt, faces
    // that fall away stay dark, and that contrast is most of what makes the
    // wall read as rock rather than as a brown surface.
    const siltiness = pow(clamp(n.y, 0.0, 1.0), float(2.4));
    const rock = mix(SILT_TINT, SILT_TINT.mul(3.4).add(0.03), siltiness).toVar();

    // A weak cyan rim where daylight grazes the top edges, tying the stone to
    // the same light the god rays are made of.
    rock.addAssign(RAY_TINT.mul(pow(clamp(n.y, 0.0, 1.0), float(6.0))).mul(daylightAt(depth)).mul(0.3));

    const surfaceColor = rock.mul(lit.mul(3.2).add(0.12));
    const toFragment = positionWorld.sub(cameraPosition).toVar();
    const camDepth = depthAt(cameraPosition.y);

    return vec4(
      submerge(surfaceColor, length(toFragment), normalize(toFragment), camDepth),
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
  // Far wider than the canyon needs, because the seafloor's own edge must
  // never fall inside the view: fog hides distance, but it cannot hide a
  // perfectly straight boundary where the mesh simply stops.
  const geo = new PlaneGeometry(700, 700, wSeg, wSeg);
  const material = new MeshBasicNodeMaterial();
  material.toneMapped = false;
  material.fog = false;

  material.positionNode = Fn(() => {
    const p = positionLocal.toVar();
    const dunes = mx_fractal_noise_float(vec3(p.x, p.y, float(7.0)).mul(0.03), 3, 2.0, 0.5, 1.0);
    p.z.addAssign(dunes.mul(4.0));
    return p;
  })();

  material.colorNode = Fn(() => {
    const depth = float(1.0);
    const n = surfaceNormal();
    // Settled silt is the brightest thing this deep — it is the floor of the
    // dive, and the visitor should be able to tell they have arrived on it.
    const sediment = SILT_TINT.mul(4.0).add(0.03).mul(ambientAt(n.y, depth).mul(4.0).add(0.35));
    const toFragment = positionWorld.sub(cameraPosition).toVar();
    return vec4(
      submerge(sediment, length(toFragment), normalize(toFragment), depthAt(cameraPosition.y)),
      1.0,
    );
  })();

  const mesh = new Mesh(geo, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -WORLD_DEPTH;
  mesh.frustumCulled = false;
  return mesh;
}

export function createTerrain({ tier }) {
  const segments = SEGMENTS[tier];
  const group = new Group();
  const parts = [
    createWall({ segments, side: 1 }),
    createWall({ segments, side: -1 }),
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
