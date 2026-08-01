/**
 * Prime Video stub — L3 coordination only (Amazon has first-party Watch Party).
 * Do not compete as “Prime sync” until intentional + probed.
 */
(function primeAdapter() {
  const H = window.__duoAdapterHelpers;

  window.__duoAdapter = {
    id: 'prime_video',
    detect() {
      return !!H.findVideo();
    },
    getState() {
      const v = H.findVideo();
      if (!v) return null;
      return { playing: !v.paused, position: v.currentTime || 0, duration: v.duration || 0 };
    },
    play() {},
    pause() {},
    seek() {},
    capabilities() {
      return { level: 3, play: false, pause: false, seek: false, stub: true };
    },
    onChange() {},
    onBuffer() {},
    onEpisodeChange() {},
    probe() { return H.runProbe(this); },
  };
})();
