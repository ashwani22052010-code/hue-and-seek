import { MapBuilder } from './builder';
import type { MapDef } from './types';

export function buildHouse(): MapDef {
  const b = new MapBuilder(101);
  const H = 3.2;
  const wallC = '#f5ead6';

  // Floors
  b.floorRect(-14, -11, 2, 1, '#c08a52', 'plank', 1.2); // living
  b.floorRect(2, -11, 14, 1, '#e8e4dc', 'tile', 0.8); // kitchen
  b.floorRect(-14, 1, -2, 11, '#93c5fd', 'carpet', 1); // bedroom
  b.floorRect(-2, 1, 14, 11, '#a87444', 'plank', 1.2); // hall

  // Exterior walls
  b.wall(-14, -11, 14, -11, H, wallC, { tex: 'noise', ts: 2 });
  b.wall(-14, 11, 14, 11, H, wallC, { tex: 'noise', ts: 2 });
  b.wall(-14, -11, -14, 11, H, wallC, { tex: 'noise', ts: 2 });
  b.wall(14, -11, 14, 11, H, wallC, { tex: 'noise', ts: 2 });
  // Interior walls
  b.wall(-14, 1, 14, 1, H, '#fde7c7', { tex: 'noise', ts: 2, gaps: [{ at: 6, w: 1.2, h: 2.2 }, { at: 13, w: 3, h: 2.6 }, { at: 22, w: 2.4, h: 2.6 }] });
  b.wall(2, -11, 2, 1, H, '#d9f99d', { tex: 'stripes', ts: 1.5, gaps: [{ at: 4.5, w: 3 }] });
  b.wall(-2, 1, -2, 11, H, '#bfdbfe', { tex: 'dots', ts: 1, gaps: [] });

  // Interactive bedroom door
  b.box(-7.4, 0, 1, 1.2, 2.2, 0.08, '#92400e', { tex: 'wood', group: 'door_bed' });
  b.interact({ id: 'door_bed', kind: 'door', label: 'Bedroom Door', p: [-7.4, 1, 1], defaultActive: false, hinge: [-8, 1], openAngle: Math.PI / 2 });

  // ---------- Living room ----------
  b.box(-6, 0, -5, 5, 0.03, 3.6, '#be123c', { tex: 'fabric', solid: false, decor: true });
  b.sofa({ x: -6, z: -2.4, r: 2 }, '#64748b', 2.6);
  b.table({ x: -6, z: -5, r: 0 }, 1.4, 0.8, 0.45, '#78350f');
  b.sphere(-6.3, 0.45, -5, 0.25, '#f97316', { decor: true, solid: false });
  b.box(-5.7, 0.45, -5.1, 0.35, 0.05, 0.25, '#1e293b', { solid: false });
  b.armchair({ x: -10, z: -5, r: 3 }, '#0f766e');
  b.armchair({ x: -2.4, z: -5.4, r: 1 }, '#b45309');
  b.box(-6, 0, -10.4, 2.8, 0.55, 0.55, '#3f2a1d', { tex: 'wood' });
  b.box(-6, 0.55, -10.5, 2.0, 1.1, 0.1, '#111827');
  b.box(-6, 0.65, -10.44, 1.85, 0.95, 0.02, '#1d4ed8', { solid: false, glow: true, decor: true });
  b.bookshelf({ x: -13.6, z: -7, r: 3 }, 2.6, 2.4, '#7c2d12', 5);
  b.bookshelf({ x: -13.6, z: -2.4, r: 3 }, 1.6, 1.2, '#a16207', 2);
  b.lamp({ x: -12.6, z: -0.6, r: 0 }, 0, 0, 'lamp_living', '#fde68a');
  b.plant({ x: 0, z: 0, r: 0 }, -13.1, -10.2, 1.1);
  b.plant({ x: 0, z: 0, r: 0 }, 1.1, -10.2, 1.0);
  b.sphere(-1.2, 0, -9.3, 1.1, '#f43f5e', { tex: 'fabric', decor: true }, [1.3, 0.75, 1.3]); // beanbag
  b.box(-11.2, 0, -10.5, 2, 0.9, 0.6, '#e7e5e4', { tex: 'wood' }); // sideboard
  b.box(-11.6, 0.9, -10.5, 0.3, 0.45, 0.3, '#0ea5e9', { decor: true, solid: false });
  b.box(-10.8, 0.9, -10.6, 0.6, 0.5, 0.06, '#fbbf24', { decor: true, solid: false });
  b.box(-1, 0, -1.2, 1, 0.6, 0.6, '#f59e0b', { tex: 'plank', decor: true }); // toy chest
  b.box(-13.85, 1.2, -4.8, 0.05, 1.0, 1.4, '#38bdf8', { solid: false, decor: true }); // painting
  b.box(-13.85, 1.4, -9.6, 0.05, 0.8, 1.0, '#a3e635', { solid: false, decor: true, tex: 'stripes' });

  // ---------- Kitchen ----------
  b.box(8.5, 0, -10.5, 7, 0.92, 0.7, '#f8fafc', { tex: 'wood' });
  b.box(8.5, 0.92, -10.5, 7.05, 0.06, 0.75, '#475569', { tex: 'stone' });
  b.box(7, 0.98, -10.6, 0.8, 0.05, 0.5, '#94a3b8', { tex: 'metal', solid: false }); // sink
  b.box(10.3, 0.98, -10.55, 0.9, 0.04, 0.6, '#111827', { solid: false }); // stove
  b.box(8.5, 1.7, -10.7, 7, 0.8, 0.4, '#bbf7d0', { tex: 'wood' }); // upper cabinets
  b.box(13.3, 0, -10.3, 1.1, 2.1, 0.9, '#e2e8f0', { tex: 'metal' }); // fridge
  b.box(13.3, 1.3, -9.83, 0.06, 0.35, 0.04, '#64748b', { solid: false });
  b.box(8, 0, -6, 2.6, 0.92, 1.2, '#fb923c', { tex: 'wood' }); // island
  b.box(8, 0.92, -6, 2.7, 0.06, 1.3, '#f1f5f9', { tex: 'stone' });
  for (const [x, c] of [[7.6, '#ef4444'], [7.9, '#facc15'], [8.15, '#22c55e']] as const) b.sphere(x, 0.98, -6, 0.18, c, { decor: true, solid: false });
  b.cyl(6.6, 0, -4.9, 0.4, 0.7, '#0f172a', { tex: 'metal' }); // stool
  b.cyl(9.4, 0, -4.9, 0.4, 0.7, '#0f172a', { tex: 'metal' });
  b.table({ x: 8, z: -1.6, r: 0 }, 2.0, 1.0, 0.78, '#d97706');
  b.chair({ x: 7.4, z: -2.5, r: 0 }, '#7c2d12');
  b.chair({ x: 8.6, z: -2.5, r: 0 }, '#7c2d12');
  b.chair({ x: 7.4, z: -0.7, r: 2 }, '#7c2d12');
  b.chair({ x: 8.6, z: -0.7, r: 2 }, '#7c2d12');
  b.cyl(13.2, 0, -7.6, 0.5, 0.75, '#22c55e', { tex: 'metal', decor: true }); // bin
  b.box(13.4, 0, -4, 1, 1.6, 0.5, '#fef3c7', { tex: 'wood' }); // pantry
  b.box(13.4, 1.6, -4, 1, 0.3, 0.5, '#fde047', { decor: true });
  b.plant({ x: 0, z: 0, r: 0 }, 13, 0, 0.9);
  b.box(3, 0, -10.5, 1, 0.92, 0.7, '#e2e8f0', { tex: 'metal' }); // dishwasher

  // ---------- Bedroom ----------
  b.bed({ x: -11, z: 8.4, r: 2 }, '#7c3aed', '#f472b6');
  b.box(-12.8, 0, 10.2, 0.6, 0.6, 0.5, '#a16207', { tex: 'wood' });
  b.cyl(-12.8, 0.6, 10.2, 0.25, 0.35, '#fde68a', { glow: true, solid: false });
  b.box(-2.7, 0, 9.4, 1.0, 2.2, 1.6, '#e9d5ff', { tex: 'wood' }); // wardrobe
  b.table({ x: -7.6, z: 10.3, r: 0 }, 1.6, 0.7, 0.75, '#fafaf9');
  b.box(-7.6, 0.75, 10.4, 0.6, 0.4, 0.05, '#111827', { solid: false });
  b.chair({ x: -7.6, z: 9.5, r: 2 }, '#f43f5e');
  b.box(-4.8, 0, 2.3, 1.2, 0.7, 0.7, '#38bdf8', { tex: 'dots', decor: true }); // toy box
  b.box(-8.5, 0, 5.5, 4, 0.03, 3, '#fde68a', { tex: 'stripes', solid: false, decor: true });
  b.sphere(-4.3, 0, 6, 1.2, '#22d3ee', { tex: 'fabric', decor: true }, [1.3, 0.75, 1.3]);
  b.bookshelf({ x: -13.6, z: 3.6, r: 3 }, 2.0, 1.8, '#fbcfe8', 3);
  b.sphere(-5.8, 0, 4.2, 0.6, '#f97316', { decor: true }); // ball
  b.box(-13.85, 1.4, 7.5, 0.05, 0.9, 1.5, '#fda4af', { solid: false, decor: true, tex: 'dots' });

  // ---------- Hall, stairs, loft ----------
  b.stairs({ x: -0.6, z: 10.1, r: 3 }, 1.6, 7, 0.3, 0.68, '#92400e');
  b.box(9.2, 1.9, 8, 9.6, 0.2, 6, '#b45309', { tex: 'plank' }); // loft floor
  b.box(9.2, 2.1, 5.05, 9.6, 0.55, 0.08, '#78350f', { tex: 'wood' }); // railing
  b.box(4.45, 2.1, 6.6, 0.08, 0.55, 3, '#78350f', { tex: 'wood' });
  for (let x = 5; x <= 13.5; x += 2.1) b.box(x, 0, 5.15, 0.15, 1.9, 0.15, '#78350f', { tex: 'wood' }); // posts
  // loft contents
  b.sphere(7, 2.1, 9.5, 1.2, '#a3e635', { tex: 'fabric', decor: true }, [1.3, 0.75, 1.3]);
  b.sphere(9, 2.1, 10, 1.2, '#f472b6', { tex: 'fabric', decor: true }, [1.3, 0.75, 1.3]);
  b.crate(12.6, 2.1, 10.2, 0.9, '#d6a35c');
  b.crate(12.6, 3.0, 10.2, 0.6, '#c08a4a');
  b.crate(13.3, 2.1, 7.8, 0.7, '#d6a35c');
  b.lamp({ x: 11, z: 6.2, r: 0 }, 0, 0, 'lamp_loft', '#c4b5fd', 2.1, '#d8c8ff');
  b.box(10.5, 2.1, 10.6, 2, 0.5, 0.5, '#0ea5e9', { tex: 'fabric', decor: true });
  // under loft storage
  b.crate(13.2, 0, 10.2, 1.0);
  b.crate(12.1, 0, 10.4, 0.8, '#ca8a04');
  b.crate(13.3, 0, 9.1, 0.7, '#a16207');
  b.box(8.5, 0, 10.5, 0.9, 0.95, 0.8, '#f1f5f9', { tex: 'metal' }); // washer
  b.cyl(8.5, 0.35, 10.1, 0.5, 0.5, '#94a3b8', { solid: false });
  b.cyl(9.8, 0, 10.4, 0.6, 0.55, '#fcd34d', { tex: 'fabric', decor: true }); // basket
  // bathroom corner
  b.box(12.4, 0, 2.2, 2.6, 0.6, 1.1, '#ffffff', { tex: 'tile', ts: 0.5 }); // tub
  b.box(12.4, 0.55, 2.2, 2.3, 0.06, 0.8, '#7dd3fc', { solid: false });
  b.cyl(10.8, 0, 1.6, 0.45, 0.45, '#ffffff');
  b.box(10.8, 0.2, 1.3, 0.5, 0.6, 0.2, '#ffffff');
  b.box(7.6, 0, 1.4, 0.7, 0.85, 0.45, '#f8fafc', { tex: 'wood' });
  b.box(7.6, 1.2, 1.18, 0.6, 0.8, 0.04, '#bae6fd', { solid: false, glow: true });
  b.plant({ x: 0, z: 0, r: 0 }, 0.2, 2, 0.8);
  b.box(2.5, 0, 5, 1.3, 0.03, 4, '#14b8a6', { tex: 'stripes', solid: false, decor: true }); // runner
  b.box(-1.6, 0, 3, 0.5, 1.0, 1.2, '#e7e5e4', { tex: 'wood' }); // shoe cabinet
  b.cyl(1.5, 0, 7.8, 0.35, 0.6, '#1d4ed8', { decor: true }); // umbrella stand

  return {
    id: 'house',
    bounds: { minX: -14, maxX: 14, minZ: -11, maxZ: 11 },
    floor: { c: '#c08a52', tex: 'plank' },
    sky: '#bfe3ff',
    fog: '#d8ecff',
    ambient: 0.55,
    hemi: ['#fff7ed', '#a78bfa', 0.55],
    sun: { c: '#fff1d6', i: 1.5, dir: [-0.5, -1, -0.35] },
    hiderSpawns: [[-11, 0, -7.6], [-9, 0, -7.6], [-7, 0, -7.6], [-5, 0, -7.6], [-3, 0, -7.6], [-11, 0, -1], [-9.4, 0, -1], [-1.2, 0, -3.4]],
    seekerSpawns: [[4, 0, -8], [4, 0, -6], [4, 0, -4], [3.6, 0, -2]],
    props: b.props,
    interactables: b.interactables,
    lights: b.lights,
  };
}
