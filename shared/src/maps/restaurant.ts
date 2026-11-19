import { MapBuilder } from './builder';
import type { MapDef } from './types';

// Bella Bistro: entrance + host stand, dining hall, bar, kitchen, pantry, cold storage, restroom.
const PI = Math.PI;

export function buildRestaurant(): MapDef {
  const b = new MapBuilder(707);
  const H = 3.4;
  const win = (at: number, w = 2) => ({ at, w, sill: 0.9, h: 2.6 });

  b.floorRect(-15, -11, 15, 11, '#a16207', 'plank', 1.1); // dining hall
  b.floorRect(-15, -11, -3, -2, '#e5e7eb', 'checker', 0.8); // kitchen
  b.floorRect(-15, 4, -8, 11, '#d6d3d1', 'concrete', 1.5); // pantry
  b.floorRect(9, -11, 15, -5, '#e0f2fe', 'tile', 0.5); // restroom

  b.wall(-15, -11, 15, -11, H, '#fef3c7', { tex: 'brick', ts: 1 });
  b.wall(-15, 11, 15, 11, H, '#fef3c7', { tex: 'brick', ts: 1, gaps: [win(16), win(20.5), { at: 25, w: 1.6, h: 2.4 }] });
  b.wall(-15, -11, -15, 11, H, '#fef3c7', { tex: 'brick', ts: 1 });
  b.wall(15, -11, 15, 11, H, '#fef3c7', { tex: 'brick', ts: 1, gaps: [win(8), win(13)] });
  b.box(11.8, 0, 11, 1.6, 2.4, 0.12, '#7c2d12', { tex: 'wood' }); // front door (closed)

  // kitchen walls with pass-through window
  b.wall(-3, -11, -3, -2, H, '#f1f5f9', { tex: 'tile', ts: 0.5, gaps: [{ at: 2, w: 2.2, sill: 1.1, h: 1.9 }, { at: 6, w: 1.4, h: 2.3 }] });
  for (const p of b.props.slice(-8)) if (p.glass) { p.solid = true; p.c = '#e0f2fe'; }
  b.wall(-15, -2, -3, -2, H, '#f1f5f9', { tex: 'tile', ts: 0.5, gaps: [{ at: 4, w: 1.4, h: 2.3 }] });
  // pantry + cold storage
  b.wall(-15, 4, -8, 4, H, '#d6d3d1', { tex: 'concrete', ts: 1.5, gaps: [{ at: 4.5, w: 1.1, h: 2.2 }] });
  b.wall(-8, 4, -8, 11, H, '#d6d3d1', { tex: 'concrete', ts: 1.5 });
  b.box(-10, 0, 4, 1.1, 2.2, 0.07, '#475569', { tex: 'metal', group: 'door_pantry' });
  b.interact({ id: 'door_pantry', kind: 'door', label: 'Pantry Door', p: [-10, 1, 4], defaultActive: false, hinge: [-10.5, 4], openAngle: -PI / 2 });
  // restroom
  b.wall(9, -11, 9, -5, H, '#e0f2fe', { tex: 'tile', ts: 0.5 });
  b.wall(9, -5, 15, -5, H, '#e0f2fe', { tex: 'tile', ts: 0.5, gaps: [{ at: 1, w: 0.95, h: 2.2 }] });
  b.box(10.48, 0, -5, 0.95, 2.2, 0.07, '#7c2d12', { tex: 'wood', group: 'door_wc' });
  b.interact({ id: 'door_wc', kind: 'door', label: 'Restroom Door', p: [10.48, 1, -5], defaultActive: false, hinge: [10, -5], openAngle: PI / 2 });

  b.ceiling(-15, -11, 15, 11, H, '#fffbeb', 0.2, 'plank');
  for (let x = -12; x <= 12; x += 4) b.box(x, H - 0.25, 0, 0.25, 0.25, 22, '#78350f', { tex: 'wood', solid: false }); // beams
  b.light([5, 2.8, 2], '#ffd9a0', 9, 18, 'lamp_dining');
  b.light([-9, 2.8, -6.5], '#ffffff', 7, 12);
  b.light([-11.5, 2.8, 7.5], '#fff1d6', 5, 9);
  b.interact({ id: 'lamp_dining', kind: 'lamp', label: 'Dining Lights', p: [14.6, 1.3, 9.6], defaultActive: true });
  for (const [x, z] of [[-1, 5], [5, 5], [11, 5], [-1, -1], [5, -1], [11, 1.5]] as const) {
    b.cyl(x, H - 0.75, z, 0.02, 0.75, '#1f2937', { solid: false });
    b.cone(x, H - 1.0, z, 0.55, 0.3, '#fbbf24', { glow: true, solid: false, group: 'lamp_dining' });
  }

  // ---------- dining hall ----------
  const flowers = ['#ef4444', '#f472b6', '#facc15', '#a855f7'];
  for (const [tx, tz] of [[-1, 6.5], [3.5, 6.5], [8, 6.5], [-1, 1.5], [3.5, 1.5], [8, 2.5]] as const) {
    b.item('roundtable', tx, 0, tz, 0, '#f8fafc');
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * PI * 2 + PI / 4;
      b.item('chair', tx + Math.sin(a) * 0.85, 0, tz + Math.cos(a) * 0.85, a + PI, '#7c2d12');
      b.item('plate', tx + Math.sin(a) * 0.3, 0.76, tz + Math.cos(a) * 0.3, 0, '#ffffff', 0.85);
      if (i % 2 === 0) b.item('wineglass', tx + Math.sin(a + 0.5) * 0.28, 0.76, tz + Math.cos(a + 0.5) * 0.28);
    }
    b.item('flowerpot', tx, 0.76, tz, 0, b.pick(flowers), 0.6);
    b.item('candle', tx + 0.12, 0.76, tz - 0.1);
  }
  b.item('loveseat', 13.9, 0, 7.5, -PI / 2, '#991b1b');
  b.item('coffeetable', 12.9, 0, 7.5, PI / 2, '#78350f');
  b.item('cushion', 13.9, 0.44, 7.0, -PI / 2, '#fde68a');
  b.item('plant', 14.2, 0, 10.2, 0, '#c2410c');
  b.item('plant', 9.4, 0, 10.2, 0, '#c2410c');
  b.item('painting', 14.87, 1.5, 3, -PI / 2, '#fb923c', 1.1);
  b.item('painting', 2, 1.6, 10.87, PI, '#16a34a', 1.2);
  b.item('clock', -2.88, 2.3, 2.5, PI / 2, '#fde68a');
  // host stand
  b.box(10.4, 0, 9.2, 0.9, 1.1, 0.5, '#7c2d12', { tex: 'wood' });
  b.item('book', 10.4, 1.1, 9.2, 0.2, '#111827');
  b.item('phone', 10.7, 1.1, 9.15, 0.4);

  // ---------- bar ----------
  b.box(5, 0, -4.2, 7, 1.05, 0.8, '#78350f', { tex: 'wood', ts: 0.5 });
  b.box(5, 1.05, -4.2, 7.1, 0.06, 0.95, '#111827', { tex: 'stone' });
  for (let x = 2; x <= 8; x += 1.5) b.item('stool', x, 0, -3.3, 0, '#1f2937');
  b.box(5, 0, -10.75, 7, 2.4, 0.4, '#3f2a1d', { tex: 'wood' }); // back shelf
  for (const y of [1.0, 1.55]) for (let x = 2.0; x <= 8; x += 0.45) b.item('bottle', x, y, -10.65, 0, b.pick(['#16a34a', '#92400e', '#0ea5e9', '#be123c', '#facc15']));
  for (let x = 2.4; x <= 7.6; x += 1.3) b.item('wineglass', x, 1.11, -4.1);
  b.item('jug', 6.8, 1.11, -4.3, 0, '#e0f2fe');
  b.item('fruitbowl', 3.6, 1.11, -4.2, 0, '#a16207');

  // ---------- kitchen ----------
  b.box(-9, 0, -10.6, 11.5, 0.92, 0.8, '#cbd5e1', { tex: 'metal' });
  b.box(-9, 0.92, -10.6, 11.6, 0.05, 0.85, '#94a3b8', { tex: 'metal' });
  b.box(-9, 0, -5.4, 4.5, 0.92, 1.4, '#cbd5e1', { tex: 'metal' }); // prep island
  b.box(-9, 0.92, -5.4, 4.6, 0.05, 1.5, '#e2e8f0', { tex: 'metal' });
  b.box(-14.6, 0, -6.5, 0.8, 0.92, 4, '#111827', { tex: 'metal' }); // range
  for (const z of [-7.8, -6.5, -5.2]) b.cyl(-14.5, 0.92, z, 0.32, 0.02, '#ef4444', { glow: true, solid: false });
  for (const [x, t, c] of [[-13.6, 'pot', '#94a3b8'], [-12.4, 'pan', '#334155'], [-11.2, 'pot', '#cbd5e1'], [-10, 'kettle', '#cbd5e1'], [-8.4, 'bowl', '#ffffff'], [-7.6, 'jar', '#fde68a'], [-6.8, 'jar', '#fecaca'], [-5.6, 'microwave', '#e2e8f0'], [-4.4, 'toaster', '#cbd5e1']] as const)
    b.item(t, x, 0.97, -10.65, 0, c);
  for (let i = 0; i < 4; i++) b.item('plate', -10 + i * 0.05, 0.97 + i * 0.03, -5.4, 0, '#ffffff');
  b.item('pot', -14.5, 0.94, -7.8, 0, '#64748b');
  b.item('pan', -14.5, 0.94, -5.2, 1.2, '#1f2937');
  b.item('bowl', -8.2, 0.97, -5.2, 0, '#fde68a');
  b.item('cutlery', -7.6, 0.97, -5.6, 0.3);
  b.item('fruitbowl', -9.6, 0.97, -5.6, 0, '#a16207');
  b.item('bucket', -3.6, 0, -9.8, 0, '#3b82f6');
  b.item('trashbin', -3.6, 0, -2.6, 0, '#475569');
  b.item('stool', -6.4, 0, -3.0, 0, '#64748b');
  b.interact({ id: 'kitchenbell', kind: 'sound', label: 'Order Bell', p: [-3.2, 1.3, -7.9], defaultActive: false, sound: 'bell' });

  // ---------- pantry + cold storage ----------
  for (const x of [-14.6, -12.6]) {
    b.item('shelfunit', x + 0.6, 0, 10.6, PI, '#64748b');
    for (const y of [0.06, 0.66, 1.26]) {
      b.item(b.pick(['jar', 'can', 'cereal']), x + 0.3, y, 10.6, PI, b.pick(['#fde68a', '#dc2626', '#f59e0b', '#16a34a']));
      b.item(b.pick(['jar', 'can', 'bottle']), x + 0.7, y, 10.65, PI, b.pick(['#fef3c7', '#2563eb', '#a855f7']));
      b.item(b.pick(['cereal', 'cardbox']), x + 1.05, y, 10.6, PI, b.pick(['#ef4444', '#c8a26b']), 0.5);
    }
  }
  b.item('fridge', -9.0, 0, 10.5, PI, '#e2e8f0');
  b.item('fridge', -9.0, 0, 9.2, -PI / 2, '#e2e8f0');
  for (const [x, z] of [[-14, 5.2], [-13.4, 5.4], [-12.6, 6.6]] as const) b.item('cardbox', x, 0, z, 0.3, '#c8a26b');
  b.item('crate', -11.6, 0, 5.2, 0.2, '#b45309');
  b.item('barrel', -14.3, 0, 7.6, 0, '#7c2d12');
  b.item('bucket', -9.4, 0, 6.2, 0, '#64748b');

  // ---------- restroom ----------
  b.item('toilet', 14.4, 0, -10.4, PI, '#ffffff');
  b.item('washbasin', 9.5, 0, -9.0, PI / 2, '#ffffff');
  b.item('soap', 9.5, 0.9, -8.8, 0, '#f0abfc');
  b.item('towel', 9.5, 0.9, -9.3, PI / 2, '#5eead4');
  b.item('trashbin', 14.4, 0, -5.6, 0, '#94a3b8', 0.7);
  b.item('flowerpot', 12, 0, -10.6, 0, '#f472b6');

  return {
    id: 'restaurant',
    bounds: { minX: -15, maxX: 15, minZ: -11, maxZ: 11 },
    floor: { c: '#a16207', tex: 'plank' },
    sky: '#ffd8a8',
    fog: '#fde8cf',
    ambient: 0.5,
    hemi: ['#fff7ed', '#9a3412', 0.55],
    sun: { c: '#ffe2b8', i: 1.2, dir: [0.5, -1, -0.4] },
    hiderSpawns: [[1, 0, 4], [6, 0, 4], [11, 0, 4], [1, 0, -1.3], [6, 0, -1.3], [11, 0, -2.0], [-1.2, 0, 9.4], [6, 0, 9.4]],
    seekerSpawns: [[-6, 0, 1.5], [-6, 0, 3.0], [-4.4, 0, 1.5], [-4.4, 0, 3.0]],
    props: b.props,
    items: b.items,
    interactables: b.interactables,
    lights: b.lights,
  };
}
