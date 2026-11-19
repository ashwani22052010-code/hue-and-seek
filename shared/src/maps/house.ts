import { MapBuilder, BOOK_COLORS } from './builder';
import type { MapDef } from './types';

// Two-storey family house. Ground floor ceiling at 3.0 m, upstairs floor at 3.2 m, roof at 6.0 m.
// Ground: living room, kitchen + dining, hallway with stairs, master bedroom, bathroom, storage/utility.
// Upstairs: kids room, landing, attic playroom.
const PI = Math.PI;

export function buildHouse(): MapDef {
  const b = new MapBuilder(101);
  const G = 3.0; // ground ceiling height
  const UP = 3.2; // upstairs floor level
  const WALL = '#f5ead6', WALL2 = '#e0f2fe', WALL3 = '#fde7c7';
  const win = (at: number, w = 1.4, sill = 0.95, h = 2.2) => ({ at, w, sill, h });

  // ---------------- floors ----------------
  b.floorRect(-12, -9, 0, 1, '#c08a52', 'plank', 1.2); // living
  b.floorRect(0, -9, 12, -1, '#e8e4dc', 'tile', 0.8); // kitchen
  b.floorRect(0, -1, 12, 2, '#a87444', 'plank', 1.2); // hallway
  b.floorRect(-12, 1, 0, 9, '#93c5fd', 'carpet', 1); // bedroom
  b.floorRect(0, 2, 6, 9, '#9ca3af', 'concrete', 1.5); // storage
  b.floorRect(6, 2, 12, 9, '#e0f2fe', 'tile', 0.5); // bathroom

  // ---------------- ground floor exterior walls (with windows) ----------------
  b.wall(-12, -9, 12, -9, UP, WALL, { tex: 'noise', ts: 2, gaps: [win(3), win(7.5), win(15), win(19.5)] });
  b.wall(-12, 9, 12, 9, UP, WALL, { tex: 'noise', ts: 2, gaps: [win(4.5, 1.8), win(20.5, 0.9, 1.5, 2.2)] });
  b.wall(-12, -9, -12, 9, UP, WALL, { tex: 'noise', ts: 2, gaps: [win(3.5), win(12.5)] });
  b.wall(12, -9, 12, 9, UP, WALL, { tex: 'noise', ts: 2, gaps: [win(3.5), { at: 8.4, w: 1.2, h: 2.3 }] });
  b.box(12, 0, -0.0, 0.12, 2.3, 1.2, '#7c2d12', { tex: 'wood' }); // front door (closed)
  b.box(11.9, 1.1, -0.45, 0.06, 0.08, 0.08, '#fbbf24', { solid: false });

  // ---------------- ground floor interior walls ----------------
  b.wall(-12, 1, 0, 1, G, WALL3, { tex: 'noise', ts: 2, gaps: [{ at: 8, w: 1.1, h: 2.2 }] });
  b.wall(0, -9, 0, 9, G, WALL2, { tex: 'noise', ts: 2, gaps: [{ at: 8.1, w: 1.8, h: 2.5 }] });
  b.wall(0, -1, 12, -1, G, '#d9f99d', { tex: 'stripes', ts: 1.5, gaps: [{ at: 1.5, w: 3.4, h: 2.5 }] });
  b.wall(0, 2, 12, 2, G, WALL2, { tex: 'noise', ts: 2, gaps: [{ at: 1.5, w: 1.0, h: 2.2 }, { at: 11.0, w: 0.9, h: 2.2 }] });
  b.wall(6, 2, 6, 9, G, '#bae6fd', { tex: 'tile', ts: 0.5 });

  // interactive doors
  const door = (id: string, label: string, x: number, z: number, w: number, axis: 'x' | 'z', hinge: [number, number], angle: number, y = 0) => {
    if (axis === 'x') b.box(x, y, z, w, 2.2, 0.07, '#92400e', { tex: 'wood', group: id });
    else b.box(x, y, z, 0.07, 2.2, w, '#92400e', { tex: 'wood', group: id });
    b.interact({ id, kind: 'door', label, p: [x, y + 1, z], defaultActive: false, hinge, openAngle: angle });
  };
  door('door_bed', 'Bedroom Door', -3.45, 1, 1.1, 'x', [-4, 1], PI / 2);
  door('door_store', 'Storage Door', 2.0, 2, 1.0, 'x', [1.5, 2], -PI / 2);
  door('door_bath', 'Bathroom Door', 11.45, 2, 0.9, 'x', [11, 2], -PI / 2);

  // ---------------- ceilings / upstairs slab with stairwell ----------------
  b.ceiling(-12, -9, 0, 9, G, '#fafaf9'); // single storey part (its top is the roof)
  b.ceiling(0, -9, 12, 0.4, G, '#fafaf9', 0.2);
  b.ceiling(0, 2.0, 12, 9, G, '#fafaf9', 0.2);
  b.ceiling(0, 0.4, 6.4, 2.0, G, '#fafaf9', 0.2);
  b.ceiling(11.0, 0.4, 12, 2.0, G, '#fafaf9', 0.2);

  // ---------------- staircase (hallway, rising toward +x) ----------------
  b.stairs({ x: 6.6, z: 1.2, r: 3 }, 1.2, 13, UP / 13, 0.32, '#92400e');
  b.box(8.7, 0, 0.55, 4.2, 0.95, 0.06, '#78350f', { tex: 'wood', solid: false, rot: [0, 0, -0.66] }); // banister (visual)

  // ---------------- upstairs floors, walls, roof ----------------
  b.floorRect(0, -9, 12, -0.5, '#fbcfe8', 'carpet', 1); // kids room
  b.floorRect(0, -0.5, 12, 2.6, '#c08a52', 'plank', 1.2); // landing (visual layer on slab)
  b.floorRect(0, 2.6, 12, 9, '#d6b583', 'plank', 1); // attic playroom
  for (const it of b.props.slice(-3)) it.p[1] += UP; // lift the three upstairs floor layers
  const uw = UP;
  b.wall(0, -9, 12, -9, 2.8, WALL, { y: uw, tex: 'noise', ts: 2, gaps: [win(2.5), win(8)] });
  b.wall(0, 9, 12, 9, 2.8, WALL, { y: uw, tex: 'noise', ts: 2, gaps: [win(5, 2)] });
  b.wall(0, -9, 0, 9, 2.8, WALL, { y: uw, tex: 'noise', ts: 2, gaps: [win(3), win(13)] });
  b.wall(12, -9, 12, 9, 2.8, WALL, { y: uw, tex: 'noise', ts: 2, gaps: [win(3)] });
  b.wall(0, -0.5, 12, -0.5, 2.8, '#fbcfe8', { y: uw, tex: 'dots', ts: 1, gaps: [{ at: 2, w: 1.0, h: 2.2 }] });
  b.wall(0, 2.6, 12, 2.6, 2.8, '#fde68a', { y: uw, tex: 'noise', ts: 2, gaps: [{ at: 2.5, w: 3.0, h: 2.4 }] });
  door('door_kids', 'Kids Room Door', 2.5, -0.5, 1.0, 'x', [2, -0.5], -PI / 2, uw);
  b.ceiling(0, -9, 12, 9, UP + 2.8, '#fafaf9');
  // stairwell railing upstairs
  b.box(8.7, UP, 0.38, 4.6, 0.9, 0.06, '#78350f', { tex: 'wood' });
  b.box(8.7, UP, 2.02, 4.6, 0.9, 0.06, '#78350f', { tex: 'wood' });
  b.box(6.38, UP, 1.2, 0.06, 0.9, 1.7, '#78350f', { tex: 'wood' });

  // ---------------- lights & switches ----------------
  b.ceilingLight(-6, G, -4, '#fff1d6', 7, 14, 'lamp_living');
  b.interact({ id: 'lamp_living', kind: 'lamp', label: 'Living Room Lights', p: [-0.3, 1.3, -1.6], defaultActive: true });
  b.box(-0.17, 1.2, -1.6, 0.04, 0.16, 0.1, '#f8fafc', { solid: false });
  b.ceilingLight(6, G, -5, '#ffffff', 7, 13);
  b.ceilingLight(-6, G, 5, '#ffe4c4', 6, 12, 'lamp_bed');
  b.interact({ id: 'lamp_bed', kind: 'lamp', label: 'Bedroom Lights', p: [-4.6, 1.3, 1.3], defaultActive: true });
  b.box(-4.6, 1.2, 1.17, 0.12, 0.16, 0.04, '#f8fafc', { solid: false });
  b.ceilingLight(6, UP + 2.8, -4.5, '#fff7e0', 6, 12);
  b.ceilingLight(6, UP + 2.8, 6, '#ffe8c2', 6, 12);
  b.box(9, G - 0.06, 5.5, 0.6, 0.06, 0.6, '#fffbeb', { glow: true, solid: false });
  b.box(3, G - 0.06, 5.5, 0.6, 0.06, 0.6, '#fffbeb', { glow: true, solid: false });
  b.box(3, G - 0.06, 0.5, 0.6, 0.06, 0.6, '#fffbeb', { glow: true, solid: false });
  b.interact({ id: 'doorbell', kind: 'sound', label: 'Doorbell', p: [11.6, 1.2, 0.9], defaultActive: false, sound: 'chime' });

  // ================= LIVING ROOM (x -12..0, z -9..1) =================
  b.item('rug', -6, 0.02, -4.4, 0, '#be123c', 1.3);
  b.item('sofa', -6, 0, -1.0, PI, '#64748b');
  for (const [x, c] of [[-6.8, '#fde68a'], [-5.2, '#a5f3fc']] as const) b.item('cushion', x, 0.45, -0.85, PI + 0.2, c);
  b.item('loveseat', -10.6, 0, -4.4, PI / 2, '#0f766e');
  b.item('cushion', -10.5, 0.44, -4.0, PI / 2, '#fca5a5');
  b.item('armchair', -1.6, 0, -4.6, -PI / 2, '#b45309');
  b.item('coffeetable', -6, 0, -4.4, 0, '#78350f');
  b.item('vase', -6.35, 0.42, -4.35, 0, '#1d4ed8');
  b.item('books', -5.7, 0.42, -4.5, 0.3, '#dc2626');
  b.item('mug', -5.35, 0.42, -4.25, 1.2, '#f97316');
  b.item('candle', -6.7, 0.42, -4.55);
  b.item('tvunit', -6, 0, -8.6, 0, '#3f2a1d');
  b.item('plant', -11.3, 0, -8.3, 0, '#c2410c');
  b.item('plant', -0.7, 0, -8.3, 1, '#e5e7eb');
  b.item('bookshelf', -11.75, 0, -6.6, PI / 2, '#7c2d12');
  b.item('sidetable', -8.6, 0, -0.6, 0, '#a16207');
  b.item('tablelamp', -8.6, 0.56, -0.6, 0, '#fbcfe8');
  b.item('sidetable', -3.4, 0, -0.6, 0, '#a16207');
  b.item('photoframe', -3.5, 0.56, -0.55, PI + 0.3, '#a16207');
  b.item('globe', -3.25, 0.56, -0.7, 0.4);
  b.item('dresser', -2.0, 0, -8.55, 0, '#e7e5e4');
  b.item('photoframe', -2.3, 0.9, -8.5, 0.2, '#111827');
  b.item('sculpture', -1.7, 0.9, -8.5, 0);
  b.item('flowerpot', -2.0, 0.9, -8.35, 0, '#ea580c');
  b.item('painting', -6, 1.35, -8.86, 0, '#38bdf8');
  b.item('painting', -11.87, 1.3, -2.6, PI / 2, '#a3e635', 0.8);
  b.item('painting', -0.13, 1.35, -5.6, -PI / 2, '#f472b6', 0.9);
  b.item('clock', -9.5, 2.0, -8.88, 0, '#f8fafc');
  b.item('floorlamp', -11.3, 0, -0.5, 0, '#fde68a');
  b.item('ball', -4.2, 0, -6.9, 0, '#ef4444');
  b.item('teddy', -9.0, 0, -7.9, 0.6, '#b8794a');
  b.item('cushion', -8.4, 0, -8.2, 0.4, '#c4b5fd');

  // ================= KITCHEN & DINING (x 0..12, z -9..-1) =================
  b.box(4.5, 0, -8.6, 7, 0.92, 0.7, '#f8fafc', { tex: 'wood', ts: 0.5 });
  b.box(4.5, 0.92, -8.6, 7.05, 0.06, 0.75, '#475569', { tex: 'stone' });
  b.box(3.2, 0.98, -8.65, 0.8, 0.02, 0.45, '#94a3b8', { tex: 'metal', solid: false }); // sink
  b.cyl(3.2, 0.98, -8.85, 0.05, 0.32, '#cbd5e1', { tex: 'metal', solid: false }); // tap
  b.box(6.4, 0.98, -8.6, 0.9, 0.02, 0.6, '#111827', { solid: false }); // hob
  for (const [dx, dz] of [[-0.2, -0.15], [0.2, -0.15], [-0.2, 0.15], [0.2, 0.15]]) b.cyl(6.4 + dx, 0.99, -8.6 + dz, 0.16, 0.01, '#374151', { solid: false });
  b.box(4.5, 1.65, -8.78, 7, 0.75, 0.38, '#bbf7d0', { tex: 'wood', ts: 0.5 }); // wall cabinets
  for (let x = 1.4; x < 8; x += 0.9) b.box(x, 0.78, -8.24, 0.18, 0.03, 0.03, '#94a3b8', { solid: false }); // handles
  b.item('fridge', 9.2, 0, -8.55, 0, '#f1f5f9');
  b.item('microwave', 1.7, 0.98, -8.65, 0, '#e2e8f0');
  b.item('kettle', 4.4, 0.98, -8.55, 0.3, '#ef4444');
  b.item('toaster', 5.1, 0.98, -8.6, 0, '#cbd5e1');
  b.item('jar', 7.4, 0.98, -8.75, 0, '#fef3c7');
  b.item('jar', 7.6, 0.98, -8.6, 0, '#fecaca');
  b.item('jar', 7.8, 0.98, -8.75, 0, '#bbf7d0');
  b.item('bottle', 2.5, 0.98, -8.8, 0, '#16a34a');
  b.item('bottle', 2.65, 0.98, -8.75, 0, '#facc15');
  b.item('pan', 6.4, 0.99, -8.55, 0.4, '#334155');
  b.item('pot', 6.55, 0.99, -8.75, 0, '#94a3b8');
  b.item('cutlery', 3.8, 0.98, -8.45, 0.2);
  // island + stools
  b.box(5, 0, -5, 2.6, 0.92, 1.1, '#fb923c', { tex: 'wood', ts: 0.5 });
  b.box(5, 0.92, -5, 2.7, 0.06, 1.2, '#f1f5f9', { tex: 'stone' });
  b.item('fruitbowl', 4.6, 0.98, -5.0, 0, '#a16207');
  b.item('jug', 5.3, 0.98, -5.1, 0.5, '#bae6fd');
  b.item('glass', 5.6, 0.98, -4.85);
  b.item('glass', 5.75, 0.98, -5.05);
  b.item('bowl', 4.1, 0.98, -4.8, 0, '#fde68a');
  for (const x of [4.2, 5.0, 5.8]) b.item('stool', x, 0, -4.05, 0, '#b45309');
  // dining
  b.item('diningtable', 9.6, 0, -4.4, PI / 2, '#b45309');
  for (const [x, z, r] of [[8.8, -5.2, PI / 2], [8.8, -3.6, PI / 2], [10.4, -5.2, -PI / 2], [10.4, -3.6, -PI / 2], [9.6, -2.9, PI]] as const) b.item('chair', x, 0, z, r, '#7c2d12');
  for (const [x, z] of [[9.35, -5.1], [9.35, -3.7], [9.85, -5.1], [9.85, -3.7]] as const) b.item('plate', x, 0.76, z);
  b.item('teapot', 9.6, 0.76, -4.4, 0.3, '#e0e7ff');
  b.item('wineglass', 9.55, 0.76, -4.9);
  b.item('candle', 9.6, 0.76, -3.95);
  b.item('trashbin', 11.5, 0, -7.6, 0, '#475569');
  b.item('plant', 11.4, 0, -1.6, 2, '#1e3a8a');
  b.item('clock', 11.88, 1.9, -6.8, -PI / 2, '#fde68a', 0.9);
  b.item('painting', 0.13, 1.4, -5, PI / 2, '#fb923c', 0.7);

  // ================= HALLWAY (x 0..12, z -1..2) =================
  b.item('rug', 3.4, 0.02, 0.4, PI / 2, '#14b8a6', 0.75);
  b.item('shoe', 11.4, 0, -0.6, 0.4, '#f8fafc');
  b.item('shoe', 11.2, 0, -0.75, 0.2, '#f8fafc');
  b.item('shoe', 11.5, 0, 0.75, 1.6, '#dc2626');
  b.item('backpack', 0.45, 0, -0.65, 0.5, '#16a34a');
  b.item('plant', 5.9, 0, -0.5, 3, '#c2410c');
  b.item('painting', 3, 1.4, 1.87, PI, '#facc15', 0.8);

  // ================= MASTER BEDROOM (x -12..0, z 1..9) =================
  b.item('rug', -6.3, 0.02, 5.0, 0, '#fde68a', 1.0);
  b.item('bed', -6.5, 0, 7.75, PI, '#f472b6');
  b.item('pillow', -7.0, 0.6, 8.35, PI, '#ffffff');
  b.item('pillow', -6.0, 0.6, 8.35, PI, '#ffffff');
  b.item('blanket', -6.5, 0.6, 7.0, PI, '#a78bfa');
  b.item('nightstand', -8.0, 0, 8.6, PI, '#a16207');
  b.item('nightstand', -5.0, 0, 8.6, PI, '#a16207');
  b.item('tablelamp', -8.0, 0.56, 8.6, 0, '#fde68a');
  b.item('clock', -5.0, 0.56, 8.55, PI, '#38bdf8', 0.45);
  b.item('book', -4.85, 0.56, 8.45, 0.4, '#16a34a');
  b.item('wardrobe', -11.6, 0, 5.6, PI / 2, '#d6b583');
  b.item('desk', -1.0, 0, 7.6, -PI / 2, '#e7e5e4');
  b.item('chair', -1.8, 0, 7.6, PI / 2, '#f43f5e');
  b.item('laptop', -0.95, 0.76, 7.8, -PI / 2);
  b.item('mugtray', -0.8, 0.76, 7.1);
  b.item('books', -0.9, 0.76, 8.2, 0.3, '#2563eb');
  b.item('mirror', -0.35, 0, 3.3, -PI / 2, '#d6b583');
  b.item('dresser', -11.6, 0, 2.4, PI / 2, '#fde68a');
  b.item('photoframe', -11.55, 0.9, 2.1, PI / 2, '#a16207');
  b.item('vase', -11.55, 0.9, 2.7, 0, '#be123c');
  b.item('shoe', -9.0, 0, 3.4, 1.2, '#1e293b');
  b.item('shoe', -8.75, 0, 3.55, 1.0, '#1e293b');
  b.item('backpack', -10.3, 0, 8.6, 0.2, '#7c3aed');
  b.item('teddy', -2.7, 0, 1.6, PI + 0.5, '#d6a066');
  b.item('painting', -6.5, 1.6, 8.87, PI, '#f472b6', 0.85);
  b.item('plant', -11.3, 0, 8.4, 0, '#e5e7eb');

  // ================= BATHROOM (x 6..12, z 2..9) =================
  b.item('bathtub', 9.6, 0, 8.4, PI, '#ffffff');
  b.item('duck', 10.4, 0.58, 8.1, 2.2, '#facc15');
  b.item('toilet', 6.45, 0, 4.6, PI / 2, '#ffffff');
  b.item('washbasin', 11.6, 0, 4.4, -PI / 2, '#ffffff');
  b.box(11.92, 1.1, 4.4, 0.04, 0.8, 0.6, '#cbd5e1', { tex: 'metal', solid: false }); // mirror
  b.item('soap', 11.55, 0.9, 4.1, 0, '#f0abfc');
  b.item('mug', 11.55, 0.9, 4.72, 0, '#38bdf8');
  b.box(6.2, 0, 7.0, 0.4, 0.75, 0.9, '#f8fafc', { tex: 'wood', ts: 0.4 }); // cabinet
  b.item('towel', 6.2, 0.75, 7.15, PI / 2, '#5eead4');
  b.item('towel', 6.2, 0.85, 7.1, PI / 2, '#f9a8d4');
  b.item('bottle', 6.2, 0.75, 6.7, 0, '#0ea5e9');
  b.item('bucket', 7.2, 0, 2.5, 0, '#3b82f6');
  b.item('laundry', 11.4, 0, 2.6, 0, '#fcd34d');
  b.item('rug', 9.4, 0.02, 5.6, 0, '#5eead4', 0.45);
  b.interact({ id: 'duck', kind: 'sound', label: 'Squeaky Duck', p: [10.4, 0.8, 8.1], defaultActive: false, sound: 'squeak' });

  // ================= STORAGE / UTILITY (x 0..6, z 2..9) =================
  b.item('shelfunit', 2.0, 0, 8.7, PI, '#64748b');
  b.item('shelfunit', 4.3, 0, 8.7, PI, '#64748b');
  for (const [x, y, t, c] of [[1.6, 0.06, 'cardbox', '#c8a26b'], [2.4, 0.66, 'paintcan', '#f8fafc'], [1.7, 0.66, 'paintcan', '#ef4444'], [2.2, 1.26, 'toolbox', '#dc2626'], [3.9, 0.06, 'cardbox', '#d6b583'], [4.7, 0.66, 'bucket', '#f59e0b'], [4.0, 1.26, 'jar', '#fef3c7']] as const)
    b.item(t, x, y, 8.7, PI, c, t === 'cardbox' ? 0.8 : undefined);
  b.item('washer', 0.45, 0, 4.4, PI / 2, '#f8fafc');
  b.item('washer', 0.45, 0, 5.2, PI / 2, '#f8fafc');
  b.item('laundry', 0.5, 0, 6.3, 0.3, '#fcd34d');
  b.item('cardbox', 5.3, 0, 3.0, 0.2, '#c8a26b');
  b.item('cardbox', 5.3, 0.4, 3.05, 0.5, '#d6b583', 0.85);
  b.item('cardbox', 4.6, 0, 3.0, -0.1, '#c8a26b');
  b.item('crate', 5.3, 0, 6.3, 0, '#b45309');
  b.item('bucket', 3.0, 0, 5.0, 0, '#64748b');
  b.item('cone', 3.8, 0, 6.6, 0, '#f97316');
  b.item('wateringcan', 2.4, 0, 3.0, 1.2, '#22c55e');
  b.item('ball', 3.5, 0, 3.3, 0, '#22c55e');

  // ================= UPSTAIRS: KIDS ROOM (x 0..12, z -9..-0.5) =================
  const U = UP;
  b.item('rug', 6, U + 0.02, -5, 0, '#fde047', 1.2);
  b.item('kidbed', 1.0, U, -7.6, PI / 2, '#38bdf8');
  b.item('pillow', 0.55, U + 0.55, -7.6, PI / 2, '#fef9c3', 0.75);
  b.item('kidbed', 11.0, U, -7.6, -PI / 2, '#f472b6');
  b.item('pillow', 11.45, U + 0.55, -7.6, -PI / 2, '#fef9c3', 0.75);
  b.item('desk', 6, U, -8.6, 0, '#bae6fd');
  b.item('chair', 6, U, -7.8, PI, '#facc15');
  b.item('globe', 5.6, U + 0.76, -8.6);
  b.item('books', 6.4, U + 0.76, -8.65, 0.2, '#16a34a');
  b.item('bookshelf', 3.5, U, -8.75, 0, '#f9a8d4');
  b.item('bookshelf', 8.5, U, -8.75, 0, '#a5f3fc');
  b.item('blocks', 4.6, U, -4.2, 0.3, '#facc15');
  b.item('blocks', 4.9, U, -4.0, 0.9, '#ef4444');
  b.item('robot', 7.8, U, -3.6, -0.6, '#94a3b8');
  b.item('ball', 9.3, U, -5.2, 0, '#3b82f6');
  b.item('ball', 2.2, U, -2.2, 0, '#f97316');
  b.item('toycar', 6.6, U, -2.6, 1.0, '#ef4444');
  b.item('duck', 3.4, U, -5.8, 0.4, '#facc15');
  b.item('teddy', 0.6, U + 0.55, -6.6, PI / 2, '#b8794a');
  b.item('teddy', 11.4, U, -4.0, -PI / 2, '#f9a8d4');
  b.item('backpack', 10.2, U, -1.0, PI, '#ef4444');
  b.item('cushion', 3.0, U, -1.2, 0.3, '#c4b5fd');
  b.item('cushion', 3.6, U, -1.0, 1.0, '#fca5a5');
  b.item('nightstand', 2.1, U, -8.6, 0, '#fde68a');
  b.item('tablelamp', 2.1, U + 0.56, -8.6, 0, '#a7f3d0');
  b.item('painting', 0.13, U + 1.4, -4.5, PI / 2, '#a855f7', 0.7);

  // ================= UPSTAIRS: LANDING + ATTIC PLAYROOM =================
  b.item('plant', 1.0, U, 1.8, 0, '#ea580c');
  b.item('sidetable', 0.5, U, 0.2, 0, '#a16207');
  b.item('vase', 0.5, U + 0.56, 0.2, 0, '#14b8a6');
  b.item('loveseat', 3.0, U, 8.4, PI, '#9333ea');
  b.item('cushion', 2.6, U + 0.44, 8.3, PI, '#fde68a');
  b.item('tvunit', 2.0, U, 3.9, 0, '#1e293b');
  b.item('cardbox', 10.6, U, 8.5, 0.2, '#c8a26b');
  b.item('cardbox', 11.3, U, 8.4, -0.3, '#d6b583');
  b.item('cardbox', 10.9, U + 0.4, 8.45, 0.1, '#c8a26b', 0.8);
  b.item('crate', 11.3, U, 6.8, 0.1, '#92400e');
  b.item('chair', 8.6, U, 8.3, PI + 0.4, '#a16207');
  b.item('floorlamp', 0.6, U, 8.5, 0, '#fbcfe8');
  b.item('toolbox', 9.5, U, 4.0, 0.7, '#2563eb');
  b.item('paintcan', 10.1, U, 3.8, 0, '#f472b6');
  b.item('books', 6.2, U, 8.6, 0.1, '#7c2d12');
  b.item('globe', 7.0, U, 8.6, 0);
  b.item('painting', 11.87, U + 1.1, 5.5, -PI / 2, '#22c55e', 0.8);
  b.item('rug', 4.5, U + 0.02, 6.4, 0, '#7c3aed', 0.9);
  b.item('clock', 6, U + 2.0, 8.88, PI, '#fde68a');

  return {
    id: 'house',
    bounds: { minX: -12, maxX: 12, minZ: -9, maxZ: 9 },
    floor: { c: '#c08a52', tex: 'plank' },
    sky: '#bfe3ff',
    fog: '#d8ecff',
    ambient: 0.55,
    hemi: ['#fff7ed', '#c4b5fd', 0.6],
    sun: { c: '#fff1d6', i: 1.3, dir: [-0.5, -1, -0.35] },
    hiderSpawns: [[-8, 0, -6.4], [-6, 0, -6.6], [-4, 0, -6.4], [-8.5, 0, -2.6], [-3.5, 0, -2.6], [2.4, 0, 0.2], [4.4, 0, 0.2], [-6, 0, -2.6]],
    seekerSpawns: [[4, UP, 4.5], [5.6, UP, 5.5], [7.2, UP, 4.5], [8.6, UP, 5.6]],
    props: b.props,
    items: b.items,
    interactables: b.interactables,
    lights: b.lights,
  };
}

void BOOK_COLORS;
