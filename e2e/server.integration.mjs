// Full server integration test with real Socket.IO clients (no browser).
// Usage: node e2e/server.integration.mjs   (spawns its own server with FAST_TIMERS on port 3999)
// Set DATABASE_URL to run against PostgreSQL instead of the embedded PGlite.
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { io } from 'socket.io-client';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { physWalk, HOUSE } from './physwalk.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.TEST_PORT || 3999;
const BASE = `http://localhost:${PORT}`;
let failures = 0;
const ok = (cond, msg) => {
  if (cond) console.log(`  ✔ ${msg}`);
  else { failures++; console.log(`  ✘ ${msg}`); }
};

const server = spawn('npx', ['tsx', 'src/index.ts'], {
  cwd: path.join(root, 'server'),
  env: { ...process.env, PORT: String(PORT), FAST_TIMERS: 'true', PGLITE_DIR: process.env.PGLITE_DIR || 'memory' },
  stdio: ['ignore', 'pipe', 'pipe'],
  detached: true,
});
let serverLog = '';
server.stdout.on('data', (d) => (serverLog += d));
server.stderr.on('data', (d) => (serverLog += d));

async function api(pathname, { method = 'GET', body, token } = {}) {
  const res = await fetch(BASE + '/api' + pathname, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() };
}

function client(name, token) {
  const s = io(BASE, { auth: { token }, transports: ['websocket'], reconnection: false });
  const c = { name, s, state: null, snaps: [], paints: [], paintFull: [], events: [], corrections: [], spawn: null, abilities: null };
  s.on('room:state', (st) => (c.state = st));
  s.on('snap', (sn) => { c.snaps.push(sn); if (c.snaps.length > 50) c.snaps.shift(); });
  s.on('paint', (p) => c.paints.push(p));
  s.on('paint:full', (p) => c.paintFull.push(p));
  s.on('event', (e) => c.events.push(e));
  s.on('correct', (e) => c.corrections.push(e));
  s.on('spawn', (e) => (c.spawn = e.p));
  s.on('abilities', (a) => (c.abilities = a));
  c.emit = (ev, data) => new Promise((res) => s.emit(ev, data, res));
  c.ready = new Promise((res, rej) => { s.on('connect', res); s.on('connect_error', rej); });
  return c;
}

