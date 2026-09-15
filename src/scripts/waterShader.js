import { Renderer, Program, Mesh, Triangle, Texture } from 'ogl';

// Renders the dive footage through a fragment shader instead of showing the
// raw <video>, so the environment actually behaves like water: the image
// refracts around the cursor, compresses when the page is scrolled fast,
// drifts under slow caustic warping, and carries its own grain and vignette.
//
// This replaces the CSS grain overlay for anyone with WebGL — doing it in
// the shader means it's applied per-pixel to the image itself rather than
// composited as a separate always-on layer.
//
// If anything here fails (no WebGL, context lost, low-power device), the
// caller falls back to showing the plain <video> element and nothing about
// the rest of the site changes.

const VERTEX = /* glsl */ `
  attribute vec2 uv;
  attribute vec2 position;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  precision highp float;

  uniform sampler2D tMap;
  uniform vec2 uResolution;   // canvas size in px
  uniform vec2 uMediaRes;     // intrinsic video size, for object-fit: cover
  uniform vec2 uPointer;      // cursor in uv space
  uniform float uPointerFade; // 0 when the cursor has left the window
  uniform float uTime;
  uniform float uVelocity;    // normalized scroll speed
  uniform float uDepth;       // 0 at the surface, 1 in the abyss
  uniform float uPulse;       // 0..1, decays after a section-boundary "turn"
  uniform float uSurfaceRush; // 0..1, rises as the dive returns to the surface
  varying vec2 vUv;

  // Cheap hash-based noise — enough for grain and a soft caustic warp
  // without paying for a full simplex implementation every pixel.
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  // Replicates CSS object-fit: cover so the footage never stretches when
  // the viewport aspect doesn't match the video's.
  vec2 coverUv(vec2 uv, vec2 canvas, vec2 media) {
    float canvasAspect = canvas.x / canvas.y;
    float mediaAspect = media.x / media.y;
    vec2 scale = canvasAspect > mediaAspect
      ? vec2(1.0, mediaAspect / canvasAspect)
      : vec2(canvasAspect / mediaAspect, 1.0);
    return (uv - 0.5) * scale + 0.5;
  }

  void main() {
    vec2 uv = vUv;
    float aspect = uResolution.x / uResolution.y;
    vec2 centered = (uv - 0.5) * vec2(aspect, 1.0);
    float centerDist = length(centered);

    // --- slow ambient warp: the whole image breathes like water in motion
    float warp = noise(vec2(uv.x * 3.0, uv.y * 3.0 - uTime * 0.05));
    float warp2 = noise(vec2(uv.y * 4.0 + uTime * 0.03, uv.x * 4.0));
    vec2 ambient = vec2(warp - 0.5, warp2 - 0.5) * 0.006;

    // --- pointer lens: a soft refractive bulge trailing the cursor
    vec2 toPointer = uv - uPointer;
    toPointer.x *= aspect;
    float dist = length(toPointer);
    float lens = smoothstep(0.32, 0.0, dist) * uPointerFade;
    vec2 refraction = normalize(toPointer + 1e-6) * lens * lens * 0.045;

    // --- pressure wave: a ring expanding from centre, fired once per
    // section-boundary "turn" event and decaying in JS (see uPulse below).
    float wave = sin(centerDist * 26.0 - uPulse * 14.0) * uPulse * uPulse;
    vec2 waveDisp = normalize(centered + 1e-6) * wave * 0.01;

    // --- scroll velocity: vertical smear, as if moving through the water
    float smear = uVelocity * 0.06;

    vec2 distorted = uv + ambient - refraction + waveDisp;
    distorted.y += smear * (0.5 - uv.y) * 0.4;
    // Rising toward the surface at the very end of the dive: a gentle
    // upward drift, as if the current itself is pulling the camera up.
    distorted.y -= uSurfaceRush * 0.015;

    vec2 sampleUv = coverUv(distorted, uResolution, uMediaRes);

    // --- chromatic aberration, strongest where the lens bends hardest
    float ca = (lens * 0.004) + (abs(smear) * 0.002);
    vec2 caOffset = normalize(uv - 0.5 + 1e-6) * ca;
    vec3 color;
    color.r = texture2D(tMap, sampleUv + caOffset).r;
    color.g = texture2D(tMap, sampleUv).g;
    color.b = texture2D(tMap, sampleUv - caOffset).b;

    // --- caustic shimmer near the surface, fading out as the dive deepens,
    // and briefly blown out by a pressure-wave pulse or the surface rush
    float caustic = noise(vec2(uv.x * 8.0 + uTime * 0.08, uv.y * 8.0 - uTime * 0.12));
    caustic = pow(caustic, 3.0) * (1.0 - uDepth) * 0.16;
    caustic += uPulse * 0.22 * (1.0 - smoothstep(0.0, 0.6, centerDist));
    color += vec3(0.35, 0.75, 1.0) * caustic;
    color += vec3(0.55, 0.85, 0.95) * uSurfaceRush * 0.4;

    // --- the pointer lens also lifts the light slightly, like a magnifier
    color += vec3(0.16, 0.36, 0.45) * lens * 0.14;

    // --- vignette, deepening with depth, relaxing as the surface rush rises
    float vig = smoothstep(1.15, 0.28, centerDist);
    vig = mix(vig, 1.0, uSurfaceRush * 0.55);
    color *= mix(1.0, vig, 0.35 + uDepth * 0.35);

    // --- grain, applied to the image itself rather than as a flat overlay
    float grain = hash(uv * uResolution + fract(uTime) * 100.0) - 0.5;
    color += grain * 0.035;

    gl_FragColor = vec4(color, 1.0);
  }
`;

