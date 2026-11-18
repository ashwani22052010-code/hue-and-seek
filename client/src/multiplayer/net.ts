// Realtime connection: Socket.IO client, snapshot interpolation buffer and event dispatch.
import { io, type Socket } from 'socket.io-client';
import type { GameEvent, PaintMsg, PaintOp, RoomState, Snapshot, Vec3, AbilityStatus, DecoyState, StatueState } from '@shared/types';
import { INTERP_DELAY_MS, QUICK_CHAT, COSMETIC_BY_ID, MODES } from '@shared/constants';
import { useStore } from '../store/useStore';
import { paintFor, resetAllPaint } from '../characters/paint';
import { sfx, playMusic } from '../audio/sound';
import { refreshProfile, saveToken } from './api';
import { fx } from '../game/fxBus';
import { registry } from '../game/registry';

let socket: Socket | null = null;
type Ack = { ok: boolean; error?: string; code?: string; [k: string]: unknown };

// ---------- clock ----------
let offset = 0;
let offsetInit = false;
export const serverClock = () => Date.now() + offset;

// ---------- snapshots ----------
interface Frame { t: number; players: Map<string, { p: Vec3; yaw: number; f: number }> }
const frames: Frame[] = [];
export function sampleRemote(id: string): { p: Vec3; yaw: number; f: number; visible: boolean } | null {
  const renderT = serverClock() - INTERP_DELAY_MS;
  if (!frames.length) return null;
  const latest = frames[frames.length - 1];
  if (!latest.players.has(id)) return null; // not visible to us right now
  let a: Frame | null = null, b: Frame | null = null;
  for (let i = frames.length - 1; i >= 0; i--) {
    if (frames[i].t <= renderT) { a = frames[i]; b = frames[i + 1] ?? null; break; }
  }
  if (!a) a = frames[0];
  const pa = a.players.get(id) ?? latest.players.get(id)!;
  const pb = b?.players.get(id);
  if (!pb || !b) return { ...pa, visible: true };
  const k = Math.max(0, Math.min(1, (renderT - a.t) / Math.max(1, b.t - a.t)));
  let dy = pb.yaw - pa.yaw;
  while (dy > Math.PI) dy -= Math.PI * 2;
  while (dy < -Math.PI) dy += Math.PI * 2;
  return {
    p: [pa.p[0] + (pb.p[0] - pa.p[0]) * k, pa.p[1] + (pb.p[1] - pa.p[1]) * k, pa.p[2] + (pb.p[2] - pa.p[2]) * k],
    yaw: pa.yaw + dy * k,
    f: pb.f,
    visible: true,
  };
}
if (typeof window !== 'undefined') (window as unknown as { __hueNet: unknown }).__hueNet = { visibleIds: () => visibleIds(), sampleRemote: (id: string) => sampleRemote(id) };

export function visibleIds(): string[] {
  const latest = frames[frames.length - 1];
  return latest ? [...latest.players.keys()] : [];
}

// ---------- local player hooks ----------
type PosCb = (p: Vec3, yaw?: number) => void;
const spawnCbs = new Set<PosCb>();
export function onTeleport(cb: PosCb) {
  spawnCbs.add(cb);
  return () => { spawnCbs.delete(cb); };
}
let lastSpawn: { p: Vec3; r?: number } | null = null;
export const getLastSpawn = () => lastSpawn;

export function emit(ev: string, data?: unknown) {
  socket?.emit(ev, data);
}
export function request(ev: string, data?: unknown): Promise<Ack> {
  return new Promise((res) => {
    if (!socket?.connected) return res({ ok: false, error: 'Not connected to the server' });
    const t = setTimeout(() => res({ ok: false, error: 'Server did not respond' }), 8000);
    socket.emit(ev, data ?? {}, (r: Ack) => { clearTimeout(t); res(r); });
  });
}

export function disconnect() {
  socket?.disconnect();
  socket = null;
}

let prevPhase: string | null = null;

