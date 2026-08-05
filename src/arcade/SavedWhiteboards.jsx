// SavedWhiteboards.jsx — library of named Our wall snapshots for the duo.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Avatar } from './avatars.jsx';
import { getDuoAvatars } from '../lib/avatars.js';
import {
  listBoardSnapshots,
  currentUserId,
  duoNames,
  setBoardSnapshotFavorite,
  renameBoardSnapshot,
  trashBoardSnapshot,
  restoreBoardSnapshot,
  deleteBoardSnapshot,
  duplicateBoardSnapshot,
  getBoardSnapshot,
  loadBoard,
  importBoardShare,
  peekBoardShare,
  parseBoardShareInput,
} from '../lib/whiteboard.js';
import '../styles/saved-whiteboards.css';

const PAGE_SIZE = 8;
const TABS = [
  { id: 'all', label: 'All' },
  { id: 'favorites', label: 'Favorites' },
  { id: 'mine', label: 'Created by us' },
  { id: 'shared', label: 'Shared with us' },
  { id: 'trash', label: 'Trash' },
];
const SORTS = [
  { id: 'recent', label: 'Most recent' },
  { id: 'oldest', label: 'Oldest' },
  { id: 'title', label: 'Title A-Z' },
  { id: 'favorited', label: 'Recently favorited' },
];

function formatRelative(iso) {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const days = Math.floor((Date.now() - t) / 86400000);
  if (days <= 0) {
    return new Date(iso).toLocaleString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
  }
  if (days === 1) return '1 day ago';
  if (days < 14) return `${days} days ago`;
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Fingerprint live strokes so we can skip the erase dialog when already saved. */
function strokeKey(strokes) {
  if (!Array.isArray(strokes) || !strokes.length) return '';
  try {
    return JSON.stringify(strokes);
  } catch {
    return `len:${strokes.length}`;
  }
}

const THUMB_FONTS = {
  inter: 'Inter, system-ui, sans-serif',
  fraunces: 'Fraunces, Georgia, serif',
  mono: '"JetBrains Mono", ui-monospace, monospace',
  caveat: 'Caveat, cursive',
  outfit: 'Outfit, system-ui, sans-serif',
};

function thumbFont(id) {
  return THUMB_FONTS[id] || THUMB_FONTS.inter;
}

function thumbTextPx(sw, fontSize, customFs) {
  const base = customFs > 0
    ? customFs
    : fontSize === 'lg' ? 28 : fontSize === 'sm' ? 14 : 20;
  return Math.max(6, base * (sw / 800));
}

function pathThumbHeart(g, x, y, w, h) {
  const cx = x + w / 2;
  g.moveTo(cx, y + h * 0.32);
  g.bezierCurveTo(cx, y + h * 0.08, x + w * 0.08, y, x, y + h * 0.28);
  g.bezierCurveTo(x - w * 0.02, y + h * 0.58, cx, y + h * 0.78, cx, y + h * 0.96);
  g.bezierCurveTo(cx, y + h * 0.78, x + w * 1.02, y + h * 0.58, x + w, y + h * 0.28);
  g.bezierCurveTo(x + w * 0.92, y, cx, y + h * 0.08, cx, y + h * 0.32);
  g.closePath();
}

/** Expand normalized bounds so every stroke/text fits in the thumb. */
function thumbContentBounds(items, refW, refH, measureG) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  const include = (nx, ny) => {
    if (!Number.isFinite(nx) || !Number.isFinite(ny)) return;
    x0 = Math.min(x0, nx);
    y0 = Math.min(y0, ny);
    x1 = Math.max(x1, nx);
    y1 = Math.max(y1, ny);
  };

  for (const s of items) {
    const pts = Array.isArray(s.pts) ? s.pts : [];
    if (s.kind === 'text' && pts[0] && s.text) {
      const [nx, ny] = pts[0];
      const fs = thumbTextPx(refW, s.fontSize, s.fs);
      measureG.font = `600 ${fs}px ${thumbFont(s.font)}`;
      const tw = Math.max(measureG.measureText(String(s.text)).width, fs * 0.6) / refW;
      const th = (fs * 1.25) / refH;
      include(nx, ny);
      include(nx + tw, ny + th);
      continue;
    }
    if (s.kind === 'sticky' && pts[0]) {
      const [nx, ny] = pts[0];
      const nw = s.nw > 0 ? s.nw : 0.18;
      const nh = s.nh > 0 ? s.nh : 0.16;
      include(nx, ny);
      include(nx + nw, ny + nh);
      continue;
    }
    for (const p of pts) {
      if (Array.isArray(p) && p.length >= 2) include(p[0], p[1]);
    }
  }

  if (!Number.isFinite(x0)) {
    return { x0: 0, y0: 0, x1: 1, y1: 1 };
  }
  // Always include a bit of empty board so lonely strokes aren't huge.
  x0 = Math.min(x0, 0);
  y0 = Math.min(y0, 0);
  x1 = Math.max(x1, 1);
  y1 = Math.max(y1, 1);
  const padX = Math.max(0.04, (x1 - x0) * 0.06);
  const padY = Math.max(0.04, (y1 - y0) * 0.06);
  return {
    x0: x0 - padX,
    y0: y0 - padY,
    x1: x1 + padX,
    y1: y1 + padY,
  };
}