async function waitFor(fn, ms = 8000, label = 'condition') {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (fn()) return true;
    await sleep(50);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

/** Walk a client along waypoints with valid speed (like a real client would). */
async function walk(c, from, waypoints, speed = 4.2) {
  let pos = [...from];
  let seq = 0;
  for (const wp of waypoints) {
    for (;;) {
      const dx = wp[0] - pos[0], dz = wp[2] - pos[2];
      const d = Math.hypot(dx, dz);
      const step = speed / 15;
      if (d <= step) { pos = [wp[0], 0, wp[2]]; c.s.emit('move', { p: pos, r: 0, f: 1, s: seq++ }); await sleep(67); break; }
      pos = [pos[0] + (dx / d) * step, 0, pos[2] + (dz / d) * step];
      c.s.emit('move', { p: pos, r: Math.atan2(dx, dz), f: 3, s: seq++ });
      await sleep(67);
    }
  }
  return pos;
}

async function run() {
  await waitFor(() => serverLog.includes('listening'), 30000, 'server start');
  console.log('Server up.');

  console.log('\n[accounts]');
  const ga = await api('/auth/guest', { method: 'POST', body: { name: 'Alice' } });
  const gb = await api('/auth/guest', { method: 'POST', body: { name: 'Bobby' } });
  ok(ga.status === 200 && ga.data.token, 'guest account A created');
  ok(gb.status === 200 && gb.data.profile.name === 'Bobby', 'guest account B created');
  const bad = await api('/auth/guest', { method: 'POST', body: { name: 'sh1thead' } });
  ok(bad.status === 400, 'profane name rejected');
  const reg = await api('/auth/register', { method: 'POST', token: ga.data.token, body: { username: 'alice_' + Date.now() % 100000, password: 'secret123' } });
  ok(reg.status === 200 && reg.data.profile.username, 'guest upgraded to password account');
  const login = await api('/auth/login', { method: 'POST', body: { username: reg.data.profile.username, password: 'secret123' } });
  ok(login.status === 200 && login.data.profile.id === ga.data.profile.id, 'login with password works');
  const badLogin = await api('/auth/login', { method: 'POST', body: { username: reg.data.profile.username, password: 'wrong!!' } });
  ok(badLogin.status === 401, 'wrong password rejected');
  const unauth = io(BASE, { auth: { token: 'nope-nope-nope-nope-nope' }, transports: ['websocket'], reconnection: false });
  const unauthErr = await new Promise((res) => { unauth.on('connect_error', (e) => res(e.message)); unauth.on('connect', () => res('connected')); });
  ok(unauthErr === 'unauthorized', 'socket with bad token rejected');
  unauth.close();

  const A = client('A', ga.data.token);
  const B = client('B', gb.data.token);
  await Promise.all([A.ready, B.ready]);

  console.log('\n[private room]');
  const cr = await A.emit('room:create', { isPublic: false });
  ok(cr.ok && /^[A-Z0-9]{6}$/.test(cr.code), `room created with code ${cr.code}`);
  const badJoin = await B.emit('room:join', { code: 'ZZZZZZ' });
  ok(!badJoin.ok, 'joining a non-existent code fails');
  const jr = await B.emit('room:join', { code: cr.code.toLowerCase() });
  ok(jr.ok, 'B joined by code (case-insensitive)');
  await waitFor(() => A.state?.players.length === 2 && B.state?.players.length === 2, 3000, 'both see 2 players');
  ok(true, 'both clients see each other in the player list');
  ok(A.state.hostId === ga.data.profile.id, 'A is host');

  const notHost = await B.emit('room:settings', { mapId: 'school' });
  ok(!notHost.ok, 'non-host cannot change settings');
  const st = await A.emit('room:settings', { mapId: 'house', mode: 'classic', huntTime: 120 });
  ok(st.ok, 'host changed settings');
  const early = await A.emit('room:start');
  ok(!early.ok && /ready/i.test(early.error), 'cannot start before others are ready');
  B.s.emit('room:ready', { ready: true });
  await waitFor(() => A.state.players.find((p) => p.name === 'Bobby')?.ready, 2000, 'B ready');
  ok(true, 'ready state visible to host');

  const va = await A.emit('voice:state', { on: true, mic: true });
  await B.emit('voice:state', { on: true, mic: false });
  let sig = null;
  B.s.on('voice:signal', (m) => (sig = m));
  A.s.emit('voice:signal', { to: gb.data.profile.id, data: { sdp: { type: 'offer', sdp: 'v=0' } } });
  await waitFor(() => sig, 2000, 'voice signal relay');
  ok(va.ok && sig.from === ga.data.profile.id, 'voice signalling relayed between room members');
  await waitFor(() => A.state.players.every((p) => p.voice.on), 2000, 'voice presence');
  ok(A.state.players.find((p) => p.name === 'Alice').voice.mic, 'voice/mic presence visible in room state');
  await A.emit('voice:state', { on: false });
  await B.emit('voice:state', { on: false });

  console.log('\n[match: assign + prep]');
  const start = await A.emit('room:start');
  ok(start.ok, 'match started');
  await waitFor(() => A.state.phase === 'assign', 2000, 'assign phase');
  const teams = Object.fromEntries(A.state.players.map((p) => [p.name, p.team]));
  ok(Object.values(teams).sort().join() === 'hider,seeker', `teams assigned 1v1 (${JSON.stringify(teams)})`);
  const hider = teams.Alice === 'hider' ? A : B;
  const seeker = hider === A ? B : A;
  const hiderId = hider === A ? ga.data.profile.id : gb.data.profile.id;
  await waitFor(() => hider.spawn && seeker.spawn, 2000, 'spawns');
  await waitFor(() => A.state.phase === 'prep', 4000, 'prep phase');
  ok(true, 'prep phase reached');

  // paint during prep
  hider.s.emit('paint', { k: 'op', op: { t: 'f', g: 1, r: 'all', c: '#c08a52', pat: 'wood' } });
  hider.s.emit('paint', { k: 'op', op: { t: 's', g: 2, r: 'body', c: '#123456', sz: 22, pat: 'solid', pts: [100, 100, 200, 200] } });
  hider.s.emit('paint', { k: 'undo' });
  hider.s.emit('paint', { k: 'op', op: { t: 's', g: 3, r: 'nonsense', c: '#123456', sz: 22, pat: 'solid', pts: [1, 1] } });
  seeker.s.emit('paint', { k: 'op', op: { t: 'f', g: 1, r: 'all', c: '#ff0000', pat: 'solid' } });
  await sleep(400);
  ok(seeker.paints.length === 0, 'seeker receives NO paint data during prep (anti-cheat)');
  const seekerSeesHider = seeker.snaps.slice(-5).some((sn) => sn.pl.some((p) => p[0] === hiderId));
  ok(!seekerSeesHider, 'seeker snapshots exclude hider position during prep');
  const hiderSeesSeeker = hider.snaps.slice(-5).some((sn) => sn.pl.length === 1);
  ok(hiderSeesSeeker, 'hider snapshots include the seeker');

  // movement validation
  const c0 = hider.corrections.length;
  hider.s.emit('move', { p: [10, 0, 5], r: 0, f: 1, s: 1 });
  await waitFor(() => hider.corrections.length > c0, 2000, 'teleport correction');
  ok(true, 'teleport attempt corrected by server');
  const sc0 = seeker.corrections.length;
  seeker.s.emit('move', { p: [seeker.spawn[0] + 1, seeker.spawn[1], seeker.spawn[2]], r: 0, f: 1, s: 1 });
  await waitFor(() => seeker.corrections.length > sc0, 2000, 'seeker frozen');
  ok(true, 'seeker cannot move during prep');

  // hider walks to a spot next to the kitchen gap
  const hp = await physWalk(hider, 'house', [[-4.6, 0, -6.0]]);
  ok(hider.corrections.length === c0 + 1, `legit hider walk accepted (no extra corrections) -> [${hp.map((v) => v.toFixed(1))}]`);
  hider.s.emit('look', { pose: 'crouch', shape: 'short' });
  await waitFor(() => A.state.players.find((p) => p.id === hiderId)?.look.shape === 'short', 2000, 'look update');
  ok(true, 'pose/shape change synced to room');

  console.log('\n[match: hunt]');
  await waitFor(() => A.state.phase === 'hunt', 15000, 'hunt phase');
  await waitFor(() => seeker.paintFull.some((f) => f.paints[hiderId]?.length === 1), 3000, 'seeker gets hider paint at hunt start');
  ok(true, 'seeker receives hider paint (1 op after undo) at hunt start');
  await waitFor(() => seeker.snaps.slice(-3).some((sn) => sn.pl.some((p) => p[0] === hiderId)), 2000, 'hider visible in hunt');
  ok(true, 'hider now visible to seeker in snapshots');

  // seeker misses first (poke empty floor), then approaches and tags
  seeker.s.emit('tag', { p: [seeker.spawn[0] + 1, seeker.spawn[1] + 0.01, seeker.spawn[2]] });
  await waitFor(() => seeker.events.some((e) => e.type === 'miss'), 2000, 'miss event');
  ok(true, 'missed poke registered with cooldown');
  const sp = await physWalk(seeker, 'house', [...HOUSE.atticToHall, ...HOUSE.hallToLiving, [-3.4, 0, -6.0]], { speed: 6.5 });
  await sleep(1300); // wait out miss cooldown
  seeker.s.emit('tag', { p: [hp[0], 0.4, hp[2]] });
  await waitFor(() => seeker.events.some((e) => e.type === 'caught'), 3000, 'caught');
  ok(true, `seeker tagged hider from [${sp.map((v) => v.toFixed(1))}]`);

  console.log('\n[results + persistence]');
  await waitFor(() => A.state.phase === 'results' && A.state.results, 3000, 'results');
  const res = A.state.results;
  ok(res.winner === 'seekers', `winner: ${res.winnerLabel}`);
  ok(res.players.length === 2 && res.players.every((p) => p.xp > 0), 'XP computed for both players');
  await waitFor(() => A.state.results.players.some((p) => p.newAchievements), 5000, 'rewards persisted');
  const meA = await api('/me', { token: ga.data.token });
  const meB = await api('/me', { token: gb.data.token });
  ok(meA.data.profile.stats.matchesPlayed === 1 && meB.data.profile.stats.matchesPlayed === 1, 'match stats stored in DB');
  ok(meA.data.profile.xp > 0 && meB.data.profile.xp > 0, `XP stored (A=${meA.data.profile.xp}, B=${meB.data.profile.xp})`);
  const seekerProfile = seeker === A ? meA : meB;
  ok(seekerProfile.data.profile.achievements.some((a) => a.id === 'first_find'), 'seeker unlocked "Gotcha!" achievement');
  ok(seekerProfile.data.profile.stats.finds === 1, 'seeker finds = 1');

  console.log('\n[reconnection]');
  B.s.disconnect();
  await waitFor(() => A.state.players.find((p) => p.name === 'Bobby')?.connected === false, 3000, 'B marked disconnected');
  ok(true, 'B shown as disconnected (slot kept)');
  const B2 = client('B2', gb.data.token);
  let rejoined = null;
  B2.s.on('room:joined', (j) => (rejoined = j));
  await B2.ready;
  await waitFor(() => rejoined, 3000, 'rejoin');
  ok(rejoined.reconnected && rejoined.code === cr.code, 'B reconnected into the same room automatically');
  await waitFor(() => A.state.players.find((p) => p.name === 'Bobby')?.connected === true, 3000, 'B connected');

  console.log('\n[host tools]');
  const tr = await A.emit('room:transfer', { playerId: gb.data.profile.id });
  ok(tr.ok, 'host transferred ownership');
  await waitFor(() => A.state.hostId === gb.data.profile.id, 2000, 'new host');
  const lob = await B2.emit('room:lobby');
  ok(lob.ok, 'new host returned room to lobby');
  const kk = await B2.emit('room:kick', { playerId: ga.data.profile.id });
  ok(kk.ok, 'new host kicked A');
  await waitFor(() => A.events.some((e) => e.type === 'kicked'), 2000, 'kicked event');
  const rj = await A.emit('room:join', { code: cr.code });
  ok(!rj.ok, 'kicked player cannot rejoin');

  console.log('\n[matchmaking]');
  const gc = await api('/auth/guest', { method: 'POST', body: { name: 'Carla' } });
  const gd = await api('/auth/guest', { method: 'POST', body: { name: 'Dmitri' } });
  const C = client('C', gc.data.token), D = client('D', gd.data.token);
  await Promise.all([C.ready, D.ready]);
  const mc = await C.emit('mm:find');
  const md = await D.emit('mm:find');
  ok(mc.ok && md.ok && mc.code === md.code, `both matched into public room ${mc.code}`);
  C.s.emit('room:ready', { ready: true });
  D.s.emit('room:ready', { ready: true });
  await waitFor(() => C.state?.autoStartAt, 3000, 'autostart countdown');
  ok(true, 'public room auto-start countdown when all ready');
  await waitFor(() => C.state.phase === 'assign' || C.state.phase === 'prep', 5000, 'public match started');
  ok(true, 'public match started automatically');
  const pubVoice = await C.emit('voice:state', { on: true, mic: true });
  ok(!pubVoice.ok, 'voice chat is refused in public rooms');

  console.log('\n[friends]');
  const fr = await api('/friends/request', { method: 'POST', token: gc.data.token, body: { nameTag: `Dmitri#${gd.data.profile.tag}` } });
  ok(fr.status === 200 && fr.data.status === 'sent', 'friend request sent by Name#tag');
  const inc = await api('/friends', { token: gd.data.token });
  ok(inc.data.incoming.length === 1, 'incoming request listed');
  const acc = await api('/friends/respond', { method: 'POST', token: gd.data.token, body: { id: gc.data.profile.id, accept: true } });
  ok(acc.status === 200, 'friend request accepted');
  const fl = await api('/friends', { token: gc.data.token });
  ok(fl.data.friends.length === 1 && fl.data.friends[0].online === true, 'friend appears online');
  let invite = null;
  D.s.on('invite', (i) => (invite = i));
  const inv = await C.emit('friend:invite', { friendId: gd.data.profile.id });
  await sleep(300);
  ok(inv.ok && invite?.code === mc.code, 'room invite delivered to friend');
  const lb = await api('/leaderboard?scope=global', { token: gc.data.token });
  ok(lb.data.entries.length >= 2, `global leaderboard has ${lb.data.entries.length} entries`);
  const flb = await api('/leaderboard?scope=friends', { token: gc.data.token });
  ok(flb.data.entries.length === 2, 'friends leaderboard has 2 entries');

  console.log('\n[shop]');
  const buy = await api('/shop/buy', { method: 'POST', token: gc.data.token, body: { itemId: 'hat_party' } });
  ok(buy.status === 200 && buy.data.profile.owned.includes('hat_party'), 'bought Party Cone with starting coins');
  const equip = await api('/me', { method: 'PATCH', token: gc.data.token, body: { cosmetics: { hat: 'hat_party' } } });
  ok(equip.status === 200 && equip.data.profile.cosmetics.hat === 'hat_party', 'equipped purchased hat');
  const cheat = await api('/me', { method: 'PATCH', token: gc.data.token, body: { cosmetics: { hat: 'hat_crown' } } });
  ok(cheat.status === 400, 'cannot equip unowned item');

  for (const c of [A, B2, C, D]) c.s.close();
}

run()
  .catch((e) => {
    failures++;
    console.error('ERROR:', e.message);
    console.error(serverLog.split('\n').slice(-30).join('\n'));
  })
  .finally(() => {
    try { process.kill(-server.pid, 'SIGTERM'); } catch { server.kill('SIGTERM'); }
    console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll server integration checks passed');
    setTimeout(() => process.exit(failures ? 1 : 0), 300);
  });
