import * as THREE from 'three';

// Lightweight hero centerpiece: a wireframe icosahedron wrapped in a loose
// particle field. Reacts to pointer position and scroll, capped DPR, and
// pauses its render loop whenever the hero leaves the viewport.
export function createHeroScene(canvas, { prefersReducedMotion } = {}) {
  if (!canvas || prefersReducedMotion) return null;
  if (window.innerWidth < 560) return null; // skip on small/low-power screens

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  } catch (e) {
    return null;
  }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 9);

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));

  const group = new THREE.Group();
  scene.add(group);

  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(2.1, 1),
    new THREE.MeshBasicMaterial({ color: 0x6ef0c6, wireframe: true, transparent: true, opacity: 0.55 })
  );
  group.add(core);

  const innerCore = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.15, 0),
    new THREE.MeshBasicMaterial({ color: 0x8c7bff, wireframe: true, transparent: true, opacity: 0.4 })
  );
  group.add(innerCore);

  const particleCount = 180;
  const positions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i++) {
    const r = 3.4 + Math.random() * 2.2;
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
    new THREE.PointsMaterial({ color: 0xd7fff0, size: 0.035, transparent: true, opacity: 0.6 })
  );
  group.add(particles);

  let pointerX = 0, pointerY = 0, scrollT = 0, visible = true, raf = null;

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

  window.addEventListener('scroll', () => {
    scrollT = window.scrollY / (window.innerHeight || 1);
  }, { passive: true });

  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible && !raf) tick();
  }, { threshold: 0.05 });
  io.observe(canvas.parentElement);

  function tick() {
    if (!visible) { raf = null; return; }
    group.rotation.y += 0.0018;
    group.rotation.x = pointerY * 0.25 + scrollT * 0.4;
    group.rotation.y += pointerX * 0.0006;
    particles.rotation.y -= 0.0009;
    camera.position.x += (pointerX * 0.6 - camera.position.x) * 0.04;
    camera.position.y += (-pointerY * 0.4 - camera.position.y) * 0.04;
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  }
  tick();

  return {
    destroy() {
      cancelAnimationFrame(raf);
      io.disconnect();
      renderer.dispose();
    },
  };
}
