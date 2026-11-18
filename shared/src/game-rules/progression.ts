// Levels, rewards, missions and achievements (pure functions; server is the authority).
import type { ModeId, Team } from '../types';

/** XP needed to go from `level` to `level + 1`. */
export function xpForLevel(level: number): number {
  return 200 + (level - 1) * 120;
}

export function levelFromXp(xp: number): { level: number; into: number; needed: number } {
  let level = 1;
  let rest = Math.max(0, Math.floor(xp));
  while (rest >= xpForLevel(level) && level < 200) {
    rest -= xpForLevel(level);
    level++;
  }
  return { level, into: rest, needed: xpForLevel(level) };
}

export interface RewardInput {
  team: Team;
  score: number;
  won: boolean;
  finds: number;
  survivedMs: number;
  caught: boolean;
  mode: ModeId;
  completed: boolean; // stayed until the end
}

export function computeReward(r: RewardInput): { xp: number; coins: number } {
  if (!r.completed) return { xp: 10, coins: 0 };
  let xp = 50 + Math.round(r.score / 2);
  if (r.won) xp += 60;
  xp = Math.min(xp, 900);
  const coins = Math.round(xp / 5) + (r.won ? 10 : 0);
  return { xp, coins };
}

// ---------- Daily missions ----------
export type MissionKind = 'play' | 'win' | 'find' | 'escape' | 'survive_seconds' | 'hider_rounds' | 'seeker_rounds' | 'decoys';
export interface MissionDef {
  id: string;
  kind: MissionKind;
  title: string;
  goal: number;
  rewardXp: number;
  rewardCoins: number;
}

export const MISSION_POOL: MissionDef[] = [
  { id: 'play3', kind: 'play', title: 'Play 3 matches', goal: 3, rewardXp: 150, rewardCoins: 40 },
  { id: 'play5', kind: 'play', title: 'Play 5 matches', goal: 5, rewardXp: 250, rewardCoins: 60 },
  { id: 'win2', kind: 'win', title: 'Win 2 matches', goal: 2, rewardXp: 200, rewardCoins: 50 },
  { id: 'find3', kind: 'find', title: 'Find 3 hiders', goal: 3, rewardXp: 180, rewardCoins: 45 },
  { id: 'find6', kind: 'find', title: 'Find 6 hiders', goal: 6, rewardXp: 300, rewardCoins: 70 },
  { id: 'escape1', kind: 'escape', title: 'Survive a hunt without being found', goal: 1, rewardXp: 160, rewardCoins: 40 },
  { id: 'escape3', kind: 'escape', title: 'Survive 3 hunts', goal: 3, rewardXp: 320, rewardCoins: 80 },
  { id: 'survive300', kind: 'survive_seconds', title: 'Stay hidden for 300 seconds total', goal: 300, rewardXp: 200, rewardCoins: 50 },
  { id: 'hider2', kind: 'hider_rounds', title: 'Play 2 rounds as a Hider', goal: 2, rewardXp: 120, rewardCoins: 30 },
  { id: 'seeker2', kind: 'seeker_rounds', title: 'Play 2 rounds as a Seeker', goal: 2, rewardXp: 120, rewardCoins: 30 },
  { id: 'decoy1', kind: 'decoys', title: 'Fool a seeker with a decoy', goal: 1, rewardXp: 150, rewardCoins: 40 },
];

function hashStr(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Deterministic 3 daily missions per player per UTC day. */
export function dailyMissionsFor(playerId: string, day: string): MissionDef[] {
  const picked: MissionDef[] = [];
  const kinds = new Set<string>();
  let h = hashStr(playerId + day);
  let guard = 0;
  while (picked.length < 3 && guard++ < 100) {
    const m = MISSION_POOL[h % MISSION_POOL.length];
    h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
    if (kinds.has(m.kind)) continue;
    kinds.add(m.kind);
    picked.push(m);
  }
  return picked;
}

export function utcDay(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export interface MatchContribution {
  played: number; won: number; finds: number; escapes: number; survivedSec: number;
  hiderRounds: number; seekerRounds: number; decoys: number;
}
export function missionIncrement(kind: MissionKind, c: MatchContribution): number {
  switch (kind) {
    case 'play': return c.played;
    case 'win': return c.won;
    case 'find': return c.finds;
    case 'escape': return c.escapes;
    case 'survive_seconds': return Math.floor(c.survivedSec);
    case 'hider_rounds': return c.hiderRounds;
    case 'seeker_rounds': return c.seekerRounds;
    case 'decoys': return c.decoys;
  }
}

// ---------- Achievements ----------
export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  rewardCoins: number;
}
export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_match', name: 'Fresh Paint', description: 'Finish your first match.', icon: '🖌️', rewardCoins: 50 },
  { id: 'first_escape', name: 'First Escape', description: 'Survive a hunt without being found.', icon: '🏃', rewardCoins: 80 },
  { id: 'master_camo', name: 'Master Camouflage', description: 'Survive 10 hunts in total.', icon: '🦎', rewardCoins: 250 },
  { id: 'perfect_hunter', name: 'Perfect Hunter', description: 'Find every hider in a round by yourself (3+ hiders).', icon: '🎯', rewardCoins: 250 },
  { id: 'untouchable', name: 'Untouchable', description: 'Survive 3 hunts in a row.', icon: '🛡️', rewardCoins: 200 },
  { id: 'last_survivor', name: 'Last Survivor', description: 'Be the last hider standing and win the round.', icon: '🌟', rewardCoins: 150 },
  { id: 'first_find', name: 'Gotcha!', description: 'Find your first hider.', icon: '👆', rewardCoins: 50 },
  { id: 'sharp_eyes', name: 'Sharp Eyes', description: 'Find 25 hiders in total.', icon: '🦅', rewardCoins: 200 },
  { id: 'trickster', name: 'Trickster', description: 'Fool a seeker with a decoy.', icon: '🃏', rewardCoins: 100 },
  { id: 'veteran', name: 'Veteran', description: 'Play 25 matches.', icon: '🎖️', rewardCoins: 300 },
];
export const ACHIEVEMENT_BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));
