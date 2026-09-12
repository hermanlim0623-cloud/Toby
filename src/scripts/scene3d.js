import * as THREE from 'three';

// The "TOBY Automation Core": a lit, faceted core wrapped in two wireframe
// shells and a loose particle field. Emerges slowly from darkness on load,
// drifts and rotates at a deliberately slow pace, leans gently toward the
// cursor, and dollies/dissolves as the visitor scrolls past the hero —
// tying the object to the page's camera/scroll narrative rather than
// spinning on its own as decoration.
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

  // ---- lighting: dark environment, one key light, one violet rim light,
  // one teal accent used for the emissive glow / occasional sweep.
  const ambient = new THREE.AmbientLight(0x1a2230, 0.04);
  scene.add(ambient);

  const keyLight = new THREE.DirectionalLight(0xf3f4f0, 1.15);
  keyLight.position.set(3.2, 4, 5.5);
  scene.add(keyLight);

  const rimLight = new THREE.PointLight(0x8c7bff, 6, 20);
  rimLight.position.set(-4, -1.6, -5);
  scene.add(rimLight);

  const accentLight = new THREE.PointLight(0x6ef0c6, 4, 16);
  accentLight.position.set(2.2, -1.4, 4.2);
  scene.add(accentLight);

  const group = new THREE.Group();
  scene.add(group);

  // Solid faceted core — this is what actually receives light/reflections.
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.55, 1),
    new THREE.MeshStandardMaterial({
      color: 0x0c1016,
      metalness: 0.88,
      roughness: 0.28,
      emissive: 0x123a30,
      emissiveIntensity: 0.5,
      flatShading: true,
    })
  );
  group.add(core);

  // Outer + inner wireframe shells give it structure without competing
  // with the lit core for attention.
  const shell = new THREE.Mesh(
    new THREE.IcosahedronGeometry(2.15, 1),
    new THREE.MeshBasicMaterial({ color: 0x6ef0c6, wireframe: true, transparent: true, opacity: 0.32 })
  );
  group.add(shell);

  const innerShell = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.05, 0),
    new THREE.MeshBasicMaterial({ color: 0x8c7bff, wireframe: true, transparent: true, opacity: 0.28 })
  );
  group.add(innerShell);

  const particleCount = 160;
  const positions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i++) {
    const r = 3.4 + Math.random() * 2.4;
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
    new THREE.PointsMaterial({ color: 0xd7fff0, size: 0.03, transparent: true, opacity: 0 })
  );
  group.add(particles);

  // Everything starts invisible/dark; the entrance tween below reveals it.
  const dimmables = { ambient: 0.04, keyIntensity: 0, rimIntensity: 0, accentIntensity: 0, shellOpacity: 0, innerOpacity: 0, particleOpacity: 0, emissive: 0 };
  keyLight.intensity = 0;
  rimLight.intensity = 0;
  accentLight.intensity = 0;
  shell.material.opacity = 0;
  innerShell.material.opacity = 0;
  core.material.emissiveIntensity = 0;
  core.scale.setScalar(0.7);

  let pointerX = 0, pointerY = 0, scrollT = 0, visible = true, raf = null;
  let rotTargetX = 0, rotTargetY = 0;
  const clock = new THREE.Clock();

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    camera.aspect = rect.width / rect.height || 1;
    camera.updateProjectionMatrix();
    renderer.setSize(rect.width, rect.height, false);
  }
  resize();
  window.addEventListener('resize', resize);

  window.addEventListener('pointermove', (e) => {
    pointerX = (e.clientX / window.innerWidth) * 2 - 1;
    pointerY = (e.clientY / window.innerHeight) * 2 - 1;
  });

  const heroEl = canvas.parentElement.parentElement;
  function updateScroll() {
    const heroHeight = heroEl?.offsetHeight || window.innerHeight;
    scrollT = Math.min(Math.max(window.scrollY / heroHeight, 0), 1);
  }
  window.addEventListener('scroll', updateScroll, { passive: true });
  updateScroll();

  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible && !raf) tick();
  }, { threshold: 0.02 });
  io.observe(canvas.parentElement);

  function tick() {
    if (!visible) { raf = null; return; }
    const t = clock.getElapsedTime();

    // Slow, elegant rotation + gentle floating drift — never a fast spin.
    rotTargetX += (pointerY * 0.22 - rotTargetX) * 0.02;
    rotTargetY += (pointerX * 0.22 - rotTargetY) * 0.02;
    group.rotation.x = rotTargetX + scrollT * 0.5;
    group.rotation.y = t * 0.055 + rotTargetY;
    group.position.y = Math.sin(t * 0.35) * 0.12;
    particles.rotation.y -= 0.00035;

    // Scroll dolly: camera pushes in and the core dissolves into the
    // next section as the visitor scrolls past the hero.
    const targetZ = 9.4 - scrollT * 2.6;
    camera.position.z += (targetZ - camera.position.z) * 0.06;
    camera.position.x += (pointerX * 0.45 - camera.position.x) * 0.03;
    camera.position.y += (-pointerY * 0.3 - camera.position.y) * 0.03;
    camera.lookAt(0, 0, 0);

    shell.material.opacity = dimmables.shellOpacity * (1 - scrollT * 0.6);
    innerShell.material.opacity = dimmables.innerOpacity * (1 - scrollT * 0.5);
    core.material.opacity = 1;

    // Occasional slow light sweep across the surface, independent of the
    // continuous key light — a subtle cinematic beat rather than a loop.
    const sweep = (Math.sin(t * 0.12) + 1) / 2;
    keyLight.position.x = 3.2 + sweep * 2.4;
    keyLight.intensity = dimmables.keyIntensity * (0.85 + sweep * 0.3);
    rimLight.intensity = dimmables.rimIntensity;
    accentLight.intensity = dimmables.accentIntensity;

    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  }
  tick();

  // Entrance: light and material reveal from darkness, ~2.4s, easing in
  // after the DOM/hero text has already begun its own entrance.
  if (gsap) {
    gsap.to(dimmables, {
      ambient: 0.55,
      keyIntensity: 1.15,
      rimIntensity: 5,
      accentIntensity: 3.2,
      shellOpacity: 0.32,
      innerOpacity: 0.28,
      particleOpacity: 0.55,
      emissive: 0.5,
      duration: 2.6,
      ease: 'power2.out',
      delay: 0.3,
      onUpdate() {
        core.material.emissiveIntensity = dimmables.emissive;
        particles.material.opacity = dimmables.particleOpacity;
        ambient.intensity = dimmables.ambient;
      },
    });
    gsap.to(core.scale, { x: 1, y: 1, z: 1, duration: 2.2, ease: 'power3.out', delay: 0.3 });
  } else {
    ambient.intensity = 0.55;
    dimmables.keyIntensity = 1.15;
    dimmables.rimIntensity = 5;
    dimmables.accentIntensity = 3.2;
    dimmables.shellOpacity = 0.32;
    dimmables.innerOpacity = 0.28;
    particles.material.opacity = 0.55;
    core.material.emissiveIntensity = 0.5;
    core.scale.setScalar(1);
  }

  return {
    destroy() {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener('scroll', updateScroll);
      window.removeEventListener('resize', resize);
      renderer.dispose();
    },
  };
}
