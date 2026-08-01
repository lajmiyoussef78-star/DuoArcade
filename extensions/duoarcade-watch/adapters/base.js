/**
 * StreamingAdapter base helpers (content-script scope).
 * Platform files set window.__duoAdapter.
 */
(function baseAdapter() {
  window.__duoAdapterHelpers = {
    findVideo() {
      const videos = Array.from(document.querySelectorAll('video'));
      return videos.find(v => v.readyState >= 1 && v.offsetParent !== null) || videos[0] || null;
    },
    wireVideoEvents(video, onChange, onBuffer) {
      if (!video || video.__duoWired) return;
      video.__duoWired = true;
      const fire = () => onChange?.();
      video.addEventListener('play', fire);
      video.addEventListener('pause', fire);
      video.addEventListener('seeked', fire);
      video.addEventListener('ratechange', fire);
      video.addEventListener('waiting', () => onBuffer?.(true));
      video.addEventListener('playing', () => onBuffer?.(false));
      video.addEventListener('canplay', () => onBuffer?.(false));
    },
    /** Probe harness — returns capability report for debugging. */
    async runProbe(adapter) {
      const report = {
        platform: adapter.id,
        at: Date.now(),
        detect: false,
        hasVideo: false,
        canPlayPause: false,
        canSeek: false,
        level: 3,
        notes: [],
      };
      try {
        report.detect = !!adapter.detect?.();
        const st = adapter.getState?.();
        report.hasVideo = st != null && typeof st.position === 'number';
        if (!report.detect || !report.hasVideo) {
          report.notes.push('Player not ready — stay on L3 coordination');
          return report;
        }
        const before = st.playing;
        if (before) {
          adapter.pause?.();
          await sleep(400);
          const mid = adapter.getState?.();
          adapter.play?.();
          await sleep(400);
          report.canPlayPause = mid && mid.playing === false;
        } else {
          adapter.play?.();
          await sleep(400);
          const mid = adapter.getState?.();
          adapter.pause?.();
          await sleep(400);
          report.canPlayPause = mid && mid.playing === true;
        }
        const pos = adapter.getState?.()?.position || 0;
        adapter.seek?.(pos + 2);
        await sleep(500);
        const after = adapter.getState?.()?.position || 0;
        report.canSeek = Math.abs(after - (pos + 2)) < 1.5 || Math.abs(after - pos) > 0.5;
        if (report.canPlayPause && report.canSeek) report.level = 2;
        else if (report.canPlayPause) {
          report.level = 2;
          report.notes.push('Seek coarse/unreliable');
        } else {
          report.notes.push('Play/pause unavailable — L3 only');
        }
      } catch (err) {
        report.notes.push(String(err?.message || err));
      }
      console.info('[DuoArcade Watch probe]', report);
      return report;
    },
  };

  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }
})();
