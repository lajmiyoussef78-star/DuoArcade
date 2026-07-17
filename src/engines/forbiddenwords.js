// Forbidden Words — turn-based Q&A with secret trap words.

import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import Forbidden from '../pages/Forbidden.jsx';

let root = null;
let finished = false;

export const meta = {
  id: 'forbiddenwords',
  name: 'Forbidden Words',
  tag: 'turn-based · Q&A · trap words',
  accent: 'candle',
  realtime: true
};

export function mount(el, ctx) {
  unmount();
  finished = false;
  el.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'fb-wrap';
  el.appendChild(wrap);

  const isHost = ctx.myRole === 'A';
  const finish = w => {
    if (finished) return;
    finished = true;
    ctx.onFinish(w);
  };

  root = createRoot(wrap);
  root.render(createElement(Forbidden, {
    myRole: ctx.myRole,
    names: ctx.names,
    rt: ctx.rt,
    onComplete: w => {
      if (isHost) finish(w);
    }
  }));
}

export function setPaused(_p) {
  /* turn-based chat — no clock to pause */
}

export function unmount() {
  root?.unmount();
  root = null;
  finished = false;
}
