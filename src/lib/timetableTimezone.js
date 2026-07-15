// src/lib/timetableTimezone.js — per-partner timezone for Our Week.

const WD = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

const FALLBACK_TZ = [
  'UTC',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Rome', 'Europe/Madrid',
  'Europe/Amsterdam', 'Europe/Warsaw', 'Europe/Istanbul',
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Toronto', 'America/Vancouver', 'America/Sao_Paulo', 'America/Mexico_City',
  'Africa/Casablanca', 'Africa/Algiers', 'Africa/Tunis', 'Africa/Tripoli', 'Africa/Cairo',
  'Africa/Nouakchott', 'Africa/El_Aaiun', 'Africa/Dakar', 'Africa/Abidjan', 'Africa/Accra',
  'Africa/Lagos', 'Africa/Porto-Novo', 'Africa/Lome', 'Africa/Niamey', 'Africa/Bamako',
  'Africa/Conakry', 'Africa/Freetown', 'Africa/Monrovia', 'Africa/Ouagadougou', 'Africa/Ndjamena',
  'Africa/Douala', 'Africa/Libreville', 'Africa/Brazzaville', 'Africa/Kinshasa', 'Africa/Luanda',
  'Africa/Bangui', 'Africa/Malabo', 'Africa/Sao_Tome', 'Africa/Khartoum', 'Africa/Juba',
  'Africa/Addis_Ababa', 'Africa/Asmara', 'Africa/Nairobi', 'Africa/Kampala', 'Africa/Kigali',
  'Africa/Bujumbura', 'Africa/Dar_es_Salaam', 'Africa/Djibouti', 'Africa/Mogadishu',
  'Africa/Johannesburg', 'Africa/Harare', 'Africa/Lusaka', 'Africa/Maputo', 'Africa/Gaborone',
  'Africa/Windhoek', 'Africa/Maseru', 'Africa/Mbabane', 'Africa/Blantyre', 'Africa/Lubumbashi',
  'Indian/Mauritius', 'Indian/Reunion', 'Indian/Mahe',
  'Asia/Dubai', 'Asia/Kolkata', 'Asia/Bangkok', 'Asia/Singapore', 'Asia/Hong_Kong',
  'Asia/Tokyo', 'Asia/Seoul',
  'Australia/Sydney', 'Pacific/Auckland'
];

export function defaultTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function timezoneOptions() {
  const local = defaultTimezone();
  const list = [...FALLBACK_TZ];
  if (!list.includes(local)) list.unshift(local);
  return list;
}

export function timezoneLabel(tz) {
  try {
    const off = new Intl.DateTimeFormat('en', {
      timeZone: tz,
      timeZoneName: 'shortOffset'
    }).formatToParts(new Date()).find(p => p.type === 'timeZoneName')?.value || '';
    return `${tz.replace(/_/g, ' ')} ${off}`.trim();
  } catch {
    return tz.replace(/_/g, ' ');
  }
}

export function shortTimezoneLabel(tz) {
  try {
    return new Intl.DateTimeFormat('en', { timeZone: tz, timeZoneName: 'short' })
      .formatToParts(new Date())
      .find(p => p.type === 'timeZoneName')?.value || tz.replace(/_/g, ' ');
  } catch {
    return tz.replace(/_/g, ' ');
  }
}

function zonedParts(instant, tz) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    weekday: 'short',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  }).formatToParts(new Date(instant));
  const g = type => parts.find(p => p.type === type)?.value;
  return {
    year: +g('year'),
    month: +g('month'),
    day: +g('day'),
    hour: +g('hour'),
    minute: +g('minute'),
    second: +(g('second') || 0),
    weekday: g('weekday')
  };
}

function tzOffsetMs(utcMs, tz) {
  const p = zonedParts(utcMs, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - utcMs;
}

function zonedLocalToUtc(year, month, day, hour, minute, tz) {
  let guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  for (let i = 0; i < 4; i++) {
    guess = Date.UTC(year, month - 1, day, hour, minute, 0) - tzOffsetMs(guess, tz);
  }
  return guess;
}

function addDaysYmd({ year, month, day }, days) {
  const t = new Date(Date.UTC(year, month - 1, day + days));
  return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate() };
}

/** Sunday=0 wall-clock slot in `tz` → UTC ms (week of refDate). */
export function slotToUtcMs(day, startMins, tz, refDate = Date.now()) {
  const now = zonedParts(refDate, tz);
  const sunday = addDaysYmd(now, -(WD[now.weekday] ?? 0));
  const target = addDaysYmd(sunday, day);
  const hour = Math.floor(startMins / 60);
  const minute = startMins % 60;
  return zonedLocalToUtc(target.year, target.month, target.day, hour, minute, tz);
}

export function utcToLocalSlot(utcMs, tz) {
  const p = zonedParts(utcMs, tz);
  return {
    day: WD[p.weekday] ?? 0,
    start: p.hour * 60 + p.minute
  };
}

export function eventTimezone(ev) {
  return ev.tz || 'UTC';
}

export function eventToLocal(ev, viewerTz, refDate = Date.now()) {
  const tz = eventTimezone(ev);
  if (tz === viewerTz) return { ...ev };
  const utcMs = slotToUtcMs(ev.day, ev.start, tz, refDate);
  const local = utcToLocalSlot(utcMs, viewerTz);
  return { ...ev, day: local.day, start: local.start };
}

export function eventsToLocal(events, viewerTz, refDate = Date.now()) {
  return (events || []).map(ev => eventToLocal(ev, viewerTz, refDate));
}

export function localEventToStored(ev, viewerTz) {
  return {
    id: ev.id ?? null,
    day: ev.day,
    start: ev.start,
    dur: ev.dur,
    title: ev.title,
    emoji: ev.emoji ?? '',
    color: ev.color,
    who: ev.who,
    note: ev.note ?? '',
    tz: viewerTz
  };
}

export function nowInTimezone(tz, refDate = Date.now()) {
  return utcToLocalSlot(refDate, tz);
}