/** Same stroke model as Our wall; sw/sh are the virtual board size before fit-scale. */
function drawThumbItem(g, s, sw, sh) {
  if (!s) return;
  const color = s.color || '#8B5CF6';
  const pts = Array.isArray(s.pts) ? s.pts : [];
  const lw = Math.max(0.6, (s.size || 6) * (sw / 800));

  if (s.kind === 'text' && pts[0] && s.text) {
    const fs = thumbTextPx(sw, s.fontSize, s.fs);
    g.save();
    g.font = `600 ${fs}px ${thumbFont(s.font)}`;
    g.fillStyle = color;
    g.textBaseline = 'top';
    g.fillText(String(s.text), pts[0][0] * sw, pts[0][1] * sh);
    g.restore();
    return;
  }

  if (s.kind === 'sticky' && pts[0]) {
    const nw = (s.nw > 0 ? s.nw : 0.18) * sw;
    const nh = (s.nh > 0 ? s.nh : 0.16) * sh;
    const x = pts[0][0] * sw;
    const y = pts[0][1] * sh;
    g.save();
    g.fillStyle = color;
    g.strokeStyle = 'rgba(31, 22, 48, 0.12)';
    g.lineWidth = Math.max(0.5, sw / 800);
    if (typeof g.roundRect === 'function') g.roundRect(x, y, nw, nh, 3);
    else g.rect(x, y, nw, nh);
    g.fill();
    g.stroke();
    if (s.text) {
      g.fillStyle = '#1f1630';
      g.font = `600 ${Math.max(6, 11 * (sw / 800))}px ${thumbFont(s.font)}`;
      g.textBaseline = 'top';
      g.fillText(String(s.text).slice(0, 28), x + 4, y + 4, Math.max(8, nw - 8));
    }
    g.restore();
    return;
  }

  const filled = typeof s.kind === 'string' && s.kind.endsWith('-fill');
  const base = filled && s.kind ? s.kind.slice(0, -5) : s.kind;

  if ((base === 'rect' || base === 'ellipse' || base === 'heart' || base === 'line' || base === 'arrow')
    && pts.length >= 2) {
    const [[ax, ay], [bx, by]] = pts;
    const x0 = ax * sw;
    const y0 = ay * sh;
    const x1 = bx * sw;
    const y1 = by * sh;
    g.save();
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.strokeStyle = color;
    g.fillStyle = color;
    g.lineWidth = lw;
    g.beginPath();
    if (base === 'heart') {
      pathThumbHeart(
        g,
        Math.min(x0, x1),
        Math.min(y0, y1),
        Math.max(Math.abs(x1 - x0), 2),
        Math.max(Math.abs(y1 - y0), 2),
      );
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
      g.ellipse(
        (x0 + x1) / 2,
        (y0 + y1) / 2,
        Math.max(Math.abs(x1 - x0) / 2, 0.5),
        Math.max(Math.abs(y1 - y0) / 2, 0.5),
        0, 0, Math.PI * 2,
      );
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
      const head = Math.max(6, lw * 3);
      g.beginPath();
      g.moveTo(x1, y1);
      g.lineTo(x1 - head * Math.cos(ang - Math.PI / 7), y1 - head * Math.sin(ang - Math.PI / 7));
      g.moveTo(x1, y1);
      g.lineTo(x1 - head * Math.cos(ang + Math.PI / 7), y1 - head * Math.sin(ang + Math.PI / 7));
      g.stroke();
    }
    g.restore();
    return;
  }

  if (pts.length >= 2) {
    g.save();
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.globalCompositeOperation = s.erase ? 'destination-out' : 'source-over';
    g.strokeStyle = s.erase ? 'rgba(0,0,0,1)' : color;
    g.lineWidth = (s.erase ? lw * 3 : lw);
    g.beginPath();
    pts.forEach(([x, y], i) => {
      const px = x * sw;
      const py = y * sh;
      if (i) g.lineTo(px, py);
      else g.moveTo(px, py);
    });
    g.stroke();
    g.restore();
  }
}

