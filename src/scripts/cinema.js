// The cinematic dive: one continuous clip whose currentTime is driven by
// scroll position — scroll 0% is the surface, scroll 100% is the seafloor.
//
// The single biggest factor in whether this feels smooth or stuttery isn't
// here, it's the encode. With a normal keyframe interval (the source clip
// had two keyframes in 240 frames) the browser must rewind to the last
// keyframe and decode everything forward on every seek, which is what
// makes most scroll-scrubbed video judder no matter how good the JS is.
// Both files below are encoded all-intra — every frame a keyframe — so any
// seek is instant. If the footage is ever replaced, re-encode it the same
// way or the judder comes straight back:
//
//   ffmpeg -i source.mp4 -an -c:v libx264 -preset slow -crf 23 \
//     -g 1 -keyint_min 1 -sc_threshold 0 -pix_fmt yuv420p \
//     -movflags +faststart public/videos/dive.mp4
//
//   ffmpeg -i source.mp4 -an -vf scale=854:480 -c:v libx264 -preset slow \
//     -crf 26 -g 1 -keyint_min 1 -sc_threshold 0 -pix_fmt yuv420p \
//     -movflags +faststart public/videos/dive-mobile.mp4
import { planSeek } from './seekPolicy.js';

const MOBILE_SOURCE = '/videos/dive-mobile.mp4';
const DESKTOP_SOURCE = '/videos/dive.mp4';
const FALLBACK_DURATION = 10;
// Per-frame easing at 60fps; scaled by real delta time below so the feel is
// identical on 60Hz, 90Hz and 120Hz displays instead of getting twice as
// twitchy on a high-refresh screen.
const EASE_PER_FRAME = 0.12;

export function createCinema({ prefersReducedMotion, lowPower } = {}) {
  const stage = document.querySelector('[data-cinema]');
  if (!stage) return null;

  const video = stage.querySelector('[data-cinema-video]');
  const loadingEl = stage.querySelector('[data-cinema-loading]');
  if (!video) return null;

  video.src = lowPower ? MOBILE_SOURCE : DESKTOP_SOURCE;
  video.preload = 'auto';
  video.load();

  let revealed = false;
  function reveal() {
    if (revealed) return;
    revealed = true;
    loadingEl?.classList.add('is-hidden');
  }

  // iOS/WebKit won't paint a single frame of a <video> that has never
  // actually played, even after setting .currentTime directly — a muted
  // play() immediately followed by pause() ("priming" the decoder) is the
  // standard fix, and is exempt from the autoplay gesture requirement
  // because the video is muted.
  function primeDecoder() {
    const attempt = video.play();
    if (attempt && typeof attempt.then === 'function') {
      attempt.then(() => video.pause()).catch(() => {});
    }
  }
  video.addEventListener('loadeddata', () => { primeDecoder(); reveal(); });
  // Safety net: if `loadeddata` never fires for any reason, the loading
  // cover must not stay up and hide the page behind it forever.
  setTimeout(reveal, 4000);
  primeDecoder();

  // Stacking seeks is the other big source of judder: assigning a new
  // currentTime while the previous seek is still resolving makes the
  // browser abandon work it already started, so only one is kept in
  // flight. The rule for when that is safe lives in seekPolicy.js —
  // see the note there on why it is a deadline and not a boolean.
  let seekingSince = 0;
  const clearSeek = () => { seekingSince = 0; };
  video.addEventListener('seeking', () => { seekingSince = performance.now(); });
  video.addEventListener('seeked', clearSeek);
  // Every event that means "that seek is not coming back" also clears it.
  ['error', 'abort', 'emptied', 'stalled', 'suspend'].forEach((type) =>
    video.addEventListener(type, clearSeek)
  );

  let smoothedTime = 0;
  let lastFrame = performance.now();
  let raf = null;
  let depthRatio = 0; // shared with the water shader so both agree on depth

  // shutdown.js dispatches this continuously across its own scrub, well
  // after the shader instance below exists (or doesn't, on a low-power
  // device) — an event keeps the two modules decoupled either way.
  let surfaceRush = 0;
  function onSurfaceRush(e) { surfaceRush = e.detail?.value ?? 0; }
  window.addEventListener('cinema:surface-rush', onSurfaceRush);

  function tick(now) {
    const delta = Math.min((now - lastFrame) / 1000, 0.1); // clamp after tab-out
    lastFrame = now;

    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = docHeight > 0 ? Math.min(Math.max(window.scrollY / docHeight, 0), 1) : 0;
    depthRatio = progress;
    const duration = video.duration && isFinite(video.duration) ? video.duration : FALLBACK_DURATION;
    const target = progress * duration;

    if (prefersReducedMotion) {
      smoothedTime = target;
    } else {
      // Frame-rate independent exponential ease toward the scroll target.
      const factor = 1 - Math.pow(1 - EASE_PER_FRAME, delta * 60);
      smoothedTime += (target - smoothedTime) * factor;
      // Settle exactly rather than creeping toward the target forever.
      if (Math.abs(target - smoothedTime) < 0.004) smoothedTime = target;
    }

    const seekTo = planSeek({
      readyState: video.readyState,
      currentTime: video.currentTime,
      target: smoothedTime,
      buffered: video.buffered,
      seekingSince,
      now,
    });
    if (seekTo !== null) {
      try {
        // Plain currentTime rather than fastSeek: with an all-keyframe
        // encode "nearest keyframe" is already the exact frame, so
        // fastSeek buys nothing and has looser completion semantics.
        video.currentTime = seekTo;
      } catch { /* not seekable yet — the next frame retries */ }
    }

    raf = requestAnimationFrame(tick);
  }

  // Don't start reading scroll progress until the page has fully loaded —
  // web fonts and other layout shifts change document.scrollHeight for a
  // moment right after first paint, which would otherwise make the very
  // first computed target jump around before things settle.
  function start() {
    if (raf) return;
    lastFrame = performance.now();
    raf = requestAnimationFrame(tick);
  }
  if (document.readyState === 'complete') {
    start();
  } else {
    window.addEventListener('load', start, { once: true });
  }

  // The footage is normally rendered through a water-refraction shader
  // (see waterShader.js) rather than shown directly; the <video> stays in
  // the DOM as the texture source. If WebGL isn't available or the context
  // is lost, the class below never lands / gets removed and the plain
  // element is what the visitor sees — same footage, no distortion.
  let shader = null;
  if (!prefersReducedMotion && !lowPower) {
    import('./waterShader.js')
      .then(({ createWaterShader }) => {
        const shaderCanvas = stage.querySelector('[data-cinema-gl]');
        shader = createWaterShader(shaderCanvas, video, {
          getDepth: () => depthRatio,
          getSurfaceRush: () => surfaceRush,
          posterSrc: video.getAttribute('poster'),
        });
        if (!shader) return;
        stage.classList.add('is-shaded');
        document.documentElement.classList.add('gl-active');
        shader.onContextLost.then(() => {
          stage.classList.remove('is-shaded');
          document.documentElement.classList.remove('gl-active');
        });
      })
      .catch(() => { /* plain video stays visible */ });
  }

  return {
    destroy() {
      cancelAnimationFrame(raf);
      window.removeEventListener('cinema:surface-rush', onSurfaceRush);
      shader?.destroy();
    },
  };
}
