// Server-authoritative match simulation: phases, teams, movement validation, tagging, abilities, modes, scoring.
import crypto from 'node:crypto';
import type {
  AbilityId, AbilityStatus, ChaosEventId, ChaosState, DecoyState, GameEvent, MatchResults, MatchResultPlayer, MoveMsg,
  PaintMsg, PaintOp, Phase, PlayerLook, SnapPlayer, StatueState, Team, Vec3,
} from '@shared/types';
import {
  FLAG_EYES_CLOSED, FLAG_FROZEN, FLAG_GROUNDED, FLAG_MOVING, FLAG_PAINTING, FLAG_SILENT, FLAG_SPEED, FLAG_SPRINT,
} from '@shared/types';
import {
  ABILITIES, ASSIGN_TIME, DECOY_PENALTY_MS, HIDER_ABILITIES, INTERMISSION_TIME, MODES, PAINT_MAX_OPS, PHYS, POSE_IDS,
  RESULTS_TIME, SCANNER_RANGE, SEEKER_ABILITIES, SHAPE_IDS, SOUND_RANGE, TAG_HIT_RADIUS, TAG_MISS_COOLDOWN_MS, TAG_RANGE,
} from '@shared/constants';
import { hasLineOfSight, isEmbedded, type CollisionWorld } from '@shared/game-rules/physics';
import { pickSeekers, sanitizePaintOp, seekerCount, splitSides } from '@shared/game-rules/rules';
import { computeReward } from '@shared/game-rules/progression';
import { buildMapWorld, nearestPropColor, type MapDef } from '@shared/maps';
import { getMapSync } from '@shared/maps/all';
import type { Room } from '../rooms/Room';
import type { RoomPlayer } from '../rooms/RoomPlayer';
import { recordMatch, type AwardEntry } from '../database/repo';
import { config } from '../config';
import { presence } from '../players/presence';

