import type {
  AbilityId, BattleSide, Cosmetics, PaintOp, PlayerLook, PublicPlayer, Team, Vec3,
} from '@shared/types';
import { POSES, SHAPES } from '@shared/constants';
import { SocketLimiter } from '../security/rateLimit';

export interface Identity {
  id: string;
  name: string;
  tag: string;
  level: number;
  cosmetics: Cosmetics;
}

export interface AbilityState {
  readyAt: number;
  activeUntil: number;
  charges?: number;
  expiresAt?: number; // bonus abilities vanish after this
}

/** Server-side state of one player inside a room. */
export class RoomPlayer {
  id: string;
  name: string;
  tag: string;
  level: number;
  cosmetics: Cosmetics;

  socketId: string | null = null;
  connected = true;
  disconnectedAt = 0;
  ready = false;
  voiceOn = false;
  micOn = false;
  limiter = new SocketLimiter();
  joinedAt = Date.now();

  // match state
  inMatch = false;
  team: Team = 'none';
  side?: BattleSide;
  caught = false;
  spectating = false;
  infected = false;
  caughtAt = 0;
  score = 0;
  finds = 0;
  decoysFooled = 0;
  survivedMs = 0;
  escapedRounds = 0;
  caughtRounds = 0;
  hiderRounds = 0;
  seekerRounds = 0;
  perfectHunter = false;
  lastSurvivor = false;
  roundFinds = 0;

  look: PlayerLook = { pose: 'stand', shape: 'normal' };
  pos: Vec3 = [0, 0, 0];
  yaw = 0;
  flags = 0;
  lastMoveAt = 0;
  lastMovedAt = 0;
  moveBudget = 0;
  violations = 0;
  trail: { p: Vec3; r: number; t: number }[] = [];
  lastTrailAt = 0;
  spawn: Vec3 = [0, 0, 0];

  paint: PaintOp[] = [];
  redo: PaintOp[][] = [];
  abilities = new Map<AbilityId, AbilityState>();
  tagReadyAt = 0;
  lastInteractAt = 0;

  constructor(identity: Identity) {
    this.id = identity.id;
    this.name = identity.name;
    this.tag = identity.tag;
    this.level = identity.level;
    this.cosmetics = identity.cosmetics;
  }

  resetForRound() {
    this.caught = false;
    this.spectating = false;
    this.infected = false;
    this.caughtAt = 0;
    this.roundFinds = 0;
    this.look = { pose: 'stand', shape: 'normal' };
    this.flags = 0;
    this.trail = [];
    this.paint = [];
    this.redo = [];
    this.abilities.clear();
    this.tagReadyAt = 0;
    this.violations = 0;
  }

  resetForMatch() {
    this.resetForRound();
    this.score = 0;
    this.finds = 0;
    this.decoysFooled = 0;
    this.survivedMs = 0;
    this.escapedRounds = 0;
    this.caughtRounds = 0;
    this.hiderRounds = 0;
    this.seekerRounds = 0;
    this.perfectHunter = false;
    this.lastSurvivor = false;
    this.side = undefined;
  }

  active(id: AbilityId, now: number) {
    const a = this.abilities.get(id);
    return !!a && a.activeUntil > now;
  }

  get radius() {
    const r = SHAPES[this.look.shape].radius;
    const wideP = this.look.pose === 'lie' || this.look.pose === 'starfish' ? 1.6 : 1;
    return r * wideP;
  }
  get height() {
    return SHAPES[this.look.shape].height * POSES[this.look.pose].heightFactor;
  }
  /** Collision height used for movement validation (shape-based, pose independent). */
  get bodyHeight() {
    return SHAPES[this.look.shape].height;
  }

  toPublic(hostId: string): PublicPlayer {
    return {
      id: this.id, name: this.name, tag: this.tag, level: this.level, cosmetics: this.cosmetics,
      isHost: this.id === hostId, ready: this.ready, connected: this.connected, team: this.team, side: this.side,
      caught: this.caught, score: this.score, finds: this.finds, look: this.look,
      voice: { on: this.voiceOn, mic: this.micOn },
    };
  }
}
