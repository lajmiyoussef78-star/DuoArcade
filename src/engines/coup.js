// Veilcourt — realtime engine for the duo game shell.

import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import Coup from '../pages/Coup.jsx';

let root = null;
let finished = false;

export const meta = {
  id: 'coup',
  name: 'Veilcourt',
  tag: 'court intrigue · bluff · coins',
  accent: 'candle',
  realtime: true
};

export function mount(el, ctx) {
  unmount();
  finished = false;
  el.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'coup-wrap';
  el.appendChild(wrap);

  const isHost = ctx.myRole === 'A';
  const finish = w => {
    if (finished) return;
    finished = true;
    ctx.onFinish(w);
  };

  root = createRoot(wrap);
  root.render(createElement(Coup, {
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
