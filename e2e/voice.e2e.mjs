// Voice chat E2E: 3 browsers with fake microphones; verifies real WebRTC audio flow and "who hears me" routing.
// Prereq: built client. Usage: node e2e/voice.e2e.mjs
import { createRequire } from 'node:module';
import { startServer, waitFor, makeChecker, sleep } from './lib.mjs';

const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch { pw = require('/opt/node-tools/node_modules/playwright'); }
const srv = startServer(3105, { FAST_TIMERS: 'false', TIMER_SCALE: '3' });
const T = makeChecker();
const errors = [];

async function player(browser, name) {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 680 }, permissions: ['microphone'] });
  await ctx.addInitScript(() => localStorage.setItem('hue.settings', JSON.stringify({ quality: 'low', music: 0, sfx: 0 })));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`[${name}] ${e.message}`));
  await page.goto(srv.base);
  await page.getByPlaceholder('e.g. SneakyBean').fill(name);
  await page.getByRole('button', { name: "Let's play!" }).click();
  await waitFor(() => page.getByRole('button', { name: /Create Room/ }).isEnabled(), 15000, 'connected');
  page.id = await page.evaluate(() => window.__hueStoreMyId());
  page.pname = name;
  return page;
}
const bytes = (page, fromId) => page.evaluate((id) => window.__hueVoice.bytesFrom(id), fromId);
/** Does `listener` receive audio from `speaker` right now? (bytes grow over ~1.5 s) */
async function receives(listener, speaker) {
  const a = await bytes(listener, speaker.id);
  await sleep(1500);
  const b = await bytes(listener, speaker.id);
  return b - a > 500;
}
async function joinVoice(page) {
  await page.getByRole('button', { name: 'Voice chat settings' }).click();
  await page.getByRole('button', { name: 'Voice chat on/off' }).click();
  await waitFor(() => page.evaluate(() => window.__hueRoom().players.find((p) => p.id === window.__hueStoreMyId()).voice.on), 5000, 'voice on');
}

async function run() {
  await srv.ready();
  const browser = await pw.chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const A = await player(browser, 'Anu'), B = await player(browser, 'Bina'), C = await player(browser, 'Chotu');
  await A.getByRole('button', { name: /Create Room/ }).click();
  const code = (await A.getByTestId('room-code').innerText()).trim();
  for (const p of [B, C]) {
    await p.getByRole('button', { name: /Join Room/ }).click();
    await p.getByPlaceholder('ABC123').fill(code);
    await p.getByRole('button', { name: 'Join', exact: true }).click();
    await p.getByTestId('room-code').waitFor();
  }
  console.log('\n[joining voice]');
  for (const p of [A, B, C]) await joinVoice(p);
  T.ok(true, 'all three joined voice chat from the panel');
  await A.getByRole('button', { name: /Mic is OFF/ }).click();
  await waitFor(() => A.evaluate(() => window.__hueStore().voice.mic), 5000, 'mic on');
  await A.screenshot({ path: 'e2e/screenshots/voice-panel.png' });
  await waitFor(async () => {
    const st = await A.evaluate(() => window.__hueStore().voice.status);
    return st[B.id] === 'connected' && st[C.id] === 'connected';
  }, 20000, 'peer connections');
  T.ok(true, 'WebRTC connections established A<->B and A<->C');

  console.log('\n[who hears me]');
  T.ok((await receives(B, A)) && (await receives(C, A)), 'Everyone: Bina and Chotu both receive Anu\'s audio');
  await A.getByRole('button', { name: /Choose/ }).click();
  await A.getByLabel('Bina hears me').check();
  await sleep(500);
  T.ok(await receives(B, A), 'Choose [Bina]: Bina receives Anu\'s audio');
  T.ok(!(await receives(C, A)), 'Choose [Bina]: Chotu receives nothing');
  await A.getByRole('button', { name: /Mic is ON/ }).click();
  await sleep(500);
  T.ok(!(await receives(B, A)), 'Mic off: nobody receives audio');
  await A.getByRole('button', { name: /Mic is OFF/ }).click();
  await A.getByRole('button', { name: '🌍 Everyone', exact: true }).click();
  await sleep(500);
  T.ok(await receives(C, A), 'Mic back on + Everyone: Chotu hears again');

  console.log('\n[listening controls]');
  await C.getByRole('button', { name: /🔈 Hear/ }).first().click();
  const mutedOk = await C.evaluate((id) => window.__hueStore().voice.muted.includes(id), A.id);
  const elMuted = await C.evaluate(() => [...document.querySelectorAll('audio')].some((a) => a.muted));
  T.ok(mutedOk && elMuted, 'Chotu muted Anu locally (Anu\'s audio element is muted)');

  console.log('\n[team-only voice during a match]');
  for (const p of [A, B, C]) await p.getByRole('button', { name: 'Close' }).click();
  for (const p of [B, C]) await p.getByTestId('ready-btn').click();
  await waitFor(() => A.getByTestId('start-btn').isEnabled(), 6000, 'start');
  await A.getByTestId('start-btn').click();
  await waitFor(() => A.evaluate(() => ['assign', 'prep'].includes(window.__hueRoom()?.phase)), 15000, 'match');
  await A.evaluate(() => window.__hueVoice.setTarget('team'));
  await sleep(700);
  const teams = await A.evaluate(() => Object.fromEntries(window.__hueRoom().players.map((p) => [p.id, p.team])));
  const mate = [B, C].find((p) => teams[p.id] === teams[A.id]);
  const other = [B, C].find((p) => teams[p.id] !== teams[A.id]);
  if (mate) T.ok(await receives(mate, A), `My team: teammate ${mate.pname} hears Anu`);
  if (other) T.ok(!(await receives(other, A)), `My team: opponent ${other.pname} receives nothing`);
  T.ok(true, `Anu is a ${teams[A.id]}; routing follows teams in-game`);
  await A.screenshot({ path: 'e2e/screenshots/voice-ingame.png' });
  await browser.close();
}

run()
  .catch((e) => { T.failures++; console.log('ERROR', e.message.split('\n').slice(0, 6).join('\n')); })
  .finally(() => {
    T.ok(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
    srv.stop();
    console.log(T.failures ? `\n${T.failures} check(s) FAILED` : '\nAll voice checks passed');
    setTimeout(() => process.exit(T.failures ? 1 : 0), 300);
  });
