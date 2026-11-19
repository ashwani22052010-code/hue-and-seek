import { MapBuilder, TOY_COLORS, BOOK_COLORS as BOOKS } from './builder';
import type { MapDef } from './types';

export function buildSchool(): MapDef {
  const b = new MapBuilder(303);
  const H = 3.4;

  b.floorRect(-20, -2, 12, 2, '#e5e7eb', 'checker', 1); // hallway
  b.floorRect(-20, 2, -6, 15, '#d6c3a5', 'plank', 1); // class A
  b.floorRect(-6, 2, 8, 15, '#e7e5e4', 'tile', 1); // art room
  b.floorRect(8, 2, 12, 15, '#7c2d12', 'carpet', 1); // music
  b.floorRect(-20, -15, -4, -2, '#9f1239', 'carpet', 1); // library
  b.floorRect(-4, -15, 12, -2, '#e0b07a', 'plank', 0.8); // gym
  b.floorRect(12, -15, 20, 15, '#65a30d', 'grass', 1.5); // playground

  // Outer walls (playground side open, fenced)
  b.wall(-20, -15, 12, -15, H, '#fef3c7', { tex: 'brick', ts: 1 });
  b.wall(-20, 15, 12, 15, H, '#fef3c7', { tex: 'brick', ts: 1 });
  b.wall(-20, -15, -20, 15, H, '#fef3c7', { tex: 'brick', ts: 1 });
  b.wall(12, -15, 12, 15, H, '#fef3c7', { tex: 'brick', ts: 1, gaps: [{ at: 13, w: 4, h: 2.8 }] });
  for (const [x1, z1, x2, z2] of [[12, -15, 20, -15], [12, 15, 20, 15], [20, -15, 20, 15]] as const)
    b.wall(x1, z1, x2, z2, 1.1, '#f8fafc', { tex: 'stripes', ts: 0.3, t: 0.12 });

  // Inner walls
  b.wall(-20, 2, 12, 2, H, '#fde68a', { tex: 'noise', ts: 2, gaps: [{ at: 12, w: 1.4, h: 2.4 }, { at: 20, w: 1.4, h: 2.4 }, { at: 29.5, w: 1.4, h: 2.4 }] });
  b.wall(-20, -2, 12, -2, H, '#bae6fd', { tex: 'noise', ts: 2, gaps: [{ at: 8, w: 1.4, h: 2.4 }, { at: 23, w: 2.6, h: 2.6 }] });
  b.wall(-6, 2, -6, 15, H, '#fcd34d', { tex: 'noise', ts: 2 });
  b.wall(8, 2, 8, 15, H, '#fcd34d', { tex: 'noise', ts: 2 });
  b.wall(-4, -15, -4, -2, H, '#bae6fd', { tex: 'noise', ts: 2 });

  // Library door (interactive)
  b.box(-11.3, 0, -2, 1.4, 2.4, 0.08, '#7c2d12', { tex: 'wood', group: 'door_lib' });
  b.interact({ id: 'door_lib', kind: 'door', label: 'Library Door', p: [-11.3, 1, -2], defaultActive: false, hinge: [-12, -2], openAngle: -Math.PI / 2 });

  // ---------- Hallway lockers ----------
  const lockers = (x1: number, x2: number, z: number) => {
    for (let x = x1; x + 0.6 <= x2; x += 0.62) {
      const c = Math.round((x - x1) / 0.62) % 2 ? '#2563eb' : '#1d4ed8';
      b.box(x + 0.3, 0, z, 0.6, 1.9, 0.5, c, { tex: 'stripes', ts: 0.15, decor: true });
    }
  };
  lockers(-19.6, -9, 1.5); lockers(-5.5, -0.4, 1.5); lockers(2, 9.2, 1.5);
  lockers(-19.6, -12.4, -1.5); lockers(-10, 2.6, -1.5); lockers(6, 11.6, -1.5);
  b.interact({ id: 'bell', kind: 'sound', label: 'School Bell', p: [-0.2, 1.5, 1.6], defaultActive: false, sound: 'bell' });
  b.pipe(-0.2, 2.5, 1.2, 0.45, 0.2, 'z', '#dc2626', { solid: false });
  b.plant({ x: 0, z: 0, r: 0 }, 11.4, 1.3, 0.8);

  // ---------- Classroom A ----------
  b.box(-15, 0.9, 14.85, 4, 1.3, 0.06, '#14532d', { solid: false, decor: true });
  b.box(-15, 0.85, 14.75, 4, 0.06, 0.15, '#a16207', { solid: false });
  b.table({ x: -15, z: 13.2, r: 0 }, 1.8, 0.8, 0.8, '#92400e');
  b.chair({ x: -15, z: 14.0, r: 2 }, '#1e293b');
  for (const x of [-17.5, -14.5, -11.5, -8.5])
    for (const z of [5, 7.6, 10.2]) {
      b.table({ x, z, r: 0 }, 1.1, 0.6, 0.72, '#fbbf24', 'wood');
      b.chair({ x, z: z - 0.6, r: 0 }, b.pick(TOY_COLORS), 'none');
    }
  b.box(-19.5, 0, 9, 0.7, 1.2, 4, '#f5f5f4', { tex: 'wood' });
  for (let z = 7.4; z < 10.8; z += 0.55)
    for (const y of [0.1, 0.65]) b.box(-19.4, y, z, 0.5, 0.42, 0.45, b.pick(TOY_COLORS), { decor: true, solid: false });
  b.cyl(-19.5, 1.2, 12.5, 0.12, 0.3, '#78350f', { solid: false });
  b.sphere(-19.5, 1.45, 12.5, 0.5, '#0ea5e9', { tex: 'camo', ts: 0.25, decor: true, solid: false });
  b.box(-6.2, 1.2, 8, 0.05, 1.0, 2.2, '#f472b6', { tex: 'dots', solid: false, decor: true });
  b.plant({ x: 0, z: 0, r: 0 }, -7, 14.2, 1);

  // ---------- Art room ----------
  for (const [x, z] of [[-3, 7], [3.5, 7], [-3, 11.5], [3.5, 11.5]] as const) {
    b.table({ x, z, r: 0 }, 2.2, 1.2, 0.75, '#f5f5f4', 'wood');
    b.box(x - 0.5, 0.75, z, 0.5, 0.02, 0.4, b.pick(TOY_COLORS), { solid: false, decor: true });
    for (const dx of [-0.7, 0.7]) for (const dz of [-0.9, 0.9]) b.cyl(x + dx, 0, z + dz, 0.35, 0.5, '#0f766e', { tex: 'metal' });
  }
  for (const x of [-4.8, -2, 1, 4]) {
    b.box(x, 0, 14.2, 0.06, 1.6, 0.06, '#78350f', { solid: false });
    b.box(x, 0.8, 14.0, 0.9, 1.1, 0.05, '#ffffff', { solid: false, decor: true, tex: b.pick(['dots', 'stripes', 'camo', 'noise']), ts: 0.3 });
  }
  b.box(7.5, 0, 9, 0.8, 0.9, 5, '#e2e8f0', { tex: 'tile', ts: 0.4 });
  for (let i = 0; i < 6; i++) b.cyl(7.5, 0.9, 7 + i * 0.7, 0.35, 0.35, b.pick(TOY_COLORS), { solid: false, decor: true });
  b.sphere(0.5, 0, 4.2, 1.0, '#fb7185', { tex: 'noise', decor: true });
  b.sphere(0.5, 0.85, 4.2, 0.6, '#fda4af', { decor: true, solid: false });
  b.box(-5.5, 0, 3, 0.8, 1.6, 1.6, '#a3e635', { tex: 'wood' });

  // ---------- Music room ----------
  b.box(10, 0, 13.8, 2.2, 1.0, 0.8, '#111827', { tex: 'wood' });
  b.box(10, 0.75, 13.3, 2.0, 0.08, 0.3, '#f8fafc', { tex: 'stripes', ts: 0.06, solid: false });
  b.interact({ id: 'piano', kind: 'sound', label: 'Piano', p: [10, 1, 13], defaultActive: false, sound: 'piano' });
  b.cyl(9, 0, 6, 0.8, 0.6, '#dc2626', { tex: 'metal', decor: true });
  b.cyl(10.5, 0, 5.5, 0.6, 0.5, '#f59e0b', { tex: 'metal', decor: true });
  b.cyl(11, 0, 7, 0.7, 0.7, '#2563eb', { tex: 'metal', decor: true });
  for (const z of [9, 10.5]) b.chair({ x: 10, z, r: 0 }, '#a855f7', 'none');

  // ---------- Library ----------
  for (const z of [-12.5, -9.5, -6.5]) {
    b.bookshelf({ x: -14, z: z - 0.21, r: 2 }, 6, 2.2, '#7c2d12', 4);
    b.bookshelf({ x: -14, z: z + 0.21, r: 0 }, 6, 2.2, '#7c2d12', 4);
  }
  b.bookshelf({ x: -19.7, z: -8.5, r: 3 }, 8, 2.6, '#92400e', 5);
  for (const z of [-12.5, -8]) {
    b.table({ x: -7.5, z, r: 0 }, 2.4, 1.2, 0.75, '#b45309');
    for (const dx of [-0.6, 0.6]) {
      b.chair({ x: -7.5 + dx, z: z - 0.9, r: 0 }, '#166534');
      b.chair({ x: -7.5 + dx, z: z + 0.9, r: 2 }, '#166534');
    }
  }
  b.box(-6.5, 0, -4.2, 2.5, 1.0, 0.8, '#fde68a', { tex: 'wood' }); // librarian desk
  b.lamp({ x: -4.8, z: -4.3, r: 0 }, 0, 0, 'lamp_lib', '#86efac');
  b.sphere(-5, 0, -13.8, 1.2, '#f97316', { tex: 'fabric', decor: true }, [1.3, 0.75, 1.3]);
  b.sphere(-6.6, 0, -14, 1.2, '#06b6d4', { tex: 'fabric', decor: true }, [1.3, 0.75, 1.3]);
  b.box(-10.5, 0, -10.5, 3, 0.03, 4, '#fbbf24', { tex: 'checker', ts: 0.5, solid: false, decor: true });

  // ---------- Gym ----------
  for (const [x, z, w, d] of [[1, -9, 3, 2], [6, -9, 3, 2], [1, -5, 2, 3]] as const) b.box(x, 0, z, w, 0.18, d, '#1d4ed8', { tex: 'fabric', decor: true });
  b.cyl(4, 0, -14.6, 0.15, 3.0, '#475569', { tex: 'metal' });
  b.box(4, 2.7, -14.4, 1.8, 1.1, 0.08, '#f8fafc', { solid: false });
  b.cyl(4, 2.9, -13.9, 0.5, 0.05, '#f97316', { solid: false });
  for (let t = 0; t < 3; t++) b.box(-3.2 + t * 0.7, 0, -8.5, 0.7, 0.45 * (3 - t), 10, '#94a3b8', { tex: 'plank', ts: 0.6 });
  b.box(9.5, 0, -13.6, 2.2, 0.8, 0.8, '#78350f', { tex: 'wood' }); // ball rack
  for (let i = 0; i < 6; i++) b.sphere(8.7 + (i % 3) * 0.55, 0.8, -13.8 + Math.floor(i / 3) * 0.4, 0.42, b.pick(['#f97316', '#ef4444', '#facc15', '#ffffff']), { decor: true, solid: false });
  for (let l = 0; l < 4; l++) b.box(10, l * 0.3, -6, 1.4 - l * 0.08, 0.3, 0.9, l === 3 ? '#fef3c7' : '#b45309', { tex: l === 3 ? 'fabric' : 'wood' });
  for (const [x, z] of [[2, -12], [5, -12], [8, -12]] as const) b.cone(x, 0, z, 0.35, 0.5, '#f97316', { solid: false, decor: true });
  for (let i = 0; i < 6; i++) b.sphere(11.8, 0.4 + i * 0.4, -10 + (i % 2) * 0.6, 0.2, b.pick(TOY_COLORS), { solid: false });

  // ---------- Playground ----------
  b.box(15.5, 0, -10, 1.6, 1.6, 1.6, '#ef4444', { tex: 'plank' }); // slide tower
  b.box(15.5, 1.6, -10, 1.7, 0.6, 1.7, '#facc15', { tex: 'stripes', ts: 0.3, solid: false });
  b.stairs({ x: 15.5, z: -7.2, r: 2 }, 0.9, 5, 0.32, 0.38, '#3b82f6');
  b.box(15.5, 0.75, -12.4, 0.9, 0.08, 3.2, '#a855f7', { rot: [-0.45, 0, 0], solid: false });
  // swings
  for (const x of [13.2, 17.8]) b.cyl(x, 0, -2, 0.15, 2.6, '#f97316', { tex: 'metal' });
  b.pipe(15.5, 2.6, -2, 0.15, 4.6, 'x', '#f97316', { tex: 'metal', solid: false });
  for (const x of [14.5, 16.5]) {
    b.box(x, 0.5, -2, 0.6, 0.06, 0.3, '#1e293b', { solid: false });
    for (const dx of [-0.25, 0.25]) b.cyl(x + dx, 0.55, -2, 0.03, 2.0, '#cbd5e1', { solid: false });
  }
  // sandbox
  b.box(16, 0, 5, 4, 0.08, 4, '#fde68a', { tex: 'noise', ts: 0.3, solid: false });
  for (const [x, z, w, d] of [[16, 3, 4, 0.2], [16, 7, 4, 0.2], [14, 5, 0.2, 4], [18, 5, 0.2, 4]] as const) b.box(x, 0, z, w, 0.3, d, '#92400e', { tex: 'wood' });
  b.cyl(15, 0.08, 4.5, 0.3, 0.3, '#ef4444', { solid: false, decor: true });
  b.cone(17, 0.08, 6, 0.6, 0.6, '#f97316', { solid: false, decor: true });
  // playhouse (hiding hut)
  b.box(16, 0, 11.4, 3, 1.8, 0.15, '#fca5a5', { tex: 'plank', ts: 0.4 });
  b.box(14.55, 0, 10, 0.15, 1.8, 2.8, '#fca5a5', { tex: 'plank', ts: 0.4 });
  b.box(17.45, 0, 10, 0.15, 1.8, 2.8, '#fca5a5', { tex: 'plank', ts: 0.4 });
  b.box(16, 1.8, 10, 3.3, 0.15, 3.2, '#b91c1c', { tex: 'stripes', ts: 0.4 });
  // benches, trees, seesaw
  for (const z of [-6.5, 1.5]) {
    b.box(19.3, 0, z, 0.5, 0.45, 2, '#a16207', { tex: 'wood' });
    b.box(19.6, 0.45, z, 0.1, 0.5, 2, '#a16207', { tex: 'wood' });
  }
  b.tree(13.2, -13.5, 1.1); b.tree(19, -13.5, 0.9); b.tree(19, 13.5, 1.2); b.tree(13.2, 6.8, 0.8);
  b.box(15.5, 0, 0.5 + 12, 0.3, 0.35, 0.3, '#475569');
  b.box(15.5, 0.35, 12.5, 3, 0.08, 0.35, '#22c55e', { rot: [0, 0, 0.18], solid: false, decor: true });


  // ---------- ceilings (playground stays open air), lights, objects ----------
  b.ceiling(-20, -15, 12, 15, H, '#f8fafc', 0.2, 'tile');
  b.light([-13, 3.0, 8], '#fff7e0', 8, 14);
  b.light([1, 3.0, 8.5], '#ffffff', 8, 14);
  b.light([-12, 3.0, -8.5], '#ffe8c2', 7, 13);
  b.light([4, 3.0, -8.5], '#ffffff', 8, 14);
  for (const [x, z] of [[-13, 8], [1, 8.5], [-12, -8.5], [4, -8.5], [-10, 0], [2, 0]] as const) b.box(x, H - 0.06, z, 1.6, 0.06, 0.5, '#fffbeb', { glow: true, solid: false });
  for (const [x, z] of [[-17.5, 5.6], [-11.5, 8.2], [-8.5, 10.8]] as const) b.item('backpack', x + 0.45, 0, z, 0.4, b.pick(['#ef4444', '#2563eb', '#16a34a', '#a855f7']));
  for (const [x, z] of [[-17.5, 5], [-14.5, 7.6], [-11.5, 10.2]] as const) b.item('book', x, 0.72, z, 0.3, b.pick(BOOKS));
  b.item('globe', -14.2, 0.8, 13.2, 0.4);
  b.item('mug', -15.6, 0.8, 13.1, 0, '#f97316');
  b.item('trashbin', -6.6, 0, 14.4, 0, '#2563eb');
  b.item('clock', -15, 2.6, 14.86, Math.PI, '#ffffff');
  b.item('clock', 1, 2.6, 14.86, Math.PI, '#fde68a');
  for (const [x, z] of [[-3, 7], [3.5, 11.5]] as const) { b.item('paintcan', x + 0.6, 0.75, z + 0.2, 0, '#ef4444'); b.item('jar', x - 0.7, 0.75, z - 0.3, 0, '#bfdbfe'); }
  b.item('bucket', 6.8, 0, 3.2, 0, '#f59e0b');
  b.item('sculpture', 0.5, 0, 6.2, 0.4, '#e7e5e4');
  b.item('laptop', -7.3, 0.75, -12.4, 0.2);
  b.item('monitor', -6.5, 1.0, -4.15, Math.PI);
  b.item('books', -7.8, 0.75, -8.1, 0.4, '#7c2d12');
  b.item('tablelamp', -8.1, 0.75, -12.7, 0, '#86efac');
  b.item('globe', -6.9, 0.75, -7.9, 0);
  b.item('cushion', -9.0, 0, -13.6, 0.4, '#fca5a5');
  b.item('plant', -19.2, 0, -14.2, 0, '#c2410c');
  for (const [x, z] of [[2, -10.5], [5.5, -6.5], [7.5, -10.5]] as const) b.item('ball', x, 0, z, 0, b.pick(['#f97316', '#ef4444', '#facc15']));
  b.item('cone', 3.5, 0, -12.6, 0, '#f97316');
  b.item('backpack', -2.6, 1.35, -6.5, 1.6, '#0ea5e9');
  b.item('trashbin', 11.4, 0, -2.6, 0, '#16a34a');
  b.item('wateringcan', 16.4, 0, 3.4, 0.4, '#22c55e');
  b.item('bucket', 17.2, 0.08, 6.2, 0, '#ef4444');
  b.item('ball', 13.4, 0, 5.0, 0, '#3b82f6');
  b.item('trashbin', 19.3, 0, -9.0, 0, '#475569');

  return {
    id: 'school',
    bounds: { minX: -20, maxX: 20, minZ: -15, maxZ: 15 },
    floor: { c: '#e5e7eb', tex: 'checker' },
    sky: '#9bd3ff',
    fog: '#cfe9ff',
    ambient: 0.55,
    hemi: ['#ffffff', '#86efac', 0.6],
    sun: { c: '#fff7e0', i: 1.6, dir: [-0.6, -1, 0.3] },
    hiderSpawns: [[-17, 0, 0], [-13, 0, 0], [-9, 0, 0], [-5, 0, 0], [-1, 0, 0], [3, 0, 0], [7, 0, 0], [-19, 0, 0]],
    seekerSpawns: [[16, 0, -0.2], [17.5, 0, 1], [17.5, 0, -0.8], [18.8, 0, 0.2]],
    props: b.props,
    items: b.items,
    interactables: b.interactables,
    lights: b.lights,
  };
}
