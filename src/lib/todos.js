// src/lib/todos.js — shared couple todo list data layer.

import { CONFIG } from './config.js';

const localKey = code => 'duoarcade-todos-' + code;

export const URGENCY = { high: 0, medium: 1, low: 2 };

export function sortTodos(items) {
  return [...items].sort((a, b) => {
    if (!!a.done !== !!b.done) return a.done ? 1 : -1;
    const ua = URGENCY[a.urgency] ?? 1;
    const ub = URGENCY[b.urgency] ?? 1;
    if (ua !== ub) return ua - ub;
    return (b.at || 0) - (a.at || 0);
  });
}

export function newTodo({ text, note, urgency, by }) {
  return {
    id: crypto.randomUUID(),
    text: text.trim(),
    note: (note || '').trim(),
    urgency: urgency || 'medium',
    by,
    done: false,
    at: Date.now()
  };
}

let clientPromise = null;

async function getClient() {
  if (!clientPromise) {
    const { createClient } = await import('@supabase/supabase-js');
    clientPromise = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
  }
  return clientPromise;
}

function configured() {
  return CONFIG.SUPABASE_URL && !CONFIG.SUPABASE_URL.includes('YOUR-PROJECT');
}

export async function loadTodos(code) {
  if (!configured()) {
    try {
      return JSON.parse(localStorage.getItem(localKey(code)) || '[]');
    } catch { return []; }
  }
  const supabase = await getClient();
  const { data, error } = await supabase
    .from('duo_todos').select('items').eq('duo_code', code).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.items ?? [];
}

export async function saveTodos(code, items) {
  if (!configured()) {
    localStorage.setItem(localKey(code), JSON.stringify(items));
    return true;
  }
  const supabase = await getClient();
  const { data, error } = await supabase.rpc('save_duo_todos', {
    p_duo_code: code, p_items: items
  });
  if (error) throw new Error(error.message);
  return data === true;
}

export async function todosChannel(code) {
  if (!configured()) {
    let cb = () => {};
    const bc = new BroadcastChannel('duoarcade-todos-' + code);
    bc.onmessage = e => cb(e.data);
    return {
      send: payload => bc.postMessage(payload),
      on: fn => { cb = fn; },
      close: () => bc.close()
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
    close: () => supabase.removeChannel(ch)
  };
}
