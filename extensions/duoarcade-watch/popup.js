document.getElementById('probe')?.addEventListener('click', async () => {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab?.id || !/netflix\.com/i.test(tab.url || '')) {
    document.getElementById('status').textContent = 'Open a Netflix watch tab first.';
    return;
  }
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.__duoAdapter?.probe?.(),
    });
    document.getElementById('status').textContent = result
      ? `Probe L${result.level}: ${result.notes?.join('; ') || 'ok'}`
      : 'No adapter on this tab';
    document.getElementById('status').className = result?.level <= 2 ? 'ok' : 'warn';
  } catch (err) {
    document.getElementById('status').textContent = String(err?.message || err);
  }
});

chrome.runtime.sendMessage({ type: 'get-state' }).then((st) => {
  const el = document.getElementById('status');
  if (!el) return;
  if (st?.bound) {
    el.textContent = `Linked · ${st.platform || 'streaming'}`;
    el.className = 'ok';
  } else {
    el.textContent = 'Not linked — connect from DuoArcade Streaming Night';
    el.className = 'warn';
  }
}).catch(() => {});
