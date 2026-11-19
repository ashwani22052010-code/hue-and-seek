// Integration tests for all game modes, abilities, decoys, chaos events and interactables.
// Usage: node e2e/modes.integration.mjs
import { startServer, waitFor, makeChecker, guest, client, startMatch, team, sleep } from './lib.mjs';
import { approachLiving, physWalk, HOUSE } from './physwalk.mjs';

const PORT = 3998;
const srv = startServer(PORT);
const { ok, ...chk } = makeChecker();
const check = { ok, get failures() { return chk.failures; } };
const T = makeChecker();

// house map: route from the kitchen (seeker spawns) into the living room along z = -7

async function players(names) {
  const cs = [];
  for (const n of names) cs.push(client(srv.base, n, await guest(srv.base, n)));
  await Promise.all(cs.map((c) => c.ready));
  return cs;
}
const close = (cs) => cs.forEach((c) => c.s.close());
const hunt = (c) => waitFor(() => c.state?.phase === 'hunt', 20000, 'hunt');

async function infection() {
  console.log('\n[Infection mode]');
  const cs = await players(['Ivy', 'Jon', 'Kai']);
  await startMatch(cs, { mode: 'infection', mapId: 'house' });
  const seekers = cs.filter((c) => team(c) === 'seeker');
  const hiders = cs.filter((c) => team(c) === 'hider');
  T.ok(seekers.length === 1 && hiders.length === 2, '3 players -> 1 seeker, 2 hiders');
  await hunt(cs[0]);
  const [s] = seekers;
  const [h1, h2] = hiders;
  await approachLiving(s, h1.spawn[0], h1.spawn[2]);
  s.s.emit('tag', { p: [h1.spawn[0], 0.5, h1.spawn[2]] });
  await waitFor(() => s.ev('infected').length > 0, 3000, 'infected');
  await waitFor(() => team(h1) === 'seeker', 2000, 'h1 now seeker');
  T.ok(true, `${h1.name} was infected and joined the seekers`);
  await waitFor(() => h1.abilities?.list.some((a) => a.id === 'scanner'), 2000, 'seeker abilities');
  T.ok(true, 'infected player received seeker abilities');
  await sleep(300);
  h1.pos = null;
  await approachLiving(h1, h2.spawn[0], h2.spawn[2]);
  h1.s.emit('tag', { p: [h2.spawn[0], 0.5, h2.spawn[2]] });
  await waitFor(() => cs[0].state.phase === 'results', 4000, 'results');
  const res = cs[0].state.results;
  T.ok(res.winner === 'seekers', `infected player caught the last hider -> ${res.winnerLabel}`);
  T.ok(res.players.find((p) => p.id === h1.id).finds === 1, 'infected player credited with the find');
  close(cs);
}

async function everyone() {
  console.log('\n[Everyone Hides mode]');
  const cs = await players(['Lia', 'Max']);
  await startMatch(cs, { mode: 'everyone', mapId: 'house' });
  T.ok(cs.every((c) => team(c) === 'hider'), 'everyone starts as a hider');
  const hidePos = cs.map((c) => [...c.spawn]);
  await hunt(cs[0]);
  await waitFor(() => cs[0].statues.length === 2, 3000, 'statues');
  T.ok(true, 'both disguises frozen into statues');
  await waitFor(() => cs.every((c) => team(c) === 'seeker'), 2000, 'all seekers');
  T.ok(true, 'everyone became a seeker for the hunt');
  const [a, b] = cs;
  await sleep(200);
  // poking your own statue does nothing
  await approachLiving(a, hidePos[0][0], hidePos[0][2]);
  a.s.emit('tag', { p: [hidePos[0][0], 0.5, hidePos[0][2]] });
  await sleep(400);
  T.ok(!a.statues.find((s) => s.ownerId === a.id).found, "poking your own statue doesn't count");
  await sleep(1300);
  await approachLiving(a, hidePos[1][0], hidePos[1][2]);
  a.s.emit('tag', { p: [hidePos[1][0], 0.5, hidePos[1][2]] });
  await waitFor(() => a.ev('caught').some((e) => e.statue), 3000, 'statue found');
  await waitFor(() => a.me().score >= 100, 2000, 'statue points').catch(() => {});
  T.ok(a.me().score >= 100, `${a.name} found ${b.name}'s statue (+100)`);
  await approachLiving(b, hidePos[0][0], hidePos[0][2]);
  b.s.emit('tag', { p: [hidePos[0][0], 0.5, hidePos[0][2]] });
  await waitFor(() => a.state.phase === 'results', 4000, 'results');
  T.ok(a.state.results.mode === 'everyone' && a.state.results.totalFinds === 2, `all statues found -> ${a.state.results.winnerLabel}`);
  close(cs);
}

