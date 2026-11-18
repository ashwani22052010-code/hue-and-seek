// Data access layer. All persistent game data goes through here.
import crypto from 'node:crypto';
import type { Cosmetics, FriendEntry, LeaderboardEntry, MissionProgress, PlayerStats, Profile, PublicProfile, Team } from '@shared/types';
import {
  COSMETIC_BY_ID, DEFAULT_COSMETICS, DEFAULT_OWNED, type CosmeticSlot,
} from '@shared/constants';
import {
  ACHIEVEMENT_BY_ID, dailyMissionsFor, levelFromXp, missionIncrement, utcDay, type MatchContribution,
} from '@shared/game-rules/progression';
import { getDb, type Queryable } from './db';
import { config } from '../config';
import { hashPassword, hashToken, newToken, verifyPassword } from '../security/auth';

interface PlayerRow {
  id: string; display_name: string; tag: string; username: string | null; password_hash: string | null;
  xp: number; coins: number; cosmetics: Partial<Cosmetics>; owned_items: string[];
  matches_played: number; wins: number; finds: number; escapes: number; escape_streak: number; times_caught: number;
  rounds_hider: number; rounds_seeker: number; best_survival_ms: number; decoys_fooled: number;
  created_at: string | Date;
}

const randTag = () => String(crypto.randomInt(1000, 10000));

function statsOf(r: PlayerRow): PlayerStats {
  return {
    matchesPlayed: r.matches_played, wins: r.wins, finds: r.finds, escapes: r.escapes, timesCaught: r.times_caught,
    roundsHider: r.rounds_hider, roundsSeeker: r.rounds_seeker, bestSurvivalMs: r.best_survival_ms, decoysFooled: r.decoys_fooled,
  };
}
function cosmeticsOf(r: PlayerRow): Cosmetics {
  return { ...DEFAULT_COSMETICS, ...(r.cosmetics ?? {}) };
}

async function getRow(q: Queryable, id: string): Promise<PlayerRow | null> {
  const { rows } = await q.query<PlayerRow>('SELECT * FROM players WHERE id = $1', [id]);
  return rows[0] ?? null;
}

async function issueSession(q: Queryable, playerId: string): Promise<string> {
  const token = newToken();
  const expires = new Date(Date.now() + config.sessionDays * 86400_000);
  await q.query('INSERT INTO sessions (token_hash, player_id, expires_at) VALUES ($1, $2, $3)', [hashToken(token), playerId, expires.toISOString()]);
  return token;
}

/** Insert a player with a unique (name, tag) pair. */
async function insertPlayer(q: Queryable, name: string, extra: { username?: string; passwordHash?: string } = {}): Promise<string> {
  const id = crypto.randomUUID();
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      await q.query(
        `INSERT INTO players (id, display_name, tag, username, password_hash, cosmetics, owned_items)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)`,
        [id, name, randTag(), extra.username ?? null, extra.passwordHash ?? null, JSON.stringify(DEFAULT_COSMETICS), JSON.stringify(DEFAULT_OWNED)],
      );
      return id;
    } catch (e) {
      const msg = String((e as Error).message);
      if (msg.includes('username')) throw new Error('Username already taken');
      if (!msg.includes('players_name_tag') && !msg.includes('duplicate')) throw e;
    }
  }
  throw new Error('Could not allocate a player tag, try another name');
}

export async function createGuest(name: string): Promise<{ token: string; id: string }> {
  return getDb().tx(async (q) => {
    const id = await insertPlayer(q, name);
    const token = await issueSession(q, id);
    return { token, id };
  });
}

export async function playerIdForToken(token: unknown): Promise<string | null> {
  if (typeof token !== 'string' || token.length < 20 || token.length > 200) return null;
  const { rows } = await getDb().query<{ player_id: string }>(
    'SELECT player_id FROM sessions WHERE token_hash = $1 AND expires_at > now()', [hashToken(token)],
  );
  return rows[0]?.player_id ?? null;
}

export async function revokeToken(token: string) {
  await getDb().query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)]);
}

