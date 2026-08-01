/**
 * NetflixAdapter — L2 target (play/pause + coarse seek via HTML5 video).
 * Does NOT bypass DRM, scrape private APIs, or re-stream.
 * Fragile: Netflix DOM/player churn may break this; product auto-downgrades to L3.
 */
(function netflixAdapter() {
  const H = window.__duoAdapterHelpers;
  let changeCb = null;
  let bufferCb = null;
  let episodeCb = null;
  let lastHref = location.href;

  function video() {
    return H.findVideo();
  }

  function detect() {
    const v = video();
    if (v) H.wireVideoEvents(v, () => changeCb?.(), (b) => bufferCb?.(b));
    return !!v;
  }

  function getState() {
    const v = video();
    if (!v) return null;
    return {
      playing: !v.paused && !v.ended,
      position: v.currentTime || 0,
      duration: v.duration || 0,
    };
  }

  function play() {
    const v = video();
    if (!v) return;
    // Prefer clicking Netflix UI if present (custom controls).
    const btn = document.querySelector('[data-uia="control-play-pause-play"], .button-nfplayerPlay');
    if (btn && v.paused) {
      btn.click();
      return;
    }
    v.play?.().catch(() => {});
  }

  function pause() {
    const v = video();
    if (!v) return;
    const btn = document.querySelector('[data-uia="control-play-pause-pause"], .button-nfplayerPause');
    if (btn && !v.paused) {
      btn.click();
      return;
    }
    v.pause?.();
  }

  function seek(t) {
    const v = video();
    if (!v || !Number.isFinite(t)) return;
    try {
      v.currentTime = Math.max(0, Number(t));
    } catch { /* DRM / readyState */ }
  }

  function capabilities() {
    const st = getState();
    if (!st) return { level: 3, play: false, pause: false, seek: false };
    return { level: 2, play: true, pause: true, seek: true };
  }

  // Episode / title navigation heuristic
  setInterval(() => {
    if (location.href !== lastHref) {
      lastHref = location.href;
      episodeCb?.({ url: lastHref, title: document.title || null });
      changeCb?.();
    }
  }, 1500);

  window.__duoAdapter = {
    id: 'netflix',
    detect,
    getState,
    play,
    pause,
    seek,
    capabilities,
    onChange(cb) { changeCb = cb; },
    onBuffer(cb) { bufferCb = cb; },
    onEpisodeChange(cb) { episodeCb = cb; },
    probe() { return H.runProbe(window.__duoAdapter); },
  };
})();
