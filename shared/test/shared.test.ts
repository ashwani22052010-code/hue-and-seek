import { describe, expect, it } from 'vitest';
import { buildWorld, stepCharacter, isEmbedded, hasLineOfSight, type MoveState } from '../src/game-rules/physics';
import { getMapSync } from '../src/maps/all';
import { buildMapWorld } from '../src/maps';
import { MAP_IDS, SHAPES } from '../src/constants';
import { levelFromXp, xpForLevel, dailyMissionsFor } from '../src/game-rules/progression';
import { sanitizePaintOp, validateName, pickSeekers, seekerCount } from '../src/game-rules/rules';

const bounds = { minX: -10, maxX: 10, minZ: -10, maxZ: 10 };
const opts = { radius: 0.36, height: 1.05, speed: 4.6 };
const sim = (st: MoveState, w: ReturnType<typeof buildWorld>, input: { x: number; z: number; jump?: boolean }, secs: number) => {
  for (let t = 0; t < secs; t += 1 / 60) stepCharacter(w, st, { x: input.x, z: input.z, jump: !!input.jump, sprint: false }, 1 / 60, opts);
};

describe('physics', () => {
  it('falls to the floor and stays grounded', () => {
    const w = buildWorld([], bounds);
    const st: MoveState = { p: [0, 3, 0], v: [0, 0, 0], grounded: false };
    sim(st, w, { x: 0, z: 0 }, 2);
    expect(st.p[1]).toBe(0);
    expect(st.grounded).toBe(true);
  });
  it('is blocked by a wall', () => {
    const w = buildWorld([{ min: [2, 0, -5], max: [2.5, 3, 5] }], bounds);
    const st: MoveState = { p: [0, 0, 0], v: [0, 0, 0], grounded: true };
    sim(st, w, { x: 1, z: 0 }, 2);
    expect(st.p[0]).toBeLessThan(2 - 0.35);
    expect(st.p[0]).toBeGreaterThan(1.5);
  });
  it('steps up small ledges and can jump onto a table', () => {
    const w = buildWorld([{ min: [2, 0, -5], max: [4, 0.3, 5] }, { min: [6, 0, -5], max: [8, 0.9, 5] }], bounds);
    const st: MoveState = { p: [0, 0, 0], v: [0, 0, 0], grounded: true };
    sim(st, w, { x: 1, z: 0 }, 0.8);
    expect(st.p[1]).toBeCloseTo(0.3, 1);
    st.p = [5.2, 0, 0];
    sim(st, w, { x: 1, z: 0, jump: true }, 1 / 60);
    sim(st, w, { x: 1, z: 0 }, 0.45);
    sim(st, w, { x: 0, z: 0 }, 0.8);
    expect(st.p[1]).toBeCloseTo(0.9, 1);
  });
  it('line of sight is blocked by walls', () => {
    const w = buildWorld([{ min: [2, 0, -5], max: [2.5, 3, 5] }], bounds);
    expect(hasLineOfSight(w, [0, 1, 0], [5, 1, 0])).toBe(false);
    expect(hasLineOfSight(w, [0, 1, 0], [1.8, 1, 0])).toBe(true);
  });
});

describe('maps', () => {
  for (const id of MAP_IDS) {
    it(`${id}: spawns are free and inside bounds`, () => {
      const def = getMapSync(id);
      const world = buildMapWorld(def);
      expect(def.props.length).toBeGreaterThan(40);
      for (const sp of [...def.hiderSpawns, ...def.seekerSpawns]) {
        expect(isEmbedded(world, sp, SHAPES.wide.radius, SHAPES.tall.height)).toBe(false);
        expect(sp[0]).toBeGreaterThan(def.bounds.minX);
        expect(sp[2]).toBeLessThan(def.bounds.maxZ);
      }
      // a character dropped at each spawn should be able to walk a bit
      for (const sp of def.hiderSpawns) {
        const st: MoveState = { p: [...sp], v: [0, 0, 0], grounded: true };
        stepCharacter(world, st, { x: 0, z: 0, jump: false, sprint: false }, 0.05, opts);
        expect(st.p[1]).toBeLessThan(0.5);
      }
      expect(def.interactables.length).toBeGreaterThan(0);
    });
  }
});

describe('rules', () => {
  it('levels', () => {
    expect(levelFromXp(0).level).toBe(1);
    expect(levelFromXp(xpForLevel(1)).level).toBe(2);
  });
  it('missions are deterministic and distinct', () => {
    const a = dailyMissionsFor('p1', '2026-01-01');
    expect(a).toEqual(dailyMissionsFor('p1', '2026-01-01'));
    expect(new Set(a.map((m) => m.kind)).size).toBe(3);
  });
  it('sanitizes paint ops', () => {
    expect(sanitizePaintOp({ t: 's', g: 1, r: 'body', c: '#FFAA00', sz: 22, pat: 'solid', pts: [1, 2, 3, 4] })).toBeTruthy();
    expect(sanitizePaintOp({ t: 's', g: 1, r: 'body', c: 'red', sz: 22, pat: 'solid', pts: [1, 2] })).toBeNull();
    expect(sanitizePaintOp({ t: 's', g: 1, r: 'head', c: '#ffaa00', sz: 22, pat: 'solid', pts: [1, 2] })).toBeNull();
    expect(sanitizePaintOp({ t: 'f', g: 1, r: 'all', c: '#ffaa00', pat: 'wood' })).toBeTruthy();
  });
  it('validates names', () => {
    expect(validateName('Bob').ok).toBe(true);
    expect(validateName('ab').ok).toBe(false);
    expect(validateName('sh1t head').ok).toBe(false);
    expect(validateName('<script>').ok).toBe(false);
  });
  it('balances teams fairly', () => {
    expect(seekerCount(2, 'classic')).toBe(1);
    expect(seekerCount(8, 'classic')).toBe(2);
    const s = pickSeekers(['a', 'b', 'c'], 1, { a: 3, b: 0, c: 3 });
    expect(s).toEqual(['b']);
  });
});
