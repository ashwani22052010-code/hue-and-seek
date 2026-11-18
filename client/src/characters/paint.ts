// Per-player paint atlas. Ops are replayed deterministically on every client (same as the server log).
import * as THREE from 'three';
import type { PaintMsg, PaintOp, PatternId, RegionId } from '@shared/types';
import { PAINT_ATLAS_SIZE, REGIONS } from '@shared/constants';
import { colorTile } from '../maps/textures';

export const PATTERN_SCALE = 1.75;
const S = PAINT_ATLAS_SIZE;

function regionPx(r: RegionId) {
  const [u0, v0, u1, v1] = REGIONS[r].rect;
  return { x: u0 * S, y: (1 - v1) * S, w: (u1 - u0) * S, h: (v1 - v0) * S };
}

export class PaintCanvas {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
  ops: PaintOp[] = [];
  redo: PaintOp[][] = [];
  version = 0;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = S;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
    this.clearCanvas();
  }

  private clearCanvas() {
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, S, S);
  }

  private style(c: string, pat: PatternId): string | CanvasPattern {
    if (pat === 'solid') return c;
    const p = this.ctx.createPattern(colorTile(pat, c), 'repeat')!;
    p.setTransform(new DOMMatrix().scale(PATTERN_SCALE));
    return p;
  }

  private draw(op: PaintOp) {
    const ctx = this.ctx;
    if (op.t === 'x') return this.clearCanvas();
    if (op.t === 'f') {
      ctx.fillStyle = this.style(op.c, op.pat);
      if (op.r === 'all') ctx.fillRect(0, 0, S, S);
      else {
        const r = regionPx(op.r);
        ctx.fillRect(r.x, r.y, r.w, r.h);
      }
      return;
    }
    // stroke, clipped to its region
    const r = regionPx(op.r);
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, r.h);
    ctx.clip();
    ctx.fillStyle = this.style(op.c, op.pat);
    const rad = op.sz / 2;
    const spacing = Math.max(1.5, rad * 0.35);
    let px = -1, py = -1;
    ctx.beginPath();
    for (let i = 0; i < op.pts.length; i += 2) {
      const x = (op.pts[i] / 1023) * S;
      const y = (1 - op.pts[i + 1] / 1023) * S;
      if (px < 0) {
        ctx.moveTo(x + rad, y);
        ctx.arc(x, y, rad, 0, Math.PI * 2);
      } else {
        const d = Math.hypot(x - px, y - py);
        // big jumps (e.g. across the atlas seam) are not interpolated
        const steps = d > S * 0.4 ? 1 : Math.max(1, Math.ceil(d / spacing));
        for (let k = 1; k <= steps; k++) {
          const ix = px + ((x - px) * k) / steps, iy = py + ((y - py) * k) / steps;
          ctx.moveTo(ix + rad, iy);
          ctx.arc(ix, iy, rad, 0, Math.PI * 2);
        }
      }
      px = x;
      py = y;
    }
    ctx.fill();
    // wrap strokes around the horizontal seam of the body/limb so the paint looks continuous
    ctx.restore();
  }

  private touched() {
    this.texture.needsUpdate = true;
    this.version++;
  }

  rebuild() {
    this.clearCanvas();
    for (const op of this.ops) this.draw(op);
    this.touched();
  }

  apply(msg: PaintMsg) {
    if (msg.k === 'op') {
      this.ops.push(msg.op);
      this.redo = [];
      this.draw(msg.op);
      this.touched();
    } else if (msg.k === 'undo') {
      if (!this.ops.length) return;
      const g = this.ops[this.ops.length - 1].g;
      const group: PaintOp[] = [];
      while (this.ops.length && this.ops[this.ops.length - 1].g === g) group.unshift(this.ops.pop()!);
      this.redo.push(group);
      this.rebuild();
    } else if (msg.k === 'redo') {
      const group = this.redo.pop();
      if (!group) return;
      this.ops.push(...group);
      for (const op of group) this.draw(op);
      this.touched();
    } else if (msg.k === 'replace') {
      this.ops = [...msg.ops];
      this.redo = [];
      this.rebuild();
    }
  }

  reset() {
    this.ops = [];
    this.redo = [];
    this.rebuild();
  }

  sample(u: number, v: number): string {
    const x = Math.min(S - 1, Math.max(0, Math.floor(u * S)));
    const y = Math.min(S - 1, Math.max(0, Math.floor((1 - v) * S)));
    const d = this.ctx.getImageData(x, y, 1, 1).data;
    return '#' + [d[0], d[1], d[2]].map((n) => n.toString(16).padStart(2, '0')).join('');
  }

  get canUndo() { return this.ops.length > 0; }
  get canRedo() { return this.redo.length > 0; }
}

const canvases = new Map<string, PaintCanvas>();
export function paintFor(playerId: string): PaintCanvas {
  let p = canvases.get(playerId);
  if (!p) canvases.set(playerId, (p = new PaintCanvas()));
  return p;
}
export function resetAllPaint(paints: Record<string, PaintOp[]>) {
  for (const [id, c] of canvases) {
    if (paints[id]) c.apply({ k: 'replace', ops: paints[id] });
    else c.reset();
  }
  for (const [id, ops] of Object.entries(paints)) if (!canvases.has(id)) paintFor(id).apply({ k: 'replace', ops });
}

// ---------- Quick Disguise presets (saved locally per device) ----------
const PRESET_KEY = 'hue.presets';
export function loadPreset(): PaintOp[] | null {
  try {
    const raw = localStorage.getItem(PRESET_KEY);
    return raw ? (JSON.parse(raw) as PaintOp[]) : null;
  } catch {
    return null;
  }
}
export function savePreset(ops: PaintOp[]) {
  try { localStorage.setItem(PRESET_KEY, JSON.stringify(ops)); } catch { /* ignore */ }
}
