// Browser E2E: Object Transformation with two real browsers + mobile touch controls on an emulated phone.
// Prereq: built client. Usage: npx tsx e2e/props.e2e.mjs
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { startServer, waitFor, makeChecker, sleep, root } from './lib.mjs';
import { mapFor, physWalk } from './physwalk.mjs';

const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch { pw = require('/opt/node-tools/node_modules/playwright'); }
const shots = path.join(root, 'e2e/screenshots/props');
fs.mkdirSync(shots, { recursive: true });
const srv = startServer(3107, { FAST_TIMERS: 'false', TIMER_SCALE: '3' });
const T = makeChecker();
const errors = [];
const house = mapFor('house');
const nearestItem = (t, x, z) => house.items.map((it, i) => ({ it, i })).filter(({ it }) => it.t === t).sort((a, b) => Math.hypot(a.it.p[0] - x, a.it.p[2] - z) - Math.hypot(b.it.p[0] - x, b.it.p[2] - z))[0].it;

async function player(browser, name, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 960, height: 600 }, ...opts });
  await ctx.addInitScript(() => localStorage.setItem('hue.settings', JSON.stringify({ quality: 'low', music: 0, sfx: 0 })));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`[${name}] ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${name}] ${m.text()}`); });
  await page.goto(srv.base);
  await page.getByPlaceholder('e.g. SneakyBean').fill(name);
  await page.getByRole('button', { name: "Let's play!" }).click();
  await waitFor(() => page.getByRole('button', { name: /Create Room/ }).isEnabled(), 20000, `${name} connected`);
  page.pname = name;
  return page;
}
const me = (page) => page.evaluate(() => window.__hueRoom().players.find((p) => p.id === window.__hueStoreMyId()));
const phase = (page) => page.evaluate(() => window.__hueRoom()?.phase);
const walkTo = async (page, pts, ms = 90000) => {
  await page.evaluate((p) => window.__hueTest.walk(p), pts);
  await waitFor(() => page.evaluate(() => !window.__hueTest.walking()), ms, `${page.pname} walk`);
};
const aim = async (page, it, dy = 0.5) => {
  await page.mouse.move(480, 300); // mouse cursor at screen centre = the targeting ray
  const h = { jug: 0.3, chair: 0.95 }[it.t] ?? 0.4;
  await page.evaluate(([x, y, z]) => window.__hueTest.aimAt(x, y, z), [it.p[0], it.p[1] + h * dy, it.p[2]]);
};

