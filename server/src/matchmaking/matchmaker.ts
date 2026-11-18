// Public matchmaking: join the best open public room, or create one.
import type { RoomManager } from '../rooms/RoomManager';
import type { Room } from '../rooms/Room';
import type { Identity } from '../rooms/RoomPlayer';

export function findOrCreatePublicRoom(rooms: RoomManager, identity: Identity, socketId: string): { room: Room; created: boolean } {
  const candidates = rooms.publicRooms().filter((r) => !r.kicked.has(identity.id) && r.connectedPlayers.length > 0);
  // Prefer rooms waiting in the lobby with the most players, then rooms mid-match (you spectate until next round).
  candidates.sort((a, b) => {
    const la = a.phase === 'lobby' || a.phase === 'results' ? 1 : 0;
    const lb = b.phase === 'lobby' || b.phase === 'results' ? 1 : 0;
    if (la !== lb) return lb - la;
    return b.players.size - a.players.size;
  });
  for (const room of candidates) {
    const res = rooms.join(room.code, identity, socketId);
    if (res.room) return { room: res.room, created: false };
  }
  return { room: rooms.create(identity, socketId, true), created: true };
}
