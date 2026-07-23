// Dominoes — real-time draw dominoes (double-six, first to 50), 2 devices.
// Lockstep moves over the shell RT channel, same pattern as chkobba.js.
// No dedicated SQL required — match wins go through the shell onFinish tally.
// Optional schema lives at supabase/schema-v31-dominoes.sql if you want a log later.

import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import DominoesDuel from '../pages/Dominoes.jsx';

let root = null;
let finished = false;

export const meta = {
  id: 'dominoes',
  name: 'Dominoes',
  tag: 'real-time · draw · first to 50',
  accent: 'candle',
  realtime: true
};

export function mount(el, ctx) {
  unmount();
  finished = false;
  el.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'dominoes-wrap';
  el.appendChild(wrap);

  const isHost = ctx.myRole === 'A';
  const finish = w => {
    if (finished) return;
    finished = true;
    ctx.onFinish(w);
  };

  root = createRoot(wrap);
  root.render(createElement(DominoesDuel, {
    myRole: ctx.myRole,
    names: ctx.names,
    rt: ctx.rt,
    code: ctx.code,
    onMatchEnd: ({ winner }) => {
      if (!isHost || winner == null) return;
      finish(winner === 0 ? 'A' : 'B');
    }
  }));
}

export function setPaused(_p) {
  /* turn-based dominoes — no clock */
}

export function unmount() {
  root?.unmount();
  root = null;
  finished = false;
}
