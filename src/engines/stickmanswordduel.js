// Stickman Sword Duel — neon fighter, host-authoritative over duo realtime.

import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import StickmanSwordDuel from '../stickman/StickmanSwordDuel.jsx';

let root = null;
let pausedRef = { current: false };
let finished = false;

export const meta = {
  id: 'stickmanswordduel',
  name: 'Stickman Sword Duel',
  tag: 'real-time · neon fighter · first to 3',
  accent: 'p2',
  realtime: true
};

export function mount(el, ctx) {
  unmount();
  finished = false;
  pausedRef = { current: false };
  el.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'ssd-wrap';
  el.appendChild(wrap);

  const isHost = ctx.myRole === 'A';
  const finish = w => {
    if (finished) return;
    finished = true;
    ctx.onFinish(w);
  };

  root = createRoot(wrap);
  root.render(createElement(StickmanSwordDuel, {
    myRole: ctx.myRole,
    names: ctx.names,
    rt: ctx.rt,
    pausedRef,
    onComplete: w => {
      if (isHost) finish(w);
    }
  }));
}

export function setPaused(p) {
  pausedRef.current = !!p;
}

export function unmount() {
  root?.unmount();
  root = null;
  finished = false;
}
