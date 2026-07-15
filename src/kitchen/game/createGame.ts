import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "./config";
import { BootScene } from "./scenes/BootScene";
import { PreloadScene } from "./scenes/PreloadScene";
import { KitchenScene, type MultiplayerBridge } from "./scenes/KitchenScene";
import { BuffetScene } from "./scenes/BuffetScene";
import { ResultsScene } from "./scenes/ResultsScene";
import type { MatchSnapshot } from "./systems/ScoreManager";
import type { MapId } from "./maps/catalog";
import type { ChefLook } from "./cosmetics/chefLook";

export type CreateGameOptions = {
  parent: HTMLElement;
  width?: number;
  height?: number;
  mapId?: MapId;
  onMatchComplete?: (result: MatchSnapshot) => void;
  onReturnToLobby?: () => void;
  multiplayer?: MultiplayerBridge;
  audioPrefs?: { masterVolume: number; sfxVolume: number };
  chefLook?: ChefLook;
};

export function createKitchenGame(options: CreateGameOptions): Phaser.Game {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: options.parent,
    width: options.width ?? GAME_WIDTH,
    height: options.height ?? GAME_HEIGHT,
    backgroundColor: "#0f1a14",
    scene: [BootScene, PreloadScene, KitchenScene, BuffetScene, ResultsScene],
    physics: {
      default: "arcade",
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: false,
      },
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    input: {
      keyboard: true,
    },
    render: {
      pixelArt: false,
      antialias: true,
      roundPixels: false,
    },
  });

  game.registry.set("mapId", options.mapId ?? "diner-1");
  if (options.onMatchComplete) {
    game.registry.set("onMatchComplete", options.onMatchComplete);
  }
  if (options.onReturnToLobby) {
    game.registry.set("onReturnToLobby", options.onReturnToLobby);
  }
  if (options.multiplayer) {
    game.registry.set("multiplayer", options.multiplayer);
  }
  if (options.audioPrefs) {
    game.registry.set("audioPrefs", options.audioPrefs);
  }
  if (options.chefLook) {
    game.registry.set("chefLook", options.chefLook);
  }

  return game;
}

export type { MatchSnapshot, MultiplayerBridge };
