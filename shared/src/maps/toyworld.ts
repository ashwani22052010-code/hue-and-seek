import { MapBuilder, TOY_COLORS } from './builder';
import type { MapDef } from './types';

export function buildToyWorld(): MapDef {
  const b = new MapBuilder(404);
  const H = 5;

  b.floorRect(-18, -18, 18, 18, '#bfdbfe', 'carpet', 1.5);
  b.box(0, 0, 0, 14, 0.03, 14, '#fef3c7', { tex: 'checker', ts: 2, solid: false, decor: true });
  b.wall(-18, -18, 18, -18, H, '#fbcfe8', { tex: 'dots', ts: 1.5 });
  b.wall(-18, 18, 18, 18, H, '#c7d2fe', { tex: 'stripes', ts: 1.2 });
  b.wall(-18, -18, -18, 18, H, '#bbf7d0', { tex: 'dots', ts: 1.5 });
  b.wall(18, -18, 18, 18, H, '#fde68a', { tex: 'stripes', ts: 1.2 });

  // ---------- Giant letter blocks ----------
  const block = (x: number, y: number, z: number, s = 2) => {
    const c = b.pick(TOY_COLORS);
    b.box(x, y, z, s, s, s, c, { tex: b.pick(['dots', 'stripes', 'checker', 'none']), ts: s / 2, decor: true });
  };
  block(-14, 0, -14); block(-12, 0, -14); block(-13, 2, -14); block(-14, 0, -11.6);
  block(12, 0, 14); block(14, 0, 14); block(14, 2, 14, 1.6);
  block(-3, 0, -13, 1.6); block(-1.4, 0, -13, 1.2); block(-2.3, 1.6, -13, 1.2);
  for (let i = 0; i < 10; i++) {
    const x = -6 + b.rand() * 12, z = -9 + b.rand() * 2;
    b.box(x, 0, z, 0.8, 0.8, 0.8, b.pick(TOY_COLORS), { decor: true, tex: 'none' });
  }

  // ---------- Giant teddy ----------
  const bear = '#b8794a';
  b.sphere(11, 0, -11, 3.2, bear, { tex: 'fabric', ts: 0.6, decor: true });
  b.sphere(11, 2.7, -11.2, 2.4, bear, { tex: 'fabric', ts: 0.6 });
  b.sphere(10.1, 4.6, -11.2, 0.9, bear, { tex: 'fabric', ts: 0.6, solid: false });
  b.sphere(11.9, 4.6, -11.2, 0.9, bear, { tex: 'fabric', ts: 0.6, solid: false });
  b.sphere(11, 3.4, -10.1, 0.9, '#e7c39a', { tex: 'fabric', solid: false });
  b.sphere(11, 3.75, -9.7, 0.3, '#1f2937', { solid: false });
  for (const dx of [-0.5, 0.5]) b.sphere(11 + dx, 4.0, -10.15, 0.25, '#111827', { solid: false });
  for (const dx of [-1.7, 1.7]) b.sphere(11 + dx, 1.5, -10.6, 1.2, bear, { tex: 'fabric', ts: 0.6 });
  for (const dx of [-1, 1]) b.sphere(11 + dx, 0, -9.4, 1.3, bear, { tex: 'fabric', ts: 0.6 }, [1.3, 1.1, 1.5]);
  b.box(11, 2.2, -10, 1.2, 0.4, 0.4, '#dc2626', { solid: false, decor: true });

  // ---------- Toy shelf ----------
  const sx = -4, sz = -17.3;
  for (const y of [0, 1.4, 2.8, 4.1]) b.box(sx, y, sz, 10, 0.12, 1.2, '#f9a8d4', { tex: 'wood' });
  for (const x of [-9, 1]) b.box(x, 0, sz, 0.15, 4.2, 1.2, '#f9a8d4', { tex: 'wood' });
  for (let i = 0; i < 14; i++) {
    const lvl = i % 3, x = -8.4 + (Math.floor(i / 3) * 2.1) + b.rand() * 0.6;
    const y = [0.12, 1.52, 2.92][lvl];
    if (b.rand() < 0.5) b.sphere(x, y, sz, 0.8, b.pick(TOY_COLORS), { tex: 'fabric', decor: true });
    else b.box(x, y, sz, 0.7, 0.7, 0.7, b.pick(TOY_COLORS), { tex: 'dots', ts: 0.35, decor: true });
  }

  // ---------- Ball pit ----------
  const px = -9, pz = 8;
  for (const [x, z, w, d] of [[px, pz - 3, 6.3, 0.3], [px, pz + 3, 6.3, 0.3], [px - 3, pz, 0.3, 6], [px + 3, pz, 0.3, 6]] as const)
    b.box(x, 0, z, w, 0.8, d, '#38bdf8', { tex: 'stripes', ts: 0.5 });
  for (let i = 0; i < 170; i++) {
    const x = px - 2.6 + b.rand() * 5.2, z = pz - 2.6 + b.rand() * 5.2, y = b.rand() * 0.35;
    b.sphere(x, y, z, 0.42, b.pick(TOY_COLORS), { solid: false, decor: i % 4 === 0 });
  }

  // ---------- Crayon forest ----------
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++) {
      const x = 6 + i * 1.7 + (j % 2) * 0.5, z = 6 + j * 1.6, h = 2.4 + b.rand() * 1.6;
      const c = b.pick(TOY_COLORS);
      b.cyl(x, 0, z, 0.6, h, c, { tex: 'stripes', ts: 0.8, decor: true });
      b.cone(x, h, z, 0.6, 0.6, c, { solid: false });
    }

  // ---------- Toy train ----------
  b.box(0, 0, -4, 20, 0.04, 1.4, '#78350f', { tex: 'stripes', ts: 0.5, solid: false });
  b.box(-6, 0.3, -4, 2.2, 1.0, 1.2, '#dc2626', { tex: 'none' });
  b.pipe(-5.4, 1.75, -4, 0.9, 1.4, 'x', '#1f2937', { solid: false });
  b.box(-7, 1.3, -4, 1, 1.0, 1.2, '#dc2626');
  b.cyl(-4.9, 1.3, -4, 0.35, 0.8, '#111827');
  for (let k = 0; k < 3; k++) {
    const x = -3 + k * 2.6;
    b.box(x, 0.3, -4, 2.2, 0.9, 1.2, b.pick(['#2563eb', '#16a34a', '#facc15', '#a855f7']), { decor: true });
    b.box(x, 1.2, -4, 2.0, 0.4, 1.0, b.pick(TOY_COLORS), { tex: 'checker', ts: 0.3, decor: true, solid: false });
  }
  for (let x = -7; x < 5; x += 1.3)
    for (const dz of [-0.62, 0.62]) b.pipe(x, 0.3, -4 + dz, 0.6, 0.14, 'z', '#111827', { solid: false });

  // ---------- Rubber duck (squeaky) ----------
  b.sphere(-14, 0, 14, 2.2, '#facc15', { decor: true }, [2.6, 1.8, 2.2]);
  b.sphere(-14.6, 1.4, 14, 1.4, '#facc15');
  b.sphere(-15.5, 1.9, 14, 0.7, '#f97316', { solid: false }, [0.8, 0.35, 0.6]);
  b.sphere(-15, 2.3, 13.55, 0.22, '#111827', { solid: false });
  b.sphere(-15, 2.3, 14.45, 0.22, '#111827', { solid: false });
  b.interact({ id: 'duck', kind: 'sound', label: 'Squeaky Duck', p: [-13, 1, 12.6], defaultActive: false, sound: 'squeak' });

  // ---------- Toy piano ----------
  b.box(14.5, 0, 3, 1.4, 1.1, 3, '#f472b6', { tex: 'none' });
  b.box(14.1, 1.1, 3, 0.6, 0.06, 2.6, '#ffffff', { tex: 'stripes', ts: 0.1, solid: false });
  b.interact({ id: 'toypiano', kind: 'sound', label: 'Toy Piano', p: [13.3, 1, 3], defaultActive: false, sound: 'piano' });

  // ---------- Dollhouse ----------
  const dx = -12.5, dz = -3;
  b.box(dx, 0, dz - 2, 5, 3.2, 0.15, '#fde68a', { tex: 'brick', ts: 0.5 });
  b.box(dx - 2.5, 0, dz, 0.15, 3.2, 4, '#fde68a', { tex: 'brick', ts: 0.5 });
  b.box(dx + 2.5, 0, dz - 0.8, 0.15, 3.2, 2.4, '#fde68a', { tex: 'brick', ts: 0.5 });
  b.box(dx, 1.55, dz, 5, 0.12, 4, '#f472b6', { tex: 'plank', ts: 0.4 });
  b.box(dx, 3.2, dz, 5.4, 0.15, 4.4, '#be123c', { tex: 'stripes', ts: 0.5 });
  b.box(dx - 1.3, 0, dz - 1.4, 1, 0.5, 0.6, '#60a5fa', { decor: true });
  b.box(dx + 1.2, 1.67, dz - 1.4, 1.2, 0.4, 0.8, '#a78bfa', { decor: true });
  b.stairs({ x: dx + 2.1, z: dz + 1.7, r: 2 }, 0.6, 5, 0.31, 0.5, '#f9a8d4');

  // ---------- Stacking rings ----------
  for (let i = 0; i < 6; i++) b.cyl(2, i * 0.45, 13, 2.4 - i * 0.3, 0.45, TOY_COLORS[i], { decor: true });
  b.cyl(2, 2.7, 13, 0.25, 0.9, '#facc15', { solid: false });
  b.sphere(2, 3.5, 13, 0.6, '#ef4444', { solid: false });

  // ---------- Dominoes ----------
  for (let i = 0; i < 9; i++) b.box(-4 + i * 0.8 + 6, 0, 16.4 - (i % 2) * 0.2, 0.18, 1.4, 0.7, '#f8fafc', { tex: 'dots', ts: 0.25, decor: true });

  // ---------- Toy car ----------
  b.box(13, 0.35, -2, 2.6, 0.8, 1.6, '#2563eb', { decor: true });
  b.box(12.8, 1.15, -2, 1.4, 0.6, 1.4, '#93c5fd', { solid: false });
  for (const [ox, oz] of [[-0.9, -0.85], [0.9, -0.85], [-0.9, 0.85], [0.9, 0.85]] as const)
    b.pipe(13 + ox, 0.35, -2 + oz, 0.7, 0.2, 'z', '#111827', { solid: false });

  // ---------- Moon night-light ----------
  b.sphere(-16.4, 3.2, -16.4, 1.2, '#fef9c3', { glow: true, solid: false, group: 'lamp_moon' });
  b.light([-15.8, 3.6, -15.8], '#fff6c2', 9, 14, 'lamp_moon');
  b.interact({ id: 'lamp_moon', kind: 'lamp', label: 'Moon Light', p: [-16, 1, -16], defaultActive: true });
  b.cyl(-16.4, 0, -16.4, 0.3, 3.2, '#e2e8f0', { tex: 'metal' });

  // cushions & extras
  for (const [x, z, c] of [[5, -14, '#a78bfa'], [7, -15, '#f472b6'], [-15, 3, '#34d399']] as const)
    b.sphere(x, 0, z, 1.4, c, { tex: 'fabric', decor: true }, [1.6, 0.8, 1.6]);
  b.cone(15, 0, -15, 2, 3, '#22c55e', { tex: 'dots', ts: 0.5, decor: true }); // toy tree
  b.cone(15.8, 0, 9, 1.4, 2, '#ef4444', { tex: 'stripes', ts: 0.5, decor: true });
  b.sphere(-5, 0, 13, 1.6, '#f97316', { tex: 'stripes', ts: 0.8, decor: true }); // beach ball


  // ---------- ceiling, lights, extra toys ----------
  b.ceiling(-18, -18, 18, 18, H, '#e9d5ff', 0.25, 'dots');
  b.light([0, 4.2, 0], '#fff5f5', 10, 22);
  for (const [x, z] of [[-9, -9], [9, -9], [-9, 9], [9, 9], [0, 0]] as const) b.box(x, H - 0.06, z, 1.4, 0.06, 1.4, '#fffbeb', { glow: true, solid: false });
  for (const [x, z, c] of [[-2, 7, '#ef4444'], [5, -7, '#3b82f6'], [-12, 1, '#22c55e'], [9, 3, '#facc15'], [-6, -15, '#a855f7']] as const) b.item('ball', x, 0, z, 0, c);
  for (const [x, z, c] of [[-1, -10.5, '#b8794a'], [7.5, -14.6, '#f9a8d4'], [-15.6, 6.5, '#d6a066']] as const) b.item('teddy', x, 0, z, 0.5, c);
  for (const [x, z] of [[3, 9.2], [-3.4, -6.4], [12.6, -5.8], [-15, -8]] as const) b.item('blocks', x, 0, z, 0.6, b.pick(['#facc15', '#ef4444', '#3b82f6', '#22c55e']));
  for (const [x, z] of [[-7.5, 2.6], [11, -6.2], [6.4, 13.6]] as const) b.item('toycar', x, 0, z, 1.1, b.pick(['#2563eb', '#ef4444', '#16a34a']));
  for (const [x, z] of [[1.2, -15.8], [-10.4, -14.6], [15.3, 0.4]] as const) b.item('robot', x, 0, z, 0.3, '#94a3b8');
  for (const [x, z] of [[-11.8, 12.3], [-13.4, 11.6]] as const) b.item('duck', x, 0, z, 0.8, '#facc15');
  b.item('cushion', 4.2, 0, -12.8, 0.4, '#a78bfa');
  b.item('backpack', 13.6, 0, 6.8, -0.4, '#ec4899');
  b.item('bucket', 9.6, 0, 15.2, 0, '#22c55e');
  b.item('painting', -17.85, 2.4, -6, Math.PI / 2, '#38bdf8', 1.6);
  b.item('clock', 0, 3.4, -17.86, 0, '#fde68a', 2.2);

  return {
    id: 'toyworld',
    bounds: { minX: -18, maxX: 18, minZ: -18, maxZ: 18 },
    floor: { c: '#bfdbfe', tex: 'carpet' },
    sky: '#f5d0fe',
    fog: '#fae8ff',
    ambient: 0.62,
    hemi: ['#fdf4ff', '#93c5fd', 0.6],
    sun: { c: '#fff5f5', i: 1.45, dir: [0.5, -1, 0.4] },
    hiderSpawns: [[-4, 0, 3], [-2, 0, 3], [0, 0, 3], [2, 0, 3], [4, 0, 3], [-4, 0, 5], [0, 0, 5], [4, 0, 5]],
    seekerSpawns: [[14, 0, 11], [15.6, 0, 11], [14, 0, 12.4], [12.6, 0, 12.2]],
    props: b.props,
    items: b.items,
    interactables: b.interactables,
    lights: b.lights,
  };
}
