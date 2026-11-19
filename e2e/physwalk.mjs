// Physics-accurate test walker: drives a socket client through waypoints using the game's own shared
// character physics (stairs, walls, gravity), sending moves at the real client rate.
// Must be run with tsx (imports TypeScript from /shared).
import { setTimeout as sleep } from 'node:timers/promises';
import { getMapSync } from '../shared/src/maps/all.ts';
import { buildMapWorld } from '../shared/src/maps/index.ts';
import { stepCharacter, isEmbedded } from '../shared/src/game-rules/physics.ts';

const worlds = {};
export const worldFor = (mapId) => (worlds[mapId] ??= buildMapWorld(getMapSync(mapId)));
export const mapFor = (mapId) => getMapSync(mapId);

/**
 * Walk `c` (a lib.mjs client) through [x, *, z] waypoints. Returns the final position.
 * Throws if the character gets stuck (no progress for 3 s).
 */
export async function physWalk(c, mapId, waypoints, { speed = 4.2, radius = 0.27, height = 1.34, sprint = false, dry = false } = {}) {
  const world = worldFor(mapId);
  const st = { p: [...(c.pos ?? c.spawn)], v: [0, 0, 0], grounded: true };
  let seq = 0;
  for (const wp of waypoints) {
    let best = Infinity, lastProgress = Date.now(), ticks = 0, lastTick = 0;
    for (;;) {
      const dx = wp[0] - st.p[0], dz = wp[2] - st.p[2];
      const d = Math.hypot(dx, dz);
      if (d < 0.15) break;
      if (d < best - 0.05) { best = d; lastProgress = Date.now(); lastTick = ticks; }
      if (dry ? ++ticks - lastTick > 45 : Date.now() - lastProgress > 3000) throw new Error(`${c.name} stuck at [${st.p.map((v) => v.toFixed(2))}] heading to [${wp}]`);
      for (let i = 0; i < 4; i++) stepCharacter(world, st, { x: dx / d, z: dz / d, jump: false, sprint }, 1 / 60, { radius, height, speed });
      if (isEmbedded(world, st.p, radius, height)) throw new Error(`${c.name} embedded in geometry at [${st.p}]`);
      c.s.emit('move', { p: st.p.map((v) => +v.toFixed(3)), r: Math.atan2(dx, dz), f: 3, s: seq++ });
      if (!dry) await sleep(66);
    }
  }
  // settle
  for (let i = 0; i < 4; i++) { stepCharacter(world, st, { x: 0, z: 0, jump: false, sprint: false }, 1 / 60, { radius, height, speed }); }
  c.s.emit('move', { p: st.p.map((v) => +v.toFixed(3)), r: 0, f: 1, s: seq++ });
  if (!dry) await sleep(80);
  c.pos = [...st.p];
  return c.pos;
}

// ---- common routes in the two-storey house ----
export const HOUSE = {
  // seekers spawn in the upstairs attic: down the landing, along the stairwell railing, down the stairs
  atticToHall: [[4.5, 0, 3.3], [4, 0, 1.2], [5.8, 0, 0], [11.5, 0, 0], [11.5, 0, 1.2], [10.3, 0, 1.2], [6.1, 0, 1.2], [5, 0, 0.1]],
  hallToKitchen: [[3.2, 0, 0.1], [3.2, 0, -2], [4.6, 0, -3.5]],
  hallToLiving: [[1, 0, 0], [-0.6, 0, 0], [-3, 0, -2.6], [-3, 0, -5.6]],
  livingToHall: [[-3, 0, -6.4], [-3, 0, -2.6], [-0.6, 0, 0], [1, 0, 0]],
};

/** Walk from anywhere in the house to a spot 1.4 m east of (hx, hz) in the living room. */
export async function approachLiving(c, hx, hz, speed = 6.5) {
  const p = c.pos ?? c.spawn;
  const pts = [];
  if (p[1] > 2) pts.push(...HOUSE.atticToHall);
  if (p[1] > 2 || p[0] > -0.4) pts.push(...HOUSE.hallToLiving);
  pts.push([hx + 1.4, 0, -5.6], [hx + 1.4, 0, hz]);
  return physWalk(c, 'house', pts, { speed });
}
