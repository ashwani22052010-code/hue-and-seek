// Map construction helpers. Coordinates: y up, y passed to builders is the BOTTOM of the object.
import type { TexId, Vec3 } from '../types';
import type { InteractableDef, LightDef, PropDef } from './types';
import { mulberry32 } from '../game-rules/rules';

export interface Opts {
  tex?: TexId;
  ts?: number;
  solid?: boolean;
  decor?: boolean;
  group?: string;
  glow?: boolean;
  rot?: Vec3;
}

/** Local frame for placing furniture: origin (x,z) + quarter turns r. */
export interface Frame { x: number; z: number; r: number }

export class MapBuilder {
  props: PropDef[] = [];
  interactables: InteractableDef[] = [];
  lights: LightDef[] = [];
  rand: () => number;

  constructor(seed: number) {
    this.rand = mulberry32(seed);
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.rand() * arr.length)];
  }

  add(p: PropDef) {
    this.props.push(p);
    return p;
  }

  box(x: number, y: number, z: number, w: number, h: number, d: number, c: string, o: Opts = {}) {
    return this.add({ s: 'box', p: [x, y + h / 2, z], d: [w, h, d], c, ...o });
  }
  cyl(x: number, y: number, z: number, dia: number, h: number, c: string, o: Opts = {}) {
    return this.add({ s: 'cyl', p: [x, y + h / 2, z], d: [dia, h, dia], c, ...o });
  }
  cone(x: number, y: number, z: number, dia: number, h: number, c: string, o: Opts = {}) {
    return this.add({ s: 'cone', p: [x, y + h / 2, z], d: [dia, h, dia], c, ...o });
  }
  /** Horizontal cylinder centred at (x,y,z) lying along the x or z axis. */
  pipe(x: number, y: number, z: number, dia: number, len: number, axis: 'x' | 'z', c: string, o: Opts = {}) {
    const rot: Vec3 = axis === 'x' ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0];
    return this.add({ s: 'cyl', p: [x, y, z], d: [dia, len, dia], c, rot, ...o });
  }
  /** sphere: y = bottom */
  sphere(x: number, y: number, z: number, dia: number, c: string, o: Opts = {}, dims?: Vec3) {
    const d = dims ?? [dia, dia, dia];
    return this.add({ s: 'sphere', p: [x, y + d[1] / 2, z], d, c, ...o });
  }

  // ---- local frame helpers ----
  tp(f: Frame, lx: number, lz: number): [number, number] {
    switch (((f.r % 4) + 4) % 4) {
      case 1: return [f.x - lz, f.z + lx];
      case 2: return [f.x - lx, f.z - lz];
      case 3: return [f.x + lz, f.z - lx];
      default: return [f.x + lx, f.z + lz];
    }
  }
  fbox(f: Frame, lx: number, y: number, lz: number, w: number, h: number, d: number, c: string, o: Opts = {}) {
    const [x, z] = this.tp(f, lx, lz);
    const odd = f.r % 2 !== 0;
    return this.box(x, y, z, odd ? d : w, h, odd ? w : d, c, o);
  }
  fcyl(f: Frame, lx: number, y: number, lz: number, dia: number, h: number, c: string, o: Opts = {}) {
    const [x, z] = this.tp(f, lx, lz);
    return this.cyl(x, y, z, dia, h, c, o);
  }
  fsphere(f: Frame, lx: number, y: number, lz: number, dia: number, c: string, o: Opts = {}, dims?: Vec3) {
    const [x, z] = this.tp(f, lx, lz);
    const odd = f.r % 2 !== 0;
    const d: Vec3 | undefined = dims ? (odd ? [dims[2], dims[1], dims[0]] : dims) : undefined;
    return this.sphere(x, y, z, dia, c, o, d);
  }

  // ---- architecture ----
  floorRect(x1: number, z1: number, x2: number, z2: number, c: string, tex: TexId = 'none', ts = 1) {
    this.box((x1 + x2) / 2, 0, (z1 + z2) / 2, Math.abs(x2 - x1), 0.02, Math.abs(z2 - z1), c, { tex, ts, solid: false });
  }

  /** Axis-aligned wall with optional gaps {at: offset from start, w: width, h?: opening height (adds lintel)} */
  wall(x1: number, z1: number, x2: number, z2: number, h: number, c: string, o: Opts & { t?: number; gaps?: { at: number; w: number; h?: number }[] } = {}) {
    const t = o.t ?? 0.25;
    const horizontal = Math.abs(z2 - z1) < 1e-6;
    const len = horizontal ? Math.abs(x2 - x1) : Math.abs(z2 - z1);
    const start = horizontal ? Math.min(x1, x2) : Math.min(z1, z2);
    const gaps = [...(o.gaps ?? [])].sort((a, b) => a.at - b.at);
    let cur = 0;
    const seg = (a: number, b: number, y0: number, hh: number) => {
      if (b - a < 0.01) return;
      const mid = start + (a + b) / 2;
      if (horizontal) this.box(mid, y0, z1, b - a, hh, t, c, { tex: o.tex, ts: o.ts });
      else this.box(x1, y0, mid, t, hh, b - a, c, { tex: o.tex, ts: o.ts });
    };
    for (const g of gaps) {
      seg(cur, g.at, 0, h);
      if (g.h !== undefined && g.h < h) seg(g.at, g.at + g.w, g.h, h - g.h);
      cur = g.at + g.w;
    }
    seg(cur, len, 0, h);
  }

  light(p: Vec3, c: string, i: number, dist: number, group?: string) {
    this.lights.push({ p, c, i, dist, group });
  }

  interact(def: InteractableDef) {
    this.interactables.push(def);
  }

  // ---- furniture prefabs ----
  sofa(f: Frame, c: string, w = 2.4) {
    this.fbox(f, 0, 0, 0, w, 0.45, 0.95, c, { tex: 'fabric', decor: true });
    this.fbox(f, 0, 0.45, -0.38, w, 0.55, 0.22, c, { tex: 'fabric', decor: true });
    this.fbox(f, -w / 2 + 0.12, 0.45, 0.05, 0.24, 0.25, 0.85, c, { tex: 'fabric' });
    this.fbox(f, w / 2 - 0.12, 0.45, 0.05, 0.24, 0.25, 0.85, c, { tex: 'fabric' });
    for (let i = 0; i < 2; i++) this.fbox(f, -w / 4 + (i * w) / 2, 0.45, -0.1, 0.5, 0.35, 0.18, this.pick(['#fde68a', '#fca5a5', '#a5f3fc', '#ffffff']), { tex: 'fabric', decor: true, solid: false });
  }
  armchair(f: Frame, c: string) {
    this.fbox(f, 0, 0, 0, 1.0, 0.45, 0.9, c, { tex: 'fabric', decor: true });
    this.fbox(f, 0, 0.45, -0.35, 1.0, 0.6, 0.2, c, { tex: 'fabric', decor: true });
    this.fbox(f, -0.42, 0.45, 0.05, 0.16, 0.25, 0.8, c, { tex: 'fabric' });
    this.fbox(f, 0.42, 0.45, 0.05, 0.16, 0.25, 0.8, c, { tex: 'fabric' });
  }
  table(f: Frame, w: number, d: number, h: number, c: string, tex: TexId = 'wood') {
    this.fbox(f, 0, h - 0.06, 0, w, 0.06, d, c, { tex });
    const lx = w / 2 - 0.08, lz = d / 2 - 0.08;
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) this.fbox(f, sx * lx, 0, sz * lz, 0.08, h - 0.06, 0.08, c, { tex });
  }
  chair(f: Frame, c: string, tex: TexId = 'wood') {
    this.fbox(f, 0, 0.45, 0, 0.45, 0.05, 0.45, c, { tex });
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) this.fbox(f, sx * 0.19, 0, sz * 0.19, 0.05, 0.45, 0.05, c, { tex, solid: false });
    this.fbox(f, 0, 0.5, -0.2, 0.45, 0.5, 0.05, c, { tex });
  }
  bed(f: Frame, frame: string, sheet: string) {
    this.fbox(f, 0, 0, 0, 1.6, 0.35, 2.1, frame, { tex: 'wood' });
    this.fbox(f, 0, 0.35, 0.05, 1.5, 0.22, 2.0, '#f8fafc', { tex: 'fabric' });
    this.fbox(f, 0, 0.57, 0.35, 1.52, 0.06, 1.4, sheet, { tex: 'fabric', decor: true, solid: false });
    this.fbox(f, 0, 0.57, -0.7, 1.2, 0.15, 0.4, '#ffffff', { tex: 'fabric', solid: false });
    this.fbox(f, 0, 0, -1.05, 1.6, 1.1, 0.1, frame, { tex: 'wood' });
  }
  bookshelf(f: Frame, w: number, h: number, c: string, shelves = 4) {
    const d = 0.4;
    this.fbox(f, -w / 2 + 0.04, 0, 0, 0.08, h, d, c, { tex: 'wood' });
    this.fbox(f, w / 2 - 0.04, 0, 0, 0.08, h, d, c, { tex: 'wood' });
    this.fbox(f, 0, 0, -d / 2 + 0.02, w, h, 0.04, c, { tex: 'wood' });
    const gap = h / shelves;
    for (let i = 0; i <= shelves; i++) this.fbox(f, 0, Math.min(i * gap, h - 0.04), 0, w, 0.04, d, c, { tex: 'wood' });
    for (let i = 0; i < shelves; i++) {
      let x = -w / 2 + 0.1;
      while (x < w / 2 - 0.15) {
        const bw = 0.05 + this.rand() * 0.07;
        if (this.rand() < 0.12) { x += 0.25; continue; }
        const bh = gap * (0.55 + this.rand() * 0.3);
        this.fbox(f, x + bw / 2, i * gap + 0.04, 0.02, bw, bh, d * 0.75, this.pick(BOOK_COLORS), { decor: true, solid: false });
        x += bw + 0.005;
      }
    }
  }
  plant(f: Frame, lx: number, lz: number, size = 1) {
    this.fcyl(f, lx, 0, lz, 0.45 * size, 0.45 * size, this.pick(['#c2410c', '#e5e7eb', '#1e3a8a', '#a16207']));
    this.fsphere(f, lx, 0.4 * size, lz, 0.9 * size, this.pick(['#16a34a', '#15803d', '#4d7c0f']), { tex: 'noise', decor: true });
    this.fsphere(f, lx + 0.15 * size, 0.85 * size, lz, 0.6 * size, '#22c55e', { tex: 'noise', solid: false });
  }
  lamp(f: Frame, lx: number, lz: number, id: string, shade: string, y = 0, lightColor = '#ffd9a0') {
    this.fcyl(f, lx, y, lz, 0.35, 0.05, '#374151', { tex: 'metal' });
    this.fcyl(f, lx, y + 0.05, lz, 0.05, 1.35, '#374151', { tex: 'metal', solid: false });
    this.fcyl(f, lx, y + 1.35, lz, 0.5, 0.35, shade, { group: id, glow: true, solid: false });
    const [x, z] = this.tp(f, lx, lz);
    this.light([x, y + 1.6, z], lightColor, 7, 10, id);
    this.interact({ id, kind: 'lamp', label: 'Lamp', p: [x, y + 1, z], defaultActive: true });
  }
  crate(x: number, y: number, z: number, s: number, c = '#b45309') {
    this.box(x, y, z, s, s, s, c, { tex: 'plank', ts: 0.6, decor: true });
  }
  barrel(x: number, y: number, z: number, c: string) {
    this.cyl(x, y, z, 0.7, 1.0, c, { tex: 'metal', decor: true });
  }
  tree(x: number, z: number, s = 1) {
    this.cyl(x, 0, z, 0.4 * s, 2.2 * s, '#92400e', { tex: 'wood' });
    this.sphere(x, 1.7 * s, z, 2.2 * s, '#16a34a', { tex: 'noise', decor: true, solid: false });
    this.sphere(x + 0.5 * s, 2.4 * s, z - 0.3 * s, 1.5 * s, '#22c55e', { tex: 'noise', solid: false });
  }
  /** Straight staircase from (x,z) rising toward +lz in frame. */
  stairs(f: Frame, w: number, steps: number, rise: number, run: number, c: string, tex: TexId = 'wood') {
    for (let i = 0; i < steps; i++) this.fbox(f, 0, 0, i * run + run / 2, w, (i + 1) * rise, run, c, { tex });
  }
}

export const BOOK_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#f97316', '#0ea5e9', '#e11d48', '#14b8a6', '#78350f', '#1e293b'];
export const PRODUCT_COLORS = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#ffffff', '#0ea5e9', '#84cc16', '#f43f5e', '#78350f'];
export const TOY_COLORS = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#06b6d4'];
