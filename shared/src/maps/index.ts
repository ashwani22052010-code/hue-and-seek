// Map registry helpers. Client lazy-loads maps via MAP_LOADERS (code-split per map).
import type { MapId, Vec3 } from '../types';
import type { MapDef, PropDef } from './types';
import { buildWorld, type Collider, type CollisionWorld } from '../game-rules/physics';
import { PROPS } from '../props/registry';
import type { ItemDef } from './types';

export type { MapDef, PropDef, InteractableDef, LightDef, ItemDef } from './types';

export const MAP_LOADERS: Record<MapId, () => Promise<MapDef>> = {
  house: () => import('./house').then((m) => m.buildHouse()),
  supermarket: () => import('./supermarket').then((m) => m.buildSupermarket()),
  school: () => import('./school').then((m) => m.buildSchool()),
  toyworld: () => import('./toyworld').then((m) => m.buildToyWorld()),
  factory: () => import('./factory').then((m) => m.buildFactory()),
  office: () => import('./office').then((m) => m.buildOffice()),
  restaurant: () => import('./restaurant').then((m) => m.buildRestaurant()),
};

function rotate(v: Vec3, rot: Vec3): Vec3 {
  // three.js Euler 'XYZ': M = Rx * Ry * Rz
  let [x, y, z] = v;
  const [ax, ay, az] = rot;
  let c = Math.cos(az), s = Math.sin(az);
  [x, y] = [x * c - y * s, x * s + y * c];
  c = Math.cos(ay); s = Math.sin(ay);
  [x, z] = [x * c + z * s, -x * s + z * c];
  c = Math.cos(ax); s = Math.sin(ax);
  [y, z] = [y * c - z * s, y * s + z * c];
  return [x, y, z];
}

export function propAABB(p: PropDef): { min: Vec3; max: Vec3 } {
  const shrink = p.s === 'sphere' ? 0.82 : p.s === 'cone' ? 0.7 : 1;
  const hx = (p.d[0] / 2) * shrink, hy = p.d[1] / 2 * (p.s === 'sphere' ? 0.9 : 1), hz = (p.d[2] / 2) * shrink;
  if (!p.rot || (p.rot[0] === 0 && p.rot[1] === 0 && p.rot[2] === 0)) {
    return { min: [p.p[0] - hx, p.p[1] - hy, p.p[2] - hz], max: [p.p[0] + hx, p.p[1] + hy, p.p[2] + hz] };
  }
  const min: Vec3 = [Infinity, Infinity, Infinity], max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const r = rotate([sx * hx, sy * hy, sz * hz], p.rot);
    for (let a = 0; a < 3; a++) {
      min[a] = Math.min(min[a], p.p[a] + r[a]);
      max[a] = Math.max(max[a], p.p[a] + r[a]);
    }
  }
  return { min, max };
}

/** World-space bounding box of a placed item. */
export function itemAABB(it: ItemDef): { min: Vec3; max: Vec3 } {
  const t = PROPS[it.t];
  const s = it.s ?? 1;
  const [w, h, d] = t ? t.size : [0.3, 0.3, 0.3];
  const c = Math.abs(Math.cos(it.r)), sn = Math.abs(Math.sin(it.r));
  const hx = ((w * c + d * sn) / 2) * s, hz = ((w * sn + d * c) / 2) * s;
  return { min: [it.p[0] - hx, it.p[1], it.p[2] - hz], max: [it.p[0] + hx, it.p[1] + h * s, it.p[2] + hz] };
}

export function mapColliders(def: MapDef): Collider[] {
  const out: Collider[] = [];
  for (const p of def.props) {
    if (p.solid === false) continue;
    const bb = propAABB(p);
    out.push({ min: bb.min, max: bb.max, group: p.group });
  }
  for (const it of def.items ?? []) {
    if (!PROPS[it.t]?.solid) continue;
    const bb = itemAABB(it);
    // shrink slightly so players can squeeze between furniture
    out.push({ min: [bb.min[0] + 0.03, bb.min[1], bb.min[2] + 0.03], max: [bb.max[0] - 0.03, bb.max[1], bb.max[2] - 0.03] });
  }
  return out;
}

export function buildMapWorld(def: MapDef): CollisionWorld {
  return buildWorld(mapColliders(def), def.bounds);
}

/** Nearest solid prop colour to a point (used by Color Shift). */
export function nearestPropColor(def: MapDef, p: Vec3, overrides: Record<number, string> = {}): string {
  let best = def.floor.c, bestD = 1.2; // floor wins unless something is very close
  def.props.forEach((prop, i) => {
    if (prop.glow) return;
    const bb = propAABB(prop);
    const dx = Math.max(bb.min[0] - p[0], 0, p[0] - bb.max[0]);
    const dy = Math.max(bb.min[1] - (p[1] + 0.5), 0, p[1] + 0.5 - bb.max[1]);
    const dz = Math.max(bb.min[2] - p[2], 0, p[2] - bb.max[2]);
    const d = Math.hypot(dx, dy, dz);
    if (d < bestD && bb.max[1] - bb.min[1] > 0.05) { bestD = d; best = overrides[i] ?? prop.c; }
  });
  return best;
}
