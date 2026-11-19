// Browser E2E: two real browser clients play a full match against the real server.
// Prereq: `npm run build -w client`. Usage: node e2e/multiplayer.e2e.mjs
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch { playwright = require('/opt/node-tools/node_modules/playwright'); }
const { chromium, devices } = playwright;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.TEST_PORT || 3101;
const BASE = `http://localhost:${PORT}`;
const shots = path.join(root, 'e2e/screenshots');
fs.mkdirSync(shots, { recursive: true });

let failures = 0;
const ok = (c, m) => { if (c) console.log(`  ✔ ${m}`); else { failures++; console.log(`  ✘ ${m}`); } };
const errors = [];
const pages = [];

const server = spawn('npx', ['tsx', 'src/index.ts'], {
  cwd: path.join(root, 'server'),
  env: { ...process.env, PORT: String(PORT), FAST_TIMERS: 'true', TIMER_SCALE: '2', PGLITE_DIR: 'memory' },
  stdio: ['ignore', 'pipe', 'pipe'],
  detached: true,
});
let log = '';
server.stdout.on('data', (d) => (log += d));
server.stderr.on('data', (d) => (log += d));

async function waitFor(fn, ms = 10000, label = 'condition') {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { try { if (await fn()) return true; } catch { /* retry */ } await sleep(100); }
  throw new Error('Timed out: ' + label);
}

async function newPlayer(browser, name, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 960, height: 600 }, ...opts });
  // software WebGL in headless Chromium is slow: use the low-quality preset
  await ctx.addInitScript(() => localStorage.setItem('hue.settings', JSON.stringify({ quality: 'low', music: 0, sfx: 0 })));
  const page = await ctx.newPage();
  pages.push(page);
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${name}] ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`[${name}] ${e.message}`));
  await page.goto(BASE);
  await page.getByPlaceholder('e.g. SneakyBean').fill(name);
  await page.getByRole('button', { name: "Let's play!" }).click();
  await page.getByRole('button', { name: /Create Room/ }).waitFor();
  await waitFor(() => page.getByRole('button', { name: /Create Room/ }).isEnabled(), 10000, `${name} connected`);
  return { ctx, page, name };
}

const text = (page) => page.evaluate(() => document.body.innerText);