/** Attach a username+password to an existing (guest) account. */
export async function registerAccount(playerId: string, username: string, password: string) {
  const ph = await hashPassword(password);
  try {
    const { rows } = await getDb().query<{ id: string }>(
      'UPDATE players SET username = $2, password_hash = $3 WHERE id = $1 AND username IS NULL RETURNING id', [playerId, username, ph],
    );
    if (!rows.length) throw new Error('This account already has a login');
  } catch (e) {
    if (String((e as Error).message).includes('duplicate') || String((e as Error).message).includes('unique')) throw new Error('Username already taken');
    throw e;
  }
}

export async function createAccount(name: string, username: string, password: string) {
  const ph = await hashPassword(password);
  return getDb().tx(async (q) => {
    const exists = await q.query('SELECT 1 FROM players WHERE username = $1', [username]);
    if (exists.rows.length) throw new Error('Username already taken');
    const id = await insertPlayer(q, name, { username, passwordHash: ph });
    const token = await issueSession(q, id);
    return { token, id };
  });
}

export async function login(username: string, password: string): Promise<{ token: string; id: string } | null> {
  const { rows } = await getDb().query<{ id: string; password_hash: string }>('SELECT id, password_hash FROM players WHERE username = $1', [username]);
  const row = rows[0];
  // Always run a hash to keep timing similar for unknown users.
  const ok = await verifyPassword(password, row?.password_hash ?? 'scrypt$16384$AAAAAAAAAAAAAAAAAAAAAA==$' + 'A'.repeat(86) + '==');
  if (!row || !ok) return null;
  const token = await issueSession(getDb(), row.id);
  return { token, id: row.id };
}

async function missionsFor(q: Queryable, playerId: string): Promise<MissionProgress[]> {
  const day = utcDay();
  const defs = dailyMissionsFor(playerId, day);
  const { rows } = await q.query<{ mission_id: string; progress: number; completed: boolean }>(
    'SELECT mission_id, progress, completed FROM daily_missions WHERE player_id = $1 AND day = $2', [playerId, day],
  );
  const byId = new Map(rows.map((r) => [r.mission_id, r]));
  return defs.map((d) => ({
    id: d.id, title: d.title, goal: d.goal, rewardXp: d.rewardXp, rewardCoins: d.rewardCoins,
    progress: Math.min(d.goal, byId.get(d.id)?.progress ?? 0), completed: byId.get(d.id)?.completed ?? false,
  }));
}

async function achievementsFor(q: Queryable, playerId: string) {
  const { rows } = await q.query<{ achievement_id: string; unlocked_at: string | Date }>(
    'SELECT achievement_id, unlocked_at FROM player_achievements WHERE player_id = $1 ORDER BY unlocked_at', [playerId],
  );
  return rows.map((r) => ({ id: r.achievement_id, unlockedAt: new Date(r.unlocked_at).toISOString() }));
}

export async function getProfile(playerId: string): Promise<Profile | null> {
  const db = getDb();
  const r = await getRow(db, playerId);
  if (!r) return null;
  const lv = levelFromXp(r.xp);
  return {
    id: r.id, name: r.display_name, tag: r.tag, username: r.username, xp: r.xp, level: lv.level, levelXp: lv.into, levelXpNeeded: lv.needed,
    coins: r.coins, cosmetics: cosmeticsOf(r), owned: r.owned_items ?? [], stats: statsOf(r),
    achievements: await achievementsFor(db, playerId), missions: await missionsFor(db, playerId),
  };
}

export async function getPublicProfile(playerId: string, online: boolean): Promise<PublicProfile | null> {
  const db = getDb();
  const r = await getRow(db, playerId);
  if (!r) return null;
  return {
    id: r.id, name: r.display_name, tag: r.tag, level: levelFromXp(r.xp).level, cosmetics: cosmeticsOf(r), stats: statsOf(r),
    achievements: await achievementsFor(db, playerId), online, createdAt: new Date(r.created_at).toISOString(),
  };
}

