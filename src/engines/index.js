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
// New couple-night shelf — sticks, a race, and two "know each other" games:
import * as NIM from './nim.js';
import * as RACE from './race.js';
import * as CQ from './couplequiz.js';
import * as TTL from './twotruths.js';
import * as CB from './codebreak.js';
import * as SS from './sparksplash.js';
import * as RSC from './readysetcook.js';
import * as SSD from './stickmanswordduel.js';
import * as SR from './stickmanracing.js';
import * as MSC from './microsoccer.js';
import * as MD from './moleduel.js';
import * as FW from './forbiddenwords.js';
import * as AUC from './auctionduel.js';
import * as NF from './numberfortress.js';
import * as WB from './wordbomb.js';
import * as UNO from './uno.js';
import * as COUP from './coup.js';
import * as CARROT from './carrot.js';
import * as CHKOBBA from './chkobba.js';
import * as MINUSONE from './minusone.js';
import * as THINICE from './thinice.js';

export const ENGINES = Object.fromEntries(
  [TTT, C4, DOTS, REV, GMK, MEM, PONG, SK, WR, MZ, RX, MAN, SEA, CHK, HEX, PIG, NIM, RACE, CQ, TTL, CB, SS, RSC, SSD, SR, MSC, MD, FW, AUC, NF, WB, UNO, COUP, CARROT, CHKOBBA, MINUSONE, THINICE]
    .map(e => [e.meta.id, e])
);
