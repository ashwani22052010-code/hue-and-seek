import { MapBuilder } from './builder';
import type { MapDef } from './types';

// Skyline Office: reception, open-plan desks, glass meeting room, manager office, break room,
// server closet and a washroom. Fully enclosed with windows and a ceiling.
const PI = Math.PI;

export function buildOffice(): MapDef {
  const b = new MapBuilder(606);
  const H = 3.2;
  const win = (at: number, w = 2.2) => ({ at, w, sill: 0.8, h: 2.5 });

  b.floorRect(-16, -12, 16, 12, '#cbd5e1', 'carpet', 1);
  b.floorRect(-16, -12, -6, -3, '#e7e5e4', 'tile', 0.7); // break room
  b.floorRect(6, 4, 16, 12, '#a8a29e', 'plank', 1); // manager office
  b.floorRect(-16, 6, -9, 12, '#f1f5f9', 'tile', 0.5); // washroom

  b.wall(-16, -12, 16, -12, H, '#f8fafc', { tex: 'noise', ts: 2, gaps: [win(2), win(7), win(13), win(19), win(25)] });
  b.wall(-16, 12, 16, 12, H, '#f8fafc', { tex: 'noise', ts: 2, gaps: [win(9), win(14), win(24)] });
  b.wall(-16, -12, -16, 12, H, '#f8fafc', { tex: 'noise', ts: 2, gaps: [win(4), win(14)] });
  b.wall(16, -12, 16, 12, H, '#f8fafc', { tex: 'noise', ts: 2, gaps: [win(3), win(18)] });

  // break room (south-west)
  b.wall(-6, -12, -6, -3, H, '#fde68a', { tex: 'noise', ts: 2, gaps: [{ at: 5.5, w: 2, h: 2.4 }] });
  b.wall(-16, -3, -6, -3, H, '#fde68a', { tex: 'noise', ts: 2 });
  // glass meeting room (south-east)
  for (const [x1, z1, x2, z2] of [[5, -12, 5, -4], [5, -4, 16, -4]] as const) b.wall(x1, z1, x2, z2, H, '#bfe3ff', { t: 0.06, gaps: [{ at: x1 === x2 ? 1 : 1.5, w: 1.1, h: 2.3 }] });
  for (const p of b.props.slice(-6)) if (p.c === '#bfe3ff') { p.glass = true; p.tex = 'none'; }
  // manager office (north-east)
  b.wall(6, 4, 16, 4, H, '#ccfbf1', { tex: 'noise', ts: 2, gaps: [{ at: 1, w: 1.0, h: 2.2 }] });
  b.wall(6, 4, 6, 12, H, '#ccfbf1', { tex: 'noise', ts: 2 });
  b.box(7.5, 0, 4, 1.0, 2.2, 0.07, '#78350f', { tex: 'wood', group: 'door_boss' });
  b.interact({ id: 'door_boss', kind: 'door', label: 'Manager Door', p: [7.5, 1, 4], defaultActive: false, hinge: [7, 4], openAngle: PI / 2 });
  // washroom (north-west) + server closet
  b.wall(-16, 6, -9, 6, H, '#e0f2fe', { tex: 'tile', ts: 0.5, gaps: [{ at: 5, w: 0.9, h: 2.2 }] });
  b.wall(-9, 6, -9, 12, H, '#e0f2fe', { tex: 'tile', ts: 0.5 });
  b.wall(-9, 6, -4, 6, H, '#475569', { tex: 'metal', ts: 1 });
  b.wall(-4, 6, -4, 12, H, '#475569', { tex: 'metal', ts: 1, gaps: [{ at: 0.6, w: 1.0, h: 2.2 }] });
  b.ceiling(-16, -12, 16, 12, H, '#f8fafc', 0.2, 'tile');
  for (const [x, z] of [[-10, -7.5], [0, -6], [10, -8], [0, 2], [11, 8], [-12, 9], [-6.5, 9], [-11, 1], [9, 0]] as const) b.box(x, H - 0.06, z, 1.8, 0.06, 0.6, '#fffbeb', { glow: true, solid: false });
  b.light([0, 2.7, -2], '#ffffff', 10, 20);
  b.light([-10, 2.7, -7.5], '#fff1d6', 6, 12);
  b.light([11, 2.7, 8], '#fff7e0', 6, 12, 'lamp_boss');
  b.interact({ id: 'lamp_boss', kind: 'lamp', label: 'Office Lights', p: [6.3, 1.3, 5.2], defaultActive: true });

  // ---------- reception ----------
  b.box(0, 0, 9.6, 3.4, 1.05, 0.8, '#0f766e', { tex: 'wood', ts: 0.5 });
  b.box(0, 1.05, 9.6, 3.5, 0.06, 0.9, '#f8fafc', { tex: 'stone' });
  b.item('monitor', -0.6, 1.11, 9.8, PI);
  b.item('phone', 0.4, 1.11, 9.7, PI);
  b.item('flowerpot', 1.4, 1.11, 9.6, 0, '#ea580c');
  b.item('officechair', 0, 0, 10.6, PI, '#1e293b');
  b.item('sofa', -3.2, 0, 2.6, PI, '#334155');
  b.item('coffeetable', -3.2, 0, 1.4, 0, '#e7e5e4');
  b.item('books', -3.4, 0.42, 1.4, 0.3, '#0ea5e9');
  b.item('plant', 2.6, 0, 11.4, 0, '#1e293b');
  b.item('plant', -2.6, 0, 11.4, 0, '#1e293b');
  b.item('painting', 0, 1.5, 11.87, PI, '#0ea5e9', 1.3);
  b.interact({ id: 'bell', kind: 'sound', label: 'Reception Bell', p: [0.9, 1.2, 9.4], defaultActive: false, sound: 'bell' });

  // ---------- open-plan desks ----------
  for (const cx of [-3, 2.5]) for (const cz of [-1.8, 1.4]) {
    // a cluster of 4 desks facing each other
    for (const [dx, dz, r] of [[-0.75, -0.42, 0], [0.75, -0.42, 0], [-0.75, 0.42, PI], [0.75, 0.42, PI]] as const) {
      b.item('desk', cx + dx, 0, cz + dz, r, '#f5f5f4', 0.62);
      b.item('monitor', cx + dx, 0.47, cz + dz * 0.6, r, '#111827', 0.75);
      b.item('officechair', cx + dx, 0, cz + dz * 2.6, r, b.pick(['#1e293b', '#0f766e', '#7c3aed']), 0.85);
    }
    b.item('mug', cx + 0.4, 0.47, cz - 0.3, 0, b.pick(['#f97316', '#ef4444', '#ffffff']));
    b.item('mugtray', cx - 0.35, 0.47, cz + 0.32);
    b.item('laptop', cx - 1.1, 0.47, cz - 0.32, 0.2);
  }
  b.item('printer', 4.6, 0, -2.9, 0, '#e5e7eb');
  b.item('filecabinet', 4.6, 0, 1.2, -PI / 2, '#64748b');
  b.item('filecabinet', 4.6, 0, 2.0, -PI / 2, '#64748b');
  b.item('watercooler', -5.4, 0, 4.8, 0, '#f8fafc');
  b.item('trashbin', -5.4, 0, -1.0, 0, '#475569');
  b.item('trashbin', 4.4, 0, 3.4, 0, '#475569');
  b.item('plant', -5.4, 0, 0.2, 2, '#e5e7eb');
  b.item('backpack', 1.6, 0, -0.1, 1.0, '#0ea5e9');
  b.item('cardbox', 3.8, 0, -4.6, 0.2, '#c8a26b');
  b.item('clock', -0.5, 2.3, -11.86, 0, '#f8fafc');

  // ---------- meeting room ----------
  b.item('diningtable', 10.5, 0, -8, 0, '#e7e5e4', 1.3);
  for (const [x, z, r] of [[9.2, -9.1, 0], [10.5, -9.1, 0], [11.8, -9.1, 0], [9.2, -6.9, PI], [10.5, -6.9, PI], [11.8, -6.9, PI]] as const) b.item('officechair', x, 0, z, r, '#334155', 0.9);
  b.item('laptop', 10.0, 0.99, -8.1, 0.3);
  b.item('glass', 11.3, 0.99, -7.9);
  b.item('jug', 11.6, 0.99, -8.2, 0, '#e0f2fe');
  b.box(15.88, 0.9, -8, 0.06, 1.3, 2.4, '#f8fafc', { solid: false }); // whiteboard
  b.item('plant', 15.3, 0, -11.3, 0, '#c2410c');

  // ---------- manager office ----------
  b.item('desk', 11.5, 0, 10.6, PI, '#78350f');
  b.item('officechair', 11.5, 0, 11.4, PI, '#111827');
  b.item('monitor', 11.6, 0.76, 10.8, 0);
  b.item('tablelamp', 10.6, 0.76, 10.7, 0, '#fde68a');
  b.item('photoframe', 12.3, 0.76, 10.8, 0.4, '#d97706');
  b.item('armchair', 9.2, 0, 8.2, PI / 2, '#7c2d12');
  b.item('bookshelf', 15.75, 0, 8.4, -PI / 2, '#78350f');
  b.item('globe', 14.8, 0, 5.0, 0);
  b.item('plant', 6.8, 0, 11.3, 0, '#1e293b');
  b.item('sculpture', 15.2, 0, 11.2, 0.5, '#e7e5e4');
  b.item('painting', 11, 1.5, 4.13, 0, '#a855f7');

  // ---------- break room ----------
  b.box(-11, 0, -11.55, 7, 0.92, 0.7, '#f8fafc', { tex: 'wood', ts: 0.5 });
  b.box(-11, 0.92, -11.55, 7.05, 0.06, 0.75, '#334155', { tex: 'stone' });
  b.item('fridge', -6.9, 0, -11.45, 0, '#e2e8f0');
  b.item('microwave', -13.6, 0.98, -11.6, 0);
  b.item('kettle', -12.2, 0.98, -11.5, 0.3, '#111827');
  for (const [x, c] of [[-11.4, '#ffffff'], [-11.1, '#f97316'], [-10.8, '#38bdf8']] as const) b.item('mug', x, 0.98, -11.5, 0.6, c);
  b.item('toaster', -9.8, 0.98, -11.6, 0, '#ef4444');
  b.item('jar', -8.9, 0.98, -11.7, 0, '#fde68a');
  b.item('roundtable', -11, 0, -6.6, 0, '#f5f5f4');
  for (let i = 0; i < 4; i++) { const a = (i / 4) * PI * 2 + 0.4; b.item('chair', -11 + Math.sin(a) * 0.8, 0, -6.6 + Math.cos(a) * 0.8, a + PI, '#0f766e'); }
  b.item('fruitbowl', -11, 0.76, -6.6, 0, '#a16207');
  b.item('watercooler', -15.4, 0, -4.0, 0, '#bae6fd');
  b.item('trashbin', -15.4, 0, -11.2, 0, '#16a34a');
  b.item('loveseat', -15.4, 0, -7.6, PI / 2, '#f59e0b');

  // ---------- washroom ----------
  for (const z of [7.4, 9.0, 10.6]) b.item('washbasin', -15.6, 0, z, PI / 2, '#ffffff', 0.9);
  b.item('toilet', -10.0, 0, 11.4, PI, '#ffffff');
  b.box(-10.0, 0, 9.4, 1.6, 2.1, 0.06, '#94a3b8', { tex: 'metal' }); // stall wall
  b.item('soap', -15.6, 0.81, 8.2, 0, '#f0abfc');
  b.item('bucket', -12.4, 0, 6.6, 0, '#3b82f6');
  b.item('towel', -15.6, 0.81, 9.8, PI / 2, '#5eead4');
  b.item('trashbin', -9.6, 0, 6.6, 0, '#94a3b8', 0.7);

  // ---------- server closet ----------
  for (const z of [7.2, 9.0, 10.8]) {
    b.box(-6.5, 0, z, 2.2, 2.1, 0.8, '#111827', { tex: 'metal' });
    for (let y = 0.3; y < 2; y += 0.35) b.box(-6.5, y, z + 0.41, 1.8, 0.04, 0.02, b.pick(['#22c55e', '#38bdf8', '#22c55e']), { glow: true, solid: false });
  }
  b.item('cardbox', -8.4, 0, 11.4, 0.3, '#c8a26b');
  b.item('toolbox', -4.8, 0, 11.4, 1.2, '#dc2626');

  return {
    id: 'office',
    bounds: { minX: -16, maxX: 16, minZ: -12, maxZ: 12 },
    floor: { c: '#cbd5e1', tex: 'carpet' },
    sky: '#9fd3ff',
    fog: '#dbeafe',
    ambient: 0.58,
    hemi: ['#ffffff', '#94a3b8', 0.6],
    sun: { c: '#ffffff', i: 1.3, dir: [0.4, -1, 0.3] },
    hiderSpawns: [[-9, 0, 2], [-9, 0, 4], [-7.5, 0, -1], [0, 0, 5], [2, 0, 5.4], [-1.5, 0, 5.8], [7.8, 0, 2], [9.5, 0, 0]],
    seekerSpawns: [[12, 0, 1], [13.5, 0, 1], [12, 0, -1.6], [13.5, 0, -1.6]],
    props: b.props,
    items: b.items,
    interactables: b.interactables,
    lights: b.lights,
  };
}