async function desktop(browser) {
  console.log('\n[TEST 1-2] two players, same private room, Object Transformation selected');
  const A = await player(browser, 'Morph'), B = await player(browser, 'Watcher');
  await A.getByRole('button', { name: /Create Room/ }).click();
  const code = (await A.getByTestId('room-code').innerText()).trim();
  await B.getByRole('button', { name: /Join Room/ }).click();
  await B.getByPlaceholder('ABC123').fill(code);
  await B.getByRole('button', { name: 'Join', exact: true }).click();
  await B.getByTestId('room-code').waitFor();
  await A.locator('[data-testid="hide-styles"] button:has-text("Object Transformation")').click();
  await waitFor(async () => (await B.evaluate(() => window.__hueRoom().settings.hideStyle)) === 'props', 5000, 'style synced');
  T.ok(true, 'host picked Object Transformation and the other player sees it');
  await sleep(800);
  await B.screenshot({ path: `${shots}/1-lobby-style.png` });
  await B.getByTestId('ready-btn').click();
  await waitFor(() => A.getByTestId('start-btn').isEnabled(), 6000, 'start');
  await A.getByTestId('start-btn').click();
  await waitFor(async () => (await phase(A)) === 'prep', 60000, 'prep');
  const hider = (await me(A)).team === 'hider' ? A : B;
  const seeker = hider === A ? B : A;
  T.ok(true, `${hider.pname} hides, ${seeker.pname} seeks`);

  console.log('\n[TEST 3-4] aim at a jug, TRANSFORM, move as the jug');
  await walkTo(hider, [[-3, 0, -6.4], [-3, 0, -2.6], [-0.6, 0, 0], [1, 0, 0], [3.2, 0, 0.1], [3.2, 0, -2], [4.6, 0, -3.5]]);
  const jug = nearestItem('jug', 5.3, -5.1);
  await aim(hider, jug);
  await waitFor(async () => (await hider.getByTestId('target-name').textContent().catch(() => ''))?.includes('Water Jug'), 8000, 'jug targeted');
  T.ok(true, 'aiming with the mouse highlights the Water Jug (preview shown)');
  await sleep(600);
  await hider.screenshot({ path: `${shots}/2-target-jug.png` });
  await hider.getByTestId('transform-btn').click();
  await waitFor(async () => (await me(hider)).disguise === 'jug', 5000, 'became jug');
  T.ok(true, 'pressed TRANSFORM: the player is now a jug');
  await sleep(700);
  await hider.screenshot({ path: `${shots}/3-is-jug.png` });
  const p0 = await hider.evaluate(() => window.__hueTest.pos());
  await walkTo(hider, [[6.2, 0, -3.0]], 30000);
  const p1 = await hider.evaluate(() => window.__hueTest.pos());
  T.ok(Math.hypot(p1[0] - p0[0], p1[2] - p0[2]) > 0.5, 'the jug moves with the controls');

  console.log('\n[TEST 6-7] jug -> chair -> normal character');
  await sleep(1400);
  const chair = nearestItem('chair', 8.8, -3.6);
  await aim(hider, chair, 0.5);
  await waitFor(async () => (await hider.getByTestId('target-name').textContent().catch(() => ''))?.includes('Chair'), 8000, 'chair targeted');
  await waitFor(() => hider.getByTestId('transform-btn').isEnabled(), 5000, 'cooldown');
  await hider.getByTestId('transform-btn').click();
  await waitFor(async () => (await me(hider)).disguise === 'chair', 5000, 'became chair');
  T.ok(true, 'transformed from the jug straight into a chair');
  await sleep(600);
  await hider.screenshot({ path: `${shots}/4-is-chair.png` });
  await waitFor(() => hider.getByTestId('revert-btn').isEnabled(), 5000, 'revert ready');
  await hider.getByTestId('revert-btn').click();
  await waitFor(async () => (await me(hider)).disguise === null, 5000, 'reverted');
  T.ok(true, 'changed back into the normal character');
  await sleep(1400);
  await aim(hider, jug);
  await waitFor(async () => (await hider.getByTestId('target-name').textContent().catch(() => ''))?.includes('Water Jug'), 8000, 'jug again');
  await waitFor(() => hider.getByTestId('transform-btn').isEnabled(), 5000, 'cooldown 2');
  await hider.keyboard.press('KeyR'); // keyboard shortcut
  await waitFor(async () => (await me(hider)).disguise === 'jug', 5000, 'jug via R');
  T.ok(true, 'R key transforms too (back into the jug)');

  console.log('\n[TEST 10] camera never goes under the floor; walls stop the jug');
  await hider.evaluate(() => window.__hueTest.aimAt(10, 4, -3)); // look steeply up
  await sleep(500);
  const camLow = await hider.evaluate(() => [window.__hueTest.cam().y, window.__hueTest.pos()[1]]);
  T.ok(camLow[0] >= camLow[1] + 0.2, `camera stays above the floor when looking up (cam y ${camLow[0].toFixed(2)})`);
  await walkTo(hider, [[6.0, 0, -3.0], [-2.5, 0, -3.0]], 12000).catch(() => {}); // try to walk through the kitchen/living wall (x = 0)
  const pw2 = await hider.evaluate(() => window.__hueTest.pos());
  T.ok(pw2[0] > 0.05 && pw2[0] < 1.0, `the jug is stopped by the wall (x ${pw2[0].toFixed(2)})`);
  await hider.evaluate(() => window.__hueTest.walk([]));

  console.log('\n[TEST 5] the other player sees the same jug moving in real time');
  await waitFor(async () => (await phase(seeker)) === 'hunt', 200000, 'hunt');
  const hid = await hider.evaluate(() => window.__hueStoreMyId());
  await waitFor(async () => (await seeker.evaluate((id) => window.__hueRoom().players.find((p) => p.id === id).disguise, hid)) === 'jug', 5000, 'seeker sees jug');
  T.ok(true, 'seeker sees the hider as a jug');
  const s0 = await seeker.evaluate((id) => window.__hueNet.sampleRemote(id)?.p, hid);
  await walkTo(hider, [[2.0, 0, -3.0]], 30000);
  await sleep(600);
  const s1 = await seeker.evaluate((id) => window.__hueNet.sampleRemote(id)?.p, hid);
  const h1 = await hider.evaluate(() => window.__hueTest.pos());
  T.ok(s0 && s1 && Math.hypot(s1[0] - s0[0], s1[2] - s0[2]) > 1 && Math.hypot(s1[0] - h1[0], s1[2] - h1[2]) < 0.6, 'seeker sees the jug move to the same position');
  await seeker.evaluate(([x, z]) => window.__hueTest.camOverride({ pos: [x + 2.2, 1.6, z + 2.2], target: [x, 0.2, z] }), [h1[0], h1[2]]);
  await sleep(1200);
  await seeker.screenshot({ path: `${shots}/5-seeker-sees-jug.png` });
  await seeker.evaluate(() => window.__hueTest.camOverride(null));
  await A.context().close();
  await B.context().close();
}