async function teamBattle() {
  console.log('\n[Team Battle mode]');
  const cs = await players(['Nia', 'Oto']);
  await startMatch(cs, { mode: 'teambattle', mapId: 'house' });
  const sides = cs.map((c) => c.me().side);
  T.ok(sides.includes('red') && sides.includes('blue'), 'players split into red and blue');
  const round1Hider = cs.find((c) => team(c) === 'hider');
  T.ok(round1Hider.me().side === 'red', 'red team hides first');
  for (let round = 1; round <= 2; round++) {
    await hunt(cs[0]);
    const s = cs.find((c) => team(c) === 'seeker');
    const h = cs.find((c) => team(c) === 'hider');
    s.pos = null; h.pos = null;
    await approachLiving(s, h.spawn[0], h.spawn[2]);
    s.s.emit('tag', { p: [h.spawn[0], 0.5, h.spawn[2]] });
    if (round === 1) {
      await waitFor(() => cs[0].state.phase === 'intermission', 4000, 'intermission');
      T.ok(cs[0].state.teamScores.blue > 0, `round 1 over, scores red ${cs[0].state.teamScores.red} / blue ${cs[0].state.teamScores.blue}`);
      await waitFor(() => cs[0].state.phase === 'assign' && cs[0].state.round === 2, 8000, 'round 2');
      await waitFor(() => cs.every((c) => c.spawn), 2000, 'spawn');
      T.ok(cs.find((c) => team(c) === 'hider').me().side === 'blue', 'teams swapped roles for round 2');
    }
  }
  await waitFor(() => cs[0].state.phase === 'results', 4000, 'results');
  const res = cs[0].state.results;
  T.ok(res.teamScores && ['red', 'blue', 'draw'].includes(res.winner), `final: ${res.winnerLabel} (red ${res.teamScores.red} / blue ${res.teamScores.blue})`);
  close(cs);
}

