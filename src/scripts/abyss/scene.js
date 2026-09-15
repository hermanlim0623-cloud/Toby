// Assembly: the camera rig, the water column behind everything, the canyon
// in front of it, and the life moving through both.
//
// Each piece owns its own look; this file owns what they share. The uniforms
// created here are the only mutable state the shaders can see, and every
// module reads the same ones — which is why the rock, the murk and the
// particles cannot disagree about where the camera is or how deep it has got.
import { Scene, Matrix3, Vector3 } from 'three';
import { uniform } from 'three/tsl';
import { createCameraRig } from './camera.js';
import { createAtmosphere } from './atmosphere.js';
import { createTerrain } from './terrain.js';
import { createParticles } from './particles.js';
import { WORLD_DEPTH } from './water.js';

export function createAbyssScene({ tier, aspect, hasCompute, prefersReducedMotion }) {
  const scene = new Scene();
  const rig = createCameraRig(aspect);

  const uniforms = {
    time: uniform(0),
    aspect: uniform(aspect),
    // Scroll progress, eased. Kept even though the camera now carries the
    // descent, because the closing sequence and the HUD still speak in it.
    depth: uniform(0),
    // shutdown.js scrubs this to 1 as the camera "pulls back" at the end.
    surfaceRush: uniform(0),
    // The camera, unpacked for the shaders that need to rebuild its rays.
    cameraPos: uniform(new Vector3()),
    cameraBasis: uniform(new Matrix3()),
    tanHalfFov: uniform(0.4),
    // Seconds since the previous frame. The simulation integrates against it
    // rather than assuming a fixed step, so a school of fish swims at the
    // same speed on a 60Hz and a 144Hz display instead of at twice the pace.
    delta: uniform(1 / 60),
  };

  const atmosphere = createAtmosphere({ tier, uniforms });
  scene.backgroundNode = atmosphere.node;

  const terrain = createTerrain({ tier });
  scene.add(terrain.group);

  const particles = createParticles({ tier, uniforms, hasCompute, prefersReducedMotion });
  particles?.objects.forEach((o) => scene.add(o));

  const basis = new Matrix3();

  return {
    scene,
    camera: rig.camera,
    uniforms,
    /** Compute passes the controller must dispatch before each render. */
    computes: particles?.computes ?? [],

    /**
     * @param {number} t eased scroll, 0..1
     * @param {number} time seconds
     * @param {{x:number,y:number}} parallax pointer offset in radians
     */
    update(t, time, parallax, delta = 1 / 60) {
      rig.update(t, parallax.x, parallax.y);

      // Clamped: a tab returning from the background hands us a delta of
      // several seconds, and integrating that in one step launches every
      // particle out of the field it was meant to stay in.
      uniforms.delta.value = Math.min(delta, 1 / 20);
      uniforms.time.value = time;
      uniforms.depth.value = t;
      uniforms.cameraPos.value.copy(rig.camera.position);
      // The rotation part of the camera's world matrix, which is what turns a
      // view-space ray into a world-space one inside the atmosphere shader.
      uniforms.cameraBasis.value = basis.setFromMatrix4(rig.camera.matrixWorld);
      uniforms.tanHalfFov.value = Math.tan((rig.camera.fov * Math.PI) / 360);

      particles?.follow(rig.camera.position);
    },

    resize(nextAspect) {
      rig.resize(nextAspect);
      uniforms.aspect.value = nextAspect;
    },

    dispose() {
      terrain.dispose();
      particles?.dispose();
    },
  };
}

export { WORLD_DEPTH };
