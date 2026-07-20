// Magnet Hearts — magnet pods + raining hearts for the duo game shell.

import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import MagnetHearts from '../pages/MagnetHearts.jsx';

let root = null;
let finished = false;

export const meta = {
  id: 'magnethearts',
  name: 'Magnet Hearts',
  tag: 'arcade · magnets · 90 seconds',
  accent: 'p2',
  realtime: true
};

export function mount(el, ctx) {
  unmount();
  finished = false;
  el.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'magnethearts-wrap';
  el.appendChild(wrap);

  const isHost = ctx.myRole === 'A';
  const finish = w => {
    if (finished) return;
    finished = true;
    ctx.onFinish(w);
  };

  root = createRoot(wrap);
  root.render(createElement(MagnetHearts, {
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
