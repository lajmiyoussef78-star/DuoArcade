// Sumo Bomb — fused-bomb sumo ring for the duo game shell.

import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import SumoBomb from '../pages/SumoBomb.jsx';

let root = null;
let finished = false;

export const meta = {
  id: 'sumobomb',
  name: 'Sumo Bomb',
  tag: 'reflex · ring · best of 5',
  accent: 'candle',
  realtime: true
};

export function mount(el, ctx) {
  unmount();
  finished = false;
  el.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'sumobomb-wrap';
  el.appendChild(wrap);

  const isHost = ctx.myRole === 'A';
  const finish = w => {
    if (finished) return;
    finished = true;
    ctx.onFinish(w);
  };

  root = createRoot(wrap);
  root.render(createElement(SumoBomb, {
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
  /* host sim pauses via shell overlay */
}

export function unmount() {
  root?.unmount();
  root = null;
  finished = false;
}
