// Ready, Set, Cook — native Phaser kitchen (project-gastronomica) inside DuoArcade.

import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import KitchenPlay from '../kitchen/KitchenPlay.jsx';

let root = null;
let rtForward = null;

export const meta = {
  id: 'readysetcook',
  name: 'Ready, Set, Cook',
  tag: 'co-op · kitchen · Overcooked vibe',
  accent: 'candle',
  realtime: true
};

export function mount(el, ctx) {
  unmount();
  el.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'rsc-wrap';
  el.appendChild(wrap);

  let finished = false;
  const isHost = ctx.myRole === 'A';

  const finishCoop = fromHost => {
    if (finished) return;
    finished = true;
    if (isHost) ctx.rt.send({ k: 'rsc-done' });
    if (fromHost) ctx.onFinish('draw');
  };

  const rtBridge = {
    send: payload => ctx.rt.send(payload),
    on: fn => { rtForward = fn; }
  };

  ctx.rt.on(msg => {
    if (!msg || typeof msg !== 'object') return;
    if (msg.k === 'rsc-done') finishCoop(false);
    // Lobby picks / chef state / hello — always forward to KitchenPlay.
    try { rtForward?.(msg); } catch (e) { console.warn('rsc rt', e); }
  });

  const onComplete = () => {
    if (isHost) finishCoop(true);
    else ctx.rt.send({ k: 'rsc-done' });
  };

  root = createRoot(wrap);
  root.render(createElement(KitchenPlay, {
    names: ctx.names,
    myRole: ctx.myRole,
    rt: rtBridge,
    onComplete
  }));
}

export function setPaused(_p) {
  /* Phaser handles its own pause key (P) inside the kitchen */
}

export function unmount() {
  root?.unmount();
  root = null;
  rtForward = null;
}
