// engines/reversi.js — PLACEHOLDER.
// >>> Replace this file with your original engines/reversi.js — it works unchanged. <<<
// This stub keeps the app building and shows a friendly note on the shelf.
export const meta = { id: 'reversi', name: 'Reversi', tag: 'the deep one', realtime: false };

export function initialState() { return {}; }
export function applyMove() { return null; }
export function winner() { return null; }

function note(host) {
  host.innerHTML = '';
  const box = document.createElement('div');
  box.className = 'wait-box';
  box.innerHTML = '<div>\u{1F6E0}\uFE0F <b>Reversi</b> isn\u2019t wired up in this build yet.</div>' +
    '<div class="dots-score" style="max-width:380px">Copy your original <code>engines/reversi.js</code> into <code>src/engines/</code> to enable it.</div>';
  host.appendChild(box);
}

export function render(host) { note(host); }
export function mount(host) { note(host); }
export function unmount() {}
