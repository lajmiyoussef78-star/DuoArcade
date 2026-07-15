// Ready, Set, Cook — co-op kitchen (project-gastronomica) embedded via iframe.
// Run the kitchen separately (npm run dev → :5174) or deploy it and set
// VITE_RSC_EMBED_URL / window.__RSC_EMBED_URL__.

export const meta = {
  id: 'readysetcook',
  name: 'Ready, Set, Cook',
  tag: 'co-op · kitchen · Overcooked vibe',
  accent: 'candle',
  realtime: true
};

let frame = null;
let onMsg = null;
let paused = false;

function embedBase() {
  if (typeof window !== 'undefined' && window.__RSC_EMBED_URL__) {
    return window.__RSC_EMBED_URL__.replace(/\/$/, '');
  }
  const fromEnv = import.meta.env.VITE_RSC_EMBED_URL;
  if (fromEnv) return String(fromEnv).replace(/\/$/, '');
  if (import.meta.env.DEV) return 'http://localhost:5174/embed';
  return '';
}

function buildSrc(ctx) {
  const base = embedBase();
  if (!base) return null;
  const q = new URLSearchParams({
    nameA: ctx.names.A || 'Chef A',
    nameB: ctx.names.B || 'Chef B',
    role: ctx.myRole,
    duo: ctx.code || ''
  });
  return `${base}?${q}`;
}

export function mount(el, ctx) {
  unmount();
  el.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'rsc-wrap';

  const src = buildSrc(ctx);
  if (!src) {
    wrap.innerHTML = `
      <div class="rsc-fallback">
        <p><strong>Kitchen not connected yet.</strong></p>
        <p>Run <code>project-gastronomica</code> locally (<code>npm run dev</code> → port 5174),
        or set a deployed embed URL before play:</p>
        <pre>window.__RSC_EMBED_URL__ = "https://your-kitchen-host/embed"</pre>
        <p class="rsc-fallback-link">
          <a href="https://github.com/MohamedAliZegnani/project-gastronomica" target="_blank" rel="noopener">
            github.com/MohamedAliZegnani/project-gastronomica
          </a>
        </p>
      </div>`;
    el.appendChild(wrap);
    return;
  }

  const hint = document.createElement('p');
  hint.className = 'rsc-hint';
  hint.textContent = ctx.myRole === 'A'
    ? `You’re ${ctx.names.A} — pick a kitchen, then cook with ${ctx.names.B}.`
    : `You’re ${ctx.names.B} — pick the same kitchen as ${ctx.names.A}.`;

  frame = document.createElement('iframe');
  frame.className = 'rsc-frame';
  frame.title = 'Ready, Set, Cook';
  frame.src = src;
  frame.allow = 'fullscreen';
  frame.setAttribute('loading', 'eager');

  wrap.appendChild(hint);
  wrap.appendChild(frame);
  el.appendChild(wrap);

  let finished = false;
  const isHost = ctx.myRole === 'A';

  const finishCoop = fromHost => {
    if (finished) return;
    finished = true;
    if (isHost) ctx.rt.send({ k: 'rsc-done' });
    if (fromHost) ctx.onFinish('draw');
  };

  ctx.rt.on(msg => {
    if (msg.k === 'rsc-done') finishCoop(false);
  });

  onMsg = e => {
    if (finished) return;
    const d = e.data;
    if (!d || d.type !== 'rsc:complete') return;
    if (isHost) finishCoop(true);
    else ctx.rt.send({ k: 'rsc-done' });
  };
  window.addEventListener('message', onMsg);

  if (paused) frame.style.pointerEvents = 'none';
}

export function setPaused(p) {
  paused = p;
  if (frame) frame.style.pointerEvents = p ? 'none' : '';
}

export function unmount() {
  if (onMsg) {
    window.removeEventListener('message', onMsg);
    onMsg = null;
  }
  frame = null;
  paused = false;
}
