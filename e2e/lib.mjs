// Shared helpers for socket-level integration tests.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { io } from 'socket.io-client';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export { sleep };

export function startServer(port, env = {}) {
  const proc = spawn('npx', ['tsx', 'src/index.ts'], {
    cwd: path.join(root, 'server'),
    env: { ...process.env, PORT: String(port), FAST_TIMERS: 'true', PGLITE_DIR: 'memory', ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });
  const s = { proc, log: '', base: `http://localhost:${port}` };
  proc.stdout.on('data', (d) => (s.log += d));
  proc.stderr.on('data', (d) => (s.log += d));
  s.stop = () => { try { process.kill(-proc.pid, 'SIGTERM'); } catch { proc.kill(); } };
  s.ready = () => waitFor(() => s.log.includes('listening'), 40000, 'server start');
  return s;
}

export async function waitFor(fn, ms = 8000, label = 'condition') {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await fn()) return true;
    await sleep(40);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

export function makeChecker() {
  const c = { failures: 0 };
  c.ok = (cond, msg) => { if (cond) console.log(`  ✔ ${msg}`); else { c.failures++; console.log(`  ✘ ${msg}`); } };
  return c;
}

export async function api(base, pathname, { method = 'GET', body, token } = {}) {
  const res = await fetch(base + '/api' + pathname, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() };
}

export async function guest(base, name) {
  const g = await api(base, '/auth/guest', { method: 'POST', body: { name } });
  return { token: g.data.token, id: g.data.profile.id, profile: g.data.profile };
}

export function client(base, name, acct) {
  const s = io(base, { auth: { token: acct.token }, transports: ['websocket'], reconnection: false });
  const c = { name, id: acct.id, s, state: null, snaps: [], paints: [], paintFull: [], events: [], corrections: [], spawn: null, abilities: null, decoys: [], statues: [] };
  s.on('room:state', (st) => (c.state = st));
  s.on('snap', (sn) => { c.snaps.push(sn); if (c.snaps.length > 30) c.snaps.shift(); });
  s.on('paint', (p) => c.paints.push(p));
  s.on('paint:full', (p) => c.paintFull.push(p));
  s.on('event', (e) => c.events.push(e));
  s.on('correct', (e) => c.corrections.push(e));
  s.on('spawn', (e) => { c.spawn = e.p; c.pos = [...e.p]; });
  s.on('abilities', (a) => (c.abilities = a));
  s.on('decoys', (d) => (c.decoys = d));
  s.on('statues', (d) => (c.statues = d));
  c.emit = (ev, data) => new Promise((res) => s.emit(ev, data ?? {}, res));
  c.ready = new Promise((res, rej) => { s.on('connect', res); s.on('connect_error', rej); });
  c.me = () => c.state?.players.find((p) => p.id === c.id);
  c.ev = (type) => c.events.filter((e) => e.type === type);
  return c;
}

/** Walk with a legal speed through waypoints (like a real client). */
export async function walk(c, waypoints, speed = 4.2) {
  let pos = [...(c.pos ?? c.spawn)];
  for (const wp of waypoints) {
    for (;;) {
      const dx = wp[0] - pos[0], dz = wp[2] - pos[2];
      const d = Math.hypot(dx, dz);
      const step = speed / 15;
      if (d <= step) { pos = [wp[0], 0, wp[2]]; c.s.emit('move', { p: pos, r: 0, f: 1, s: 0 }); await sleep(67); break; }
      pos = [pos[0] + (dx / d) * step, 0, pos[2] + (dz / d) * step];
      c.s.emit('move', { p: pos, r: Math.atan2(dx, dz), f: 3, s: 0 });
      await sleep(67);
    }
  }
  c.pos = pos;
  return pos;
}

/** Set up a room with the given clients (first is host), apply settings, ready everyone and start. */
export async function startMatch(clients, settings) {
  const [host, ...rest] = clients;
  const cr = await host.emit('room:create', { isPublic: false });
  for (const c of rest) await c.emit('room:join', { code: cr.code });
  await waitFor(() => host.state?.players.length === clients.length, 4000, 'all joined');
  const st = await host.emit('room:settings', settings);
  if (!st.ok) throw new Error('settings failed: ' + st.error);
  for (const c of rest) c.s.emit('room:ready', { ready: true });
  await waitFor(() => host.state.players.filter((p) => p.ready).length === rest.length, 4000, 'ready');
  const r = await host.emit('room:start');
  if (!r.ok) throw new Error('start failed: ' + r.error);
  await waitFor(() => clients.every((c) => c.spawn && c.state?.phase === 'assign'), 4000, 'assign');
  return cr.code;
}

export const team = (c) => c.me()?.team;
