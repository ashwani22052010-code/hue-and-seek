// Procedural, tileable grayscale textures. The SAME generators drive environment surfaces and the
// paint patterns, so a hider who samples a wooden floor and picks the Wood pattern matches it exactly.
import * as THREE from 'three';
import type { PatternId, TexId } from '@shared/types';
import { mulberry32 } from '@shared/game-rules/rules';

export const TILE = 128;
type GenId = Exclude<TexId, 'none'> | PatternId;

const grayCache = new Map<string, HTMLCanvasElement>();

function canvas(size = TILE) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

function fillGray(ctx: CanvasRenderingContext2D, v: number) {
  const g = Math.round(v * 255);
  ctx.fillStyle = `rgb(${g},${g},${g})`;
}

/** Wrap-around drawing helper so shapes tile seamlessly. */
function wrapped(draw: (ox: number, oy: number) => void) {
  for (const ox of [-TILE, 0, TILE]) for (const oy of [-TILE, 0, TILE]) draw(ox, oy);
}

function pixelNoise(ctx: CanvasRenderingContext2D, lo: number, hi: number, seed: number, streak: 'none' | 'h' | 'v' = 'none') {
  const img = ctx.getImageData(0, 0, TILE, TILE);
  const r = mulberry32(seed);
  const rowVals = Array.from({ length: TILE }, () => r());
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      let n = r();
      if (streak === 'h') n = n * 0.35 + rowVals[y] * 0.65;
      if (streak === 'v') n = n * 0.35 + rowVals[x] * 0.65;
      const base = img.data[(y * TILE + x) * 4] / 255;
      const v = Math.round(base * (lo + (hi - lo) * n) * 255);
      const i = (y * TILE + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    }
  ctx.putImageData(img, 0, 0);
}

export function grayTile(id: GenId): HTMLCanvasElement {
  const cached = grayCache.get(id);
  if (cached) return cached;
  const c = canvas();
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  const r = mulberry32(id.length * 977 + id.charCodeAt(0) * 31);
  fillGray(ctx, 1);
  ctx.fillRect(0, 0, TILE, TILE);
  switch (id) {
    case 'solid':
      break;
    case 'stripes':
      fillGray(ctx, 0.74);
      for (let y = 0; y < TILE; y += 32) ctx.fillRect(0, y, TILE, 16);
      break;
    case 'dots':
      fillGray(ctx, 0.66);
      for (let y = 0; y < 4; y++)
        for (let x = 0; x < 4; x++) {
          ctx.beginPath();
          ctx.arc(x * 32 + (y % 2 ? 16 : 0) + 8, y * 32 + 16, 7, 0, Math.PI * 2);
          ctx.fill();
          if (y % 2) { ctx.beginPath(); ctx.arc(x * 32 + 16 + 8 - TILE, y * 32 + 16, 7, 0, Math.PI * 2); ctx.fill(); }
        }
      break;
    case 'camo':
      for (const shade of [0.8, 0.62, 0.9]) {
        fillGray(ctx, shade);
        for (let i = 0; i < 9; i++) {
          const x = r() * TILE, y = r() * TILE, rx = 10 + r() * 18, ry = 7 + r() * 13, rot = r() * Math.PI;
          wrapped((ox, oy) => { ctx.beginPath(); ctx.ellipse(x + ox, y + oy, rx, ry, rot, 0, Math.PI * 2); ctx.fill(); });
        }
      }
      break;
    case 'wood':
    case 'plank': {
      const img = ctx.getImageData(0, 0, TILE, TILE);
      const phase = Array.from({ length: 6 }, () => r() * Math.PI * 2);
      for (let y = 0; y < TILE; y++)
        for (let x = 0; x < TILE; x++) {
          const t = (y / TILE) * Math.PI * 2;
          const wobble = Math.sin((x / TILE) * Math.PI * 2 + phase[0]) * 0.6 + Math.sin((x / TILE) * Math.PI * 4 + phase[1]) * 0.3;
          const grain = Math.sin(t * 9 + wobble * 2.2 + phase[2]) * 0.5 + 0.5;
          let v = 0.8 + grain * 0.14 + (r() - 0.5) * 0.05;
          if (id === 'plank' && (y % 32 < 2)) v = 0.58;
          if (id === 'plank' && x % 64 < 2 && Math.floor(y / 32) % 2 === 0) v = 0.6;
          if (id === 'plank' && (x + 32) % 64 < 2 && Math.floor(y / 32) % 2 === 1) v = 0.6;
          const i = (y * TILE + x) * 4;
          img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.round(Math.min(1, v) * 255);
        }
      ctx.putImageData(img, 0, 0);
      break;
    }
    case 'stone': {
      for (let i = 0; i < 26; i++) {
        fillGray(ctx, 0.72 + r() * 0.24);
        const x = r() * TILE, y = r() * TILE, s = 12 + r() * 22;
        wrapped((ox, oy) => { ctx.beginPath(); ctx.ellipse(x + ox, y + oy, s, s * (0.6 + r() * 0.3), r() * 3, 0, Math.PI * 2); ctx.fill(); });
      }
      pixelNoise(ctx, 0.88, 1, 7);
      break;
    }
    case 'metal':
      pixelNoise(ctx, 0.82, 0.98, 11, 'h');
      fillGray(ctx, 0.62);
      for (const [x, y] of [[8, 8], [72, 8], [8, 72], [72, 72]]) { ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill(); }
      break;
    case 'fabric': {
      const img = ctx.getImageData(0, 0, TILE, TILE);
      for (let y = 0; y < TILE; y++)
        for (let x = 0; x < TILE; x++) {
          const w = ((Math.floor(x / 4) + Math.floor(y / 4)) % 2 ? 0.86 : 0.97) - ((x % 4 === 0 || y % 4 === 0) ? 0.06 : 0);
          const i = (y * TILE + x) * 4;
          img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.round((w + (r() - 0.5) * 0.04) * 255);
        }
      ctx.putImageData(img, 0, 0);
      break;
    }
    case 'carpet':
      pixelNoise(ctx, 0.8, 1, 13);
      break;
    case 'brick':
      fillGray(ctx, 0.62);
      ctx.fillRect(0, 0, TILE, TILE);
      for (let row = 0; row < 4; row++)
        for (let col = -1; col < 3; col++) {
          fillGray(ctx, 0.84 + r() * 0.14);
          ctx.fillRect(col * 64 + (row % 2) * 32 + 2, row * 32 + 2, 60, 28);
        }
      pixelNoise(ctx, 0.9, 1, 17);
      break;
    case 'concrete':
      pixelNoise(ctx, 0.84, 1, 19);
      fillGray(ctx, 0.7);
      for (let i = 0; i < 30; i++) ctx.fillRect(r() * TILE, r() * TILE, 2, 2);
      break;
    case 'grass':
      pixelNoise(ctx, 0.72, 1, 23, 'v');
      break;
    case 'checker':
      fillGray(ctx, 0.76);
      ctx.fillRect(0, 0, 64, 64);
      ctx.fillRect(64, 64, 64, 64);
      break;
    case 'tile':
      fillGray(ctx, 0.97);
      ctx.fillRect(0, 0, TILE, TILE);
      fillGray(ctx, 0.66);
      ctx.fillRect(0, 0, TILE, 3);
      ctx.fillRect(0, 0, 3, TILE);
      ctx.fillRect(0, 64, TILE, 3);
      ctx.fillRect(64, 0, 3, TILE);
      pixelNoise(ctx, 0.94, 1, 29);
      break;
    case 'noise':
      pixelNoise(ctx, 0.86, 1, 31);
      break;
  }
  grayCache.set(id, c);
  return c;
}

