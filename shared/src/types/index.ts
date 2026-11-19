// Shared type definitions used by both client and server.

export type Vec3 = [number, number, number];

export type Team = 'hider' | 'seeker' | 'none';
export type BattleSide = 'red' | 'blue';
export type Phase = 'lobby' | 'assign' | 'prep' | 'hunt' | 'intermission' | 'results';
export type ModeId = 'classic' | 'infection' | 'everyone' | 'teambattle' | 'chaos';
export type MapId = 'house' | 'supermarket' | 'school' | 'toyworld' | 'factory' | 'office' | 'restaurant';
/** How hiders hide: paint camouflage, object transformation (prop hunt), or both. */
export type HideStyle = 'paint' | 'props' | 'hybrid';

export type PoseId = 'stand' | 'sit' | 'lie' | 'crouch' | 'curl' | 'starfish' | 'handstand' | 'flamingo' | 'peek';
export type ShapeId = 'normal' | 'short' | 'tall' | 'wide' | 'slim';
export type RegionId = 'body' | 'head' | 'armL' | 'armR' | 'legL' | 'legR';
export type PatternId =
  | 'solid' | 'stripes' | 'dots' | 'camo' | 'wood' | 'stone' | 'metal' | 'fabric' | 'checker' | 'brick' | 'noise';
export type TexId =
  | 'none' | 'wood' | 'plank' | 'tile' | 'stone' | 'metal' | 'fabric' | 'carpet' | 'brick' | 'concrete'
  | 'grass' | 'checker' | 'stripes' | 'dots' | 'noise' | 'camo';

export type HiderAbility = 'decoy' | 'freeze' | 'colorshift' | 'silent' | 'quickdisguise' | 'vanish';
export type SeekerAbility = 'scanner' | 'footprints' | 'sound' | 'speed' | 'radar';
export type AbilityId = HiderAbility | SeekerAbility;

export interface Cosmetics {
  color: string; // base outfit color shown in lobby / as seeker
  hat: string;
  glasses: string;
  shoes: string;
  accessory: string;
  victory: string;
}

// ---------- Painting ----------
/** Paint operations. Points are quantised UVs in [0, 1023]. */
export type PaintOp =
  | { t: 's'; g: number; r: RegionId; c: string; sz: number; pat: PatternId; pts: number[] }
  | { t: 'f'; g: number; r: RegionId | 'all'; c: string; pat: PatternId }
  | { t: 'x'; g: number }; // clear to white

export type PaintMsg =
  | { k: 'op'; op: PaintOp }
  | { k: 'undo' }
  | { k: 'redo' }
  | { k: 'replace'; ops: PaintOp[] };

// ---------- Room / lobby ----------
export interface RoomSettings {
  mapId: MapId;
  hideStyle: HideStyle;
  mode: ModeId;
  prepTime: number; // seconds
  huntTime: number; // seconds
  maxPlayers: number;
}

export interface PlayerLook {
  pose: PoseId;
  shape: ShapeId;
}

export interface PublicPlayer {
  id: string;
  name: string;
  tag: string;
  level: number;
  cosmetics: Cosmetics;
  isHost: boolean;
  ready: boolean;
  connected: boolean;
  team: Team;
  side?: BattleSide;
  caught: boolean;
  score: number;
  finds: number;
  look: PlayerLook;
  voice: { on: boolean; mic: boolean };
  /** Prop type the player is transformed into (object transformation), or null. */
  disguise: string | null;
  /** Colour and scale copied from the object the player transformed into. */
  dLook?: { c: string | null; s: number };
}

export interface MatchResultPlayer {
  id: string;
  name: string;
  team: Team;
  side?: BattleSide;
  score: number;
  finds: number;
  survivedMs: number;
  caught: boolean;
  won: boolean;
  xp: number;
  coins: number;
  decoysFooled: number;
  levelUp?: boolean;
  newAchievements?: string[];
}

export interface MatchResults {
  matchId: string;
  mode: ModeId;
  mapId: MapId;
  winner: 'hiders' | 'seekers' | 'red' | 'blue' | 'draw' | string; // string = player id (everyone hides)
  winnerLabel: string;
  durationMs: number;
  teamScores?: { red: number; blue: number };
  players: MatchResultPlayer[];
  totalFinds: number;
}

export interface ChaosState {
  event: ChaosEventId | null;
  endsAt: number;
  color?: string;
}
export type ChaosEventId = 'lights_out' | 'fog' | 'shuffle' | 'color_storm' | 'power_up';

