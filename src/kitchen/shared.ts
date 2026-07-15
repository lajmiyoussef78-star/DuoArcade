/** Minimal shared types for the embedded kitchen (from project-gastronomica). */

export const APP_NAME = 'Ready, Set, Cook';
export const APP_VERSION = '1.1.0';

export type FacingDir = 'down' | 'left' | 'right' | 'up';

export type LobbyPlayer = {
  id: string;
  displayName: string;
  avatarHue: number;
  ready: boolean;
  slot: number;
  isHost: boolean;
};

export type PlayerNetState = {
  id: string;
  x: number;
  y: number;
  facing: FacingDir;
  moving: boolean;
  sprinting: boolean;
  heldLabel: string | null;
};