export function createWaterShader(canvas, video, { getDepth, posterSrc, getSurfaceRush } = {}) {
  if (!canvas || !video) return null;

  let renderer;
  try {
    renderer = new Renderer({
      canvas,
      alpha: false,
      antialias: false,
      dpr: Math.min(window.devicePixelRatio, 1.75),
powerPreference: 'high-performance',
    });
  } catch {
    return null;
  }
  const gl = renderer.gl;
  if (!gl) return null;

  const texture = new Texture(gl, {
    generateMipmaps: false,
    width: 16,
    height: 16,
  });

  // The poster frame stands in as the texture until the video has decoded
  // something, so the canvas never shows an empty black quad while several
  // megabytes of footage are still in flight.
  let posterReady = false;
  let videoReady = false;
  if (posterSrc) {
    const poster = new Image();
    poster.crossOrigin = 'anonymous';
    poster.onload = () => {
      if (videoReady) return;
      posterReady = true;
      texture.image = poster;
      program.uniforms.uMediaRes.value = [poster.naturalWidth, poster.naturalHeight];
    };
    poster.src = posterSrc;
  }

  const program = new Program(gl, {
    vertex: VERTEX,
    fragment: FRAGMENT,
    uniforms: {
      tMap: { value: texture },
      uResolution: { value: [1, 1] },
      uMediaRes: { value: [16, 9] },
      uPointer: { value: [0.5, 0.5] },
      uPointerFade: { value: 0 },
      uTime: { value: 0 },
      uVelocity: { value: 0 },
      uDepth: { value: 0 },
      uPulse: { value: 0 },
      uSurfaceRush: { value: 0 },
    },
  });
  const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h);
    program.uniforms.uResolution.value = [w * renderer.dpr, h * renderer.dpr];
  }
  resize();
  window.addEventListener('resize', resize);

  // Pointer is eased rather than snapped so the lens trails the cursor with
  // a bit of water-like inertia instead of sticking to it rigidly.
  let pointerTarget = [0.5, 0.5];
  let pointer = [0.5, 0.5];
  let pointerFadeTarget = 0;
  function onMove(e) {
    pointerTarget = [e.clientX / window.innerWidth, 1 - e.clientY / window.innerHeight];
    pointerFadeTarget = 1;
  }
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerleave', () => { pointerFadeTarget = 0; });

  // A section-boundary "turn" (sectionTransitions.js, the gallery-pin
  // release) spikes this to 1 and lets it decay each frame, rather than
  // driving it from a tween — the event can fire again before the last
  // pulse has finished settling, and a spike-and-decay reads correctly
  // either way without needing to track or cancel an in-flight tween.
  let pulse = 0;
  function onBoundary(e) {
    if (e.detail?.kind === 'turn') pulse = 1;
  }
  window.addEventListener('cinema:boundary', onBoundary);

  let lastScroll = window.scrollY;
  let velocity = 0;
  let raf = null;
  let running = true;
  const startedAt = performance.now();

  function frame(now) {
    if (!running) { raf = null; return; }

    // Upload the current video frame as a texture. readyState >= 2 means
    // there's decoded data for the current position — before that, leave
    // the last good frame up rather than flashing an empty texture.
    if (video.readyState >= 2) {
      if (texture.image !== video) {
        videoReady = true;
        texture.image = video;
        program.uniforms.uMediaRes.value = [
          video.videoWidth || 16,
          video.videoHeight || 9,
        ];
      }
      texture.needsUpdate = true;
    } else if (posterReady) {
      texture.needsUpdate = true;
    }

    const scrollNow = window.scrollY;
    const raw = (scrollNow - lastScroll) / Math.max(window.innerHeight, 1);
    lastScroll = scrollNow;
    velocity += (raw * 6 - velocity) * 0.12;

    pointer[0] += (pointerTarget[0] - pointer[0]) * 0.06;
    pointer[1] += (pointerTarget[1] - pointer[1]) * 0.06;
    program.uniforms.uPointer.value = pointer;
    program.uniforms.uPointerFade.value +=
      (pointerFadeTarget - program.uniforms.uPointerFade.value) * 0.05;
    program.uniforms.uTime.value = (now - startedAt) / 1000;
    program.uniforms.uVelocity.value = Math.max(-1.4, Math.min(1.4, velocity));
    program.uniforms.uDepth.value = getDepth ? getDepth() : 0;
    pulse *= 0.9;
    program.uniforms.uPulse.value = pulse;
    program.uniforms.uSurfaceRush.value = getSurfaceRush ? getSurfaceRush() : 0;

    renderer.render({ scene: mesh });
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  // A lost context would otherwise freeze on the last rendered frame
  // forever; hand the page back to the plain <video> instead.
  let onContextLost = null;
  const lostPromise = new Promise((resolve) => {
    onContextLost = (e) => { e.preventDefault(); running = false; resolve(); };
    canvas.addEventListener('webglcontextlost', onContextLost);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && running && !raf) {
      raf = requestAnimationFrame(frame);
    }
  });

  return {
    onContextLost: lostPromise,
    destroy() {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('cinema:boundary', onBoundary);
      if (onContextLost) canvas.removeEventListener('webglcontextlost', onContextLost);
    },
  };
}
