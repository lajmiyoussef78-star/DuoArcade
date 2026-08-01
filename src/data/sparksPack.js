// Relationship Sparks pack — agreement-first prompts.
// Optional t_sec on timedTriggers: structure for createTimedSparkHooks (auto-fire off by default).
export default {
  id: 'sparks-relationship-v1',
  title: 'Closer',
  blurb: 'Mind-reading prompts — celebrate agreement, tease disagreement.',
  afterglow: [
    'What moment tonight made you smile at them?',
    'One thing you want to watch together again?',
  ],
  /** Playhead cues — registered when timed mode is on; never auto-fires unless UI opts in later. */
  timedTriggers: [
    { atSec: 120, promptId: 'sr1' },
    { atSec: 600, promptId: 'sr3' },
    { atSec: 1800, promptId: 'sr5' },
  ],
  prompts: [
    {
      id: 'sr1',
      q: 'Who falls asleep first during a movie?',
      choices: ['Me', 'Them', 'Both of us', 'Depends on the film'],
    },
    {
      id: 'sr2',
      q: 'Ideal Friday night?',
      choices: ['Couch + film', 'Out for food', 'Game night', 'Surprise me'],
    },
    {
      id: 'sr3',
      q: 'Who picks better snacks?',
      choices: ['Me', 'Them', "We're equal", 'Delivery decides'],
    },
    {
      id: 'sr4',
      q: 'In a rewatch, you…',
      choices: ['Notice new details', 'Quote every line', 'Zone out happily', 'Pause to talk'],
    },
    {
      id: 'sr5',
      q: 'Love language in this room?',
      choices: ['Touch', 'Words', 'Shared silence', 'Shared laughs'],
    },
    {
      id: 'sr6',
      q: 'Who would survive a horror night longer?',
      choices: ['Me', 'Them', 'We hide together', 'We turn it off'],
    },
  ],
  quickIds: ['sr1', 'sr2', 'sr3'],
};
