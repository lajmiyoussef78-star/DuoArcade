/**
 * Content script on streaming sites.
 * Uses window.__duoAdapter registered by platform adapter files.
 */
(function contentMain() {
  const adapter = window.__duoAdapter;
  if (!adapter) {
    console.info('[DuoArcade Watch] No adapter for this page');
    return;
  }

  let lastSent = 0;
  let applying = false;

  function reportReady() {
    const caps = adapter.capabilities?.() || { level: 3 };
    chrome.runtime.sendMessage({
      type: 'content-ready',
      platform: adapter.id,
      capability: caps.level || 3,
    }).catch(() => {});
  }

  function pushPlayhead(force) {
    if (applying && !force) return;
    const st = adapter.getState?.();
    if (!st) return;
    const now = Date.now();
    if (!force && now - lastSent < 350) return;
    lastSent = now;
    chrome.runtime.sendMessage({
      type: 'playhead',
      playing: !!st.playing,
      position: Number(st.position) || 0,
      at: now,
      platform: adapter.id,
    }).catch(() => {});
  }

  adapter.onChange?.(() => pushPlayhead(false));
  adapter.onBuffer?.((buffering) => {
    chrome.runtime.sendMessage({ type: 'buffer', buffering: !!buffering, platform: adapter.id }).catch(() => {});
  });
  adapter.onEpisodeChange?.((info) => {
    chrome.runtime.sendMessage({ type: 'episode', ...info, platform: adapter.id }).catch(() => {});
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg) return;
    if (msg.type === 'apply-playhead') {
      applying = true;
      try {
        if (typeof msg.position === 'number') adapter.seek?.(msg.position);
        if (msg.playing) adapter.play?.();
        else adapter.pause?.();
      } finally {
        setTimeout(() => { applying = false; }, 500);
      }
    }
    if (msg.type === 'request-playhead') {
      pushPlayhead(!!msg.force);
    }
  });

  if (adapter.detect?.()) {
    reportReady();
  } else {
    const obs = new MutationObserver(() => {
      if (adapter.detect?.()) {
        obs.disconnect();
        reportReady();
      }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => obs.disconnect(), 60000);
  }

  // Coarse heartbeat while playing (L2)
  setInterval(() => {
    const st = adapter.getState?.();
    if (st?.playing) pushPlayhead(false);
  }, 5000);

  window.addEventListener('beforeunload', () => {
    chrome.runtime.sendMessage({ type: 'tab-closed', platform: adapter.id }).catch(() => {});
  });
})();
