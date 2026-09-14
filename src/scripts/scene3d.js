import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// The TOBY mark, reduced to just the single "T" monogram: normalized and
// lit, sitting fixed and centered behind the whole page (see .toby-stage
// in global.css) rather than confined to the hero. It emerges from
// darkness once and stays in place — no left/right traverse — while its
// material evolves with scroll depth, dimming slightly outside the hero
// so page content stays legible.
const LETTERS = [
  { file: 't-monogram.glb', scale: 1 },
];
const TARGET_HEIGHT = 2.2;
const LETTER_GAP = 0.22;

// The T evolves with depth: bright glass at the surface, a darker,
// more saturated body deeper down, with an inner cyan core that only
// really announces itself once the dive reaches the abyss.
const SURFACE_COLOR = new THREE.Color(0xd9f0ff);
const ABYSS_COLOR = new THREE.Color(0x040608);
const SURFACE_EMISSIVE = new THREE.Color(0x1c4a5e);
const ABYSS_EMISSIVE = new THREE.Color(0x6feaff);

function buildLetterMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0x0c1016,
    metalness: 0.88,
    roughness: 0.28,
    emissive: 0x0a3a52,
    emissiveIntensity: 0.5,
    flatShading: false,
  });
}

function normalizeLetter(root, letterScale = 1) {
  root.traverse((node) => {
    if (node.isMesh) {
      node.material = buildLetterMaterial();
      node.castShadow = false;
      node.receiveShadow = false;
    }
  });
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  const scale = (TARGET_HEIGHT / (size.y || 1)) * letterScale;
  root.scale.setScalar(scale);

  const box2 = new THREE.Box3().setFromObject(root);
  const center = new THREE.Vector3();
  box2.getCenter(center);
  root.position.y -= center.y;
  root.position.z -= center.z;

  const size2 = new THREE.Vector3();
  box2.getSize(size2);
  return { root, width: size2.x };
}

async function loadWordmark(scene) {
  const loader = new GLTFLoader();
  const letters = await Promise.all(
    LETTERS.map((l) => loader.loadAsync(`/models/${l.file}`).then((gltf) => normalizeLetter(gltf.scene, l.scale)))
  );

  const totalWidth = letters.reduce((sum, l) => sum + l.width, 0) + LETTER_GAP * (letters.length - 1);
  let cursor = -totalWidth / 2;
  const wordGroup = new THREE.Group();
  letters.forEach(({ root, width }) => {
    root.position.x = cursor + width / 2;
    root.scale.setScalar(0); // pop-in handled by the entrance tween below
    wordGroup.add(root);
    cursor += width + LETTER_GAP;
  });
  scene.add(wordGroup);
  return { wordGroup, letters };
}

