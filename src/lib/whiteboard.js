// src/lib/whiteboard.js — shared whiteboard data layer.

import { getSupabase } from './supabaseClient.js';

async function getClient() {
  return getSupabase();
}

export async function myRoleInDuo(code) {
  const supabase = await getClient();
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData?.user?.id;
  if (!uid) return null;
  const { data, error } = await supabase.rpc('list_my_duos', {});
  if (error) return null;
  const d = (data || []).find(x => x.code === code);
  if (!d) return null;
  return d.member_a === uid ? 'A' : d.member_b === uid ? 'B' : null;
}

export async function duoNames(code) {
  const supabase = await getClient();
  const { data } = await supabase.rpc('list_my_duos', {});
  const d = (data || []).find(x => x.code === code);
  return d ? { A: d.name_a, B: d.name_b } : { A: 'A', B: 'B' };
}

export async function currentUserId() {
  const supabase = await getClient();
  const { data } = await supabase.auth.getUser();
  return data?.user?.id || null;
}

export async function loadBoard(code) {
  const supabase = await getClient();
  const { data, error } = await supabase
    .from('whiteboards').select('strokes').eq('duo_code', code).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.strokes ?? [];
}

export async function loadBoardMeta(code) {
  const supabase = await getClient();
  const { data, error } = await supabase
    .from('whiteboards').select('strokes, updated_at').eq('duo_code', code).maybeSingle();
  if (error) throw new Error(error.message);
  return { strokes: data?.strokes ?? [], updatedAt: data?.updated_at ?? null };
}

export async function saveBoard(code, strokes) {
  const supabase = await getClient();
  const { data, error } = await supabase.rpc('save_whiteboard', {
    p_duo_code: code, p_strokes: strokes
  });
  if (error) throw new Error(error.message);
  return data === true;
}

/** Deliberate named snapshot — does not touch the live whiteboards row. */
export async function saveBoardSnapshot(code, title, strokes) {
  const supabase = await getClient();
  const { data, error } = await supabase.rpc('save_whiteboard_snapshot', {
    p_duo_code: code,
    p_title: title,
    p_strokes: strokes,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function listBoardSnapshots(code) {
  const supabase = await getClient();
  const { data, error } = await supabase.rpc('list_whiteboard_snapshots', {
    p_duo_code: code,
  });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function getBoardSnapshot(id) {
  const supabase = await getClient();
  const { data, error } = await supabase.rpc('get_whiteboard_snapshot', {
    p_id: id,
  });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error('Snapshot not found');
  return row;
}

export async function renameBoardSnapshot(id, title) {
  const supabase = await getClient();
  const { error } = await supabase.rpc('rename_whiteboard_snapshot', {
    p_id: id,
    p_title: title,
  });
  if (error) throw new Error(error.message);
  return true;
}

/** Overwrite strokes on an existing named save (does not touch the live board). */
export async function updateBoardSnapshot(id, strokes) {
  const supabase = await getClient();
  const { data, error } = await supabase.rpc('update_whiteboard_snapshot', {
    p_id: id,
    p_strokes: strokes,
  });
  if (error) throw new Error(error.message);
  return data === true;
}

export async function setBoardSnapshotFavorite(id, favorite) {
  const supabase = await getClient();
  const { error } = await supabase.rpc('set_whiteboard_snapshot_favorite', {
    p_id: id,
    p_favorite: !!favorite,
  });
  if (error) throw new Error(error.message);
  return true;
}

export async function trashBoardSnapshot(id) {
  const supabase = await getClient();
  const { error } = await supabase.rpc('trash_whiteboard_snapshot', { p_id: id });
  if (error) throw new Error(error.message);
  return true;
}

export async function restoreBoardSnapshot(id) {
  const supabase = await getClient();
  const { error } = await supabase.rpc('restore_whiteboard_snapshot', { p_id: id });
  if (error) throw new Error(error.message);
  return true;
}

export async function deleteBoardSnapshot(id) {
  const supabase = await getClient();
  const { error } = await supabase.rpc('delete_whiteboard_snapshot', { p_id: id });
  if (error) throw new Error(error.message);
  return true;
}

export async function duplicateBoardSnapshot(id) {
  const supabase = await getClient();
  const { data, error } = await supabase.rpc('duplicate_whiteboard_snapshot', { p_id: id });
  if (error) throw new Error(error.message);
  return data;
}

/** Snapshot current strokes into a share pack; returns a short code. */
export async function createBoardShare(title, strokes) {
  const supabase = await getClient();
  const { data, error } = await supabase.rpc('create_whiteboard_share', {
    p_title: title,
    p_strokes: strokes ?? [],
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function peekBoardShare(token) {
  const supabase = await getClient();
  const { data, error } = await supabase.rpc('peek_whiteboard_share', {
    p_token: token,
  });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  return row || null;
}

/** Copy a share pack into this duo’s saved library (Shared with us). */
export async function importBoardShare(code, token) {
  const supabase = await getClient();
  const { data, error } = await supabase.rpc('import_whiteboard_share', {
    p_duo_code: code,
    p_token: token,
  });
  if (error) throw new Error(error.message);
  return data;
}

/** Pull a share token from a raw code or a saved-boards ?add= link. */
export function parseBoardShareInput(raw) {
  const text = String(raw || '').trim();
  if (!text) return '';
  try {
    const url = new URL(text);
    const add = url.searchParams.get('add');
    if (add) return String(add).trim().toUpperCase();
  } catch {
    /* not a URL */
  }
  const fromQuery = text.match(/[?&]add=([A-Za-z0-9]+)/i);
  if (fromQuery) return fromQuery[1].toUpperCase();
  const bare = text.replace(/\s+/g, '').toUpperCase();
  if (/^[A-Z0-9]{6,16}$/.test(bare)) return bare;
  return '';
}

export function boardShareUrl(token, origin = (typeof window !== 'undefined' ? window.location.origin : '')) {
  const t = String(token || '').trim().toUpperCase();
  if (!t) return '';
  return `${origin}/app/place/sect-saved-boards?add=${encodeURIComponent(t)}`;
}

export function defaultSnapshotTitle(date = new Date()) {
  try {
    const when = date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    return `Untitled — ${when}`;
  } catch {
    return 'Untitled';
  }
}

export async function boardChannel(code) {
  const supabase = await getClient();
  let cb = () => {};
  const ch = supabase
    .channel('wb-' + code, { config: { broadcast: { self: false } } })
    .on('broadcast', { event: 'm' }, p => cb(p.payload))
    .subscribe();
  return {
    send: payload => ch.send({ type: 'broadcast', event: 'm', payload }),
    on: fn => { cb = fn; },
    close: () => supabase.removeChannel(ch)
  };
}