/** dispatch a synthetic touch pointer event on the touch layer */
const touch = (page, type, id, x, y) => page.evaluate(([type, id, x, y]) => {
  const el = document.querySelector('[data-testid="touch-layer"]');
  el.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, isPrimary: id === 1 }));
}, [type, id, x, y]);

async function mobile(browser) {
  console.log('\n[TEST 9] mobile joystick + camera (emulated iPhone)');
  const phone = await player(browser, 'Phone', { ...pw.devices['iPhone 13'] });
  const desk = await player(browser, 'Desk');
  await phone.getByRole('button', { name: /Create Room/ }).click();
  const code = (await phone.getByTestId('room-code').innerText()).trim();
  await phone.locator('button:has-text("Everyone Hides")').click();
  await phone.locator('[data-testid="hide-styles"] button:has-text("Hybrid Chaos")').click();
  await desk.getByRole('button', { name: /Join Room/ }).click();
  await desk.getByPlaceholder('ABC123').fill(code);
  await desk.getByRole('button', { name: 'Join', exact: true }).click();
  await desk.getByTestId('ready-btn').click();
  await waitFor(() => phone.getByTestId('start-btn').isEnabled(), 6000, 'start');
  await phone.getByTestId('start-btn').click();
  await waitFor(async () => (await phase(phone)) === 'prep', 60000, 'prep');
  await sleep(1500);
  const W = 390, H = 664;
  const yaw0 = await phone.evaluate(() => window.__hueTest.cam().yaw);
  const fwd = [-Math.sin(yaw0), -Math.cos(yaw0)], right = [Math.cos(yaw0), -Math.sin(yaw0)];
  const drive = async (dx, dy, ms) => {
    const a = await phone.evaluate(() => window.__hueTest.pos());
    await touch(phone, 'pointerdown', 1, 90, H - 150);
    for (let t = 0; t < ms; t += 100) { await touch(phone, 'pointermove', 1, 90 + dx, H - 150 + dy); await sleep(100); }
    await touch(phone, 'pointerup', 1, 90 + dx, H - 150 + dy);
    await sleep(300);
    const b = await phone.evaluate(() => window.__hueTest.pos());
    const v = [b[0] - a[0], b[2] - a[2]];
    const len = Math.hypot(...v) || 1;
    return { len, f: (v[0] * fwd[0] + v[1] * fwd[1]) / len, r: (v[0] * right[0] + v[1] * right[1]) / len };
  };
  const up = await drive(0, -55, 1200);
  T.ok(up.len > 0.5 && up.f > 0.85, `joystick UP moves forward relative to the camera (dot ${up.f.toFixed(2)})`);
  const lf = await drive(-55, 0, 1000);
  T.ok(lf.len > 0.4 && lf.r < -0.85, `joystick LEFT moves left (dot ${lf.r.toFixed(2)})`);
  const rt = await drive(55, 0, 1000);
  T.ok(rt.len > 0.4 && rt.r > 0.85, `joystick RIGHT moves right (dot ${rt.r.toFixed(2)})`);
  const back = await drive(0, 55, 1000);
  T.ok(back.len > 0.4 && back.f < -0.85, `joystick DOWN moves backward (dot ${back.f.toFixed(2)})`);
  // right-side drag rotates the camera only
  const before = await phone.evaluate(() => window.__hueTest.pos());
  await touch(phone, 'pointerdown', 2, W - 90, 330);
  for (let i = 1; i <= 6; i++) { await touch(phone, 'pointermove', 2, W - 90 + i * 12, 330); await sleep(40); }
  await touch(phone, 'pointerup', 2, W - 18, 330);
  await sleep(300);
  const after = await phone.evaluate(() => window.__hueTest.pos());
  const yaw1 = await phone.evaluate(() => window.__hueTest.cam().yaw);
  T.ok(Math.abs(yaw1 - yaw0) > 0.1 && Math.hypot(after[0] - before[0], after[2] - before[2]) < 0.05, 'right-side drag turns the camera and does NOT move the character');
  // multi-touch: hold the stick while turning the camera
  const m0 = await phone.evaluate(() => window.__hueTest.pos());
  await touch(phone, 'pointerdown', 3, 90, H - 150);
  await touch(phone, 'pointerdown', 4, W - 90, 330);
  for (let i = 1; i <= 8; i++) { await touch(phone, 'pointermove', 3, 90, H - 205); await touch(phone, 'pointermove', 4, W - 90 - i * 6, 330); await sleep(100); }
  await touch(phone, 'pointerup', 3, 90, H - 205);
  await touch(phone, 'pointerup', 4, W - 140, 330);
  await sleep(300);
  const m1 = await phone.evaluate(() => window.__hueTest.pos());
  const yaw2 = await phone.evaluate(() => window.__hueTest.cam().yaw);
  T.ok(Math.hypot(m1[0] - m0[0], m1[2] - m0[2]) > 0.3 && Math.abs(yaw2 - yaw1) > 0.05, 'multi-touch: moving and turning at the same time');
  await phone.screenshot({ path: `${shots}/6-phone.png` });

  console.log('\n[mobile transform] tap an object to select it, then TRANSFORM');
  const myPos = await phone.evaluate(() => window.__hueTest.pos());
  // nearest free-standing floor object that is reachable in a straight line (checked with the shared physics)
  const cands = house.items.filter((it) => ['ball', 'teddy', 'duck', 'toycar', 'basket', 'flowerpot', 'trashbin', 'bucket', 'backpack', 'plant', 'cardbox'].includes(it.t) && Math.abs(it.p[1] - myPos[1]) < 0.05)
    .sort((a, b) => Math.hypot(a.p[0] - myPos[0], a.p[2] - myPos[2]) - Math.hypot(b.p[0] - myPos[0], b.p[2] - myPos[2]));
  let near = null;
  for (const it of cands) {
    try { await physWalk({ name: 'probe', spawn: myPos, s: { emit() {} } }, 'house', [[it.p[0] + 1.4, 0, it.p[2]]], { dry: true }); near = it; break; } catch { /* blocked */ }
  }
  if (!near) throw new Error('no reachable floor object near the phone player');
  console.log(`  (walking to a ${near.t} at ${near.p.map((v) => v.toFixed(1))})`);
  await phone.evaluate(([x, z]) => window.__hueTest.walk([[x + 1.4, 0, z]]), [near.p[0], near.p[2]]);
  await waitFor(() => phone.evaluate(() => !window.__hueTest.walking()), 40000, 'phone walk');
  await phone.evaluate(([x, y, z]) => window.__hueTest.aimAt(x, y, z), [near.p[0], near.p[1] + 0.1, near.p[2]]);
  await sleep(400);
  await phone.evaluate(([x, y]) => { // a quick tap (down + up in the same task, like a real finger tap)
    const el = document.querySelector('[data-testid="touch-layer"]');
    for (const type of ['pointerdown', 'pointerup']) el.dispatchEvent(new PointerEvent(type, { pointerId: 5, pointerType: 'touch', clientX: x, clientY: y, bubbles: true }));
  }, [W / 2, H / 2]);
  await sleep(500);
  if (!(await phone.evaluate(() => window.__hueStore().propLocked))) {
    await phone.screenshot({ path: `${shots}/7-phone-tap-debug.png` });
    console.log('  debug target:', await phone.evaluate(() => JSON.stringify(window.__hueStore().propTarget)), await phone.evaluate(() => JSON.stringify([window.__hueTest.pos(), window.__hueTest.cam()])));
  }
  await waitFor(async () => (await phone.evaluate(() => window.__hueStore().propLocked)), 6000, 'tap selected');
  const tname = await phone.getByTestId('target-name').textContent();
  T.ok(!!tname, `tap selected an object on the phone (${tname?.trim()})`);
  T.ok(await phone.getByTestId('paint-btn-compact').isVisible(), 'Hybrid on phone: Paint button sits inside the panel (no overlap)');
  await phone.screenshot({ path: `${shots}/7-phone-target.png` });
  await waitFor(() => phone.getByTestId('transform-btn').isEnabled(), 5000, 'phone transform enabled');
  await phone.getByTestId('transform-btn').tap();
  await waitFor(async () => !!(await me(phone)).disguise, 5000, 'phone transformed');
  T.ok(true, `phone player transformed into a ${(await me(phone)).disguise}`);
  await sleep(700);
  await phone.screenshot({ path: `${shots}/8-phone-transformed.png` });
}

async function main() {
  await srv.ready();
  const browser = await pw.chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const fn of [desktop, mobile]) {
    try { await fn(browser); } catch (e) { T.failures++; console.log(`  ✘ ${fn.name}: ${e.message.split('\n')[0]}`); }
  }
  await browser.close();
}
main().finally(() => {
  const relevant = [...new Set(errors)].filter((e) => !/GPU stall|WebGL/.test(e));
  if (relevant.length) console.log('Console errors:\n  ' + relevant.slice(0, 10).join('\n  '));
  T.ok(relevant.length === 0, 'no browser console errors');
  srv.stop();
  console.log(T.failures ? `\n${T.failures} check(s) FAILED` : '\nAll transformation browser checks passed');
  console.log('Screenshots:', shots);
  setTimeout(() => process.exit(T.failures ? 1 : 0), 300);
});
