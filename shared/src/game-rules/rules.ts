// Pure rule helpers: team balancing, validation, colour maths.
import type { ModeId, PaintOp, PatternId, RegionId } from '../types';
import { NAME_MAX, NAME_MIN, PAINT_MAX_POINTS, PATTERN_IDS, REGION_IDS, BRUSH_SIZES } from '../constants';

/** How many seekers for n players in a mode. */
export function seekerCount(n: number, mode: ModeId): number {
  if (mode === 'everyone') return 0;
  if (n <= 2) return 1;
  if (mode === 'infection') return n >= 7 ? 2 : 1;
  return n >= 6 ? 2 : 1;
}

/**
 * Pick seekers fairly: players who have been seeker the fewest times go first, ties random.
 */
export function pickSeekers(ids: string[], count: number, seekerHistory: Record<string, number>, rand = Math.random): string[] {
  const shuffled = ids.map((id) => ({ id, k: (seekerHistory[id] ?? 0) + rand() * 0.9 }));
  shuffled.sort((a, b) => a.k - b.k);
  return shuffled.slice(0, count).map((s) => s.id);
}

/** Split into two balanced sides for team battle. */
export function splitSides(ids: string[], rand = Math.random): { red: string[]; blue: string[] } {
  const s = [...ids];
  for (let i = s.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [s[i], s[j]] = [s[j], s[i]];
  }
  const half = Math.ceil(s.length / 2);
  return { red: s.slice(0, half), blue: s.slice(half) };
}

// ---------- Names / moderation ----------
const BLOCKED = [
  'fuck', 'shit', 'bitch', 'cunt', 'dick', 'cock', 'pussy', 'nigg', 'fag', 'retard', 'whore', 'slut', 'rape',
  'nazi', 'hitler', 'porn', 'sex', 'penis', 'vagina', 'asshole', 'bastard', 'kkk', 'admin', 'moderator',
];
const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's', '!': 'i' };

export function isProfane(text: string): boolean {
  const norm = text.toLowerCase().replace(/[013457@$!]/g, (c) => LEET[c] ?? c).replace(/[^a-z]/g, '');
  return BLOCKED.some((w) => norm.includes(w));
}

/** Returns a cleaned display name or an error string. */
export function validateName(raw: unknown): { ok: true; name: string } | { ok: false; error: string } {
  if (typeof raw !== 'string') return { ok: false, error: 'Name required' };
  const name = raw.normalize('NFKC').replace(/\s+/g, ' ').trim();
  if (name.length < NAME_MIN || name.length > NAME_MAX) return { ok: false, error: `Name must be ${NAME_MIN}-${NAME_MAX} characters` };
  if (!/^[\p{L}\p{N} _\-.]+$/u.test(name)) return { ok: false, error: 'Letters, numbers, spaces, _ - . only' };
  if (isProfane(name)) return { ok: false, error: 'Please choose a friendlier name' };
  return { ok: true, name };
}

export function validateUsername(raw: unknown): { ok: true; username: string } | { ok: false; error: string } {
  if (typeof raw !== 'string') return { ok: false, error: 'Username required' };
  const u = raw.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,20}$/.test(u)) return { ok: false, error: 'Username: 3-20 chars, a-z 0-9 _' };
  if (isProfane(u)) return { ok: false, error: 'Please choose a friendlier username' };
  return { ok: true, username: u };
}

// ---------- Paint validation ----------
const HEX = /^#[0-9a-f]{6}$/;
export function isHex(c: unknown): c is string {
  return typeof c === 'string' && HEX.test(c);
}

export function sanitizePaintOp(raw: unknown): PaintOp | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const g = Number(o.g);
  if (!Number.isInteger(g) || g < 0 || g > 1e9) return null;
  if (o.t === 'x') return { t: 'x', g };
  const c = typeof o.c === 'string' ? o.c.toLowerCase() : '';
  if (!isHex(c)) return null;
  const pat = o.pat as PatternId;
  if (!PATTERN_IDS.includes(pat)) return null;
  if (o.t === 'f') {
    const r = o.r as RegionId | 'all';
    if (r !== 'all' && !REGION_IDS.includes(r)) return null;
    return { t: 'f', g, r, c, pat };
  }
  if (o.t === 's') {
    const r = o.r as RegionId;
    if (!REGION_IDS.includes(r)) return null;
    const sz = Number(o.sz);
    if (!BRUSH_SIZES.includes(sz)) return null;
    if (!Array.isArray(o.pts) || o.pts.length < 2 || o.pts.length > PAINT_MAX_POINTS * 2 || o.pts.length % 2) return null;
    const pts: number[] = [];
    for (const v of o.pts) {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 0 || n > 1023) return null;
      pts.push(n);
    }
    return { t: 's', g, r, c, sz, pat, pts };
  }
  return null;
}

// ---------- Colour helpers ----------
export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}
export function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, max ? d / max : 0, max];
}
export function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}
export function shadeHex(hex: string, f: number): string {
  const [r, g, b] = hexToRgb(hex);
  return f >= 0 ? rgbToHex(r + (255 - r) * f, g + (255 - g) * f, b + (255 - b) * f) : rgbToHex(r * (1 + f), g * (1 + f), b * (1 + f));
}

/** Small seeded PRNG. */
export function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
