// Engine registry — same shape as the original app.html registry.
// Every engine exports: meta {id,name,tag,realtime}, and either
//   turn-based: initialState / applyMove / winner / render
//   realtime:   mount / unmount (plus winner reported via onFinish)
import * as TTT from './ttt.js';
import * as C4 from './connect4.js';
import * as DOTS from './dots.js';
import * as REV from './reversi.js';
import * as PONG from './pong.js';
import * as GMK from './gomoku.js';
import * as MEM from './memory.js';
import * as SK from './sketch.js';
import * as WR from './wordrace.js';
import * as MZ from './maze.js';
import * as RX from './reflex.js';
// New in v11.1 — five fresh head-to-head games:
import * as MAN from './mancala.js';
import * as SEA from './seabattle.js';
import * as CHK from './checkers.js';
import * as HEX from './hex.js';
import * as PIG from './pig.js';

export const ENGINES = Object.fromEntries(
  [TTT, C4, DOTS, REV, GMK, MEM, PONG, SK, WR, MZ, RX, MAN, SEA, CHK, HEX, PIG]
    .map(e => [e.meta.id, e])
);
