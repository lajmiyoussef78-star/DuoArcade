// watchSparks.js — Sparks overlay helpers (agreement-first Interactive layer).

import pack from '../data/sparksPack.js';

export function getSparksPack() {
  return pack;
}

export function quickPrompts() {
  const ids = new Set(pack.quickIds || []);
  return (pack.prompts || []).filter(p => ids.has(p.id));
}

export function fullPrompts() {
  return (pack.prompts || []);
}

export function promptById(id) {
  return (pack.prompts || []).find(p => p.id === id) || null;
}

export function afterglowQuestions() {
  return pack.afterglow || [];
}

/** Agreement-first copy — points are secondary. */
export function sparksRevealLine(a, b) {
  if (a == null || b == null) return 'Waiting for both answers…';
  if (a === b) return 'Twin spark — you thought the same.';
  return 'Different answers — cute, not a contest.';
}

/**
 * Pack-defined timed triggers (`timedTriggers` or prompts with `t_sec`).
 * Structure only — callers decide whether to poll / surface / auto-fire.
 */
export function packTimedTriggers(source = pack) {
  const fromList = (source.timedTriggers || [])
    .filter(t => t && t.promptId != null && Number.isFinite(Number(t.atSec)))
    .map(t => ({ atSec: Number(t.atSec), promptId: t.promptId }));
  const fromPrompts = (source.prompts || [])
    .filter(p => p && p.id && Number.isFinite(Number(p.t_sec)))
    .map(p => ({ atSec: Number(p.t_sec), promptId: p.id }));
  const seen = new Set();
  const out = [];
  for (const t of [...fromList, ...fromPrompts]) {
    const key = `${t.promptId}@${t.atSec}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out.sort((a, b) => a.atSec - b.atSec);
}

/**
 * Timed Sparks hook structure (Nice).
 * Register triggers from pack; WatchScreen / SparksOverlay keep auto-fire off by default.
 * Optional timed mode may poll dueAt and surface a soft cue — never start a prompt alone.
 */
export function createTimedSparkHooks(initialTriggers) {
  const hooks = [];
  const api = {
    /** Register { atSec, promptId } — future auto-drop; unused as auto-fire in MVP. */
    add(trigger) {
      if (!trigger || trigger.promptId == null) return;
      hooks.push({
        atSec: Number(trigger.atSec) || 0,
        promptId: trigger.promptId,
      });
    },
    seedFromPack(source = pack) {
      api.clear();
      for (const t of packTimedTriggers(source)) api.add(t);
      return api.list();
    },
    list() {
      return hooks.slice();
    },
    /** Returns first due trigger at playhead, or null. Spoiler-safe: caller decides. */
    dueAt(positionSec, windowSec = 0.75) {
      const t = Number(positionSec) || 0;
      const w = Number(windowSec) || 0.75;
      return hooks.find(h => Math.abs((h.atSec || 0) - t) < w) || null;
    },
    /** Next upcoming cue after playhead (for soft “cue ready” UI). */
    nextAfter(positionSec) {
      const t = Number(positionSec) || 0;
      return hooks.find(h => (h.atSec || 0) > t + 0.5) || null;
    },
    clear() {
      hooks.length = 0;
    },
  };
  if (initialTriggers?.length) {
    for (const t of initialTriggers) api.add(t);
  }
  return api;
}

export function emptySparksState() {
  return {
    on: false,
    mode: null, // 'quick' | 'full' | 'timed'
    timedMode: false, // register/poll cues; auto-fire stays off
    promptId: null,
    phase: 'idle', // idle | answering | reveal
    answers: { A: null, B: null },
    score: { A: 0, B: 0 },
    packId: pack.id,
  };
}
