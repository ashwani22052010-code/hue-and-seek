// A room: membership, host, lobby settings, ready system. Gameplay lives in game-engine/Match.
import type { MapId, ModeId, RoomSettings, RoomState } from '@shared/types';
import {
  DEFAULT_SETTINGS, EMPTY_ROOM_TTL_MS, HUNT_TIME_OPTIONS, LOBBY_IDLE_TTL_MS, MAP_IDS, MAX_PLAYERS, MIN_PLAYERS,
  MODE_IDS, PREP_TIME_OPTIONS, PUBLIC_AUTOSTART_MS, RECONNECT_GRACE_MS,
} from '@shared/constants';
import { RoomPlayer, type Identity } from './RoomPlayer';
import { Match } from '../game-engine/Match';
import { config } from '../config';

export interface Emitter {
  toSocket(socketId: string, event: string, data: unknown): void;
}

export class Room {
  code: string;
  isPublic: boolean;
  hostId: string;
  settings: RoomSettings = { ...DEFAULT_SETTINGS };
  players = new Map<string, RoomPlayer>();
  kicked = new Set<string>();
  createdAt = Date.now();
  lastActivity = Date.now();
  emptySince: number | null = null;
  match: Match | null = null;
  seekerHistory: Record<string, number> = {};
  autoStartAt: number | null = null;
  dirty = true;
  closed = false;

  constructor(code: string, isPublic: boolean, host: Identity, public emitter: Emitter) {
    this.code = code;
    this.isPublic = isPublic;
    this.hostId = host.id;
    if (isPublic) {
      this.settings.mapId = MAP_IDS[Math.floor(Math.random() * MAP_IDS.length)];
      this.settings.mode = Math.random() < 0.6 ? 'classic' : (['infection', 'chaos'] as ModeId[])[Math.floor(Math.random() * 2)];
    }
  }

  get phase() {
    return this.match?.phase ?? 'lobby';
  }
  get connectedPlayers() {
    return [...this.players.values()].filter((p) => p.connected);
  }
  get isFull() {
    return this.players.size >= Math.min(this.settings.maxPlayers, MAX_PLAYERS);
  }

  // ---------- emit helpers ----------
  emitPlayer(p: RoomPlayer, event: string, data: unknown) {
    if (p.connected && p.socketId) this.emitter.toSocket(p.socketId, event, data);
  }
  emitAll(event: string, data: unknown, filter?: (p: RoomPlayer) => boolean) {
    for (const p of this.players.values()) if (!filter || filter(p)) this.emitPlayer(p, event, data);
  }
  notice(text: string, tone: 'info' | 'good' | 'bad' = 'info', to?: RoomPlayer) {
    const ev = { type: 'notice', text, tone };
    if (to) this.emitPlayer(to, 'event', ev);
    else this.emitAll('event', ev);
  }

  state(): RoomState {
    const m = this.match;
    return {
      code: this.code,
      isPublic: this.isPublic,
      hostId: this.hostId,
      settings: this.settings,
      phase: this.phase,
      phaseEndsAt: m?.phaseEndsAt ?? 0,
      serverNow: Date.now(),
      round: m?.round ?? 0,
      totalRounds: m?.totalRounds ?? 0,
      teamScores: m?.teamScores(),
      players: [...this.players.values()].map((p) => p.toPublic(this.hostId)),
      results: m?.results ?? null,
      chaos: m?.chaos ?? null,
      interactables: m?.interactables ?? {},
      propColors: m?.propColors ?? {},
      autoStartAt: this.autoStartAt,
    };
  }
  markDirty() {
    this.dirty = true;
    this.lastActivity = Date.now();
  }
  flush() {
    if (!this.dirty) return;
    this.dirty = false;
    this.emitAll('room:state', this.state());
  }

  // ---------- membership ----------
  addPlayer(identity: Identity, socketId: string): RoomPlayer {
    let p = this.players.get(identity.id);
    if (!p) {
      p = new RoomPlayer(identity);
      this.players.set(p.id, p);
      if (!this.players.has(this.hostId) || !this.players.get(this.hostId)?.connected) this.hostId = p.id;
      this.notice(`${p.name} joined the room`, 'good');
    }
    p.socketId = socketId;
    p.connected = true;
    p.disconnectedAt = 0;
    this.emptySince = null;
    this.markDirty();
    this.match?.onPlayerJoined(p);
    return p;
  }

  /** Socket dropped: keep the slot for a grace period so the player can reconnect. */
  disconnect(playerId: string, socketId: string) {
    const p = this.players.get(playerId);
    if (!p || p.socketId !== socketId) return;
    p.connected = false;
    p.socketId = null;
    p.disconnectedAt = Date.now();
    p.ready = false;
    p.voiceOn = false;
    p.micOn = false;
    if (this.hostId === p.id) this.pickNewHost();
    if (!this.connectedPlayers.length) this.emptySince = Date.now();
    this.markDirty();
  }

  removePlayer(playerId: string, reason: 'left' | 'kicked' | 'timeout') {
    const p = this.players.get(playerId);
    if (!p) return;
    this.players.delete(playerId);
    this.match?.onPlayerRemoved(p);
    if (this.hostId === playerId) this.pickNewHost();
    if (!this.connectedPlayers.length) this.emptySince = this.emptySince ?? Date.now();
    this.notice(reason === 'kicked' ? `${p.name} was removed by the host` : `${p.name} left the room`, 'info');
    this.markDirty();
  }

