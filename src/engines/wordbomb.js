// Word Bomb — hot-potato fragment words with a hidden fuse.

import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import WordBomb from '../pages/WordBomb.jsx';

let root = null;
let finished = false;

export const meta = {
  id: 'wordbomb',
  name: 'Word Bomb',
  tag: 'hot potato · hidden fuse · 3 lives',
  accent: 'candle',
  realtime: true
};

export function mount(el, ctx) {
  unmount();
  finished = false;
  el.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'bo-wrap';
  el.appendChild(wrap);

  const isHost = ctx.myRole === 'A';
  const finish = w => {
    if (finished) return;
    finished = true;
    ctx.onFinish(w);
  };

  root = createRoot(wrap);
  root.render(createElement(WordBomb, {
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
  /* fuse timers are local; pausing mid-round is not supported */
}

export function unmount() {
  root?.unmount();
  root = null;
  finished = false;
}
