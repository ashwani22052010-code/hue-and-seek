// Socket.IO wiring: authentication, validation, rate limiting and dispatch to rooms.
import type { Server, Socket } from 'socket.io';
import type { AbilityId, MoveMsg, PaintMsg, PlayerLook, RoomSettings } from '@shared/types';
import { ABILITIES, COSMETIC_BY_ID, QUICK_CHAT } from '@shared/constants';
import { getIdentity, playerIdForToken, areFriends, getProfile, touchLastSeen } from '../database/repo';
import { presence } from '../players/presence';
import type { RoomManager } from '../rooms/RoomManager';
import type { Identity } from '../rooms/RoomPlayer';
import { findOrCreatePublicRoom } from '../matchmaking/matchmaker';
import { SocketLimiter } from '../security/rateLimit';
import { isFiniteNum, isObj, isVec3, oneOf, str } from '../security/validation';

type Ack = (res: { ok: boolean; error?: string; code?: string; [k: string]: unknown }) => void;
const ackOf = (a: unknown): Ack => (typeof a === 'function' ? (a as Ack) : () => {});

interface SocketData { playerId: string; identity: Identity; owned: Set<string>; limiter: SocketLimiter }

/** Cache of owned items per player for emote validation (updated by the shop route). */
export const ownedCache = new Map<string, Set<string>>();

