// Visual gallery: screenshots of every screen and every map (desktop + mobile) for manual review.
// Usage: node e2e/gallery.mjs  (needs a built client)
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch { pw = require('/opt/node-tools/node_modules/playwright'); }
const { chromium, devices } = pw;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 3103, BASE = `http://localhost:${PORT}`;
const out = path.join(root, 'e2e/screenshots/gallery');
fs.mkdirSync(out, { recursive: true });
const server = spawn('npx', ['tsx', 'src/index.ts'], { cwd: path.join(root, 'server'), env: { ...process.env, PORT: String(PORT), TIMER_SCALE: '4', PGLITE_DIR: 'memory' }, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
let log = ''; server.stdout.on('data', (d) => (log += d)); server.stderr.on('data', (d) => (log += d));
const errors = [];
async function waitFor(fn, ms = 20000) { const t = Date.now(); while (Date.now() - t < ms) { try { if (await fn()) return; } catch {} await sleep(150); } throw new Error('timeout'); }
async function player(browser, name, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, ...opts });
  await ctx.addInitScript(() => localStorage.setItem('hue.settings', JSON.stringify({ quality: 'low', music: 0, sfx: 0 })));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`[${name}] ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${name}] ${m.text()}`); });
  await page.goto(BASE);
  await page.getByPlaceholder('e.g. SneakyBean').fill(name);
  await page.getByRole('button', { name: "Let's play!" }).click();
  await page.getByRole('button', { name: /Create Room/ }).waitFor();
  await waitFor(() => page.getByRole('button', { name: /Create Room/ }).isEnabled());
  return page;
}
const OVERVIEW = {
  house: { pos: [0, 24, 20], target: [0, 0, 0] },
  supermarket: { pos: [0, 28, 24], target: [0, 0, 0] },
  school: { pos: [0, 30, 26], target: [0, 0, 0] },
  toyworld: { pos: [0, 28, 26], target: [0, 0, 0] },
  factory: { pos: [0, 30, 26], target: [0, 0, 0] },
};
try {
  await waitFor(() => log.includes('listening'), 40000);
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const A = await player(browser, 'Painter');
  for (const [btn, file] of [[/Customize/, 'customize'], [/Shop/, 'shop'], [/Leaderboard/, 'leaderboard'], [/Friends/, 'friends'], [/Settings/, 'settings']]) {
    await A.getByRole('button', { name: btn }).first().click();
    await sleep(1200);
    await A.screenshot({ path: `${out}/screen-${file}.png` });
    await A.getByRole('button', { name: /Back/ }).click();
  }
  await A.getByRole('button', { name: /Painter/ }).click();
  await sleep(1000);
  await A.screenshot({ path: `${out}/screen-profile.png` });
  await A.getByRole('button', { name: /Back/ }).click();
  await A.screenshot({ path: `${out}/screen-menu.png` });

  const B = await player(browser, 'Seeky');
  await A.getByRole('button', { name: /Create Room/ }).click();
  const code = (await A.getByTestId('room-code').innerText()).trim();
  const joinB = async () => {
    await B.getByRole('button', { name: /Join Room/ }).click();
    await B.getByPlaceholder('ABC123').fill(code);
    await B.getByRole('button', { name: 'Join', exact: true }).click();
    await B.getByTestId('room-code').waitFor();
  };
  await joinB();
  for (const [mapName, id] of [['Cozy House', 'house'], ['MegaMart', 'supermarket'], ['Sunnyvale School', 'school'], ['Toy World', 'toyworld'], ['Rust Factory', 'factory']]) {
    await A.locator(`button:has-text("${mapName}")`).click();
    await sleep(400);
    const rb = B.getByTestId('ready-btn');
    if ((await rb.innerText()).includes("I'm Ready")) await rb.click();
    await waitFor(() => A.getByTestId('start-btn').isEnabled());
    await A.getByTestId('start-btn').click();
    await waitFor(async () => (await A.evaluate(() => window.__hueRoom()?.phase)) === 'prep', 40000);
    const hider = (await A.evaluate(() => { const r = window.__hueRoom(); return r.players.find((p) => p.id === window.__hueStoreMyId()).team; })) === 'hider' ? A : B;
    await sleep(1500);
    await hider.screenshot({ path: `${out}/map-${id}-player.png` });
    await hider.evaluate((o) => window.__hueTest.camOverride(o), OVERVIEW[id]);
    await sleep(1500);
    await hider.screenshot({ path: `${out}/map-${id}-overview.png` });
    await hider.evaluate(() => window.__hueTest.camOverride(null));
    // the guest leaves mid-match -> the round ends; host returns to the lobby; guest rejoins
    await B.evaluate(() => document.querySelector('[aria-label="Pause"]').click());
    await B.getByRole('button', { name: 'Leave Match' }).click();
    await B.getByRole('button', { name: /Join Room/ }).waitFor();
    await waitFor(async () => (await A.evaluate(() => window.__hueRoom()?.phase)) === 'results', 20000);
    await A.getByRole('button', { name: /Return to Lobby/ }).click();
    await A.getByTestId('room-code').waitFor();
    await joinB();
    console.log('captured', id);
  }
  const M = await player(browser, 'Phone', { ...devices['iPhone 13'] });
  await M.screenshot({ path: `${out}/mobile-menu.png` });
  await M.getByRole('button', { name: /Join Room/ }).click();
  await M.getByPlaceholder('ABC123').fill(code);
  await M.getByRole('button', { name: 'Join', exact: true }).click();
  await M.getByTestId('room-code').waitFor();
  await sleep(1200);
  await M.screenshot({ path: `${out}/mobile-lobby.png` });
  for (const p of [B, M]) { const r = p.getByTestId('ready-btn'); if ((await r.innerText()).includes("I'm Ready")) await r.click(); }
  await waitFor(() => A.getByTestId('start-btn').isEnabled());
  await A.getByTestId('start-btn').click();
  await waitFor(async () => (await M.evaluate(() => window.__hueRoom()?.phase)) === 'prep', 40000);
  await sleep(1500);
  await M.screenshot({ path: `${out}/mobile-prep.png` });
  const mTeam = await M.evaluate(() => window.__hueRoom().players.find((p) => p.id === window.__hueStoreMyId()).team);
  if (mTeam === 'hider') {
    await M.getByRole('button', { name: /Paint yourself/ }).click();
    await sleep(1000);
    await M.screenshot({ path: `${out}/mobile-paint.png` });
  }
  await browser.close();
  console.log(errors.length ? 'Console errors:\n' + errors.slice(0, 10).join('\n') : 'No console errors');
} catch (e) {
  console.error('ERROR', e.message.split('\n').slice(0, 6).join('\n'));
} finally {
  try { process.kill(-server.pid, 'SIGTERM'); } catch {}
  setTimeout(() => process.exit(0), 300);
}
