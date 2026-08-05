// src/arcade/TodoShelf.jsx — three-column duo task board.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Avatar } from './avatars.jsx';
import { getDuoAvatars } from '../lib/avatars.js';
import {
  loadTodos,
  saveTodos,
  todosChannel,
  sortTodos,
  newTodo,
  newList,
  newSubtask,
  filterBySmartList,
  countForList,
  groupByPriority,
  formatDueLabel,
  formatCreatedAt,
  categoryColor,
  defaultDueAt,
  defaultPrivacy,
  myPersonalLists,
  partnerPersonalLists,
  sharedListsOf,
  visibleItemsFor,
  partnerRoleOf,
  claimPersonalListsForRole,
  URGENCY_OPTS,
  CATEGORY_OPTS,
  SMART_LISTS,
  LIST_ICONS,
} from '../lib/todos.js';
import '../styles/todos.css';

const STATUS_TABS = [
  { id: 'pending', label: 'Pending' },
  { id: 'completed', label: 'Completed' },
];

const SORTS = [
  { id: 'priority', label: 'Priority' },
  { id: 'due', label: 'Due date' },
  { id: 'title', label: 'Title' },
];

const DUE_TIME_PRESETS = [
  { id: '09:00', label: 'Morning', hint: '9:00 AM' },
  { id: '12:00', label: 'Noon', hint: '12:00 PM' },
  { id: '18:00', label: 'Evening', hint: '6:00 PM' },
  { id: '21:00', label: 'Night', hint: '9:00 PM' },
];

function pad2(n) {
  return String(n).padStart(2, '0');
}

