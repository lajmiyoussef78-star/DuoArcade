// src/arcade/WhiteboardCard.jsx — embedded whiteboard for sect-wall.
// Vector strokes + HiDPI canvas; Supabase broadcast + save_whiteboard persistence.
// Tools: select / pen / eraser / shapes / text; undo/redo + zoom are local + synced.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  myRoleInDuo, loadBoard, saveBoard, boardChannel,
  saveBoardSnapshot, listBoardSnapshots, getBoardSnapshot, updateBoardSnapshot,
  defaultSnapshotTitle,
  createBoardShare,
  boardShareUrl,
} from '../lib/whiteboard.js';
import '../styles/whiteboard.css';

const COLORS = [
  '#8B5CF6', '#EC4899', '#F43F5E', '#F97316',
  '#FBBF24', '#A3E635', '#2DD4BF', '#22D3EE',
  '#60A5FA', '#C084FC', '#F2EDF7', '#1F1630',
];
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.25;
const SIZES = [3, 6, 12];
const TEXT_SIZES = [
  { id: 'sm', label: 'S', px: 14 },
  { id: 'md', label: 'M', px: 20 },
  { id: 'lg', label: 'L', px: 28 },
];
const SELECTABLE = new Set([
  'rect', 'rect-fill', 'ellipse', 'ellipse-fill', 'line', 'arrow',
  'heart', 'heart-fill', 'text', 'sticky',
]);
const SHAPE_KINDS = new Set([
  'rect', 'rect-fill', 'ellipse', 'ellipse-fill', 'line', 'arrow',
  'heart', 'heart-fill',
]);
const SHAPE_MIN_NORM = 0.02;
const HIT_PAD = 0.012;
const STICKY_COLORS = ['#FDE68A', '#DDD6FE', '#FECDD3', '#A7F3D0'];
const STICKY_SIZES = [
  { id: 'sm', label: 'S', px: 120 },
  { id: 'md', label: 'M', px: 160 },
  { id: 'lg', label: 'L', px: 220 },
];
const STICKY_INK = '#1f1630';
const STICKY_MIN_PX = 80;
const STICKY_MAX_FRAC = 0.55;
const DBLCLICK_MS = 350;

function pathStickyShape(g, shape, x, y, bw, bh, radius) {
  g.beginPath();
  if (shape === 'heart') {
    const cx = x + bw / 2;
    g.moveTo(cx, y + bh * 0.32);
    g.bezierCurveTo(cx, y + bh * 0.08, x + bw * 0.08, y, x, y + bh * 0.28);
    g.bezierCurveTo(x - bw * 0.02, y + bh * 0.58, cx, y + bh * 0.78, cx, y + bh * 0.96);
    g.bezierCurveTo(cx, y + bh * 0.78, x + bw * 1.02, y + bh * 0.58, x + bw, y + bh * 0.28);
    g.bezierCurveTo(x + bw * 0.92, y, cx, y + bh * 0.08, cx, y + bh * 0.32);
    g.closePath();
    return;
  }
  if (typeof g.roundRect === 'function') g.roundRect(x, y, bw, bh, radius);
  else g.rect(x, y, bw, bh);
}

const TOOLS = [
  { id: 'select', label: 'Select', soon: false },
  { id: 'pen', label: 'Pen', soon: false },
  { id: 'eraser', label: 'Eraser', soon: false },
  { id: 'shapes', label: 'Shapes', soon: false },
  { id: 'text', label: 'Text', soon: false },
];

const SHAPES = [
  { id: 'heart', label: 'Heart' },
  { id: 'heart-fill', label: 'Heart solid' },
  { id: 'rect', label: 'Rectangle' },
  { id: 'rect-fill', label: 'Rectangle solid' },
  { id: 'ellipse', label: 'Circle' },
  { id: 'ellipse-fill', label: 'Circle solid' },
  { id: 'line', label: 'Line' },
  { id: 'arrow', label: 'Arrow' },
];

const FONTS = [
  { id: 'inter', label: 'Sans', family: 'Inter, system-ui, sans-serif' },
  { id: 'fraunces', label: 'Serif', family: 'Fraunces, Georgia, serif' },
  { id: 'mono', label: 'Mono', family: '"JetBrains Mono", ui-monospace, monospace' },
  { id: 'caveat', label: 'Script', family: 'Caveat, cursive' },
  { id: 'outfit', label: 'Display', family: 'Outfit, system-ui, sans-serif' },
];

