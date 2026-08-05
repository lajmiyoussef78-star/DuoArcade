// src/lib/todos.js — shared couple todo board (lists + tasks).

import { CONFIG } from './config.js';
import { getSupabase } from './supabaseClient.js';

const localKey = code => 'duoarcade-todos-' + code;

export const URGENCY = { high: 0, medium: 1, low: 2 };

export const URGENCY_OPTS = [
  { id: 'high', label: 'High' },
  { id: 'medium', label: 'Medium' },
  { id: 'low', label: 'Low' },
];

export const CATEGORY_OPTS = [
  { id: 'Work', color: '#60A5FA' },
  { id: 'Study', color: '#A78BFA' },
  { id: 'Health', color: '#34D399' },
  { id: 'Personal', color: '#F472B6' },
  { id: 'Shopping', color: '#FBBF24' },
  { id: 'Duo', color: '#EC4899' },
];

export const SMART_LISTS = [
  { id: 'today', name: 'Today', icon: 'sun', smart: true },
  { id: 'week', name: 'This Week', icon: 'cal', smart: true },
  { id: 'completed', name: 'Completed', icon: 'check', smart: true },
  { id: 'trash', name: 'Trash', icon: 'trash', smart: true },
];

export const LIST_ICONS = ['list', 'book', 'dumbbell', 'heart', 'cart', 'plane', 'home', 'star'];

function startOfDay(ts = Date.now()) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function defaultDueAt(urgency = 'medium', from = new Date()) {
  const d = new Date(from);
  d.setSeconds(0, 0);
  d.setMilliseconds(0);
  if (urgency === 'high') {
    d.setHours(18, 0, 0, 0);
    if (d.getTime() < Date.now()) d.setHours(21, 0, 0, 0);
    return d.getTime();
  }
  if (urgency === 'medium') {
    d.setDate(d.getDate() + 1);
    d.setHours(18, 0, 0, 0);
    return d.getTime();
  }
  d.setDate(d.getDate() + 5);
  d.setHours(12, 0, 0, 0);
  return d.getTime();
}

export function resolveDueAt(item) {
  if (item?.dueAt && Number.isFinite(item.dueAt)) return item.dueAt;
  return defaultDueAt(item?.urgency || 'medium', item?.at ? new Date(item.at) : new Date());
}

export function dueBucket(item) {
  const due = resolveDueAt(item);
  const today = startOfDay();
  const tomorrow = today + 86400000;
  const weekEnd = today + 7 * 86400000;
  if (due < tomorrow) return 'today';
  if (due < tomorrow + 86400000) return 'tomorrow';
  if (due < weekEnd) return 'week';
  return 'later';
}