export interface RoomState {
  code: string;
  isPublic: boolean;
  hostId: string;
  settings: RoomSettings;
  phase: Phase;
  phaseEndsAt: number; // server epoch ms
  serverNow: number; // server epoch ms when sent
  round: number;
  totalRounds: number;
  teamScores?: { red: number; blue: number };
  players: PublicPlayer[];
  results: MatchResults | null;
  chaos: ChaosState | null;
  interactables: Record<string, boolean>; // id -> active (door open / lamp on)
  propColors: Record<number, string>; // chaos shuffle overrides
  autoStartAt: number | null; // public rooms auto start countdown
}

// ---------- Realtime ----------
/** Snapshot of a player: [id, x, y, z, yaw, flags] */
export type SnapPlayer = [string, number, number, number, number, number];
export interface Snapshot {
  t: number;
  pl: SnapPlayer[];
}
export const FLAG_GROUNDED = 1;
export const FLAG_MOVING = 2;
export const FLAG_SPRINT = 4;
export const FLAG_EYES_CLOSED = 8;
export const FLAG_FROZEN = 16;
export const FLAG_SILENT = 32;
export const FLAG_PAINTING = 64;
export const FLAG_SPEED = 128;

export interface MoveMsg {
  p: Vec3;
  r: number;
  f: number; // flags (grounded / moving / sprint / painting)
  s: number; // sequence number
}

export interface DecoyState {
  id: string;
  ownerId: string;
  p: Vec3;
  r: number;
  look: PlayerLook;
  disguise: string | null;
  dLook?: { c: string | null; s: number };
  until: number;
}

export interface StatueState {
  ownerId: string;
  p: Vec3;
  r: number;
  look: PlayerLook;
  disguise: string | null;
  dLook?: { c: string | null; s: number };
  found: boolean;
}

export interface AbilityStatus {
  id: AbilityId;
  readyAt: number;
  activeUntil: number;
  charges?: number; // for limited abilities (chaos bonus)
}

/** Generic server -> client gameplay events */
export type GameEvent =
  | { type: 'caught'; hiderId: string; seekerId: string; statue?: boolean }
  | { type: 'miss'; seekerId: string; p: Vec3 }
  | { type: 'decoy_popped'; decoyId: string; seekerId: string; ownerId: string }
  | { type: 'ability'; playerId: string; ability: AbilityId; until: number; data?: unknown }
  | { type: 'scanner'; zones: { p: Vec3; r: number }[]; until: number }
  | { type: 'scanned_warning' }
  | { type: 'footprints'; prints: { p: Vec3; r: number; age: number }[]; until: number }
  | { type: 'sound'; angle: number | null; dist: 'near' | 'far' | null; until: number }
  | { type: 'radar'; angles: number[]; until: number }
  | { type: 'tint'; playerId: string; color: string; until: number }
  | { type: 'chaos'; event: ChaosEventId; until: number; color?: string }
  | { type: 'interact'; id: string; active: boolean; by: string; kind: string }
  | { type: 'emote'; playerId: string; emote: string }
  | { type: 'chat'; playerId: string; msg: number }
  | { type: 'kicked' }
  | { type: 'infected'; playerId: string }
  | { type: 'notice'; text: string; tone?: 'info' | 'good' | 'bad' }
  | { type: 'phase'; phase: Phase }
  | { type: 'transform'; playerId: string; prop: string | null; p: Vec3 };

// ---------- Profiles ----------
export interface PlayerStats {
  matchesPlayed: number;
  wins: number;
  finds: number;
  escapes: number;
  timesCaught: number;
  roundsHider: number;
  roundsSeeker: number;
  bestSurvivalMs: number;
  decoysFooled: number;
}

export interface MissionProgress {
  id: string;
  title: string;
  goal: number;
  progress: number;
  rewardXp: number;
  rewardCoins: number;
  completed: boolean;
}

export interface Profile {
  id: string;
  name: string;
  tag: string;
  username: string | null; // set if registered (password account)
  xp: number;
  level: number;
  levelXp: number; // xp into current level
  levelXpNeeded: number;
  coins: number;
  cosmetics: Cosmetics;
  owned: string[];
  stats: PlayerStats;
  achievements: { id: string; unlockedAt: string }[];
  missions: MissionProgress[];
}

export interface PublicProfile {
  id: string;
  name: string;
  tag: string;
  level: number;
  cosmetics: Cosmetics;
  stats: PlayerStats;
  achievements: { id: string; unlockedAt: string }[];
  online: boolean;
  createdAt: string;
}

export interface FriendEntry {
  id: string;
  name: string;
  tag: string;
  level: number;
  online: boolean;
  inRoom: boolean;
}

export interface LeaderboardEntry {
  rank: number;
  id: string;
  name: string;
  tag: string;
  level: number;
  xp: number;
  wins: number;
  finds: number;
  escapes: number;
}
