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
    goal: 'Win three rounds in a neon sword duel.',
    how: [
      'Player A picks the arena; both of you fight online, each on your own device.',
      'A/D move \u00b7 W jump \u00b7 S dash \u00b7 F attack \u00b7 G block \u00b7 H kick.',
      'Tap attack up to three times for a combo; hold attack to charge a heavy; dash+attack lunges; air+attack plunges.',
      'Perfect-timed block = parry. Kick breaks a raised guard.'
    ],
    tip: 'Don\u2019t spam heavies \u2014 a parry beats everything, including a charged swing.'
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