  pickNewHost() {
    const next = this.connectedPlayers.sort((a, b) => a.joinedAt - b.joinedAt)[0];
    if (next) {
      this.hostId = next.id;
      this.notice(`${next.name} is now the host`);
    }
  }

  // ---------- lobby actions ----------
  updateSettings(by: string, patch: Partial<RoomSettings>): string | null {
    if (by !== this.hostId) return 'Only the host can change settings';
    if (this.phase !== 'lobby' && this.phase !== 'results') return 'Settings can only change in the lobby';
    const s = { ...this.settings };
    if (patch.mapId !== undefined) {
      if (!MAP_IDS.includes(patch.mapId as MapId)) return 'Unknown map';
      s.mapId = patch.mapId;
    }
    if (patch.mode !== undefined) {
      if (!MODE_IDS.includes(patch.mode as ModeId)) return 'Unknown mode';
      s.mode = patch.mode;
    }
    if (patch.prepTime !== undefined) {
      if (!PREP_TIME_OPTIONS.includes(Number(patch.prepTime))) return 'Invalid prep time';
      s.prepTime = Number(patch.prepTime);
    }
    if (patch.huntTime !== undefined) {
      if (!HUNT_TIME_OPTIONS.includes(Number(patch.huntTime))) return 'Invalid hunt time';
      s.huntTime = Number(patch.huntTime);
    }
    if (patch.maxPlayers !== undefined) {
      const n = Number(patch.maxPlayers);
      if (!Number.isInteger(n) || n < MIN_PLAYERS || n > MAX_PLAYERS || n < this.players.size) return 'Invalid player limit';
      s.maxPlayers = n;
    }
    this.settings = s;
    for (const p of this.players.values()) if (p.id !== this.hostId) p.ready = false;
    this.markDirty();
    return null;
  }

  setReady(playerId: string, ready: boolean) {
    const p = this.players.get(playerId);
    if (!p) return;
    p.ready = ready;
    this.markDirty();
  }

  kick(by: string, target: string): string | null {
    if (by !== this.hostId) return 'Only the host can kick players';
    if (by === target) return "You can't kick yourself";
    const p = this.players.get(target);
    if (!p) return 'Player not in room';
    this.kicked.add(target);
    this.emitPlayer(p, 'event', { type: 'kicked' });
    this.removePlayer(target, 'kicked');
    return null;
  }

  transferHost(by: string, target: string): string | null {
    if (by !== this.hostId) return 'Only the host can transfer ownership';
    const p = this.players.get(target);
    if (!p || !p.connected) return 'Player not available';
    this.hostId = target;
    this.notice(`${p.name} is now the host`, 'good');
    this.markDirty();
    return null;
  }

  canStart(): string | null {
    const connected = this.connectedPlayers;
    if (connected.length < MIN_PLAYERS) return `Need at least ${MIN_PLAYERS} players`;
    const notReady = connected.filter((p) => p.id !== this.hostId && !p.ready);
    if (notReady.length) return `Waiting for ${notReady.map((p) => p.name).join(', ')} to be ready`;
    return null;
  }

  start(by: string | null): string | null {
    if (by !== null && by !== this.hostId) return 'Only the host can start the match';
    if (this.phase !== 'lobby' && this.phase !== 'results') return 'Match already running';
    const err = this.canStart();
    if (err) return err;
    this.autoStartAt = null;
    this.match = new Match(this);
    this.match.start();
    this.markDirty();
    return null;
  }

  backToLobby(by: string | null): string | null {
    if (by !== null && by !== this.hostId) return 'Only the host can do that';
    if (this.match && this.match.phase !== 'results') return 'Match still running';
    this.match?.dispose();
    this.match = null;
    for (const p of this.players.values()) {
      p.ready = false;
      p.team = 'none';
      p.inMatch = false;
      p.resetForMatch();
    }
    this.markDirty();
    return null;
  }

  // ---------- tick ----------
  tick(now: number) {
    if (this.match) this.match.tick(now);
    // reconnect grace expiry
    for (const p of [...this.players.values()]) {
      if (!p.connected && p.disconnectedAt) {
        const grace = this.phase === 'lobby' ? 15_000 : RECONNECT_GRACE_MS;
        if (now - p.disconnectedAt > grace) this.removePlayer(p.id, 'timeout');
      }
    }
    // public rooms start automatically once everyone is ready
    if (this.isPublic && this.phase === 'lobby') {
      const allReady = this.connectedPlayers.length >= MIN_PLAYERS && this.connectedPlayers.every((p) => p.ready);
      if (allReady && this.autoStartAt === null) {
        this.autoStartAt = now + (config.fastTimers ? 2000 : 5000);
        this.markDirty();
      } else if (!allReady && this.autoStartAt !== null) {
        this.autoStartAt = null;
        this.markDirty();
      } else if (this.autoStartAt !== null && now >= this.autoStartAt) {
        this.autoStartAt = null;
        this.start(null);
      }
      // a public lobby full of waiting players starts after a while even if someone is idle
      if (this.connectedPlayers.length >= 4 && this.autoStartAt === null && now - this.lastActivity > PUBLIC_AUTOSTART_MS * 4) {
        for (const p of this.connectedPlayers) p.ready = true;
        this.markDirty();
      }
    }
    this.flush();
  }

  shouldClose(now: number): boolean {
    if (this.closed) return true;
    if (this.emptySince !== null && now - this.emptySince > EMPTY_ROOM_TTL_MS) return true;
    if (this.players.size === 0) return true;
    if (this.phase === 'lobby' && now - this.lastActivity > LOBBY_IDLE_TTL_MS) return true;
    return false;
  }
}
