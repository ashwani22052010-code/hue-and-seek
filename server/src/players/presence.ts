// Tracks which accounts are online (socket ids) and notifies friends of changes.
import type { Server } from 'socket.io';
import { friendIds } from '../database/repo';

class Presence {
  private sockets = new Map<string, Set<string>>();
  io: Server | null = null;

  isOnline(playerId: string) {
    return (this.sockets.get(playerId)?.size ?? 0) > 0;
  }
  socketsOf(playerId: string): string[] {
    return [...(this.sockets.get(playerId) ?? [])];
  }
  add(playerId: string, socketId: string) {
    const wasOnline = this.isOnline(playerId);
    let set = this.sockets.get(playerId);
    if (!set) this.sockets.set(playerId, (set = new Set()));
    set.add(socketId);
    if (!wasOnline) void this.notifyFriends(playerId);
  }
  remove(playerId: string, socketId: string) {
    const set = this.sockets.get(playerId);
    if (!set) return;
    set.delete(socketId);
    if (!set.size) {
      this.sockets.delete(playerId);
      void this.notifyFriends(playerId);
    }
  }
  emitTo(playerId: string, event: string, data: unknown) {
    if (!this.io) return;
    for (const sid of this.socketsOf(playerId)) this.io.to(sid).emit(event, data);
  }
  async notifyFriends(playerId: string) {
    try {
      for (const f of await friendIds(playerId)) this.emitTo(f, 'friends:changed', {});
    } catch {
      /* ignore */
    }
  }
  get onlineCount() {
    return this.sockets.size;
  }
}

export const presence = new Presence();
