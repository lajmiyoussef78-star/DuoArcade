/**
 * Max stub — L3 coordination only until probe harness stays green ≥2 weeks.
 */
(function maxAdapter() {
  const H = window.__duoAdapterHelpers;

  window.__duoAdapter = {
    id: 'max',
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
