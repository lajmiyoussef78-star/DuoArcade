// Carrot in a Box — realtime engine for the duo game shell.

import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import Carrot from '../pages/Carrot.jsx';

let root = null;
let finished = false;

export const meta = {
  id: 'carrot',
  name: 'Carrot in a Box',
  tag: 'bluff · keep or swap',
  accent: 'candle',
  realtime: true
};

export function mount(el, ctx) {
  unmount();
  finished = false;
  el.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'carrot-wrap';
  el.appendChild(wrap);

  const isHost = ctx.myRole === 'A';
  const finish = w => {
    if (finished) return;
    finished = true;
    ctx.onFinish(w);
  };

  root = createRoot(wrap);
  root.render(createElement(Carrot, {
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
  /* turn-based bluff — no clock */
}

export function unmount() {
  root?.unmount();
  root = null;
  finished = false;
}