/** Cache full snapshot strokes so card thumbs match the real board. */
const thumbStrokeCache = new Map();

function BoardThumb({
  snapshotId = null,
  updatedAt = '',
  strokes: seedStrokes = [],
  title = '',
}) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const cacheKey = snapshotId ? `${snapshotId}:${updatedAt || ''}` : '';
  const [strokes, setStrokes] = useState(() => {
    if (cacheKey && thumbStrokeCache.has(cacheKey)) return thumbStrokeCache.get(cacheKey);
    return Array.isArray(seedStrokes) ? seedStrokes : [];
  });

  // Seed from list, then load the real saved strokes for this snapshot.
  useEffect(() => {
    if (cacheKey && thumbStrokeCache.has(cacheKey)) {
      setStrokes(thumbStrokeCache.get(cacheKey));
      return undefined;
    }
    if (Array.isArray(seedStrokes) && seedStrokes.length) {
      setStrokes(seedStrokes);
    }
    if (!snapshotId) return undefined;

    let cancelled = false;
    (async () => {
      try {
        const snap = await getBoardSnapshot(snapshotId);
        if (cancelled) return;
        const full = Array.isArray(snap.strokes) ? snap.strokes : [];
        if (cacheKey) thumbStrokeCache.set(cacheKey, full);
        setStrokes(full);
      } catch {
        /* keep seed preview */
      }
    })();
    return () => { cancelled = true; };
    // seedStrokes intentionally omitted — parent passes a new array each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshotId, cacheKey]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const cv = canvasRef.current;
    if (!wrap || !cv || typeof ResizeObserver === 'undefined') return undefined;

    let raf = 0;
    const paint = () => {
      const cssW = Math.max(1, Math.floor(wrap.clientWidth));
      const cssH = Math.max(1, Math.floor(wrap.clientHeight));
      if (cssW < 2 || cssH < 2) return;
      const dpr = Math.max(2, window.devicePixelRatio || 1);
      const bw = Math.floor(cssW * dpr);
      const bh = Math.floor(cssH * dpr);
      if (cv.width !== bw) cv.width = bw;
      if (cv.height !== bh) cv.height = bh;

      const g = cv.getContext('2d');
      if (!g) return;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, bw, bh);
      g.imageSmoothingEnabled = true;
      if ('imageSmoothingQuality' in g) g.imageSmoothingQuality = 'high';

      // Same flat stage as Our wall (white in dark mode, #F3F4F8 in light).
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const appearance = document.documentElement.getAttribute('data-appearance');
      g.fillStyle = appearance === 'light' ? '#F3F4F8' : '#ffffff';
      g.fillRect(0, 0, cssW, cssH);

      const items = Array.isArray(strokes) ? strokes.filter(Boolean) : [];
      if (!items.length) {
        g.fillStyle = 'rgba(192, 132, 252, 0.4)';
        g.font = `600 ${Math.max(11, 14 * (cssW / 260))}px Inter, system-ui, sans-serif`;
        g.textBaseline = 'middle';
        g.fillText((title || 'Empty board').slice(0, 18), 14, cssH / 2);
        return;
      }

      // Virtual board in the same aspect as the card, then fit ALL content into view
      // (same idea as zooming out on Our wall so nothing is cropped).
      const refW = 800;
      const refH = Math.max(400, refW * (cssH / cssW));
      const bounds = thumbContentBounds(items, refW, refH, g);
      const worldW = Math.max(0.08, bounds.x1 - bounds.x0) * refW;
      const worldH = Math.max(0.08, bounds.y1 - bounds.y0) * refH;
      const fit = Math.min(cssW / worldW, cssH / worldH) * 0.94;
      const ox = (cssW - worldW * fit) / 2 - bounds.x0 * refW * fit;
      const oy = (cssH - worldH * fit) / 2 - bounds.y0 * refH * fit;

      g.setTransform(dpr * fit, 0, 0, dpr * fit, dpr * ox, dpr * oy);
      for (const s of items) drawThumbItem(g, s, refW, refH);
    };

    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(paint);
    });
    ro.observe(wrap);
    paint();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [strokes, title]);

  return (
    <div className="swb-thumb" ref={wrapRef} aria-hidden="true">
      <canvas ref={canvasRef} className="swb-thumb-canvas" />
    </div>
  );
}

