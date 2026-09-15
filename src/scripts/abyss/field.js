// The shared model of the environment: how deep into the system a point is,
// what the medium looks like there, and how much of a surface's own light
// survives the distance back to the camera.
//
// Every visual imports from here, and that is the whole point. The haze is a
// raymarch, the architecture is lit geometry and the motes come out of a
// compute buffer — three completely different render paths that have to agree
// on what "layer four" looks like, or the geometry visibly floats in front of
// the background instead of being inside it. Sharing a palette is not enough;
// they have to share the *functions*.
import { vec3, float, mix, smoothstep, exp, clamp, pow, max, Fn } from 'three/tsl';

// The machine is 260 units deep and the descent spans it: y = 0 is the
// surface the signal enters at, y = -WORLD_DEPTH is the output floor. Real
// units rather than a 0..1 parameter, because geometry has to be authored
// somewhere and "the strata start at -40" is a sentence you can act on.
export const WORLD_DEPTH = 260;

// These are LINEAR values, and the frame is sRGB-encoded on its way to the
// screen — which lifts the midtones hard. A linear 0.09 lands near 0.33 on
// the display, so a palette that looks like a reasonable near-black in these
// numbers arrives as mid-grey. Everything here is therefore authored
// backwards from the intended screen colour, roughly display^2.2, and any
// change has to be judged on a canvas capture rather than on a render-target
// readback, which shows the raw linear values instead.
export const ENTRY_TINT = vec3(0.011, 0.020, 0.034); // the lit upper layers
export const CORE_TINT = vec3(0.0035, 0.0065, 0.013); // the working depth
export const FLOOR_TINT = vec3(0.0006, 0.0011, 0.0022); // not pure black — pure black reads as "broken"
export const SIGNAL_TINT = vec3(0.49, 0.89, 0.96); // scan light: cyan, never white
export const STRUCTURE_TINT = vec3(0.011, 0.013, 0.017); // the architecture, before any light

/** 0 at the entry surface, 1 at the output floor, for any world height. */
export const depthAt = (y) => clamp(y.negate().div(WORLD_DEPTH), 0.0, 1.0);

/**
 * How much of the entry signal still reaches a given depth. Exponential,
 * because that is how a signal attenuates through a medium — and it is why
 * the first third of the scroll changes so much more than the last third.
 */
export const daylightAt = (depth) => exp(depth.mul(-3.2));

/** The colour of the medium itself at a depth, with nothing lit in it. */
export const mediumAt = (depth) => mix(
  mix(ENTRY_TINT, CORE_TINT, smoothstep(0.0, 0.4, depth)),
  FLOOR_TINT,
  smoothstep(0.3, 0.9, depth),
);

/**
 * What a ray ends up looking at when nothing solid stops it: brighter toward
 * the entry surface, near-black toward the floor, graded by how much signal
 * survives to the camera's own depth.
 *
 * Both the haze pass and the fog below call this, and that is the point.
 * Geometry has to fade into *the thing actually drawn behind it*; fade it
 * toward anything else and the seam shows.
 */
export const backdropAt = Fn(([rayDir, camDepth]) => {
  const upward = clamp(rayDir.y.mul(0.5).add(0.5), 0.0, 1.0);
  const deepTint = mix(CORE_TINT, FLOOR_TINT, smoothstep(0.1, 0.75, camDepth));
  const lit = mix(deepTint, mediumAt(camDepth), daylightAt(camDepth));
  return mix(deepTint, lit, pow(upward, float(2.6)));
});

/**
 * Applies distance fog to a surface colour.
 *
 * This is the function that puts the geometry *inside* the environment.
 * Without it a lit face reads as a face on a dark backdrop; with it, it
 * dissolves into exactly the medium the background is drawing behind it and
 * the two become one image. `HALF` is the distance at which half the
 * surface's own colour has been replaced by the medium.
 *
 * Note that it fogs toward the backdrop along the *view ray*, not toward the
 * medium at the surface's own depth. Using the latter is the intuitive
 * version and it is wrong in a way that is easy to miss until you look down:
 * distant deep geometry fogs to near-black while the medium above it is still
 * bright, and the two meet along a hard horizon line no amount of fog hides.
 */
const HALF = 34.0;
export const submerge = Fn(([color, viewDistance, rayDir, camDepth]) => {
  const fog = float(1.0).sub(exp(viewDistance.div(HALF).negate()));
  return mix(color, backdropAt(rayDir, camDepth), clamp(fog, 0.0, 1.0));
});

/**
 * Ambient light arriving at a surface. There is no light *object* here: the
 * source is the entry surface itself, so everything is lit from straight up
 * by whatever signal is left at that depth, and faces pointing down get only
 * the faint bounce from the medium around them.
 *
 * The floor term matters more than it looks. Without it every downward-facing
 * surface — the underside of every ledge and overhang — goes to pure black,
 * and large dead patches read as missing geometry rather than as shadow.
 */
export const ambientAt = (normalY, depth) => {
  const facingUp = clamp(normalY.mul(0.5).add(0.5), 0.0, 1.0);
  const key = pow(facingUp, float(1.6)).mul(daylightAt(depth));
  return max(key, float(0.0)).add(0.10);
};
