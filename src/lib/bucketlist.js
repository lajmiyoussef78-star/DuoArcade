// src/lib/bucketlist.js — time-locked couples bucket list data layer.
// All reads go through server RPCs so a locked list stays sealed
// (items are stripped server-side until the unlock date).

import { CONFIG } from './config.js';
import { getSupabase } from './supabaseClient.js';

const localKey = code => 'duoarcade-bucket-' + code;

async function getClient() {
  return getSupabase();
}

function configured() {
  return CONFIG.SUPABASE_URL && !CONFIG.SUPABASE_URL.includes('YOUR-PROJECT');
}

const schemaHint = message => {
  if (/duo_bucketlists|bucket_get|does not exist/i.test(message)) {
    return 'Bucket list database is not installed yet. Run supabase/schema-v36-bucketlist.sql in Supabase SQL Editor.';
  }
  return message;
};

async function rpc(name, args) {
  const supabase = await getClient();
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(schemaHint(error.message));
  return data;
}

/* ── Local fallback (Supabase not configured, dev only) ── */

function localRow(code) {
  try {
    const r = JSON.parse(localStorage.getItem(localKey(code)) || 'null');
    if (r && r.status) return r;
  } catch { /* */ }
  return { id: 'local', status: 'draft', items: [], unlock_at: null, locked_at: null, opened_at: null, history: [] };
}

function localSave(code, row) {
  localStorage.setItem(localKey(code), JSON.stringify(row));
}

function localView(code) {
  const r = localRow(code);
  if (r.status === 'locked' && r.unlock_at && Date.now() >= new Date(r.unlock_at).getTime()) {
    r.status = 'opened';
    r.opened_at = new Date().toISOString();
    localSave(code, r);
  }
  return {
    id: r.id,
    status: r.status,
    items: r.status === 'locked' ? null : r.items,
    item_count: r.items.length,
    unlock_at: r.unlock_at,
    locked_at: r.locked_at,
    opened_at: r.opened_at
  };
}

/* ── API — every mutation returns the fresh (lock-aware) list view ── */

export async function bucketGet(code) {
  if (!configured()) return localView(code);
  return await rpc('bucket_get', { p_duo_code: code });
}

export async function bucketAddItem(code, text, myRole) {
  if (!configured()) {
    const r = localRow(code);
    if (r.status !== 'draft' && r.status !== 'locked') throw new Error('This list is already opened');
    r.items.push({
      id: crypto.randomUUID(), text: text.trim(), by: myRole,
      added_at: Date.now(), achieved: null
    });
    localSave(code, r);
    return localView(code);
  }
  return await rpc('bucket_add_item', { p_duo_code: code, p_text: text });
}

export async function bucketUpdateItem(code, itemId, text) {
  if (!configured()) {
    const r = localRow(code);
    if (r.status !== 'draft') throw new Error('Items can only be edited before locking');
    r.items = r.items.map(it => it.id === itemId ? { ...it, text: text.trim() } : it);
    localSave(code, r);
    return localView(code);
  }
  return await rpc('bucket_update_item', { p_duo_code: code, p_item_id: itemId, p_text: text });
}

export async function bucketRemoveItem(code, itemId) {
  if (!configured()) {
    const r = localRow(code);
    if (r.status !== 'draft') throw new Error('Items can only be removed before locking');
    r.items = r.items.filter(it => it.id !== itemId);
    localSave(code, r);
    return localView(code);
  }
  return await rpc('bucket_remove_item', { p_duo_code: code, p_item_id: itemId });
}

export async function bucketLock(code, unlockAtIso) {
  if (!configured()) {
    const r = localRow(code);
    if (r.status !== 'draft') throw new Error('This list is already locked');
    if (!r.items.length) throw new Error('Add at least one dream before locking');
    r.status = 'locked';
    r.unlock_at = unlockAtIso;
    r.locked_at = new Date().toISOString();
    localSave(code, r);
    return localView(code);
  }
  return await rpc('bucket_lock', { p_duo_code: code, p_unlock_at: unlockAtIso });
}

export async function bucketMark(code, itemId, achieved) {
  if (!configured()) {
    const r = localRow(code);
    if (r.status !== 'opened') throw new Error('The list is not open yet');
    r.items = r.items.map(it => it.id === itemId ? { ...it, achieved } : it);
    localSave(code, r);
    return localView(code);
  }
  return await rpc('bucket_mark', { p_duo_code: code, p_item_id: itemId, p_achieved: achieved });
}

export async function bucketArchive(code) {
  if (!configured()) {
    const r = localRow(code);
    if (r.status !== 'opened') throw new Error('Only an opened list can be archived');
    const history = [...(r.history || []), { ...r, status: 'archived', archived_at: new Date().toISOString() }];
    localSave(code, { id: 'local', status: 'draft', items: [], unlock_at: null, locked_at: null, opened_at: null, history });
    return localView(code);
  }
  return await rpc('bucket_archive', { p_duo_code: code });
}

export async function bucketHistory(code) {
  if (!configured()) {
    return (localRow(code).history || [])
      .map(h => ({ ...h, item_count: h.items.length }))
      .reverse();
  }
  return await rpc('bucket_history', { p_duo_code: code });
}

/* ── Realtime: ping the partner so they re-fetch via bucketGet ── */

export async function bucketChannel(code) {
  if (!configured()) {
    let cb = () => {};
    const bc = new BroadcastChannel('duoarcade-bucket-' + code);
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
    .channel('bucket-' + code, { config: { broadcast: { self: false } } })
    .on('broadcast', { event: 'm' }, p => cb(p.payload))
    .subscribe();
  return {
    send: payload => ch.send({ type: 'broadcast', event: 'm', payload }),
    on: fn => { cb = fn; },
    close: () => supabase.removeChannel(ch)
  };
}
