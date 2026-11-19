// Object transformation (prop hunt) + hide styles: server rules tested with real socket clients.
// Usage: npx tsx e2e/props.integration.mjs
import { startServer, waitFor, makeChecker, guest, client, startMatch, team, sleep } from './lib.mjs';
import { physWalk, mapFor, worldFor, HOUSE } from './physwalk.mjs';
import { hasLineOfSight } from '../shared/src/game-rules/physics.ts';
import { PROPS } from '../shared/src/props/registry.ts';

const srv = startServer(3997, { FAST_TIMERS: 'false', TIMER_SCALE: '0.6' });
const T = makeChecker();
const house = mapFor('house');
const idx = (t, near) => house.items.map((it, i) => ({ it, i })).filter(({ it }) => it.t === t).sort((a, b) => Math.hypot(a.it.p[0] - near[0], a.it.p[2] - near[2]) - Math.hypot(b.it.p[0] - near[0], b.it.p[2] - near[2]))[0].i;

async function players(names) {
  const cs = [];
  for (const n of names) cs.push(client(srv.base, n, await guest(srv.base, n)));
  await Promise.all(cs.map((c) => c.ready));
  return cs;
}

async function propsMatch() {
  console.log('\n[Object Transformation mode]');
  const [A, B] = await players(['Prop', 'Hunter']);
  const bad = await A.emit('room:create', { isPublic: false });
  const badStyle = await A.emit('room:settings', { hideStyle: 'invisible' });
  T.ok(bad.ok && !badStyle.ok, 'unknown hiding style rejected');
  await A.emit('room:leave');
  await startMatch([A, B], { mapId: 'house', hideStyle: 'props', mode: 'classic' });
  T.ok(A.state.settings.hideStyle === 'props', 'host selected Object Transformation; all players see it');
  const hider = team(A) === 'hider' ? A : B, seeker = hider === A ? B : A;
  await waitFor(() => hider.state.phase === 'prep', 8000, 'prep');

  // painting is disabled in props-only mode
  hider.s.emit('paint', { k: 'op', op: { t: 'f', g: 1, r: 'all', c: '#123456', pat: 'solid' } });
  // a transform from the spawn: the kitchen jug is far away
  const jug = idx('jug', [5.3, 0, -5.1]);
  let r = await hider.emit('transform', { item: jug });
  T.ok(!r.ok && /far/i.test(r.error), `out-of-range object refused ("${r.error}")`);
  r = await hider.emit('transform', { item: idx('sofa', hider.spawn) });
  T.ok(!r.ok && /can't turn/i.test(r.error), `unsupported furniture refused ("${r.error}")`);
  r = await seeker.emit('transform', { item: jug });
  T.ok(!r.ok, 'seekers cannot transform');

  // walk to the hallway and test line of sight through a wall
  await physWalk(hider, 'house', [[-3, 0, -6.4], ...HOUSE.livingToHall.slice(1), [0.8, 0, 0]]);
  const world = worldFor('house');
  const eye = [hider.pos[0], hider.pos[1] + 1.07, hider.pos[2]];
  const blocked = house.items.map((it, i) => ({ it, i })).find(({ it }) => {
    const t = PROPS[it.t];
    if (!t?.transformable) return false;
    const c = [it.p[0], it.p[1] + t.size[1] / 2, it.p[2]];
    const d = Math.hypot(c[0] - eye[0], c[1] - eye[1], c[2] - eye[2]);
    return d < 4.3 && !hasLineOfSight(world, eye, c, null, Math.max(t.size[0], t.size[2]) / 2 + 0.25);
  });
  if (blocked) {
    r = await hider.emit('transform', { item: blocked.i });
    T.ok(!r.ok && /wall/i.test(r.error), `object behind a wall refused (${blocked.it.t}: "${r.error}")`);
  } else T.ok(false, 'found an in-range object behind a wall to test');

  // into the kitchen next to the island: transform into the jug
  await physWalk(hider, 'house', HOUSE.hallToKitchen);
  r = await hider.emit('transform', { item: jug });
  T.ok(r.ok, 'hider transformed into the water jug');
  await waitFor(() => hider.me().disguise === 'jug', 2000, 'disguise visible to hider');
  await sleep(150);
  T.ok(seeker.me() && seeker.state.players.find((p) => p.id === hider.id).disguise === null, 'seeker cannot see the disguise during preparation (masked)');
  T.ok(!seeker.ev('transform').length, 'seeker received no transform event during preparation');
  r = await hider.emit('transform', { item: idx('glass', hider.pos) });
  T.ok(!r.ok && /recharg/i.test(r.error), `cooldown enforced ("${r.error}")`);
  await sleep(1300);
  r = await hider.emit('transform', { item: idx('stool', hider.pos) });
  T.ok(r.ok, 'transformed again: jug -> stool');
  await waitFor(() => hider.me().disguise === 'stool', 2000, 'stool');
  await sleep(1300);
  r = await hider.emit('transform', { revert: true });
  await waitFor(() => hider.me().disguise === null, 2000, 'revert');
  T.ok(r.ok, 'changed back into the normal character');
  await sleep(1300);
  r = await hider.emit('transform', { item: jug });
  T.ok(r.ok, 'transformed into the jug again for the hunt');
  // moving as a jug uses the jug's (smaller) collider and is validated normally
  const c0 = hider.corrections.length;
  await physWalk(hider, 'house', [[4.0, 0, -3.3], [4.6, 0, -3.5]], { radius: 0.1, height: 0.3 });
  T.ok(hider.corrections.length === c0, 'moving around as the jug: no server corrections');

  // hunt: the seeker sees the jug, comes downstairs and pokes it
  await waitFor(() => seeker.state.phase === 'hunt', 60000, 'hunt');
  await waitFor(() => seeker.state.players.find((p) => p.id === hider.id).disguise === 'jug', 3000, 'seeker sees jug');
  T.ok(true, 'seeker sees the hider as a jug once the hunt starts');
  T.ok(seeker.snaps.at(-1).pl.some((p) => p[0] === hider.id), 'jug position is streamed to the seeker');
  const sc0 = seeker.corrections.length;
  await physWalk(seeker, 'house', [...HOUSE.atticToHall, [3.2, 0, 0.1], [3.2, 0, -2], [3.8, 0, -2.7]], { speed: 6.5 });
  T.ok(seeker.corrections.length === sc0, 'seeker walked down the stairs with no server corrections');
  seeker.s.emit('tag', { p: [hider.pos[0], hider.pos[1] + 0.15, hider.pos[2]] });
  await waitFor(() => seeker.ev('caught').length > 0, 3000, 'caught');
  await waitFor(() => seeker.state.phase === 'results', 4000, 'results');
  T.ok(seeker.state.results.winner === 'seekers', 'seeker found the jug - Seekers win');
  T.ok(!hider.paints.length && !hider.paintFull.some((f) => Object.keys(f.paints).length), 'painting was disabled in Object Transformation mode');
  A.s.close(); B.s.close();
}

async function styleRules() {
  console.log('\n[Hybrid and Color Camouflage rules]');
  for (const style of ['paint', 'hybrid']) {
    const [A, B] = await players([`Sty${style}`, `Oth${style}`]);
    await startMatch([A, B], { mapId: 'house', hideStyle: style, mode: 'classic' });
    const hider = team(A) === 'hider' ? A : B, seeker = hider === A ? B : A;
    await waitFor(() => hider.state.phase === 'prep', 8000, 'prep');
    const near = idx('ball', hider.spawn);
    await physWalk(hider, 'house', [[house.items[near].p[0] + 0.9, 0, house.items[near].p[2] + 0.3]]);
    const r = await hider.emit('transform', { item: near });
    if (style === 'paint') T.ok(!r.ok && /off/i.test(r.error), 'Color Camouflage: transformation is disabled');
    else T.ok(r.ok, 'Hybrid: hider can transform');
    hider.s.emit('paint', { k: 'op', op: { t: 'f', g: 7, r: 'all', c: '#22c55e', pat: 'camo' } });
    await sleep(300);
    if (style === 'paint') T.ok(hider.paints.length === 0 && seeker.paints.length === 0, 'Color Camouflage: paint accepted (hidden from seeker)');
    else {
      // hybrid: no painting while disguised, painting again after changing back
      await sleep(1300);
      await hider.emit('transform', { revert: true });
      hider.s.emit('paint', { k: 'op', op: { t: 'f', g: 8, r: 'all', c: '#ef4444', pat: 'solid' } });
      await waitFor(() => hider.state.phase === 'hunt', 60000, 'hunt');
      await waitFor(() => seeker.paintFull.some((f) => (f.paints[hider.id] ?? []).length === 1), 3000, 'paint');
      T.ok(true, 'Hybrid: paint applied only after changing back (1 op reached the seeker)');
    }
    A.s.close(); B.s.close();
  }
}

async function main() {
  await srv.ready();
  for (const fn of [propsMatch, styleRules]) {
    try { await fn(); } catch (e) { T.failures++; console.log(`  ✘ ${fn.name}: ${e.message}`); }
  }
}
main().finally(() => {
  srv.stop();
  console.log(T.failures ? `\n${T.failures} check(s) FAILED` : '\nAll transformation checks passed');
  setTimeout(() => process.exit(T.failures ? 1 : 0), 300);
});