export function connect(token: string) {
  if (socket) socket.disconnect();
  const s = io({ auth: { token }, transports: ['websocket', 'polling'], reconnectionDelay: 600, reconnectionDelayMax: 4000 });
  socket = s;
  const st = useStore.getState;

  s.on('connect', () => st().set({ connected: true }));
  s.on('disconnect', () => st().set({ connected: false }));
  s.on('connect_error', (e) => {
    if (e.message === 'unauthorized') {
      saveToken(null);
      st().set({ token: null, profile: null });
      st().go('welcome');
      s.disconnect();
    }
  });
  s.on('hello', (h: { playerId: string; serverNow: number }) => {
    st().set({ myId: h.playerId });
    offset = h.serverNow - Date.now();
    offsetInit = true;
  });
  s.on('session:replaced', () => {
    st().toast('You opened the game in another tab - this one was disconnected.', 'bad');
    s.disconnect();
    st().set({ room: null });
    st().go('menu');
  });

  s.on('room:joined', (j: { code: string; reconnected?: boolean }) => {
    st().set({ mmStatus: null });
    if (j.reconnected) st().toast('Reconnected to your match!', 'good');
  });

  s.on('room:state', (room: RoomState) => {
    const prev = st().room;
    const sample = room.serverNow - Date.now();
    if (!offsetInit) { offset = sample; offsetInit = true; }
    st().set({ room, clockOffset: offset });
    const screen = st().screen;
    if (room.phase !== 'lobby' && prevPhase !== room.phase) onPhaseChange(room, prevPhase);
    if (room.phase === 'lobby' && screen === 'game') st().go('lobby');
    if (room.phase !== 'lobby' && screen !== 'game' && (prev?.phase !== room.phase || screen === 'menu' || screen === 'boot')) st().go('game');
    if (room.phase === 'lobby' && (screen === 'menu' || screen === 'boot' || screen === 'welcome') && !prev) st().go('lobby');
    if (room.phase === 'lobby' && prevPhase !== 'lobby') playMusic('lobby');
    prevPhase = room.phase;
  });

  s.on('snap', (snap: Snapshot) => {
    const sample = snap.t - Date.now();
    // track the clock: jump forward quickly, drift back slowly (latency spikes)
    offset = sample > offset ? offset + (sample - offset) * 0.5 : offset + (sample - offset) * 0.02;
    const players = new Map<string, { p: Vec3; yaw: number; f: number }>();
    for (const [id, x, y, z, yaw, f] of snap.pl) players.set(id, { p: [x, y, z], yaw, f });
    frames.push({ t: snap.t, players });
    while (frames.length > 40) frames.shift();
  });

  s.on('spawn', (d: { p: Vec3; r?: number }) => {
    lastSpawn = d;
    spawnCbs.forEach((cb) => cb(d.p, d.r));
  });
  s.on('correct', (d: { p: Vec3 }) => spawnCbs.forEach((cb) => cb(d.p)));

  s.on('paint', (m: PaintMsg & { pid: string }) => paintFor(m.pid).apply(m));
  s.on('paint:full', (m: { paints: Record<string, PaintOp[]> }) => resetAllPaint(m.paints));
  s.on('decoys', (d: DecoyState[]) => st().set({ decoys: d }));
  s.on('statues', (d: StatueState[]) => st().set({ statues: d }));
  s.on('abilities', (a: { list: AbilityStatus[]; tagReadyAt: number }) => st().set({ abilities: a.list, tagReadyAt: a.tagReadyAt }));
  s.on('event', (e: GameEvent) => handleEvent(e));
  s.on('invite', (i: { fromName: string; code: string }) => {
    st().set({ invite: i });
    sfx('notify');
  });
  s.on('friends:changed', () => st().set({ friendsVersion: st().friendsVersion + 1 }));
  s.on('profile:refresh', async (d: { missionsCompleted?: string[] }) => {
    await refreshProfile();
    for (const m of d.missionsCompleted ?? []) st().toast(`Mission complete: ${m}`, 'good');
  });
}

function onPhaseChange(room: RoomState, prev: string | null) {
  const st = useStore.getState;
  if (room.phase === 'assign') {
    frames.length = 0;
    st().set({
      paintMode: false, effects: { scanner: null, footprints: null, sound: null, radar: null }, tints: {}, active: {}, bubbles: {},
      chaosFx: null, pauseOpen: false, quickMenu: 'none', spectateIdx: 0, decoys: [], statues: [],
    });
    sfx('whoosh');
    playMusic('prep');
  }
  if (room.phase === 'prep') sfx('start');
  if (room.phase === 'hunt') { sfx('hunt'); playMusic('hunt'); st().set({ paintMode: false }); }
  if (room.phase === 'results' && prev !== 'results') {
    const me = room.results?.players.find((p) => p.id === st().myId);
    sfx(me?.won ? 'victory' : 'defeat');
    playMusic('results');
  }
  if (room.phase === 'intermission') sfx('whoosh');
}

function bubble(playerId: string, text: string) {
  const st = useStore.getState();
  st.set({ bubbles: { ...st.bubbles, [playerId]: { text, until: Date.now() + 3500 } } });
}

function nameOf(id: string) {
  return useStore.getState().room?.players.find((p) => p.id === id)?.name ?? 'Someone';
}

