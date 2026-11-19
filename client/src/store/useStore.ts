import { create } from 'zustand';
import type {
  AbilityId, AbilityStatus, ChaosEventId, DecoyState, PatternId, Profile, RoomState, StatueState, Vec3,
} from '@shared/types';

export type Screen = 'boot' | 'welcome' | 'menu' | 'lobby' | 'game' | 'customize' | 'shop' | 'leaderboard' | 'friends' | 'profile' | 'settings';
export type Tool = 'brush' | 'fill' | 'fillall' | 'eyedropper';

export interface Settings {
  master: number;
  music: number;
  sfx: number;
  ui: number;
  voice: number;
  quality: 'low' | 'medium' | 'high';
  invertX: boolean;
  joySens: number; // joystick responsiveness
  touchLook: number; // touch camera speed
  sensitivity: number;
  invertY: boolean;
  touch: 'auto' | 'on' | 'off';
  showFps: boolean;
}

export type VoiceTarget = 'all' | 'team' | 'custom';
export interface VoiceUI {
  on: boolean; // joined voice chat (listening)
  mic: boolean; // my microphone is live
  target: VoiceTarget; // who hears me
  custom: string[]; // chosen players when target = custom
  muted: string[]; // players I don't want to hear
  speaking: Record<string, boolean>;
  status: Record<string, string>; // peer connection state
  hearsMe: string[]; // players currently receiving my voice
  panel: boolean;
  busy: boolean;
}

export interface Toast { id: number; text: string; tone: 'info' | 'good' | 'bad' }

const SETTINGS_KEY = 'hue.settings';
const isMobile = typeof window !== 'undefined' && (matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window);
const defaultSettings: Settings = {
  master: 0.8, music: 0.45, sfx: 0.8, ui: 0.7, voice: 1, quality: isMobile ? 'low' : 'high', sensitivity: 1, invertY: false, invertX: false, joySens: 1, touchLook: 1, touch: 'auto', showFps: false,
};
function loadSettings(): Settings {
  try {
    return { ...defaultSettings, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') };
  } catch {
    return defaultSettings;
  }
}

export interface Effects {
  scanner: { zones: { p: Vec3; r: number }[]; until: number } | null;
  footprints: { prints: { p: Vec3; r: number; age: number }[]; until: number } | null;
  sound: { angle: number | null; dist: 'near' | 'far' | null; until: number } | null;
  radar: { angles: number[]; until: number } | null;
}

interface State {
  screen: Screen;
  prevScreen: Screen;
  token: string | null;
  profile: Profile | null;
  myId: string | null;
  connected: boolean;
  room: RoomState | null;
  clockOffset: number;
  settings: Settings;
  toasts: Toast[];
  invite: { fromName: string; code: string } | null;
  mmStatus: string | null;
  viewProfileId: string | null;
  friendsVersion: number;

  // in-game UI
  paintMode: boolean;
  tool: Tool;
  color: string;
  pattern: PatternId;
  brush: number;
  matchTexture: boolean;
  recentColors: string[];
  abilities: AbilityStatus[];
  tagReadyAt: number;
  effects: Effects;
  tints: Record<string, { color: string; until: number }>;
  active: Record<string, Partial<Record<AbilityId, number>>>;
  decoys: DecoyState[];
  statues: StatueState[];
  bubbles: Record<string, { text: string; until: number }>;
  chaosFx: { event: ChaosEventId; until: number; color?: string } | null;
  pauseOpen: boolean;
  quickMenu: 'none' | 'chat' | 'emote' | 'pose';
  spectateIdx: number;
  nearInteract: { id: string; label: string } | null;
  aimTarget: boolean;
  lastResultsSeen: string | null;
  fps: number;
  voice: VoiceUI;
  propTarget: import('../game/transform').PropTarget | null;
  propLocked: boolean;
  transformReadyAt: number;

  set: (p: Partial<State>) => void;
  go: (s: Screen) => void;
  toast: (text: string, tone?: Toast['tone']) => void;
  updateSettings: (p: Partial<Settings>) => void;
  pushColor: (c: string) => void;
}

let toastId = 1;
function loadVoiceTarget(): VoiceTarget {
  try {
    const v = localStorage.getItem('hue.voiceTarget');
    return v === 'all' || v === 'team' || v === 'custom' ? v : 'all';
  } catch {
    return 'all';
  }
}

export const useStore = create<State>((set, get) => ({
  screen: 'boot',
  prevScreen: 'boot',
  token: null,
  profile: null,
  myId: null,
  connected: false,
  room: null,
  clockOffset: 0,
  settings: loadSettings(),
  toasts: [],
  invite: null,
  mmStatus: null,
  viewProfileId: null,
  friendsVersion: 0,

  paintMode: false,
  tool: 'brush',
  color: '#c08a52',
  pattern: 'solid',
  brush: 22,
  matchTexture: true,
  recentColors: ['#ffffff', '#c08a52', '#64748b', '#16a34a', '#f5ead6', '#1e293b'],
  abilities: [],
  tagReadyAt: 0,
  effects: { scanner: null, footprints: null, sound: null, radar: null },
  tints: {},
  active: {},
  decoys: [],
  statues: [],
  bubbles: {},
  chaosFx: null,
  pauseOpen: false,
  quickMenu: 'none',
  spectateIdx: 0,
  nearInteract: null,
  aimTarget: false,
  lastResultsSeen: null,
  fps: 0,
  propTarget: null,
  propLocked: false,
  transformReadyAt: 0,
  voice: {
    on: false, mic: false, target: loadVoiceTarget(), custom: [], muted: [], speaking: {}, status: {}, hearsMe: [], panel: false, busy: false,
  },

  set: (p) => set(p),
  go: (screen) => set({ prevScreen: get().screen, screen }),
  toast: (text, tone = 'info') => {
    const id = toastId++;
    set({ toasts: [...get().toasts.slice(-4), { id, text, tone }] });
    setTimeout(() => set({ toasts: get().toasts.filter((t) => t.id !== id) }), 3800);
  },
  updateSettings: (p) => {
    const settings = { ...get().settings, ...p };
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* ignore */ }
    set({ settings });
  },
  pushColor: (c) => set({ recentColors: [c, ...get().recentColors.filter((x) => x !== c)].slice(0, 12) }),
}));

export const serverNow = () => Date.now() + useStore.getState().clockOffset;
export const IS_TOUCH = isMobile;
export function useTouchUI() {
  const t = useStore((s) => s.settings.touch);
  return t === 'on' || (t === 'auto' && isMobile);
}

// Read-only automation helpers for the E2E test suite.
if (typeof window !== 'undefined') {
  const w = window as unknown as Record<string, unknown>;
  w.__hueStoreMyId = () => useStore.getState().myId;
  w.__hueRoom = () => useStore.getState().room;
  w.__hueStore = () => useStore.getState();
}
