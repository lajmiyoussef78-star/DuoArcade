// UNO — classic duo match on a shared felt table.

import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import Uno from '../pages/Uno.jsx';

let root = null;
let finished = false;

export const meta = {
  id: 'uno',
  name: 'UNO',
  tag: 'classic · 2 players · felt table',
  accent: 'candle',
  realtime: true
};

export function mount(el, ctx) {
  unmount();
  finished = false;
  el.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'uno-wrap';
  el.appendChild(wrap);

  const isHost = ctx.myRole === 'A';
  const finish = w => {
    if (finished) return;
    finished = true;
    ctx.onFinish(w);
  };

  root = createRoot(wrap);
  root.render(createElement(Uno, {
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
  /* turn-based cards — no clock */
}

export function unmount() {
  root?.unmount();
  root = null;
  finished = false;
}
