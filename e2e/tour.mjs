// Visual tour: interior camera viewpoints of maps + character close-ups (for manual review).
// Usage: node e2e/tour.mjs [mapId ...]   (needs a built client)
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { startServer, waitFor, sleep, root } from './lib.mjs';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch { pw = require('/opt/node-tools/node_modules/playwright'); }
const out = path.join(root, 'e2e/screenshots/tour');
fs.mkdirSync(out, { recursive: true });
const VIEWS = {
  house: [[[-1, 2.3, -1], [-8, 0.6, -6]], [[1.5, 2.3, -1.5], [8, 0.6, -6]], [[-1.5, 2.3, 2], [-8, 0.5, 7]], [[7, 2.3, 2.6], [11, 0.4, 7.5]], [[0.8, 2.3, 2.6], [4, 0.4, 8]], [[1, 1.8, 0.3], [10, 2.5, 1.2]], [[1, 5.4, -1.2], [8, 3.4, -7]], [[1, 5.4, 3], [8, 3.4, 8]]],
  supermarket: [[[-16, 2.6, 12], [0, 0.5, -6]], [[15, 2.6, -5], [10, 0.4, -12]]],
  school: [[[-7, 2.4, 3], [-16, 0.4, 12]], [[-5, 2.4, -3], [-14, 0.4, -12]]],
  toyworld: [[[0, 3.6, 12], [0, 0.5, -8]], [[-14, 3.5, -2], [8, 0.5, 4]]],
  factory: [[[8, 3.5, 12], [-10, 0.5, -8]], [[18, 2.5, 13], [12, 0.5, 6]]],
  office: [[[-5, 2.4, 9], [3, 0.4, -2]], [[6.5, 2.4, -4.5], [12, 0.4, -9]], [[-6.5, 2.4, -3.5], [-12, 0.4, -9]], [[7, 2.4, 5], [13, 0.4, 10]]],
  restaurant: [[[13, 2.6, 9], [0, 0.4, 2]], [[-3.5, 2.6, -2.5], [-12, 0.4, -9]], [[6, 2.5, 0], [5, 0.8, -9]], [[-8.5, 2.4, 4.5], [-13, 0.6, 10]]],
};
const maps = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(VIEWS);
const srv = startServer(3106, { FAST_TIMERS: 'false', TIMER_SCALE: '6' });
const errors = [];
try {
  await srv.ready();
  const browser = await pw.chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const mk = async (name, quality = 'medium') => {
    const ctx = await browser.newContext({ viewport: { width: 1100, height: 650 } });
    await ctx.addInitScript((q) => localStorage.setItem('hue.settings', JSON.stringify({ quality: q, music: 0, sfx: 0 })), quality);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`[${name}] ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${name}] ${m.text()}`); });
    await page.goto(srv.base);
    await page.getByPlaceholder('e.g. SneakyBean').fill(name);
    await page.getByRole('button', { name: "Let's play!" }).click();
    await waitFor(() => page.getByRole('button', { name: /Create Room/ }).isEnabled(), 15000, 'conn');
    return page;
  };
  const A = await mk('Tourist', process.env.Q || 'medium'), B = await mk('Buddy', 'low');
  await A.getByRole('button', { name: /Create Room/ }).click();
  const code = (await A.getByTestId('room-code').innerText()).trim();
  await A.screenshot({ path: `${out}/lobby.png` });
  await A.locator('button:has-text("Everyone Hides")').click(); // nobody is blindfolded -> the tourist can always look around
  const join = async () => { await B.getByRole('button', { name: /Join Room/ }).click(); await B.getByPlaceholder('ABC123').fill(code); await B.getByRole('button', { name: 'Join', exact: true }).click(); await B.getByTestId('room-code').waitFor(); };
  await join();
  for (const id of maps) {
    const names = { house: 'Cozy House', supermarket: 'MegaMart', school: 'Sunnyvale School', toyworld: 'Toy World', factory: 'Rust Factory', office: 'Skyline Office', restaurant: 'Bella Bistro' };
    await A.locator(`button:has-text("${names[id]}")`).click();
    await sleep(400);
    const rb = B.getByTestId('ready-btn');
    if ((await rb.innerText()).includes("I'm Ready")) await rb.click();
    await waitFor(() => A.getByTestId('start-btn').isEnabled(), 8000, 'start');
    await A.getByTestId('start-btn').click();
    await waitFor(async () => (await A.evaluate(() => window.__hueRoom()?.phase)) === 'prep', 60000, 'prep');
    await sleep(2500);
    await A.screenshot({ path: `${out}/${id}-player.png` });
    let i = 0;
    for (const [pos, target] of VIEWS[id] ?? []) {
      await A.evaluate((o) => window.__hueTest.camOverride(o), { pos, target });
      await sleep(1600);
      await A.screenshot({ path: `${out}/${id}-${i++}.png` });
    }
    await A.evaluate(() => window.__hueTest.camOverride(null));
    await B.evaluate(() => document.querySelector('[aria-label="Pause"]').click());
    await B.getByRole('button', { name: 'Leave Match' }).click();
    await waitFor(async () => (await A.evaluate(() => window.__hueRoom()?.phase)) === 'results', 20000, 'results');
    await A.getByRole('button', { name: /Return to Lobby/ }).click();
    await A.getByTestId('room-code').waitFor();
    await join();
    console.log('toured', id);
  }
  await browser.close();
} catch (e) {
  console.log('ERROR', e.message.split('\n').slice(0, 5).join('\n'));
} finally {
  console.log(errors.length ? 'Console errors:\n' + [...new Set(errors)].slice(0, 12).join('\n') : 'No console errors');
  srv.stop();
  setTimeout(() => process.exit(0), 300);
}