export async function touchLastSeen(playerId: string) {
  await getDb().query('UPDATE players SET last_seen = now() WHERE id = $1', [playerId]);
}

export async function renamePlayer(playerId: string, name: string) {
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      await getDb().query('UPDATE players SET display_name = $2, tag = $3 WHERE id = $1', [playerId, name, randTag()]);
      return;
    } catch (e) {
      if (!String((e as Error).message).includes('duplicate')) throw e;
    }
  }
  throw new Error('Name unavailable');
}

export async function setCosmetics(playerId: string, patch: Record<string, unknown>): Promise<Cosmetics> {
  const r = await getRow(getDb(), playerId);
  if (!r) throw new Error('Player not found');
  const owned = new Set(r.owned_items ?? []);
  const next = cosmeticsOf(r);
  const slots: (keyof Cosmetics)[] = ['color', 'hat', 'glasses', 'shoes', 'accessory', 'victory'];
  for (const slot of slots) {
    const v = patch[slot];
    if (v === undefined) continue;
    const item = typeof v === 'string' ? COSMETIC_BY_ID[v] : undefined;
    if (!item || item.slot !== (slot as CosmeticSlot) || !owned.has(item.id)) throw new Error(`You don't own that item`);
    next[slot] = item.id;
  }
  await getDb().query('UPDATE players SET cosmetics = $2::jsonb WHERE id = $1', [playerId, JSON.stringify(next)]);
  return next;
}

export async function buyItem(playerId: string, itemId: string): Promise<{ coins: number; owned: string[] }> {
  const item = COSMETIC_BY_ID[itemId];
  if (!item) throw new Error('Unknown item');
  return getDb().tx(async (q) => {
    const { rows } = await q.query<PlayerRow>('SELECT * FROM players WHERE id = $1 FOR UPDATE', [playerId]);
    const r = rows[0];
    if (!r) throw new Error('Player not found');
    const owned: string[] = r.owned_items ?? [];
    if (owned.includes(itemId)) throw new Error('Already owned');
    if (levelFromXp(r.xp).level < item.level) throw new Error(`Requires level ${item.level}`);
    if (r.coins < item.price) throw new Error('Not enough coins');
    const nextOwned = [...owned, itemId];
    await q.query('UPDATE players SET coins = coins - $2, owned_items = $3::jsonb WHERE id = $1', [playerId, item.price, JSON.stringify(nextOwned)]);
    return { coins: r.coins - item.price, owned: nextOwned };
  });
}

// ---------- Match rewards ----------
export interface AwardEntry {
  playerId: string;
  team: Team;
  score: number;
  finds: number;
  survivedMs: number;
  caught: boolean;
  won: boolean;
  xp: number;
  coins: number;
  contribution: MatchContribution;
  flags: { perfectHunter?: boolean; lastSurvivor?: boolean; escapedRounds: number; caughtRounds: number };
}
export interface AwardOutcome { playerId: string; awarded: boolean; levelUp: boolean; newAchievements: string[]; missionsCompleted: string[] }

