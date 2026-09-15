// The camera rig: scroll as cinematography rather than as a scrub bar.
//
// The previous build mapped scroll to a single number and the picture
// changed. Here scroll moves a real camera down a real canyon, which buys
// the two things a fullscreen shader can never fake: parallax (the near wall
// slides past faster than the far one) and occlusion (things get in front of
// other things). It also means the framing can be *authored* — the descent is
// a sequence of shots, not one continuous fall at one continuous speed.
import { PerspectiveCamera, CatmullRomCurve3, Vector3 } from 'three';
import { WORLD_DEPTH } from './field.js';

/**
 * The path itself. It descends the whole world height while drifting across
 * the corridor, so the walls change which side they crowd — a straight
 * vertical drop reads as a lift shaft, and the drift is most of what sells
 * this as travelling through something rather than falling past it.
 */
const PATH = new CatmullRomCurve3([
  new Vector3(0, 4, 26), // above the surface line, looking down into it
  new Vector3(-5, -26, 16),
  new Vector3(6, -68, 6),
  new Vector3(-8, -112, -2),
  new Vector3(4, -158, -8),
  new Vector3(-3, -206, -6),
  new Vector3(0, -WORLD_DEPTH + 16, 2), // settling onto the output floor
], false, 'catmullrom', 0.5);

/**
 * Where the camera looks, as its own curve rather than "along the path".
 * Tangent-following is what makes scroll-driven cameras feel like a
 * rollercoaster: the view whips around every bend because it is bolted to
 * the direction of travel. Aiming at a separate, lazier curve lets the
 * camera drift sideways while still looking where the scene wants attention,
 * which is how a shot is actually framed.
 *
 * The aim swings from wall to wall while staying only a little below the
 * camera, so the descent looks *across* the corridor rather than down it. The
 * obvious placement — a curve sitting directly under the path — points the
 * camera at its own feet: the walls never enter frame, the parallax that
 * justifies the geometry is invisible, and the whole dive becomes a long
 * look at the floor. Only the last point tips down, to land on the floor.
 */
const AIM = new CatmullRomCurve3([
  new Vector3(10, -14, -16),
  new Vector3(-12, -44, -20),
  new Vector3(12, -86, -24),
  new Vector3(-14, -130, -22),
  new Vector3(10, -176, -20),
  new Vector3(-8, -222, -16),
  new Vector3(0, -WORLD_DEPTH + 4, -6), // finally tipping down onto the floor
], false, 'catmullrom', 0.5);

// The focal length opens up as the dive deepens. A tighter lens at the top
// keeps the surface intimate; a wider one below makes the canyon feel like it
// is closing in, which is the same trick a film would use and costs nothing.
const FOV_SURFACE = 46;
const FOV_ABYSS = 62;

export function createCameraRig(aspect) {
  const camera = new PerspectiveCamera(FOV_SURFACE, aspect, 0.5, 600);
  const pos = new Vector3();
  const aim = new Vector3();

  return {
    camera,

    /**
     * @param {number} t 0..1 — the eased scroll position.
     * @param {number} parX pointer parallax, radians-ish
     * @param {number} parY
     */
    update(t, parX = 0, parY = 0) {
      PATH.getPointAt(Math.min(Math.max(t, 0), 1), pos);
      AIM.getPointAt(Math.min(Math.max(t, 0), 1), aim);

      camera.position.copy(pos);
      camera.lookAt(aim);

      // Pointer parallax is applied as a rotation *after* the lookAt rather
      // than by moving the camera: shifting position would slide the walls
      // past the viewer and read as the scene lurching, while a small
      // rotation reads as the diver turning their head.
      camera.rotateY(parX);
      camera.rotateX(parY);

      const fov = FOV_SURFACE + (FOV_ABYSS - FOV_SURFACE) * t;
      if (camera.fov !== fov) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
    },

    resize(nextAspect) {
      camera.aspect = nextAspect;
      camera.updateProjectionMatrix();
    },
  };
}
