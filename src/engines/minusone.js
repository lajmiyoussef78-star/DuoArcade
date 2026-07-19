// RPS Minus One — Squid Game RPS for the duo game shell.

import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import MinusOne from '../pages/MinusOne.jsx';

let root = null;
let finished = false;

export const meta = {
  id: 'minusone',
  name: 'Minus One',
  tag: 'rps · keep one',
  accent: 'candle',
  realtime: true
};

export function mount(el, ctx) {
  unmount();
  finished = false;
  el.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'minusone-wrap';
  el.appendChild(wrap);

  const isHost = ctx.myRole === 'A';
  const finish = w => {
    if (finished) return;
    finished = true;
    ctx.onFinish(w);
  };

  root = createRoot(wrap);
  root.render(createElement(MinusOne, {
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
  /* turn-based RPS — no clock pause needed beyond the soft countdown */
}

export function unmount() {
  root?.unmount();
  root = null;
  finished = false;
}