export function formatDueLabel(item, { short = false } = {}) {
  const due = resolveDueAt(item);
  const bucket = dueBucket(item);
  const d = new Date(due);
  if (short) {
    if (bucket === 'today') return 'Today';
    if (bucket === 'tomorrow') return 'Tomorrow';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  if (bucket === 'today' || bucket === 'tomorrow') {
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatCreatedAt(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (!Number.isFinite(d.getTime())) return '';
  const date = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${date} at ${time}`;
}

export function categoryColor(name) {
  return CATEGORY_OPTS.find(c => c.id === name)?.color || '#A78BFA';
}

export function defaultLists() {
  return [
    { id: 'inbox', name: 'Personal', icon: 'list', shared: false, owner: null },
    { id: 'duo', name: 'Duo Plans', icon: 'heart', shared: true, owner: null },
  ];
}

export function defaultPrivacy() {
  return {
    A: { shareMyLists: false },
    B: { shareMyLists: false },
  };
}

export function normalizePrivacy(raw) {
  const base = defaultPrivacy();
  if (!raw || typeof raw !== 'object') return base;
  for (const role of ['A', 'B']) {
    if (raw[role] && typeof raw[role] === 'object') {
      base[role] = { shareMyLists: !!raw[role].shareMyLists };
    }
  }
  return base;
}

export function normalizeList(list) {
  if (!list || typeof list !== 'object') return list;
  const shared = !!list.shared;
  const owner = shared
    ? null
    : (list.owner === 'A' || list.owner === 'B' ? list.owner : null);
  return { ...list, shared, owner };
}

/** Unpack lists column: plain array (legacy) or { lists, privacy, categories }. */
export function unpackListsColumn(raw) {
  if (Array.isArray(raw)) {
    return {
      lists: (raw.length ? raw : defaultLists()).map(normalizeList),
      privacy: defaultPrivacy(),
      categories: [],
    };
  }
  if (raw && typeof raw === 'object') {
    const lists = Array.isArray(raw.lists) && raw.lists.length
      ? raw.lists.map(normalizeList)
      : defaultLists().map(normalizeList);
    const categories = Array.isArray(raw.categories)
      ? raw.categories.map(c => String(c || '').trim()).filter(Boolean)
      : [];
    return { lists, privacy: normalizePrivacy(raw.privacy), categories };
  }
  return {
    lists: defaultLists().map(normalizeList),
    privacy: defaultPrivacy(),
    categories: [],
  };
}

export function packListsColumn(lists, privacy, categories = []) {
  const builtIn = new Set(CATEGORY_OPTS.map(c => c.id));
  const custom = (Array.isArray(categories) ? categories : [])
    .map(c => String(c || '').trim())
    .filter(c => c && !builtIn.has(c));
  return {
    lists: (Array.isArray(lists) ? lists : []).map(normalizeList),
    privacy: normalizePrivacy(privacy),
    categories: [...new Set(custom)],
  };
}

/** Normalize legacy array or v2 board object. */
export function normalizeBoard(raw) {
  if (Array.isArray(raw)) {
    return {
      lists: defaultLists().map(normalizeList),
      items: raw.map(normalizeItem),
      privacy: defaultPrivacy(),
      categories: [],
    };
  }
  if (raw && typeof raw === 'object') {
    const packed = unpackListsColumn(raw.lists);
    const lists = packed.lists;
    const privacy = raw.privacy != null
      ? normalizePrivacy(raw.privacy)
      : packed.privacy;
    const categories = Array.isArray(raw.categories)
      ? raw.categories.map(c => String(c || '').trim()).filter(Boolean)
      : packed.categories;
    const items = Array.isArray(raw.items) ? raw.items.map(normalizeItem) : [];
    return { lists, items, privacy, categories };
  }
  return {
    lists: defaultLists().map(normalizeList),
    items: [],
    privacy: defaultPrivacy(),
    categories: [],
  };
}

export function partnerRoleOf(role) {
  return role === 'B' ? 'A' : 'B';
}

export function myPersonalLists(lists, myRole) {
  return (lists || []).filter(l => !l.shared && l.owner === myRole);
}

export function partnerPersonalLists(lists, myRole) {
  const partner = partnerRoleOf(myRole);
  return (lists || []).filter(l => !l.shared && l.owner === partner);
}

export function sharedListsOf(lists) {
  return (lists || []).filter(l => l.shared);
}

export function visibleItemsFor(items, lists, viewerRole, privacy) {
  const ids = new Set(visibleListsFor(lists, viewerRole, privacy).map(l => l.id));
  return (items || []).filter(t => ids.has(t.listId || 'inbox'));
}

export function visibleListsFor(lists, viewerRole, privacy) {
  return (lists || []).filter(l => isListVisibleTo(l, viewerRole, privacy));
}

export function isListVisibleTo(list, viewerRole, privacy) {
  if (!list) return false;
  if (list.shared) return true;
  if (!list.owner) {
    // Legacy unowned personal: visible to both until claimed.
    return true;
  }
  if (list.owner === viewerRole) return true;
  return !!privacy?.[list.owner]?.shareMyLists;
}

/** Stamp ownership on my personal lists so the partner section can find them. */
export function claimPersonalListsForRole(lists, role) {
  if (role !== 'A' && role !== 'B') return lists || [];
  const rows = [...(lists || [])].map(normalizeList);
  const hasOwned = rows.some(l => !l.shared && l.owner === role);
  if (hasOwned) return rows;
  const unownedIdx = rows.findIndex(l => !l.shared && !l.owner);
  if (unownedIdx >= 0) {
    return rows.map((l, i) => (
      i === unownedIdx ? { ...l, owner: role, shared: false } : l
    ));
  }
  return [
    ...rows,
    {
      id: crypto.randomUUID(),
      name: 'Personal',
      icon: 'list',
      shared: false,
      owner: role,
    },
  ];
}

function normalizeItem(item) {
  if (!item || typeof item !== 'object') return item;
  return {
    ...item,
    listId: item.listId || 'inbox',
    category: item.category || '',
    starred: !!item.starred,
    trashed: !!item.trashed,
    subtasks: Array.isArray(item.subtasks) ? item.subtasks : [],
    comments: Array.isArray(item.comments) ? item.comments : [],
    attachments: Array.isArray(item.attachments) ? item.attachments : [],
    assignee: item.assignee || item.by,
  };
}

export function sortTodos(items) {
  return [...items].sort((a, b) => {
    if (!!a.done !== !!b.done) return a.done ? 1 : -1;
    if (!!a.starred !== !!b.starred) return a.starred ? -1 : 1;
    const ua = URGENCY[a.urgency] ?? 1;
    const ub = URGENCY[b.urgency] ?? 1;
    if (ua !== ub) return ua - ub;
    const da = resolveDueAt(a);
    const db = resolveDueAt(b);
    if (da !== db) return da - db;
    return (b.at || 0) - (a.at || 0);
  });
}

export function groupByPriority(items) {
  const groups = [
    { id: 'high', label: 'High Priority', items: [] },
    { id: 'medium', label: 'Medium Priority', items: [] },
    { id: 'low', label: 'Low Priority', items: [] },
  ];
  for (const item of items) {
    const id = URGENCY[item.urgency] != null ? item.urgency : 'medium';
    const g = groups.find(x => x.id === id) || groups[1];
    g.items.push(item);
  }
  return groups.filter(g => g.items.length > 0);
}

export function filterBySmartList(items, listId) {
  const active = items.filter(t => !t.trashed);
  if (listId === 'today') return active.filter(t => dueBucket(t) === 'today');
  if (listId === 'week') {
    return active.filter(t => (
      dueBucket(t) === 'today' || dueBucket(t) === 'tomorrow' || dueBucket(t) === 'week'
    ));
  }
  if (listId === 'completed') return active.filter(t => t.done);
  if (listId === 'trash') return items.filter(t => t.trashed);
  // Custom / named lists: keep completed on the list so the Completed tab can show them.
  return active.filter(t => (t.listId || 'inbox') === listId);
}

export function countForList(items, listId) {
  const rows = filterBySmartList(items, listId);
  if (listId === 'completed' || listId === 'trash') return rows.length;
  return rows.filter(t => !t.done).length;
}

export function newList({ name, icon = 'list', shared = false, owner = null }) {
  const isShared = !!shared;
  return {
    id: crypto.randomUUID(),
    name: (name || 'New list').trim() || 'New list',
    icon,
    shared: isShared,
    owner: isShared ? null : (owner === 'A' || owner === 'B' ? owner : null),
  };
}

export function newTodo({
  text, note, urgency, by, assignee, dueAt, listId, category, starred,
}) {
  const u = urgency || 'medium';
  return {
    id: crypto.randomUUID(),
    text: text.trim(),
    note: (note || '').trim(),
    urgency: u,
    by,
    assignee: assignee || by,
    dueAt: dueAt || defaultDueAt(u),
    listId: listId || 'inbox',
    category: category || '',
    starred: !!starred,
    trashed: false,
    subtasks: [],
    comments: [],
    attachments: [],
    done: false,
    at: Date.now(),
  };
}

export function newSubtask(text) {
  return {
    id: crypto.randomUUID(),
    text: String(text || '').trim(),
    done: false,
  };
}

async function getClient() {
  return getSupabase();
}

function configured() {
  return CONFIG.SUPABASE_URL && !CONFIG.SUPABASE_URL.includes('YOUR-PROJECT');
}

export async function loadTodos(code) {
  if (!configured()) {
    try {
      return normalizeBoard(JSON.parse(localStorage.getItem(localKey(code)) || '[]'));
    } catch {
      return normalizeBoard([]);
    }
  }
  const supabase = await getClient();
  const { data, error } = await supabase
    .from('duo_todos')
    .select('items, lists')
    .eq('duo_code', code)
    .maybeSingle();
  if (error) throw new Error(error.message);
  // Legacy: items column may hold a board object or a plain array.
  if (data?.items && !Array.isArray(data.items) && typeof data.items === 'object') {
    return normalizeBoard(data.items);
  }
  return normalizeBoard({
    lists: data?.lists,
    items: Array.isArray(data?.items) ? data.items : [],
  });
}

export async function saveTodos(code, board) {
  const payload = normalizeBoard(board);
  if (!configured()) {
    localStorage.setItem(localKey(code), JSON.stringify(payload));
    return true;
  }
  const supabase = await getClient();
  const { data, error } = await supabase.rpc('save_duo_todos', {
    p_duo_code: code,
    p_items: payload.items,
    p_lists: packListsColumn(payload.lists, payload.privacy, payload.categories),
  });
  if (error) throw new Error(error.message);
  return data === true;
}

/** Usernames for duo seats A/B (falls back to empty if RLS/profile missing). */
export async function getDuoMemberUsernames(code) {
  if (!configured() || !code) return { username_a: null, username_b: null };
  try {
    const supabase = await getClient();
    const { data: duo, error } = await supabase
      .from('duos')
      .select('member_a, member_b')
      .eq('code', code)
      .maybeSingle();
    if (error || !duo) return { username_a: null, username_b: null };
    const ids = [duo.member_a, duo.member_b].filter(Boolean);
    if (!ids.length) return { username_a: null, username_b: null };
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username')
      .in('id', ids);
    const byId = new Map((profiles || []).map(p => [p.id, p.username || null]));
    return {
      username_a: duo.member_a ? (byId.get(duo.member_a) || null) : null,
      username_b: duo.member_b ? (byId.get(duo.member_b) || null) : null,
    };
  } catch {
    return { username_a: null, username_b: null };
  }
}

export async function todosChannel(code) {
  if (!configured()) {
    let cb = () => {};
    const bc = new BroadcastChannel('duoarcade-todos-' + code);
    bc.onmessage = e => cb(e.data);
    return {
      send: payload => bc.postMessage(payload),
      on: fn => { cb = fn; },
      close: () => bc.close(),
    };
  }
  const supabase = await getClient();
  let cb = () => {};
  const ch = supabase
    .channel('todos-' + code, { config: { broadcast: { self: false } } })
    .on('broadcast', { event: 'm' }, p => cb(p.payload))
    .subscribe();
  return {
    send: payload => ch.send({ type: 'broadcast', event: 'm', payload }),
    on: fn => { cb = fn; },
    close: () => supabase.removeChannel(ch),
  };
}
