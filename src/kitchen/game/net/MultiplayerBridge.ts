import type {
  KitchenInput,
  KitchenSnapshot,
  LobbyPlayer,
  PlayerNetState,
} from "@gastronomica/shared";

export type MultiplayerBridge = {
  localId: string;
  peers: LobbyPlayer[];
  getPeers?: () => LobbyPlayer[];
  /** Legacy peer avatar relay (unused when authority is on). */
  sendState: (state: Omit<PlayerNetState, "id">) => void;
  getRemotes: () => Record<string, PlayerNetState>;
  /** Server-authoritative shared kitchen */
  authority?: boolean;
  mapId?: string;
  sendInput?: (input: KitchenInput) => void;
  getSnapshot?: () => KitchenSnapshot | null;
};
