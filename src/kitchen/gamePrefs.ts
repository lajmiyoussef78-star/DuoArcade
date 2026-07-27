import { useSyncExternalStore } from 'react';
import {
  DEFAULT_CHEF_LOOK,
  normalizeChefLook,
  type ChefLook
} from './game/cosmetics/chefLook';
import {
  DEFAULT_SITE_THEME,
  isSiteThemeId,
  type SiteThemeId
} from './theme/siteThemes';

const KEY = 'gastronomica-game-prefs';

type PrefsState = {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  reduceMotion: boolean;
  showPings: boolean;
  siteTheme: SiteThemeId;
  chefLook: ChefLook;
};

type PrefsApi = PrefsState & {
  setFromSettings: (partial: Partial<PrefsState>) => void;
  setChefLook: (look: Partial<ChefLook>) => void;
  setSiteTheme: (theme: SiteThemeId) => void;
};

function load(): PrefsState {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null') as Partial<PrefsState> | null;
    if (!raw || typeof raw !== 'object') {
      return {
        masterVolume: 80,
        musicVolume: 60,
        sfxVolume: 70,
        reduceMotion: false,
        showPings: true,
        siteTheme: DEFAULT_SITE_THEME,
        chefLook: { ...DEFAULT_CHEF_LOOK }
      };
    }
    return {
      masterVolume: Number(raw.masterVolume) || 80,
      musicVolume: Number(raw.musicVolume) || 60,
      sfxVolume: Number(raw.sfxVolume) || 70,
      reduceMotion: !!raw.reduceMotion,
      showPings: raw.showPings !== false,
      siteTheme: isSiteThemeId(raw.siteTheme) ? raw.siteTheme : DEFAULT_SITE_THEME,
      chefLook: normalizeChefLook(raw.chefLook)
    };
  } catch {
    return {
      masterVolume: 80,
      musicVolume: 60,
      sfxVolume: 70,
      reduceMotion: false,
      showPings: true,
      siteTheme: DEFAULT_SITE_THEME,
      chefLook: { ...DEFAULT_CHEF_LOOK }
    };
  }
}

let state = load();
const listeners = new Set<() => void>();

function emit() {
  localStorage.setItem(KEY, JSON.stringify({
    masterVolume: state.masterVolume,
    musicVolume: state.musicVolume,
    sfxVolume: state.sfxVolume,
    reduceMotion: state.reduceMotion,
    showPings: state.showPings,
    siteTheme: state.siteTheme,
    chefLook: state.chefLook
  }));
  listeners.forEach(l => l());
}

function setState(partial: Partial<PrefsState>) {
  state = { ...state, ...partial };
  emit();
}

const api: PrefsApi = {
  get masterVolume() { return state.masterVolume; },
  get musicVolume() { return state.musicVolume; },
  get sfxVolume() { return state.sfxVolume; },
  get reduceMotion() { return state.reduceMotion; },
  get showPings() { return state.showPings; },
  get siteTheme() { return state.siteTheme; },
  get chefLook() { return state.chefLook; },
  setFromSettings: partial => setState(partial),
  setChefLook: partial =>
    setState({ chefLook: normalizeChefLook({ ...state.chefLook, ...partial }) }),
  setSiteTheme: siteTheme => setState({ siteTheme })
};

export function useGamePrefs<T>(selector: (s: PrefsApi) => T): T {
  return useSyncExternalStore(
    onChange => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    () => selector(api),
    () => selector(api)
  );
}

export function getGamePrefs(): PrefsState {
  return state;
}