export default function SavedWhiteboards({
  code,
  myRole,
  username = '',
  avatars: avatarsProp = null,
}) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchRef = useRef(null);
  const menuRef = useRef(null);
  const addInputRef = useRef(null);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uid, setUid] = useState(null);
  const [names, setNames] = useState({ A: 'A', B: 'B' });
  const [avatars, setAvatars] = useState(avatarsProp || { avatar_a: null, avatar_b: null });
  const [tab, setTab] = useState('all');
  const [sort, setSort] = useState('recent');
  const [query, setQuery] = useState('');
  const [view, setView] = useState('grid');
  const [page, setPage] = useState(1);
  const [menuId, setMenuId] = useState(null);
  const [sortOpen, setSortOpen] = useState(false);
  const [newConfirmOpen, setNewConfirmOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addInput, setAddInput] = useState('');
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState('');
  const [addHint, setAddHint] = useState('');

  const refresh = useCallback(async () => {
    if (!code) return;
    setLoading(true);
    setError('');
    try {
      const [list, userId, duoLabel] = await Promise.all([
        listBoardSnapshots(code),
        currentUserId(),
        duoNames(code),
      ]);
      setRows(list || []);
      setUid(userId);
      setNames(duoLabel || { A: 'A', B: 'B' });
    } catch (e) {
      setError(e.message || 'Couldn’t load saved boards');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (avatarsProp) {
      setAvatars(avatarsProp);
      return undefined;
    }
    if (!code) return undefined;
    let alive = true;
    getDuoAvatars(code)
      .then(data => { if (alive) setAvatars(data || { avatar_a: null, avatar_b: null }); })
      .catch(() => {});
    return () => { alive = false; };
  }, [code, avatarsProp]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!menuId && !sortOpen) return undefined;
    const onDoc = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuId(null);
      if (!e.target.closest?.('.swb-sort')) setSortOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuId, sortOpen]);

  useEffect(() => { setPage(1); }, [tab, sort, query]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = rows.filter((r) => {
      const trashed = !!r.deleted_at;
      if (tab === 'trash') return trashed;
      if (trashed) return false;
      if (tab === 'favorites') return !!r.is_favorite;
      if (tab === 'mine') return !r.shared_from;
      if (tab === 'shared') return !!r.shared_from;
      return true;
    });
    if (q) list = list.filter(r => (r.title || '').toLowerCase().includes(q));
    list = [...list].sort((a, b) => {
      if (sort === 'oldest') return new Date(a.created_at) - new Date(b.created_at);
      if (sort === 'title') return (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' });
      if (sort === 'favorited') {
        const at = a.favorited_at ? new Date(a.favorited_at).getTime() : 0;
        const bt = b.favorited_at ? new Date(b.favorited_at).getTime() : 0;
        if (bt !== at) return bt - at;
      }
      return new Date(b.created_at) - new Date(a.created_at);
    });
    return list;
  }, [rows, tab, sort, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const from = filtered.length ? (safePage - 1) * PAGE_SIZE + 1 : 0;
  const to = Math.min(safePage * PAGE_SIZE, filtered.length);
  const sortLabel = SORTS.find(s => s.id === sort)?.label || 'Most recent';
  const emptyCopy = tab === 'trash'
    ? 'Trashed boards will show up here.'
    : tab === 'favorites'
      ? 'Star a board to keep it close.'
      : tab === 'shared'
        ? 'Paste a share code or link to add a board here.'
        : tab === 'mine'
          ? 'Boards you and your partner save will land here.'
          : 'Save from Our wall to start a library.';

  const openAddShared = useCallback((prefill = '') => {
    setAddError('');
    setAddHint('');
    setAddInput(prefill || '');
    setAddOpen(true);
  }, []);

  const closeAddShared = useCallback(() => {
    if (addBusy) return;
    setAddOpen(false);
    setAddError('');
    setAddHint('');
    setAddInput('');
    if (searchParams.has('add')) {
      const next = new URLSearchParams(searchParams);
      next.delete('add');
      setSearchParams(next, { replace: true });
    }
  }, [addBusy, searchParams, setSearchParams]);

  const submitAddShared = useCallback(async () => {
    const token = parseBoardShareInput(addInput);
    if (!token) {
      setAddError('Paste a share code or the full share link.');
      setAddHint('');
      return;
    }
    if (!code) return;
    setAddBusy(true);
    setAddError('');
    setAddHint('');
    try {
      const peek = await peekBoardShare(token);
      if (!peek) {
        setAddError('Share code not found.');
        return;
      }
      setAddHint(`Adding “${peek.title || 'Shared whiteboard'}”…`);
      await importBoardShare(code, token);
      setAddOpen(false);
      setAddInput('');
      setAddHint('');
      setTab('shared');
      if (searchParams.has('add')) {
        const next = new URLSearchParams(searchParams);
        next.delete('add');
        setSearchParams(next, { replace: true });
      }
      await refresh();
    } catch (e) {
      setAddError(e.message || 'Couldn’t add shared board');
      setAddHint('');
    } finally {
      setAddBusy(false);
    }
  }, [addInput, code, refresh, searchParams, setSearchParams]);

  useEffect(() => {
    if (!addOpen) return undefined;
    const t = window.setTimeout(() => addInputRef.current?.focus(), 40);
    return () => window.clearTimeout(t);
  }, [addOpen]);

  useEffect(() => {
    const raw = searchParams.get('add');
    if (!raw || !code) return undefined;
    openAddShared(raw);
  }, [searchParams, code, openAddShared]);

  const openBoard = (id) => {
    navigate(`/app/place/sect-wall?snapshot=${encodeURIComponent(id)}`);
  };

  const toggleFavorite = async (row, e) => {
    e?.stopPropagation?.();
    if (row.deleted_at) return;
    const next = !row.is_favorite;
    setRows(prev => prev.map(r => (
      r.id === row.id
        ? { ...r, is_favorite: next, favorited_at: next ? new Date().toISOString() : null }
        : r
    )));
    try {
      await setBoardSnapshotFavorite(row.id, next);
    } catch {
      setRows(prev => prev.map(r => (
        r.id === row.id
          ? { ...r, is_favorite: row.is_favorite, favorited_at: row.favorited_at }
          : r
      )));
    }
  };

  const onRename = async (row) => {
    setMenuId(null);
    const next = window.prompt('Rename board', row.title || '');
    if (next == null) return;
    const title = next.trim();
    if (!title) return;
    try {
      await renameBoardSnapshot(row.id, title);
      setRows(prev => prev.map(r => (r.id === row.id ? { ...r, title } : r)));
    } catch (e) {
      setError(e.message || 'Rename failed');
    }
  };

  const onDuplicate = async (row) => {
    setMenuId(null);
    try {
      await duplicateBoardSnapshot(row.id);
      await refresh();
    } catch (e) {
      setError(e.message || 'Duplicate failed');
    }
  };

  const onTrash = async (row) => {
    setMenuId(null);
    if (!window.confirm(`Move “${row.title}” to Trash?`)) return;
    try {
      await trashBoardSnapshot(row.id);
      setRows(prev => prev.map(r => (
        r.id === row.id ? { ...r, deleted_at: new Date().toISOString() } : r
      )));
    } catch (e) {
      setError(e.message || 'Couldn’t move to trash');
    }
  };

  const onRestore = async (row) => {
    setMenuId(null);
    try {
      await restoreBoardSnapshot(row.id);
      setRows(prev => prev.map(r => (
        r.id === row.id ? { ...r, deleted_at: null } : r
      )));
    } catch (e) {
      setError(e.message || 'Restore failed');
    }
  };

  const onDeleteForever = async (row) => {
    setMenuId(null);
    if (!window.confirm(`Delete “${row.title}” forever? This can’t be undone.`)) return;
    try {
      await deleteBoardSnapshot(row.id);
      setRows(prev => prev.filter(r => r.id !== row.id));
    } catch (e) {
      setError(e.message || 'Delete failed');
    }
  };

  const onDownload = async (row) => {
    setMenuId(null);
    try {
      const snap = await getBoardSnapshot(row.id);
      const blob = new Blob([JSON.stringify({
        title: snap.title,
        created_at: snap.created_at,
        strokes: snap.strokes,
      }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(snap.title || 'whiteboard').replace(/[^\w\-]+/g, '_').slice(0, 48)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message || 'Download failed');
    }
  };

  const initials = (label) => (label || '?').trim().charAt(0).toUpperCase() || '?';

  const goLiveBoard = () => {
    // Open the live Our wall as-is — never pass ?new=1 (that wipes the board).
    navigate({ pathname: '/app/place/sect-wall', search: '' }, { replace: true });
  };

  const goNewBoard = async () => {
    // Skip the erase warning when live is empty or already stored as a saved board.
    let live = [];
    try {
      live = await loadBoard(code);
    } catch {
      live = null;
    }
    if (!live || live.length === 0) {
      confirmNewBoard();
      return;
    }
    const liveKey = strokeKey(live);
    let alreadySaved = false;
    try {
      const snaps = rows.length ? rows : await listBoardSnapshots(code);
      alreadySaved = (snaps || []).some((s) => {
        if (s.deleted_at) return false;
        const strokes = s.preview || s.strokes;
        return Array.isArray(strokes) && strokeKey(strokes) === liveKey;
      });
    } catch {
      alreadySaved = false;
    }
    if (alreadySaved) {
      confirmNewBoard();
      return;
    }
    setNewConfirmOpen(true);
  };

  const confirmNewBoard = () => {
    setNewConfirmOpen(false);
    try { sessionStorage.setItem('duoarcade-wb-new-ok', '1'); } catch { /* ignore */ }
    navigate({ pathname: '/app/place/sect-wall', search: '?new=1' }, { replace: true });
  };

  return (
    <div className="swb wb-embed">
      <header className="swb-head wb-embed-head">
        <div className="wb-embed-title">
          <h2>Saved whiteboards</h2>
          <p>All your saved ideas, plans and sketches</p>
        </div>
        <div className="swb-head-actions wb-embed-actions">
          <label className="swb-search">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
              <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
              <path d="M16 16.5 20 20.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <input
              ref={searchRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search whiteboards..."
              aria-label="Search whiteboards"
            />
          </label>
          <button
            type="button"
            className="swb-live"
            onClick={goLiveBoard}
            title="Open the live board (keeps current strokes)"
          >
            Live board
          </button>
          <div className="swb-user" title={username || names[myRole] || 'You'}>
            <Avatar
              id={myRole === 'B' ? avatars.avatar_b : avatars.avatar_a}
              fallback={initials(username || names[myRole])}
              size={36}
            />
          </div>
        </div>
      </header>

      <div className="swb-body">
        <div className="swb-filters">
          <div className="swb-tabs" role="tablist" aria-label="Board filters">
            {TABS.map(t => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                className={'swb-tab' + (tab === t.id ? ' on' : '')}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="swb-toolbar-right">
            <button
              type="button"
              className="swb-add"
              onClick={() => openAddShared()}
              title="Add a board shared with a code or link"
            >
              Add shared
            </button>
            <button
              type="button"
              className="swb-new"
              onClick={() => { void goNewBoard(); }}
              title="Start a blank whiteboard (erases the live board)"
            >
              <span aria-hidden="true">+</span> New whiteboard
            </button>
            <div className="swb-view" role="group" aria-label="View">
              <button
                type="button"
                className={view === 'grid' ? 'on' : ''}
                aria-label="Grid view"
                aria-pressed={view === 'grid'}
                onClick={() => setView('grid')}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                  <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
                  <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
                  <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
                  <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
                </svg>
              </button>
              <button
                type="button"
                className={view === 'list' ? 'on' : ''}
                aria-label="List view"
                aria-pressed={view === 'list'}
                onClick={() => setView('list')}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
                  <path d="M5 7h14M5 12h14M5 17h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="swb-sort">
              <button type="button" className="swb-sort-btn" onClick={() => setSortOpen(v => !v)} aria-expanded={sortOpen}>
                {sortLabel}
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true">
                  <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {sortOpen && (
                <div className="swb-sort-menu" role="menu">
                  {SORTS.map(s => (
                    <button
                      key={s.id}
                      type="button"
                      role="menuitem"
                      className={sort === s.id ? 'on' : ''}
                      onClick={() => { setSort(s.id); setSortOpen(false); }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {error && <div className="swb-error">{error}</div>}

        {loading ? (
          <div className="swb-empty">
            <p>Loading boards…</p>
          </div>
        ) : pageRows.length === 0 ? (
          <div className="swb-empty">
            <div className="swb-empty-ico" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none">
                <path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19l-4 1Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                <path d="M14 7l3 3" stroke="currentColor" strokeWidth="1.7" />
              </svg>
            </div>
            <h2>No boards here yet</h2>
            <p>{emptyCopy}</p>
          </div>
        ) : (
          <div className={'swb-grid' + (view === 'list' ? ' is-list' : '')}>
            {pageRows.map(row => (
              <article
                key={row.id}
                className="swb-card"
                onClick={() => !row.deleted_at && openBoard(row.id)}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ' ') && !row.deleted_at) {
                    e.preventDefault();
                    openBoard(row.id);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <div className="swb-card-media">
                  <BoardThumb
                    snapshotId={row.id}
                    updatedAt={row.updated_at || row.created_at || ''}
                    strokes={row.preview}
                    title={row.title}
                  />
                  {!row.deleted_at && (
                    <button
                      type="button"
                      className={'swb-star' + (row.is_favorite ? ' on' : '')}
                      aria-label={row.is_favorite ? 'Unfavorite' : 'Favorite'}
                      aria-pressed={!!row.is_favorite}
                      onClick={(e) => toggleFavorite(row, e)}
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                        <path
                          d="M12 4.8l2.1 4.3 4.7.7-3.4 3.3.8 4.7L12 15.6 7.8 17.8l.8-4.7L5.2 9.8l4.7-.7L12 4.8Z"
                          fill={row.is_favorite ? 'currentColor' : 'none'}
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  )}
                </div>
                <div className="swb-card-body">
                  <h3 title={row.title}>{row.title || 'Untitled'}</h3>
                  <p>
                    {row.deleted_at
                      ? `Trashed ${formatRelative(row.deleted_at)}`
                      : `Created ${formatRelative(row.created_at)}`}
                  </p>
                  {!row.deleted_at
                    && row.updated_at
                    && new Date(row.updated_at) - new Date(row.created_at) > 2000 && (
                    <p className="swb-card-edited">
                      Edited {formatRelative(row.updated_at)}
                    </p>
                  )}
                  <div className="swb-card-foot">
                    <div className="swb-avs" aria-hidden="true">
                      <Avatar id={avatars.avatar_a} fallback={initials(names.A)} size={26} />
                      <Avatar id={avatars.avatar_b} fallback={initials(names.B)} size={26} />
                    </div>
                    <div className="swb-more" ref={menuId === row.id ? menuRef : null}>
                      <button
                        type="button"
                        className="swb-more-btn"
                        aria-label="Board actions"
                        aria-expanded={menuId === row.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuId(id => (id === row.id ? null : row.id));
                        }}
                      >
                        ···
                      </button>
                      {menuId === row.id && (
                        <div className="swb-more-menu" role="menu" onClick={e => e.stopPropagation()}>
                          {row.deleted_at ? (
                            <>
                              <button type="button" role="menuitem" onClick={() => onRestore(row)}>Restore</button>
                              <button type="button" role="menuitem" className="danger" onClick={() => onDeleteForever(row)}>Delete forever</button>
                            </>
                          ) : (
                            <>
                              <button type="button" role="menuitem" onClick={() => onRename(row)}>Rename</button>
                              <button type="button" role="menuitem" onClick={() => onDuplicate(row)}>Duplicate</button>
                              <button type="button" role="menuitem" onClick={() => onDownload(row)}>Download</button>
                              <button type="button" role="menuitem" className="danger" onClick={() => onTrash(row)}>Delete</button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        <footer className="swb-foot">
          <span>
            {filtered.length
              ? `Showing ${from}–${to} of ${filtered.length} whiteboards`
              : 'Showing 0 whiteboards'}
          </span>
          <div className="swb-pager" role="navigation" aria-label="Pagination">
            <button
              type="button"
              disabled={safePage <= 1}
              aria-label="Previous page"
              onClick={() => setPage(p => Math.max(1, p - 1))}
            >
              ‹
            </button>
            {Array.from({ length: pageCount }, (_, i) => i + 1).slice(0, 7).map(n => (
              <button
                key={n}
                type="button"
                className={n === safePage ? 'on' : ''}
                aria-current={n === safePage ? 'page' : undefined}
                onClick={() => setPage(n)}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              disabled={safePage >= pageCount}
              aria-label="Next page"
              onClick={() => setPage(p => Math.min(pageCount, p + 1))}
            >
              ›
            </button>
          </div>
        </footer>
      </div>

      {newConfirmOpen && (
        <div
          className="swb-confirm-backdrop"
          role="presentation"
          onClick={() => setNewConfirmOpen(false)}
        >
          <div
            className="swb-confirm"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="swb-new-title"
            aria-describedby="swb-new-desc"
            onClick={e => e.stopPropagation()}
          >
            <h3 id="swb-new-title">Erase live board?</h3>
            <p id="swb-new-desc">
              Starting a new whiteboard will erase the current live board for both of you.
              Saved boards in your library are not affected.
            </p>
            <div className="swb-confirm-actions">
              <button
                type="button"
                className="swb-confirm-cancel"
                onClick={() => setNewConfirmOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="swb-confirm-ok"
                onClick={confirmNewBoard}
              >
                Erase & start blank
              </button>
            </div>
          </div>
        </div>
      )}

      {addOpen && (
        <div
          className="swb-confirm-backdrop"
          role="presentation"
          onClick={closeAddShared}
        >
          <div
            className="swb-confirm swb-add-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="swb-add-title"
            aria-describedby="swb-add-desc"
            onClick={e => e.stopPropagation()}
          >
            <h3 id="swb-add-title">Add shared whiteboard</h3>
            <p id="swb-add-desc">
              Paste the share link from Share on Our wall, or just the code.
            </p>
            <label className="swb-add-label" htmlFor="swb-add-input">
              Code or link
            </label>
            <input
              id="swb-add-input"
              ref={addInputRef}
              className="swb-add-input"
              type="text"
              value={addInput}
              onChange={(e) => {
                setAddInput(e.target.value);
                if (addError) setAddError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void submitAddShared();
                }
                if (e.key === 'Escape') closeAddShared();
              }}
              placeholder="e.g. A1B2C3D4E5 or paste full link"
              autoComplete="off"
              spellCheck={false}
              disabled={addBusy}
            />
            {addHint && <p className="swb-add-hint">{addHint}</p>}
            {addError && <p className="swb-add-error">{addError}</p>}
            <div className="swb-confirm-actions">
              <button
                type="button"
                className="swb-confirm-cancel"
                onClick={closeAddShared}
                disabled={addBusy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="swb-confirm-ok"
                onClick={() => { void submitAddShared(); }}
                disabled={addBusy || !addInput.trim()}
              >
                {addBusy ? 'Adding…' : 'Add to library'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
