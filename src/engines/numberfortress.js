// Number Fortress — secret bids on IQ questions, 10 rounds.

import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import NumberFortress from '../pages/NumberFortress.jsx';

let root = null;
let finished = false;

export const meta = {
  id: 'numberfortress',
  name: 'Number Fortress',
  tag: 'IQ bids · 10 rounds',
  accent: 'candle',
  realtime: true
};

export function mount(el, ctx) {
  unmount();
  finished = false;
  el.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'nf-wrap';
  el.appendChild(wrap);

  const isHost = ctx.myRole === 'A';
  const finish = w => {
    if (finished) return;
    finished = true;
    ctx.onFinish(w);
  };

  root = createRoot(wrap);
  root.render(createElement(NumberFortress, {
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
  /* turn-based rounds — timer pauses only if shell pauses the whole match */
}

export function unmount() {
  root?.unmount();
  root = null;
  finished = false;
}
