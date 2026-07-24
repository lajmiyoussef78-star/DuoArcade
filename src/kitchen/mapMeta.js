/** Lightweight map picker data — no Phaser / paint imports. */

export const ENVIRONMENTS = [
  {
    id: 'diner',
    title: 'Diner',
    blurb: 'Early fast-paced grill and assembly levels.',
    difficulty: 'Easy',
    accent: '#ff7043',
    slots: ['diner-1', 'diner-2', 'diner-3', 'diner-4', 'diner-5']
  },
  {
    id: 'beach',
    title: 'Beach House',
    blurb: 'Intermediate outdoor cooking environment.',
    difficulty: 'Medium',
    accent: '#29b6f6',
    slots: ['beach-1', 'beach-2', 'beach-3', 'beach-4', 'beach-5']
  },
  {
    id: 'mall',
    title: 'Mall',
    blurb: 'Advanced multi-station rush level.',
    difficulty: 'Hard',
    accent: '#ab47bc',
    slots: ['mall-1', 'mall-2', 'mall-3', 'mall-4', 'mall-5']
  },
  {
    id: 'buffet',
    title: 'Buffet',
    blurb: 'Stock trays, hand plates, serve waves of groups.',
    difficulty: 'Medium',
    accent: '#00897b',
    slots: ['buffet-1', 'buffet-2', 'buffet-3', 'buffet-4', 'buffet-5']
  }
];

export const MAP_LABELS = {
  'diner-1': { slot: 1, name: 'Morning Rush' },
  'diner-2': { slot: 2, name: 'Cozy Lunch' },
  'diner-3': { slot: 3, name: 'Evening Service' },
  'diner-4': { slot: 4, name: 'Last Call' },
  'diner-5': { slot: 5, name: 'Sunday Brunch' },
  'beach-1': { slot: 1, name: 'Sunset Grill' },
  'beach-2': { slot: 2, name: 'Palm Cabana' },
  'beach-3': { slot: 3, name: 'Surf Shack' },
  'beach-4': { slot: 4, name: 'Coral Cove' },
  'beach-5': { slot: 5, name: 'Lighthouse Landing' },
  'mall-1': { slot: 1, name: 'Food Court Frenzy' },
  'mall-2': { slot: 2, name: 'Atrium Express' },
  'mall-3': { slot: 3, name: 'Fountain Court' },
  'mall-4': { slot: 4, name: 'Neon Cinema' },
  'mall-5': { slot: 5, name: 'Escalator Loft' },
  'buffet-1': { slot: 1, name: 'Harbor Buffet' },
  'buffet-2': { slot: 2, name: 'Garden Terrace' },
  'buffet-3': { slot: 3, name: 'Lantern Pavilion' },
  'buffet-4': { slot: 4, name: 'Grand Banquet' },
  'buffet-5': { slot: 5, name: 'Market Loft' }
};
