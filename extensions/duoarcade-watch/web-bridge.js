/**
 * Injected on DuoArcade web origins.
 * Relays window.postMessage (from React) ↔ extension background.
 * Web tab remains Supabase authority.
 */
(function webBridge() {
  const WEB_SOURCE = 'duoarcade-watch-web';
  const EXT_SOURCE = 'duoarcade-watch-ext';

  window.addEventListener('message', (ev) => {
    if (ev.source !== window) return;
    const data = ev.data;
    if (!data || data.source !== WEB_SOURCE) return;
    chrome.runtime.sendMessage(data).catch(() => {});
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg || msg.source !== EXT_SOURCE) return;
    window.postMessage(msg, window.location.origin);
  });

  // Announce presence so background can find this tab.
  chrome.runtime.sendMessage({ type: 'web-hello' }).catch(() => {});
})();
