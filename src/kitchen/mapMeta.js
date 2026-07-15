/** Lightweight map picker data — no Phaser / paint imports. */

export const ENVIRONMENTS = [
  {
    id: 'diner',
    title: 'Diner',
    blurb: 'Early fast-paced grill and assembly levels.',
    difficulty: 'Easy',
    accent: '#ff7043',
    slots: ['diner-1', null, null, null, null]
  },
  {
    id: 'beach',
    title: 'Beach House',
    blurb: 'Intermediate outdoor cooking environment.',
    difficulty: 'Medium',
    accent: '#29b6f6',
    slots: ['beach-1', null, null, null, null]
  },
  {
    id: 'mall',
    title: 'Mall',
    blurb: 'Advanced multi-station rush level.',
    difficulty: 'Hard',
    accent: '#ab47bc',
    slots: ['mall-1', null, null, null, null]
  },
  {
    id: 'buffet',
    title: 'Buffet',
    blurb: 'Stock trays, hand plates, serve waves of groups.',
    difficulty: 'Medium',
    accent: '#00897b',
    slots: ['buffet-1', null, null, null, null]
  }
];

export const MAP_LABELS = {
  'diner-1': { slot: 1, name: 'Morning Rush' },
  'beach-1': { slot: 1, name: 'Sunset Grill' },
  'mall-1': { slot: 1, name: 'Food Court Frenzy' },
  'buffet-1': { slot: 1, name: 'Harbor Buffet' }
};
