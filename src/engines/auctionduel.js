// Auction Duel — secret bids; 10 random draws from a 20-card pool (1–10 ×2).

import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import Auction from '../pages/Auction.jsx';

let root = null;
let finished = false;

export const meta = {
  id: 'auctionduel',
  name: 'Auction Duel',
  tag: 'secret bids · 10 random titles',
  accent: 'candle',
  realtime: true
};

export function mount(el, ctx) {
  unmount();
  finished = false;
  el.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'au-wrap';
  el.appendChild(wrap);

  const isHost = ctx.myRole === 'A';
  const finish = w => {
    if (finished) return;
    finished = true;
    ctx.onFinish(w);
  };

  root = createRoot(wrap);
  root.render(createElement(Auction, {
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
  /* turn-based bidding — no clock to pause */
}

export function unmount() {
  root?.unmount();
  root = null;
  finished = false;
}
