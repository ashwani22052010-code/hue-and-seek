// REST API: accounts, profile, shop, leaderboards, friends.
import express, { type NextFunction, type Request, type Response } from 'express';
import { validateName, validateUsername } from '@shared/game-rules/rules';
import { levelFromXp } from '@shared/game-rules/progression';
import * as repo from '../database/repo';
import { httpLimiter } from '../security/rateLimit';
import { validatePassword } from '../security/auth';
import { presence } from '../players/presence';
import type { RoomManager } from '../rooms/RoomManager';
import { ownedCache } from '../network/socket';
import { config } from '../config';

type AuthedRequest = Request & { playerId?: string; token?: string };

const wrap = (fn: (req: AuthedRequest, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) => {
  fn(req as AuthedRequest, res).catch((e: Error) => {
    if (e.message && !e.message.includes('relation') && e.message.length < 120) res.status(400).json({ error: e.message });
    else next(e);
  });
};

export function apiRouter(rooms: RoomManager) {
  const r = express.Router();
  r.use(express.json({ limit: '32kb' }));
  r.use(httpLimiter(240, 60));

  const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    const h = req.headers.authorization ?? '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : '';
    repo.playerIdForToken(token).then((id) => {
      if (!id) return void res.status(401).json({ error: 'Not signed in' });
      (req as AuthedRequest).playerId = id;
      (req as AuthedRequest).token = token;
      next();
    }).catch(next);
  };

  const authLimiter = httpLimiter(10, 6);

  r.get('/health', (_req, res) => res.json({ ok: true, rooms: rooms.rooms.size, online: presence.onlineCount }));

  r.post('/auth/guest', authLimiter, wrap(async (req, res) => {
    const v = validateName(req.body?.name);
    if (!v.ok) return res.status(400).json({ error: v.error });
    const { token, id } = await repo.createGuest(v.name);
    res.json({ token, profile: await repo.getProfile(id) });
  }));

  r.post('/auth/register', authLimiter, wrap(async (req, res) => {
    const u = validateUsername(req.body?.username);
    if (!u.ok) return res.status(400).json({ error: u.error });
    const pwErr = validatePassword(req.body?.password);
    if (pwErr) return res.status(400).json({ error: pwErr });
    // Upgrading the current guest account keeps all progress.
    const h = req.headers.authorization ?? '';
    const current = h.startsWith('Bearer ') ? await repo.playerIdForToken(h.slice(7)) : null;
    if (current) {
      await repo.registerAccount(current, u.username, req.body.password);
      return res.json({ token: h.slice(7), profile: await repo.getProfile(current) });
    }
    const v = validateName(req.body?.name ?? u.username);
    if (!v.ok) return res.status(400).json({ error: v.error });
    const { token, id } = await repo.createAccount(v.name, u.username, req.body.password);
    res.json({ token, profile: await repo.getProfile(id) });
  }));

  r.post('/auth/login', authLimiter, wrap(async (req, res) => {
    const u = validateUsername(req.body?.username);
    if (!u.ok || typeof req.body?.password !== 'string') return res.status(400).json({ error: 'Invalid username or password' });
    const result = await repo.login(u.username, req.body.password);
    if (!result) return res.status(401).json({ error: 'Invalid username or password' });
    res.json({ token: result.token, profile: await repo.getProfile(result.id) });
  }));

  r.post('/auth/logout', requireAuth, wrap(async (req, res) => {
    await repo.revokeToken(req.token!);
    res.json({ ok: true });
  }));

  r.get('/me', requireAuth, wrap(async (req, res) => {
    res.json({ profile: await repo.getProfile(req.playerId!) });
  }));

  r.patch('/me', requireAuth, wrap(async (req, res) => {
    const id = req.playerId!;
    if (req.body?.name !== undefined) {
      const v = validateName(req.body.name);
      if (!v.ok) return res.status(400).json({ error: v.error });
      await repo.renamePlayer(id, v.name);
    }
    if (req.body?.cosmetics !== undefined) {
      if (typeof req.body.cosmetics !== 'object' || !req.body.cosmetics) return res.status(400).json({ error: 'Invalid cosmetics' });
      await repo.setCosmetics(id, req.body.cosmetics);
    }
    const profile = await repo.getProfile(id);
    if (profile) rooms.updateIdentity({ id, name: profile.name, tag: profile.tag, cosmetics: profile.cosmetics, level: profile.level });
    res.json({ profile });
  }));

  r.post('/shop/buy', requireAuth, wrap(async (req, res) => {
    const itemId = typeof req.body?.itemId === 'string' ? req.body.itemId : '';
    const result = await repo.buyItem(req.playerId!, itemId);
    ownedCache.set(req.playerId!, new Set(result.owned));
    res.json({ profile: await repo.getProfile(req.playerId!) });
  }));

  r.get('/me/history', requireAuth, wrap(async (req, res) => {
    res.json({ matches: await repo.matchHistory(req.playerId!) });
  }));

  r.get('/leaderboard', requireAuth, wrap(async (req, res) => {
    const scope = req.query.scope === 'friends' ? 'friends' : 'global';
    res.json({ entries: scope === 'friends' ? await repo.friendsLeaderboard(req.playerId!) : await repo.globalLeaderboard() });
  }));

  r.get('/players/:id', requireAuth, wrap(async (req, res) => {
    const id = String(req.params.id).slice(0, 64);
    const p = await repo.getPublicProfile(id, presence.isOnline(id));
    if (!p) return res.status(404).json({ error: 'Player not found' });
    res.json({ profile: p, isFriend: await repo.areFriends(req.playerId!, id) });
  }));

  r.get('/friends', requireAuth, wrap(async (req, res) => {
    const list = await repo.listFriends(req.playerId!, (id) => presence.isOnline(id), (id) => !!rooms.roomOf(id));
    res.json({ ...list, recent: await repo.recentPlayers(req.playerId!) });
  }));

  r.post('/friends/request', requireAuth, wrap(async (req, res) => {
    const target = typeof req.body?.id === 'string' ? { id: req.body.id.slice(0, 64) } : { nameTag: String(req.body?.nameTag ?? '').slice(0, 30) };
    const out = await repo.requestFriend(req.playerId!, target);
    presence.emitTo(out.otherId, 'friends:changed', {});
    res.json(out);
  }));

  r.post('/friends/respond', requireAuth, wrap(async (req, res) => {
    const other = String(req.body?.id ?? '').slice(0, 64);
    await repo.respondFriend(req.playerId!, other, req.body?.accept === true);
    presence.emitTo(other, 'friends:changed', {});
    res.json({ ok: true });
  }));

  r.delete('/friends/:id', requireAuth, wrap(async (req, res) => {
    const other = String(req.params.id).slice(0, 64);
    await repo.removeFriend(req.playerId!, other);
    presence.emitTo(other, 'friends:changed', {});
    res.json({ ok: true });
  }));

  r.get('/voice-config', requireAuth, (_req, res) => {
    const iceServers: { urls: string | string[]; username?: string; credential?: string }[] = [];
    if (config.voiceStun.length) iceServers.push({ urls: config.voiceStun });
    if (config.voiceTurnUrl) iceServers.push({ urls: config.voiceTurnUrl.split(','), username: config.voiceTurnUsername, credential: config.voiceTurnCredential });
    res.json({ iceServers });
  });

  r.get('/level/:xp', (req, res) => res.json(levelFromXp(Number(req.params.xp) || 0)));

  return r;
}
