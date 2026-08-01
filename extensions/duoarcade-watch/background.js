/**
 * DuoArcade Watch — service worker (Manifest V3).
 * Web tab remains Supabase authority. Extension only bridges playhead events.
 */

const EXT_SOURCE = 'duoarcade-watch-ext';

/** @type {{ token: object|null, platform: string|null, streamingTabId: number|null, duoTabId: number|null }} */
let state = {
  token: null,
  platform: null,
  streamingTabId: null,
  duoTabId: null,
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('keepalive', { periodInMinutes: 0.4 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepalive') {
    // Touch storage so the worker is less likely to stay dead during a party.
    chrome.storage.session.set({ ping: Date.now() }).catch(() => {});
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  handleMessage(msg, sender).then(sendResponse).catch((err) => {
    sendResponse({ ok: false, error: String(err?.message || err) });
  });
  return true;
});

chrome.runtime.onMessageExternal.addListener((msg, sender, sendResponse) => {
  handleMessage(msg, sender).then(sendResponse).catch((err) => {
    sendResponse({ ok: false, error: String(err?.message || err) });
  });
  return true;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === state.streamingTabId) {
    state.streamingTabId = null;
    forwardToDuo({ type: 'tab-closed' });
  }
  if (tabId === state.duoTabId) {
    state.duoTabId = null;
  }
});

async function handleMessage(msg, sender) {
  if (!msg || typeof msg !== 'object') return { ok: false };

  if (msg.type === 'bind') {
    const token = msg.token;
    if (!token || !token.code || !token.role) return { ok: false, error: 'bad-token' };
    if (Date.now() > Number(token.expiresAt || 0)) return { ok: false, error: 'expired' };
    state.token = token;
    state.platform = msg.platform || 'netflix';
    if (sender?.tab?.id) state.duoTabId = sender.tab.id;
    await chrome.storage.session.set({ bind: token, platform: state.platform });
    await forwardToDuo({ type: 'ext-hello', platform: state.platform });
    return { ok: true };
  }

  if (msg.type === 'web-hello') {
    if (sender?.tab?.id) state.duoTabId = sender.tab.id;
    if (state.token) {
      await forwardToDuo({ type: 'ext-hello', platform: state.platform });
    }
    return { ok: true, bound: !!state.token };
  }

  if (msg.type === 'content-ready') {
    if (sender?.tab?.id) state.streamingTabId = sender.tab.id;
    const level = Number(msg.capability) || 3;
    await forwardToDuo({ type: 'capability', level, platform: msg.platform });
    return { ok: true };
  }

  if (msg.type === 'playhead' || msg.type === 'buffer' || msg.type === 'episode') {
    if (sender?.tab?.id) state.streamingTabId = sender.tab.id;
    await forwardToDuo(msg);
    return { ok: true };
  }

  if (msg.type === 'apply-playhead' || msg.type === 'request-playhead') {
    return relayToStreaming(msg);
  }

  if (msg.type === 'get-state') {
    return {
      ok: true,
      bound: !!state.token,
      platform: state.platform,
      streamingTabId: state.streamingTabId,
      duoTabId: state.duoTabId,
    };
  }

  return { ok: false, error: 'unknown' };
}

async function forwardToDuo(payload) {
  const envelope = { source: EXT_SOURCE, ...payload };
  if (state.duoTabId != null) {
    try {
      await chrome.tabs.sendMessage(state.duoTabId, envelope);
      return;
    } catch { /* fall through */ }
  }
  // Fallback: find DuoArcade tabs
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    const url = tab.url || '';
    if (!/localhost|duoarcade\.com/i.test(url)) continue;
    try {
      await chrome.tabs.sendMessage(tab.id, envelope);
      state.duoTabId = tab.id;
      return;
    } catch { /* next */ }
  }
}

async function relayToStreaming(msg) {
  if (state.streamingTabId == null) {
    // Try detect Netflix/etc tab
    const tabs = await chrome.tabs.query({});
    const hit = tabs.find(t => /netflix\.com|disneyplus\.com|max\.com|primevideo\.com/i.test(t.url || ''));
    if (hit) state.streamingTabId = hit.id;
  }
  if (state.streamingTabId == null) return { ok: false, error: 'no-streaming-tab' };
  try {
    await chrome.tabs.sendMessage(state.streamingTabId, msg);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
}
