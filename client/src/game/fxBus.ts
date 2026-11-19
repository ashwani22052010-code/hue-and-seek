// Tiny event bus for one-shot visual effects (particles, pokes, emotes).
import type { Vec3 } from '@shared/types';

export type FxEvent =
  | { kind: 'caught'; id: string }
  | { kind: 'poke'; p: Vec3; hit: boolean }
  | { kind: 'decoy'; id: string }
  | { kind: 'emote'; id: string; emote: string }
  | { kind: 'paint'; p: Vec3; color: string }
  | { kind: 'poof'; p: Vec3 }
  | { kind: 'caughtGhost'; id: string; p: Vec3; yaw: number };

type Fn = (e: FxEvent) => void;
const subs = new Set<Fn>();
export const fx = {
  emit(e: FxEvent) { subs.forEach((f) => f(e)); },
  on(f: Fn) { subs.add(f); return () => { subs.delete(f); }; },
};
