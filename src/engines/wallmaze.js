// Wallmaze — race + walls strategy duel for the duo game shell.
// No dedicated SQL required — match wins go through the shell onFinish tally.
// Optional schema lives at supabase/schema-v33-wallmaze.sql if you want a log later.

import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import Wallmaze from '../pages/Wallmaze.jsx';

let root = null;
let finished = false;

export const meta = {
  id: 'wallmaze',
  name: 'Wallmaze',
  tag: 'strategy · walls · best of 3',
  accent: 'candle',
  realtime: true
};

export function mount(el, ctx) {
  unmount();
  finished = false;
  el.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'wallmaze-wrap';
  el.appendChild(wrap);

  const isHost = ctx.myRole === 'A';
  const finish = w => {
    if (finished) return;
    finished = true;
    ctx.onFinish(w);
  };

  root = createRoot(wrap);
  root.render(createElement(Wallmaze, {
    myRole: ctx.myRole,
    names: ctx.names,
    rt: ctx.rt,
    code: ctx.code,
    onComplete: w => {
      if (isHost) finish(w);
    }
  }));
}

export function setPaused(_p) {
  /* turn-based board — no clock */
}

export function unmount() {
  root?.unmount();
  root = null;
  finished = false;
}