export function attachSockets(io: Server, rooms: RoomManager) {
  io.use(async (socket, next) => {
    try {
      const playerId = await playerIdForToken(socket.handshake.auth?.token);
      if (!playerId) return next(new Error('unauthorized'));
      const identity = await getIdentity(playerId);
      if (!identity) return next(new Error('unauthorized'));
      const profile = await getProfile(playerId);
      const owned = new Set(profile?.owned ?? []);
      ownedCache.set(playerId, owned);
      (socket.data as SocketData) = { playerId, identity, owned, limiter: new SocketLimiter() };
      next();
    } catch (e) {
      console.error('[socket] auth error', e);
      next(new Error('server error'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const data = socket.data as SocketData;
    const pid = data.playerId;
    const limit = (cat: string) => data.limiter.allow(cat);

    // One live connection per account: newer tab wins.
    for (const sid of presence.socketsOf(pid)) {
      io.to(sid).emit('session:replaced', {});
      io.sockets.sockets.get(sid)?.disconnect(true);
    }
    presence.add(pid, socket.id);
    void touchLastSeen(pid);
    socket.emit('hello', { playerId: pid, serverNow: Date.now() });

    // Reconnect into an existing room.
    const existing = rooms.roomOf(pid);
    if (existing) {
      existing.addPlayer(data.identity, socket.id);
      socket.emit('room:joined', { code: existing.code, reconnected: true });
      socket.emit('room:state', existing.state());
    }

    const room = () => rooms.roomOf(pid);
    const me = () => room()?.players.get(pid) ?? null;
    const refreshIdentity = async () => {
      const id = await getIdentity(pid);
      if (id) data.identity = id;
      return data.identity;
    };
    const joined = (code: string, ack: Ack) => {
      const r = rooms.rooms.get(code)!;
      ack({ ok: true, code });
      socket.emit('room:joined', { code });
      socket.emit('room:state', r.state());
    };

    socket.on('ping:check', (_d, a) => ackOf(a)({ ok: true, t: Date.now() }));

    socket.on('room:create', async (d, a) => {
      const ack = ackOf(a);
      if (!limit('room')) return ack({ ok: false, error: 'Slow down' });
      const identity = await refreshIdentity();
      const r = rooms.create(identity, socket.id, isObj(d) && d.isPublic === true);
      joined(r.code, ack);
    });

    socket.on('room:join', async (d, a) => {
      const ack = ackOf(a);
      if (!limit('room')) return ack({ ok: false, error: 'Slow down' });
      const code = isObj(d) ? str(d.code, 12) : null;
      if (!code || !/^[A-Za-z0-9]{6}$/.test(code)) return ack({ ok: false, error: 'Enter a 6-character room code' });
      const identity = await refreshIdentity();
      const res = rooms.join(code.toUpperCase(), identity, socket.id);
      if (!res.room) return ack({ ok: false, error: res.error });
      joined(res.room.code, ack);
    });

    socket.on('mm:find', async (_d, a) => {
      const ack = ackOf(a);
      if (!limit('room')) return ack({ ok: false, error: 'Slow down' });
      const identity = await refreshIdentity();
      const { room: r, created } = findOrCreatePublicRoom(rooms, identity, socket.id);
      joined(r.code, (res) => ack({ ...res, created }));
    });

    socket.on('room:leave', (_d, a) => {
      rooms.leave(pid);
      ackOf(a)({ ok: true });
    });

    socket.on('room:settings', (d, a) => {
      const ack = ackOf(a);
      const r = room();
      if (!r || !isObj(d) || !limit('misc')) return ack({ ok: false, error: 'Not in a room' });
      const err = r.updateSettings(pid, d as Partial<RoomSettings>);
      ack(err ? { ok: false, error: err } : { ok: true });
    });

    socket.on('room:ready', (d) => {
      const r = room();
      if (r && isObj(d) && limit('misc')) r.setReady(pid, d.ready === true);
    });

    socket.on('room:kick', (d, a) => {
      const ack = ackOf(a);
      const r = room();
      const target = isObj(d) ? str(d.playerId, 64) : null;
      if (!r || !target) return ack({ ok: false, error: 'Invalid' });
      const err = r.kick(pid, target);
      if (!err) rooms.playerRoom.delete(target);
      ack(err ? { ok: false, error: err } : { ok: true });
    });

    socket.on('room:transfer', (d, a) => {
      const ack = ackOf(a);
      const r = room();
      const target = isObj(d) ? str(d.playerId, 64) : null;
      if (!r || !target) return ack({ ok: false, error: 'Invalid' });
      const err = r.transferHost(pid, target);
      ack(err ? { ok: false, error: err } : { ok: true });
    });

    socket.on('room:start', (_d, a) => {
      const ack = ackOf(a);
      const r = room();
      if (!r || !limit('room')) return ack({ ok: false, error: 'Not in a room' });
      const err = r.start(pid);
      ack(err ? { ok: false, error: err } : { ok: true });
    });

    socket.on('room:lobby', (_d, a) => {
      const ack = ackOf(a);
      const r = room();
      if (!r) return ack({ ok: false, error: 'Not in a room' });
      const err = r.backToLobby(pid);
      ack(err ? { ok: false, error: err } : { ok: true });
    });

    // ---------- realtime gameplay ----------
    socket.on('move', (d) => {
      if (!limit('move') || !isObj(d)) return;
      const r = room(), p = me();
      if (!r?.match || !p) return;
      if (!isVec3(d.p) || !isFiniteNum(d.r) || !isFiniteNum(d.f) || !isFiniteNum(d.s)) return;
      r.match.handleMove(p, { p: d.p, r: d.r, f: d.f | 0, s: d.s } as MoveMsg);
    });

    socket.on('look', (d) => {
      if (!limit('misc') || !isObj(d)) return;
      const r = room(), p = me();
      if (r?.match && p) r.match.handleLook(p, d as Partial<PlayerLook>);
    });

    socket.on('paint', (d) => {
      if (!limit('paint') || !isObj(d)) return;
      const r = room(), p = me();
      if (!r?.match || !p) return;
      const k = oneOf(d.k, ['op', 'undo', 'redo', 'replace'] as const);
      if (!k) return;
      r.match.handlePaint(p, d as unknown as PaintMsg);
    });

    socket.on('tag', (d) => {
      if (!limit('tag') || !isObj(d) || !isVec3(d.p)) return;
      const r = room(), p = me();
      if (r?.match && p) r.match.handleTag(p, d.p);
    });

    socket.on('ability', (d) => {
      if (!limit('ability') || !isObj(d)) return;
      const id = oneOf(d.id, Object.keys(ABILITIES) as AbilityId[]);
      const r = room(), p = me();
      if (id && r?.match && p) r.match.handleAbility(p, id, d.data);
    });

    socket.on('interact', (d) => {
      if (!limit('misc') || !isObj(d)) return;
      const id = str(d.id, 40);
      const r = room(), p = me();
      if (id && r?.match && p) r.match.handleInteract(p, id);
    });

    socket.on('emote', (d) => {
      if (!limit('emote') || !isObj(d)) return;
      const id = str(d.id, 40);
      const item = id ? COSMETIC_BY_ID[id] : undefined;
      if (!item || item.slot !== 'emote') return;
      const owned = ownedCache.get(pid) ?? data.owned;
      if (item.price > 0 && !owned.has(item.id)) return;
      room()?.emitAll('event', { type: 'emote', playerId: pid, emote: item.id });
    });

    socket.on('chat', (d) => {
      if (!isObj(d) || !Number.isInteger(d.msg) || (d.msg as number) < 0 || (d.msg as number) >= QUICK_CHAT.length) return;
      if (!limit('chat')) return socket.emit('event', { type: 'notice', text: 'Chatting too fast', tone: 'bad' });
      room()?.emitAll('event', { type: 'chat', playerId: pid, msg: d.msg });
    });

    // ---------- voice chat (WebRTC signalling relay; audio flows peer-to-peer) ----------
    socket.on('voice:state', (d, a) => {
      const ack = ackOf(a);
      if (!limit('misc') || !isObj(d)) return ack({ ok: false, error: 'Slow down' });
      const r = room(), p = me();
      if (!r || !p) return ack({ ok: false, error: 'Join a room first' });
      const on = d.on === true;
      if (on && r.isPublic) return ack({ ok: false, error: 'Voice chat is only available in private rooms' });
      p.voiceOn = on;
      p.micOn = on && d.mic === true;
      r.markDirty();
      ack({ ok: true });
    });

    socket.on('voice:signal', (d) => {
      if (!limit('voice') || !isObj(d)) return;
      const to = str(d.to, 64);
      const r = room(), p = me();
      if (!to || !r || !p || !p.voiceOn || r.isPublic) return;
      const target = r.players.get(to);
      if (!target || !target.voiceOn || target.id === pid) return;
      if (!isObj(d.data) || JSON.stringify(d.data).length > 16_000) return;
      r.emitPlayer(target, 'voice:signal', { from: pid, data: d.data });
    });

    socket.on('friend:invite', async (d, a) => {
      const ack = ackOf(a);
      if (!limit('misc') || !isObj(d)) return ack({ ok: false, error: 'Slow down' });
      const fid = str(d.friendId, 64);
      const r = room();
      if (!fid || !r) return ack({ ok: false, error: 'Join a room first' });
      if (!(await areFriends(pid, fid))) return ack({ ok: false, error: 'Not friends' });
      if (!presence.isOnline(fid)) return ack({ ok: false, error: 'Friend is offline' });
      presence.emitTo(fid, 'invite', { fromId: pid, fromName: data.identity.name, code: r.code });
      ack({ ok: true });
    });

    socket.on('disconnect', () => {
      presence.remove(pid, socket.id);
      const r = rooms.roomOf(pid);
      if (r) r.disconnect(pid, socket.id);
    });
  });
}
