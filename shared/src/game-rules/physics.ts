// Deterministic character physics shared by client (prediction) and server (validation).
import type { Vec3 } from '../types';
import { PHYS } from '../constants';

export interface Collider {
  min: Vec3;
  max: Vec3;
  /** Interactable group id (e.g. a door). Disabled groups are ignored. */
  group?: string;
}

export interface CollisionWorld {
  colliders: Collider[];
  cell: number;
  grid: Map<number, number[]>;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  stamp: Uint32Array;
  stampId: number;
}

const key = (ix: number, iz: number) => (ix + 512) * 2048 + (iz + 512);

export function buildWorld(colliders: Collider[], bounds: CollisionWorld['bounds'], cell = 4): CollisionWorld {
  const grid = new Map<number, number[]>();
  colliders.forEach((c, i) => {
    const x0 = Math.floor(c.min[0] / cell), x1 = Math.floor(c.max[0] / cell);
    const z0 = Math.floor(c.min[2] / cell), z1 = Math.floor(c.max[2] / cell);
    for (let x = x0; x <= x1; x++)
      for (let z = z0; z <= z1; z++) {
        const k = key(x, z);
        let arr = grid.get(k);
        if (!arr) grid.set(k, (arr = []));
        arr.push(i);
      }
  });
  return { colliders, cell, grid, bounds, stamp: new Uint32Array(colliders.length), stampId: 1 };
}

/** Collect indices of colliders whose grid cells overlap the box. */
export function query(world: CollisionWorld, minX: number, minZ: number, maxX: number, maxZ: number, out: number[]): number[] {
  out.length = 0;
  const cell = world.cell;
  const id = ++world.stampId;
  if (id > 4_000_000_000) { world.stamp.fill(0); world.stampId = 1; }
  const x0 = Math.floor(minX / cell), x1 = Math.floor(maxX / cell);
  const z0 = Math.floor(minZ / cell), z1 = Math.floor(maxZ / cell);
  for (let x = x0; x <= x1; x++)
    for (let z = z0; z <= z1; z++) {
      const arr = world.grid.get(key(x, z));
      if (!arr) continue;
      for (const i of arr) {
        if (world.stamp[i] === world.stampId) continue;
        world.stamp[i] = world.stampId;
        out.push(i);
      }
    }
  return out;
}

export interface MoveState {
  p: Vec3; // feet position
  v: Vec3;
  grounded: boolean;
}
export interface MoveInput {
  x: number; // desired world-space direction (length <= 1)
  z: number;
  jump: boolean;
  sprint: boolean;
}
export interface MoveOpts {
  radius: number;
  height: number;
  speed: number;
  disabled?: Set<string> | null;
}

const tmp: number[] = [];

function overlaps(world: CollisionWorld, p: Vec3, r: number, h: number, disabled: Set<string> | null | undefined, out: number[]) {
  const list = query(world, p[0] - r, p[2] - r, p[0] + r, p[2] + r, tmp);
  out.length = 0;
  for (const i of list) {
    const c = world.colliders[i];
    if (c.group && disabled?.has(c.group)) continue;
    if (
      p[0] + r > c.min[0] && p[0] - r < c.max[0] &&
      p[2] + r > c.min[2] && p[2] - r < c.max[2] &&
      p[1] + h > c.min[1] && p[1] < c.max[1]
    ) out.push(i);
  }
  return out;
}

const hits: number[] = [];
const EPS = 0.001;

function resolveHorizontal(world: CollisionWorld, st: MoveState, axis: 0 | 2, delta: number, o: MoveOpts) {
  st.p[axis] += delta;
  overlaps(world, st.p, o.radius, o.height, o.disabled, hits);
  if (!hits.length) return;
  // Try stepping up onto low obstacles.
  let top = -Infinity;
  for (const i of hits) top = Math.max(top, world.colliders[i].max[1]);
  if (top - st.p[1] <= PHYS.stepHeight && st.v[1] <= 0.5) {
    const oldY = st.p[1];
    st.p[1] = top + EPS;
    const blocked = overlaps(world, st.p, o.radius, o.height, o.disabled, []).length > 0;
    if (!blocked) { st.grounded = true; if (st.v[1] < 0) st.v[1] = 0; return; }
    st.p[1] = oldY;
  }
  for (const i of hits) {
    const c = world.colliders[i];
    if (delta > 0) st.p[axis] = Math.min(st.p[axis], c.min[axis] - o.radius - EPS);
    else if (delta < 0) st.p[axis] = Math.max(st.p[axis], c.max[axis] + o.radius + EPS);
  }
  st.v[axis] = 0;
}