function handleEvent(e: GameEvent) {
  const st = useStore.getState();
  const me = st.myId;
  switch (e.type) {
    case 'notice':
      st.toast(e.text, e.tone ?? 'info');
      break;
    case 'caught': {
      fx.emit({ kind: 'caught', id: e.hiderId });
      sfx('caught');
      if (e.hiderId === me) st.toast(e.statue ? `${nameOf(e.seekerId)} found your statue!` : `You were found by ${nameOf(e.seekerId)}!`, 'bad');
      else if (e.seekerId === me) st.toast(`You found ${nameOf(e.hiderId)}! +100`, 'good');
      else st.toast(`${nameOf(e.seekerId)} found ${nameOf(e.hiderId)}`, 'info');
      break;
    }
    case 'miss':
      fx.emit({ kind: 'poke', p: e.p, hit: false });
      if (e.seekerId === me) sfx('miss');
      break;
    case 'decoy_popped':
      fx.emit({ kind: 'decoy', id: e.decoyId });
      sfx('boing');
      if (e.seekerId === me) st.toast('That was a decoy! Stunned for a moment...', 'bad');
      if (e.ownerId === me) st.toast('Your decoy fooled a seeker! +25', 'good');
      break;
    case 'ability': {
      const cur = st.active[e.playerId] ?? {};
      st.set({ active: { ...st.active, [e.playerId]: { ...cur, [e.ability]: e.until } } });
      if (e.playerId === me) sfx('ability');
      break;
    }
    case 'tint':
      st.set({ tints: { ...st.tints, [e.playerId]: { color: e.color, until: e.until } } });
      break;
    case 'scanner':
      st.set({ effects: { ...st.effects, scanner: { zones: e.zones, until: Date.now() + (e.until - serverClock()) } } });
      sfx('scan');
      if (!e.zones.length) st.toast('Scanner: nothing nearby', 'info');
      break;
    case 'scanned_warning':
      st.toast('A scanner pulse swept over you!', 'bad');
      sfx('scan');
      break;
    case 'footprints':
      st.set({ effects: { ...st.effects, footprints: { prints: e.prints, until: Date.now() + (e.until - serverClock()) } } });
      if (!e.prints.length) st.toast('No fresh footprints...', 'info');
      break;
    case 'sound':
      st.set({ effects: { ...st.effects, sound: { angle: e.angle, dist: e.dist, until: Date.now() + (e.until - serverClock()) } } });
      if (e.angle === null) st.toast('You hear nothing nearby...', 'info');
      break;
    case 'radar':
      st.set({ effects: { ...st.effects, radar: { angles: e.angles, until: Date.now() + (e.until - serverClock()) } } });
      break;
    case 'chaos': {
      st.set({ chaosFx: { event: e.event, until: Date.now() + (e.until - serverClock()), color: e.color } });
      const label = { lights_out: 'BLACKOUT! The lights are out!', fog: 'A thick fog rolls in...', shuffle: 'Decorations shuffled!', color_storm: 'COLOR STORM! Everyone is tinted!', power_up: 'POWER UP! Check your bonus ability!' }[e.event];
      st.toast(label, 'info');
      sfx('chaos');
      break;
    }
    case 'interact': {
      const def = registry.map?.interactables.find((i) => i.id === e.id);
      const name = e.kind === 'door' ? 'door' : e.kind === 'lamp' ? 'click' : (def?.sound === 'boing' ? 'boing' : def?.sound ?? 'toy');
      sfx(name, def?.p);
      if (def && e.kind === 'sound') bubble(e.by, '🔊');
      break;
    }
    case 'emote': {
      const item = COSMETIC_BY_ID[e.emote];
      bubble(e.playerId, item?.name.split(' ').pop() ?? '🙂');
      fx.emit({ kind: 'emote', id: e.playerId, emote: e.emote });
      break;
    }
    case 'chat':
      bubble(e.playerId, QUICK_CHAT[e.msg] ?? '');
      if (e.playerId !== me) sfx('pop');
      break;
    case 'kicked':
      st.toast('You were removed from the room by the host.', 'bad');
      st.set({ room: null });
      st.go('menu');
      break;
    case 'infected':
      if (e.playerId === me) st.toast('You were infected - now hunt the others!', 'bad');
      else st.toast(`${nameOf(e.playerId)} has been infected!`, 'info');
      break;
    case 'phase':
      if (e.phase === 'hunt') {
        const room = st.room;
        if (room && MODES[room.settings.mode]) { /* banner handled by HUD */ }
      }
      break;
  }
}
