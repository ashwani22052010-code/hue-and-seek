// Runtime validation helpers for untrusted socket payloads.
import type { Vec3 } from '@shared/types';

export const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
export const isFiniteNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
export function isVec3(v: unknown, limit = 1000): v is Vec3 {
  return Array.isArray(v) && v.length === 3 && v.every((n) => isFiniteNum(n) && Math.abs(n) < limit);
}
export function str(v: unknown, max = 64): string | null {
  return typeof v === 'string' && v.length <= max ? v : null;
}
export function oneOf<T extends string>(v: unknown, list: readonly T[]): T | null {
  return typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : null;
}