export function createHeroScene(canvas, { prefersReducedMotion, gsap } = {}) {
  if (!canvas || prefersReducedMotion) return null;
  if (window.innerWidth < 560) return null; // skip on small/low-power screens

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  } catch (e) {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 0, 9.4);

  // ---- lighting: dark environment, one key light, one ocean-blue rim
  // light, one bioluminescent accent used for the emissive glow / sweep.
  const ambient = new THREE.AmbientLight(0x0a2a3a, 0.04);
  scene.add(ambient);

  const keyLight = new THREE.DirectionalLight(0xf3f4f0, 1.15);
  keyLight.position.set(3.2, 4, 5.5);
  scene.add(keyLight);

  const rimLight = new THREE.PointLight(0x3aafe8, 6, 20);
  rimLight.position.set(-4, -1.6, -5);
  scene.add(rimLight);

  const accentLight = new THREE.PointLight(0x6feaff, 4, 16);
  accentLight.position.set(2.2, -1.4, 4.2);
  scene.add(accentLight);

  const particleCount = 140;
  const positions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i++) {
    const r = 3.6 + Math.random() * 2.6;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
  }
  const particleGeo = new THREE.BufferGeometry();
  particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const particles = new THREE.Points(
    particleGeo,
    new THREE.PointsMaterial({ color: 0xd6f3ff, size: 0.03, transparent: true, opacity: 0 })
  );
  scene.add(particles);

  const dimmables = { ambient: 0.04, keyIntensity: 0, rimIntensity: 0, accentIntensity: 0, particleOpacity: 0, emissive: 0 };
  keyLight.intensity = 0;
  rimLight.intensity = 0;
  accentLight.intensity = 0;

  let pointerX = 0, pointerY = 0, visible = true, raf = null, wordGroup = null;
  let rawPointerX = -9999, rawPointerY = -9999; // raw client px, for per-letter proximity
  let rotTargetX = 0, rotTargetY = 0;
  let scrollDim = 1; // 1 = full presence (hero), fades to ~0.4 past the hero
  let depthT = 0; // 0 = surface, 1 = abyss — same easing as the depth-meter/scrim
  let letterMeshes = [];
  let materials = [];
  const _matColor = new THREE.Color();
  const _matEmissive = new THREE.Color();
  const HOVER_RADIUS = 320; // px
  const HOVER_DISPLACE = 0.9; // world units
  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const clock = new THREE.Clock();
  const _screenPos = new THREE.Vector3();

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h || 1;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }
  resize();
  window.addEventListener('resize', resize);

  window.addEventListener('pointermove', (e) => {
    pointerX = (e.clientX / window.innerWidth) * 2 - 1;
    pointerY = (e.clientY / window.innerHeight) * 2 - 1;
    rawPointerX = e.clientX;
    rawPointerY = e.clientY;
  });
  window.addEventListener('pointerleave', () => {
    rawPointerX = -9999;
    rawPointerY = -9999;
  });

  const heroEl = document.querySelector('.hero');
  const footerEl = document.querySelector('.site-foot');
  function updateScroll() {
    const heroHeight = heroEl?.offsetHeight || window.innerHeight;
    const pastHero = Math.min(Math.max((window.scrollY - heroHeight * 0.7) / heroHeight, 0), 1);
    let dim = 1 - pastHero * 0.62; // settle at ~0.38 once well past the hero

    // Brighten again as the closing CTA/footer comes into view — a bookend.
    if (footerEl) {
      const footerTop = footerEl.getBoundingClientRect().top;
      const nearFooter = 1 - Math.min(Math.max(footerTop / window.innerHeight, 0), 1);
      dim = Math.max(dim, nearFooter * 0.85);
    }
    scrollDim = dim;

    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const pageProgress = docHeight > 0 ? window.scrollY / docHeight : 0;
    // Mirrors the depth-meter/scrim curve in ocean.js: descends through
    // ~82% of the page, then eases back toward the surface look for the
    // closing transmission/shutdown stretch, so the T isn't still reading
    // "abyss" while the copy and depth reading say otherwise.
    const clampedProgress = Math.min(Math.max(pageProgress, 0), 1);
    depthT = clampedProgress <= 0.82
      ? Math.pow(clampedProgress / 0.82, 1.35)
      : Math.max(0, 1 - ((clampedProgress - 0.82) / 0.18) * 0.92);
  }
  window.addEventListener('scroll', updateScroll, { passive: true });
  updateScroll();

  document.addEventListener('visibilitychange', () => {
    visible = document.visibilityState === 'visible';
    if (visible && !raf) tick();
  });

  function tick() {
    if (!visible) { raf = null; return; }
    const t = clock.getElapsedTime();

    if (wordGroup) {
      rotTargetX += (pointerY * 0.14 - rotTargetX) * 0.02;
      rotTargetY += (pointerX * 0.16 - rotTargetY) * 0.02;
      wordGroup.rotation.x = rotTargetX;
      wordGroup.rotation.y = Math.sin(t * 0.05) * 0.05 + rotTargetY;
      wordGroup.position.y = Math.sin(t * 0.35) * 0.08;
      wordGroup.updateMatrixWorld();
    }

    // Letters lean/scatter away from the cursor when it comes near — each
    // one measured in real screen space, not just the group's overall tilt.
    if (canHover && letterMeshes.length) {
      const w = window.innerWidth, h = window.innerHeight;
      letterMeshes.forEach(({ root, base }) => {
        _screenPos.copy(base).applyMatrix4(wordGroup.matrixWorld).project(camera);
        const sx = (_screenPos.x * 0.5 + 0.5) * w;
        const sy = (1 - (_screenPos.y * 0.5 + 0.5)) * h;
        const dx = sx - rawPointerX;
        const dy = sy - rawPointerY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        let targetX = 0, targetY = 0, targetZ = 0;
        if (dist < HOVER_RADIUS) {
          const force = 1 - dist / HOVER_RADIUS;
          const eased = force * force;
          const nx = dist > 0.001 ? dx / dist : 0;
          const ny = dist > 0.001 ? dy / dist : 0;
          targetX = nx * eased * HOVER_DISPLACE;
          targetY = -ny * eased * HOVER_DISPLACE;
          targetZ = eased * HOVER_DISPLACE * 0.6;
        }
        root.position.x += (base.x + targetX - root.position.x) * 0.12;
        root.position.y += (base.y + targetY - root.position.y) * 0.12;
        root.position.z += (base.z + targetZ - root.position.z) * 0.12;
      });
    }

    // The T's material evolves with depth: glass-bright at the surface,
    // toward a dark, almost silhouetted body with a strengthening cyan
    // core the deeper the dive goes.
    if (materials.length) {
      _matColor.lerpColors(SURFACE_COLOR, ABYSS_COLOR, depthT);
      _matEmissive.lerpColors(SURFACE_EMISSIVE, ABYSS_EMISSIVE, depthT);
      const targetIntensity = (0.35 + depthT * 1.15) * dimmables.emissive;
      materials.forEach((m) => {
        m.color.copy(_matColor);
        m.emissive.copy(_matEmissive);
        m.emissiveIntensity = targetIntensity;
      });
    }

    particles.rotation.y -= 0.00025;

    camera.position.x += (pointerX * 0.35 - camera.position.x) * 0.03;
    camera.position.y += (-pointerY * 0.22 - camera.position.y) * 0.03;
    camera.lookAt(0, 0, 0);

    // Occasional slow light sweep across the surface, independent of the
    // continuous key light — a subtle cinematic beat rather than a loop.
    const sweep = (Math.sin(t * 0.12) + 1) / 2;
    keyLight.position.x = 3.2 + sweep * 2.4;
    keyLight.intensity = dimmables.keyIntensity * (0.85 + sweep * 0.3) * scrollDim;
    rimLight.intensity = dimmables.rimIntensity * scrollDim;
    accentLight.intensity = dimmables.accentIntensity * scrollDim;
    ambient.intensity = dimmables.ambient * (0.4 + scrollDim * 0.6);
    particles.material.opacity = dimmables.particleOpacity * scrollDim;

    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  }
  tick();

  const entrance = gsap
    ? gsap.to(dimmables, {
        ambient: 0.55,
        keyIntensity: 1.15,
        rimIntensity: 5,
        accentIntensity: 3.2,
        particleOpacity: 0.5,
        emissive: 1,
        duration: 2.6,
        ease: 'power2.out',
        delay: 0.3,
      })
    : null;
  if (!gsap) {
    dimmables.ambient = 0.55;
    dimmables.keyIntensity = 1.15;
    dimmables.rimIntensity = 5;
    dimmables.accentIntensity = 3.2;
    dimmables.particleOpacity = 0.5;
    dimmables.emissive = 1;
  }

  loadWordmark(scene)
    .then((result) => {
      wordGroup = result.wordGroup;
      letterMeshes = result.letters.map((l) => ({ root: l.root, base: l.root.position.clone() }));
      materials = result.letters.flatMap((l) => {
        const mats = [];
        l.root.traverse((node) => { if (node.isMesh) mats.push(node.material); });
        return mats;
      });
      if (gsap) {
        gsap.to(
          result.letters.map((l) => l.root.scale),
          { x: 1, y: 1, z: 1, duration: 1.4, ease: 'back.out(1.4)', stagger: 0.12, delay: 0.35 }
        );
      } else {
        result.letters.forEach((l) => l.root.scale.setScalar(1));
      }
    })
    .catch(() => {
      // Missing/broken model files: fail quietly, keep the lit atmosphere.
    });

  return {
    destroy() {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', updateScroll);
      window.removeEventListener('resize', resize);
      entrance && entrance.kill();
      renderer.dispose();
    },
  };
}
