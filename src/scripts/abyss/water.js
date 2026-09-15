// The shared model of the water: how deep a point is, what colour the water
// is there, and how much of a surface's light survives the swim back to the
// camera.
//
// Every visual in the dive imports from here, and that is the whole point.
// The atmosphere is a raymarch, the canyon is lit geometry and the particles
// come out of a compute buffer — three completely different render paths
// that have to agree on what "600 metres down" looks like, or the geometry
// visibly floats in front of the background instead of being submerged in it.
// Sharing the palette is not enough; they have to share the *function*.
import { vec3, float, mix, smoothstep, exp, clamp, pow, max, Fn } from 'three/tsl';

// The world is 260 units tall and the dive spans it: y = 0 is the surface,
// y = -WORLD_DEPTH is the seafloor. Real units rather than a 0..1 parameter,
// because geometry has to be authored somewhere and "the wall starts at -40"
// is a sentence you can act on.
export const WORLD_DEPTH = 260;

// These are LINEAR values, and the frame is sRGB-encoded on its way to the
// screen — which lifts the midtones hard. A linear 0.09 lands near 0.33 on
// the display, so a palette that looks like a reasonable dark blue in these
// numbers arrives as a swimming pool. Everything here is therefore authored
// backwards from the intended screen colour, roughly display^2.2, and any
// change to it has to be judged on a canvas capture rather than on a
// render-target readback, which shows the raw linear values instead.
export const SURFACE_TINT = vec3(0.013, 0.052, 0.092); // shallow water, lit from above
export const MID_TINT = vec3(0.0024, 0.013, 0.034); // the blue that outlasts the light
export const ABYSS_TINT = vec3(0.0004, 0.0012, 0.004); // not pure black — pure black reads as "broken"
export const RAY_TINT = vec3(0.55, 0.85, 0.95); // god rays skew cyan, never white
export const SILT_TINT = vec3(0.010, 0.014, 0.018); // the canyon rock, before any light

/** 0 at the surface, 1 at the seafloor, for any world-space height. */
export const depthAt = (y) => clamp(y.negate().div(WORLD_DEPTH), 0.0, 1.0);

/**
 * How much daylight still reaches a given depth. Exponential, because that
 * is how water actually eats light — and it is why the first third of the
 * scroll changes so much more than the last third.
 */
export const daylightAt = (depth) => exp(depth.mul(-3.2));

/** The colour of the water itself at a depth, with no light source in it. */
export const waterTint = (depth) => mix(
  mix(SURFACE_TINT, MID_TINT, smoothstep(0.0, 0.4, depth)),
  ABYSS_TINT,
  smoothstep(0.3, 0.9, depth),
);

/**
 * The water a ray ends up looking at when nothing solid stops it: bright
 * toward the surface, abyssal toward the floor, graded by how much daylight
 * survives to the camera's own depth.
 *
 * Both the atmosphere and the fog below call this, and that is the point.
 * Geometry has to fade into *the thing actually drawn behind it*; fade it
 * toward anything else and the seam shows.
 */
export const backdropAt = Fn(([rayDir, camDepth]) => {
  const upward = clamp(rayDir.y.mul(0.5).add(0.5), 0.0, 1.0);
  const deepTint = mix(MID_TINT, ABYSS_TINT, smoothstep(0.1, 0.75, camDepth));
  const lit = mix(deepTint, waterTint(camDepth), daylightAt(camDepth));
  return mix(deepTint, lit, pow(upward, float(2.6)));
});

/**
 * Applies distance fog to a surface colour.
 *
 * This is the function that submerges the geometry. Without it a lit rock
 * face reads as a rock face on a blue backdrop; with it, the rock dissolves
 * into exactly the water the background is drawing behind it and the two
 * become one image. `HALF` is the distance at which half the surface's own
 * colour has been replaced by water.
 *
 * Note that it fogs toward the backdrop along the *view ray*, not toward the
 * water at the surface's own depth. Using the latter is the intuitive version
 * and it is wrong in a way that is easy to miss until you look down: distant
 * deep geometry fogs to near-black while the water above it is still bright,
 * and the two meet along a hard horizon line that no amount of fog can hide.
 */
const HALF = 34.0;
export const submerge = Fn(([color, viewDistance, rayDir, camDepth]) => {
  const fog = float(1.0).sub(exp(viewDistance.div(HALF).negate()));
  return mix(color, backdropAt(rayDir, camDepth), clamp(fog, 0.0, 1.0));
});

/**
 * Ambient light arriving at a surface. There is no light *object* in this
 * scene: the sun is the surface of the sea, so everything is lit from
 * straight up by however much daylight is left at that depth, and surfaces
 * facing down get only the faint bounce from the water around them.
 */
export const ambientAt = (normalY, depth) => {
  const facingUp = clamp(normalY.mul(0.5).add(0.5), 0.0, 1.0);
  const key = pow(facingUp, float(1.6)).mul(daylightAt(depth));
  // The floor term is bounce light off the water itself. Without it, every
  // downward-facing surface — the underside of every ledge and overhang —
  // goes to pure black, and large dead patches read as missing geometry
  // rather than as shadow.
  return max(key, float(0.0)).add(0.10);
};
