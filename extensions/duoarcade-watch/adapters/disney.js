/**
 * Disney+ stub — L3 coordination only until probe harness stays green ≥2 weeks.
 * Registers adapter so content script loads safely; capabilities report level 3.
 */
(function disneyAdapter() {
  const H = window.__duoAdapterHelpers;

  window.__duoAdapter = {
    id: 'disney_plus',
    detect() {
      return !!H.findVideo();
    },
    getState() {
      const v = H.findVideo();
      if (!v) return null;
      return { playing: !v.paused, position: v.currentTime || 0, duration: v.duration || 0 };
    },
    play() { /* stub — do not drive player until green probes */ },
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