async function run() {
  await waitFor(() => log.includes('listening'), 40000, 'server');
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

  console.log('\n[two browser clients join the same private room]');
  const A = await newPlayer(browser, 'Alice');
  const B = await newPlayer(browser, 'Bobby');
  await A.page.screenshot({ path: `${shots}/01-menu.png` });
  await A.page.getByRole('button', { name: /Create Room/ }).click();
  const codeEl = A.page.getByTestId('room-code');
  await codeEl.waitFor();
  const code = (await codeEl.innerText()).trim();
  ok(/^[A-Z0-9]{6}$/.test(code), `Alice created room ${code}`);
  await B.page.getByRole('button', { name: /Join Room/ }).click();
  await B.page.getByPlaceholder('ABC123').fill(code);
  await B.page.getByRole('button', { name: 'Join', exact: true }).click();
  await B.page.getByTestId('room-code').waitFor();
  await waitFor(async () => (await A.page.getByTestId('player-list').innerText()).includes('Bobby'), 5000, 'A sees B');
  ok(true, 'Alice sees Bobby in the lobby player list');
  ok((await B.page.getByTestId('player-list').innerText()).includes('Alice'), 'Bobby sees Alice in the lobby player list');
  await sleep(800);
  await A.page.screenshot({ path: `${shots}/02-lobby-host.png` });

  console.log('\n[ready + start]');
  ok(await A.page.getByTestId('start-btn').isDisabled(), 'start disabled until Bobby is ready');
  await B.page.getByTestId('ready-btn').click();
  await waitFor(() => A.page.getByTestId('start-btn').isEnabled(), 5000, 'start enabled');
  ok(true, 'start enabled after Bobby readies up');
  await A.page.getByTestId('start-btn').click();
  await waitFor(async () => (await A.page.locator('canvas').count()) > 0 && (await B.page.locator('canvas').count()) > 0, 15000, 'game canvas');
  ok(true, 'both clients entered the 3D match');
  await waitFor(async () => /YOU HIDE|YOU SEEK/.test(await text(A.page)), 8000, 'team reveal');
  const aText = await text(A.page);
  const aHides = aText.includes('YOU HIDE');
  const hider = aHides ? A : B, seeker = aHides ? B : A;
  ok(true, `${hider.name} is the hider, ${seeker.name} is the seeker`);
  await sleep(1200);
  await hider.page.screenshot({ path: `${shots}/03-assign-${hider.name}.png` });

  console.log('\n[preparation: painting + hiding]');
  await waitFor(async () => (await text(hider.page)).includes('Paint yourself'), 10000, 'prep phase');
  await waitFor(async () => (await text(seeker.page)).includes('blindfolded'), 5000, 'seeker blindfold');
  ok(true, 'seeker sees the blindfold screen during preparation');
  const hiderIdForSeeker = await seeker.page.evaluate(() => window.__hueNet.visibleIds().length);
  ok(hiderIdForSeeker === 0, 'seeker client receives no hider position during prep');
  // open the paint studio and fill the whole body with wood
  await hider.page.getByRole('button', { name: /Paint yourself/ }).click();
  await hider.page.getByText('Camouflage Studio').waitFor();
  await hider.page.getByRole('button', { name: /Pattern/ }).click();
  await hider.page.getByRole('button', { name: 'Wood', exact: true }).click();
  await hider.page.getByRole('button', { name: 'Fill all', exact: true }).click();
  // brush stroke across the character (center of screen in paint camera)
  await hider.page.getByRole('button', { name: /Brush/ }).first().click();
  await hider.page.getByRole('button', { name: /Color/ }).click();
  await hider.page.getByLabel('Hex colour').fill('#1d4ed8');
  await hider.page.mouse.move(482, 262); // the (slim) torso in the paint camera
  await hider.page.mouse.down();
  for (let i = 0; i < 12; i++) { await hider.page.mouse.move(482 + i * 0.8, 262 + i * 4); await sleep(30); }
  await hider.page.mouse.up();
  // eyedropper on the floor
  await hider.page.getByRole('button', { name: /Eyedropper/ }).click();
  await hider.page.mouse.click(300, 470);
  await sleep(400);
  const sampled = (await text(hider.page)).includes('Sampled');
  ok(sampled, 'eyedropper sampled a colour from the environment');
  const ops = await hider.page.evaluate(() => window.__hueTest.paintOps(window.__hueStoreMyId()));
  ok(ops >= 3, `hider paint ops recorded locally (${ops})`);
  await hider.page.screenshot({ path: `${shots}/04-paint-studio.png` });
  await hider.page.getByRole('button', { name: /Done/ }).click();
  // walk to a hiding spot next to the kitchen opening (house map)
  await hider.page.evaluate(() => window.__hueTest.walk([[-4.6, 0, -6.0]]));
  await waitFor(() => hider.page.evaluate(() => !window.__hueTest.walking()), 45000, 'hider walk');
  const hp = await hider.page.evaluate(() => window.__hueTest.pos());
  ok(Math.hypot(hp[0] + 4.6, hp[2] + 6.0) < 0.6, `hider walked to hiding spot [${hp.map((v) => v.toFixed(1))}]`);
  await hider.page.getByLabel('Pose').click();
  await hider.page.getByRole('button', { name: /Crouch/ }).click();
  await sleep(300);
  await hider.page.screenshot({ path: `${shots}/05-hider-hidden.png` });

  console.log('\n[hunt]');
  await waitFor(async () => (await text(seeker.page)).includes('Find the hiders'), 150000, 'hunt');
  await sleep(500);
  const hiderVisible = await seeker.page.evaluate(() => window.__hueNet.visibleIds().length);
  ok(hiderVisible === 1, 'seeker now receives the hider position');
  const seekerOps = await seeker.page.evaluate(() => {
    const room = window.__hueRoom();
    const h = room.players.find((p) => p.team === 'hider');
    return window.__hueTest.paintOps(h.id);
  });
  ok(seekerOps >= 2, `hider's paint replicated to seeker at hunt start (${seekerOps} ops)`);
  const remote = await seeker.page.evaluate(() => { const room = window.__hueRoom(); const h = room.players.find((p) => p.team === 'hider'); return window.__hueNet.sampleRemote(h.id); });
  ok(remote && Math.hypot(remote.p[0] - hp[0], remote.p[2] - hp[2]) < 0.5, 'seeker renders hider at the synced position');
  await seeker.page.evaluate(() => window.__hueTest.walk([[4.5, 0, 3.3], [4, 0, 1.2], [5.8, 0, 0], [11.5, 0, 0], [11.5, 0, 1.2], [10.3, 0, 1.2], [6.1, 0, 1.2], [5, 0, 0.1], [1, 0, 0], [-0.6, 0, 0], [-3, 0, -2.6], [-3, 0, -5.6], [-3.4, 0, -6.0]]));
  await waitFor(() => seeker.page.evaluate(() => !window.__hueTest.walking()), 120000, 'seeker walk');
  await seeker.page.evaluate(([x, z]) => window.__hueTest.aimAt(x, 0.35, z), [hp[0], hp[2]]);
  await sleep(400);
  await seeker.page.screenshot({ path: `${shots}/06-seeker-aims.png` });
  await seeker.page.keyboard.press('KeyF');
  await waitFor(async () => (await text(seeker.page)).includes('You found'), 4000, 'tag success');
  ok(true, 'seeker poked the hider through the real raycast + server validation');

  console.log('\n[results]');
  await waitFor(async () => (await text(A.page)).includes('Play Again') && (await text(B.page)).includes('Return to Lobby'), 8000, 'results');
  ok((await text(A.page)).includes('Seekers win'), 'results screen shows "Seekers win!" on both clients');
  await sleep(1500);
  await seeker.page.screenshot({ path: `${shots}/07-results.png` });
  const xp = await A.page.evaluate(async () => { const t = localStorage.getItem('hue.token'); const r = await fetch('/api/me', { headers: { authorization: 'Bearer ' + t } }); return (await r.json()).profile.xp; });
  ok(xp > 0, `XP persisted to the database (${xp})`);

  await A.page.getByRole('button', { name: /Return to Lobby/ }).click();
  await A.page.getByTestId('room-code').waitFor();
  ok(true, 'host returned the room to the lobby');

  console.log('\n[mobile client]');
  const iphone = devices['iPhone 13'];
  const M = await newPlayer(browser, 'Mobi', { ...iphone });
  await M.page.screenshot({ path: `${shots}/08-mobile-menu.png` });
  await M.page.getByRole('button', { name: /Join Room/ }).click();
  await M.page.getByPlaceholder('ABC123').fill(code);
  await M.page.getByRole('button', { name: 'Join', exact: true }).click();
  await M.page.getByTestId('room-code').waitFor();
  await waitFor(async () => (await A.page.getByTestId('player-list').innerText()).includes('Mobi'), 5000, 'mobile joined');
  ok(true, 'mobile client joined the room');
  await sleep(600);
  await M.page.screenshot({ path: `${shots}/09-mobile-lobby.png` });
  await A.page.locator('button:has-text("Toy World")').click();
  await sleep(300);
  for (const p of [B, M]) { const r = p.page.getByTestId('ready-btn'); if ((await r.innerText()).includes("I'm Ready")) await r.click(); }
  await waitFor(() => A.page.getByTestId('start-btn').isEnabled(), 6000, 'start 2');
  await A.page.getByTestId('start-btn').click();
  await waitFor(async () => (await M.page.locator('canvas').count()) > 0, 15000, 'mobile game');
  await waitFor(async () => /hide & paint|blindfolded/i.test(await text(M.page)), 40000, 'mobile prep');
  await sleep(1500);
  const joystick = await M.page.getByTestId('touch-layer').getByText('MOVE').count();
  const mText = await text(M.page);
  ok(joystick > 0 || mText.includes('blindfolded'), 'mobile shows touch joystick (or blindfold as seeker)');
  await M.page.screenshot({ path: `${shots}/10-mobile-game.png` });
  await A.page.screenshot({ path: `${shots}/11-toyworld-desktop.png` });

  console.log('\n[reconnection in a running match]');
  const pageB = B.page;
  await pageB.reload();
  await waitFor(async () => (await pageB.locator('canvas').count()) > 0, 15000, 'B back in match');
  await waitFor(async () => (await text(pageB)).includes('Reconnected'), 8000, 'reconnected toast');
  ok(true, 'reloaded client rejoined the running match automatically');

  await browser.close();
}

run()
  .catch(async (e) => {
    failures++;
    console.error('ERROR:', e.message.split('\n').slice(0, 14).join('\n'));
    for (const [i, p] of pages.entries()) {
      try {
        const st = await p.evaluate(() => { const r = window.__hueRoom?.(); return r ? [r.phase, Math.round((r.phaseEndsAt - Date.now()) / 1000)] : null; });
        console.error(`  page ${i} phase:`, JSON.stringify(st));
        await p.screenshot({ path: `${shots}/fail-${i}.png` });
      } catch { /* closed */ }
    } console.error(log.split('\n').slice(-20).join('\n')); })
  .finally(() => {
    const relevant = errors.filter((e) => !/WebGL|GPU stall|Failed to load resource.*401/.test(e));
    if (relevant.length) { console.log('\nBrowser console errors:'); relevant.slice(0, 15).forEach((e) => console.log('  ' + e)); }
    ok(relevant.length === 0, 'no unexpected browser console errors');
    try { process.kill(-server.pid, 'SIGTERM'); } catch { server.kill(); }
    console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll browser E2E checks passed');
    console.log(`Screenshots: ${shots}`);
    setTimeout(() => process.exit(failures ? 1 : 0), 300);
  });