const CHAOS_COLORS = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#06b6d4', '#3b82f6', '#a855f7', '#ec4899'];
const dist2 = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const dist3 = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export class Match {
  id = crypto.randomUUID();
  phase: Phase = 'assign';
  phaseEndsAt = 0;
  startedAt = Date.now();
  huntStartedAt = 0;
  round = 1;
  totalRounds: number;
  map: MapDef;
  world: CollisionWorld;
  disabledGroups = new Set<string>();
  interactables: Record<string, boolean> = {};
  propColors: Record<number, string> = {};
  decoys = new Map<string, DecoyState>();
  statues = new Map<string, StatueState>();
  chaos: ChaosState | null = null;
  nextChaosAt = 0;
  results: MatchResults | null = null;
  departed = new Map<string, RoomPlayer>();
  lastRoundHidersWon = false;
  roundHiderCount = 0;
  private lastSnap = 0;
  private resultsRecorded = false;

  constructor(private room: Room) {
    this.map = getMapSync(room.settings.mapId);
    this.world = buildMapWorld(this.map);
    this.totalRounds = room.settings.mode === 'teambattle' ? 2 : 1;
    for (const it of this.map.interactables) {
      this.interactables[it.id] = it.defaultActive;
      if (it.kind === 'door' && it.defaultActive) this.disabledGroups.add(it.id);
    }
  }

  get mode() {
    return this.room.settings.mode;
  }
  private get t() {
    // timing scale for automated tests
    return config.timerScale;
  }
  private participants(): RoomPlayer[] {
    return [...this.room.players.values()].filter((p) => p.inMatch);
  }
  teamScores() {
    if (this.mode !== 'teambattle') return undefined;
    const s = { red: 0, blue: 0 };
    for (const p of [...this.participants(), ...this.departed.values()]) if (p.side) s[p.side] += p.score;
    return s;
  }

  dispose() {
    this.decoys.clear();
  }

  // ======================= lifecycle =======================
  start() {
    const players = this.room.connectedPlayers;
    for (const p of this.room.players.values()) {
      p.inMatch = false;
      p.team = 'none';
      p.resetForMatch();
    }
    for (const p of players) p.inMatch = true;
    if (this.mode === 'teambattle') {
      const { red, blue } = splitSides(players.map((p) => p.id));
      for (const p of players) p.side = red.includes(p.id) ? 'red' : 'blue';
      void blue;
    }
    this.startRound();
  }

  private startRound() {
    const now = Date.now();
    const players = this.participants().filter((p) => p.connected);
    this.decoys.clear();
    this.statues.clear();
    this.chaos = null;
    for (const p of this.participants()) p.resetForRound();

    // Team assignment
    if (this.mode === 'everyone') {
      for (const p of players) p.team = 'hider';
    } else if (this.mode === 'teambattle') {
      const hideSide = this.round === 1 ? 'red' : 'blue';
      for (const p of players) p.team = p.side === hideSide ? 'hider' : 'seeker';
      // guarantee both teams exist
      if (!players.some((p) => p.team === 'seeker')) players[0].team = 'seeker';
      if (!players.some((p) => p.team === 'hider')) players[players.length - 1].team = 'hider';
    } else {
      const n = seekerCount(players.length, this.mode);
      const seekers = pickSeekers(players.map((p) => p.id), n, this.room.seekerHistory);
      for (const p of players) p.team = seekers.includes(p.id) ? 'seeker' : 'hider';
    }
    for (const p of players) {
      if (p.team === 'seeker') {
        this.room.seekerHistory[p.id] = (this.room.seekerHistory[p.id] ?? 0) + 1;
        p.seekerRounds++;
      } else p.hiderRounds++;
    }
    this.roundHiderCount = players.filter((p) => p.team === 'hider').length;

    // Spawns
    let hi = 0, si = 0;
    for (const p of players) {
      const list = p.team === 'seeker' ? this.map.seekerSpawns : this.map.hiderSpawns;
      const idx = p.team === 'seeker' ? si++ : hi++;
      const base = list[idx % list.length];
      const jitter = idx >= list.length ? 0.6 : 0;
      this.teleport(p, [base[0] + (Math.random() - 0.5) * jitter, base[1], base[2] + (Math.random() - 0.5) * jitter]);
      p.spawn = [...p.pos];
    }
    this.setPhase('assign', now + ASSIGN_TIME * 1000 * this.t);
    this.room.emitAll('paint:full', { paints: {} });
    this.room.emitAll('decoys', []);
    this.room.emitAll('statues', []);
    for (const p of players) this.sendAbilities(p);
  }

  private setPhase(phase: Phase, endsAt: number) {
    this.phase = phase;
    this.phaseEndsAt = endsAt;
    this.room.emitAll('event', { type: 'phase', phase } satisfies GameEvent);
    this.room.markDirty();
  }

  private advance(now: number) {
    switch (this.phase) {
      case 'assign': {
        const prep = MODES[this.mode].prepTime ?? this.room.settings.prepTime;
        this.setPhase('prep', now + prep * 1000 * this.t);
        break;
      }
      case 'prep':
        this.beginHunt(now);
        break;
      case 'hunt':
        this.finishRound(now, 'timeout');
        break;
      case 'intermission':
        this.round++;
        this.startRound();
        break;
      case 'results':
        this.room.backToLobby(null);
        break;
      default:
        break;
    }
  }

  private beginHunt(now: number) {
    this.huntStartedAt = now;
    if (this.mode === 'everyone') {
      // Freeze everyone's disguise into a statue, then everybody becomes a seeker.
      let i = 0;
      for (const p of this.participants().filter((x) => x.connected)) {
        this.statues.set(p.id, { ownerId: p.id, p: [...p.pos], r: p.yaw, look: { ...p.look }, found: false });
        p.team = 'seeker';
        const sp = this.map.seekerSpawns[i % this.map.seekerSpawns.length];
        const j = i >= this.map.seekerSpawns.length ? 0.7 : 0;
        this.teleport(p, [sp[0] + (Math.random() - 0.5) * j, 0, sp[2] + (Math.random() - 0.5) * j]);
        p.look = { pose: 'stand', shape: 'normal' };
        i++;
      }
      this.room.emitAll('statues', [...this.statues.values()]);
    }
    if (this.mode === 'chaos') this.nextChaosAt = now + 15_000 * this.t;
    this.setPhase('hunt', now + this.room.settings.huntTime * 1000 * this.t);
    // Seekers now get to know the hiders' paint jobs.
    this.room.emitAll('paint:full', { paints: this.allPaints() });
    for (const p of this.participants()) this.sendAbilities(p);
    this.room.notice(this.mode === 'everyone' ? 'Statues placed! Everyone hunt!' : 'Seekers released! The hunt is on!', 'bad');
  }

  private allPaints(): Record<string, PaintOp[]> {
    const out: Record<string, PaintOp[]> = {};
    for (const p of this.participants()) if (p.paint.length) out[p.id] = p.paint;
    return out;
  }

  private finishRound(now: number, reason: 'timeout' | 'all_found' | 'no_seekers') {
    if (this.phase !== 'hunt' && reason !== 'no_seekers') return;
    const ps = this.participants();
    const elapsed = this.huntStartedAt ? now - this.huntStartedAt : 0;
    let hidersWon = false;
    if (this.mode === 'everyone') {
      for (const s of this.statues.values()) {
        const owner = this.room.players.get(s.ownerId) ?? this.departed.get(s.ownerId);
        if (!owner) continue;
        if (!s.found) {
          owner.score += 75;
          owner.escapedRounds++;
          owner.survivedMs = Math.max(owner.survivedMs, elapsed);
        }
      }
    } else {
      const survivors = ps.filter((p) => p.team === 'hider' && !p.caught);
      hidersWon = survivors.length > 0 && reason !== 'all_found';
      for (const h of survivors) {
        h.survivedMs = Math.max(h.survivedMs, elapsed);
        h.score += Math.floor(elapsed / 1000) + 100;
        h.escapedRounds++;
      }
      if (hidersWon && survivors.length === 1 && this.roundHiderCount >= 2) survivors[0].lastSurvivor = true;
      const seekers = ps.filter((p) => p.team === 'seeker');
      if (!hidersWon) {
        for (const s of seekers) s.score += 50;
        const solo = seekers.filter((s) => s.roundFinds > 0);
        if (solo.length === 1 && this.roundHiderCount >= 3 && solo[0].roundFinds >= this.roundHiderCount) solo[0].perfectHunter = true;
      }
    }
    this.lastRoundHidersWon = hidersWon;
    this.chaos = null;
    const label = this.mode === 'everyone' ? 'Time is up!' : hidersWon ? 'Hiders survive the round!' : 'Seekers found everyone!';
    this.room.notice(label, hidersWon ? 'good' : 'bad');

    if (this.round < this.totalRounds) {
      this.setPhase('intermission', now + INTERMISSION_TIME * 1000 * this.t);
    } else {
      this.endMatch(now);
    }
  }

  private endMatch(now: number) {
    const ps = [...this.participants(), ...this.departed.values()];
    let winner = 'draw';
    let winnerLabel = "It's a draw!";
    const isWinner = (p: RoomPlayer): boolean => {
      if (this.mode === 'everyone') return winner === p.id;
      if (this.mode === 'teambattle') return winner === p.side;
      if (winner === 'hiders') return p.team === 'hider' && !p.caught;
      return p.team === 'seeker';
    };
    if (this.mode === 'everyone') {
      const sorted = [...ps].sort((a, b) => b.score - a.score);
      if (sorted[0] && (!sorted[1] || sorted[0].score > sorted[1].score)) {
        winner = sorted[0].id;
        winnerLabel = `${sorted[0].name} wins!`;
      }
    } else if (this.mode === 'teambattle') {
      const ts = this.teamScores()!;
      if (ts.red !== ts.blue) {
        winner = ts.red > ts.blue ? 'red' : 'blue';
        winnerLabel = ts.red > ts.blue ? 'Red Team wins!' : 'Blue Team wins!';
      }
    } else {
      winner = this.lastRoundHidersWon ? 'hiders' : 'seekers';
      winnerLabel = this.lastRoundHidersWon ? 'Hiders win!' : 'Seekers win!';
    }

    const rows: MatchResultPlayer[] = ps.map((p) => {
      const completed = this.room.players.has(p.id) && p.connected;
      const won = isWinner(p);
      const r = computeReward({ team: p.team, score: p.score, won, finds: p.finds, survivedMs: p.survivedMs, caught: p.caught, mode: this.mode, completed });
      return {
        id: p.id, name: p.name, team: p.team, side: p.side, score: p.score, finds: p.finds, survivedMs: p.survivedMs,
        caught: p.caughtRounds > 0, won, xp: r.xp, coins: r.coins, decoysFooled: p.decoysFooled,
      };
    }).sort((a, b) => b.score - a.score);

    this.results = {
      matchId: this.id, mode: this.mode, mapId: this.map.id, winner, winnerLabel, durationMs: now - this.startedAt,
      teamScores: this.teamScores(), players: rows, totalFinds: rows.reduce((s, r) => s + r.finds, 0),
    };
    for (const p of this.room.players.values()) p.ready = false;
    this.setPhase('results', now + RESULTS_TIME * 1000);
    void this.persistResults(ps);
  }

  private async persistResults(ps: RoomPlayer[]) {
    if (this.resultsRecorded || !this.results) return;
    this.resultsRecorded = true;
    const res = this.results;
    const entries: AwardEntry[] = res.players.map((row) => {
      const p = ps.find((x) => x.id === row.id)!;
      return {
        playerId: row.id, team: row.team, score: row.score, finds: row.finds, survivedMs: row.survivedMs, caught: row.caught,
        won: row.won, xp: row.xp, coins: row.coins,
        contribution: {
          played: 1, won: row.won ? 1 : 0, finds: row.finds, escapes: p.escapedRounds, survivedSec: row.survivedMs / 1000,
          hiderRounds: p.hiderRounds, seekerRounds: p.seekerRounds, decoys: p.decoysFooled,
        },
        flags: { perfectHunter: p.perfectHunter, lastSurvivor: p.lastSurvivor, escapedRounds: p.escapedRounds, caughtRounds: p.caughtRounds },
      };
    });
    try {
      const outcomes = await recordMatch(
        { id: res.matchId, roomCode: this.room.code, mapId: res.mapId, mode: res.mode, winner: res.winner, startedAt: this.startedAt, summary: { winnerLabel: res.winnerLabel, totalFinds: res.totalFinds } },
        entries,
      );
      for (const o of outcomes) {
        const row = res.players.find((r) => r.id === o.playerId);
        if (row) {
          row.levelUp = o.levelUp;
          row.newAchievements = o.newAchievements;
          if (!o.awarded) { row.xp = 0; row.coins = 0; }
        }
        presence.emitTo(o.playerId, 'profile:refresh', { missionsCompleted: o.missionsCompleted });
      }
      this.room.markDirty();
    } catch (e) {
      console.error('[match] failed to persist results', e);
    }
  }

  // ======================= membership hooks =======================
  onPlayerJoined(p: RoomPlayer) {
    // Reconnecting participant: resend everything they need.
    if (p.inMatch) {
      this.room.emitPlayer(p, 'spawn', { p: p.pos, r: p.yaw });
      const hidePaint = this.phase === 'prep' && p.team === 'seeker';
      this.room.emitPlayer(p, 'paint:full', { paints: hidePaint ? this.ownPaint(p) : this.allPaints() });
      this.room.emitPlayer(p, 'decoys', p.team === 'seeker' && this.phase === 'prep' ? [] : [...this.decoys.values()]);
      this.room.emitPlayer(p, 'statues', [...this.statues.values()]);
      this.sendAbilities(p);
    } else {
      // Late joiner spectates until the next match.
      p.team = 'none';
      p.spectating = true;
      this.room.emitPlayer(p, 'paint:full', { paints: this.phase === 'prep' ? {} : this.allPaints() });
      this.room.emitPlayer(p, 'statues', [...this.statues.values()]);
      this.room.emitPlayer(p, 'decoys', this.phase === 'prep' ? [] : [...this.decoys.values()]);
    }
  }
  private ownPaint(p: RoomPlayer) {
    return p.paint.length ? { [p.id]: p.paint } : {};
  }

  onPlayerRemoved(p: RoomPlayer) {
    if (!p.inMatch) return;
    if (this.phase !== 'results') this.departed.set(p.id, p);
    for (const [id, d] of this.decoys) if (d.ownerId === p.id) this.decoys.delete(id);
    this.checkRoundEnd(Date.now());
  }

  private checkRoundEnd(now: number) {
    if (this.phase !== 'hunt' && this.phase !== 'prep') return;
    const ps = this.participants();
    if (this.mode === 'everyone') {
      const remaining = [...this.statues.values()].filter((s) => !s.found && this.room.players.has(s.ownerId));
      if (this.phase === 'hunt' && remaining.length === 0) this.finishRound(now, 'all_found');
      if (ps.length < 2) this.finishRound(now, 'no_seekers');
      return;
    }
    const hiders = ps.filter((p) => p.team === 'hider' && !p.caught);
    const seekers = ps.filter((p) => p.team === 'seeker');
    if (hiders.length === 0) {
      if (this.phase === 'prep') { this.huntStartedAt = now; this.phase = 'hunt'; }
      this.finishRound(now, 'all_found');
    } else if (seekers.length === 0) {
      if (this.phase === 'prep') { this.huntStartedAt = now; this.phase = 'hunt'; }
      this.finishRound(now, 'no_seekers');
    }
  }

  // ======================= tick =======================
  tick(now: number) {
    if (now >= this.phaseEndsAt && this.phaseEndsAt > 0) this.advance(now);
    if (this.phase === 'hunt') {
      for (const [id, d] of this.decoys) if (d.until <= now) { this.decoys.delete(id); this.room.emitAll('decoys', [...this.decoys.values()]); }
      if (this.mode === 'chaos') this.chaosTick(now);
      // expire bonus ability charges
      for (const p of this.participants()) for (const [id, a] of p.abilities) if (a.expiresAt && a.expiresAt < now && (a.charges ?? 0) > 0) { a.charges = 0; void id; this.sendAbilities(p); }
    }
    if (this.chaos && this.chaos.endsAt <= now) { this.chaos = null; this.room.markDirty(); }
    if (['assign', 'prep', 'hunt', 'intermission'].includes(this.phase) && now - this.lastSnap >= 1000 / 20) {
      this.lastSnap = now;
      this.sendSnapshots(now);
    }
  }

  private flagsFor(p: RoomPlayer, now: number) {
    let f = p.flags & (FLAG_GROUNDED | FLAG_MOVING | FLAG_SPRINT | FLAG_PAINTING);
    if (p.active('freeze', now)) f |= FLAG_FROZEN | FLAG_EYES_CLOSED;
    if (p.active('silent', now)) f |= FLAG_SILENT;
    if (p.active('speed', now)) f |= FLAG_SPEED;
    if (p.team === 'hider' && (this.phase === 'prep' || this.phase === 'hunt') && now - p.lastMovedAt > 1500) f |= FLAG_EYES_CLOSED;
    return f;
  }

  /** Visibility rules (anti-cheat): seekers never receive hider data during preparation, nor vanished hiders. */
  private visibleTo(viewer: RoomPlayer, target: RoomPlayer, now: number) {
    if (target === viewer) return false;
    if (!target.inMatch || target.spectating) return false;
    if (!viewer.inMatch && target.team === 'hider' && (this.phase === 'assign' || this.phase === 'prep')) return false;
    if (viewer.inMatch && viewer.team === 'seeker' && target.team === 'hider') {
      if (this.phase === 'assign' || this.phase === 'prep') return false;
      if (target.active('vanish', now)) return false;
    }
    return true;
  }

  private sendSnapshots(now: number) {
    const all = [...this.room.players.values()];
    const entries = new Map<string, SnapPlayer>();
    for (const p of all) {
      if (!p.inMatch || p.spectating) continue;
      entries.set(p.id, [p.id, +p.pos[0].toFixed(3), +p.pos[1].toFixed(3), +p.pos[2].toFixed(3), +p.yaw.toFixed(3), this.flagsFor(p, now)]);
    }
    for (const viewer of all) {
      if (!viewer.connected) continue;
      const pl: SnapPlayer[] = [];
      for (const target of all) {
        const e = entries.get(target.id);
        if (e && this.visibleTo(viewer, target, now)) pl.push(e);
      }
      this.room.emitPlayer(viewer, 'snap', { t: now, pl });
    }
  }

  // ======================= movement =======================
  teleport(p: RoomPlayer, pos: Vec3, yaw?: number) {
    p.pos = [...pos];
    if (yaw !== undefined) p.yaw = yaw;
    p.lastMoveAt = Date.now();
    p.lastMovedAt = Date.now();
    p.moveBudget = 1;
    this.room.emitPlayer(p, 'spawn', { p: p.pos, r: p.yaw });
  }

  private maxSpeed(p: RoomPlayer, now: number) {
    let s = PHYS.sprintSpeed;
    if (p.team === 'hider' && this.phase === 'hunt' && this.mode !== 'everyone') s = PHYS.hiderHuntSpeed;
    if (p.active('speed', now)) s *= PHYS.seekerSpeedBoost;
    return s;
  }

  private canMove(p: RoomPlayer, now: number) {
    if (!p.inMatch || p.spectating) return false;
    if (this.phase === 'assign' || this.phase === 'intermission' || this.phase === 'results') return false;
    if (this.phase === 'prep' && p.team === 'seeker') return false;
    if (p.active('freeze', now)) return false;
    return true;
  }

  handleMove(p: RoomPlayer, m: MoveMsg) {
    const now = Date.now();
    if (!p.inMatch || p.spectating) return;
    p.yaw = m.r;
    if (!this.canMove(p, now)) {
      if (dist3(m.p, p.pos) > 0.35) this.correct(p);
      return;
    }
    const dt = Math.min(1.0, Math.max(0, (now - p.lastMoveAt) / 1000));
    p.lastMoveAt = now;
    const speed = this.maxSpeed(p, now);
    p.moveBudget = Math.min(speed * 0.6 + 0.8, p.moveBudget + speed * dt * 1.3);
    const d = dist2(m.p, p.pos);
    const dy = m.p[1] - p.pos[1];
    const b = this.map.bounds;
    const bad =
      d > p.moveBudget ||
      m.p[1] < -0.5 || m.p[1] > 14 || dy > PHYS.jumpSpeed * Math.max(dt, 0.05) + 1.0 ||
      m.p[0] < b.minX - 0.5 || m.p[0] > b.maxX + 0.5 || m.p[2] < b.minZ - 0.5 || m.p[2] > b.maxZ + 0.5 ||
      isEmbedded(this.world, m.p, p.radius, p.bodyHeight, this.disabledGroups);
    if (bad) {
      p.violations++;
      this.correct(p);
      return;
    }
    p.moveBudget -= d;
    p.pos = [m.p[0], m.p[1], m.p[2]];
    p.flags = m.f;
    if (d > 0.03 || Math.abs(dy) > 0.05) {
      p.lastMovedAt = now;
      if (p.team === 'hider' && !p.active('silent', now) && now - p.lastTrailAt > 400 && this.phase !== 'assign') {
        p.lastTrailAt = now;
        p.trail.push({ p: [...p.pos], r: p.yaw, t: now });
        if (p.trail.length > 80) p.trail.shift();
      }
    }
  }

  private correct(p: RoomPlayer) {
    this.room.emitPlayer(p, 'correct', { p: p.pos });
  }

  handleLook(p: RoomPlayer, look: Partial<PlayerLook>) {
    if (!p.inMatch || p.spectating) return;
    const next = { ...p.look };
    if (look.pose && POSE_IDS.includes(look.pose)) next.pose = look.pose;
    if (look.shape && SHAPE_IDS.includes(look.shape)) {
      const shapeAllowed = (p.team === 'hider' && (this.phase === 'prep' || this.phase === 'assign'));
      if (shapeAllowed) next.shape = look.shape;
    }
    if (p.team === 'seeker' && this.mode !== 'everyone') next.shape = 'normal';
    // Changing to a bigger shape must not embed you in geometry.
    const prev = p.look;
    p.look = next;
    if (isEmbedded(this.world, p.pos, p.radius, p.bodyHeight, this.disabledGroups)) {
      p.look = prev;
      this.room.notice("Not enough room for that here!", 'bad', p);
    }
    this.room.markDirty();
  }

  // ======================= painting =======================
  private canPaint(p: RoomPlayer) {
    return p.inMatch && !p.spectating && p.team === 'hider' && this.phase === 'prep';
  }

  handlePaint(p: RoomPlayer, msg: PaintMsg): boolean {
    if (!this.canPaint(p)) return false;
    if (msg.k === 'op') {
      const op = sanitizePaintOp(msg.op);
      if (!op) return false;
      if (p.paint.length >= PAINT_MAX_OPS) {
        this.room.notice('Paint limit reached - try a fill or clear', 'bad', p);
        return false;
      }
      p.paint.push(op);
      p.redo = [];
      this.broadcastPaint(p, { k: 'op', op });
    } else if (msg.k === 'undo') {
      if (!p.paint.length) return false;
      const g = p.paint[p.paint.length - 1].g;
      const group: PaintOp[] = [];
      while (p.paint.length && p.paint[p.paint.length - 1].g === g) group.unshift(p.paint.pop()!);
      p.redo.push(group);
      if (p.redo.length > 50) p.redo.shift();
      this.broadcastPaint(p, { k: 'undo' });
    } else if (msg.k === 'redo') {
      const group = p.redo.pop();
      if (!group) return false;
      p.paint.push(...group);
      this.broadcastPaint(p, { k: 'redo' });
    } else if (msg.k === 'replace') {
      const ops = this.sanitizeOps(msg.ops);
      if (!ops) return false;
      p.paint = ops;
      p.redo = [];
      this.broadcastPaint(p, { k: 'replace', ops });
    }
    return true;
  }

  private sanitizeOps(raw: unknown): PaintOp[] | null {
    if (!Array.isArray(raw) || raw.length > PAINT_MAX_OPS) return null;
    const ops: PaintOp[] = [];
    for (const r of raw) {
      const op = sanitizePaintOp(r);
      if (!op) return null;
      ops.push(op);
    }
    return ops;
  }

  private broadcastPaint(p: RoomPlayer, msg: PaintMsg) {
    const payload = { pid: p.id, ...msg };
    // During preparation the seekers must not learn the hiders' camouflage.
    this.room.emitAll('paint', payload, (viewer) => viewer.id !== p.id && !(this.phase === 'prep' && viewer.team === 'seeker' && viewer.inMatch));
  }

  // ======================= tagging =======================
  handleTag(seeker: RoomPlayer, point: Vec3) {
    const now = Date.now();
    if (this.phase !== 'hunt' || !seeker.inMatch || seeker.spectating || seeker.team !== 'seeker') return;
    if (now < seeker.tagReadyAt) return;
    const eye: Vec3 = [seeker.pos[0], seeker.pos[1] + 0.9, seeker.pos[2]];
    if (dist3(eye, point) > TAG_RANGE + 0.6) return;
    if (!hasLineOfSight(this.world, eye, point, this.disabledGroups, 0.5)) {
      this.miss(seeker, point, now);
      return;
    }

    type Target = { kind: 'hider'; p: RoomPlayer; d: number } | { kind: 'decoy'; id: string; d: number } | { kind: 'statue'; s: StatueState; d: number };
    const targets: Target[] = [];
    const distToBody = (pos: Vec3, radius: number, height: number) => {
      const horiz = Math.max(0, Math.hypot(point[0] - pos[0], point[2] - pos[2]) - radius);
      const vert = point[1] < pos[1] ? pos[1] - point[1] : point[1] > pos[1] + height ? point[1] - pos[1] - height : 0;
      return Math.hypot(horiz, vert);
    };
    if (this.mode === 'everyone') {
      for (const s of this.statues.values()) {
        if (s.found || s.ownerId === seeker.id) continue;
        targets.push({ kind: 'statue', s, d: distToBody(s.p, 0.45, 1.1) });
      }
    } else {
      for (const h of this.participants()) {
        if (h.team !== 'hider' || h.caught || h.spectating) continue;
        targets.push({ kind: 'hider', p: h, d: distToBody(h.pos, h.radius, h.height) });
      }
    }
    for (const d of this.decoys.values()) targets.push({ kind: 'decoy', id: d.id, d: distToBody(d.p, 0.4, 1.0) });
    targets.sort((a, b) => a.d - b.d);
    const hit = targets[0] && targets[0].d <= TAG_HIT_RADIUS ? targets[0] : null;
    if (!hit) return this.miss(seeker, point, now);

    if (hit.kind === 'decoy') {
      const d = this.decoys.get(hit.id)!;
      this.decoys.delete(hit.id);
      seeker.tagReadyAt = now + DECOY_PENALTY_MS;
      const owner = this.room.players.get(d.ownerId);
      if (owner) { owner.decoysFooled++; owner.score += 25; }
      this.room.emitAll('event', { type: 'decoy_popped', decoyId: d.id, seekerId: seeker.id, ownerId: d.ownerId } satisfies GameEvent);
      this.room.emitAll('decoys', [...this.decoys.values()]);
      this.sendAbilities(seeker);
      this.room.markDirty();
      return;
    }
    if (hit.kind === 'statue') {
      hit.s.found = true;
      seeker.finds++;
      seeker.roundFinds++;
      seeker.score += 100;
      const owner = this.room.players.get(hit.s.ownerId) ?? this.departed.get(hit.s.ownerId);
      if (owner) { owner.caught = true; owner.caughtRounds++; owner.survivedMs = now - this.huntStartedAt; owner.score += Math.floor((now - this.huntStartedAt) / 1000); }
      this.room.emitAll('event', { type: 'caught', hiderId: hit.s.ownerId, seekerId: seeker.id, statue: true } satisfies GameEvent);
      this.room.emitAll('statues', [...this.statues.values()]);
      this.room.markDirty();
      this.checkRoundEnd(now);
      return;
    }
    this.catchHider(hit.p, seeker, now);
  }

  private miss(seeker: RoomPlayer, point: Vec3, now: number) {
    seeker.tagReadyAt = now + TAG_MISS_COOLDOWN_MS;
    this.room.emitAll('event', { type: 'miss', seekerId: seeker.id, p: point } satisfies GameEvent);
    this.sendAbilities(seeker);
  }

  private catchHider(h: RoomPlayer, seeker: RoomPlayer, now: number) {
    h.caught = true;
    h.caughtAt = now;
    h.caughtRounds++;
    const survived = now - this.huntStartedAt;
    h.survivedMs = Math.max(h.survivedMs, survived);
    h.score += Math.floor(survived / 1000);
    seeker.finds++;
    seeker.roundFinds++;
    seeker.score += 100;
    for (const [id, d] of this.decoys) if (d.ownerId === h.id) this.decoys.delete(id);
    this.room.emitAll('event', { type: 'caught', hiderId: h.id, seekerId: seeker.id } satisfies GameEvent);
    if (this.mode === 'infection') {
      h.team = 'seeker';
      h.infected = true;
      h.abilities.clear();
      h.look = { pose: 'stand', shape: 'normal' };
      const sp = this.map.seekerSpawns[Math.floor(Math.random() * this.map.seekerSpawns.length)];
      this.teleport(h, [...sp]);
      this.room.emitAll('event', { type: 'infected', playerId: h.id } satisfies GameEvent);
      this.sendAbilities(h);
    } else {
      h.spectating = true;
    }
    this.room.emitAll('decoys', [...this.decoys.values()]);
    this.room.markDirty();
    this.checkRoundEnd(now);
  }

  // ======================= abilities =======================
  private abilityList(p: RoomPlayer): AbilityId[] {
    if (!p.inMatch || p.spectating) return [];
    const base = p.team === 'hider' ? HIDER_ABILITIES : p.team === 'seeker' ? SEEKER_ABILITIES : [];
    const bonus = [...p.abilities.entries()].filter(([id, a]) => ABILITIES[id].bonus && (a.charges ?? 0) > 0).map(([id]) => id);
    return [...base, ...bonus];
  }

  sendAbilities(p: RoomPlayer) {
    const list: AbilityStatus[] = this.abilityList(p).map((id) => {
      const a = p.abilities.get(id);
      return { id, readyAt: a?.readyAt ?? 0, activeUntil: a?.activeUntil ?? 0, charges: a?.charges };
    });
    this.room.emitPlayer(p, 'abilities', { list, tagReadyAt: p.tagReadyAt });
  }

  handleAbility(p: RoomPlayer, id: AbilityId, data: unknown) {
    const now = Date.now();
    const def = ABILITIES[id];
    if (!def || !this.abilityList(p).includes(id)) return;
    const usableInPrep = id === 'quickdisguise';
    if (!(this.phase === 'hunt' || (this.phase === 'prep' && usableInPrep && p.team === 'hider'))) return;
    const st = p.abilities.get(id) ?? { readyAt: 0, activeUntil: 0 };
    if (def.bonus) {
      if (!st.charges) return;
    } else if (now < st.readyAt) return;

    switch (id) {
      case 'decoy': {
        for (const [k, d] of this.decoys) if (d.ownerId === p.id) this.decoys.delete(k);
        const dec: DecoyState = { id: crypto.randomUUID().slice(0, 8), ownerId: p.id, p: [...p.pos], r: p.yaw, look: { ...p.look }, until: now + def.durationMs };
        this.decoys.set(dec.id, dec);
        this.room.emitAll('decoys', [...this.decoys.values()]);
        break;
      }
      case 'colorshift': {
        const color = nearestPropColor(this.map, p.pos, this.propColors);
        this.room.emitAll('event', { type: 'tint', playerId: p.id, color, until: now + def.durationMs } satisfies GameEvent);
        break;
      }
      case 'quickdisguise': {
        const ops = this.sanitizeOps((data as { ops?: unknown })?.ops);
        if (!ops || !ops.length) {
          this.room.notice('Save a camouflage preset in the paint menu first!', 'bad', p);
          return;
        }
        p.paint = ops;
        p.redo = [];
        this.broadcastPaint(p, { k: 'replace', ops });
        this.room.emitPlayer(p, 'paint', { pid: p.id, k: 'replace', ops });
        break;
      }
      case 'scanner': {
        const zones: { p: Vec3; r: number }[] = [];
        for (const t of this.scanTargets(p, now)) {
          if (dist2(t.pos, p.pos) > SCANNER_RANGE) continue;
          const a = Math.random() * Math.PI * 2, r = 0.6 + Math.random() * 1.6;
          zones.push({ p: [t.pos[0] + Math.cos(a) * r, t.pos[1], t.pos[2] + Math.sin(a) * r], r: 2.6 });
          const victim = this.room.players.get(t.id);
          if (victim && victim.team === 'hider') this.room.emitPlayer(victim, 'event', { type: 'scanned_warning' } satisfies GameEvent);
        }
        this.room.emitPlayer(p, 'event', { type: 'scanner', zones, until: now + def.durationMs } satisfies GameEvent);
        break;
      }
      case 'footprints': {
        const prints: { p: Vec3; r: number; age: number }[] = [];
        for (const h of this.participants()) {
          if (h.id === p.id || h.caught && this.mode !== 'everyone') continue;
          if (this.mode !== 'everyone' && h.team !== 'hider') continue;
          for (const t of h.trail) if (now - t.t < 20_000 || this.mode === 'everyone') prints.push({ p: t.p, r: t.r, age: now - t.t });
        }
        this.room.emitPlayer(p, 'event', { type: 'footprints', prints: prints.slice(-200), until: now + def.durationMs } satisfies GameEvent);
        break;
      }
      case 'sound': {
        let best: RoomPlayer | null = null, bestD = SOUND_RANGE;
        for (const h of this.participants()) {
          if (h.team !== 'hider' || h.caught || h.spectating || h.id === p.id) continue;
          if (h.active('silent', now) || h.active('freeze', now) || now - h.lastMovedAt > 4000) continue;
          const d = dist2(h.pos, p.pos);
          if (d < bestD) { bestD = d; best = h; }
        }
        const angle = best ? Math.atan2(best.pos[0] - p.pos[0], best.pos[2] - p.pos[2]) + (Math.random() - 0.5) * 0.5 : null;
        this.room.emitPlayer(p, 'event', { type: 'sound', angle, dist: best ? (bestD < 9 ? 'near' : 'far') : null, until: now + def.durationMs } satisfies GameEvent);
        break;
      }
      case 'radar': {
        const angles = this.scanTargets(p, now).map((t) => Math.atan2(t.pos[0] - p.pos[0], t.pos[2] - p.pos[2]));
        this.room.emitPlayer(p, 'event', { type: 'radar', angles, until: now + def.durationMs } satisfies GameEvent);
        break;
      }
      default:
        break; // freeze, silent, speed, vanish: timed status only
    }
    if (def.bonus) st.charges = (st.charges ?? 1) - 1;
    st.readyAt = now + def.cooldownMs;
    st.activeUntil = now + def.durationMs;
    p.abilities.set(id, st);
    this.room.emitAll('event', { type: 'ability', playerId: p.id, ability: id, until: st.activeUntil } satisfies GameEvent,
      (v) => v.id === p.id || !(p.team === 'hider' && v.team === 'seeker' && ['vanish', 'freeze', 'silent'].includes(id)));
    this.sendAbilities(p);
  }

  /** Things a seeker ability can detect (hiders, or statues in Everyone Hides). */
  private scanTargets(seeker: RoomPlayer, now: number): { id: string; pos: Vec3 }[] {
    if (this.mode === 'everyone') {
      return [...this.statues.values()].filter((s) => !s.found && s.ownerId !== seeker.id).map((s) => ({ id: s.ownerId, pos: s.p }));
    }
    return this.participants()
      .filter((h) => h.team === 'hider' && !h.caught && !h.spectating && !h.active('freeze', now))
      .map((h) => ({ id: h.id, pos: h.pos }));
  }

  // ======================= interactables =======================
  handleInteract(p: RoomPlayer, id: string) {
    const now = Date.now();
    const def = this.map.interactables.find((i) => i.id === id);
    if (!def || !p.inMatch || p.spectating) return;
    if (!['prep', 'hunt'].includes(this.phase)) return;
    if (this.phase === 'prep' && p.team === 'seeker') return;
    if (now - p.lastInteractAt < 700) return;
    if (dist3(p.pos, def.p) > 3.2) return;
    p.lastInteractAt = now;
    if (def.kind === 'sound') {
      this.room.emitAll('event', { type: 'interact', id, active: true, by: p.id, kind: def.kind } satisfies GameEvent);
      return;
    }
    const next = !this.interactables[id];
    if (def.kind === 'door' && !next) {
      // don't close a door on somebody
      for (const o of this.participants()) {
        if (o.spectating) continue;
        this.disabledGroups.delete(id);
        const blocked = isEmbedded(this.world, o.pos, o.radius, o.bodyHeight, this.disabledGroups);
        this.disabledGroups.add(id);
        if (blocked) return this.room.notice('Something is in the way!', 'bad', p);
      }
    }
    this.interactables[id] = next;
    if (def.kind === 'door') {
      if (next) this.disabledGroups.add(id);
      else this.disabledGroups.delete(id);
    }
    this.room.emitAll('event', { type: 'interact', id, active: next, by: p.id, kind: def.kind } satisfies GameEvent);
    this.room.markDirty();
  }

  // ======================= chaos mode =======================
  private chaosTick(now: number) {
    if (now < this.nextChaosAt) return;
    this.nextChaosAt = now + (22_000 + Math.random() * 12_000) * this.t;
    const events: ChaosEventId[] = ['lights_out', 'fog', 'shuffle', 'color_storm', 'power_up'];
    const ev = events[Math.floor(Math.random() * events.length)];
    const dur = { lights_out: 14_000, fog: 18_000, shuffle: 4_000, color_storm: 12_000, power_up: 20_000 }[ev];
    const st: ChaosState = { event: ev, endsAt: now + dur };
    if (ev === 'color_storm') st.color = CHAOS_COLORS[Math.floor(Math.random() * CHAOS_COLORS.length)];
    if (ev === 'shuffle') {
      this.map.props.forEach((prop, i) => {
        if (prop.decor && Math.random() < 0.35) this.propColors[i] = CHAOS_COLORS[Math.floor(Math.random() * CHAOS_COLORS.length)];
      });
    }
    if (ev === 'power_up') {
      for (const p of this.participants()) {
        if (p.spectating) continue;
        const id: AbilityId = p.team === 'hider' ? 'vanish' : 'radar';
        p.abilities.set(id, { readyAt: 0, activeUntil: 0, charges: 1, expiresAt: now + dur });
        this.sendAbilities(p);
      }
    }
    this.chaos = st;
    this.room.emitAll('event', { type: 'chaos', event: ev, until: st.endsAt, color: st.color } satisfies GameEvent);
    this.room.markDirty();
  }

  // ======================= social =======================
  allowsTeamDisplay(p: RoomPlayer): Team {
    return p.team;
  }
}
