/* ============================================================
   SPARK & SPLASH — Crystal Caverns Adventure
   Original two-character co-op puzzle platformer.
   ============================================================ */
(() => {
"use strict";
const cv = document.getElementById("game");
const cx = cv.getContext("2d");
const TILE = 40, COLS = 20, ROWS = 13;

/* ---------------- LEVEL LEGEND ----------------
 # rock    L lava    W water    A acid
 r red gem (Spark)   b blue gem (Splash)
 F Spark spawn  S Splash spawn  D Spark door  d Splash door
 B gold button  -> opens G gates (stays open)
 C gold button  -> opens H gates (stays open)
 P hold pad     -> Q gates open only while P is weighted
 O hold pad     -> U gates open only while O is weighted
 X pushable crate      lifts:[{c,w,rTop,rBot}] = elevators
------------------------------------------------*/
const LEVELS = [
{ name:"The Warm-Up Cave", hint:"Climb to your own door — you must BOTH stand on them!", map:[
"####################",
"#..................#",
"#..D............d..#",
"#.####........####.#",
"#..................#",
"#...r..........b...#",
"#...####....####...#",
"#..................#",
"#.r..............b.#",
"#.###..........###.#",
"#..................#",
"#F.LL........WW...S#",
"####################"]},
{ name:"Stepping Stones", hint:"Hop over the pools that hurt you — walk through your own!", map:[
"####################",
"#..................#",
"#..D............d..#",
"#.####........####.#",
"#..................#",
"#....r........b....#",
"#...####....####...#",
"#..................#",
"#........rb........#",
"#.......####.......#",
"#..................#",
"#F.LL.W......L.WW.S#",
"####################"]},
{ name:"The Sealed Wall", hint:"A gold button opens the wall — forever.", map:[
"####################",
"#.........G........#",
"#..d......G.....D..#",
"#.####....G...####.#",
"#.........G........#",
"#.....b...G..r.....#",
"#....####.G####....#",
"#.........G........#",
"#..B......G........#",
"#.###.....G....###.#",
"#.........G........#",
"#S.WW..F..G..LL....#",
"####################"]},
{ name:"Hold the Door!", hint:"Teal pads only work while someone STANDS on them…", map:[
"####################",
"#...........Q......#",
"#..dP.......Q.D....#",
"#.####......Q####..#",
"#...........Q......#",
"#.....b.....Q......#",
"#....####...Q...####",
"#...........Q......#",
"#...........Q.r....#",
"#.###.......Q###...#",
"#...........Q......#",
"#F.LL..S.WW.Q......#",
"####################"]},
{ name:"The Crystal Crossing", hint:"Swap sides! Each friend crosses to the other's tower.", map:[
"####################",
"#.........G........#",
"#..d......G.....D..#",
"#.####....G...####.#",
"#.........G........#",
"#......b..G..r.....#",
"#....####.G####....#",
"#.........G........#",
"#.bB......G.....rB.#",
"#.###.....G....###.#",
"#.........G........#",
"#F....LL.AG.WW....S#",
"####################"]},
{ name:"The Elevator Shaft", hint:"Ride the lift — hop off mid-ride to grab the gems!", lifts:[{c:9,w:2,rTop:3,rBot:10}], map:[
"####################",
"#..................#",
"#.....D......d.....#",
"#...####....####...#",
"#..................#",
"#..r............b..#",
"#..####......####..#",
"#..................#",
"#..................#",
"#..................#",
"#..................#",
"#F.LL..........WW.S#",
"####################"]},
{ name:"Twin Towers", hint:"Buttons live up high. Cross at the bottom, climb the far side.", map:[
"####################",
"#.........G........#",
"#......bd.G.Dr.....#",
"#.....####G####....#",
"#.........G........#",
"#..b......G......r.#",
"#.####....G...####.#",
"#.........G........#",
"#....B....G..B.....#",
"#...####..G.####...#",
"#.........G........#",
"#F..LL....G...WW..S#",
"####################"]},
{ name:"Crate Expectations", hint:"That wall is too tall to jump… push the crate and climb it!", map:[
"####################",
"#..................#",
"#...............Dd.#",
"#..............#####",
"#..................#",
"#............rb....#",
"#...........####...#",
"#..................#",
"#........##........#",
"#........##....###.#",
"#........##........#",
"#F.X..S..##.A......#",
"####################"]},
{ name:"Acid Alley", hint:"Green acid hurts EVERYONE. Gems are on the far sides…", map:[
"####################",
"#..................#",
"#........Dd........#",
"#.......####.......#",
"#..................#",
"#....r........b....#",
"#...####....####...#",
"#..................#",
"#.b..............r.#",
"#.###..........###.#",
"#..................#",
"#F...A.LL.WW.A....S#",
"####################"]},
{ name:"Crate on the Pad", hint:"Nobody can stay behind… let the CRATE hold the pad!", map:[
"####################",
"#...........Q......#",
"#...........Q.D.d..#",
"#...........Q####..#",
"#...........Q......#",
"#..r........Q....b.#",
"#.####......Q...####",
"#...........Q......#",
"#...........Q.r....#",
"#.....###...Q###...#",
"#...........Q......#",
"#F..X.P.S.WWQ......#",
"####################"]},
{ name:"The Long Climb", hint:"Drop off ledges to clear the acid. The middle button is the key.", map:[
"####################",
"#...........G......#",
"#..d........G.D....#",
"#.####......G####..#",
"#...........G......#",
"#.......b...G....r.#",
"#......####.G...####",
"#...........G......#",
"#..r.....B..G..b...#",
"#.####..####G.###..#",
"#...........G......#",
"#F.LL.A.....G..WW.S#",
"####################"]},
{ name:"Two Keys", hint:"The grey wall hides the copper key. Each gate needs its own button!", map:[
"####################",
"#......G....H......#",
"#.D....G....H.d....#",
"####...G....H####..#",
"#......G....H......#",
"#......G..rbH......#",
"#....##G..##H...####",
"#......G....H......#",
"#..C...GB...H......#",
"#.###..G##..H.###..#",
"#......G....H......#",
"#....LLGF.S.HWW....#",
"####################"]},
{ name:"Mirror Falls", hint:"Long jumps! Land on the high ledges above the wide pools.", map:[
"####################",
"#..................#",
"#.d..............D.#",
"####............####",
"#..................#",
"#.....b......r.....#",
"#....####..####....#",
"#..................#",
"#....r........b....#",
"#..####......####..#",
"#..................#",
"#S..WW.....LL.....F#",
"####################"]},
{ name:"Lift & Hold", hint:"Splash holds the pad so Spark can enter the shaft. Then climb, Splash!", lifts:[{c:14,w:2,rTop:3,rBot:10}], map:[
"####################",
"#..................#",
"#..db...........rD.#",
"#.####..........####",
"#..................#",
"#......r.....#.....#",
"#.....###....#.....#",
"#............#.....#",
"#..b.........#.....#",
"#.###........Q.....#",
"#............Q.....#",
"#F...W.S..P..Q.LL..#",
"####################"]},
{ name:"The Gauntlet", hint:"Doors are swapped! Grab the gems by each door before crossing.", map:[
"####################",
"#.........G........#",
"#..Db.....G....rd..#",
"#.####....G...####.#",
"#.........G........#",
"#.....r...G..b.....#",
"#....####.G####....#",
"#.........G........#",
"#..B......G.....B..#",
"#.###.....G....###.#",
"#.........G........#",
"#S..WW....G...LL..F#",
"####################"]},
{ name:"Clockwork Caverns", hint:"Two lifts. The left one leads to the button — then ride the right one up!", lifts:[{c:4,w:2,rTop:3,rBot:10},{c:15,w:2,rTop:3,rBot:10}], map:[
"####################",
"#.........G........#",
"#.B.......G......Dd#",
"#.##......G......###",
"#.........G........#",
"#......r..G..b.....#",
"#......##.G.##.....#",
"#.........G........#",
"#.........G........#",
"#.........G........#",
"#.........G........#",
"#F..LL..A.G.A..WW.S#",
"####################"]},
{ name:"Twin Trials", hint:"Latch, hold, and floor doors: press B, then Spark holds the pad for Splash!", map:[
"####################",
"#...G..........U...#",
"#...G..........U...#",
"#...G..........U...#",
"#...G..........U...#",
"#...G....r.b...U...#",
"#...G....###...U...#",
"#...G..........U...#",
"#...G..B.....O.U...#",
"#...G.###...###U...#",
"#...G..........U...#",
"#.DrGFLL..SWW..Ubd.#",
"####################"]},
{ name:"The Grand Temple", hint:"Open the great gate, cross at the TOP, and gather every gem!", map:[
"####################",
"#.........G........#",
"#......rD.Gdb......#",
"#.....####G####....#",
"#.........G........#",
"#..r......G.....b..#",
"#.####....G...####.#",
"#.........G........#",
"#....Br...G..Bb....#",
"#...####..G.####...#",
"#.........G........#",
"#....WW.S.G.F.LL...#",
"####################"]}
];

const GDEF = [
  {gate:"G", btn:"B", hold:false},
  {gate:"H", btn:"C", hold:false},
  {gate:"Q", btn:"P", hold:true},
  {gate:"U", btn:"O", hold:true},
];

/* ================= AUDIO (Web Audio, no files needed) ================= */
const AudioSys = (() => {
  let actx=null, master=null, sfxG=null, musG=null, musTimer=null, step=0;
  const S = { volume:0.7, sfx:true, music:true };
  function init(){
    if(actx) return;
    try{
      actx = new (window.AudioContext||window.webkitAudioContext)();
      master = actx.createGain(); master.gain.value = S.volume; master.connect(actx.destination);
      sfxG = actx.createGain(); sfxG.connect(master);
      musG = actx.createGain(); musG.gain.value = 0.16; musG.connect(master);
      startMusic();
    }catch(e){ /* audio unsupported — play silently */ }
  }
  function tone(freq, dur, type="square", vol=0.25, slide=0, delay=0, dest){
    if(!actx || !S.sfx && dest!==musG) return;
    if(dest===musG && !S.music) return;
    const t = actx.currentTime + delay;
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if(slide) o.frequency.exponentialRampToValueAtTime(Math.max(30,freq+slide), t+dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t+dur);
    o.connect(g); g.connect(dest||sfxG);
    o.start(t); o.stop(t+dur+0.02);
  }
  function noise(dur, vol=0.3, delay=0){
    if(!actx || !S.sfx) return;
    const t = actx.currentTime + delay;
    const len = Math.floor(actx.sampleRate*dur);
    const buf = actx.createBuffer(1, len, actx.sampleRate);
    const d = buf.getChannelData(0);
    for(let i=0;i<len;i++) d[i] = (Math.random()*2-1) * (1-i/len);
    const src = actx.createBufferSource(); src.buffer = buf;
    const g = actx.createGain(); g.gain.value = vol;
    src.connect(g); g.connect(sfxG); src.start(t);
  }
  /* gentle generative cave music: soft pentatonic pad */
  const SCALE = [174.6, 196, 220, 261.6, 293.7, 349.2];
  function startMusic(){
    if(musTimer) return;
    musTimer = setInterval(()=>{
      if(!actx || !S.music) return;
      const root = SCALE[step % SCALE.length];
      tone(root,    2.4, "sine", 0.5, 0, 0,    musG);
      tone(root*1.5,2.4, "sine", 0.3, 0, 0.05, musG);
      if(step%2===0) tone(root*2, 1.6, "triangle", 0.18, 0, 0.4, musG);
      if(step%4===3) tone(SCALE[(step+2)%SCALE.length]*4, 0.5, "sine", 0.10, 0, 0.9, musG);
      step = (step + (Math.random()<0.4?2:1)) % 24;
    }, 1900);
  }
  return {
    init, S,
    setVolume(v){ S.volume=v; if(master) master.gain.value = v; },
    jump(){ tone(320, .14, "square", .16, 260); },
    land(){ noise(.05, .10); },
    gem(){ tone(880,.09,"sine",.22); tone(1320,.12,"sine",.20,0,.07); tone(1760,.16,"sine",.16,0,.14); },
    die(){ tone(280,.4,"sawtooth",.3,-240); noise(.35,.25); },
    press(){ tone(520,.08,"square",.22,-80); tone(700,.1,"square",.16,0,.06); },
    gate(){ noise(.3,.18); tone(90,.4,"sawtooth",.2,40); },
    padOff(){ tone(300,.12,"square",.14,-120); },
    ready(){ tone(1046,.15,"sine",.20); tone(1568,.2,"sine",.14,0,.1); },
    complete(){ [523,659,784,1046].forEach((f,i)=>tone(f,.28,"triangle",.25,0,i*.12)); },
    push(){ noise(.04,.05); },
    victory(){ [523,659,784,1046,784,1046,1318].forEach((f,i)=>tone(f,.3,"triangle",.25,0,i*.15)); },
  };
})();

/* ================= GAME STATE ================= */
const GRAV = 0.55, JUMP = 12.7, SPEED = 3.2;   // slower, more controllable movement
let levelIdx = 0, state = "title";
let stateTimer = 0, deathMsg = "", introT = 0, shake = 0, playFrames = 0, pushTick = 0;
let paused = false, wrongDoorMsg = "", wrongDoorT = 0;
let deaths = 0, fireGems = 0, waterGems = 0, totalFireGems = 0, totalWaterGems = 0;
let maxUnlocked = 0;
let solids, gems = null, groups, gateAt, doors, particles, boxes, lifts, tick = 0;
const keys = {};

function makePlayer(type){
  return {type, x:0, y:0, w:26, h:34, vx:0, vy:0,
          onGround:false, grace:0, coyote:0, jbuf:0, wasGround:false, face:1, dead:false};
}
let spark = makePlayer("fire"), splash = makePlayer("water");

function loadLevel(i, isRetry){
  if(isRetry && gems) for(const g of gems) if(g.got){
    if(g.type==="fire") fireGems--; else waterGems--;
  }
  const L = LEVELS[i], m = L.map;
  solids = new Set(); gems = []; doors = {}; particles = []; boxes = [];
  gateAt = {};
  groups = GDEF.map(g => ({...g, cells:[], triggers:[], open:false, anim:0, weighted:false}));
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
    const ch = m[r][c], X=c*TILE, Y=r*TILE;
    if(ch==="#") solids.add(c+","+r);
    else if(ch==="r") gems.push({c,r,type:"fire",got:false});
    else if(ch==="b") gems.push({c,r,type:"water",got:false});
    else if(ch==="D") doors.fire = {c,r};
    else if(ch==="d") doors.water = {c,r};
    else if(ch==="F"){ spark.x=X+7; spark.y=Y+TILE-spark.h; }
    else if(ch==="S"){ splash.x=X+7; splash.y=Y+TILE-splash.h; }
    else if(ch==="X") boxes.push({x:X+2, y:Y+TILE-36, w:36, h:36, vx:0, vy:0});
    else {
      for(let gi=0; gi<groups.length; gi++){
        if(ch===groups[gi].gate){ groups[gi].cells.push({c,r}); gateAt[c+","+r]=gi; }
        else if(ch===groups[gi].btn) groups[gi].triggers.push({c,r});
      }
    }
  }
  lifts = (L.lifts||[]).map(l => ({
    x:l.c*TILE, w:l.w*TILE, top:l.rTop*TILE, bot:l.rBot*TILE,
    y:l.rBot*TILE, dir:-1, speed:1.1, dy:0
  }));
  for(const p of [spark,splash]){
    p.vx=p.vy=0; p.dead=false; p.grace=0; p.coyote=0; p.jbuf=0;
  }
  introT = 150;
}
function countGems(){
  totalFireGems=0; totalWaterGems=0;
  for(const L of LEVELS) for(const row of L.map) for(const ch of row){
    if(ch==="r") totalFireGems++; if(ch==="b") totalWaterGems++;
  }
}
countGems();

const liquidAt = (c,r) => {
  const ch = (LEVELS[levelIdx].map[r]||"")[c];
  return (ch==="L"||ch==="W"||ch==="A") ? ch : null;
};
const isSolid = (c,r) => {
  if(c<0||c>=COLS||r<0||r>=ROWS) return true;
  if(solids.has(c+","+r)) return true;
  const gi = gateAt[c+","+r];
  if(gi!==undefined && !groups[gi].open) return true;
  return false;
};

/* ================= PHYSICS ================= */
function collideBody(p){
  let c0=Math.floor(p.x/TILE), c1=Math.floor((p.x+p.w-1)/TILE);
  let r0=Math.floor(p.y/TILE), r1=Math.floor((p.y+p.h-1)/TILE);
  for(let r=r0;r<=r1;r++){
    if(p.vx>0 && isSolid(c1,r)){ p.x = c1*TILE - p.w - 0.01; }
    if(p.vx<0 && isSolid(c0,r)){ p.x = (c0+1)*TILE + 0.01; }
  }
}
function collideVertical(p){
  p.onGround=false;
  const c0=Math.floor(p.x/TILE), c1=Math.floor((p.x+p.w-1)/TILE);
  const rBot = Math.floor((p.y+p.h)/TILE);   // inclusive feet — no flicker
  const rTop = Math.floor(p.y/TILE);
  for(let c=c0;c<=c1;c++){
    if(p.vy>=0 && isSolid(c,rBot)){ p.y = rBot*TILE - p.h; p.vy=0; p.onGround=true; }
    if(p.vy<0 && isSolid(c,rTop)){ p.y = (rTop+1)*TILE + 0.01; p.vy=0; }
  }
}
function movePlayer(p, left, right){
  p.vx = (right?SPEED:0) - (left?SPEED:0);
  if(p.vx>0)p.face=1; else if(p.vx<0)p.face=-1;
  // coyote time + jump buffering = forgiving, responsive jumps
  if(p.onGround) p.coyote = 7; else if(p.coyote>0) p.coyote--;
  if(p.jbuf>0 && p.coyote>0){
    p.vy = -JUMP; p.coyote = 0; p.jbuf = 0;
    AudioSys.jump();
  } else if(p.jbuf>0) p.jbuf--;
  p.vy = Math.min(p.vy + GRAV, 13);
  p.x += p.vx; collideBody(p);
  p.wasGround = p.onGround;
  p.y += p.vy; collideVertical(p);
  p.grace = p.onGround ? 8 : Math.max(0, p.grace-1);   // "recently grounded" window
  if(p.onGround && !p.wasGround){
    AudioSys.land();
    for(let i=0;i<5;i++) particles.push({x:p.x+p.w/2+(Math.random()-0.5)*16, y:p.y+p.h,
      vx:(Math.random()-0.5)*1.5, vy:-Math.random()*1.2, life:16, col:"#8a7bb0"});
  }
}
function moveBox(b){
  b.vy = Math.min(b.vy + GRAV, 13);
  b.y += b.vy; collideVertical(b);
}
function rectsOverlap(a,bx,by,bw,bh){
  return a.x < bx+bw && a.x+a.w > bx && a.y < by+bh && a.y+a.h > by;
}
function feetLiquid(p){
  const feet = p.y + p.h;
  const fy = Math.floor((feet-6)/TILE);
  const depth = feet - fy*TILE;
  if(depth <= 30) return null;
  const cA = Math.floor((p.x+6)/TILE), cB = Math.floor((p.x+p.w-6)/TILE);
  for(const c of [cA,cB]){ const l = liquidAt(c,fy); if(l) return l; }
  return null;
}
function overlapTile(p,c,r,pad=6){
  return p.x+p.w-pad > c*TILE && p.x+pad < (c+1)*TILE &&
         p.y+p.h-pad > r*TILE && p.y+pad < (r+1)*TILE;
}
/* BULLETPROOF door check: overlapping the door tile while grounded,
   recently grounded, or nearly motionless vertically. Timing can
   never make two waiting characters "miss" each other again. */
const restingOnDoor = p => {
  const d = p.type==="fire" ? doors.fire : doors.water;
  return !!d && overlapTile(p, d.c, d.r, 4) &&
         (p.onGround || p.grace > 0 || Math.abs(p.vy) < 2);
};
const onWrongDoor = p => {
  const d = p.type==="fire" ? doors.water : doors.fire;
  return !!d && overlapTile(p, d.c, d.r, 4) && p.onGround;
};

function kill(p, msg){
  if(p.dead || state!=="play") return;
  p.dead = true; deaths++; deathMsg = msg; state="dead"; stateTimer=70; shake=12;
  AudioSys.die();
  const col = p.type==="fire" ? "#ff8b3d" : "#59b7ff";
  for(let i=0;i<26;i++) particles.push({
    x:p.x+p.w/2, y:p.y+p.h/2,
    vx:(Math.random()-0.5)*6, vy:-Math.random()*6-1,
    life:40+Math.random()*20, col
  });
}

/* ================= UPDATE ================= */
let readyState = 0; // for door-ready chime
function update(){
  tick++;
  if(state==="play"){
    playFrames++;
    // elevators
    for(const l of lifts){
      const oldY = l.y;
      l.y += l.dir*l.speed;
      if(l.y < l.top){ l.y = l.top; l.dir = 1; }
      if(l.y > l.bot){ l.y = l.bot; l.dir = -1; }
      l.dy = l.y - oldY;
    }
    for(const b of boxes) moveBox(b);
    movePlayer(spark,  keys["KeyA"], keys["KeyD"]);
    movePlayer(splash, keys["ArrowLeft"], keys["ArrowRight"]);
    // crates: stand on / push / block
    for(const b of boxes){
      for(const p of [spark,splash]){
        if(!rectsOverlap(p, b.x, b.y, b.w, b.h)) continue;
        const pBottom = p.y+p.h;
        if(p.vy>=0 && pBottom - b.y < 14){
          p.y = b.y - p.h; p.vy = 0; p.onGround = true; p.grace = 8;
        } else if(p.vx !== 0){
          b.x += Math.sign(p.vx)*1.2;
          const bc0=Math.floor(b.x/TILE), bc1=Math.floor((b.x+b.w-1)/TILE);
          const br0=Math.floor(b.y/TILE), br1=Math.floor((b.y+b.h-1)/TILE);
          for(let r=br0;r<=br1;r++){
            if(p.vx>0 && isSolid(bc1,r)) b.x = bc1*TILE - b.w - 0.01;
            if(p.vx<0 && isSolid(bc0,r)) b.x = (bc0+1)*TILE + 0.01;
          }
          if(p.vx>0) p.x = b.x - p.w - 0.01; else p.x = b.x + b.w + 0.01;
          if(tick - pushTick > 9){ AudioSys.push(); pushTick = tick; }
        } else {
          if(p.x < b.x) p.x = b.x - p.w - 0.01; else p.x = b.x + b.w + 0.01;
        }
      }
    }
    // elevators carry riders (one-way from above)
    for(const l of lifts){
      for(const p of [spark,splash]){
        const feet = p.y+p.h;
        if(p.vy>=0 && p.x+p.w > l.x+4 && p.x < l.x+l.w-4 &&
           feet >= l.y-10 && feet <= l.y+16){
          p.y = l.y - p.h; p.vy = 0; p.onGround = true; p.grace = 8;
        }
      }
    }
    // gate groups
    for(const g of groups){
      if(!g.cells.length && !g.triggers.length) continue;
      g.weighted = g.triggers.some(t =>
        overlapTile(spark,t.c,t.r,4) || overlapTile(splash,t.c,t.r,4) ||
        boxes.some(b => b.x+b.w-6 > t.c*TILE && b.x+6 < (t.c+1)*TILE &&
                        b.y+b.h-4 > t.r*TILE && b.y+4 < (t.r+1)*TILE));
      if(g.hold){
        let want = g.weighted;
        if(!want){
          const occ = g.cells.some(cell =>
            overlapTile(spark,cell.c,cell.r,2) || overlapTile(splash,cell.c,cell.r,2) ||
            boxes.some(b => rectsOverlap(b, cell.c*TILE, cell.r*TILE, TILE, TILE)));
          if(occ) want = true;
        }
        if(want && !g.open){ g.open = true; puffs(g); AudioSys.gate(); }
        if(!want && g.open){ g.open = false; AudioSys.padOff(); }
      } else {
        if(g.weighted && !g.open){ g.open = true; puffs(g); AudioSys.press(); AudioSys.gate(); }
      }
      g.anim += ((g.open?1:0) - g.anim)*0.15;
    }
    // hazards
    const lf = feetLiquid(spark);
    if(lf==="W") kill(spark, "Spark can't swim! Water puts fire out…");
    if(lf==="A") kill(spark, "Acid is bad for everyone. Even fire.");
    const lw = feetLiquid(splash);
    if(lw==="L") kill(splash, "Splash can't touch lava — it's too hot!");
    if(lw==="A") kill(splash, "Acid is bad for everyone. Even water.");
    // gems
    for(const g of gems){
      if(g.got) continue;
      const p = g.type==="fire" ? spark : splash;
      if(overlapTile(p,g.c,g.r,2)){
        g.got=true; if(g.type==="fire") fireGems++; else waterGems++;
        AudioSys.gem();
        const col = g.type==="fire" ? "#ff5d5d" : "#5db8ff";
        for(let i=0;i<12;i++) particles.push({x:g.c*TILE+20,y:g.r*TILE+20,
          vx:(Math.random()-0.5)*4, vy:(Math.random()-0.5)*4, life:26, col});
      }
    }
    // wrong-door helper
    if(onWrongDoor(spark)){ wrongDoorMsg="That door is Splash's — Spark's door glows ORANGE!"; wrongDoorT=90; }
    if(onWrongDoor(splash)){ wrongDoorMsg="That door is Spark's — Splash's door glows BLUE!"; wrongDoorT=90; }
    if(wrongDoorT>0) wrongDoorT--;
    // doors
    const a = restingOnDoor(spark), b2 = restingOnDoor(splash);
    const nowReady = (a?1:0)+(b2?1:0);
    if(nowReady>readyState) AudioSys.ready();
    readyState = nowReady;
    if(a && b2){
      state="complete"; stateTimer=90; AudioSys.complete();
      maxUnlocked = Math.max(maxUnlocked, Math.min(levelIdx+1, LEVELS.length-1));
      for(const d of [doors.fire, doors.water]) for(let i=0;i<16;i++)
        particles.push({x:d.c*TILE+20, y:d.r*TILE+20,
          vx:(Math.random()-0.5)*5, vy:-Math.random()*5, life:40, col:"#8dff9d"});
    }
  }
  else if(state==="dead"){
    if(--stateTimer<=0){ loadLevel(levelIdx, true); state="play"; }
  }
  else if(state==="complete"){
    if(--stateTimer<=0){
      levelIdx++;
      if(levelIdx>=LEVELS.length){ state="victory"; AudioSys.victory(); }
      else { loadLevel(levelIdx, false); state="play"; }
    }
  }
  if(shake>0) shake *= 0.85;
  for(const pt of particles){ pt.x+=pt.vx; pt.y+=pt.vy; pt.vy+=0.18; pt.life--; }
  particles = particles.filter(p=>p.life>0);
}
function puffs(g){
  for(const t of g.triggers) for(let i=0;i<10;i++)
    particles.push({x:t.c*TILE+20, y:t.r*TILE+30,
      vx:(Math.random()-0.5)*3, vy:-Math.random()*3, life:24, col:"#ffe066"});
}

/* ================= RENDER ================= */
const GROUP_COL = ["#8b8ba8", "#c99a5b", "#4fd8c4", "#b48bff"];
function rr(x,y,w,h,r){ cx.beginPath(); cx.roundRect(x,y,w,h,r); }
function drawBackground(){
  const g = cx.createLinearGradient(0,0,0,cv.height);
  g.addColorStop(0,"#1e1136"); g.addColorStop(1,"#0e0619");
  cx.fillStyle=g; cx.fillRect(0,0,cv.width,cv.height);
  cx.save(); cx.globalAlpha=0.12;
  for(let i=0;i<14;i++){
    const x=(i*137)%800, y=60+(i*97)%380, s=8+(i*13)%18;
    cx.fillStyle = i%2 ? "#9b7bff" : "#5bd0ff";
    cx.beginPath(); cx.moveTo(x,y-s); cx.lineTo(x+s*0.6,y); cx.lineTo(x,y+s); cx.lineTo(x-s*0.6,y); cx.closePath(); cx.fill();
  }
  cx.restore();
}
function drawTiles(){
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
    const X=c*TILE, Y=r*TILE, ch=LEVELS[levelIdx].map[r][c];
    if(ch==="#"){
      cx.fillStyle="#3a2b52"; cx.fillRect(X,Y,TILE,TILE);
      cx.fillStyle="#57427a"; cx.fillRect(X,Y,TILE,4);
      cx.fillStyle="rgba(0,0,0,.25)"; cx.fillRect(X,Y+TILE-4,TILE,4);
      cx.fillStyle="rgba(255,255,255,.05)";
      if((c*7+r*13)%3===0) cx.fillRect(X+8,Y+12,6,6);
    }
    else if(ch==="L"||ch==="W"||ch==="A"){
      const wave = Math.sin(tick*0.08 + c)*2;
      const top = Y+TILE*0.45+wave;
      let base, glow;
      if(ch==="L"){ base="#e8420f"; glow="#ffb347"; }
      else if(ch==="W"){ base="#1670d8"; glow="#8fd8ff"; }
      else { base="#3fae00"; glow="#b6ff5e"; }
      cx.fillStyle=base; cx.fillRect(X,top,TILE,Y+TILE-top);
      cx.fillStyle=glow; cx.globalAlpha=0.8; cx.fillRect(X,top,TILE,3); cx.globalAlpha=1;
      if((tick+c*17)%50<25){
        cx.fillStyle=glow; cx.globalAlpha=0.5;
        cx.beginPath(); cx.arc(X+10+(c%3)*8, top+10+((tick/4+c*5)%14), 2.2,0,7); cx.fill();
        cx.globalAlpha=1;
      }
    }
  }
}
function drawGates(){
  for(let gi=0; gi<groups.length; gi++){
    const g = groups[gi];
    if(!g.cells.length || g.anim>=0.99) continue;
    const col = GROUP_COL[gi];
    for(const cell of g.cells){
      const X=cell.c*TILE, Y=cell.r*TILE, slide = g.anim*TILE;
      cx.save();
      cx.beginPath(); cx.rect(X,Y,TILE,TILE); cx.clip();
      cx.translate(0,-slide);
      cx.fillStyle=col; cx.globalAlpha=0.9; cx.fillRect(X+5,Y,TILE-10,TILE); cx.globalAlpha=1;
      cx.fillStyle="rgba(0,0,0,.35)";
      for(let i=0;i<3;i++) cx.fillRect(X+8, Y+6+i*12, TILE-16, 4);
      if(g.hold){
        cx.strokeStyle="rgba(255,255,255,.6)"; cx.lineWidth=2;
        cx.beginPath(); cx.arc(X+20, Y+20, 5, 0, 7); cx.stroke();
      }
      cx.restore();
    }
  }
}
function drawTriggers(){
  for(let gi=0; gi<groups.length; gi++){
    const g = groups[gi];
    for(const t of g.triggers){
      const X=t.c*TILE, Y=t.r*TILE;
      const active = g.hold ? g.weighted : g.open;
      const col = GROUP_COL[gi];
      const h = active?4:9;
      cx.fillStyle="#2c2140"; cx.fillRect(X+6,Y+TILE-6,TILE-12,6);
      cx.fillStyle = active ? "#ffe066" : (g.hold ? col : "#c9a34a");
      rr(X+8,Y+TILE-6-h,TILE-16,h,3); cx.fill();
      if(g.hold && !active){
        cx.fillStyle=col; cx.globalAlpha=0.5+0.3*Math.sin(tick*0.15);
        cx.beginPath();
        cx.moveTo(X+20, Y+18); cx.lineTo(X+26, Y+10); cx.lineTo(X+14, Y+10); cx.closePath(); cx.fill();
        cx.globalAlpha=1;
      }
      if(active){
        cx.globalAlpha=0.35; cx.fillStyle="#ffe066";
        cx.beginPath(); cx.arc(X+TILE/2,Y+TILE-8,14,0,7); cx.fill(); cx.globalAlpha=1;
        // energy link from pad to its gates while held
        if(g.hold && g.cells.length){
          let mx=0,my=0; for(const c of g.cells){ mx+=c.c*TILE+20; my+=c.r*TILE+20; }
          mx/=g.cells.length; my/=g.cells.length;
          cx.strokeStyle=col; cx.globalAlpha=0.25+0.15*Math.sin(tick*0.2);
          cx.setLineDash([4,6]); cx.lineWidth=2;
          cx.beginPath(); cx.moveTo(X+20, Y+20); cx.lineTo(mx, my); cx.stroke();
          cx.setLineDash([]); cx.globalAlpha=1;
        }
      }
    }
  }
}
function drawLifts(){
  for(const l of lifts){
    cx.strokeStyle="rgba(255,255,255,.18)"; cx.lineWidth=2;
    cx.beginPath();
    cx.moveTo(l.x+8, l.top-30); cx.lineTo(l.x+8, l.y);
    cx.moveTo(l.x+l.w-8, l.top-30); cx.lineTo(l.x+l.w-8, l.y);
    cx.stroke();
    cx.fillStyle="#5f6c8c"; rr(l.x, l.y, l.w, 12, 4); cx.fill();
    cx.fillStyle="#8fa1c9"; cx.fillRect(l.x+2, l.y+2, l.w-4, 3);
    cx.fillStyle="#ffd23f";
    for(let i=0;i<l.w/20;i++) cx.fillRect(l.x+4+i*20, l.y+7, 10, 3);
  }
}
function drawBoxes(){
  for(const b of boxes){
    cx.fillStyle="#9a6a38"; rr(b.x, b.y, b.w, b.h, 4); cx.fill();
    cx.strokeStyle="#5e3d1c"; cx.lineWidth=3;
    rr(b.x+2, b.y+2, b.w-4, b.h-4, 3); cx.stroke();
    cx.beginPath();
    cx.moveTo(b.x+4,b.y+4); cx.lineTo(b.x+b.w-4,b.y+b.h-4);
    cx.moveTo(b.x+b.w-4,b.y+4); cx.lineTo(b.x+4,b.y+b.h-4);
    cx.stroke();
  }
}
function drawGems(){
  for(const g of gems){
    if(g.got) continue;
    const X=g.c*TILE+TILE/2, Y=g.r*TILE+TILE/2 + Math.sin(tick*0.1+g.c)*2.5;
    const col = g.type==="fire" ? "#ff5d5d" : "#4db1ff";
    const lite = g.type==="fire" ? "#ffc2c2" : "#c9e9ff";
    cx.save(); cx.translate(X,Y); cx.rotate(Math.sin(tick*0.05+g.r)*0.15);
    cx.fillStyle=col;
    cx.beginPath(); cx.moveTo(0,-11); cx.lineTo(8,0); cx.lineTo(0,11); cx.lineTo(-8,0); cx.closePath(); cx.fill();
    cx.fillStyle=lite; cx.beginPath(); cx.moveTo(0,-11); cx.lineTo(8,0); cx.lineTo(0,-2); cx.closePath(); cx.fill();
    cx.restore();
    cx.globalAlpha=0.18; cx.fillStyle=col;
    cx.beginPath(); cx.arc(X,Y,15,0,7); cx.fill(); cx.globalAlpha=1;
  }
}
function drawDoor(d, type){
  if(!d) return;
  const X=d.c*TILE, Y=d.r*TILE;
  const col  = type==="fire" ? "#ff7a2f" : "#3fa9ff";
  const hot  = type==="fire" ? "#ffd23f" : "#a8e6ff";
  const dark = type==="fire" ? "#5c1e00" : "#062b52";
  const beam = cx.createLinearGradient(0, Y-70, 0, Y+TILE);
  beam.addColorStop(0, "rgba(0,0,0,0)");
  beam.addColorStop(1, type==="fire" ? "rgba(255,140,60,.4)" : "rgba(80,180,255,.4)");
  cx.fillStyle = beam;
  cx.fillRect(X+4, Y-70, TILE-8, 70+TILE);
  cx.fillStyle=dark;
  cx.beginPath();
  cx.moveTo(X+5,Y+TILE); cx.lineTo(X+5,Y+15);
  cx.arc(X+TILE/2, Y+15, TILE/2-5, Math.PI, 0);
  cx.lineTo(X+TILE-5,Y+TILE); cx.closePath(); cx.fill();
  cx.strokeStyle=col; cx.lineWidth=3; cx.stroke();
  cx.globalAlpha = 0.45 + 0.2*Math.sin(tick*0.12);
  cx.fillStyle=hot;
  cx.beginPath();
  cx.moveTo(X+11,Y+TILE-2); cx.lineTo(X+11,Y+18);
  cx.arc(X+TILE/2, Y+18, TILE/2-11, Math.PI, 0);
  cx.lineTo(X+TILE-11,Y+TILE-2); cx.closePath(); cx.fill();
  cx.globalAlpha=1;
  cx.fillStyle=dark;
  cx.beginPath();
  if(type==="fire"){
    cx.moveTo(X+20, Y+16);
    cx.quadraticCurveTo(X+27, Y+24, X+20, Y+32);
    cx.quadraticCurveTo(X+13, Y+24, X+20, Y+16);
  } else {
    cx.moveTo(X+20, Y+15);
    cx.quadraticCurveTo(X+28, Y+27, X+20, Y+32);
    cx.quadraticCurveTo(X+12, Y+27, X+20, Y+15);
  }
  cx.fill();
}
function drawDoorStatus(d, p){
  if(!d) return;
  const X=d.c*TILE+TILE/2, Y=d.r*TILE+TILE/2;
  if(restingOnDoor(p)){
    cx.strokeStyle="#7dff9b"; cx.lineWidth=3;
    cx.globalAlpha=0.85+0.15*Math.sin(tick*0.25);
    cx.beginPath(); cx.arc(X, Y, 24, 0, 7); cx.stroke();
    cx.globalAlpha=1;
    cx.fillStyle="#7dff9b"; cx.font="bold 15px Trebuchet MS"; cx.textAlign="center";
    cx.fillText("✓", X, Y-30); cx.textAlign="left";
  }
}
function drawPlayer(p){
  if(p.dead) return;
  const {x,y,w,h}=p;
  const fire = p.type==="fire";
  const body = fire ? "#ff7a2f" : "#3fa9ff";
  const glow = fire ? "#ffd23f" : "#a8e6ff";
  // soft motion trail
  if(Math.abs(p.vx)>0.5 || Math.abs(p.vy)>2){
    cx.globalAlpha=0.10; cx.fillStyle=glow;
    cx.beginPath(); cx.arc(x+w/2-p.vx*2, y+h/2-p.vy*1.5, 16, 0, 7); cx.fill();
  }
  cx.globalAlpha=0.20; cx.fillStyle=glow;
  cx.beginPath(); cx.arc(x+w/2,y+h/2,24,0,7); cx.fill(); cx.globalAlpha=1;
  cx.fillStyle=body; rr(x,y+6,w,h-6,9); cx.fill();
  cx.fillStyle=glow;
  if(fire){
    const f = Math.sin(tick*0.3)*2;
    cx.beginPath();
    cx.moveTo(x+4,y+10); cx.quadraticCurveTo(x+w/2, y-8+f, x+w-4, y+10);
    cx.quadraticCurveTo(x+w/2, y+2, x+4, y+10); cx.fill();
  } else {
    cx.beginPath();
    cx.moveTo(x+w/2, y-6+Math.sin(tick*0.15)*1.5);
    cx.quadraticCurveTo(x+w-4, y+8, x+w/2, y+10);
    cx.quadraticCurveTo(x+4, y+8, x+w/2, y-6+Math.sin(tick*0.15)*1.5);
    cx.fill();
  }
  const ex = x+w/2 + p.face*4;
  cx.fillStyle="#fff";
  cx.beginPath(); cx.arc(ex-6,y+18,4.4,0,7); cx.arc(ex+6,y+18,4.4,0,7); cx.fill();
  cx.fillStyle="#1a1a2a";
  cx.beginPath(); cx.arc(ex-6+p.face*1.6,y+18,2,0,7); cx.arc(ex+6+p.face*1.6,y+18,2,0,7); cx.fill();
  cx.strokeStyle="rgba(0,0,0,.45)"; cx.lineWidth=2;
  cx.beginPath(); cx.arc(x+w/2, y+25, 5, 0.2*Math.PI, 0.8*Math.PI); cx.stroke();
}
function drawParticles(){
  for(const p of particles){
    cx.globalAlpha = Math.max(p.life/40, 0);
    cx.fillStyle=p.col;
    cx.beginPath(); cx.arc(p.x,p.y,3,0,7); cx.fill();
  }
  cx.globalAlpha=1;
}
function fmtTime(f){
  const s = Math.floor(f/60), m = Math.floor(s/60);
  return m+":"+String(s%60).padStart(2,"0");
}
function drawHUD(){
  cx.fillStyle="rgba(10,4,20,.65)";
  cx.fillRect(0,0,cv.width,26);
  cx.font="13px Trebuchet MS"; cx.textBaseline="middle";
  cx.fillStyle="#e8ddff"; cx.textAlign="left";
  cx.fillText("Level "+(levelIdx+1)+"/"+LEVELS.length+" · "+LEVELS[levelIdx].name, 12, 13);
  cx.textAlign="right";
  cx.fillStyle="#9c8bbd"; cx.fillText(fmtTime(playFrames), 520, 13);
  cx.fillStyle="#ff8b6b"; cx.fillText("♦ " + fireGems + "/" + totalFireGems, 620, 13);
  cx.fillStyle="#7cc4ff"; cx.fillText("♦ " + waterGems + "/" + totalWaterGems, 692, 13);
  cx.fillStyle="#cfa9ff"; cx.fillText("✖ " + deaths, 748, 13);
  cx.textAlign="left";
}
function overlay(a){ cx.fillStyle="rgba(8,3,18,"+a+")"; cx.fillRect(0,0,cv.width,cv.height); }
function centerText(txt, y, size, col){
  cx.font="bold "+size+"px Trebuchet MS"; cx.textAlign="center"; cx.fillStyle=col;
  cx.fillText(txt, cv.width/2, y); cx.textAlign="left";
}
function render(){
  cx.save();
  if(shake>0.5) cx.translate((Math.random()-0.5)*shake, (Math.random()-0.5)*shake);
  drawBackground();
  if(state==="title"){
    centerText("SPARK & SPLASH", 170, 52, "#ffffff");
    centerText("Crystal Caverns Adventure · "+LEVELS.length+" Levels", 210, 22, "#b79bff");
    spark.x=330; spark.y=252; spark.face=1;
    splash.x=444; splash.y=252; splash.face=-1;
    drawPlayer(spark); drawPlayer(splash);
    centerText("Buttons, hold-pads, crates and elevators await…", 342, 17, "#e8ddff");
    centerText("Spark: A / D / W      Splash: ← / → / ↑      P: pause      R: restart", 370, 15, "#bfaee0");
    if(Math.floor(tick/30)%2===0) centerText("Press ENTER or SPACE to start", 430, 18, "#ffe066");
    cx.restore(); return;
  }
  if(state==="victory"){
    centerText("YOU DID IT!", 170, 52, "#ffe066");
    centerText("Spark & Splash escaped all "+LEVELS.length+" caverns!", 216, 20, "#e8ddff");
    centerText("Gems: " + (fireGems+waterGems) + " / " + (totalFireGems+totalWaterGems) +
               "     Slips: " + deaths + "     Time: " + fmtTime(playFrames), 266, 18, "#b79bff");
    if(Math.floor(tick/30)%2===0) centerText("Press ENTER to play again", 340, 18, "#ffe066");
    cx.restore(); return;
  }
  drawTiles(); drawGates(); drawLifts(); drawTriggers(); drawBoxes(); drawGems();
  drawDoor(doors.fire,"fire"); drawDoor(doors.water,"water");
  drawPlayer(spark); drawPlayer(splash);
  drawDoorStatus(doors.fire, spark); drawDoorStatus(doors.water, splash);
  drawParticles(); drawHUD();

  if(state==="play"){
    const a = restingOnDoor(spark), b = restingOnDoor(splash);
    if(a !== b) centerText("Both friends must stand on their doors!", 500, 14, "rgba(232,221,255,.85)");
    if(wrongDoorT>0) centerText(wrongDoorMsg, 478, 14, "rgba(255,220,120,.9)");
    if(introT>0){
      introT--;
      const al = Math.min(1, introT/40);
      cx.globalAlpha = al;
      cx.fillStyle="rgba(10,4,24,.75)";
      cx.fillRect(100, 190, 600, 110);
      centerText("Level "+(levelIdx+1)+" — "+LEVELS[levelIdx].name, 232, 26, "#ffffff");
      centerText(LEVELS[levelIdx].hint, 268, 15, "#c9b8f0");
      cx.globalAlpha=1;
    }
  }
  if(state==="dead"){
    overlay(0.45);
    centerText("Oops!", 230, 40, "#ff8b6b");
    centerText(deathMsg, 270, 18, "#ffffff");
  }
  if(state==="complete"){
    overlay(0.45);
    centerText("LEVEL COMPLETE!", 250, 40, "#8dff9d");
  }
  if(paused){
    overlay(0.55);
    centerText("PAUSED", 250, 44, "#ffffff");
    centerText("Press P to resume — or use the ⚙ menu", 290, 16, "#c9b8f0");
  }
  cx.restore();
}