function resolveVertical(world: CollisionWorld, st: MoveState, delta: number, o: MoveOpts) {
  st.p[1] += delta;
  overlaps(world, st.p, o.radius, o.height, o.disabled, hits);
  if (hits.length) {
    if (delta <= 0) {
      let top = -Infinity;
      for (const i of hits) top = Math.max(top, world.colliders[i].max[1]);
      st.p[1] = top + EPS;
      st.v[1] = 0;
      st.grounded = true;
    } else {
      let bottom = Infinity;
      for (const i of hits) bottom = Math.min(bottom, world.colliders[i].min[1]);
      st.p[1] = bottom - o.height - EPS;
      st.v[1] = 0;
    }
  }
  if (st.p[1] <= 0) {
    st.p[1] = 0;
    if (st.v[1] < 0) st.v[1] = 0;
    st.grounded = true;
  }
}

/** Advance the character by dt seconds. Mutates st. */
export function stepCharacter(world: CollisionWorld, st: MoveState, input: MoveInput, dt: number, o: MoveOpts) {
  dt = Math.min(dt, 0.1);
  const len = Math.hypot(input.x, input.z);
  const ix = len > 1 ? input.x / len : input.x;
  const iz = len > 1 ? input.z / len : input.z;
  const tx = ix * o.speed, tz = iz * o.speed;
  const accel = st.grounded ? 20 : 7;
  const k = Math.min(1, accel * dt);
  st.v[0] += (tx - st.v[0]) * k;
  st.v[2] += (tz - st.v[2]) * k;
  if (input.jump && st.grounded) {
    st.v[1] = PHYS.jumpSpeed;
    st.grounded = false;
  }
  st.v[1] = Math.max(PHYS.maxFall, st.v[1] + PHYS.gravity * dt);

  const maxDisp = Math.max(Math.abs(st.v[0]), Math.abs(st.v[1]), Math.abs(st.v[2])) * dt;
  const steps = Math.max(1, Math.ceil(maxDisp / 0.2));
  const sdt = dt / steps;
  for (let s = 0; s < steps; s++) {
    st.grounded = false;
    resolveHorizontal(world, st, 0, st.v[0] * sdt, o);
    resolveHorizontal(world, st, 2, st.v[2] * sdt, o);
    resolveVertical(world, st, st.v[1] * sdt, o);
  }
  const b = world.bounds;
  st.p[0] = Math.min(b.maxX - o.radius, Math.max(b.minX + o.radius, st.p[0]));
  st.p[2] = Math.min(b.maxZ - o.radius, Math.max(b.minZ + o.radius, st.p[2]));
}

/** True when a character at p is substantially embedded inside solid geometry (anti-cheat). */
export function isEmbedded(world: CollisionWorld, p: Vec3, radius: number, height: number, disabled?: Set<string> | null) {
  const r = Math.max(0.05, radius * 0.35);
  const probe: Vec3 = [p[0], p[1] + 0.2, p[2]];
  return overlaps(world, probe, r, Math.max(0.1, height * 0.5), disabled, []).length > 0;
}

/** Ray vs world AABBs; returns distance to first hit or Infinity. */
export function raycastWorld(world: CollisionWorld, o: Vec3, d: Vec3, maxDist: number, disabled?: Set<string> | null): number {
  let best = maxDist;
  const ex = o[0] + d[0] * maxDist, ez = o[2] + d[2] * maxDist;
  const list = query(world, Math.min(o[0], ex), Math.min(o[2], ez), Math.max(o[0], ex), Math.max(o[2], ez), []);
  for (const i of list) {
    const c = world.colliders[i];
    if (c.group && disabled?.has(c.group)) continue;
    let tmin = 0, tmax = best;
    let ok = true;
    for (let a = 0; a < 3; a++) {
      if (Math.abs(d[a]) < 1e-9) {
        if (o[a] < c.min[a] || o[a] > c.max[a]) { ok = false; break; }
      } else {
        const inv = 1 / d[a];
        let t1 = (c.min[a] - o[a]) * inv, t2 = (c.max[a] - o[a]) * inv;
        if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
        tmin = Math.max(tmin, t1);
        tmax = Math.min(tmax, t2);
        if (tmin > tmax) { ok = false; break; }
      }
    }
    if (ok && tmin < best) best = tmin;
  }
  return best === maxDist ? Infinity : best;
}

/** Line of sight between two points (true = clear). Tolerance lets a poke land on a surface. */
export function hasLineOfSight(world: CollisionWorld, a: Vec3, b: Vec3, disabled?: Set<string> | null, tolerance = 0.35) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
  const dist = Math.hypot(dx, dy, dz);
  if (dist < 1e-6) return true;
  const d: Vec3 = [dx / dist, dy / dist, dz / dist];
  const hit = raycastWorld(world, a, d, dist, disabled);
  return hit === Infinity || hit >= dist - tolerance;
}