function fontStack(id) {
  return FONTS.find(f => f.id === id)?.family || FONTS[0].family;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fontIdFromFamily(family) {
  if (!family) return 'inter';
  const low = family.toLowerCase();
  const hit = FONTS.find(f => low.includes(f.id) || low.includes(f.family.split(',')[0].replace(/"/g, '').toLowerCase()));
  return hit?.id || 'inter';
}

function plainToBlocks(text, style = {}) {
  const font = style.font || 'inter';
  const fs = style.fs > 0 ? style.fs : textSizePx(style.fontSize || 'sm');
  const align = style.align === 'center' || style.align === 'right' ? style.align : 'left';
  const lines = String(text ?? '').split('\n');
  return (lines.length ? lines : ['']).map(line => ({
    align,
    spans: [{ text: line, font, fs }],
  }));
}

function stickyBlocksOf(item) {
  if (Array.isArray(item?.blocks) && item.blocks.length) return item.blocks;
  return plainToBlocks(item?.text || '', item || {});
}

function blocksToPlain(blocks) {
  return (blocks || [])
    .map(b => (b.spans || []).map(s => (s.text || '').replace(/\u200b/g, '')).join(''))
    .join('\n');
}

function blocksToHtml(blocks) {
  const list = blocks?.length ? blocks : plainToBlocks('');
  return list.map(b => {
    const align = b.align === 'center' || b.align === 'right' ? b.align : 'left';
    const spans = b.spans?.length ? b.spans : [{ text: '', font: 'inter', fs: 14 }];
    const inner = spans.map(sp => {
      const fs = sp.fs > 0 ? sp.fs : 14;
      const body = escapeHtml(sp.text || '').replace(/\n/g, '<br>');
      return `<span data-font="${sp.font || 'inter'}" data-fs="${fs}" style="font-family:${fontStack(sp.font)};font-size:${fs}px;font-weight:600;color:${STICKY_INK}">${body || '<br>'}</span>`;
    }).join('');
    return `<div data-block="1" style="text-align:${align}">${inner || '<br>'}</div>`;
  }).join('');
}

function mergeSpans(spans) {
  const out = [];
  for (const sp of spans) {
    const prev = out[out.length - 1];
    if (prev && prev.font === sp.font && prev.fs === sp.fs) prev.text += sp.text;
    else out.push({ ...sp });
  }
  return out.length ? out : [{ text: '', font: 'inter', fs: 14 }];
}

function stickyEditorToBlocks(root) {
  if (!root) return plainToBlocks('');
  const blocks = [];

  const collectSpans = (node, inherited) => {
    const spans = [];
    const walk = (n, style) => {
      if (n.nodeType === 3) {
        spans.push({
          text: (n.textContent || '').replace(/\u200b/g, ''),
          font: style.font,
          fs: style.fs,
        });
        return;
      }
      if (n.nodeType !== 1) return;
      if (n.tagName === 'BR') {
        spans.push({ text: '\n', font: style.font, fs: style.fs });
        return;
      }
      const next = { ...style };
      if (n.dataset?.font) next.font = n.dataset.font;
      else if (n.style?.fontFamily) next.font = fontIdFromFamily(n.style.fontFamily);
      if (n.dataset?.fs) next.fs = Number(n.dataset.fs) || next.fs;
      else if (n.style?.fontSize) next.fs = parseFloat(n.style.fontSize) || next.fs;
      for (const c of n.childNodes) walk(c, next);
    };
    walk(node, inherited);
    return mergeSpans(spans);
  };

  const blockNodes = [...root.childNodes].filter(n =>
    n.nodeType === 1 && (n.dataset?.block || n.tagName === 'DIV' || n.tagName === 'P'));
  if (!blockNodes.length) {
    blocks.push({
      align: 'left',
      spans: collectSpans(root, { font: 'inter', fs: 14 }),
    });
    return blocks;
  }
  for (const block of blockNodes) {
    const align = block.style?.textAlign === 'center' || block.style?.textAlign === 'right'
      ? block.style.textAlign : 'left';
    blocks.push({
      align,
      spans: collectSpans(block, { font: 'inter', fs: 14 }),
    });
  }
  return blocks.length ? blocks : plainToBlocks('');
}

function wrapRichStickyLines(g, spans, maxW, scale) {
  const lines = [];
  let line = [];
  let lineW = 0;

  const measure = (text, font, fsPx) => {
    g.font = `600 ${fsPx}px ${fontStack(font)}`;
    return g.measureText(text).width;
  };

  const pushLine = () => {
    lines.push({
      segs: line,
      width: lineW,
      maxFs: line.length ? Math.max(...line.map(s => s.fsPx)) : Math.max(10, 14 * scale),
    });
    line = [];
    lineW = 0;
  };

  const appendToken = (token, font, fs) => {
    const fsPx = Math.max(10, fs * scale);
    let w = measure(token, font, fsPx);
    if (line.length && lineW + w > maxW) pushLine();
    if (!line.length && w > maxW) {
      let chunk = '';
      for (const ch of token) {
        const test = chunk + ch;
        const tw = measure(test, font, fsPx);
        if (chunk && tw > maxW) {
          const cw = measure(chunk, font, fsPx);
          line.push({ text: chunk, font, fsPx, w: cw });
          lineW = cw;
          pushLine();
          chunk = ch;
        } else chunk = test;
      }
      if (chunk) {
        const cw = measure(chunk, font, fsPx);
        line.push({ text: chunk, font, fsPx, w: cw });
        lineW += cw;
      }
      return;
    }
    line.push({ text: token, font, fsPx, w });
    lineW += w;
  };

  for (const sp of spans || []) {
    const font = sp.font || 'inter';
    const fs = sp.fs > 0 ? sp.fs : 14;
    const chunks = String(sp.text || '').split('\n');
    chunks.forEach((chunk, ci) => {
      for (const tok of chunk.split(/(\s+)/)) {
        if (!tok) continue;
        appendToken(tok, font, fs);
      }
      if (ci < chunks.length - 1) pushLine();
    });
  }
  if (line.length || !lines.length) pushLine();
  return lines;
}

let strokeSeq = 0;
const newId = role => Date.now().toString(36) + '-' + role + '-' + (strokeSeq++);

function ToolIcon({ id }) {
  const common = {
    viewBox: '0 0 24 24', width: 18, height: 18, fill: 'none',
    stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round',
  };
  switch (id) {
    case 'select':
      return (
        <svg {...common}>
          <path d="M5 3.5 18.5 12l-6.2 1.6L10 20.5 5 3.5Z" />
        </svg>
      );
    case 'pen':
      return (
        <svg {...common}>
          <path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19l-4 1Z" />
          <path d="M14 7l3 3" />
        </svg>
      );
    case 'eraser':
      return (
        <svg {...common}>
          <path d="M5 19h8.5l8.8-8.8a2.2 2.2 0 0 0 0-3.1l-2.4-2.4a2.2 2.2 0 0 0-3.1 0L5 14.9V19z" />
          <path d="M4 20.5h10.5" />
        </svg>
      );
    case 'shapes':
      return (
        <svg {...common}>
          <rect x="4" y="5" width="10" height="10" rx="1.5" />
          <circle cx="16.5" cy="15.5" r="4" />
        </svg>
      );
    case 'text':
      return (
        <svg {...common}>
          <path d="M5 6h14M12 6v13M8 19h8" />
        </svg>
      );
    case 'sticky':
      return (
        <svg {...common}>
          <path d="M6 4.5h9.5L19 8v11.5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-14a1 1 0 0 1 1-1Z" />
          <path d="M15.5 4.5V8H19" />
        </svg>
      );
    case 'clear':
      return (
        <svg {...common}>
          <path d="M5 7h14" />
          <path d="M9.5 7V5.8A1.3 1.3 0 0 1 10.8 4.5h2.4A1.3 1.3 0 0 1 14.5 5.8V7" />
          <path d="M8 7l.7 11.2A1.4 1.4 0 0 0 10.1 19.5h3.8a1.4 1.4 0 0 0 1.4-1.3L16 7" />
        </svg>
      );
    default:
      return null;
  }
}

function ShapeIcon({ id }) {
  const filled = id.endsWith('-fill');
  const common = {
    viewBox: '0 0 24 24', width: 16, height: 16,
    fill: filled ? 'currentColor' : 'none',
    stroke: 'currentColor',
    strokeWidth: filled ? 0 : 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };
  switch (id) {
    case 'heart':
    case 'heart-fill':
      return (
        <svg {...common}>
          <path d="M12 20s-7-4.35-7-9.2C5 8.1 6.8 6.5 9 6.5c1.3 0 2.4.7 3 1.7.6-1 1.7-1.7 3-1.7 2.2 0 4 1.6 4 4.3C19 15.65 12 20 12 20Z" />
        </svg>
      );
    case 'rect':
    case 'rect-fill':
      return <svg {...common}><rect x="5" y="6" width="14" height="12" rx="1.5" /></svg>;
    case 'ellipse':
    case 'ellipse-fill':
      return <svg {...common}><ellipse cx="12" cy="12" rx="7" ry="5.5" /></svg>;
    case 'line':
      return <svg {...common}><path d="M5 18 19 6" /></svg>;
    case 'arrow':
      return <svg {...common}><path d="M5 17 18 6M12.5 6H18v5.5" /></svg>;
    default:
      return null;
  }
}

function textSizePx(id) {
  return TEXT_SIZES.find(t => t.id === id)?.px || TEXT_SIZES[1].px;
}

function fontPx(cssW, sizeId, customFs) {
  const base = customFs > 0 ? customFs : textSizePx(sizeId);
  return Math.max(10, base * (cssW / 800));
}

const TEXT_FS_MIN = 10;
const TEXT_FS_MAX = 120;
const SEL_PAD_BUF = 6;

/** Map normalized board coords → CSS pixels under center zoom. */
function worldToScreen(wx, wy, stageW, stageH, zoom) {
  const z = zoom > 0 ? zoom : 1;
  return {
    x: ((wx - 0.5) * z + 0.5) * stageW,
    y: ((wy - 0.5) * z + 0.5) * stageH,
  };
}

/** CSS box matching the dashed selection frame around normalized bounds. */
function selectionFrameCss(bounds, stageRect, cssW, zoom = 1) {
  const z = zoom > 0 ? zoom : 1;
  const cssPad = (cssW > 0
    ? SEL_PAD_BUF * (stageRect.width / Math.max(cssW, 1))
    : SEL_PAD_BUF) * z;
  const a = worldToScreen(bounds.x0, bounds.y0, stageRect.width, stageRect.height, z);
  const b = worldToScreen(bounds.x1, bounds.y1, stageRect.width, stageRect.height, z);
  return {
    left: a.x - cssPad,
    top: a.y - cssPad,
    width: Math.max(b.x - a.x, 8) + cssPad * 2,
    height: Math.max(b.y - a.y, 8) + cssPad * 2,
  };
}

function clampZoom(z) {
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
}

function formatSaveDate(iso) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function cloneStrokes(strokes) {
  try {
    return structuredClone(strokes);
  } catch {
    return JSON.parse(JSON.stringify(strokes || []));
  }
}

function strokeKey(strokes) {
  if (!Array.isArray(strokes) || !strokes.length) return '';
  try {
    return JSON.stringify(strokes);
  } catch {
    return `len:${strokes.length}`;
  }
}

function stickySizePx(id) {
  return STICKY_SIZES.find(t => t.id === id)?.px || STICKY_SIZES[1].px;
}

function stickyNormSize(s, cv) {
  if (s.nw > 0 && s.nh > 0) return { w: s.nw, h: s.nh };
  const rect = cv.getBoundingClientRect();
  const px = stickySizePx(s.noteSize);
  return {
    w: px / Math.max(rect.width, 1),
    h: px / Math.max(rect.height, 1),
  };
}

function breakStickyWord(g, word, maxW) {
  if (g.measureText(word).width <= maxW) return [word];
  const parts = [];
  let chunk = '';
  for (const ch of word) {
    const test = chunk + ch;
    if (chunk && g.measureText(test).width > maxW) {
      parts.push(chunk);
      chunk = ch;
    } else {
      chunk = test;
    }
  }
  if (chunk) parts.push(chunk);
  return parts.length ? parts : [''];
}

function wrapStickyLines(g, text, maxW) {
  const raw = String(text || '');
  if (!raw) return [''];
  const paragraphs = raw.split('\n');
  const lines = [];
  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push('');
      continue;
    }
    let line = '';
    for (const word of words) {
      const chunks = breakStickyWord(g, word, maxW);
      for (const chunk of chunks) {
        const test = line ? `${line} ${chunk}` : chunk;
        if (line && g.measureText(test).width > maxW) {
          lines.push(line);
          line = chunk;
        } else {
          line = test;
        }
      }
    }
    if (line) lines.push(line);
  }
  return lines.length ? lines : [''];
}

export default function WhiteboardCard({ code }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const snapshotQuery = searchParams.get('snapshot');
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  /** CSS-pixel surface size (drawing space). Bitmap is this × devicePixelRatio. */
  const surfaceRef = useRef({ w: 800, h: 500, dpr: 1 });
  const shapesWrapRef = useRef(null);
  const textWrapRef = useRef(null);
  const draftInputRef = useRef(null);
  const stickyInputRef = useRef(null);
  const [role, setRole] = useState(undefined);
  const [tool, setTool] = useState('pen');
  const [shapeKind, setShapeKind] = useState('heart');
  const [shapeMenuOpen, setShapeMenuOpen] = useState(false);
  const [fontMenuOpen, setFontMenuOpen] = useState(false);
  const [shapeFlyoutPos, setShapeFlyoutPos] = useState(null);
  const [fontFlyoutPos, setFontFlyoutPos] = useState(null);
  const shapesBtnRef = useRef(null);
  const textBtnRef = useRef(null);
  const [textFont, setTextFont] = useState(FONTS[0].id);
  const [textSize, setTextSize] = useState(TEXT_SIZES[1].id);
  const [color, setColor] = useState(COLORS[0]);
  const [stickyColor, setStickyColor] = useState(STICKY_COLORS[0]);
  const [stickyNoteSize, setStickyNoteSize] = useState(STICKY_SIZES[1].id);
  const [stickyFont, setStickyFont] = useState(FONTS[0].id);
  const [stickyTextSize, setStickyTextSize] = useState(TEXT_SIZES[0].id);
  const [stickyAlign, setStickyAlign] = useState('left');
  const [size, setSize] = useState(SIZES[1]);
  const [status, setStatus] = useState('');
  const [partnerCursor, setPartnerCursor] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [draftText, setDraftText] = useState(null); // { x, y, value, color, font, fontSize }
  const [editingStickyId, setEditingStickyId] = useState(null);
  const [stickyStyleTick, setStickyStyleTick] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [historyTick, setHistoryTick] = useState(0);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveTitle, setSaveTitle] = useState('');
  const [savingSnap, setSavingSnap] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareToken, setShareToken] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [shareCopied, setShareCopied] = useState('');
  const [shareError, setShareError] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyRows, setHistoryRows] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [preview, setPreview] = useState(null); // { id, title, created_at, updated_at, strokes }
  const [previewLoadingId, setPreviewLoadingId] = useState(null);
  /** Editing a saved board in place (not the live duo canvas). */
  const [editingSnap, setEditingSnap] = useState(null); // { id, title, created_at, updated_at }
  const editingSnapRef = useRef(null);
  const liveBackupRef = useRef(null);

  const strokesRef = useRef([]);
  const redoStackRef = useRef([]);
  const zoomRef = useRef(1);
  const previewRef = useRef(null);
  const currentRef = useRef(null);
  const shapeDragRef = useRef(null);
  const moveDragRef = useRef(null);
  const selectedIdRef = useRef(null);
  const draftTextRef = useRef(null);
  const editingStickyIdRef = useRef(null);
  const stickyBlocksRef = useRef(null);
  const stickyDraftRef = useRef('');
  const stickyResizeRef = useRef(null);
  const stickyHandleElRef = useRef(null);
  const textResizeRef = useRef(null);
  const textHandleElRef = useRef(null);
  const shapeResizeRef = useRef(null);
  const shapeHandleElRef = useRef(null);
  const lastClickRef = useRef({ t: 0, id: null });
  const channelRef = useRef(null);
  const saveTimer = useRef(null);
  const sendTimer = useRef(null);
  const pendingPts = useRef([]);
  const cursorTimer = useRef(0);

  const erasing = tool === 'eraser';

  const ctx2d = () => canvasRef.current?.getContext('2d');
  const surface = () => surfaceRef.current;

  /** Keep CTM in CSS-pixel space with DPR + center zoom (for incremental live draws). */
  const applyViewTransform = () => {
    const g = ctx2d();
    const { w: sw, h: sh, dpr } = surface();
    if (!g) return;
    const z = zoomRef.current || 1;
    g.setTransform(dpr * z, 0, 0, dpr * z, dpr * sw * (1 - z) / 2, dpr * sh * (1 - z) / 2);
  };

  const selectItem = useCallback((id) => {
    if (id) {
      const item = strokesRef.current.find(s => s.id === id);
      if (item?.color && COLORS.includes(item.color)) setColor(item.color);
      if (item?.kind === 'text') {
        if (item.font) setTextFont(item.font);
        if (item.fontSize && item.fontSize !== 'custom') setTextSize(item.fontSize);
      }
      if (item?.kind === 'sticky') {
        if (STICKY_COLORS.includes(item.color)) setStickyColor(item.color);
        if (item.noteSize && item.noteSize !== 'custom') setStickyNoteSize(item.noteSize);
        if (item.font) setStickyFont(item.font);
        if (item.fontSize) setStickyTextSize(item.fontSize);
        if (item.align) setStickyAlign(item.align);
      }
    }
    selectedIdRef.current = id;
    setSelectedId(id);
  }, []);

  const drawSeg = useCallback((pts, strokeColor, strokeSize, erase) => {
    const g = ctx2d();
    const { w: sw, h: sh } = surface();
    if (!g || pts.length < 2) return;
    g.save();
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
    g.strokeStyle = strokeColor;
    g.lineWidth = (erase ? strokeSize * 3 : strokeSize) * (sw / 800);
    g.beginPath();
    pts.forEach(([x, y], i) => {
      const px = x * sw;
      const py = y * sh;
      i ? g.lineTo(px, py) : g.moveTo(px, py);
    });
    g.stroke();
    g.restore();
  }, []);

  const drawShape = useCallback((kind, a, b, strokeColor, strokeSize) => {
    const g = ctx2d();
    const { w: sw, h: sh } = surface();
    if (!g || !a || !b) return;
    const filled = kind.endsWith('-fill');
    const base = filled ? kind.slice(0, -5) : kind;
    const x0 = a[0] * sw;
    const y0 = a[1] * sh;
    const x1 = b[0] * sw;
    const y1 = b[1] * sh;
    const lw = strokeSize * (sw / 800);

    g.save();
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.globalCompositeOperation = 'source-over';
    g.strokeStyle = strokeColor;
    g.fillStyle = strokeColor;
    g.lineWidth = lw;
    g.beginPath();

    if (base === 'heart') {
      const x = Math.min(x0, x1);
      const y = Math.min(y0, y1);
      const hw = Math.max(Math.abs(x1 - x0), 2);
      const hh = Math.max(Math.abs(y1 - y0), 2);
      pathStickyShape(g, 'heart', x, y, hw, hh, 0);
      if (filled) g.fill();
      else g.stroke();
    } else if (base === 'rect') {
      const x = Math.min(x0, x1);
      const y = Math.min(y0, y1);
      const w = Math.abs(x1 - x0);
      const h = Math.abs(y1 - y0);
      if (filled) g.fillRect(x, y, w, h);
      else g.strokeRect(x, y, w, h);
    } else if (base === 'ellipse') {
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const rx = Math.abs(x1 - x0) / 2;
      const ry = Math.abs(y1 - y0) / 2;
      g.ellipse(cx, cy, Math.max(rx, 0.5), Math.max(ry, 0.5), 0, 0, Math.PI * 2);
      if (filled) g.fill();
      else g.stroke();
    } else if (base === 'line') {
      g.moveTo(x0, y0);
      g.lineTo(x1, y1);
      g.stroke();
    } else if (base === 'arrow') {
      g.moveTo(x0, y0);
      g.lineTo(x1, y1);
      g.stroke();
      const ang = Math.atan2(y1 - y0, x1 - x0);
      const head = Math.max(10, lw * 3.2);
      g.beginPath();
      g.moveTo(x1, y1);
      g.lineTo(x1 - head * Math.cos(ang - Math.PI / 7), y1 - head * Math.sin(ang - Math.PI / 7));
      g.moveTo(x1, y1);
      g.lineTo(x1 - head * Math.cos(ang + Math.PI / 7), y1 - head * Math.sin(ang + Math.PI / 7));
      g.stroke();
    }

    g.restore();
  }, []);

  const drawTextItem = useCallback((s) => {
    const g = ctx2d();
    const { w: sw, h: sh } = surface();
    if (!g || !s.pts?.[0] || !s.text) return;
    const fs = fontPx(sw, s.fontSize, s.fs);
    g.save();
    g.font = `600 ${fs}px ${fontStack(s.font)}`;
    g.fillStyle = s.color || '#1F1630';
    g.textBaseline = 'top';
    g.fillText(s.text, s.pts[0][0] * sw, s.pts[0][1] * sh);
    g.restore();
  }, []);

  const drawSticky = useCallback((s) => {
    const cv = canvasRef.current;
    const g = ctx2d();
    const { w: sw, h: sh } = surface();
    if (!cv || !g || !s.pts?.[0]) return;
    const { w, h } = stickyNormSize(s, cv);
    const x = s.pts[0][0] * sw;
    const y = s.pts[0][1] * sh;
    const bw = w * sw;
    const bh = h * sh;
    const pad = 10 * (sw / 800);
    const radius = 4 * (sw / 800);
    const scale = sw / 800;
    g.save();
    g.fillStyle = s.color || STICKY_COLORS[0];
    g.strokeStyle = 'rgba(31, 22, 48, 0.12)';
    g.lineWidth = Math.max(1, sw / 800);
    pathStickyShape(g, 'square', x, y, bw, bh, radius);
    g.fill();
    g.stroke();

    pathStickyShape(g, 'square', x, y, bw, bh, radius);
    g.clip();

    g.fillStyle = STICKY_INK;
    g.textBaseline = 'top';
    g.textAlign = 'left';
    const maxTextW = Math.max(8, bw - pad * 2);
    const maxY = y + bh - pad;
    let cy = y + pad;
    for (const block of stickyBlocksOf(s)) {
      const align = block.align === 'center' || block.align === 'right' ? block.align : 'left';
      const wrapped = wrapRichStickyLines(g, block.spans, maxTextW, scale);
      for (const ln of wrapped) {
        if (cy + ln.maxFs > maxY + 1) break;
        let cx = align === 'center'
          ? x + (bw - ln.width) / 2
          : align === 'right'
            ? x + bw - pad - ln.width
            : x + pad;
        for (const seg of ln.segs) {
          g.font = `600 ${seg.fsPx}px ${fontStack(seg.font)}`;
          g.fillText(seg.text, cx, cy);
          cx += seg.w;
        }
        cy += ln.maxFs * 1.35;
        if (cy > maxY) break;
      }
      if (cy > maxY) break;
    }
    g.restore();
  }, []);

  const boundsOf = useCallback((s) => {
    const cv = canvasRef.current;
    const { w: sw, h: sh } = surface();
    if (!cv || !s?.kind || !s.pts?.length) return null;
    if (s.kind === 'text') {
      const g = ctx2d();
      if (!g) return null;
      const fs = fontPx(sw, s.fontSize, s.fs);
      g.font = `600 ${fs}px ${fontStack(s.font)}`;
      const w = Math.max(g.measureText(s.text || ' ').width, fs * 0.6) / sw;
      const h = (fs * 1.25) / sh;
      const [x, y] = s.pts[0];
      return { x0: x, y0: y, x1: x + w, y1: y + h };
    }
    if (s.kind === 'sticky') {
      const [x, y] = s.pts[0];
      const { w, h } = stickyNormSize(s, cv);
      return { x0: x, y0: y, x1: x + w, y1: y + h };
    }
    if (s.pts.length < 2) return null;
    const [[ax, ay], [bx, by]] = s.pts;
    return {
      x0: Math.min(ax, bx),
      y0: Math.min(ay, by),
      x1: Math.max(ax, bx),
      y1: Math.max(ay, by),
    };
  }, []);

  const syncSelectionOverlays = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const z = zoomRef.current;

    const placeHandle = (el, item) => {
      if (!el || !item) return;
      const b = boundsOf(item);
      if (!b) return;
      const frame = selectionFrameCss(b, rect, surface().w, z);
      el.style.left = `${frame.left + frame.width}px`;
      el.style.top = `${frame.top + frame.height}px`;
    };

    const stickyId = editingStickyIdRef.current || (
      selectedIdRef.current
      && strokesRef.current.find(s => s.id === selectedIdRef.current)?.kind === 'sticky'
        ? selectedIdRef.current
        : null
    );
    if (stickyId) {
      const item = strokesRef.current.find(s => s.id === stickyId);
      if (item?.kind === 'sticky') {
        placeHandle(stickyHandleElRef.current, item);
        if (editingStickyIdRef.current === stickyId && stickyInputRef.current && item.pts?.[0]) {
          const px = stickySizePx(item.noteSize || stickyNoteSize);
          const nw = item.nw || px / Math.max(rect.width, 1);
          const nh = item.nh || px / Math.max(rect.height, 1);
          const el = stickyInputRef.current;
          const origin = worldToScreen(item.pts[0][0], item.pts[0][1], rect.width, rect.height, z);
          el.style.left = `${origin.x}px`;
          el.style.top = `${origin.y}px`;
          el.style.width = `${nw * rect.width * z}px`;
          el.style.height = `${nh * rect.height * z}px`;
        }
      }
    }

    if (selectedIdRef.current) {
      const item = strokesRef.current.find(s => s.id === selectedIdRef.current);
      if (item?.kind === 'text') placeHandle(textHandleElRef.current, item);
      else if (item && SHAPE_KINDS.has(item.kind)) placeHandle(shapeHandleElRef.current, item);
    }
  }, [boundsOf, stickyNoteSize]);

  const drawSelection = useCallback((bounds, strokeColor) => {
    const g = ctx2d();
    const { w: sw, h: sh } = surface();
    if (!g || !bounds) return;
    const pad = SEL_PAD_BUF;
    const x = bounds.x0 * sw - pad;
    const y = bounds.y0 * sh - pad;
    const w = (bounds.x1 - bounds.x0) * sw + pad * 2;
    const h = (bounds.y1 - bounds.y0) * sh + pad * 2;
    g.save();
    g.strokeStyle = strokeColor || '#A78BFA';
    g.lineWidth = 1.5 * (sw / 800);
    g.setLineDash([6 * (sw / 800), 4 * (sw / 800)]);
    g.strokeRect(x, y, Math.max(w, 8), Math.max(h, 8));
    g.restore();
  }, []);

  const drawItem = useCallback((s) => {
    if (!s?.pts?.length) return;
    if (s.kind === 'text') {
      if (draftTextRef.current?.editId === s.id) return;
      drawTextItem(s);
    } else if (s.kind === 'sticky') {
      if (editingStickyIdRef.current === s.id) return;
      drawSticky(s);
    } else if (s.kind) drawShape(s.kind, s.pts[0], s.pts[1], s.color, s.size);
    else drawSeg(s.pts, s.color, s.size, s.erase);
  }, [drawSeg, drawShape, drawTextItem, drawSticky]);

  const hitTest = useCallback((p) => {
    for (let i = strokesRef.current.length - 1; i >= 0; i--) {
      const s = strokesRef.current[i];
      if (!SELECTABLE.has(s.kind)) continue;
      const b = boundsOf(s);
      if (!b) continue;
      if (
        p[0] >= b.x0 - HIT_PAD && p[0] <= b.x1 + HIT_PAD
        && p[1] >= b.y0 - HIT_PAD && p[1] <= b.y1 + HIT_PAD
      ) return s;
    }
    return null;
  }, [boundsOf]);

  const redraw = useCallback(() => {
    const cv = canvasRef.current;
    const g = ctx2d();
    if (!cv || !g) return;

    const { w: sw, h: sh, dpr } = surface();
    if (sw < 2 || sh < 2) return;

    const z = zoomRef.current || 1;
    const viewing = previewRef.current;
    const list = viewing?.strokes || strokesRef.current;

    // Clear in device pixels, then draw in CSS pixels via DPR scale.
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, cv.width, cv.height);
    g.setTransform(dpr * z, 0, 0, dpr * z, dpr * sw * (1 - z) / 2, dpr * sh * (1 - z) / 2);
    g.imageSmoothingEnabled = true;
    if ('imageSmoothingQuality' in g) g.imageSmoothingQuality = 'high';

    for (const s of list) drawItem(s);
    if (!viewing) {
      const drag = shapeDragRef.current;
      if (drag) drawShape(drag.kind, drag.start, drag.current, drag.color, drag.size);
      const sel = strokesRef.current.find(s => s.id === selectedIdRef.current);
      // While typing/editing text, the draft field owns the border — skip the canvas frame.
      if (sel && !draftTextRef.current) drawSelection(boundsOf(sel), sel.color);
    }
  }, [drawItem, drawShape, drawSelection, boundsOf]);

  const resizeCanvas = useCallback(() => {
    const cv = canvasRef.current;
    const wrap = wrapRef.current;
    if (!cv || !wrap) return;

    // One source of truth: the stage box. Pointer mapping uses the same box.
    const rect = wrap.getBoundingClientRect();
    const cssW = Math.max(1, Math.round(rect.width));
    const cssH = Math.max(1, Math.round(rect.height));
    if (cssW < 2 || cssH < 2) return;

    // Real device DPR only — never invent a higher ratio (that desynced the
    // bitmap from the painted box → hard-zoom / corner / off-target strokes).
    const dpr = Math.min(Math.max(window.devicePixelRatio || 1, 1), 3);
    const bw = Math.max(1, Math.round(cssW * dpr));
    const bh = Math.max(1, Math.round(cssH * dpr));

    surfaceRef.current = { w: cssW, h: cssH, dpr };

    // Lock CSS size to the measured stage so the bitmap never stretches.
    cv.style.width = `${cssW}px`;
    cv.style.height = `${cssH}px`;
    cv.style.maxWidth = 'none';
    cv.style.maxHeight = 'none';

    if (cv.width !== bw || cv.height !== bh) {
      cv.width = bw;
      cv.height = bh;
    }

    redraw();
  }, [redraw]);

  /** Broadcast to the live duo board — skipped while previewing/editing a save. */
  const boardSend = useCallback((msg) => {
    if (previewRef.current || editingSnapRef.current) return;
    channelRef.current?.send(msg);
  }, []);

  const scheduleSave = useCallback(() => {
    // Read-only preview never autosaves. Edit-mode saves the named snapshot.
    if (previewRef.current) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      if (previewRef.current) return;
      try {
        const editing = editingSnapRef.current;
        if (editing?.id) {
          await updateBoardSnapshot(editing.id, strokesRef.current);
          setStatus('Saved to board');
          window.setTimeout(() => setStatus((s) => (s === 'Saved to board' ? '' : s)), 1200);
        } else {
          await saveBoard(code, strokesRef.current);
          setStatus('');
        }
      } catch (e) {
        setStatus('Save failed: ' + e.message);
      }
    }, 1500);
  }, [code]);

  const commitDraftText = useCallback((discardEmpty = true) => {
    const prev = draftTextRef.current;
    if (!prev) return;
    const text = (prev.value || '').trim();
    const editId = prev.editId || null;
    // Clear first so blur + click / Enter cannot commit twice.
    draftTextRef.current = null;
    setDraftText(null);
    if (!text) {
      if (!discardEmpty) {
        draftTextRef.current = prev;
        setDraftText(prev);
        return;
      }
      if (editId) {
        strokesRef.current = strokesRef.current.filter(s => s.id !== editId);
        boardSend({ k: 'undo', id: editId });
        if (selectedIdRef.current === editId) selectItem(null);
        scheduleSave();
        queueMicrotask(() => redraw());
      }
      return;
    }
    const font = prev.font || FONTS[0].id;
    const fontSize = prev.fontSize || TEXT_SIZES[1].id;
    const fs = prev.fs > 0 ? prev.fs : textSizePx(fontSize);

    if (editId) {
      const item = strokesRef.current.find(s => s.id === editId);
      if (item?.kind === 'text') {
        item.text = text;
        item.color = prev.color;
        item.font = font;
        item.fontSize = fontSize;
        item.fs = fs;
        item.pts = [[prev.x, prev.y]];
        boardSend({
          k: 'font', id: editId, text, color: prev.color, font, fontSize, fs,
        });
        scheduleSave();
        selectItem(editId);
        queueMicrotask(() => redraw());
        return;
      }
    }

    const stroke = {
      id: newId(role),
      by: role,
      color: prev.color,
      size,
      erase: false,
      kind: 'text',
      font,
      fontSize,
      fs,
      text,
      pts: [[prev.x, prev.y]],
    };
    if (strokesRef.current.some(s => s.id === stroke.id)) return;
    strokesRef.current.push(stroke);
    redoStackRef.current = [];
    setHistoryTick(t => t + 1);
    boardSend({ k: 'stroke', stroke });
    scheduleSave();
    selectItem(stroke.id);
    queueMicrotask(() => redraw());
  }, [role, size, scheduleSave, selectItem, redraw]);

  const readStickyEditor = useCallback(() => {
    const el = stickyInputRef.current;
    if (el) {
      const blocks = stickyEditorToBlocks(el);
      stickyBlocksRef.current = blocks;
      stickyDraftRef.current = blocksToPlain(blocks);
      return blocks;
    }
    return stickyBlocksRef.current || plainToBlocks(stickyDraftRef.current || '');
  }, []);

  const commitStickyEdit = useCallback(() => {
    const id = editingStickyIdRef.current;
    if (!id) return;
    const item = strokesRef.current.find(s => s.id === id);
    if (item?.kind === 'sticky') {
      const blocks = readStickyEditor();
      item.blocks = blocks;
      item.text = blocksToPlain(blocks);
      boardSend({ k: 'edit', id, text: item.text, blocks: item.blocks });
      scheduleSave();
    }
    editingStickyIdRef.current = null;
    setEditingStickyId(null);
    stickyBlocksRef.current = null;
    stickyDraftRef.current = '';
    // Keep the sticky selected so note move/resize stays available after text edit.
    selectItem(id);
    queueMicrotask(() => redraw());
  }, [scheduleSave, redraw, selectItem, readStickyEditor]);

  const openStickyEdit = useCallback((item) => {
    if (!item || item.kind !== 'sticky') return;
    if (editingStickyIdRef.current && editingStickyIdRef.current !== item.id) {
      commitStickyEdit();
    }
    const blocks = stickyBlocksOf(item);
    editingStickyIdRef.current = item.id;
    stickyBlocksRef.current = blocks;
    stickyDraftRef.current = blocksToPlain(blocks);
    setEditingStickyId(item.id);
    if (STICKY_COLORS.includes(item.color)) setStickyColor(item.color);
    if (item.noteSize && item.noteSize !== 'custom') setStickyNoteSize(item.noteSize);
    if (item.font) setStickyFont(item.font);
    if (item.fontSize && item.fontSize !== 'custom') setStickyTextSize(item.fontSize);
    if (item.align) setStickyAlign(item.align);
    selectItem(item.id);
    moveDragRef.current = null;
    queueMicrotask(() => redraw());
  }, [commitStickyEdit, selectItem, redraw]);

  const openTextEdit = useCallback((item) => {
    if (!item || item.kind !== 'text' || !item.pts?.[0]) return;
    if (editingStickyIdRef.current) commitStickyEdit();
    if (draftTextRef.current) commitDraftText(true);
    moveDragRef.current = null;
    const next = {
      editId: item.id,
      x: item.pts[0][0],
      y: item.pts[0][1],
      value: item.text || '',
      color: item.color || color,
      font: item.font || textFont,
      fontSize: item.fontSize || textSize,
      fs: item.fs > 0 ? item.fs : textSizePx(item.fontSize || textSize),
    };
    draftTextRef.current = next;
    setDraftText(next);
    if (COLORS.includes(next.color)) setColor(next.color);
    if (next.font) setTextFont(next.font);
    if (next.fontSize && next.fontSize !== 'custom') setTextSize(next.fontSize);
    selectItem(item.id);
    setTool('text');
    setFontMenuOpen(false);
    queueMicrotask(() => redraw());
  }, [commitStickyEdit, commitDraftText, color, textFont, textSize, selectItem, redraw]);

  const placeSticky = useCallback((p) => {
    const wrap = wrapRef.current;
    if (!wrap || !role) return;
    const px = stickySizePx(stickyNoteSize);
    const nw = px / Math.max(wrap.clientWidth, 1);
    const nh = px / Math.max(wrap.clientHeight, 1);
    const x = Math.max(0, Math.min(p[0], 1 - nw));
    const y = Math.max(0, Math.min(p[1], 1 - nh));
    const blocks = plainToBlocks('', {
      font: stickyFont,
      fontSize: stickyTextSize,
      align: stickyAlign,
    });
    const stroke = {
      id: newId(role),
      by: role,
      color: stickyColor,
      size,
      erase: false,
      kind: 'sticky',
      text: '',
      blocks,
      font: stickyFont,
      fontSize: stickyTextSize,
      noteSize: stickyNoteSize,
      align: stickyAlign,
      pts: [[x, y]],
      nw,
      nh,
    };
    strokesRef.current.push(stroke);
    redoStackRef.current = [];
    setHistoryTick(t => t + 1);
    boardSend({ k: 'stroke', stroke });
    scheduleSave();
    openStickyEdit(stroke);
  }, [role, stickyColor, stickyNoteSize, stickyFont, stickyTextSize, stickyAlign, size, scheduleSave, openStickyEdit]);

  const patchActiveSticky = useCallback((patch) => {
    const id = editingStickyIdRef.current || (
      selectedIdRef.current
      && strokesRef.current.find(s => s.id === selectedIdRef.current)?.kind === 'sticky'
        ? selectedIdRef.current
        : null
    );
    if (!id) return;
    const item = strokesRef.current.find(s => s.id === id);
    if (!item || item.kind !== 'sticky') return;
    Object.assign(item, patch);
    const editing = editingStickyIdRef.current === id;
    if (editing) {
      const blocks = readStickyEditor();
      item.blocks = blocks;
      item.text = blocksToPlain(blocks);
    }
    boardSend({
      k: 'edit',
      id,
      text: item.text,
      blocks: item.blocks,
      ...patch,
    });
    scheduleSave();
    setStickyStyleTick(t => t + 1);
    redraw();
  }, [scheduleSave, redraw, readStickyEditor]);

  /* Keep latest draw/sync helpers for the channel without re-binding on every render.
     Re-running load+channel when `redraw` identity changed was wiping in-progress strokes
     (Live board felt broken after drawing or returning from Saved boards). */
  const redrawRef = useRef(redraw);
  const drawSegRef = useRef(drawSeg);
  const selectItemRef = useRef(selectItem);
  const syncSelectionOverlaysRef = useRef(syncSelectionOverlays);
  const applyViewTransformRef = useRef(applyViewTransform);
  const setSearchParamsRef = useRef(setSearchParams);
  const resizeCanvasRef = useRef(resizeCanvas);
  redrawRef.current = redraw;
  drawSegRef.current = drawSeg;
  selectItemRef.current = selectItem;
  syncSelectionOverlaysRef.current = syncSelectionOverlays;
  applyViewTransformRef.current = applyViewTransform;
  setSearchParamsRef.current = setSearchParams;
  resizeCanvasRef.current = resizeCanvas;

  useEffect(() => {
    let alive = true;
    (async () => {
      const r = await myRoleInDuo(code);
      if (!alive) return;
      setRole(r);
      if (!r) return;

      // ?new=1 → blank live board (from Saved boards “+ New whiteboard”).
      // Only wipe when the in-app confirm set the session flag — never trust
      // window.confirm (some embedded browsers auto-accept it).
      let startFresh = new URLSearchParams(window.location.search).get('new') === '1';
      if (startFresh) {
        let allowed = false;
        try {
          allowed = sessionStorage.getItem('duoarcade-wb-new-ok') === '1';
          sessionStorage.removeItem('duoarcade-wb-new-ok');
        } catch { /* ignore */ }
        if (!allowed) {
          startFresh = false;
        }
        setSearchParamsRef.current((prev) => {
          const next = new URLSearchParams(prev);
          next.delete('new');
          return next;
        }, { replace: true });
      }
      try {
        strokesRef.current = startFresh ? [] : await loadBoard(code);
        redoStackRef.current = [];
        setHistoryTick(t => t + 1);
      } catch (e) {
        setStatus('Couldn’t load the board: ' + e.message);
      }
      // Always reset view when opening the live board (avoids stuck hard-zoom).
      zoomRef.current = 1;
      setZoom(1);
      if (startFresh) {
        selectedIdRef.current = null;
        setSelectedId(null);
        draftTextRef.current = null;
        setDraftText(null);
        editingStickyIdRef.current = null;
        setEditingStickyId(null);
        stickyBlocksRef.current = null;
        stickyDraftRef.current = '';
        previewRef.current = null;
        setPreview(null);
        editingSnapRef.current = null;
        setEditingSnap(null);
        liveBackupRef.current = null;
      }
      redrawRef.current();
      // Layout may still be settling after route change — size from the stage box.
      requestAnimationFrame(() => {
        resizeCanvasRef.current?.();
        requestAnimationFrame(() => resizeCanvasRef.current?.());
      });

      const ch = await boardChannel(code);
      if (!alive) { ch.close(); return; }
      channelRef.current = ch;

      if (startFresh) {
        try {
          await saveBoard(code, []);
          ch.send({ k: 'clear' });
        } catch (e) {
          setStatus('Couldn’t start a blank board: ' + (e.message || 'unknown error'));
        }
      }
      ch.on(m => {
        // Don't let live-board sync overwrite a saved board you're editing.
        if (editingSnapRef.current) return;
        if (m.k === 'live') {
          if (!previewRef.current) {
            applyViewTransformRef.current();
            drawSegRef.current(m.pts, m.color, m.size, m.erase);
          }
        }
        if (m.k === 'stroke') {
          if (m.stroke?.id && strokesRef.current.some(s => s.id === m.stroke.id)) {
            /* already have it */
          } else if (m.stroke) {
            strokesRef.current.push(m.stroke);
            redoStackRef.current = redoStackRef.current.filter(s => s.id !== m.stroke.id);
            setHistoryTick(t => t + 1);
          }
          if (!previewRef.current) redrawRef.current();
        }
        if (m.k === 'move' && m.id && Array.isArray(m.pts)) {
          const item = strokesRef.current.find(s => s.id === m.id);
          if (item) {
            item.pts = m.pts;
            if (!previewRef.current) {
              redrawRef.current();
              if (selectedIdRef.current === m.id || editingStickyIdRef.current === m.id) {
                syncSelectionOverlaysRef.current();
              }
            }
          }
        }
        if (m.k === 'font' && m.id) {
          const item = strokesRef.current.find(s => s.id === m.id);
          if (item && item.kind === 'text') {
            if (typeof m.text === 'string') item.text = m.text;
            if (m.font) item.font = m.font;
            if (m.fontSize) item.fontSize = m.fontSize;
            if (m.fs > 0) item.fs = m.fs;
            if (m.color) item.color = m.color;
            if (Array.isArray(m.pts)) item.pts = m.pts;
            if (!previewRef.current) redrawRef.current();
          }
        }
        if (m.k === 'color' && m.id && m.color) {
          const item = strokesRef.current.find(s => s.id === m.id);
          if (item && SELECTABLE.has(item.kind)) {
            item.color = m.color;
            if (!previewRef.current) redrawRef.current();
          }
        }
        if (m.k === 'edit' && m.id) {
          const item = strokesRef.current.find(s => s.id === m.id);
          if (item && item.kind === 'sticky') {
            if (typeof m.text === 'string') item.text = m.text;
            if (Array.isArray(m.blocks)) item.blocks = m.blocks;
            if (m.color) item.color = m.color;
            if (m.font) item.font = m.font;
            if (m.fontSize) item.fontSize = m.fontSize;
            if (m.noteSize) item.noteSize = m.noteSize;
            if (m.align) item.align = m.align;
            if (m.nw > 0) item.nw = m.nw;
            if (m.nh > 0) item.nh = m.nh;
            if (!previewRef.current) redrawRef.current();
          }
        }
        if (m.k === 'undo') {
          strokesRef.current = strokesRef.current.filter(s => s.id !== m.id);
          redoStackRef.current = redoStackRef.current.filter(s => s.id !== m.id);
          if (selectedIdRef.current === m.id) selectItemRef.current(null);
          if (editingStickyIdRef.current === m.id) {
            editingStickyIdRef.current = null;
            setEditingStickyId(null);
            stickyBlocksRef.current = null;
            stickyDraftRef.current = '';
          }
          setHistoryTick(t => t + 1);
          if (!previewRef.current) redrawRef.current();
        }
        if (m.k === 'clear') {
          strokesRef.current = [];
          redoStackRef.current = [];
          selectItemRef.current(null);
          editingStickyIdRef.current = null;
          setEditingStickyId(null);
          stickyBlocksRef.current = null;
          stickyDraftRef.current = '';
          setHistoryTick(t => t + 1);
          if (!previewRef.current) redrawRef.current();
        }
        if (m.k === 'board' && Array.isArray(m.strokes)) {
          strokesRef.current = m.strokes;
          redoStackRef.current = [];
          selectItemRef.current(null);
          draftTextRef.current = null;
          setDraftText(null);
          editingStickyIdRef.current = null;
          setEditingStickyId(null);
          stickyBlocksRef.current = null;
          stickyDraftRef.current = '';
          setHistoryTick(t => t + 1);
          if (!previewRef.current) redrawRef.current();
        }
        if (m.k === 'cursor') setPartnerCursor({ x: m.x, y: m.y, at: Date.now() });
      });
    })();

    return () => {
      alive = false;
      channelRef.current?.close();
      clearTimeout(saveTimer.current);
      clearInterval(sendTimer.current);
    };
  }, [code]);

  useEffect(() => {
    if (!partnerCursor) return undefined;
    const t = setTimeout(() => setPartnerCursor(pc =>
      (pc && Date.now() - pc.at > 2900) ? null : pc), 3000);
    return () => clearTimeout(t);
  }, [partnerCursor]);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || typeof ResizeObserver === 'undefined') return undefined;
    let raf = 0;
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => resizeCanvas());
    };
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (cr && (cr.width < 2 || cr.height < 2)) return;
      schedule();
    });
    ro.observe(wrap);
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    const t1 = window.setTimeout(resizeCanvas, 0);
    const t2 = window.setTimeout(resizeCanvas, 50);
    const t3 = window.setTimeout(resizeCanvas, 200);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resizeCanvas);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      ro.disconnect();
    };
  }, [resizeCanvas]);

  useEffect(() => {
    const onDpr = () => resizeCanvas();
    const mq = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    mq.addEventListener?.('change', onDpr);
    window.visualViewport?.addEventListener('resize', onDpr);
    return () => {
      mq.removeEventListener?.('change', onDpr);
      window.visualViewport?.removeEventListener('resize', onDpr);
    };
  }, [resizeCanvas]);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    // Set cursor on the DOM node — do not use React `style` on <canvas>,
    // or it wipes width/height from resizeCanvas and the board blurs.
    cv.style.cursor = tool === 'eraser' ? 'cell'
      : tool === 'select' ? (selectedId ? 'move' : 'default')
        : tool === 'text' ? 'text'
          : tool === 'sticky' ? 'copy'
            : 'crosshair';
  }, [tool, selectedId]);

  useEffect(() => {
    if (!shapeMenuOpen) return undefined;
    // Defer so the opening click doesn’t immediately count as “outside”.
    let onDoc = null;
    const t = window.setTimeout(() => {
      onDoc = (e) => {
        if (shapesWrapRef.current && !shapesWrapRef.current.contains(e.target)) {
          setShapeMenuOpen(false);
        }
      };
      document.addEventListener('mousedown', onDoc);
    }, 0);
    return () => {
      window.clearTimeout(t);
      if (onDoc) document.removeEventListener('mousedown', onDoc);
    };
  }, [shapeMenuOpen]);

  useEffect(() => {
    if (!fontMenuOpen) return undefined;
    let onDoc = null;
    const t = window.setTimeout(() => {
      onDoc = (e) => {
        if (textWrapRef.current && !textWrapRef.current.contains(e.target)) {
          setFontMenuOpen(false);
        }
      };
      document.addEventListener('mousedown', onDoc);
    }, 0);
    return () => {
      window.clearTimeout(t);
      if (onDoc) document.removeEventListener('mousedown', onDoc);
    };
  }, [fontMenuOpen]);

  useEffect(() => {
    draftTextRef.current = draftText;
  }, [draftText]);

  useEffect(() => {
    previewRef.current = preview;
  }, [preview]);

  useEffect(() => {
    editingSnapRef.current = editingSnap;
  }, [editingSnap]);

  useEffect(() => {
    if (draftText) {
      const t = window.setTimeout(() => draftInputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [draftText]);

  useLayoutEffect(() => {
    const el = draftInputRef.current;
    const wrap = wrapRef.current;
    if (!el || !wrap || !draftText) return;
    const rect = wrap.getBoundingClientRect();
    const z = zoomRef.current;
    const fs = Math.max(
      12,
      (draftText.fs > 0 ? draftText.fs : textSizePx(draftText.fontSize || textSize)) * (rect.width / 800) * z,
    );
    const left = worldToScreen(draftText.x, draftText.y, rect.width, rect.height, z).x;
    const minW = Math.max(fs * 4, 56);
    const maxW = Math.max(minW, rect.width - left - 8);
    const height = Math.max(fs * 1.5, 28);

    el.style.height = `${height}px`;
    el.style.width = `${minW}px`;
    const nextW = Math.min(Math.max(el.scrollWidth + 10, minW), maxW);
    el.style.width = `${nextW}px`;
    el.style.height = `${height}px`;
  }, [draftText, textSize, zoom]);

  useEffect(() => {
    if (!editingStickyId) return undefined;
    const el = stickyInputRef.current;
    if (!el) return undefined;
    el.innerHTML = blocksToHtml(stickyBlocksRef.current || plainToBlocks(''));
    const t = window.setTimeout(() => {
      el.focus();
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }, 0);
    return () => clearTimeout(t);
  }, [editingStickyId]);

  const bumpHistory = useCallback(() => setHistoryTick(t => t + 1), []);

  const undoMine = useCallback(() => {
    if (previewRef.current) return;
    const mine = strokesRef.current.filter(s => s.by === role);
    if (!mine.length) return;
    const last = mine[mine.length - 1];
    strokesRef.current = strokesRef.current.filter(s => s.id !== last.id);
    redoStackRef.current.push(last);
    boardSend({ k: 'undo', id: last.id });
    if (selectedIdRef.current === last.id) selectItem(null);
    if (editingStickyIdRef.current === last.id) {
      editingStickyIdRef.current = null;
      setEditingStickyId(null);
      stickyBlocksRef.current = null;
      stickyDraftRef.current = '';
    }
    bumpHistory();
    redraw();
    scheduleSave();
  }, [role, selectItem, redraw, scheduleSave, bumpHistory]);

  const redoMine = useCallback(() => {
    if (previewRef.current) return;
    const next = redoStackRef.current.pop();
    if (!next) return;
    if (strokesRef.current.some(s => s.id === next.id)) {
      bumpHistory();
      return;
    }
    strokesRef.current.push(next);
    boardSend({ k: 'stroke', stroke: next });
    bumpHistory();
    redraw();
    scheduleSave();
  }, [redraw, scheduleSave, bumpHistory]);

  const setZoomLevel = useCallback((next) => {
    const z = clampZoom(typeof next === 'function' ? next(zoomRef.current) : next);
    zoomRef.current = z;
    setZoom(z);
    redraw();
    syncSelectionOverlays();
    setStickyStyleTick(t => t + 1);
  }, [redraw, syncSelectionOverlays]);

  useEffect(() => {
    const onKey = e => {
      const typing = draftText || editingStickyIdRef.current
        || e.target?.closest?.('textarea, input, [contenteditable="true"]');
      const mod = e.ctrlKey || e.metaKey;
      if (mod && (e.key === 'z' || e.key === 'Z')) {
        if (typing) return;
        e.preventDefault();
        if (e.shiftKey) redoMine();
        else undoMine();
        return;
      }
      if (mod && (e.key === 'y' || e.key === 'Y')) {
        if (typing) return;
        e.preventDefault();
        redoMine();
        return;
      }
      if (typing) return;
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      const id = selectedIdRef.current;
      if (!id) return;
      const item = strokesRef.current.find(s => s.id === id);
      if (!item || !SELECTABLE.has(item.kind)) return;
      e.preventDefault();
      strokesRef.current = strokesRef.current.filter(s => s.id !== id);
      redoStackRef.current.push(item);
      boardSend({ k: 'undo', id });
      selectItem(null);
      bumpHistory();
      redraw();
      scheduleSave();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [draftText, selectItem, redraw, scheduleSave, undoMine, redoMine, bumpHistory]);

  const posOf = e => {
    // Same box as resizeCanvas — never mix canvas bitmap rect with stage CSS size.
    const wrap = wrapRef.current;
    if (!wrap) return [0.5, 0.5];
    const rect = wrap.getBoundingClientRect();
    const z = zoomRef.current || 1;
    const nx = (e.clientX - rect.left) / Math.max(rect.width, 1);
    const ny = (e.clientY - rect.top) / Math.max(rect.height, 1);
    return [
      (nx - 0.5) / z + 0.5,
      (ny - 0.5) / z + 0.5,
    ];
  };

  const flushLive = useCallback(() => {
    const s = currentRef.current;
    if (!s || pendingPts.current.length < 2) return;
    boardSend({
      k: 'live', pts: pendingPts.current, color: s.color, size: s.size, erase: s.erase,
    });
    pendingPts.current = [pendingPts.current[pendingPts.current.length - 1]];
  }, []);

  const onDown = e => {
    if (!role || previewRef.current) return;

    if (tool === 'text') {
      if (editingStickyIdRef.current) commitStickyEdit();
      if (draftTextRef.current) commitDraftText(true);
      const p = posOf(e);
      const hit = hitTest(p);
      if (hit?.kind === 'text') {
        const now = Date.now();
        if (
          lastClickRef.current.id === hit.id
          && now - lastClickRef.current.t < DBLCLICK_MS
        ) {
          lastClickRef.current = { t: 0, id: null };
          openTextEdit(hit);
          return;
        }
        lastClickRef.current = { t: now, id: hit.id };
        selectItem(hit.id);
        setTool('select');
        redraw();
        return;
      }
      const next = {
        x: p[0], y: p[1], value: '', color, font: textFont, fontSize: textSize, fs: textSizePx(textSize),
      };
      draftTextRef.current = next;
      setDraftText(next);
      selectItem(null);
      return;
    }

    if (tool === 'sticky') {
      if (draftTextRef.current) commitDraftText(true);
      const p = posOf(e);
      const hit = hitTest(p);
      if (hit?.kind === 'sticky') {
        openStickyEdit(hit);
        return;
      }
      if (editingStickyIdRef.current) commitStickyEdit();
      placeSticky(p);
      return;
    }

    e.currentTarget.setPointerCapture?.(e.pointerId);
    const p = posOf(e);

    if (tool === 'select') {
      if (draftTextRef.current) commitDraftText(true);
      const hit = hitTest(p);

      // Sticky / text: single-click selects; double-click edits.
      if (hit?.kind === 'sticky') {
        const now = Date.now();
        if (
          lastClickRef.current.id === hit.id
          && now - lastClickRef.current.t < DBLCLICK_MS
        ) {
          lastClickRef.current = { t: 0, id: null };
          openStickyEdit(hit);
          return;
        }
        lastClickRef.current = { t: now, id: hit.id };
        if (editingStickyIdRef.current) {
          if (editingStickyIdRef.current === hit.id) return;
          commitStickyEdit();
        }
        selectItem(hit.id);
        moveDragRef.current = { id: hit.id, last: p, moved: false };
        redraw();
        return;
      }

      if (hit?.kind === 'text') {
        const now = Date.now();
        if (
          lastClickRef.current.id === hit.id
          && now - lastClickRef.current.t < DBLCLICK_MS
        ) {
          lastClickRef.current = { t: 0, id: null };
          openTextEdit(hit);
          return;
        }
        lastClickRef.current = { t: now, id: hit.id };
        if (editingStickyIdRef.current) commitStickyEdit();
        selectItem(hit.id);
        moveDragRef.current = { id: hit.id, last: p, moved: false };
        redraw();
        return;
      }

      if (editingStickyIdRef.current) {
        commitStickyEdit();
      }
      lastClickRef.current = { t: Date.now(), id: hit?.id || null };
      selectItem(hit?.id || null);
      if (hit) {
        moveDragRef.current = { id: hit.id, last: p, moved: false };
      } else {
        moveDragRef.current = null;
      }
      redraw();
      return;
    }

    if (editingStickyIdRef.current) commitStickyEdit();

    if (tool === 'shapes') {
      selectItem(null);
      shapeDragRef.current = {
        kind: shapeKind, start: p, current: p, color, size,
      };
      redraw();
      return;
    }

    if (tool !== 'pen' && tool !== 'eraser') return;
    selectItem(null);
    currentRef.current = {
      id: newId(role), by: role,
      color, size, erase: erasing, pts: [p],
    };
    pendingPts.current = [p];
    clearInterval(sendTimer.current);
    sendTimer.current = setInterval(flushLive, 150);
  };

  const onMove = e => {
    const p = posOf(e);
    const now = Date.now();
    if (now - cursorTimer.current > 150) {
      cursorTimer.current = now;
      boardSend({ k: 'cursor', x: p[0], y: p[1] });
    }

    const move = moveDragRef.current;
    if (move) {
      const item = strokesRef.current.find(s => s.id === move.id);
      if (item) {
        const dx = p[0] - move.last[0];
        const dy = p[1] - move.last[1];
        if (dx || dy) {
          item.pts = item.pts.map(([x, y]) => [x + dx, y + dy]);
          move.last = p;
          move.moved = true;
          redraw();
          // Move overlay handles with the canvas item (DOM, no React re-render lag).
          syncSelectionOverlays();
        }
      }
      return;
    }

    const drag = shapeDragRef.current;
    if (drag) {
      drag.current = p;
      redraw();
      return;
    }

    const s = currentRef.current;
    if (!s) return;
    const last = s.pts[s.pts.length - 1];
    if (Math.abs(last[0] - p[0]) + Math.abs(last[1] - p[1]) < 0.002) return;
    s.pts.push(p);
    pendingPts.current.push(p);
    applyViewTransform();
    drawSeg([last, p], s.color, s.size, s.erase);
  };

  const onUp = () => {
    const move = moveDragRef.current;
    if (move) {
      moveDragRef.current = null;
      if (move.moved) {
        const item = strokesRef.current.find(s => s.id === move.id);
        if (item) {
          boardSend({ k: 'move', id: item.id, pts: item.pts });
          scheduleSave();
        }
        setStickyStyleTick(t => t + 1);
      }
      redraw();
      return;
    }

    const drag = shapeDragRef.current;
    if (drag) {
      shapeDragRef.current = null;
      const dx = Math.abs(drag.current[0] - drag.start[0]);
      const dy = Math.abs(drag.current[1] - drag.start[1]);
      if (dx + dy > 0.004) {
        const stroke = {
          id: newId(role),
          by: role,
          color: drag.color,
          size: drag.size,
          erase: false,
          kind: drag.kind,
          pts: [drag.start, drag.current],
        };
        strokesRef.current.push(stroke);
        redoStackRef.current = [];
        bumpHistory();
        boardSend({ k: 'stroke', stroke });
        scheduleSave();
        selectItem(stroke.id);
      }
      redraw();
      return;
    }

    const s = currentRef.current;
    if (!s) return;
    clearInterval(sendTimer.current);
    flushLive();
    currentRef.current = null;
    if (s.pts.length > 1) {
      strokesRef.current.push(s);
      redoStackRef.current = [];
      bumpHistory();
      boardSend({ k: 'stroke', stroke: s });
      scheduleSave();
    }
  };

  const clearBoard = () => {
    if (previewRef.current) return;
    const editing = editingSnapRef.current;
    const ok = window.confirm(
      editing
        ? 'Clear this saved board?'
        : 'Clear the whole board for both of you?',
    );
    if (!ok) return;
    strokesRef.current = [];
    redoStackRef.current = [];
    boardSend({ k: 'clear' });
    selectItem(null);
    draftTextRef.current = null;
    setDraftText(null);
    editingStickyIdRef.current = null;
    setEditingStickyId(null);
    stickyBlocksRef.current = null;
    stickyDraftRef.current = '';
    bumpHistory();
    redraw();
    scheduleSave();
  };

  const shareBoard = async () => {
    setShareError('');
    setShareCopied('');
    setShareToken('');
    setShareUrl('');
    setShareOpen(true);
    setShareBusy(true);
    try {
      const token = await createBoardShare(defaultSnapshotTitle(), strokesRef.current || []);
      setShareToken(token);
      setShareUrl(boardShareUrl(token));
      setStatus('');
    } catch (e) {
      setShareError(e?.message || 'Couldn’t create share code');
    } finally {
      setShareBusy(false);
    }
  };

  const copyShareValue = async (value, kind) => {
    const text = String(value || '').trim();
    if (!text) return;
    try {
      await navigator.clipboard?.writeText(text);
      setShareCopied(kind);
      setShareOpen(false);
      setShareError('');
      setStatus(kind === 'link' ? 'Link copied' : 'Code copied');
      window.setTimeout(() => setStatus(''), 1800);
      window.setTimeout(() => setShareCopied(''), 0);
    } catch {
      setShareError('Couldn’t copy — select the code and copy manually');
    }
  };

  const closeShareDialog = () => {
    if (shareBusy) return;
    setShareOpen(false);
    setShareError('');
    setShareCopied('');
  };

  const openSaveDialog = () => {
    if (previewRef.current || editingSnapRef.current) return;
    setHistoryOpen(false);
    setSaveTitle(defaultSnapshotTitle());
    setSaveOpen(true);
  };

  /** Open saved library. If live still matches the last Save, clear it (saved copy stays). */
  const goSavedLibrary = async () => {
    if (previewRef.current || editingSnapRef.current) {
      navigate('/app/place/sect-saved-boards');
      return;
    }
    let savedKey = '';
    try {
      savedKey = sessionStorage.getItem(`duoarcade-wb-saved-key:${code}`) || '';
    } catch { /* ignore */ }
    const live = strokesRef.current;
    const liveKey = strokeKey(live);
    if (savedKey && liveKey && savedKey === liveKey) {
      clearTimeout(saveTimer.current);
      strokesRef.current = [];
      redoStackRef.current = [];
      selectItem(null);
      draftTextRef.current = null;
      setDraftText(null);
      editingStickyIdRef.current = null;
      setEditingStickyId(null);
      stickyBlocksRef.current = null;
      stickyDraftRef.current = '';
      bumpHistory();
      redraw();
      boardSend({ k: 'clear' });
      try {
        await saveBoard(code, []);
      } catch { /* ignore */ }
      try {
        sessionStorage.removeItem(`duoarcade-wb-saved-key:${code}`);
      } catch { /* ignore */ }
    }
    navigate('/app/place/sect-saved-boards');
  };

  const submitSaveSnapshot = async (e) => {
    e?.preventDefault?.();
    if (savingSnap || previewRef.current || editingSnapRef.current) return;
    const title = (saveTitle || '').trim() || defaultSnapshotTitle();
    const snapshot = cloneStrokes(strokesRef.current);
    if (!snapshot.length) {
      setStatus('Nothing to save — draw something first');
      window.setTimeout(() => setStatus(''), 1800);
      return;
    }
    setSavingSnap(true);
    try {
      await saveBoardSnapshot(code, title, snapshot);
      try {
        sessionStorage.setItem(`duoarcade-wb-saved-key:${code}`, strokeKey(snapshot));
      } catch { /* ignore */ }
      setSaveOpen(false);
      // Leave the live canvas and open the library (clears live when it matches this save).
      await goSavedLibrary();
    } catch (err) {
      setStatus('Couldn’t save: ' + (err.message || 'unknown error'));
    } finally {
      setSavingSnap(false);
    }
  };

  const openHistoryPanel = async () => {
    setSaveOpen(false);
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      setHistoryRows(await listBoardSnapshots(code));
    } catch (err) {
      setStatus('Couldn’t load history: ' + (err.message || 'unknown error'));
      setHistoryRows([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const openSnapshotPreview = useCallback(async (row) => {
    if (!row?.id) return;
    setPreviewLoadingId(row.id);
    try {
      const snap = await getBoardSnapshot(row.id);
      const next = {
        id: snap.id,
        title: snap.title,
        created_at: snap.created_at,
        updated_at: snap.updated_at || snap.created_at,
        strokes: Array.isArray(snap.strokes) ? snap.strokes : [],
      };
      // Read-only view — live strokes stay untouched in strokesRef.
      selectItem(null);
      draftTextRef.current = null;
      setDraftText(null);
      editingStickyIdRef.current = null;
      setEditingStickyId(null);
      setHistoryOpen(false);
      previewRef.current = next;
      setPreview(next);
      // Preview bar changes stage height — resize backing store after layout.
      requestAnimationFrame(() => {
        resizeCanvas();
        requestAnimationFrame(() => resizeCanvas());
      });
    } catch (err) {
      setStatus('Couldn’t open save: ' + (err.message || 'unknown error'));
    } finally {
      setPreviewLoadingId(null);
    }
  }, [selectItem, resizeCanvas]);

  const startEditSnapshot = useCallback(() => {
    const snap = previewRef.current;
    if (!snap?.id) return;
    liveBackupRef.current = cloneStrokes(strokesRef.current);
    strokesRef.current = cloneStrokes(snap.strokes);
    redoStackRef.current = [];
    const meta = {
      id: snap.id,
      title: snap.title,
      created_at: snap.created_at,
      updated_at: snap.updated_at || snap.created_at,
    };
    editingSnapRef.current = meta;
    setEditingSnap(meta);
    previewRef.current = null;
    setPreview(null);
    selectItem(null);
    draftTextRef.current = null;
    setDraftText(null);
    editingStickyIdRef.current = null;
    setEditingStickyId(null);
    stickyBlocksRef.current = null;
    stickyDraftRef.current = '';
    setHistoryTick(t => t + 1);
    redraw();
    requestAnimationFrame(() => resizeCanvas());
    setStatus('Editing this saved board — live canvas is unchanged');
  }, [selectItem, redraw, resizeCanvas]);

  const finishEditSnapshot = useCallback(async (save) => {
    const meta = editingSnapRef.current;
    if (!meta) return;
    if (save) {
      try {
        await updateBoardSnapshot(meta.id, cloneStrokes(strokesRef.current));
      } catch (err) {
        setStatus('Couldn’t save edits: ' + (err.message || 'unknown error'));
        return;
      }
    }
    clearTimeout(saveTimer.current);
    editingSnapRef.current = null;
    setEditingSnap(null);
    selectItem(null);
    draftTextRef.current = null;
    setDraftText(null);
    editingStickyIdRef.current = null;
    setEditingStickyId(null);
    stickyBlocksRef.current = null;
    stickyDraftRef.current = '';
    redoStackRef.current = [];
    try {
      strokesRef.current = await loadBoard(code);
    } catch {
      strokesRef.current = liveBackupRef.current || [];
    }
    liveBackupRef.current = null;
    setHistoryTick(t => t + 1);
    redraw();
    setStatus(save ? 'Saved board updated' : '');
    if (save) window.setTimeout(() => setStatus((s) => (s === 'Saved board updated' ? '' : s)), 1600);
    if (searchParams.has('snapshot')) {
      navigate('/app/place/sect-saved-boards', { replace: true });
    }
  }, [code, selectItem, redraw, navigate, searchParams]);

  useEffect(() => {
    if (!role || !snapshotQuery) return undefined;
    if (previewRef.current?.id === snapshotQuery) return undefined;
    openSnapshotPreview({ id: snapshotQuery });
    return undefined;
  }, [role, snapshotQuery, openSnapshotPreview]);

  /* Returning from Saved boards / New whiteboard: drop any leftover preview. */
  useEffect(() => {
    if (snapshotQuery) return undefined;
    if (editingSnapRef.current) return undefined;
    if (!previewRef.current) return undefined;
    previewRef.current = null;
    setPreview(null);
    redraw();
    return undefined;
  }, [snapshotQuery, redraw]);

  const placeFlyout = (btn) => {
    if (!btn) return { top: 0, left: 0 };
    const r = btn.getBoundingClientRect();
    return { top: Math.round(r.top), left: Math.round(r.right + 8) };
  };

  const openShapeMenu = () => {
    if (previewRef.current) return;
    pickTool('shapes');
    setShapeFlyoutPos(placeFlyout(shapesBtnRef.current));
    setShapeMenuOpen(true);
  };

  const openFontMenu = () => {
    if (previewRef.current) return;
    pickTool('text');
    setFontFlyoutPos(placeFlyout(textBtnRef.current));
    setFontMenuOpen(true);
  };

  const pickTool = (id) => {
    if (previewRef.current) return;
    if (id !== 'text' && draftTextRef.current) commitDraftText(true);
    if (id !== 'sticky' && editingStickyIdRef.current) commitStickyEdit();
    setTool(id);
    if (id === 'shapes') {
      setShapeFlyoutPos(placeFlyout(shapesBtnRef.current));
      setShapeMenuOpen(true);
    } else setShapeMenuOpen(false);
    if (id === 'text') {
      setFontFlyoutPos(placeFlyout(textBtnRef.current));
      setFontMenuOpen(true);
    } else setFontMenuOpen(false);
    if (id !== 'select') {
      const keepText = id === 'text'
        && selectedIdRef.current
        && strokesRef.current.find(s => s.id === selectedIdRef.current)?.kind === 'text';
      const keepSticky = id === 'sticky'
        && selectedIdRef.current
        && strokesRef.current.find(s => s.id === selectedIdRef.current)?.kind === 'sticky';
      if (!keepText && !keepSticky) selectItem(null);
    }
  };

  const onStickyResizeDown = (e, item) => {
    e.preventDefault();
    e.stopPropagation();
    if (!item || !wrapRef.current) return;
    stickyResizeRef.current = {
      id: item.id,
      startX: e.clientX,
      startY: e.clientY,
      startNw: item.nw,
      startNh: item.nh,
    };
    const onMove = (ev) => {
      ev.preventDefault();
      const drag = stickyResizeRef.current;
      const wrap = wrapRef.current;
      if (!drag || !wrap) return;
      const target = strokesRef.current.find(s => s.id === drag.id);
      if (!target || target.kind !== 'sticky') return;
      const z = zoomRef.current || 1;
      const minN = STICKY_MIN_PX / Math.max(wrap.clientWidth, 1);
      const minH = STICKY_MIN_PX / Math.max(wrap.clientHeight, 1);
      const dx = ((ev.clientX - drag.startX) / Math.max(wrap.clientWidth, 1)) / z;
      const dy = ((ev.clientY - drag.startY) / Math.max(wrap.clientHeight, 1)) / z;
      let nw = Math.max(minN, Math.min(STICKY_MAX_FRAC, drag.startNw + dx));
      let nh = Math.max(minH, Math.min(STICKY_MAX_FRAC, drag.startNh + dy));
      target.nw = nw;
      target.nh = nh;
      target.noteSize = 'custom';
      redraw();
      syncSelectionOverlays();
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      const drag = stickyResizeRef.current;
      stickyResizeRef.current = null;
      if (!drag) return;
      const target = strokesRef.current.find(s => s.id === drag.id);
      if (!target || target.kind !== 'sticky') return;
      if (editingStickyIdRef.current === target.id) readStickyEditor();
      const blocks = editingStickyIdRef.current === target.id
        ? (stickyBlocksRef.current || stickyBlocksOf(target))
        : stickyBlocksOf(target);
      target.blocks = blocks;
      target.text = blocksToPlain(blocks);
      boardSend({
        k: 'edit',
        id: target.id,
        text: target.text,
        blocks: target.blocks,
        nw: target.nw,
        nh: target.nh,
        noteSize: 'custom',
      });
      scheduleSave();
      setStickyStyleTick(t => t + 1);
      redraw();
    };
    try { e.currentTarget?.setPointerCapture?.(e.pointerId); } catch { /* ignore */ }
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const onShapeResizeDown = (e, item) => {
    e.preventDefault();
    e.stopPropagation();
    if (!item || !SHAPE_KINDS.has(item.kind) || !item.pts?.[0] || !item.pts?.[1]) return;
    const b = boundsOf(item);
    if (!b) return;
    shapeResizeRef.current = {
      id: item.id,
      x0: b.x0,
      y0: b.y0,
    };
    moveDragRef.current = null;
    const onMove = (ev) => {
      ev.preventDefault();
      const drag = shapeResizeRef.current;
      const wrap = wrapRef.current;
      if (!drag || !wrap) return;
      const target = strokesRef.current.find(s => s.id === drag.id);
      if (!target || !SHAPE_KINDS.has(target.kind)) return;
      const rect = wrap.getBoundingClientRect();
      const z = zoomRef.current || 1;
      const nx = (ev.clientX - rect.left) / Math.max(rect.width, 1);
      const ny = (ev.clientY - rect.top) / Math.max(rect.height, 1);
      const x1 = Math.max(drag.x0 + SHAPE_MIN_NORM, (nx - 0.5) / z + 0.5);
      const y1 = Math.max(drag.y0 + SHAPE_MIN_NORM, (ny - 0.5) / z + 0.5);
      target.pts = [[drag.x0, drag.y0], [x1, y1]];
      redraw();
      syncSelectionOverlays();
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      const drag = shapeResizeRef.current;
      shapeResizeRef.current = null;
      if (!drag) return;
      const target = strokesRef.current.find(s => s.id === drag.id);
      if (!target || !SHAPE_KINDS.has(target.kind)) return;
      boardSend({ k: 'move', id: target.id, pts: target.pts });
      scheduleSave();
      setStickyStyleTick(t => t + 1);
      redraw();
    };
    try { e.currentTarget?.setPointerCapture?.(e.pointerId); } catch { /* ignore */ }
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const onTextResizeDown = (e, item) => {
    e.preventDefault();
    e.stopPropagation();
    if (!item || item.kind !== 'text') return;
    const startFs = item.fs > 0 ? item.fs : textSizePx(item.fontSize);
    textResizeRef.current = {
      id: item.id,
      startX: e.clientX,
      startY: e.clientY,
      startFs,
    };
    moveDragRef.current = null;
    const onMove = (ev) => {
      ev.preventDefault();
      const drag = textResizeRef.current;
      if (!drag) return;
      const target = strokesRef.current.find(s => s.id === drag.id);
      if (!target || target.kind !== 'text') return;
      const delta = ((ev.clientX - drag.startX) + (ev.clientY - drag.startY)) * 0.45;
      target.fs = Math.max(TEXT_FS_MIN, Math.min(TEXT_FS_MAX, drag.startFs + delta));
      target.fontSize = 'custom';
      redraw();
      syncSelectionOverlays();
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      const drag = textResizeRef.current;
      textResizeRef.current = null;
      if (!drag) return;
      const target = strokesRef.current.find(s => s.id === drag.id);
      if (!target || target.kind !== 'text') return;
      boardSend({
        k: 'font', id: target.id, fs: target.fs, fontSize: 'custom',
      });
      scheduleSave();
      setStickyStyleTick(t => t + 1);
      redraw();
    };
    try { e.currentTarget?.setPointerCapture?.(e.pointerId); } catch { /* ignore */ }
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const pickShape = (id) => {
    if (draftTextRef.current) commitDraftText(true);
    setShapeKind(id);
    setTool('shapes');
    setShapeMenuOpen(false);
    selectItem(null);
  };

  const patchSelectedText = (patch) => {
    const sel = selectedIdRef.current
      ? strokesRef.current.find(s => s.id === selectedIdRef.current)
      : null;
    if (!sel || sel.kind !== 'text') return;
    Object.assign(sel, patch);
    boardSend({ k: 'font', id: sel.id, ...patch });
    scheduleSave();
    redraw();
  };

  const applyColorToSelection = (c) => {
    const id = selectedIdRef.current;
    if (!id) return;
    const item = strokesRef.current.find(s => s.id === id);
    if (!item || !SELECTABLE.has(item.kind)) return;
    item.color = c;
    if (item.kind === 'text') {
      boardSend({ k: 'font', id, color: c });
    } else if (item.kind === 'sticky') {
      boardSend({ k: 'edit', id, text: item.text, blocks: item.blocks, color: c });
    } else {
      boardSend({ k: 'color', id, color: c });
    }
    scheduleSave();
    setStickyStyleTick(t => t + 1);
    redraw();
  };

  const pickFont = (id) => {
    setTextFont(id);
    if (draftText) setDraftText(d => (d ? { ...d, font: id } : d));
    patchSelectedText({ font: id });
    setFontMenuOpen(false);
  };

  const pickTextSize = (id) => {
    setTextSize(id);
    const fs = textSizePx(id);
    if (draftText) setDraftText(d => (d ? { ...d, fontSize: id, fs } : d));
    patchSelectedText({ fontSize: id, fs });
  };

  const draftStyle = (() => {
    if (!draftText || !wrapRef.current) return null;
    void zoom;
    const rect = wrapRef.current.getBoundingClientRect();
    const z = zoomRef.current;
    const fs = Math.max(12, (draftText.fs > 0 ? draftText.fs : textSizePx(draftText.fontSize || textSize)) * (rect.width / 800) * z);
    const family = fontStack(draftText.font || textFont);
    const origin = worldToScreen(draftText.x, draftText.y, rect.width, rect.height, z);
    const minW = Math.max(fs * 4, 56);
    const height = Math.max(fs * 1.5, 28);
    return {
      left: origin.x,
      top: origin.y,
      minWidth: minW,
      height,
      color: draftText.color,
      caretColor: draftText.color,
      fontSize: `${fs}px`,
      fontFamily: family,
      borderColor: draftText.color || '#A78BFA',
    };
  })();

  const stickyEditStyle = (() => {
    if (!editingStickyId || !wrapRef.current) return null;
    void stickyStyleTick;
    void zoom;
    const item = strokesRef.current.find(s => s.id === editingStickyId);
    if (!item || item.kind !== 'sticky' || !item.pts?.[0]) return null;
    const rect = wrapRef.current.getBoundingClientRect();
    const z = zoomRef.current;
    const px = stickySizePx(item.noteSize || stickyNoteSize);
    const nw = item.nw || px / Math.max(rect.width, 1);
    const nh = item.nh || px / Math.max(rect.height, 1);
    const fs = Math.max(12, textSizePx(stickyTextSize) * (rect.width / 800) * z);
    const origin = worldToScreen(item.pts[0][0], item.pts[0][1], rect.width, rect.height, z);
    return {
      left: origin.x,
      top: origin.y,
      width: nw * rect.width * z,
      height: nh * rect.height * z,
      background: item.color || stickyColor,
      color: STICKY_INK,
      caretColor: STICKY_INK,
      fontFamily: fontStack(stickyFont),
      fontSize: `${fs}px`,
      textAlign: stickyAlign || 'left',
      '--wb-sticky-fs': `${fs}px`,
    };
  })();

  const designSticky = (() => {
    void stickyStyleTick;
    void zoom;
    const id = editingStickyId || (
      selectedId
      && strokesRef.current.find(s => s.id === selectedId)?.kind === 'sticky'
        ? selectedId
        : null
    );
    if (!id || !wrapRef.current) return null;
    const item = strokesRef.current.find(s => s.id === id);
    if (!item || item.kind !== 'sticky' || !item.pts?.[0]) return null;
    const rect = wrapRef.current.getBoundingClientRect();
    const px = stickySizePx(item.noteSize || stickyNoteSize);
    const nw = item.nw || px / Math.max(rect.width, 1);
    const nh = item.nh || px / Math.max(rect.height, 1);
    const b = boundsOf(item) || {
      x0: item.pts[0][0], y0: item.pts[0][1],
      x1: item.pts[0][0] + nw, y1: item.pts[0][1] + nh,
    };
    const frame = selectionFrameCss(b, rect, surface().w, zoomRef.current);
    return {
      item,
      handle: {
        left: frame.left + frame.width,
        top: frame.top + frame.height,
      },
    };
  })();

  const designText = (() => {
    void stickyStyleTick;
    void zoom;
    if (!selectedId || !wrapRef.current || draftText) return null;
    const item = strokesRef.current.find(s => s.id === selectedId);
    if (!item || item.kind !== 'text' || !item.pts?.[0]) return null;
    const b = boundsOf(item);
    if (!b) return null;
    const rect = wrapRef.current.getBoundingClientRect();
    const frame = selectionFrameCss(b, rect, surface().w, zoomRef.current);
    return {
      item,
      box: frame,
      handle: {
        left: frame.left + frame.width,
        top: frame.top + frame.height,
      },
    };
  })();

  const designShape = (() => {
    void stickyStyleTick;
    void zoom;
    if (!selectedId || !wrapRef.current) return null;
    const item = strokesRef.current.find(s => s.id === selectedId);
    if (!item || !SHAPE_KINDS.has(item.kind) || !item.pts?.[0] || !item.pts?.[1]) return null;
    const b = boundsOf(item);
    if (!b) return null;
    const rect = wrapRef.current.getBoundingClientRect();
    const frame = selectionFrameCss(b, rect, surface().w, zoomRef.current);
    return {
      item,
      handle: {
        left: frame.left + frame.width,
        top: frame.top + frame.height,
      },
    };
  })();

  void historyTick;
  const canUndo = !!role && strokesRef.current.some(s => s.by === role);
  const canRedo = redoStackRef.current.length > 0;
  const zoomPct = Math.round(zoom * 100);

  const railSwatches = tool === 'sticky' ? STICKY_COLORS : COLORS;
  const selectedItemColor = (() => {
    void stickyStyleTick;
    if (!selectedId) return null;
    return strokesRef.current.find(s => s.id === selectedId)?.color || null;
  })();

  if (role === undefined) {
    return (
      <div className="wb-embed">
        <p className="wb-embed-status">Loading whiteboard…</p>
      </div>
    );
  }

  if (role === null) {
    return (
      <div className="wb-embed">
        <p className="wb-embed-status">Sign in as a member of this duo to use its whiteboard.</p>
      </div>
    );
  }

  return (
    <div className="wb-embed">
      <header className="wb-embed-head">
        <div className="wb-embed-title">
          <div className="wb-embed-title-copy">
            <h2>Our wall</h2>
            <p>Draw together in real time</p>
          </div>
          <button
            type="button"
            className={'wb-embed-library' + (historyOpen ? ' on' : '')}
            onClick={() => { void goSavedLibrary(); }}
            aria-label="Saved whiteboards"
            title="Saved whiteboards"
          >
            Saved whiteboards
          </button>
        </div>
        <div className="wb-embed-actions">
          <div className="wb-history" role="group" aria-label="Undo and redo">
            <button
              type="button"
              className="wb-history-btn"
              onClick={undoMine}
              disabled={!canUndo || !!preview}
              title="Undo (Ctrl+Z)"
              aria-label="Undo"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
                <path
                  d="M9.5 7.5 6 11l3.5 3.5M6 11h8.2a4.3 4.3 0 1 1 0 8.6H11"
                  stroke="currentColor"
                  strokeWidth="1.85"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button
              type="button"
              className="wb-history-btn"
              onClick={redoMine}
              disabled={!canRedo || !!preview}
              title="Redo (Ctrl+Shift+Z)"
              aria-label="Redo"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
                <path
                  d="M14.5 7.5 18 11l-3.5 3.5M18 11h-8.2a4.3 4.3 0 1 0 0 8.6H13"
                  stroke="currentColor"
                  strokeWidth="1.85"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
          <button
            type="button"
            className="wb-save-btn"
            onClick={openSaveDialog}
            disabled={!!preview || !!editingSnap}
            title={editingSnap ? 'Finish editing with Done' : 'Save a named snapshot'}
          >
            Save
          </button>
          <button
            type="button"
            className="wb-share"
            onClick={() => { void shareBoard(); }}
            disabled={shareBusy}
          >
            Share
          </button>
        </div>
      </header>

      {preview && !editingSnap && (
        <div className="wb-preview-bar" role="status">
          <div className="wb-preview-bar-copy">
            <strong>Viewing saved board</strong>
            <span>
              {preview.title} · {formatSaveDate(preview.created_at)}
              {preview.updated_at && preview.updated_at !== preview.created_at
                ? ` · edited ${formatSaveDate(preview.updated_at)}`
                : ''}
              {' · read-only'}
            </span>
          </div>
          <div className="wb-preview-bar-actions">
            <button type="button" className="wb-preview-edit" onClick={startEditSnapshot}>
              Edit
            </button>
          </div>
        </div>
      )}

      {editingSnap && (
        <div className="wb-preview-bar wb-preview-bar-edit" role="status">
          <div className="wb-preview-bar-copy">
            <strong>Editing saved board</strong>
            <span>{editingSnap.title} · changes save to this board only</span>
          </div>
          <div className="wb-preview-bar-actions">
            <button
              type="button"
              className="wb-preview-ghost"
              onClick={() => finishEditSnapshot(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="wb-preview-edit"
              onClick={() => finishEditSnapshot(true)}
            >
              Done
            </button>
          </div>
        </div>
      )}

      {saveOpen && (
        <div className="wb-modal-backdrop" role="presentation" onClick={() => !savingSnap && setSaveOpen(false)}>
          <form
            className="wb-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="wb-save-title"
            onClick={e => e.stopPropagation()}
            onSubmit={submitSaveSnapshot}
          >
            <h3 id="wb-save-title">Save board</h3>
            <p>Creates a snapshot in history, then opens your saved boards.</p>
            <label className="wb-modal-field">
              <span>Title</span>
              <input
                autoFocus
                value={saveTitle}
                onChange={e => setSaveTitle(e.target.value)}
                placeholder={defaultSnapshotTitle()}
                maxLength={120}
                disabled={savingSnap}
              />
            </label>
            <div className="wb-modal-actions">
              <button type="button" className="wb-modal-cancel" disabled={savingSnap} onClick={() => setSaveOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="wb-modal-ok" disabled={savingSnap}>
                {savingSnap ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}

      {shareOpen && (
        <div
          className="wb-modal-backdrop"
          role="presentation"
          onClick={closeShareDialog}
        >
          <div
            className="wb-modal wb-share-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="wb-share-title"
            onClick={e => e.stopPropagation()}
          >
            <h3 id="wb-share-title">Share whiteboard</h3>
            <p>Anyone with this code can add the board under Shared with us.</p>
            {shareBusy ? (
              <p className="wb-share-loading">Creating code…</p>
            ) : shareError && !shareToken ? (
              <p className="wb-share-error">{shareError}</p>
            ) : (
              <>
                <div className="wb-share-code-block">
                  <span className="wb-share-code-label">Board code</span>
                  <div className="wb-share-code-row">
                    <code className="wb-share-code" aria-live="polite">{shareToken}</code>
                    <button
                      type="button"
                      className="wb-share-copy"
                      onClick={() => { void copyShareValue(shareToken, 'code'); }}
                      disabled={!shareToken}
                    >
                      {shareCopied === 'code' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
                <div className="wb-share-code-block">
                  <span className="wb-share-code-label">Link</span>
                  <div className="wb-share-code-row">
                    <input
                      className="wb-share-link"
                      type="text"
                      readOnly
                      value={shareUrl}
                      onFocus={e => e.target.select()}
                      aria-label="Share link"
                    />
                    <button
                      type="button"
                      className="wb-share-copy"
                      onClick={() => { void copyShareValue(shareUrl, 'link'); }}
                      disabled={!shareUrl}
                    >
                      {shareCopied === 'link' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
                {shareError && <p className="wb-share-error">{shareError}</p>}
              </>
            )}
            <div className="wb-modal-actions">
              <button
                type="button"
                className="wb-modal-cancel"
                onClick={closeShareDialog}
                disabled={shareBusy}
              >
                Close
              </button>
              <button
                type="button"
                className="wb-modal-ok"
                onClick={() => { void copyShareValue(shareToken || shareUrl, shareToken ? 'code' : 'link'); }}
                disabled={shareBusy || (!shareToken && !shareUrl)}
              >
                {shareCopied === 'code' || shareCopied === 'link' ? 'Copied!' : 'Copy code'}
              </button>
            </div>
          </div>
        </div>
      )}

      {historyOpen && (
        <div className="wb-modal-backdrop" role="presentation" onClick={() => setHistoryOpen(false)}>
          <div
            className="wb-modal wb-modal-history"
            role="dialog"
            aria-modal="true"
            aria-labelledby="wb-history-title"
            onClick={e => e.stopPropagation()}
          >
            <div className="wb-modal-history-head">
              <h3 id="wb-history-title">Board history</h3>
              <button type="button" className="wb-modal-close" aria-label="Close" onClick={() => setHistoryOpen(false)}>
                ×
              </button>
            </div>
            <p className="wb-modal-history-lead">Open a save to preview it, then Edit to change it.</p>
            {historyLoading ? (
              <p className="wb-modal-empty">Loading…</p>
            ) : historyRows.length === 0 ? (
              <p className="wb-modal-empty">No saved boards yet. Use Save to create one.</p>
            ) : (
              <ul className="wb-history-list">
                {historyRows.map(row => (
                  <li key={row.id}>
                    <button
                      type="button"
                      className="wb-history-row"
                      disabled={previewLoadingId === row.id}
                      onClick={() => openSnapshotPreview(row)}
                    >
                      <span className="wb-history-row-title">{row.title}</span>
                      <span className="wb-history-row-date">{formatSaveDate(row.created_at)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <div className={'wb-embed-body' + (preview ? ' is-preview' : '')}>
        <aside className="wb-rail" aria-label="Drawing tools">
          <div className="wb-rail-tools">
            {TOOLS.map(t => (
              t.id === 'shapes' ? (
                <div className="wb-rail-shapes" key={t.id} ref={shapesWrapRef}>
                  <button
                    ref={shapesBtnRef}
                    type="button"
                    className={'wb-rail-btn' + (tool === 'shapes' ? ' on' : '')}
                    title="Shapes"
                    aria-label="Shapes"
                    aria-expanded={shapeMenuOpen}
                    aria-haspopup="menu"
                    onClick={() => {
                      if (tool === 'shapes' && shapeMenuOpen) setShapeMenuOpen(false);
                      else openShapeMenu();
                    }}
                  >
                    <ToolIcon id="shapes" />
                  </button>
                  {shapeMenuOpen && (
                    <div
                      className="wb-shape-flyout"
                      role="menu"
                      aria-label="Shape types"
                      style={shapeFlyoutPos
                        ? { top: shapeFlyoutPos.top, left: shapeFlyoutPos.left }
                        : undefined}
                    >
                      {SHAPES.map(s => (
                        <button
                          key={s.id}
                          type="button"
                          role="menuitem"
                          className={'wb-shape-opt' + (shapeKind === s.id ? ' on' : '')}
                          title={s.label}
                          aria-label={s.label}
                          onClick={() => pickShape(s.id)}
                        >
                          <ShapeIcon id={s.id} />
                          <span>{s.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : t.id === 'text' ? (
                <div className="wb-rail-shapes" key={t.id} ref={textWrapRef}>
                  <button
                    ref={textBtnRef}
                    type="button"
                    className={'wb-rail-btn' + (tool === 'text' ? ' on' : '')}
                    title="Text"
                    aria-label="Text"
                    aria-expanded={fontMenuOpen}
                    aria-haspopup="menu"
                    onClick={() => {
                      if (tool === 'text' && fontMenuOpen) setFontMenuOpen(false);
                      else openFontMenu();
                    }}
                  >
                    <ToolIcon id="text" />
                  </button>
                  {fontMenuOpen && (
                    <div
                      className="wb-shape-flyout wb-font-flyout"
                      role="menu"
                      aria-label="Fonts"
                      style={fontFlyoutPos
                        ? { top: fontFlyoutPos.top, left: fontFlyoutPos.left }
                        : undefined}
                    >
                      <div className="wb-font-sizes" role="group" aria-label="Text size">
                        {TEXT_SIZES.map(ts => (
                          <button
                            key={ts.id}
                            type="button"
                            className={'wb-font-size' + (textSize === ts.id ? ' on' : '')}
                            title={`Text size ${ts.label}`}
                            aria-label={`Text size ${ts.label}`}
                            onClick={() => pickTextSize(ts.id)}
                          >
                            {ts.label}
                          </button>
                        ))}
                      </div>
                      {FONTS.map(f => (
                        <button
                          key={f.id}
                          type="button"
                          role="menuitem"
                          className={'wb-shape-opt wb-font-opt' + (textFont === f.id ? ' on' : '')}
                          title={f.label}
                          aria-label={f.label}
                          style={{ fontFamily: f.family }}
                          onClick={() => pickFont(f.id)}
                        >
                          <span className="wb-font-sample">Aa</span>
                          <span>{f.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <button
                  key={t.id}
                  type="button"
                  className={
                    'wb-rail-btn'
                    + (tool === t.id && !t.soon ? ' on' : '')
                    + (t.soon ? ' is-soon' : '')
                  }
                  disabled={t.soon}
                  title={t.soon ? 'Coming soon' : t.label}
                  aria-label={t.soon ? `${t.label} (Coming soon)` : t.label}
                  onClick={() => { if (!t.soon) pickTool(t.id); }}
                >
                  <ToolIcon id={t.id} />
                </button>
              )
            ))}
            <button
              type="button"
              className="wb-rail-btn wb-rail-clear"
              title="Clear all"
              aria-label="Clear all"
              disabled={!!preview}
              onClick={clearBoard}
            >
              <ToolIcon id="clear" />
            </button>
          </div>
          {(tool === 'pen' || tool === 'eraser' || tool === 'shapes') && (
            <div className="wb-rail-sizes" role="group" aria-label="Stroke size">
              {SIZES.map(s => (
                <button
                  key={s}
                  type="button"
                  className={'wb-rail-size' + (size === s ? ' on' : '')}
                  title={`Size ${s}`}
                  aria-label={`Stroke size ${s}`}
                  onClick={() => setSize(s)}
                >
                  <span style={{ width: s + 2, height: s + 2 }} />
                </button>
              ))}
            </div>
          )}
          <div className="wb-rail-swatches" role="group" aria-label="Colors">
            {railSwatches.map(c => (
              <button
                key={c}
                type="button"
                className={
                  'wb-rail-swatch'
                  + (
                    tool === 'sticky'
                      ? (stickyColor === c ? ' on' : '')
                      : (
                        selectedId
                          ? (selectedItemColor === c ? ' on' : '')
                          : (color === c && (tool === 'pen' || tool === 'shapes' || tool === 'text' || tool === 'select') ? ' on' : '')
                      )
                  )
                }
                style={{ background: c }}
                title="Color"
                aria-label={`Color ${c}`}
                onMouseDown={e => e.preventDefault()}
                onClick={() => {
                  if (tool === 'sticky') {
                    setStickyColor(c);
                    patchActiveSticky({ color: c });
                    return;
                  }
                  setColor(c);
                  if (tool === 'eraser') setTool('pen');
                  if (draftText) setDraftText(d => (d ? { ...d, color: c } : d));
                  if (selectedIdRef.current) applyColorToSelection(c);
                }}
              />
            ))}
          </div>
        </aside>

        <div className="wb-stage" ref={wrapRef}>
          <canvas
            ref={canvasRef}
            className="wb-stage-canvas"
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerLeave={onUp}
          />
          {draftText && draftStyle && (
            <textarea
              ref={draftInputRef}
              className="wb-text-draft"
              style={draftStyle}
              value={draftText.value}
              placeholder="Type…"
              aria-label="Text"
              rows={1}
              onChange={e => {
                const value = e.target.value;
                setDraftText(d => {
                  if (!d) return d;
                  const next = { ...d, value };
                  draftTextRef.current = next;
                  return next;
                });
              }}
              onBlur={() => commitDraftText(true)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  commitDraftText(true);
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  if ((draftTextRef.current?.value || '').trim()) commitDraftText(true);
                  else {
                    draftTextRef.current = null;
                    setDraftText(null);
                  }
                }
              }}
            />
          )}
          {editingStickyId && stickyEditStyle && (
            <div
              ref={stickyInputRef}
              className="wb-sticky-draft"
              style={stickyEditStyle}
              contentEditable
              suppressContentEditableWarning
              role="textbox"
              aria-multiline="true"
              aria-label="Sticky note"
              data-placeholder="Note…"
              onInput={() => { readStickyEditor(); }}
              onBlur={() => commitStickyEdit()}
              onKeyDown={e => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  commitStickyEdit();
                }
              }}
            />
          )}
          {designSticky && (
            <button
              ref={stickyHandleElRef}
              type="button"
              className="wb-sticky-resize"
              title="Resize note"
              aria-label="Resize note"
              style={{
                left: designSticky.handle.left,
                top: designSticky.handle.top,
                borderColor: designSticky.item.color || '#A78BFA',
              }}
              onMouseDown={e => e.preventDefault()}
              onPointerDown={e => onStickyResizeDown(e, designSticky.item)}
            />
          )}
          {designText && (
            <button
              ref={textHandleElRef}
              type="button"
              className="wb-sticky-resize"
              title="Resize text"
              aria-label="Resize text"
              style={{
                left: designText.handle.left,
                top: designText.handle.top,
                borderColor: designText.item.color || '#A78BFA',
              }}
              onMouseDown={e => e.preventDefault()}
              onPointerDown={e => onTextResizeDown(e, designText.item)}
            />
          )}
          {designShape && (
            <button
              ref={shapeHandleElRef}
              type="button"
              className="wb-sticky-resize"
              title="Resize shape"
              aria-label="Resize shape"
              style={{
                left: designShape.handle.left,
                top: designShape.handle.top,
                borderColor: designShape.item.color || '#A78BFA',
              }}
              onMouseDown={e => e.preventDefault()}
              onPointerDown={e => onShapeResizeDown(e, designShape.item)}
            />
          )}
          {partnerCursor && (() => {
            const sc = worldToScreen(partnerCursor.x, partnerCursor.y, 100, 100, zoom);
            return (
              <div
                className={'wb-ghost ' + (role === 'A' ? 'B' : 'A')}
                style={{ left: `${sc.x}%`, top: `${sc.y}%` }}
              />
            );
          })()}

          <div className="wb-zoom" aria-label="Zoom">
            <button
              type="button"
              disabled={zoom <= ZOOM_MIN}
              title="Zoom out"
              aria-label="Zoom out"
              onClick={() => setZoomLevel(z => z - ZOOM_STEP)}
            >
              −
            </button>
            <span aria-live="polite">{zoomPct}%</span>
            <button
              type="button"
              disabled={zoom >= ZOOM_MAX}
              title="Zoom in"
              aria-label="Zoom in"
              onClick={() => setZoomLevel(z => z + ZOOM_STEP)}
            >
              +
            </button>
          </div>
        </div>
      </div>

      {status && <div className="wb-embed-status">{status}</div>}
    </div>
  );
}