async function chaosAndAbilities() {
  console.log('\n[Chaos mode + abilities + interactables]');
  const cs = await players(['Pip', 'Quin']);
  await startMatch(cs, { mode: 'chaos', mapId: 'house', huntTime: 120 });
  const h = cs.find((c) => team(c) === 'hider');
  const s = cs.find((c) => team(c) === 'seeker');
  await waitFor(() => h.state.phase === 'prep', 4000, 'prep');
  // quick disguise works during prep and is hidden from the seeker
  h.s.emit('ability', { id: 'quickdisguise', data: { ops: [{ t: 'f', g: 1, r: 'all', c: '#c08a52', pat: 'wood' }] } });
  await sleep(300);
  T.ok(h.paints.some((p) => p.k === 'replace') && s.paints.length === 0, 'Quick Disguise applied (seeker did not see it during prep)');
  // walk to the living-room lamp and switch it off
  await physWalk(h, 'house', [[-3, 0, -6.4], [-3, 0, -2.6], [-0.8, 0, -1.6]]);
  h.s.emit('interact', { id: 'lamp_living' });
  await waitFor(() => h.ev('interact').length > 0, 2000, 'interact');
  T.ok(h.state.interactables.lamp_living === false || h.ev('interact')[0].active === false, 'hider switched the lamp off (synced state)');
  await physWalk(h, 'house', [[-3, 0, -2.6], [-3, 0, -5.6], [-4.6, 0, -6.0]]);
  await hunt(h);

  // seeker abilities
  s.s.emit('ability', { id: 'scanner' });
  await waitFor(() => s.ev('scanner').length === 1, 2000, 'scanner');
  s.s.emit('ability', { id: 'scanner' });
  await sleep(400);
  T.ok(s.ev('scanner').length === 1, 'Scanner Pulse fired once and then respected its cooldown');
  s.s.emit('ability', { id: 'footprints' });
  await waitFor(() => s.ev('footprints').length === 1, 2000, 'footprints');
  T.ok(s.ev('footprints')[0].prints.length > 0, `Footprint Vision revealed ${s.ev('footprints')[0].prints.length} recent prints`);
  s.s.emit('ability', { id: 'speed' });
  await waitFor(() => s.ev('ability').some((e) => e.ability === 'speed'), 2000, 'speed');
  T.ok(true, 'Speed Boost activated');

  // hider abilities
  h.s.emit('ability', { id: 'decoy' });
  await waitFor(() => s.decoys.length === 1, 2000, 'decoy');
  T.ok(true, 'Decoy created and visible to the seeker');
  await physWalk(h, 'house', [[-5.9, 0, -6.6]], { speed: 2.0 }); // sneak away slowly (hunt speed limit)
  h.s.emit('ability', { id: 'colorshift' });
  await waitFor(() => s.ev('tint').length === 1, 2000, 'tint');
  T.ok(/^#[0-9a-f]{6}$/.test(s.ev('tint')[0].color), `Color Shift tinted the hider ${s.ev('tint')[0].color}`);
  h.s.emit('ability', { id: 'silent' });
  await sleep(150);
  h.s.emit('ability', { id: 'freeze' });
  await sleep(300);
  const corr = h.corrections.length;
  h.s.emit('move', { p: [h.pos[0] + 0.5, 0, h.pos[2]], r: 0, f: 3, s: 0 });
  await waitFor(() => h.corrections.length > corr, 2000, 'frozen correction');
  T.ok(true, 'Freeze locks the hider in place (server rejects movement)');
  s.s.emit('ability', { id: 'sound' });
  await waitFor(() => s.ev('sound').length === 1, 2000, 'sound');
  T.ok(s.ev('sound')[0].angle === null, 'Sound Detection hears nothing from a frozen/silent hider');

  // chaos event fires during the hunt
  await waitFor(() => s.ev('chaos').length > 0, 15000, 'chaos event');
  T.ok(true, `chaos event: ${s.ev('chaos')[0].event}`);

  // poke the decoy -> stunned, then find the real hider
  await physWalk(s, 'house', [...HOUSE.atticToHall, ...HOUSE.hallToLiving, [-3.4, 0, -6.0]], { speed: 6.5 });
  s.s.emit('tag', { p: [-4.6, 0.5, -6.0] });
  await waitFor(() => s.ev('decoy_popped').length === 1, 3000, 'decoy popped');
  T.ok(s.abilities.tagReadyAt > Date.now() + 1500, 'seeker was stunned by the decoy');
  await waitFor(() => h.me().score >= 25, 2000, 'decoy points').catch(() => {});
  T.ok(h.me().score >= 25, 'hider earned points for fooling the seeker');
  s.s.emit('tag', { p: [-5.9, 0.4, -6.6] });
  await sleep(300);
  T.ok(s.ev('caught').length === 0, 'stunned seeker cannot tag');
  await waitFor(() => Date.now() > s.abilities.tagReadyAt + 100, 5000, 'stun over');
  s.s.emit('tag', { p: [-5.9, 0.4, -6.6] });
  await waitFor(() => s.state.phase === 'results', 4000, 'results');
  const r = s.state.results.players.find((p) => p.id === h.id);
  T.ok(r.decoysFooled === 1, 'results record the decoy that fooled a seeker');
  await sleep(800);
  close(cs);
}

async function main() {
  await srv.ready();
  for (const fn of [infection, everyone, teamBattle, chaosAndAbilities]) {
    try {
      await fn();
    } catch (e) {
      T.failures++;
      console.log(`  ✘ ${fn.name}: ${e.message}`);
    }
  }
}

main().finally(() => {
  srv.stop();
  void check;
  console.log(T.failures ? `\n${T.failures} check(s) FAILED` : '\nAll mode/ability checks passed');
  setTimeout(() => process.exit(T.failures ? 1 : 0), 300);
});