/* ================= INPUT / SETTINGS / LOOP ================= */
function startGame(atLevel=0){
  levelIdx=atLevel; deaths=0; fireGems=0; waterGems=0; gems=null; playFrames=0;
  loadLevel(atLevel, false); state="play"; paused=false;
}
window.addEventListener("keydown", e=>{
  if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Space"].includes(e.code)) e.preventDefault();
  AudioSys.init();
  if(e.code==="KeyW" && !keys["KeyW"]) spark.jbuf = 7;              // jump buffering
  if(e.code==="ArrowUp" && !keys["ArrowUp"]) splash.jbuf = 7;
  keys[e.code]=true;
  if(e.code==="Enter"||e.code==="Space"){
    if(state==="title") startGame(0);
    else if(state==="victory") state="title";
  }
  if(e.code==="KeyR" && state==="play" && !paused) loadLevel(levelIdx, true);
  if(e.code==="KeyP" && state!=="title") togglePause();
  if(e.code==="Escape") togglePanel();
});
window.addEventListener("keyup", e=>{ keys[e.code]=false; });
cv.addEventListener("click", ()=>{ AudioSys.init(); if(state==="title") startGame(0); });

/* settings panel */
const panel = document.getElementById("panel");
const lvlSel = document.getElementById("lvlSel");
function togglePause(force){
  paused = force!==undefined ? force : !paused;
  if(!paused) panel.classList.remove("open");
}
function togglePanel(){
  const opening = !panel.classList.contains("open");
  if(opening){
    lvlSel.innerHTML = "";
    for(let i=0;i<=maxUnlocked;i++){
      const o=document.createElement("option");
      o.value=i; o.textContent=(i+1)+". "+LEVELS[i].name;
      if(i===levelIdx) o.selected=true;
      lvlSel.appendChild(o);
    }
    panel.classList.add("open");
    if(state==="play") togglePause(true);
  } else {
    panel.classList.remove("open");
  }
}
document.getElementById("gearBtn").addEventListener("click", ()=>{ AudioSys.init(); togglePanel(); });
document.getElementById("resumeBtn").addEventListener("click", ()=>{ panel.classList.remove("open"); togglePause(false); });
document.getElementById("restartBtn").addEventListener("click", ()=>{
  panel.classList.remove("open");
  if(state==="title") startGame(0); else { loadLevel(levelIdx, true); state="play"; }
  togglePause(false);
});
lvlSel.addEventListener("change", ()=>{
  const i = parseInt(lvlSel.value,10);
  panel.classList.remove("open");
  if(state==="title"){ startGame(i); } else { levelIdx=i; loadLevel(i, false); state="play"; }
  togglePause(false);
});
document.getElementById("volSlider").addEventListener("input", e=>{
  AudioSys.setVolume(e.target.value/100);
});
document.getElementById("sfxChk").addEventListener("change", e=>{ AudioSys.S.sfx = e.target.checked; });
document.getElementById("musChk").addEventListener("change", e=>{ AudioSys.S.music = e.target.checked; });

loadLevel(0, false);
(function loop(){ if(!paused) update(); render(); requestAnimationFrame(loop); })();
})();
