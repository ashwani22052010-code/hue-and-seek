import { MapBuilder } from './builder';
import type { MapDef } from './types';

export function buildFactory(): MapDef {
  const b = new MapBuilder(505);
  const H = 6;

  b.floorRect(-20, -16, 20, 16, '#6b7280', 'concrete', 2);
  b.box(0, 0, 0, 3, 0.03, 30, '#facc15', { tex: 'stripes', ts: 0.8, solid: false });
  b.wall(-20, -16, 20, -16, H, '#7f1d1d', { tex: 'brick', ts: 1 });
  b.wall(-20, 16, 20, 16, H, '#7f1d1d', { tex: 'brick', ts: 1 });
  b.wall(-20, -16, -20, 16, H, '#7f1d1d', { tex: 'brick', ts: 1 });
  b.wall(20, -16, 20, 16, H, '#7f1d1d', { tex: 'brick', ts: 1 });

  // ---------- Storage rooms (east) ----------
  b.wall(10, -16, 10, -2, H, '#57534e', { tex: 'concrete', ts: 1.5, gaps: [{ at: 6, w: 1.8, h: 2.6 }] });
  b.wall(10, -2, 20, -2, H, '#57534e', { tex: 'concrete', ts: 1.5, gaps: [] });
  b.wall(10, 4, 20, 4, H, '#57534e', { tex: 'concrete', ts: 1.5, gaps: [{ at: 3, w: 1.8, h: 2.6 }] });
  b.wall(10, 4, 10, 16, H, '#57534e', { tex: 'concrete', ts: 1.5, gaps: [{ at: 5, w: 1.8, h: 2.6 }] });
  b.box(13.9, 0, 4, 1.8, 2.6, 0.1, '#334155', { tex: 'metal', group: 'door_store' });
  b.interact({ id: 'door_store', kind: 'door', label: 'Storage Door', p: [13.9, 1, 4], defaultActive: false, hinge: [13, 4], openAngle: Math.PI / 2 });
  // storage A (south-east)
  for (let x = 11.5; x < 19.5; x += 1.6)
    for (const z of [-15, -13.4]) {
      const n = 1 + Math.floor(b.rand() * 3);
      for (let k = 0; k < n; k++) b.crate(x, k * 1.0, z, 1.0, b.pick(['#a16207', '#92400e', '#b45309']));
    }
  for (const z of [-8, -5]) {
    b.box(15, 0, z, 7, 0.1, 1.1, '#475569', { tex: 'metal' });
    b.box(15, 1.3, z, 7, 0.1, 1.1, '#475569', { tex: 'metal' });
    b.box(15, 2.6, z, 7, 0.1, 1.1, '#475569', { tex: 'metal' });
    for (const x of [11.55, 18.45]) b.box(x, 0, z, 0.1, 2.7, 1.1, '#334155', { tex: 'metal' });
    for (let x = 12.2; x < 18; x += 1.1) if (b.rand() < 0.7) b.box(x, 1.4, z, 0.9, 0.7, 0.9, b.pick(['#d6b583', '#c8a26b', '#78716c']), { tex: 'plank', ts: 0.5, decor: true });
    for (let x = 12.5; x < 18; x += 1.6) if (b.rand() < 0.6) b.barrel(x, 0.1, z, b.pick(['#1d4ed8', '#15803d', '#b91c1c']));
  }
  // storage B (north-east) with office
  b.box(15, 0, 14.8, 4, 0.78, 1.4, '#78716c', { tex: 'metal' }); // desk
  b.box(15, 0.78, 15, 0.9, 0.55, 0.05, '#111827', { solid: false });
  b.chair({ x: 15, z: 13.6, r: 2 }, '#1e293b', 'metal');
  for (const z of [6, 7.2, 8.4]) b.box(19.4, 0, z, 0.9, 1.4, 1.1, '#64748b', { tex: 'metal' }); // filing
  b.lamp({ x: 17.5, z: 14.6, r: 0 }, 0, 0, 'lamp_office', '#fef08a');
  for (let i = 0; i < 6; i++) b.crate(11.2 + (i % 3) * 1.1, Math.floor(i / 3) * 1.0, 10 + (i % 2) * 0.2, 1.0, '#a16207');
  b.box(13, 0, 6, 2.2, 0.15, 1.4, '#92400e', { tex: 'plank', ts: 0.4 });
  for (let k = 0; k < 4; k++) b.box(12.5 + (k % 2) * 1, 0.15 + Math.floor(k / 2) * 0.6, 6, 0.95, 0.6, 1.2, '#d6b583', { tex: 'plank', ts: 0.5, decor: true });

  // ---------- Machinery hall ----------
  const machine = (x: number, z: number, w: number, d: number, h: number, c: string) => {
    b.box(x, 0, z, w, h, d, c, { tex: 'metal', decor: true });
    b.box(x, h, z, w * 0.6, 0.5, d * 0.6, '#374151', { tex: 'metal' });
    b.cyl(x + w * 0.3, h + 0.5, z, 0.3, 1.2, '#9ca3af', { tex: 'metal', solid: false });
    b.box(x, h * 0.55, z + d / 2 + 0.01, w * 0.4, h * 0.25, 0.04, '#22c55e', { glow: true, solid: false });
  };
  machine(-14, -11, 4, 3, 2.6, '#0e7490');
  machine(-6, -11, 3, 3, 3.2, '#a16207');
  machine(-14, 1, 3, 4, 2.2, '#7c3aed');
  machine(5, 9, 3.4, 3, 2.8, '#be123c');
  // big tanks
  for (const [x, z] of [[-16, 11], [-12.5, 11]] as const) {
    b.cyl(x, 0, z, 3, 4.5, '#94a3b8', { tex: 'metal', decor: true });
    b.cyl(x, 4.5, z, 2.2, 0.4, '#64748b', { tex: 'metal', solid: false });
  }
  // conveyors
  for (const z of [-4, 4]) {
    b.box(-4, 0, z, 10, 0.9, 1.4, '#334155', { tex: 'metal' });
    b.box(-4, 0.9, z, 10, 0.06, 1.2, '#111827', { tex: 'stripes', ts: 0.3, solid: false });
    for (let x = -8.5; x < 0.5; x += 1.6) if (b.rand() < 0.75) b.box(x, 0.96, z, 0.7, 0.55, 0.7, b.pick(['#d6b583', '#c8a26b', '#f59e0b', '#0ea5e9']), { tex: 'plank', ts: 0.4, decor: true, solid: false });
  }
  // pipes along walls
  for (const y of [3.2, 4.2]) {
    b.pipe(0, y, -15.4, 0.5, 39, 'x', y > 4 ? '#b45309' : '#16a34a', { tex: 'metal', solid: false });
    b.pipe(-19.4, y, 0, 0.5, 31, 'z', '#6b7280', { tex: 'metal', solid: false });
  }
  for (const x of [-18, -8, 2, 7]) b.cyl(x, 0, -15.4, 0.5, 4.5, '#16a34a', { tex: 'metal' });
  b.pipe(-17.5, 0.6, -6, 1.2, 4, 'z', '#ca8a04', { tex: 'metal', decor: true }); // fallen big pipe
  // barrels & crates clusters
  for (const [x, z] of [[-2, -13.5], [-1.2, -14.2], [-2.6, -14.4], [6, -6], [6.8, -6.6], [-18.8, 6], [-18.8, 7]] as const)
    b.barrel(x, 0, z, b.pick(['#1d4ed8', '#15803d', '#b91c1c', '#ca8a04', '#334155']));
  for (const [x, z, s] of [[3, 13.5, 1.2], [4.3, 14, 1.0], [3.4, 13.6, 0.8], [-8, 14.5, 1.2], [-6.6, 14.5, 1.2], [-7.3, 14.5, 1.0]] as const)
    b.crate(x, x === 3.4 || x === -7.3 ? 1.2 : 0, z, s, '#a16207');

  // ---------- Catwalk (west/north) ----------
  b.box(-8, 2.6, 14.6, 16, 0.15, 2.6, '#475569', { tex: 'checker', ts: 0.25 });
  b.box(-8, 2.75, 13.35, 16, 0.6, 0.08, '#facc15', { tex: 'stripes', ts: 0.3 });
  for (const x of [-15, -10, -5, 0]) b.box(x, 0, 13.35, 0.15, 2.6, 0.15, '#475569', { tex: 'metal' });
  b.stairs({ x: 4.5, z: 15.3, r: 1 }, 1.4, 9, 0.29, 0.5, '#64748b', 'metal');
  b.crate(-12, 2.75, 15.2, 1.0, '#92400e');
  b.barrel(-14.5, 2.75, 15.2, '#b91c1c');
  b.box(-3, 2.75, 15.4, 2, 1.2, 0.8, '#0f766e', { tex: 'metal', decor: true });
  b.interact({ id: 'horn', kind: 'sound', label: 'Alarm Horn', p: [-8, 3.6, 15.6], defaultActive: false, sound: 'horn' });
  b.cone(-8, 3.6, 15.85, 0.6, 0.6, '#ef4444', { rot: [-Math.PI / 2, 0, 0], solid: false, glow: true });

  // forklift
  b.box(3, 0, 1, 1.4, 1.4, 2.2, '#f59e0b', { tex: 'metal', decor: true });
  b.box(3, 1.4, 1.4, 1.2, 1.0, 1.2, '#111827', { solid: false });
  b.box(3, 0, -0.5, 1.2, 2.5, 0.12, '#374151', { tex: 'metal' });

  // overhead lamps
  b.box(-10, 5.5, -4, 1.6, 0.15, 0.6, '#fef08a', { glow: true, solid: false, group: 'lamp_hall' });
  b.box(-2, 5.5, 6, 1.6, 0.15, 0.6, '#fef08a', { glow: true, solid: false, group: 'lamp_hall' });
  b.light([-10, 5, -4], '#ffdca8', 14, 16, 'lamp_hall');
  b.light([-2, 5, 6], '#ffdca8', 14, 16, 'lamp_hall');
  b.interact({ id: 'lamp_hall', kind: 'lamp', label: 'Main Lights', p: [9.4, 1.2, 0.5], defaultActive: true });
  b.box(9.85, 1, 0.5, 0.1, 0.4, 0.3, '#ef4444', { solid: false });


  // ---------- roof, lights, objects ----------
  b.ceiling(-20, -16, 20, 16, H, '#57534e', 0.3, 'metal');
  for (let x = -16; x <= 16; x += 8) b.box(x, H - 0.3, 0, 0.4, 0.3, 32, '#44403c', { tex: 'metal', solid: false }); // roof beams
  for (const [x, z] of [[-6, -10], [-6, 10], [6, -12]] as const) b.item('barrel', x, 0, z, 0, b.pick(['#1d4ed8', '#15803d', '#b91c1c']));
  for (const [x, z] of [[-11, -6.8], [-10.3, -7.2], [8, 13.4]] as const) b.item('crate', x, 0, z, 0.2, '#92400e');
  for (const [x, z] of [[-2.4, 9.2], [-1.8, 9.6], [-16.2, -2.6]] as const) b.item('cardbox', x, 0, z, 0.4, '#c8a26b');
  for (const [x, z] of [[-9.3, 7.4], [6.8, -2.6], [-17.6, -12.6]] as const) b.item('toolbox', x, 0, z, 0.7, b.pick(['#dc2626', '#2563eb']));
  for (const [x, z] of [[1.6, -3.0], [1.6, 3.0], [-0.4, -13.8]] as const) b.item('cone', x, 0, z, 0, '#f97316');
  for (const [x, z] of [[-13.2, 13.4], [7.2, -13.2]] as const) b.item('paintcan', x, 0, z, 0, b.pick(['#f8fafc', '#ef4444', '#facc15']));
  b.item('bucket', -8.6, 0, -13.6, 0, '#64748b');
  b.item('filecabinet', 18.9, 0, 10.6, -Math.PI / 2, '#64748b');
  b.item('officechair', 15, 0, 13.4, Math.PI, '#1e293b');
  b.item('monitor', 15.4, 0.78, 15.1, Math.PI);
  b.item('phone', 14.3, 0.78, 14.9, Math.PI, '#1f2937');
  b.item('mug', 16.2, 0.78, 14.7, 0, '#f97316');
  b.item('trashbin', 12.6, 0, 15.2, 0, '#475569');
  b.item('watercooler', 11.0, 0, 13.6, 0, '#f8fafc');
  b.item('clock', -8, 3.6, -15.84, 0, '#f8fafc');
  b.item('plant', 18.6, 0, 4.8, 0, '#57534e');

  return {
    id: 'factory',
    bounds: { minX: -20, maxX: 20, minZ: -16, maxZ: 16 },
    floor: { c: '#6b7280', tex: 'concrete' },
    sky: '#3b4252',
    fog: '#2b303b',
    ambient: 0.32,
    hemi: ['#cbd5e1', '#3f3f46', 0.42],
    sun: { c: '#ffd8a8', i: 0.95, dir: [-0.3, -1, -0.5] },
    hiderSpawns: [[-1, 0, -8], [1, 0, -8], [-3, 0, -8], [3, 0, -8], [-1, 0, -10], [1, 0, -10], [-3, 0, -10], [3, 0, -10]],
    seekerSpawns: [[6, 0, 13], [7.5, 0, 13], [6, 0, 14.6], [7.5, 0, 14.6]],
    props: b.props,
    items: b.items,
    interactables: b.interactables,
    lights: b.lights,
  };
}
