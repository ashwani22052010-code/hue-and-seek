// Owns all rooms: creation, unique codes, join/leave, cleanup and the global tick loop.
import crypto from 'node:crypto';
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH, TICK_RATE } from '@shared/constants';
import { Room, type Emitter } from './Room';
import type { Identity } from './RoomPlayer';

export class RoomManager {
  rooms = new Map<string, Room>();
  playerRoom = new Map<string, string>();
  private timer: NodeJS.Timeout | null = null;

  constructor(private emitter: Emitter) {}

  start() {
    this.timer = setInterval(() => this.tick(), 1000 / TICK_RATE);
  }
  stop() {
    if (this.timer) clearInterval(this.timer);
  }

  private newCode(): string {
    for (;;) {
      let code = '';
      for (let i = 0; i < ROOM_CODE_LENGTH; i++) code += ROOM_CODE_ALPHABET[crypto.randomInt(ROOM_CODE_ALPHABET.length)];
      if (!this.rooms.has(code)) return code;
    }
  }

  roomOf(playerId: string): Room | null {
    const code = this.playerRoom.get(playerId);
    const room = code ? this.rooms.get(code) : undefined;
    if (!room || !room.players.has(playerId)) {
      if (code) this.playerRoom.delete(playerId);
      return null;
    }
    return room;
  }

  create(identity: Identity, socketId: string, isPublic: boolean): Room {
    this.leave(identity.id);
    const room = new Room(this.newCode(), isPublic, identity, this.emitter);
    this.rooms.set(room.code, room);
    room.addPlayer(identity, socketId);
    this.playerRoom.set(identity.id, room.code);
    return room;
  }

  join(code: string, identity: Identity, socketId: string): { room?: Room; error?: string } {
    const room = this.rooms.get(code.toUpperCase());
    if (!room || room.closed) return { error: 'Room not found - check the code' };
    if (room.kicked.has(identity.id)) return { error: 'You were removed from this room' };
    const already = room.players.has(identity.id);
    if (!already && room.isFull) return { error: 'Room is full' };
    const current = this.roomOf(identity.id);
    if (current && current !== room) this.leave(identity.id);
    room.addPlayer(identity, socketId);
    this.playerRoom.set(identity.id, room.code);
    return { room };
  }

  leave(playerId: string) {
    const room = this.roomOf(playerId);
    this.playerRoom.delete(playerId);
    if (room) room.removePlayer(playerId, 'left');
  }

  /** Keep profile info shown in rooms in sync after a cosmetics/name change. */
  updateIdentity(identity: Partial<Identity> & { id: string }) {
    const room = this.roomOf(identity.id);
    const p = room?.players.get(identity.id);
    if (!room || !p) return;
    if (identity.name) p.name = identity.name;
    if (identity.tag) p.tag = identity.tag;
    if (identity.cosmetics) p.cosmetics = identity.cosmetics;
    if (identity.level) p.level = identity.level;
    room.markDirty();
  }

  publicRooms(): Room[] {
    return [...this.rooms.values()].filter((r) => r.isPublic && !r.closed && !r.isFull);
  }

  private tick() {
    const now = Date.now();
    for (const room of this.rooms.values()) {
      try {
        room.tick(now);
      } catch (e) {
        console.error(`[room ${room.code}] tick error`, e);
      }
      if (room.shouldClose(now)) {
        room.closed = true;
        for (const id of room.players.keys()) if (this.playerRoom.get(id) === room.code) this.playerRoom.delete(id);
        room.match?.dispose();
        this.rooms.delete(room.code);
      }
    }
  }
}
