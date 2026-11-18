import { MapBuilder, PRODUCT_COLORS } from './builder';
import type { MapDef } from './types';

export function buildSupermarket(): MapDef {
  const b = new MapBuilder(202);
  const H = 4;

  b.floorRect(-18, -14, 18, 14, '#eef2f7', 'tile', 1);
  b.floorRect(8, -14, 18, -4, '#9ca3af', 'concrete', 2); // stockroom
  b.floorRect(-18, 7, 8, 14, '#cbd5e1', 'checker', 1); // checkout zone

  b.wall(-18, -14, 18, -14, H, '#e0f2fe', { tex: 'noise', ts: 2 });
  b.wall(-18, 14, 18, 14, H, '#e0f2fe', { tex: 'noise', ts: 2, gaps: [{ at: 14, w: 8, h: 3 }] });
  b.wall(-18, -14, -18, 14, H, '#e0f2fe', { tex: 'noise', ts: 2 });
  b.wall(18, -14, 18, 14, H, '#e0f2fe', { tex: 'noise', ts: 2 });
  // Stockroom walls
  b.wall(8, -14, 8, -4, H, '#a8a29e', { tex: 'brick', ts: 1, gaps: [{ at: 2, w: 1.6, h: 2.4 }] });
  b.wall(8, -4, 18, -4, H, '#a8a29e', { tex: 'brick', ts: 1, gaps: [{ at: 4, w: 1.6, h: 2.4 }] });
  b.box(12.8, 0, -4, 1.6, 2.4, 0.08, '#475569', { tex: 'metal', group: 'door_stock' });
  b.interact({ id: 'door_stock', kind: 'door', label: 'Stockroom Door', p: [12.8, 1, -4], defaultActive: false, hinge: [12, -4], openAngle: -Math.PI / 2 });

  // ---------- Aisles ----------
  const shelf = (x: number, z1: number, z2: number, frame: string) => {
    const len = z2 - z1, zc = (z1 + z2) / 2, D = 1.8;
    b.box(x, 0, zc, 0.08, 2.3, len, frame, { tex: 'metal' });
    for (const y of [0, 0.95, 1.75]) b.box(x, y, zc, D, y === 0 ? 0.1 : 0.05, len, frame, { tex: 'metal' });
    b.box(x, 2.25, zc, D, 0.05, len, frame, { tex: 'metal' });
    b.box(x, 0, z1, D, 2.3, 0.06, frame, { tex: 'metal' });
    b.box(x, 0, z2, D, 2.3, 0.06, frame, { tex: 'metal' });
    for (const side of [-1, 1]) {
      for (const [y0, maxH] of [[0.1, 0.75], [1.0, 0.7], [1.8, 0.4]] as const) {
        let z = z1 + 0.1;
        while (z < z2 - 0.4) {
          if (b.rand() < 0.16 && y0 < 1.5) { z += 1.2 + b.rand() * 0.6; continue; } // empty gap = hiding spot
          const run = 1 + Math.floor(b.rand() * 4);
          const c = b.pick(PRODUCT_COLORS);
          const h = Math.min(maxH, 0.22 + b.rand() * 0.4);
          for (let i = 0; i < run && z < z2 - 0.4; i++) {
            b.box(x + side * 0.45, y0, z + 0.18, 0.62, h, 0.34, c, { decor: true, tex: b.rand() < 0.3 ? 'stripes' : 'none', ts: 0.3 });
            z += 0.38;
          }
        }
      }
    }
    b.box(x, 2.9, zc, 0.06, 0.6, 2.4, b.pick(['#ef4444', '#2563eb', '#16a34a', '#f59e0b']), { solid: false, glow: true });
  };
  shelf(-12, -7, 5, '#94a3b8');
  shelf(-7, -7, 5, '#60a5fa');
  shelf(-2, -7, 5, '#f472b6');
  shelf(3, -7, 5, '#a3e635');

  // ---------- Fridges ----------
  for (let x = -16; x <= 5; x += 2.1) {
    b.box(x, 0, -13.35, 2, 2.4, 1.0, '#f8fafc', { tex: 'metal' });
    b.box(x, 0.2, -12.83, 1.8, 2.0, 0.04, '#bae6fd', { glow: true, solid: false });
    for (let y = 0.3; y < 2; y += 0.55)
      for (let k = -0.6; k <= 0.6; k += 0.4) b.box(x + k, y, -13.0, 0.3, 0.35, 0.3, b.pick(PRODUCT_COLORS), { solid: false, decor: true });
  }
  // Freezer islands
  for (const x of [-10, -4.5, 1]) {
    b.box(x, 0, -10, 4, 0.9, 1.4, '#e2e8f0', { tex: 'metal' });
    b.box(x, 0.9, -10, 3.8, 0.04, 1.2, '#7dd3fc', { glow: true, solid: false });
  }

  // ---------- Bakery along west wall ----------
  b.box(-17.2, 0, -2, 1.2, 1.0, 9, '#fef3c7', { tex: 'wood' });
  b.box(-17.2, 1.0, -2, 1.25, 0.06, 9.05, '#78350f', { tex: 'wood' });
  for (let z = -6; z <= 2; z += 0.55) b.sphere(-17.2 + (b.rand() - 0.5) * 0.4, 1.06, z, 0.38, b.pick(['#b45309', '#d97706', '#92400e', '#fbbf24']), { solid: false, decor: true }, [0.5, 0.3, 0.38]);
  b.box(-17.8, 1.8, -2, 0.1, 0.8, 4, '#f97316', { solid: false, glow: true });

  // ---------- Checkouts ----------
  for (const x of [-12, -7, -2]) {
    b.box(x, 0, 9.5, 0.9, 0.9, 3, '#334155', { tex: 'metal' });
    b.box(x, 0.9, 9.0, 0.7, 0.03, 2, '#111827', { tex: 'stripes', ts: 0.2, solid: false });
    b.box(x, 0.9, 10.6, 0.5, 0.35, 0.4, '#e5e7eb', { tex: 'metal' });
    b.box(x + 1.0, 0, 10.4, 0.6, 0.8, 0.6, '#475569'); // bagging
    b.cyl(x, 0.9, 7.9, 0.08, 1.6, '#e5e7eb', { solid: false });
    b.box(x, 2.5, 7.9, 0.5, 0.35, 0.08, '#22c55e', { glow: true, solid: false });
  }
  b.interact({ id: 'intercom', kind: 'sound', label: 'Intercom', p: [-2, 1, 10.6], defaultActive: false, sound: 'chime' });
  b.box(-15.5, 0, 11, 2.5, 1.0, 0.8, '#f59e0b', { tex: 'wood' }); // service desk
  b.box(-15.5, 1.0, 11, 2.55, 0.05, 0.85, '#1e293b');

  // ---------- Carts ----------
  for (let i = 0; i < 6; i++) {
    const x = 9 + (i % 3) * 1.4, z = 12.6 - Math.floor(i / 3) * 1.5;
    b.box(x, 0.4, z, 0.6, 0.5, 0.9, '#cbd5e1', { tex: 'checker', ts: 0.12 });
    b.box(x, 0.05, z, 0.5, 0.06, 0.8, '#64748b', { solid: false });
    b.cyl(x, 0.05, z + 0.5, 0.05, 1.1, '#ef4444', { solid: false });
  }
  b.box(-0.5, 0, 6.2, 1.4, 0.03, 0.9, '#fbbf24', { tex: 'stripes', solid: false }); // wet floor sign area
  b.cone(-0.5, 0, 6.2, 0.4, 0.6, '#facc15', { solid: false });

  // ---------- Produce ----------
  for (let i = 0; i < 8; i++) {
    const x = 10 + (i % 4) * 2, z = -1 + Math.floor(i / 4) * 3.2;
    b.box(x, 0, z, 1.4, 0.75, 1.1, '#a16207', { tex: 'plank', ts: 0.5 });
    const fc = b.pick(['#ef4444', '#f97316', '#facc15', '#84cc16', '#22c55e', '#a855f7']);
    for (let k = 0; k < 10; k++) b.sphere(x - 0.5 + (k % 5) * 0.25, 0.75, z - 0.25 + Math.floor(k / 5) * 0.4, 0.22, fc, { solid: false, decor: true });
  }
  b.plant({ x: 0, z: 0, r: 0 }, 16.8, 6.5, 1.3);
  b.plant({ x: 0, z: 0, r: 0 }, 16.8, -2.5, 1.2);
  b.box(17.5, 1.5, 2.5, 0.06, 1.2, 4, '#84cc16', { solid: false, glow: true });

  // ---------- Stockroom ----------
  for (const [x, z] of [[10, -12.5], [12.5, -12.5], [15, -12.5], [16.6, -9], [11.5, -6]] as const) {
    b.box(x, 0, z, 1.4, 0.15, 1.2, '#a16207', { tex: 'plank', ts: 0.4 });
    const levels = 1 + Math.floor(b.rand() * 3);
    for (let l = 0; l < levels; l++) {
      b.crate(x - 0.33, 0.15 + l * 0.62, z - 0.27, 0.6, '#c8a26b');
      if (b.rand() < 0.7) b.crate(x + 0.33, 0.15 + l * 0.62, z + 0.27, 0.6, '#d6b583');
    }
  }
  // metal racking
  b.box(13, 0, -8.6, 4, 0.08, 1.0, '#64748b', { tex: 'metal' });
  b.box(13, 1.2, -8.6, 4, 0.08, 1.0, '#64748b', { tex: 'metal' });
  b.box(13, 2.4, -8.6, 4, 0.08, 1.0, '#64748b', { tex: 'metal' });
  for (const x of [11.05, 14.95]) b.box(x, 0, -8.6, 0.1, 2.5, 1.0, '#475569', { tex: 'metal' });
  for (let x = 11.6; x < 14.6; x += 0.9) b.crate(x, 1.28, -8.6, 0.7, b.pick(['#c8a26b', '#a16207', '#fde68a']));
  b.cyl(16.8, 0, -6, 0.7, 1, '#2563eb', { tex: 'metal', decor: true });
  b.cyl(16.8, 0, -5, 0.7, 1, '#2563eb', { tex: 'metal', decor: true });
  b.box(9.3, 0, -8.4, 1.0, 1.3, 1.8, '#f59e0b', { tex: 'metal' }); // pallet jack/forklift body
  b.box(9.3, 1.3, -8.8, 0.8, 0.9, 0.08, '#111827', { solid: false });
  b.box(13, 3.6, -9, 0.6, 0.1, 0.6, '#fef9c3', { glow: true, solid: false, group: 'lamp_stock' });
  b.light([13, 3.3, -9], '#fff3c4', 9, 12, 'lamp_stock');
  b.interact({ id: 'lamp_stock', kind: 'lamp', label: 'Light Switch', p: [8.6, 1.2, -6], defaultActive: true });
  b.box(8.2, 1.1, -6, 0.1, 0.25, 0.15, '#f8fafc', { solid: false });

  return {
    id: 'supermarket',
    bounds: { minX: -18, maxX: 18, minZ: -14, maxZ: 14 },
    floor: { c: '#eef2f7', tex: 'tile' },
    sky: '#cdeffd',
    fog: '#e0f7ff',
    ambient: 0.6,
    hemi: ['#ffffff', '#93c5fd', 0.6],
    sun: { c: '#ffffff', i: 1.4, dir: [0.4, -1, -0.3] },
    hiderSpawns: [[-14.5, 0, 6.5], [-9.5, 0, 6.5], [-4.5, 0, 6.5], [0.8, 0, 6.5], [5.5, 0, 6.5], [-9.5, 0, 12.5], [-4.5, 0, 12.5], [0.5, 0, 12.5]],
    seekerSpawns: [[15, 0, 10], [15, 0, 12.4], [16.6, 0, 10], [16.6, 0, 12.4]],
    props: b.props,
    interactables: b.interactables,
    lights: b.lights,
  };
}
