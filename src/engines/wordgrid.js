// Word Grid — real-time 2-device Boggle duel (same grid, parallel hunts, 60s each).
// No dedicated SQL required — match wins go through the shell onFinish tally.
// Optional schema lives at supabase/schema-v32-wordgrid.sql if you want a log later.

import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import WordGridDuel from '../pages/wordgrid/WordGridDuel.jsx';

let root = null;
let finished = false;

export const meta = {
  id: 'wordgrid',
  name: 'Word Grid',
  tag: 'real-time · boggle · shared words cancel',
  accent: 'p1',
  realtime: true
};

export function mount(el, ctx) {
  unmount();
  finished = false;
  el.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'wordgrid-wrap';
  el.appendChild(wrap);

  const isHost = ctx.myRole === 'A';
  const finish = w => {
    if (finished) return;
    finished = true;
    ctx.onFinish(w);
  };

  root = createRoot(wrap);
  root.render(createElement(WordGridDuel, {
    myRole: ctx.myRole,
    names: ctx.names,
    rt: ctx.rt,
    code: ctx.code,
    onMatchEnd: ({ winner }) => {
      if (!isHost) return;
      if (winner == null) finish('draw');
      else finish(winner === 0 ? 'A' : 'B');
    }
  }));
}

export function setPaused(_p) {
  /* timed hunts live inside the game */
}

export function unmount() {
  root?.unmount();
  root = null;
  finished = false;
}
