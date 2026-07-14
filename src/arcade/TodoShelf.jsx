// src/arcade/TodoShelf.jsx — shared couple todo list on the home screen.

import { useCallback, useEffect, useRef, useState } from 'react';
import { loadTodos, saveTodos, todosChannel, sortTodos, newTodo } from '../lib/todos.js';
import '../styles/todos.css';

const URGENCY_OPTS = [
  { id: 'high', label: 'Urgent' },
  { id: 'medium', label: 'Soon' },
  { id: 'low', label: 'Whenever' }
];

export default function TodoShelf({ code, myRole, duo }) {
  const [items, setItems] = useState([]);
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  const [urgency, setUrgency] = useState('medium');
  const [status, setStatus] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editUrgency, setEditUrgency] = useState('medium');
  const channelRef = useRef(null);
  const savingRef = useRef(false);

  const nameOf = role => (role === 'A' ? duo.nameA : duo.nameB) || '?';

  const persist = useCallback(async (next, { broadcast = true } = {}) => {
    const sorted = sortTodos(next);
    setItems(sorted);
    if (broadcast) channelRef.current?.send({ k: 'sync', items: sorted });
    try {
      savingRef.current = true;
      await saveTodos(code, sorted);
      setStatus('');
    } catch (e) {
      setStatus(e.message || 'Could not save');
    } finally {
      savingRef.current = false;
    }
  }, [code]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const loaded = await loadTodos(code);
        if (alive) setItems(sortTodos(loaded));
      } catch { /* empty list is fine */ }

      const ch = await todosChannel(code);
      if (!alive) { ch.close(); return; }
      channelRef.current = ch;
      ch.on(msg => {
        if (!alive || savingRef.current || msg.k !== 'sync' || !Array.isArray(msg.items)) return;
        setItems(sortTodos(msg.items));
      });
    })();
    return () => {
      alive = false;
      channelRef.current?.close();
      channelRef.current = null;
    };
  }, [code]);

  const addTodo = async () => {
    if (!text.trim()) return;
    const item = newTodo({ text, note, urgency, by: myRole });
    setText('');
    setNote('');
    setUrgency('medium');
    await persist([...items, item]);
  };

  const toggleDone = async id => {
    await persist(items.map(t => t.id === id ? { ...t, done: !t.done } : t));
  };

  const removeTodo = async id => {
    if (editingId === id) setEditingId(null);
    await persist(items.filter(t => t.id !== id));
  };

  const startEdit = item => {
    setEditingId(item.id);
    setEditText(item.text);
    setEditNote(item.note || '');
    setEditUrgency(item.urgency || 'medium');
  };

  const saveEdit = async id => {
    if (!editText.trim()) return;
    await persist(items.map(t => t.id === id
      ? { ...t, text: editText.trim(), note: editNote.trim(), urgency: editUrgency }
      : t));
    setEditingId(null);
  };

  const sorted = sortTodos(items);
  const open = sorted.filter(t => !t.done).length;

  return (
    <div className="todo-card">
      <h3>{'✓'} Our list</h3>
      <p className="todo-sub">
        Shared to-dos for both of you, sorted by urgency. Either person can edit anything.
      </p>

      <div className="todo-form">
        <input type="text" placeholder="What needs doing?" value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addTodo()} />
        <textarea placeholder="Optional note (why, when, details…)" value={note}
          onChange={e => setNote(e.target.value)} />
        <div className="todo-urgency">
          {URGENCY_OPTS.map(o => (
            <button key={o.id} type="button"
              className={'u-' + o.id + (urgency === o.id ? ' on' : '')}
              onClick={() => setUrgency(o.id)}>
              {o.label}
            </button>
          ))}
        </div>
        <button className="btn warm small" type="button" onClick={addTodo}>Add to list</button>
      </div>

      <div className="todo-list">
        {sorted.length === 0 && (
          <div className="todo-empty">Nothing on the list yet. Add your first to-do above.</div>
        )}
        {sorted.map(item => (
          <div key={item.id} className={'todo-item u-' + (item.urgency || 'medium') + (item.done ? ' done' : '')}>
            <div className="todo-top">
              <input type="checkbox" className="todo-check" checked={!!item.done}
                onChange={() => toggleDone(item.id)} aria-label="Mark done" />
              {editingId === item.id ? (
                <div className="todo-edit" style={{ paddingLeft: 0, flex: 1 }}>
                  <input type="text" value={editText} onChange={e => setEditText(e.target.value)} />
                  <textarea value={editNote} onChange={e => setEditNote(e.target.value)} />
                  <div className="todo-urgency">
                    {URGENCY_OPTS.map(o => (
                      <button key={o.id} type="button"
                        className={'u-' + o.id + (editUrgency === o.id ? ' on' : '')}
                        onClick={() => setEditUrgency(o.id)}>
                        {o.label}
                      </button>
                    ))}
                  </div>
                  <div className="row">
                    <button className="btn warm small" type="button" onClick={() => saveEdit(item.id)}>Save</button>
                    <button className="btn small ghost" type="button" onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className={'todo-text' + (item.done ? ' done-text' : '')}>{item.text}</div>
                  <span className={'todo-badge ' + (item.urgency || 'medium')}>
                    {item.urgency === 'high' ? 'urgent' : item.urgency === 'low' ? 'low' : 'soon'}
                  </span>
                </>
              )}
            </div>
            {editingId !== item.id && item.note && (
              <div className="todo-note">{item.note}</div>
            )}
            {editingId !== item.id && (
              <>
                <div className="todo-meta">
                  added by <b>{nameOf(item.by)}</b>
                </div>
                <div className="todo-actions">
                  <button type="button" onClick={() => startEdit(item)}>Edit</button>
                  <button type="button" onClick={() => removeTodo(item.id)}>Remove</button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {open > 0 && <div className="todo-status">{open} open item{open === 1 ? '' : 's'}{status ? ' · ' + status : ''}</div>}
      {!open && status && <div className="todo-status">{status}</div>}
    </div>
  );
}
