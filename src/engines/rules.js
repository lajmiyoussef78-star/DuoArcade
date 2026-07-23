// engines/rules.js — the house rulebook. One block per game, keyed by engine id.
// Shown in-game via the "Rules" button in GameScreen.
// Edit any text freely — it's just words, nothing here affects gameplay.

export const RULES = {

  /* ================= turn-based classics ================= */

  ttt: {
    goal: 'Get three of your marks in a row.',
    how: [
      'Take turns placing your mark on the 3\u00d73 grid.',
      'Three in a row \u2014 across, down, or diagonal \u2014 wins the round.',
      'If the grid fills with no line, it\u2019s a draw.'
    ],
    tip: 'Take the center. If it\u2019s gone, take a corner.'
  },

  connect4: {
    goal: 'Line up four discs before your partner does.',
    how: [
      'Take turns dropping a disc into a column \u2014 it falls to the lowest free slot.',
      'Four in a row wins: across, down, or diagonal.',
      'If the board fills with no line, it\u2019s a draw.'
    ],
    tip: 'Build two threats at once \u2014 one can be blocked, two can\u2019t.'
  },

  dots: {
    goal: 'Claim the most boxes out of 16.',
    how: [
      'Take turns drawing one edge between two dots.',
      'Complete the fourth side of a box \u2014 it\u2019s yours, and you go again.',
      'When all boxes are claimed, most boxes wins.'
    ],
    tip: 'Late game, count the chains \u2014 whoever opens the long one usually loses it.'
  },

  reversi: {
    goal: 'Finish with more discs than your partner.',
    how: [
      'Place a disc so it sandwiches a line of enemy discs between two of yours.',
      'Every sandwiched disc flips to your color.',
      'Each move must flip at least one disc; if you can\u2019t move, the turn passes.',
      'When neither can move, most discs on the board wins.'
    ],
    tip: 'Corners never flip back. Fewer discs mid-game is often stronger.'
  },

  gomoku: {
    goal: 'Get five stones in a row.',
    how: [
      'Take turns placing a stone on any empty point.',
      'First to five in a row \u2014 across, down, or diagonal \u2014 wins.'
    ],
    tip: 'An open four (four in a row with both ends free) can\u2019t be stopped \u2014 spot it a move early.'
  },

  memory: {
    goal: 'Collect the most pairs.',
    how: [
      'All cards start face down. On your turn, flip two.',
      'A match is yours to keep \u2014 and you flip again.',
      'No match? They turn back over and the turn passes.',
      'Most pairs when the table is empty wins.'
    ],
    tip: 'Your partner\u2019s misses are free information \u2014 memorize THEIR flips, not just yours.'
  },

  /* ================= realtime arcade ================= */

  pong: {
    goal: 'First to 7 points takes the match.',
    how: [
      'Both play live \u2014 no turns. Move your paddle to return the ball.',
      'Miss the ball and your partner scores.',
      'The ball speeds up as the rally goes on. So do the arguments.'
    ],
    tip: 'Hit with the paddle\u2019s edge to change the angle.'
  },

  sparksplash: {
    goal: 'Clear all 18 caverns together \u2014 each on your own screen.',
    how: [
      'Player A is Spark (fire): A/D to move, W to jump.',
      'Player B is Splash (water): arrow keys to move and jump.',
      'Both of you must stand on your own glowing doors at the same time to finish each level.',
      'Lava hurts Splash; water hurts Spark; acid hurts both. Buttons, crates, and lifts are shared puzzle state.'
    ],
    tip: 'Talk to each other \u2014 hold pads, gates, and elevators need coordination.'
  },

  readysetcook: {
    goal: 'Serve as many customers as you can before the kitchen closes.',
    how: [
      'Pick the same kitchen map as your partner, then cook together.',
      'WASD to move \u00b7 E to interact \u00b7 Q to drop \u00b7 Space to throw \u00b7 H for help.',
      'Grab ingredients, prep at stations, plate orders, and serve customers before they walk out.',
      'When the shift ends, your score counts as a co-op evening together.'
    ],
    tip: 'Split jobs \u2014 one chops, one plates. Closing time stops new orders, so finish what\u2019s on the pass.'
  },

  stickmanswordduel: {
    goal: 'Win three rounds in a neon sword duel on the same keyboard.',
    how: [
      'Couch co-op: both players on one device / one screen. Host (A) starts the match and reports the winner.',
      'Pick an arena, then fight best of 5 (first to 3).',
      'P1: A/D move \u00b7 W jump \u00b7 S dash \u00b7 F attack \u00b7 G block \u00b7 H kick.',
      'P2: \u2190/\u2192 move \u00b7 \u2191 jump \u00b7 \u2193 dash \u00b7 K attack \u00b7 L block \u00b7 J kick.',
      'Tap attack up to three times for a combo; hold attack to charge a heavy; dash+attack lunges; air+attack plunges.',
      'Perfect-timed block = parry. Kick breaks a raised guard.'
    ],
    tip: 'Don\u2019t spam heavies \u2014 a parry beats everything, including a charged swing.'
  },

  stickmanarchery: {
    goal: 'Win a best-of-3 neon archery duel on the same keyboard.',
    how: [
      'Couch co-op: both players on one device / one screen. Host (A) starts the match and reports the winner.',
      'Pick a map: Moonlit Meadow, Fortress Walls, or Storm Peaks.',
      'P1: A/D move \u00b7 W jump \u00b7 R/F aim \u00b7 SPACE hold-draw, release-fire.',
      'P2: \u2190/\u2192 move \u00b7 \u2191 jump \u00b7 K/J aim \u00b7 ENTER hold-draw, release-fire.',
      'Move and jump anytime to dodge. Balloons grant triple, explosive, or ice arrows.'
    ],
    tip: 'Arc over barriers \u2014 and release in the green power zone for max range.'
  },

  stickmandodgeball: {
    goal: 'Be the last stickman standing in a neon hazard storm.',
    how: [
      'Couch co-op: both players on one device / one screen. Host (A) starts the match and reports the winner.',
      'Pick Quick, Best of 3, or Best of 5, then choose one of 6 arenas.',
      'P1: A/D move \u00b7 W jump (double) \u00b7 S slide \u00b7 F dash.',
      'P2: \u2190/\u2192 move \u00b7 \u2191 jump (double) \u00b7 \u2193 slide \u00b7 / dash.',
      'Dodge falling hazards, grab power-ups, survive arena events every 20 seconds.'
    ],
    tip: 'Slide under low hazards and dash through tight gaps \u2014 the storm only gets worse.'
  },

  stickmanmotorace: {
    goal: 'Cross the finish line first on a split-screen neon moto track.',
    how: [
      'Couch co-op: both players on one device / one screen. Host (A) starts the race and reports the winner.',
      'Pick one of 10 tracks from Sunny Hills to Inferno Circuit.',
      'P1 (top): W gas \u00b7 S brake \u00b7 A/D lean.',
      'P2 (bottom): \u2191 gas \u00b7 \u2193 brake \u00b7 \u2190/\u2192 lean.',
      'First to the flag wins. Crashes cost time \u2014 lean through jumps and loops.'
    ],
    tip: 'Ease off the gas before big drops \u2014 landing flat keeps you racing.'
  },

  stickmangunfight: {
    goal: 'Win a neon circular-arena gunfight \u2014 Quick Match or Full Session.',
    how: [
      'Couch co-op: both players on one device / one screen. Host (A) starts the match and reports the result.',
      'Quick Match: pick one weapon category, best of 3. Full Session: all 5 weapon levels \u00d7 3 rounds.',
      'P1 (upper): A/D move \u00b7 W jump \u00b7 S crouch \u00b7 Q/E aim \u00b7 Space fire \u00b7 R reload.',
      'P2 (lower): \u2190/\u2192 move \u00b7 \u2191 jump \u00b7 \u2193 crouch \u00b7 O/P aim \u00b7 Enter fire \u00b7 / reload.',
      'Use cover, utilities, and timing \u2014 last alive wins the round.'
    ],
    tip: 'Reload behind cover. Crouch shrinks your hitbox when bullets fly.'
  },

  stickmanracing: {
    goal: 'Reach the finish flag first on a long neon parkour track.',
    how: [
      'Couch co-op: both players on one device / one screen. Host (A) starts the race and reports the winner.',
      'Pick one of 10 tracks. Split view: blue (P1) on top, pink (P2) on bottom.',
      'P1 (top): A/D run \u00b7 W jump / wall-jump / rope release \u00b7 S slide \u00b7 F turbo.',
      'P2 (bottom): \u2190/\u2192 run \u00b7 \u2191 jump / wall-jump / rope release \u00b7 \u2193 slide \u00b7 K turbo.',
      'Jump hurdles, slide under bars, clear spikes, swing ropes, use springs. Fall? You respawn at the last checkpoint.',
      'First to the checkered flag wins the race.'
    ],
    tip: 'Pace your turbo \u2014 it needs at least 35% to fire and recharges slowly.'
  },

  microsoccer: {
    goal: 'Score more goals than your partner in 90 seconds.',
    how: [
      'Both press ready in the lobby, then drive your car and nudge the ball into their net.',
      'Arrows or WASD on desktop; on-screen pad on phones.',
      'Blue (A) defends the left goal; pink (B) defends the right.',
      'Highest score when the clock hits zero wins (draws count).'
    ],
    tip: 'Ram the ball at an angle \u2014 straight-on bumps are easier to steal back.'
  },

  moleduel: {
    goal: 'Score more points than your partner across a longer heart-pop match.',
    how: [
      'Both press ready \u2014 the same hearts appear on both screens from a shared seed.',
      'Tap as soon as one pops. Faster reaction claims that hole.',
      'Heart = +1, ring = +3, broken heart = \u22122. Ties on a hole go to nobody.',
      'Only your local reaction time is compared \u2014 lag can\u2019t steal a claim.'
    ],
    tip: 'Skip the broken hearts \u2014 they cost you points.'
  },

  forbiddenwords: {
    goal: 'Slip fewer forbidden words than your partner in a Q&A.',
    how: [
      'Pick a topic together, then each assign the other 3 trap words.',
      'During play you see your own 3 forbidden words \u2014 avoid saying them in answers.',
      'Take turns asking and answering (at least 10 words). Answers stay locked until Check results.',
      'At the end both word lists and the transcript are revealed. Fewer slips wins; ties break to whoever stayed clean longer.'
    ],
    tip: 'Trap common filler words \u2014 yes, like, really \u2014 they\u2019re hard to dodge even when you can see them.'
  },

  auctionduel: {
    goal: 'Win the most points by bidding on titled cabinet cards.',
    how: [
      'You each start with 100 coins. Ten titled cards are drawn one at a time at random from a 20-card pool.',
      'The pool has values 1\u201310 twice each \u2014 upcoming draws stay face-down.',
      'Set a secret bid and Lock \u2014 neither sees the other\u2019s number until both are in.',
      'Higher bid claims the title; BOTH bids are spent. A tie means you both paid for nothing.',
      'Most points wins (then most cards, then coins left).'
    ],
    tip: 'Overbidding wastes coins even when you win \u2014 save ammo for the high-value titles.'
  },

  uno: {
    goal: 'Empty your hand before your partner does.',
    how: [
      'Match the discard by color or symbol \u2014 or play a Wild / Wild +4.',
      'In a duo, Reverse works like Skip. Skip, Reverse, +2, and +4 let you go again.',
      'Draw if you cannot play; if the drawn card fits you may play it, otherwise Pass.',
      'At 2 cards, tap UNO! before playing down to one \u2014 or your partner can Catch you for +2.',
      'Tap the draw pile to take a card. First to empty their hand wins.'
    ],
    tip: 'Arm UNO while you still have two cards \u2014 waiting until you have one is often too late.'
  },

  coup: {
    goal: 'Destroy all of your partner\u2019s influence cards.',
    how: [
      'Veilcourt: 7 characters \u00d7 3 = 21 cards, shuffled once. Three hidden cards each. Both players start with 2 coins.',
      'Always: Wage +1 · Governmental aid +2 (Taxman can block) · Exposition pay 7 to kill (forced at 10+). When hit by Exposition (or any kill), pay 9 Corruption to defend and keep your card.',
      'Businesswoman +4 · Terrorist pay 3 to kill · Politician exchanges · Thief steals 2 (Thief blocks) · Colonel accuses for 4 / blocks Terrorist · Taxman taxes 7+ or skims deals · Cop inspects and may swap (Cop blocks Cop).',
      'Claim any character anytime. Challenges are free \u2014 liars lose a card; truthful claimers force the challenger to lose one. On your turn, actions matching your live cards are marked so you can play them without bluffing.',
      'The deck never reshuffles: returned cards go under the bottom. Count everything.'
    ],
    tip: 'Save 9 coins for Corruption when you smell an Exposition or a Terrorist hit.'
  },

  carrot: {
    goal: 'Hold the carrot when the boxes open \u2014 first to 3 rounds wins.',
    how: [
      'Two gift boxes, one carrot. Roles alternate each round: one peeks, one decides.',
      'Peeker: look inside YOUR box (only you see it), then sell the lie in the chat.',
      'Chooser: Keep your box, or SWAP. Whoever holds the carrot after the choice wins the round (+1).',
      'Quick lines in chat are ammo \u2014 use them. Best of 5 (first to 3).'
    ],
    tip: 'Sometimes the truth is the best bluff \u2014 especially if you always lie.'
  },

  minusone: {
    goal: 'Win classic RPS with the hand you keep \u2014 first to 5 points.',
    how: [
      'Throw with BOTH hands (rock, paper, or scissors on left and right), then Lock. Nothing shows until both of you lock.',
      'All four hands appear \u2014 theirs across the table, yours below.',
      'Minus one: an 8-second countdown both of you see. Tap the hand you KEEP; the other vanishes. Choices stay secret until both are in. Time out and each player who has not picked gets their own random left/right keep (they can differ).',
      'The kept hands duel classic RPS. Draw = no point. First to 5 wins the match.'
    ],
    tip: 'The mind-game is the keep \u2014 you can see both of their throws before you choose.'
  },

  thinice: {
    goal: 'Trap your partner on the melting lake \u2014 one round decides the winner.',
    how: [
      '6\u00d76 ice grid. You are the blue orb, your partner the pink (mid-left vs mid-right).',
      'On your turn, tap any of the 8 neighbouring intact tiles (diagonals count). Legal tiles tint in your color.',
      'The tile you leave cracks and sinks forever \u2014 for both of you. You cannot land on your partner.',
      'No legal move on your turn and you fall through; your partner wins the match.'
    ],
    tip: 'Central position early = options later. Your trail is a knife \u2014 wall them off.'
  },

  wallmaze: {
    goal: 'Race your orb to the far side while building a labyrinth around your partner. First to 2 rounds wins.',
    how: [
      'Play from your own device. The board is flipped for each of you \u2014 you always march UP toward the glowing goal row.',
      'On your turn: step once onto a gold ring, or place one of your 6 walls (2-span bar) on an intersection.',
      'Jump straight over an adjacent partner; if a wall or the edge is behind them, diagonal side-steps light up instead.',
      'No wall may seal either path completely \u2014 illegal placements explain themselves. Starter alternates each round.',
      'First orb to the far row takes the round; first to 2 rounds takes the match.'
    ],
    tip: 'Save a wall for the endgame \u2014 a race decided by one tempo is decided by whoever still holds one.'
  },

  nightcurling: {
    goal: 'Score closest to the button on midnight ice. First to 5 points wins.',
    how: [
      'Four stones each per end. On your throw: pick curl (Up / Straight / Down), then pull back and release (slingshot).',
      'While YOUR stone slides, hammer SWEEP (or SPACE) to cut friction and carry it deeper. Stop short of the hog line and it\u2019s removed.',
      'Stones collide with real takeouts \u2014 knock theirs out of the house.',
      'After 8 stones: closest side scores one point per stone closer than the opponent\u2019s best. Blank end = nobody in the house.',
      'Hammer (last throw) passes to the end\u2019s loser; blank ends keep the hammer where it was.'
    ],
    tip: 'Save the hammer for a blank-or-score end \u2014 and sweep early if you need the deep freeze.'
  },

  sumobomb: {
    goal: 'Pass the fused bomb before it blows on YOUR sumo \u2014 first to 3 points (best of 5).',
    how: [
      'Eight sumos on a ring: four yours, four your partner\u2019s, alternating colors.',
      'The center cannon spins, then fires the bomb at a random sumo. Fuse length is secret (5\u201320s).',
      'When YOUR sumo holds it, the aim arrow sweeps left and right inside the ring \u2014 tap (or SPACE) to throw.',
      'The bomb lands on whoever the throw-line hits. Miss everyone and it loops straight back to you.',
      'If it explodes on one of YOUR sumos, your partner scores. First to 3 wins the basho.'
    ],
    tip: 'Wait for the arrow to line up with a sumo \u2014 don\u2019t fling into empty air.'
  },

  magnethearts: {
    goal: 'Bank the most hearts in 90 seconds \u2014 gold is +2, bombs are -2.',
    how: [
      'Your critter holds a magnet. Up to 5 items appear on the field (mostly hearts, few bombs) — spaced apart, one catch at a time.',
      'THROW (SPACE or the big button) flings your catch the way you last moved.',
      'Land hearts in YOUR glowing zone to bank them. Hurl bombs into your partner\u2019s zone.',
      'Carried items never convert. Catch a bomb near your pod and send it back.',
      'Highest bank when the clock hits zero wins. Ties are draws.'
    ],
    tip: 'Camping your zone vacuums hearts \u2014 and bombs. Catch bombs; don\u2019t bank them.'
  },

  chkobba: {
    goal: 'Score Carta, Diamonds, 7aya, Bermila, and Chkobbas \u2014 first to 21 with a 2-point lead.',
    how: [
      '40-card French deck (Hearts, Diamonds, Clubs, Spades). Cut: keep the cut card (dealt only 2 more) or leave it. Dealer alternates each round.',
      '3 cards each, 4 on the table. Play a card that captures table cards summing to its value \u2014 or lay it if it cannot.',
      'Single-card rule: if an equal is on the table, you must take that single, not a longer combo. Clearing the table = Chkobba (+1), except on the round\u2019s final card.',
      'Values: 1\u20137 as printed, Queen = 8, Lieutenant = 9, King = 10. Diamonds score like classic Dinari; the 7 of Diamonds is 7aya.'
    ],
    tip: 'Hunt the 7 of Diamonds (7aya) and keep an eye on who is winning Carta.'
  },

  dominoes: {
    goal: 'Bank 50 points first in a classic draw-dominoes match.',
    how: [
      'Play from your own device. Both of you see the same board; only your hand is face-up.',
      'Double-six set: 7 tiles each, rest in the boneyard. Highest double leads round 1; starters alternate after.',
      'On your turn, play on either open end. If a tile fits both, you choose. Can\u2019t play? Draw until you can; empty boneyard \u2192 pass.',
      'Empty your hand to bank the opponent\u2019s leftover pips. Locked game (two passes): lighter hand wins the pip difference.',
      'First to 50 points wins the match.'
    ],
    tip: 'Save doubles for when an end locks up \u2014 and watch both open pips before you draw.'
  },

  wordgrid: {
    goal: 'Score more unique words than your partner on the same 4\u00d74 grid.',
    how: [
      'Play from your own device, at the same time. Both of you hunt the same shared Boggle grid for 60 seconds \u2014 no peeking at each other\u2019s words until you\u2019re both done.',
      'Finish early or run out the clock; if your partner is still hunting, sit tight until they\u2019re done too.',
      'Words are 3+ letters, chained through neighbouring tiles (diagonals count). Each tile used once per word.',
      'Scoring: 1 (3\u20134 letters), 2 (5), 3 (6), 5 (7), 11 (8+). Words BOTH of you found cancel to zero.',
      'Words not in the dictionary get a gold ? and can be vetoed on the review screen.'
    ],
    tip: 'Hunt the long words your partner is likely to miss \u2014 shared finds score nothing.'
  },

  wordbomb: {
    goal: 'Be the last one standing when the hidden fuse pops.',
    how: [
      'A 2-letter fragment appears (e.g. \u2026OR\u2026). Whoever holds the bomb must type a word containing it.',
      'Pass a real English word (3+ letters, no repeats this match) to hand the bomb to your partner.',
      'Made-up spellings are rejected by the dictionary.',
      'The fuse is hidden (30\u201360s, random each round). Letters reshuffle every round and every pass.',
      'Three lives each. The exploded player starts the next round holding the bomb.'
    ],
    tip: 'Think of backup words while your partner holds it \u2014 the bomb comes back fast.'
  },

  numberfortress: {
    goal: 'Grow the bigger fortress by bidding points on your answers.',
    how: [
      'You each start with 100 points across 10 rounds.',
      'See only the topic and difficulty, then secretly bid 5\u201330 points on yourself.',
      'When both lock, the question appears with a 25s timer. Correct = win your bid; wrong/timeout = lose it.',
      'Highest fortress at the end wins.'
    ],
    tip: 'Bid small on hard topics you hate \u2014 overconfidence is expensive.'
  },

  // Note: the four rule sets below describe the standard version of each
  // game \u2014 tweak the wording if your engine plays it differently.
  sketch: {
    goal: 'Draw it so your partner guesses it.',
    how: [
      'One of you draws the secret word \u2014 no letters, no numbers.',
      'The other watches live and types guesses.',
      'A correct guess scores for both of you, then you swap roles.'
    ],
    tip: 'Draw the idea, not the masterpiece \u2014 speed beats beauty.'
  },

  wordrace: {
    goal: 'Solve the same 5-letter word in fewer guesses than your partner.',
    how: [
      'You both get the same secret word and six tries each (Wordle-style colors).',
      'While playing you only see your partner\u2019s color feedback, not their letters.',
      'When both are done, every guessed word is revealed on both boards.',
      'Fewer guesses wins. Same number of guesses = a draw (including both missing it).'
    ],
    tip: 'Start with a vowel-heavy opener \u2014 you and your partner share the answer, not the clock.'
  },

  maze: {
    goal: 'Reach the exit before your partner.',
    how: [
      'Both race live through the same maze from opposite starts.',
      'Move step by step \u2014 dead ends cost seconds.',
      'First one out wins.'
    ],
    tip: 'Trace the route with your eyes before you take the first step.'
  },

  reflex: {
    goal: 'Be the fastest finger, round after round.',
    how: [
      'Wait for the signal \u2014 don\u2019t twitch early.',
      'When it fires, tap first to take the round.',
      'Jumping the gun hands the round to your partner.'
    ],
    tip: 'Watch the screen, not your thumb.'
  },

  /* ================= the new shelf (v11.1) ================= */

  mancala: {
    goal: 'Bank the most seeds in your store.',
    how: [
      'Your six pits are on your side; your store is the big pit at your end.',
      'On your turn, scoop all seeds from one of your pits and sow them one by one, counter-clockwise \u2014 skipping your partner\u2019s store.',
      'Last seed lands in YOUR store \u2192 go again.',
      'Last seed lands in one of your EMPTY pits \u2192 capture that seed plus everything in the pit directly across.',
      'When one side runs dry, the other player banks all seeds left on their side. Fuller store wins.'
    ],
    tip: 'Count before you scoop \u2014 an exact landing in your store is a free extra turn.'
  },

  seabattle: {
    goal: 'Sink all four of their ships first.',
    how: [
      'Each fleet (one 4, two 3s, one 2) is placed automatically \u2014 hidden from your partner.',
      'Take turns firing at a square on their waters.',
      '\u2738 means hit \u2014 and a hit means you fire again. \u00b7 means miss, turn passes.',
      'A ship sinks when every one of its squares is hit. Sink the whole fleet to win.'
    ],
    tip: 'After a hit, fire at the four squares around it to find the ship\u2019s direction.'
  },

  checkers: {
    goal: 'Capture or trap every enemy piece.',
    how: [
      'Pieces slide one square diagonally forward onto empty dark squares.',
      'Jump over an adjacent enemy piece into the empty square beyond to capture it.',
      'Captures are MANDATORY \u2014 if a jump exists, you must take it.',
      'If your piece can jump again after landing, it must keep jumping (the board locks it in for you).',
      'Reach the far row to crown a king \u265A \u2014 kings move and jump backward too. Crowning ends that turn.',
      'You win when your partner has no pieces \u2014 or no legal moves.'
    ],
    tip: 'Sometimes the forced capture is the trap \u2014 offer a piece to drag them where you want.'
  },

  hex: {
    goal: 'Connect your two sides of the board.',
    how: [
      'Blue owns the top and bottom edges; pink owns the left and right.',
      'Take turns placing a stone on any empty cell \u2014 stones never move.',
      'Cells touching diagonally along the slant count as connected \u2014 it\u2019s a hex grid.',
      'First unbroken chain between your two edges wins. A draw is mathematically impossible.'
    ],
    tip: 'Don\u2019t build a solid wall \u2014 place \u201cbridge\u201d stones a diagonal apart; they\u2019re connectable two ways.'
  },

  pig: {
    goal: 'First to bank 50 points.',
    how: [
      'On your turn, roll the die as many times as you dare \u2014 every roll adds to your pot.',
      'Roll a 1 and the whole pot vanishes; the turn passes.',
      'HOLD anytime to bank the pot into your score safely.',
      'Reach 50 \u2014 banked, or riding a winning roll \u2014 and you take the game.'
    ],
    tip: 'The math says hold around 20 \u2014 but where\u2019s the romance in math?'
  },

  /* ================= couple night (v12) ================= */

  nim: {
    goal: 'Don\u2019t take the last stick.',
    how: [
      'Four rows of sticks: 1, 3, 5 and 7.',
      'On your turn, take any number of sticks \u2014 but only from ONE row. Tap a stick to take it and everything to its right.',
      'Whoever picks up the very last stick loses.'
    ],
    tip: 'Try to hand your partner rows that mirror each other \u2014 whatever they do to one, you do to the other.'
  },

  race: {
    goal: 'Get both of your tokens home first.',
    how: [
      'You each have two tokens that race along the same 24-square track.',
      'Roll the die, then choose which token moves that many squares.',
      'Land exactly on your partner\u2019s token and it gets bumped back to base.',
      'Roll a 6 and you go again. Passing square 24 brings a token home.'
    ],
    tip: 'Don\u2019t run one token ahead alone \u2014 a bumped leader loses the whole race.'
  },

  couplequiz: {
    goal: 'Prove you know each other best.',
    how: [
      'Six rounds. Each round, one of you answers a question about YOURSELF \u2014 secretly.',
      'Then the other guesses which answer was picked.',
      'A correct guess earns the guesser a point. You swap roles every round.',
      'Most points after six rounds wins the crown of Most Attentive Partner.'
    ],
    tip: 'Answer honestly \u2014 the game is only sweet if the answers are true.'
  },

  twotruths: {
    goal: 'Catch their lie, protect your own.',
    how: [
      'Write three statements about yourself \u2014 two true, one a lie \u2014 and mark the lie.',
      'Your partner reads them and picks the one they think is the fib.',
      'Catching the lie earns a point. Then you swap roles.',
      'One point each \u2014 or none \u2014 is a draw: you know each other equally well.'
    ],
    tip: 'The best lie is a truth with one tiny detail changed.'
  },

  codebreak: {
    goal: 'Crack your partner\u2019s secret 4-digit code first.',
    how: [
      'Each of you secretly picks a 4-digit code (digits can repeat).',
      'Take turns guessing your partner\u2019s code.',
      'After each guess you only get totals: how many digits are correct (right place), and how many are right but misplaced.',
      'You never learn which digit is which \u2014 just the counts.',
      'Guess the exact code to win. You each get up to 10 tries.'
    ],
    tip: 'Use the totals like Mastermind \u2014 rule digits in or out, then narrow the order.'
  }
};

export const getRules = id => RULES[id] || null;