function toDatePart(ts) {
  const d = new Date(ts);
  if (!Number.isFinite(d.getTime())) return '';
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function toTimePart(ts) {
  const d = new Date(ts);
  if (!Number.isFinite(d.getTime())) return '18:00';
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function combineDue(datePart, timePart) {
  if (!datePart) return null;
  const t = timePart || '18:00';
  const ms = new Date(`${datePart}T${t}`).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function shiftDate(days, from = new Date()) {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return toDatePart(d.getTime());
}

function matchDayPreset(datePart) {
  if (!datePart) return '';
  if (datePart === shiftDate(0)) return 'today';
  if (datePart === shiftDate(1)) return 'tomorrow';
  if (datePart === shiftDate(7)) return 'week';
  return 'custom';
}

function formatDueFriendly(datePart, timePart) {
  if (!datePart) return 'No due date';
  const ms = combineDue(datePart, timePart || '18:00');
  if (!ms) return 'No due date';
  const d = new Date(ms);
  const day = matchDayPreset(datePart);
  const dayLabel = day === 'today'
    ? 'Today'
    : day === 'tomorrow'
      ? 'Tomorrow'
      : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const timeLabel = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${dayLabel} · ${timeLabel}`;
}

function ListIcon({ id }) {
  const props = { viewBox: '0 0 24 24', width: 16, height: 16, fill: 'none', 'aria-hidden': true };
  switch (id) {
    case 'sun':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.7" />
          <path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.4 1.4M17.6 17.6 19 19M19 5l-1.4 1.4M6.4 17.6 5 19" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      );
    case 'cal':
      return (
        <svg {...props}>
          <rect x="3.5" y="5" width="17" height="15" rx="2" stroke="currentColor" strokeWidth="1.7" />
          <path d="M8 3.5v3M16 3.5v3M3.5 9.5h17" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      );
    case 'check':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.7" />
          <path d="M8.5 12.2 11 14.7 15.5 9.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'trash':
      return (
        <svg {...props}>
          <path d="M5 8h14M9 8V6.5A1.5 1.5 0 0 1 10.5 5h3A1.5 1.5 0 0 1 15 6.5V8M10 11v5M14 11v5M7 8l1 11a1.5 1.5 0 0 0 1.5 1.4h5A1.5 1.5 0 0 0 16 19l1-11" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'book':
      return (
        <svg {...props}>
          <path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v16H7.5A2.5 2.5 0 0 0 5 21.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        </svg>
      );
    case 'dumbbell':
      return (
        <svg {...props}>
          <path d="M6 9v6M18 9v6M8.5 7v10M15.5 7v10M8.5 12h7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      );
    case 'heart':
      return (
        <svg {...props}>
          <path d="M12 19s-7-4.4-7-9.2A3.8 3.8 0 0 1 12 7a3.8 3.8 0 0 1 7 2.8C19 14.6 12 19 12 19Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        </svg>
      );
    case 'cart':
      return (
        <svg {...props}>
          <path d="M4 5h2l2.2 10.2a1.5 1.5 0 0 0 1.5 1.2H17a1.5 1.5 0 0 0 1.5-1.2L20 8H7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="10" cy="20" r="1.2" fill="currentColor" />
          <circle cx="17" cy="20" r="1.2" fill="currentColor" />
        </svg>
      );
    case 'plane':
      return (
        <svg {...props}>
          <path d="M21 4 4 11.5l6.2 2.3L16 8l-3.8 6.2L14.5 20 21 4Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        </svg>
      );
    case 'home':
      return (
        <svg {...props}>
          <path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-8.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        </svg>
      );
    case 'star':
      return (
        <svg {...props}>
          <path d="m12 3.5 2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 15.8 7.2 18.4l.9-5.4L4.2 9.2l5.4-.8L12 3.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        </svg>
      );
    default:
      return (
        <svg {...props}>
          <path d="M8 6h12M8 12h12M8 18h12M4.5 6h.01M4.5 12h.01M4.5 18h.01" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      );
  }
}

function FlagIcon({ tone }) {
  const color = tone === 'high' ? '#F87171' : tone === 'low' ? '#34D399' : '#FBBF24';
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <path d="M5 21V4h9l-1.2 3.2L17 10.5H5" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function initials(name) {
  const s = String(name || '?').trim();
  return (s[0] || '?').toUpperCase();
}

export default function TodoShelf({ code, myRole, duo }) {
  const [lists, setLists] = useState([]);
  const [items, setItems] = useState([]);
  const [privacy, setPrivacy] = useState(defaultPrivacy);
  const [categories, setCategories] = useState([]);
  const [status, setStatus] = useState('');
  const [activeList, setActiveList] = useState('today');
  const [statusTab, setStatusTab] = useState('pending');
  const [sort, setSort] = useState('priority');
  const [sortOpen, setSortOpen] = useState(false);
  const [listMenuId, setListMenuId] = useState(null);
  const [collapsed, setCollapsed] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [avatars, setAvatars] = useState({ avatar_a: null, avatar_b: null });

  const [modalOpen, setModalOpen] = useState(false);
  const [listModalOpen, setListModalOpen] = useState(false);
  const [editingListId, setEditingListId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  const [urgency, setUrgency] = useState('medium');
  const [assignee, setAssignee] = useState(myRole || 'A');
  const [category, setCategory] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('18:00');
  const [listId, setListId] = useState('inbox');
  const [newListName, setNewListName] = useState('');
  const [newListIcon, setNewListIcon] = useState('list');
  const [newListShared, setNewListShared] = useState(false);
  const [saving, setSaving] = useState(false);
  const [subdraft, setSubdraft] = useState('');
  const [comment, setComment] = useState('');

  const channelRef = useRef(null);
  const savingRef = useRef(false);
  const claimedRef = useRef(false);
  const sortRef = useRef(null);
  const listsMenuRef = useRef(null);
  const titleRef = useRef(null);

  const nameOf = useCallback(
    (role) => (role === 'A' ? duo?.nameA : duo?.nameB) || (role === 'A' ? 'Partner A' : 'Partner B'),
    [duo],
  );

  const avatarOf = useCallback(
    (role) => (role === 'B' ? avatars.avatar_b : avatars.avatar_a),
    [avatars],
  );

  const persist = useCallback(async (nextLists, nextItems, nextPrivacy = privacy, nextCategories = categories, { broadcast = true } = {}) => {
    const board = {
      lists: nextLists,
      items: sortTodos(nextItems),
      privacy: nextPrivacy || defaultPrivacy(),
      categories: nextCategories || [],
    };
    setLists(board.lists);
    setItems(board.items);
    setPrivacy(board.privacy);
    setCategories(board.categories);
    if (broadcast) channelRef.current?.send({ k: 'sync', board });
    try {
      savingRef.current = true;
      await saveTodos(code, board);
      setStatus('');
    } catch (e) {
      setStatus(e.message || 'Could not save');
      window.setTimeout(() => setStatus(''), 4000);
    } finally {
      savingRef.current = false;
    }
  }, [code, privacy, categories]);

  useEffect(() => {
    let alive = true;
    claimedRef.current = false;
    setStatus('');
    (async () => {
      try {
        const board = await loadTodos(code);
        if (!alive) return;
        setLists(board.lists);
        setItems(sortTodos(board.items));
        setPrivacy(board.privacy || defaultPrivacy());
        setCategories(board.categories || []);
        setStatus('');
      } catch { /* empty is fine */ }

      const ch = await todosChannel(code);
      if (!alive) { ch.close(); return; }
      channelRef.current = ch;
      ch.on((msg) => {
        if (!alive || savingRef.current || msg.k !== 'sync') return;
        if (msg.board) {
          setLists(msg.board.lists || []);
          setItems(sortTodos(msg.board.items || []));
          if (msg.board.privacy) setPrivacy(msg.board.privacy);
          if (msg.board.categories) setCategories(msg.board.categories);
        } else if (Array.isArray(msg.items)) {
          setItems(sortTodos(msg.items));
        }
      });
    })();
    return () => {
      alive = false;
      channelRef.current?.close();
      channelRef.current = null;
    };
  }, [code]);

  // Each seat needs an owned Personal list so partner sharing can find it.
  useEffect(() => {
    if (!myRole || !lists.length || claimedRef.current) return;
    const next = claimPersonalListsForRole(lists, myRole);
    const changed = JSON.stringify(next) !== JSON.stringify(lists);
    if (!changed) {
      claimedRef.current = true;
      return;
    }
    claimedRef.current = true;
    void persist(next, items, privacy, categories);
  }, [myRole, lists, items, privacy, categories, persist]);

  const setShareMyLists = async (shareMyLists) => {
    const role = myRole || 'A';
    const nextPrivacy = {
      ...privacy,
      [role]: { ...privacy[role], shareMyLists: !!shareMyLists },
    };
    // Always claim/create my Personal so the partner section has something to show.
    const nextLists = claimPersonalListsForRole(lists, role);
    await persist(nextLists, items, nextPrivacy, categories);
  };

  useEffect(() => {
    if (!code) return undefined;
    let alive = true;
    getDuoAvatars(code)
      .then((data) => { if (alive) setAvatars(data || { avatar_a: null, avatar_b: null }); })
      .catch(() => {});
    return () => { alive = false; };
  }, [code]);

  useEffect(() => {
    if (!sortOpen) return undefined;
    const onDoc = (e) => {
      if (sortRef.current && !sortRef.current.contains(e.target)) setSortOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [sortOpen]);

  useEffect(() => {
    if (!listMenuId) return undefined;
    const onDoc = (e) => {
      if (listsMenuRef.current && !listsMenuRef.current.contains(e.target)) setListMenuId(null);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [listMenuId]);

  const toLocalInput = (ts) => {
    if (!ts) return { date: '', time: '18:00' };
    return { date: toDatePart(ts), time: toTimePart(ts) };
  };

  const setDueFromTs = (ts) => {
    const parts = toLocalInput(ts);
    setDueDate(parts.date);
    setDueTime(parts.time);
  };

  const dueSummary = formatDueFriendly(dueDate, dueTime);

  const partnerRole = partnerRoleOf(myRole || 'A');
  const partnerName = nameOf(partnerRole);
  const partnerSectionLabel = `${partnerName}'s Lists`;

  const iShareMyLists = !!privacy?.[myRole || 'A']?.shareMyLists;
  const partnerSharesLists = !!privacy?.[partnerRole]?.shareMyLists;

  const myLists = useMemo(
    () => myPersonalLists(lists, myRole || 'A'),
    [lists, myRole],
  );
  const partnerLists = useMemo(
    () => partnerPersonalLists(lists, myRole || 'A'),
    [lists, myRole],
  );
  const sharedLists = useMemo(() => sharedListsOf(lists), [lists]);
  const writableLists = useMemo(
    () => [...myLists, ...sharedLists],
    [myLists, sharedLists],
  );

  const categoryOptions = useMemo(() => {
    const builtIn = CATEGORY_OPTS.map(c => c.id);
    const fromItems = items.map(t => t.category).filter(Boolean);
    return [...new Set([...builtIn, ...categories, ...fromItems])];
  }, [categories, items]);

  const addCustomCategory = () => {
    const name = newCategoryName.trim();
    if (!name) return;
    const next = [...new Set([...categories, name])];
    setCategories(next);
    setCategory(name);
    setNewCategoryName('');
    setAddingCategory(false);
    void persist(lists, items, privacy, next);
  };

  useEffect(() => {
    if (partnerSharesLists) return;
    if (partnerLists.some(l => l.id === activeList)) setActiveList('today');
  }, [partnerSharesLists, partnerLists, activeList]);

  const visibleItems = useMemo(
    () => visibleItemsFor(items, lists, myRole || 'A', privacy),
    [items, lists, myRole, privacy],
  );

  const activeMeta = useMemo(() => {
    const smart = SMART_LISTS.find(l => l.id === activeList);
    if (smart) return smart;
    return lists.find(l => l.id === activeList) || { id: activeList, name: 'List', icon: 'list' };
  }, [activeList, lists]);

  const listTasks = useMemo(() => {
    let rows = filterBySmartList(visibleItems, activeList);
    if (activeList === 'trash') {
      /* trash keeps everything returned */
    } else if (activeList === 'completed' || statusTab === 'completed') {
      rows = rows.filter(t => t.done);
    } else {
      // Pending: only open tasks — completed live in the Completed tab.
      rows = rows.filter(t => !t.done);
    }
    rows = [...rows];
    if (sort === 'title') rows.sort((a, b) => (a.text || '').localeCompare(b.text || ''));
    else if (sort === 'due') rows.sort((a, b) => (a.dueAt || 0) - (b.dueAt || 0));
    else rows = sortTodos(rows);
    return rows;
  }, [visibleItems, activeList, statusTab, sort]);

  const openTasks = useMemo(() => listTasks.filter(t => !t.done && !t.trashed), [listTasks]);
  const doneTasks = useMemo(() => {
    if (statusTab === 'completed' || activeList === 'completed') {
      return listTasks.filter(t => t.done && !t.trashed);
    }
    return [];
  }, [listTasks, statusTab, activeList]);
  const priorityGroups = useMemo(() => groupByPriority(openTasks), [openTasks]);

  const completedCount = useMemo(() => {
    if (activeList === 'completed' || activeList === 'trash') return 0;
    return filterBySmartList(visibleItems, activeList).filter(t => t.done).length;
  }, [visibleItems, activeList]);

  const selected = useMemo(
    () => visibleItems.find(t => t.id === selectedId) || null,
    [visibleItems, selectedId],
  );

  const selectedIndex = useMemo(() => {
    if (!selectedId) return -1;
    return listTasks.findIndex(t => t.id === selectedId);
  }, [listTasks, selectedId]);

  const openAddTask = () => {
    const onWritable = writableLists.some(l => l.id === activeList);
    const targetList = onWritable
      ? activeList
      : (writableLists[0]?.id || 'inbox');
    setEditingId(null);
    setText('');
    setNote('');
    setUrgency('medium');
    setAssignee(myRole || 'A');
    setCategory('');
    setAddingCategory(false);
    setNewCategoryName('');
    setListId(targetList);
    setDueFromTs(defaultDueAt('medium'));
    setModalOpen(true);
    window.setTimeout(() => titleRef.current?.focus(), 40);
  };

  const openEditTask = (item) => {
    setEditingId(item.id);
    setText(item.text || '');
    setNote(item.note || '');
    setUrgency(item.urgency || 'medium');
    setAssignee(item.assignee || item.by || myRole || 'A');
    setCategory(item.category || '');
    setAddingCategory(false);
    setNewCategoryName('');
    const currentList = item.listId || 'inbox';
    setListId(
      writableLists.some(l => l.id === currentList)
        ? currentList
        : (writableLists[0]?.id || currentList),
    );
    setDueFromTs(item.dueAt || defaultDueAt(item.urgency || 'medium'));
    setModalOpen(true);
  };

  const submitTask = async (e) => {
    e?.preventDefault?.();
    if (!text.trim() || saving) return;
    const allowed = new Set(writableLists.map(l => l.id));
    if (!allowed.has(listId)) {
      setStatus('You can only add tasks to your lists or shared lists.');
      window.setTimeout(() => setStatus(''), 4000);
      return;
    }
    setSaving(true);
    try {
      const dueAt = combineDue(dueDate, dueTime) ?? defaultDueAt(urgency);
      if (editingId) {
        await persist(lists, items.map(t => (
          t.id === editingId
            ? {
                ...t,
                text: text.trim(),
                note: note.trim(),
                urgency,
                assignee,
                category,
                listId,
                dueAt,
              }
            : t
        )));
      } else {
        const item = newTodo({
          text,
          note,
          urgency,
          by: myRole,
          assignee,
          category,
          listId,
          dueAt,
        });
        await persist(lists, [...items, item]);
        setSelectedId(item.id);
        setDetailOpen(true);
      }
      setModalOpen(false);
      setEditingId(null);
    } finally {
      setSaving(false);
    }
  };

  const submitList = async (e) => {
    e?.preventDefault?.();
    if (!newListName.trim() || saving) return;
    setSaving(true);
    try {
      if (editingListId) {
        const next = lists.map(l => (
          l.id === editingListId
            ? { ...l, name: newListName.trim() || l.name, icon: newListIcon }
            : l
        ));
        await persist(next, items);
      } else {
        const list = newList({
          name: newListName,
          icon: newListIcon,
          shared: newListShared,
          owner: newListShared ? null : (myRole || 'A'),
        });
        await persist([...lists, list], items);
        setActiveList(list.id);
      }
      setListModalOpen(false);
      setEditingListId(null);
      setNewListName('');
      setNewListIcon('list');
      setNewListShared(false);
    } finally {
      setSaving(false);
    }
  };

  const openRenameList = (list) => {
    setListMenuId(null);
    setEditingListId(list.id);
    setNewListName(list.name || '');
    setNewListIcon(list.icon || 'list');
    setNewListShared(!!list.shared);
    setListModalOpen(true);
  };

  const openCreateList = () => {
    setEditingListId(null);
    setNewListName('');
    setNewListIcon('list');
    setNewListShared(false);
    setListModalOpen(true);
  };

  const deleteList = async (id) => {
    setListMenuId(null);
    const fallback = writableLists.find(l => l.id !== id)?.id || null;
    const nextLists = lists.filter(l => l.id !== id);
    const nextItems = items.map(t => {
      if (t.listId !== id) return t;
      if (fallback) return { ...t, listId: fallback };
      return { ...t, trashed: true };
    });
    await persist(nextLists, nextItems);
    if (activeList === id) setActiveList('today');
    if (selected && selected.listId === id) {
      setSelectedId(null);
      setDetailOpen(false);
    }
  };

  const setListShared = async (id, shared) => {
    setListMenuId(null);
    const next = lists.map(l => {
      if (l.id !== id) return l;
      if (shared) return { ...l, shared: true, owner: null };
      return { ...l, shared: false, owner: myRole || 'A' };
    });
    await persist(next, items);
  };

  const patchItem = async (id, patch) => {
    await persist(lists, items.map(t => (t.id === id ? { ...t, ...patch } : t)));
  };

  const toggleDone = async (id) => {
    const item = items.find(t => t.id === id);
    if (!item) return;
    await patchItem(id, { done: !item.done });
  };

  const toggleStar = async (id) => {
    const item = items.find(t => t.id === id);
    if (!item) return;
    await patchItem(id, { starred: !item.starred });
  };

  const trashItem = async (id) => {
    await patchItem(id, { trashed: true, done: false });
    if (selectedId === id) {
      setSelectedId(null);
      setDetailOpen(false);
    }
  };

  const restoreItem = async (id) => {
    await patchItem(id, { trashed: false });
  };

  const deleteForever = async (id) => {
    await persist(lists, items.filter(t => t.id !== id));
    if (selectedId === id) {
      setSelectedId(null);
      setDetailOpen(false);
    }
  };

  const selectTask = (id) => {
    setSelectedId(id);
    setDetailOpen(true);
  };

  const closeDetail = () => {
    setDetailOpen(false);
  };

  const goSelected = (dir) => {
    if (!listTasks.length) return;
    const idx = selectedIndex < 0 ? 0 : selectedIndex;
    const next = Math.max(0, Math.min(listTasks.length - 1, idx + dir));
    setSelectedId(listTasks[next].id);
    setDetailOpen(true);
  };

  const addSubtask = async () => {
    if (!selected || !subdraft.trim()) return;
    const current = selected.subtasks || [];
    if (current.length >= 15) return;
    const sub = newSubtask(subdraft);
    setSubdraft('');
    await patchItem(selected.id, { subtasks: [...current, sub] });
  };

  const toggleSubtask = async (subId) => {
    if (!selected) return;
    await patchItem(selected.id, {
      subtasks: (selected.subtasks || []).map(s => (
        s.id === subId ? { ...s, done: !s.done } : s
      )),
    });
  };

  const deleteSubtask = async (subId) => {
    if (!selected) return;
    await patchItem(selected.id, {
      subtasks: (selected.subtasks || []).filter(s => s.id !== subId),
    });
  };

  const addComment = async () => {
    if (!selected || !comment.trim()) return;
    const entry = {
      id: crypto.randomUUID(),
      text: comment.trim(),
      by: myRole,
      at: Date.now(),
    };
    setComment('');
    await patchItem(selected.id, { comments: [...(selected.comments || []), entry] });
  };

  const toggleCollapse = (id) => {
    setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const renderManagedList = (l, { menu = 'owner' } = {}) => {
    const menuOpen = listMenuId === l.id;
    const canMenu = menu === 'owner' || menu === 'shared';
    return (
      <div
        key={l.id}
        className={'todo-list-item' + (activeList === l.id ? ' on' : '') + (menuOpen ? ' menu-open' : '')}
        ref={menuOpen ? listsMenuRef : undefined}
      >
        <button
          type="button"
          className="todo-list-row"
          onClick={() => { setActiveList(l.id); setStatusTab('pending'); setListMenuId(null); }}
        >
          <span className="todo-list-ico"><ListIcon id={l.icon} /></span>
          <span className="todo-list-name">{l.name}</span>
        </button>
        {canMenu ? (
          <button
            type="button"
            className="todo-list-more"
            aria-label="List options"
            aria-expanded={menuOpen}
            onClick={(e) => {
              e.stopPropagation();
              setListMenuId(menuOpen ? null : l.id);
            }}
          >
            ⋯
          </button>
        ) : (
          <span className="todo-list-more-spacer" aria-hidden="true" />
        )}
        {l.shared ? (
          <span className="todo-avs tiny">
            <Avatar id={avatars.avatar_a} fallback={initials(nameOf('A'))} size={16} />
            <Avatar id={avatars.avatar_b} fallback={initials(nameOf('B'))} size={16} />
          </span>
        ) : (
          <span className="todo-list-count">{countForList(visibleItems, l.id)}</span>
        )}
        {menuOpen && canMenu && (
          <div className="todo-list-menu" role="menu">
            <button type="button" role="menuitem" onClick={() => openRenameList(l)}>
              Edit
            </button>
            {l.shared ? (
              <button type="button" role="menuitem" onClick={() => { void setListShared(l.id, false); }}>
                Move to My Lists
              </button>
            ) : (
              <button type="button" role="menuitem" onClick={() => { void setListShared(l.id, true); }}>
                Move to Shared Lists
              </button>
            )}
            <button type="button" role="menuitem" className="danger" onClick={() => { void deleteList(l.id); }}>
              Delete
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderTaskRow = (item) => (
    <article
      key={item.id}
      className={'todo-task' + (item.done ? ' is-done' : '') + (selectedId === item.id && detailOpen ? ' is-selected' : '')}
      onClick={() => selectTask(item.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectTask(item.id);
        }
      }}
    >
      <button
        type="button"
        className={'todo-check' + (item.done ? ' on' : '')}
        aria-label={item.done ? 'Mark incomplete' : 'Mark complete'}
        onClick={(e) => { e.stopPropagation(); void toggleDone(item.id); }}
      />
      <div className="todo-task-main">
        <div className="todo-task-top">
          <span className={'todo-task-title' + (item.done ? ' done-text' : '')}>{item.text}</span>
          {item.category ? (
            <span className="todo-cat" style={{ '--cat': categoryColor(item.category) }}>{item.category}</span>
          ) : null}
        </div>
        <div className="todo-task-meta">
          <span className="todo-due-line">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" aria-hidden="true">
              <rect x="3.5" y="5" width="17" height="15" rx="2" stroke="currentColor" strokeWidth="1.6" />
              <path d="M8 3.5v3M16 3.5v3M3.5 9.5h17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            {formatDueLabel(item, { short: true })}
          </span>
          <span className="todo-avs" aria-label="Assignees">
            <Avatar id={avatarOf(item.assignee || item.by)} fallback={initials(nameOf(item.assignee || item.by))} size={18} />
          </span>
        </div>
      </div>
      <button
        type="button"
        className={'todo-star' + (item.starred ? ' on' : '')}
        aria-label={item.starred ? 'Unstar' : 'Star'}
        onClick={(e) => { e.stopPropagation(); void toggleStar(item.id); }}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill={item.starred ? 'currentColor' : 'none'} aria-hidden="true">
          <path d="m12 3.5 2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 15.8 7.2 18.4l.9-5.4L4.2 9.2l5.4-.8L12 3.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      </button>
    </article>
  );

  const subDone = selected ? (selected.subtasks || []).filter(s => s.done).length : 0;
  const subTotal = selected ? (selected.subtasks || []).length : 0;
  const subPct = subTotal ? Math.round((subDone / subTotal) * 100) : 0;
  const showEmptyDone = activeList === 'today'
    && statusTab === 'pending'
    && openTasks.length === 0
    && completedCount > 0;

  return (
    <div className={'todo-page wb-embed' + (detailOpen && selected ? ' has-detail' : '')}>
      {/* Column 1 — lists */}
      <aside className="todo-lists">
        <div className="todo-lists-head">
          <div>
            <h2>To-Do List</h2>
            <p>Organize tasks, crush goals, together.</p>
          </div>
          <div className="todo-lists-head-actions">
            <button type="button" className="todo-icon-btn" aria-label="New list" onClick={openCreateList}>
              +
            </button>
          </div>
        </div>

        <div className="todo-lists-scroll">
          <div className="todo-lists-section">
            <div className="todo-lists-label">My Lists</div>
            {SMART_LISTS.filter(s => s.id !== 'completed' && s.id !== 'trash').map(l => (
              <button
                key={l.id}
                type="button"
                className={'todo-list-row' + (activeList === l.id ? ' on' : '')}
                onClick={() => { setActiveList(l.id); setStatusTab('pending'); }}
              >
                <span className="todo-list-ico"><ListIcon id={l.icon} /></span>
                <span className="todo-list-name">{l.name}</span>
                <span className="todo-list-count">{countForList(visibleItems, l.id)}</span>
              </button>
            ))}
            {myLists.map(l => renderManagedList(l, { menu: 'owner' }))}
            {SMART_LISTS.filter(s => s.id === 'completed' || s.id === 'trash').map(l => (
              <button
                key={l.id}
                type="button"
                className={'todo-list-row' + (activeList === l.id ? ' on' : '')}
                onClick={() => { setActiveList(l.id); setStatusTab('pending'); }}
              >
                <span className="todo-list-ico"><ListIcon id={l.icon} /></span>
                <span className="todo-list-name">{l.name}</span>
                <span className="todo-list-count">{countForList(visibleItems, l.id)}</span>
              </button>
            ))}
            <label className="todo-share-toggle">
              <input
                type="checkbox"
                checked={iShareMyLists}
                onChange={(e) => { void setShareMyLists(e.target.checked); }}
              />
              <span>Let {partnerName} see my lists</span>
            </label>
          </div>

          <div className="todo-lists-section">
            <div className="todo-lists-label">{partnerSectionLabel}</div>
            {!partnerSharesLists ? (
              <div className="todo-lists-empty">Not shared with you yet.</div>
            ) : partnerLists.length === 0 ? (
              <div className="todo-lists-empty">No lists yet.</div>
            ) : partnerLists.map(l => renderManagedList(l, { menu: 'none' }))}
          </div>

          <div className="todo-lists-section">
            <div className="todo-lists-label">Shared Lists</div>
            {sharedLists.length === 0 ? (
              <div className="todo-lists-empty">No shared lists yet.</div>
            ) : sharedLists.map(l => renderManagedList(l, { menu: 'shared' }))}
          </div>
        </div>
      </aside>

      {/* Column 2 — tasks */}
      <section className="todo-center">
        <header className="todo-center-head">
          <div className="todo-center-title">
            <div>
              <h3>{activeMeta.name}</h3>
              <p>{listTasks.length} task{listTasks.length === 1 ? '' : 's'}</p>
            </div>
          </div>
          <button type="button" className="todo-add" onClick={openAddTask}>
            <span aria-hidden="true">+</span> Add Task
          </button>
        </header>

        <div className="todo-center-toolbar">
          <div className="todo-status-tabs" role="tablist">
            {STATUS_TABS.map(t => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={statusTab === t.id}
                className={'todo-tab' + (statusTab === t.id ? ' on' : '')}
                onClick={() => setStatusTab(t.id)}
              >
                {t.label}
                {t.id === 'completed' && completedCount > 0 ? (
                  <span className="todo-tab-count">{completedCount}</span>
                ) : null}
              </button>
            ))}
          </div>
          <div className="todo-center-tools">
            <div className="todo-sort" ref={sortRef}>
              <button type="button" className="todo-sort-btn" onClick={() => setSortOpen(v => !v)}>
                Sort: {SORTS.find(s => s.id === sort)?.label || 'Priority'}
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true">
                  <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {sortOpen && (
                <div className="todo-sort-menu">
                  {SORTS.map(s => (
                    <button
                      key={s.id}
                      type="button"
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

        <div className="todo-center-scroll">
          {showEmptyDone ? (
            <div className="todo-empty-hero">
              <div className="todo-empty-art" aria-hidden="true">🎉</div>
              <h4>All done for today! 🎉</h4>
              <p>Take a break and play something together.</p>
            </div>
          ) : listTasks.length === 0 ? (
            <div className="todo-empty">
              {statusTab === 'completed'
                ? 'No completed tasks in this list yet.'
                : 'Nothing here yet. Add your first task.'}
            </div>
          ) : (
            <>
              {activeList !== 'trash' && statusTab !== 'completed' && activeList !== 'completed' && priorityGroups.map(g => (
                <section key={g.id} className="todo-pri-group">
                  <button
                    type="button"
                    className={'todo-pri-head ' + g.id}
                    onClick={() => toggleCollapse(g.id)}
                    aria-expanded={!collapsed[g.id]}
                  >
                    <svg className={'todo-chev' + (collapsed[g.id] ? '' : ' open')} viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true">
                      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <FlagIcon tone={g.id} />
                    <span>{g.label}</span>
                    <span className="todo-pri-count">{g.items.length}</span>
                  </button>
                  {!collapsed[g.id] && <div className="todo-task-list">{g.items.map(renderTaskRow)}</div>}
                </section>
              ))}

              {(statusTab === 'completed' || activeList === 'completed') && (
                <section className="todo-pri-group">
                  <div className="todo-pri-head static">
                    <ListIcon id="check" />
                    <span>Completed</span>
                    <span className="todo-pri-count">{doneTasks.length}</span>
                  </div>
                  <div className="todo-task-list">
                    {doneTasks.map(renderTaskRow)}
                  </div>
                </section>
              )}

              {activeList === 'trash' && (
                <div className="todo-task-list">
                  {listTasks.map(item => (
                    <article key={item.id} className="todo-task is-trash">
                      <div className="todo-task-main">
                        <div className="todo-task-top">
                          <span className="todo-task-title">{item.text}</span>
                        </div>
                      </div>
                      <button type="button" className="todo-mini" onClick={() => { void restoreItem(item.id); }}>Restore</button>
                      <button type="button" className="todo-mini danger" onClick={() => { void deleteForever(item.id); }}>Delete</button>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
          {status ? (
            <div className="todo-status" role="status">
              <span>{status}</span>
              <button type="button" className="todo-status-dismiss" aria-label="Dismiss" onClick={() => setStatus('')}>
                ×
              </button>
            </div>
          ) : null}
        </div>
      </section>

      {/* Column 3 — detail */}
      {detailOpen && selected && (
        <aside className="todo-detail">
          <div className="todo-detail-bar">
            <button type="button" className="todo-icon-btn" aria-label="Close" onClick={closeDetail}>×</button>
            <div className="todo-detail-pager">
              <button type="button" className="todo-icon-btn" aria-label="Previous" disabled={selectedIndex <= 0} onClick={() => goSelected(-1)}>‹</button>
              <span>{selectedIndex + 1} of {Math.max(listTasks.length, 1)}</span>
              <button type="button" className="todo-icon-btn" aria-label="Next" disabled={selectedIndex < 0 || selectedIndex >= listTasks.length - 1} onClick={() => goSelected(1)}>›</button>
            </div>
          </div>

          <div className="todo-detail-scroll">
            <div className="todo-detail-title-row">
              <h3>{selected.text}</h3>
              <button
                type="button"
                className={'todo-star' + (selected.starred ? ' on' : '')}
                onClick={() => { void toggleStar(selected.id); }}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill={selected.starred ? 'currentColor' : 'none'} aria-hidden="true">
                  <path d="m12 3.5 2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 15.8 7.2 18.4l.9-5.4L4.2 9.2l5.4-.8L12 3.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
            {selected.note ? <p className="todo-detail-desc">{selected.note}</p> : <p className="todo-detail-desc muted">No description</p>}

            <div className="todo-meta-table">
              <div className="todo-meta-row">
                <span>List</span>
                <strong>{lists.find(l => l.id === selected.listId)?.name || SMART_LISTS.find(l => l.id === selected.listId)?.name || 'List'}</strong>
              </div>
              <div className="todo-meta-row">
                <span>Priority</span>
                <span className={'todo-pri-tag ' + (selected.urgency || 'medium')}>
                  {URGENCY_OPTS.find(u => u.id === selected.urgency)?.label || 'Medium'}
                </span>
              </div>
              <div className="todo-meta-row">
                <span>Due</span>
                <strong>{formatDueLabel(selected, { short: true })}</strong>
              </div>
              <div className="todo-meta-row">
                <span>Time</span>
                <strong>{formatDueLabel(selected)}</strong>
              </div>
              <div className="todo-meta-row">
                <span>Category</span>
                {selected.category ? (
                  <span className="todo-cat" style={{ '--cat': categoryColor(selected.category) }}>{selected.category}</span>
                ) : <strong>—</strong>}
              </div>
              <div className="todo-meta-row">
                <span>Assignees</span>
                <span className="todo-avs">
                  <Avatar id={avatarOf(selected.assignee || selected.by)} fallback={initials(nameOf(selected.assignee || selected.by))} size={22} />
                </span>
              </div>
            </div>

            <div className="todo-detail-block">
              <div className="todo-detail-block-head">
                <span>Subtasks</span>
                <span>{subDone}/{subTotal} completed</span>
              </div>
              <div className="todo-progress"><i style={{ width: `${subPct}%` }} /></div>
              <div className="todo-sub-list">
                {(selected.subtasks || []).map(s => (
                  <div key={s.id} className={'todo-sub' + (s.done ? ' on' : '')}>
                    <button
                      type="button"
                      className={'todo-check' + (s.done ? ' on' : '')}
                      onClick={() => { void toggleSubtask(s.id); }}
                      aria-label={s.done ? 'Mark incomplete' : 'Mark complete'}
                    />
                    <span>{s.text}</span>
                    <button
                      type="button"
                      className="todo-sub-del"
                      aria-label="Delete subtask"
                      onClick={() => { void deleteSubtask(s.id); }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              {subTotal < 15 && (
                <div className="todo-sub-add">
                  <input
                    value={subdraft}
                    onChange={e => setSubdraft(e.target.value)}
                    placeholder="Add subtask…"
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void addSubtask(); } }}
                  />
                  <button type="button" onClick={() => { void addSubtask(); }} disabled={!subdraft.trim()}>Add</button>
                </div>
              )}
            </div>

            <div className="todo-detail-block">
              <div className="todo-detail-block-head">
                <span>Attachments</span>
              </div>
              {(selected.attachments || []).length === 0 ? (
                <p className="todo-detail-desc muted">No attachments yet.</p>
              ) : (selected.attachments || []).map(a => (
                <div key={a.id} className="todo-attach">{a.name} · {a.size}</div>
              ))}
            </div>

            <div className="todo-detail-block">
              <div className="todo-detail-block-head"><span>Comments</span></div>
              <div className="todo-comments">
                {(selected.comments || []).map(c => (
                  <div key={c.id} className="todo-comment">
                    <Avatar id={avatarOf(c.by)} fallback={initials(nameOf(c.by))} size={22} />
                    <div>
                      <b>{nameOf(c.by)}</b>
                      <p>{c.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="todo-detail-foot">
            <div className="todo-comment-bar">
              <Avatar id={avatarOf(myRole)} fallback={initials(nameOf(myRole))} size={28} />
              <input
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="Add a comment…"
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void addComment(); } }}
              />
              <button type="button" className="todo-send" aria-label="Send" onClick={() => { void addComment(); }} disabled={!comment.trim()}>
                ➤
              </button>
            </div>
            <div className="todo-created">
              Created by {nameOf(selected.by)} · {formatCreatedAt(selected.at)}
            </div>
            <div className="todo-detail-actions">
              <button type="button" className="todo-mini" onClick={() => openEditTask(selected)}>Edit</button>
              {!selected.trashed ? (
                <button type="button" className="todo-mini danger" onClick={() => { void trashItem(selected.id); }}>Move to trash</button>
              ) : (
                <button type="button" className="todo-mini" onClick={() => { void restoreItem(selected.id); }}>Restore</button>
              )}
            </div>
          </div>
        </aside>
      )}

      {modalOpen && (
        <div className="todo-modal-backdrop" role="presentation" onClick={() => !saving && !addingCategory && setModalOpen(false)}>
          <form className="todo-modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()} onSubmit={submitTask}>
            <h3>{editingId ? 'Edit task' : 'Add task'}</h3>
            <label className="todo-modal-field">
              <span>Task</span>
              <input ref={titleRef} value={text} onChange={e => setText(e.target.value)} required maxLength={200} disabled={saving} />
            </label>
            <label className="todo-modal-field">
              <span>Description</span>
              <textarea value={note} onChange={e => setNote(e.target.value)} disabled={saving} />
            </label>
            <div className="todo-modal-field">
              <div className="todo-due-picker">
                <div className="todo-due-fields">
                  <label className="todo-due-field">
                    <span>Date</span>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={e => setDueDate(e.target.value)}
                      disabled={saving}
                    />
                  </label>
                  <label className="todo-due-field">
                    <span>Time</span>
                    <input
                      type="time"
                      value={dueTime}
                      onChange={e => setDueTime(e.target.value || '18:00')}
                      disabled={saving || !dueDate}
                    />
                  </label>
                </div>

                <div className="todo-due-times" role="group" aria-label="Quick time">
                  {DUE_TIME_PRESETS.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      className={dueTime === p.id ? 'on' : ''}
                      onClick={() => {
                        setDueTime(p.id);
                        if (!dueDate) setDueDate(shiftDate(0));
                      }}
                      disabled={saving}
                      title={p.hint}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <div className="todo-due-summary" aria-live="polite">
                  {dueSummary}
                </div>
              </div>
            </div>
            <div className="todo-modal-field">
              <span>Priority</span>
              <div className="todo-urgency">
                {URGENCY_OPTS.map(o => (
                  <button key={o.id} type="button" className={'u-' + o.id + (urgency === o.id ? ' on' : '')} onClick={() => setUrgency(o.id)} disabled={saving}>{o.label}</button>
                ))}
              </div>
            </div>
            <div className="todo-modal-field">
              <span>Category</span>
              <div className="todo-urgency">
                <button type="button" className={!category ? 'on' : ''} onClick={() => setCategory('')} disabled={saving}>None</button>
                {categoryOptions.map(name => (
                  <button
                    key={name}
                    type="button"
                    className={category === name ? 'on' : ''}
                    onClick={() => setCategory(name)}
                    disabled={saving}
                  >
                    {name}
                  </button>
                ))}
                <button
                  type="button"
                  className="todo-cat-add"
                  onClick={() => {
                    setNewCategoryName('');
                    setAddingCategory(true);
                  }}
                  disabled={saving}
                >
                  + Add category
                </button>
              </div>
            </div>
            <div className="todo-modal-field">
              <span>List</span>
              <div className="todo-urgency">
                {writableLists.map(l => (
                  <button key={l.id} type="button" className={listId === l.id ? 'on' : ''} onClick={() => setListId(l.id)} disabled={saving}>{l.name}</button>
                ))}
              </div>
            </div>
            <div className="todo-modal-field">
              <span>Assignee</span>
              <div className="todo-urgency">
                {['A', 'B'].map(role => (
                  <button key={role} type="button" className={assignee === role ? 'on' : ''} onClick={() => setAssignee(role)} disabled={saving}>{nameOf(role)}</button>
                ))}
              </div>
            </div>
            <div className="todo-modal-actions">
              <button type="button" className="todo-modal-cancel" disabled={saving} onClick={() => setModalOpen(false)}>Cancel</button>
              <button type="submit" className="todo-modal-ok" disabled={saving || !text.trim()}>{saving ? 'Saving…' : editingId ? 'Save' : 'Add Task'}</button>
            </div>
          </form>
        </div>
      )}

      {addingCategory && (
        <div
          className="todo-modal-backdrop todo-modal-backdrop-stack"
          role="presentation"
          onClick={() => { setAddingCategory(false); setNewCategoryName(''); }}
        >
          <form
            className="todo-modal todo-modal-sm"
            role="dialog"
            aria-modal="true"
            aria-label="Add category"
            onClick={e => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              addCustomCategory();
            }}
          >
            <h3>Add category</h3>
            <label className="todo-modal-field">
              <span>Name</span>
              <input
                value={newCategoryName}
                onChange={e => setNewCategoryName(e.target.value)}
                placeholder="e.g. Travel"
                maxLength={32}
                disabled={saving}
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Escape') {
                    setAddingCategory(false);
                    setNewCategoryName('');
                  }
                }}
              />
            </label>
            <div className="todo-modal-actions">
              <button
                type="button"
                className="todo-modal-cancel"
                disabled={saving}
                onClick={() => { setAddingCategory(false); setNewCategoryName(''); }}
              >
                Cancel
              </button>
              <button type="submit" className="todo-modal-ok" disabled={saving || !newCategoryName.trim()}>
                Add
              </button>
            </div>
          </form>
        </div>
      )}

      {listModalOpen && (
        <div className="todo-modal-backdrop" role="presentation" onClick={() => !saving && (setListModalOpen(false), setEditingListId(null))}>
          <form className="todo-modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()} onSubmit={submitList}>
            <h3>{editingListId ? 'Edit list' : 'New list'}</h3>
            <label className="todo-modal-field">
              <span>Name</span>
              <input value={newListName} onChange={e => setNewListName(e.target.value)} placeholder="e.g. Study" required disabled={saving} autoFocus />
            </label>
            <div className="todo-modal-field">
              <span>Icon</span>
              <div className="todo-urgency">
                {LIST_ICONS.map(ico => (
                  <button key={ico} type="button" className={newListIcon === ico ? 'on' : ''} onClick={() => setNewListIcon(ico)} disabled={saving}>
                    <ListIcon id={ico} />
                  </button>
                ))}
              </div>
            </div>
            {!editingListId && (
              <div className="todo-modal-field">
                <span>Visibility</span>
                <div className="todo-urgency">
                  <button type="button" className={!newListShared ? 'on' : ''} onClick={() => setNewListShared(false)} disabled={saving}>Mine</button>
                  <button type="button" className={newListShared ? 'on' : ''} onClick={() => setNewListShared(true)} disabled={saving}>Shared</button>
                </div>
              </div>
            )}
            <div className="todo-modal-actions">
              <button type="button" className="todo-modal-cancel" disabled={saving} onClick={() => { setListModalOpen(false); setEditingListId(null); }}>Cancel</button>
              <button type="submit" className="todo-modal-ok" disabled={saving || !newListName.trim()}>
                {saving ? 'Saving…' : editingListId ? 'Save' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