export async function recordMatch(
  match: { id: string; roomCode: string; mapId: string; mode: string; winner: string; startedAt: number; summary: unknown },
  entries: AwardEntry[],
): Promise<AwardOutcome[]> {
  const db = getDb();
  await db.query(
    `INSERT INTO matches (id, room_code, map_id, mode, winner, started_at, summary) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [match.id, match.roomCode, match.mapId, match.mode, match.winner, new Date(match.startedAt).toISOString(), JSON.stringify(match.summary)],
  );
  const out: AwardOutcome[] = [];
  for (const e of entries) {
    try {
      out.push(await awardOne(match.id, e));
    } catch (err) {
      console.error('[db] award failed', e.playerId, err);
      out.push({ playerId: e.playerId, awarded: false, levelUp: false, newAchievements: [], missionsCompleted: [] });
    }
  }
  return out;
}

async function awardOne(matchId: string, e: AwardEntry): Promise<AwardOutcome> {
  return getDb().tx(async (q) => {
    const ins = await q.query(
      `INSERT INTO match_players (match_id, player_id, team, score, finds, survived_ms, caught, won, xp_earned, coins_earned)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING RETURNING player_id`,
      [matchId, e.playerId, e.team, e.score, e.finds, Math.round(e.survivedMs), e.caught, e.won, e.xp, e.coins],
    );
    if (!ins.rows.length) return { playerId: e.playerId, awarded: false, levelUp: false, newAchievements: [], missionsCompleted: [] };

    const before = (await q.query<PlayerRow>('SELECT * FROM players WHERE id = $1 FOR UPDATE', [e.playerId])).rows[0];
    if (!before) return { playerId: e.playerId, awarded: false, levelUp: false, newAchievements: [], missionsCompleted: [] };
    const c = e.contribution;
    let streak = before.escape_streak;
    if (e.flags.caughtRounds > 0) streak = 0;
    streak += e.flags.escapedRounds;

    // Daily missions
    const day = utcDay();
    let bonusXp = 0, bonusCoins = 0;
    const missionsCompleted: string[] = [];
    for (const m of dailyMissionsFor(e.playerId, day)) {
      const inc = missionIncrement(m.kind, c);
      if (inc <= 0) continue;
      const { rows } = await q.query<{ progress: number; completed: boolean }>(
        `INSERT INTO daily_missions (player_id, day, mission_id, progress) VALUES ($1,$2,$3,$4)
         ON CONFLICT (player_id, day, mission_id) DO UPDATE SET progress = daily_missions.progress + EXCLUDED.progress
         RETURNING progress, completed`,
        [e.playerId, day, m.id, inc],
      );
      const row = rows[0];
      if (row && !row.completed && row.progress >= m.goal) {
        await q.query('UPDATE daily_missions SET completed = true WHERE player_id = $1 AND day = $2 AND mission_id = $3', [e.playerId, day, m.id]);
        bonusXp += m.rewardXp;
        bonusCoins += m.rewardCoins;
        missionsCompleted.push(m.title);
      }
    }

    const after = (await q.query<PlayerRow>(
      `UPDATE players SET
         xp = xp + $2, coins = coins + $3, matches_played = matches_played + $4, wins = wins + $5, finds = finds + $6,
         escapes = escapes + $7, escape_streak = $8, times_caught = times_caught + $9, rounds_hider = rounds_hider + $10,
         rounds_seeker = rounds_seeker + $11, best_survival_ms = GREATEST(best_survival_ms, $12), decoys_fooled = decoys_fooled + $13,
         last_seen = now()
       WHERE id = $1 RETURNING *`,
      [e.playerId, e.xp + bonusXp, e.coins + bonusCoins, c.played, c.won, c.finds, c.escapes, streak, e.flags.caughtRounds,
        c.hiderRounds, c.seekerRounds, Math.round(e.survivedMs), c.decoys],
    )).rows[0];

    // Achievements
    const have = new Set((await q.query<{ achievement_id: string }>('SELECT achievement_id FROM player_achievements WHERE player_id = $1', [e.playerId])).rows.map((r) => r.achievement_id));
    const earned: string[] = [];
    const check = (id: string, cond: boolean) => { if (cond && !have.has(id)) earned.push(id); };
    check('first_match', after.matches_played >= 1);
    check('first_escape', after.escapes >= 1);
    check('master_camo', after.escapes >= 10);
    check('perfect_hunter', !!e.flags.perfectHunter);
    check('untouchable', after.escape_streak >= 3);
    check('last_survivor', !!e.flags.lastSurvivor);
    check('first_find', after.finds >= 1);
    check('sharp_eyes', after.finds >= 25);
    check('trickster', after.decoys_fooled >= 1);
    check('veteran', after.matches_played >= 25);
    let achCoins = 0;
    for (const id of earned) {
      await q.query('INSERT INTO player_achievements (player_id, achievement_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [e.playerId, id]);
      achCoins += ACHIEVEMENT_BY_ID[id]?.rewardCoins ?? 0;
    }
    if (achCoins) await q.query('UPDATE players SET coins = coins + $2 WHERE id = $1', [e.playerId, achCoins]);

    return {
      playerId: e.playerId,
      awarded: true,
      levelUp: levelFromXp(after.xp).level > levelFromXp(before.xp).level,
      newAchievements: earned,
      missionsCompleted,
    };
  });
}

export async function matchHistory(playerId: string, limit = 10) {
  const { rows } = await getDb().query(
    `SELECT m.id, m.map_id, m.mode, m.winner, m.ended_at, mp.team, mp.score, mp.finds, mp.survived_ms, mp.won, mp.xp_earned
     FROM match_players mp JOIN matches m ON m.id = mp.match_id WHERE mp.player_id = $1 ORDER BY m.ended_at DESC LIMIT $2`,
    [playerId, limit],
  );
  return rows;
}

// ---------- Leaderboards ----------
type LbRow = { id: string; display_name: string; tag: string; xp: number; wins: number; finds: number; escapes: number };
const toLb = (rows: LbRow[]): LeaderboardEntry[] =>
  rows.map((r, i) => ({ rank: i + 1, id: r.id, name: r.display_name, tag: r.tag, level: levelFromXp(r.xp).level, xp: r.xp, wins: r.wins, finds: r.finds, escapes: r.escapes }));

export async function globalLeaderboard(limit = 50): Promise<LeaderboardEntry[]> {
  const { rows } = await getDb().query<LbRow>(
    'SELECT id, display_name, tag, xp, wins, finds, escapes FROM players WHERE matches_played > 0 ORDER BY xp DESC, wins DESC LIMIT $1', [limit],
  );
  return toLb(rows);
}

export async function friendsLeaderboard(playerId: string): Promise<LeaderboardEntry[]> {
  const ids = [playerId, ...(await friendIds(playerId))];
  const { rows } = await getDb().query<LbRow>(
    'SELECT id, display_name, tag, xp, wins, finds, escapes FROM players WHERE id = ANY($1::text[]) ORDER BY xp DESC, wins DESC', [ids],
  );
  return toLb(rows);
}

// ---------- Friends ----------
export async function friendIds(playerId: string): Promise<string[]> {
  const { rows } = await getDb().query<{ other: string }>(
    `SELECT CASE WHEN requester = $1 THEN addressee ELSE requester END AS other
     FROM friendships WHERE status = 'accepted' AND (requester = $1 OR addressee = $1)`, [playerId],
  );
  return rows.map((r) => r.other);
}

export async function areFriends(a: string, b: string): Promise<boolean> {
  const { rows } = await getDb().query(
    `SELECT 1 FROM friendships WHERE status = 'accepted' AND ((requester = $1 AND addressee = $2) OR (requester = $2 AND addressee = $1))`, [a, b],
  );
  return rows.length > 0;
}

export async function listFriends(playerId: string, isOnline: (id: string) => boolean, inRoom: (id: string) => boolean) {
  const { rows } = await getDb().query<{ requester: string; addressee: string; status: string; id: string; display_name: string; tag: string; xp: number }>(
    `SELECT f.requester, f.addressee, f.status, p.id, p.display_name, p.tag, p.xp
     FROM friendships f JOIN players p ON p.id = CASE WHEN f.requester = $1 THEN f.addressee ELSE f.requester END
     WHERE f.requester = $1 OR f.addressee = $1`, [playerId],
  );
  const entry = (r: (typeof rows)[number]): FriendEntry => ({
    id: r.id, name: r.display_name, tag: r.tag, level: levelFromXp(r.xp).level, online: isOnline(r.id), inRoom: inRoom(r.id),
  });
  return {
    friends: rows.filter((r) => r.status === 'accepted').map(entry).sort((a, b) => Number(b.online) - Number(a.online)),
    incoming: rows.filter((r) => r.status === 'pending' && r.addressee === playerId).map(entry),
    outgoing: rows.filter((r) => r.status === 'pending' && r.requester === playerId).map(entry),
  };
}

/** Send a request by "Name#1234" or by player id. Auto-accepts if the other side already asked. */
export async function requestFriend(playerId: string, target: { nameTag?: string; id?: string }): Promise<{ status: 'sent' | 'accepted'; otherId: string }> {
  const db = getDb();
  let otherId = target.id;
  if (!otherId && target.nameTag) {
    const m = /^(.{3,16})#(\d{4})$/.exec(target.nameTag.trim());
    if (!m) throw new Error('Use the format Name#1234');
    const { rows } = await db.query<{ id: string }>('SELECT id FROM players WHERE lower(display_name) = lower($1) AND tag = $2', [m[1], m[2]]);
    otherId = rows[0]?.id;
  }
  if (!otherId) throw new Error('Player not found');
  if (otherId === playerId) throw new Error("You can't friend yourself");
  if (!(await getRow(db, otherId))) throw new Error('Player not found');
  return db.tx(async (q) => {
    const { rows } = await q.query<{ requester: string; status: string }>(
      'SELECT requester, status FROM friendships WHERE (requester = $1 AND addressee = $2) OR (requester = $2 AND addressee = $1)', [playerId, otherId],
    );
    const existing = rows[0];
    if (existing?.status === 'accepted') throw new Error('Already friends');
    if (existing && existing.requester === playerId) throw new Error('Request already sent');
    if (existing && existing.requester === otherId) {
      await q.query(`UPDATE friendships SET status = 'accepted' WHERE requester = $1 AND addressee = $2`, [otherId, playerId]);
      return { status: 'accepted' as const, otherId: otherId! };
    }
    const pending = await q.query<{ n: string }>(`SELECT count(*)::text AS n FROM friendships WHERE requester = $1 AND status = 'pending'`, [playerId]);
    if (Number(pending.rows[0]?.n ?? 0) >= 50) throw new Error('Too many pending requests');
    await q.query(`INSERT INTO friendships (requester, addressee, status) VALUES ($1, $2, 'pending')`, [playerId, otherId]);
    return { status: 'sent' as const, otherId: otherId! };
  });
}

export async function respondFriend(playerId: string, otherId: string, accept: boolean) {
  const db = getDb();
  if (accept) {
    const { rows } = await db.query(`UPDATE friendships SET status = 'accepted' WHERE requester = $1 AND addressee = $2 AND status = 'pending' RETURNING 1`, [otherId, playerId]);
    if (!rows.length) throw new Error('No pending request');
  } else {
    await db.query(`DELETE FROM friendships WHERE requester = $1 AND addressee = $2 AND status = 'pending'`, [otherId, playerId]);
  }
}

export async function removeFriend(playerId: string, otherId: string) {
  await getDb().query('DELETE FROM friendships WHERE (requester = $1 AND addressee = $2) OR (requester = $2 AND addressee = $1)', [playerId, otherId]);
}

export async function recentPlayers(playerId: string) {
  const { rows } = await getDb().query<{ id: string; display_name: string; tag: string; xp: number; last_played: string | Date }>(
    `SELECT p.id, p.display_name, p.tag, p.xp, max(m.ended_at) AS last_played
     FROM match_players me
     JOIN match_players other ON other.match_id = me.match_id AND other.player_id <> me.player_id
     JOIN matches m ON m.id = me.match_id
     JOIN players p ON p.id = other.player_id
     WHERE me.player_id = $1
     GROUP BY p.id, p.display_name, p.tag, p.xp
     ORDER BY last_played DESC LIMIT 20`, [playerId],
  );
  return rows.map((r) => ({ id: r.id, name: r.display_name, tag: r.tag, level: levelFromXp(r.xp).level, lastPlayed: new Date(r.last_played).toISOString() }));
}

/** Lightweight identity used when joining rooms. */
export async function getIdentity(playerId: string) {
  const r = await getRow(getDb(), playerId);
  if (!r) return null;
  return { id: r.id, name: r.display_name, tag: r.tag, level: levelFromXp(r.xp).level, cosmetics: cosmeticsOf(r) };
}
