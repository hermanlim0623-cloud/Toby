// The cinematic dive: 6 underwater clips (public/videos/part-01..06.mp4)
// behave as one continuous ~60s timeline scrubbed by scroll position.
// Two <video> elements ("active" + "standby") crossfade at segment
// boundaries; the standby element is kept preloaded on whichever
// neighbouring clip is coming up next so the handoff has no stall.
//
// Playback is never driven by .play() — scroll position is mapped
// directly to a target time and the active video's currentTime eases
// toward it every animation frame (a classic scroll-scrub pattern),
// so scrolling up runs the footage backward for free.
const VIDEO_COUNT = 6;
const FALLBACK_DURATION = 10; // seconds — matches the ~10s/clip spec, used until real metadata loads
const SOURCES = Array.from({ length: VIDEO_COUNT }, (_, i) => `/videos/part-0${i + 1}.mp4`);

export function createCinema({ prefersReducedMotion, lowPower } = {}) {
  const stage = document.querySelector('[data-cinema]');
  if (!stage) return null;

  const loadingEl = stage.querySelector('[data-cinema-loading]');
  const layers = [
    { el: stage.querySelector('[data-cinema-a]'), index: -1 },
    { el: stage.querySelector('[data-cinema-b]'), index: -1 },
  ];
  if (!layers[0].el || !layers[1].el) return null;

  const preloadMode = lowPower ? 'metadata' : 'auto';
  layers.forEach((layer) => { layer.el.preload = preloadMode; });

  let activeLayer = layers[0];
  let standbyLayer = layers[1];
  let firstFrameReady = false;

  function assign(layer, index) {
    if (layer.index === index || index < 0 || index >= VIDEO_COUNT) return;
    layer.index = index;
    layer.el.src = SOURCES[index];
    layer.el.load();
  }

  function onLoaded(layer) {
    if (!firstFrameReady && layer === activeLayer) {
      firstFrameReady = true;
      loadingEl?.classList.add('is-hidden');
    }
  }
  layers.forEach((layer) => {
    layer.el.addEventListener('loadeddata', () => onLoaded(layer));
  });

  assign(activeLayer, 0);
  assign(standbyLayer, 1);
  activeLayer.el.classList.add('is-active');

  function preloadNeighbor(currentIndex, incomingFrom) {
    // Prefer the direction we're moving in; fall back to whichever
    // neighbour exists (covers the first/last segment).
    const forward = currentIndex + 1;
    const backward = currentIndex - 1;
    const next = incomingFrom <= currentIndex
      ? (forward < VIDEO_COUNT ? forward : backward)
      : (backward >= 0 ? backward : forward);
    if (next >= 0 && next < VIDEO_COUNT) assign(standbyLayer, next);
  }

  function crossTo(newIndex, fromIndex) {
    if (standbyLayer.index === newIndex) {
      activeLayer.el.classList.remove('is-active');
      standbyLayer.el.classList.add('is-active');
      const swap = activeLayer;
      activeLayer = standbyLayer;
      standbyLayer = swap;
    } else {
      // Large jump (fast flick-scroll, resize, direct hash nav) — no
      // matching preloaded neighbour, so just retarget the active layer.
      assign(activeLayer, newIndex);
    }
    preloadNeighbor(newIndex, fromIndex);
  }

  let smoothedT = 0; // 0..VIDEO_COUNT, continuous position across the whole dive
  let raf = null;
  const easing = prefersReducedMotion ? 1 : 0.14;

  function tick() {
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = docHeight > 0 ? Math.min(Math.max(window.scrollY / docHeight, 0), 1) : 0;
    const target = progress * VIDEO_COUNT;

    const previousIndex = Math.floor(Math.min(Math.max(smoothedT, 0), VIDEO_COUNT - 0.0001));
    smoothedT += (target - smoothedT) * easing;
    const clamped = Math.min(Math.max(smoothedT, 0), VIDEO_COUNT - 0.0001);
    const idx = Math.floor(clamped);
    const localT = clamped - idx;

    if (idx !== activeLayer.index) crossTo(idx, previousIndex);

    const dur = activeLayer.el.duration && isFinite(activeLayer.el.duration)
      ? activeLayer.el.duration
      : FALLBACK_DURATION;
    const desired = localT * dur;
    if (Math.abs(activeLayer.el.currentTime - desired) > 0.02) {
      try { activeLayer.el.currentTime = desired; } catch (e) { /* not seekable yet */ }
    }

    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);

  return {
    destroy() {
      cancelAnimationFrame(raf);
    },
  };
}
