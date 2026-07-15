// src/lib/timetable.js — "Our Week" data layer.

import { CONFIG } from './config.js';

let clientPromise = null;

async function getClient() {
  if (!clientPromise) {
    const { createClient } = await import('@supabase/supabase-js');
    clientPromise = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
  }
  return clientPromise;
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

export const DEFAULT_SETTINGS = {
  startHour: 8,
  endHour: 24,
  weekend: true,
  weekStart: 1,
  timeFormat: '24' // '24' | '12'
};

export async function loadTimetable(code) {
  const supabase = await getClient();
  const { data, error } = await supabase
    .from('timetables').select('events, settings')
    .eq('duo_code', code).maybeSingle();
  if (error) throw new Error(error.message);
  return {
    events: data?.events ?? [],
    settingsAll: data?.settings ?? {}
  };
}

export function mySettingsFrom(settingsAll, role) {
  const legacy = settingsAll && typeof settingsAll.startHour === 'number' ? settingsAll : {};
  return { ...DEFAULT_SETTINGS, ...legacy, ...((settingsAll || {})[role] || {}) };
}

export async function saveTimetable(code, { events = null, settings = null } = {}) {
  const supabase = await getClient();
  const { data, error } = await supabase.rpc('save_timetable', {
    p_duo_code: code, p_events: events, p_settings: settings
  });
  if (error) throw new Error(error.message);
  return data === true;
}

export async function weekChannel(code) {
  const supabase = await getClient();
  let cb = () => {};
  const ch = supabase
    .channel('week-' + code, { config: { broadcast: { self: false } } })
    .on('broadcast', { event: 'm' }, p => cb(p.payload))
    .subscribe();
  return {
    send: payload => ch.send({ type: 'broadcast', event: 'm', payload }),
    on: fn => { cb = fn; },
    close: () => supabase.removeChannel(ch)
  };
}

export const fmtTime = (mins, format = '24') => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (format === '12') {
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, '0')} ${period}`;
  }
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

/** Hour label on the grid axis (0–23, or 24 = midnight end). */
export const fmtHour = (hour, format = '24') => {
  if (format === '12') {
    if (hour === 0 || hour === 24) return '12 AM';
    if (hour === 12) return '12 PM';
    return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
  }
  if (hour === 24) return '00';
  return String(hour).padStart(2, '0');
};

/** Option label in start/end dropdowns. */
export const fmtHourOption = (hour, format = '24', kind = 'start') => {
  if (format === '12') {
    if (hour === 0) return '12:00 AM';
    if (hour === 24) return '12:00 AM (midnight)';
    if (hour === 12) return '12:00 PM';
    const period = hour < 12 ? 'AM' : 'PM';
    const h12 = hour % 12 || 12;
    return `${h12}:00 ${period}`;
  }
  if (hour === 24) return '24:00';
  return `${String(hour).padStart(2, '0')}:00`;
};

export const parseTime = str => {
  const [h, m] = String(str).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

export function layoutDay(events) {
  const sorted = [...events].sort((a, b) => a.start - b.start || b.dur - a.dur);
  const lanes = [];
  const placed = sorted.map(ev => {
    let lane = lanes.findIndex(end => end <= ev.start);
    if (lane === -1) { lane = lanes.length; lanes.push(0); }
    lanes[lane] = ev.start + ev.dur;
    return { ...ev, lane };
  });
  return placed.map(ev => {
    const overlapping = placed.filter(o =>
      o.start < ev.start + ev.dur && ev.start < o.start + o.dur);
    const width = Math.max(...overlapping.map(o => o.lane)) + 1;
    return { ...ev, lanes: width };
  });
}