/** Map an environment texture to the closest paint pattern (for the eyedropper's "match texture"). */
export const TEX_TO_PATTERN: Record<TexId, PatternId> = {
  none: 'solid', wood: 'wood', plank: 'wood', tile: 'checker', stone: 'stone', metal: 'metal', fabric: 'fabric', carpet: 'noise',
  brick: 'brick', concrete: 'noise', grass: 'noise', checker: 'checker', stripes: 'stripes', dots: 'dots', noise: 'noise', camo: 'camo',
};

const texCache = new Map<string, THREE.CanvasTexture>();
export function envTexture(id: TexId): THREE.CanvasTexture | null {
  if (id === 'none') return null;
  let t = texCache.get(id);
  if (!t) {
    t = new THREE.CanvasTexture(grayTile(id));
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    texCache.set(id, t);
  }
  return t;
}

const tmpColor = new THREE.Color();
const srgbToLinear = (c: number) => (c < 0.04045 ? c * 0.0773993808 : Math.pow(c * 0.9478672986 + 0.0521327014, 2.4));
const linearToSrgb = (c: number) => (c < 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 0.41666) - 0.055);
/** Correct (linear-space) multiply of a base colour by a gray texel, returned as sRGB hex. */
export function multiplyHex(base: string, gray255: number): string {
  tmpColor.setStyle(base);
  const lin = srgbToLinear(gray255 / 255);
  tmpColor.multiplyScalar(lin);
  return '#' + tmpColor.getHexString();
}

export function sampleGray(id: GenId, u: number, v: number): number {
  const c = grayTile(id);
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  const x = Math.floor((((u % 1) + 1) % 1) * TILE);
  const y = Math.floor((1 - (((v % 1) + 1) % 1)) * TILE) % TILE;
  return ctx.getImageData(x, y, 1, 1).data[0];
}

const colorTileCache = new Map<string, HTMLCanvasElement>();
/** A pattern tile tinted with a colour, multiplied in linear space (same maths as the renderer). */
export function colorTile(pattern: PatternId, hex: string): HTMLCanvasElement {
  const key = pattern + hex;
  const cached = colorTileCache.get(key);
  if (cached) return cached;
  const src = grayTile(pattern).getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, TILE, TILE);
  const c = canvas();
  const ctx = c.getContext('2d')!;
  const out = ctx.createImageData(TILE, TILE);
  tmpColor.setStyle(hex);
  const lr = tmpColor.r, lg = tmpColor.g, lb = tmpColor.b;
  const lut = new Float32Array(256);
  for (let i = 0; i < 256; i++) lut[i] = srgbToLinear(i / 255);
  const enc = (l: number) => Math.round(linearToSrgb(Math.min(1, l)) * 255);
  for (let i = 0; i < src.data.length; i += 4) {
    const g = lut[src.data[i]];
    out.data[i] = enc(lr * g);
    out.data[i + 1] = enc(lg * g);
    out.data[i + 2] = enc(lb * g);
    out.data[i + 3] = 255;
  }
  ctx.putImageData(out, 0, 0);
  if (colorTileCache.size > 300) colorTileCache.clear();
  colorTileCache.set(key, c);
  return c;
}
