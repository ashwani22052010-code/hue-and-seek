// Procedural, optimised 3D models for every object in shared/src/props/registry.ts.
// Each model is a list of parts; parts are grouped by material kind so a whole map of objects
// renders in a handful of draw calls. Front of every object = +z, bottom at y = 0.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export type MatKind = 'std' | 'shiny' | 'metal' | 'glass' | 'glow' | 'wood' | 'fabric';
type Geo =
  | ['rbox', number, number, number, number?]
  | ['box', number, number, number]
  | ['cyl', number, number, number, number?]
  | ['sph', number, number?, number?]
  | ['lathe', [number, number][], number?]
  | ['torus', number, number, number?]
  | ['cone', number, number, number?]
  | ['cap', number, number];
type V3 = [number, number, number];
/** [geometry, material kind, colour ('main' = item colour), position (centre), rotation, scale] */
type Part = [Geo, MatKind, string, V3?, V3?, V3?];

const WHITE = '#f8fafc', DARK = '#1f2937', STEEL = '#cbd5e1', GOLD = '#f59e0b', SOIL = '#3f2a1d', LEAF = '#16a34a';

// ---------- reusable shapes ----------
const vessel = (pts: [number, number][], kind: MatKind = 'shiny', color = 'main'): Part => [['lathe', pts], kind, color];
const legs4 = (w: number, d: number, h: number, t: number, color = 'main', kind: MatKind = 'wood'): Part[] =>
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => [['cyl', t / 2, t / 2.4, h, 8], kind, color, [sx * (w / 2 - t), h / 2, sz * (d / 2 - t)]] as Part);
const handle = (x: number, y: number, r: number, color = 'main', kind: MatKind = 'shiny'): Part => [['torus', r, r * 0.22, Math.PI], kind, color, [x, y, 0], [0, 0, -Math.PI / 2]];
const cushionSeat = (w: number, d: number, y: number, color = 'main'): Part => [['rbox', w, 0.16, d, 0.06], 'fabric', color, [0, y, 0]];

const MODELS: Record<string, Part[]> = {
  // ---------------- kitchen ----------------
  jug: [vessel([[0.001, 0], [0.08, 0], [0.085, 0.02], [0.08, 0.18], [0.065, 0.25], [0.07, 0.29], [0.072, 0.3], [0.066, 0.3], [0.06, 0.25], [0.074, 0.18], [0.075, 0.02], [0.001, 0.01]], 'glass'),
    [['torus', 0.07, 0.012, Math.PI], 'glass', 'main', [-0.08, 0.16, 0], [0, 0, Math.PI / 2]], [['cyl', 0.07, 0.072, 0.14, 16], 'shiny', '#38bdf8', [0, 0.085, 0], undefined, [1, 1, 1]]],
  mug: [vessel([[0.001, 0], [0.045, 0], [0.05, 0.01], [0.05, 0.11], [0.044, 0.11], [0.044, 0.015], [0.001, 0.015]]), handle(0.055, 0.058, 0.03)],
  glass: [vessel([[0.001, 0], [0.032, 0], [0.034, 0.01], [0.04, 0.14], [0.036, 0.14], [0.03, 0.012], [0.001, 0.012]], 'glass', '#e0f2fe')],
  wineglass: [vessel([[0.001, 0], [0.035, 0], [0.035, 0.006], [0.005, 0.01], [0.005, 0.1], [0.03, 0.12], [0.038, 0.16], [0.032, 0.2], [0.028, 0.2], [0.033, 0.16], [0.001, 0.115]], 'glass', '#e0f2fe')],
  plate: [vessel([[0.001, 0], [0.06, 0], [0.085, 0.008], [0.12, 0.02], [0.13, 0.03], [0.12, 0.028], [0.08, 0.014], [0.001, 0.012]])],
  bowl: [vessel([[0.001, 0], [0.04, 0], [0.04, 0.008], [0.07, 0.03], [0.09, 0.08], [0.083, 0.08], [0.064, 0.035], [0.001, 0.016]])],
  bottle: [vessel([[0.001, 0], [0.036, 0], [0.04, 0.01], [0.04, 0.19], [0.03, 0.23], [0.014, 0.25], [0.014, 0.29], [0.001, 0.29]], 'glass'),
    [['cyl', 0.016, 0.016, 0.02, 10], 'shiny', '#facc15', [0, 0.295, 0]], [['cyl', 0.041, 0.041, 0.07, 16], 'std', WHITE, [0, 0.11, 0]]],
  kettle: [vessel([[0.001, 0], [0.09, 0], [0.1, 0.03], [0.095, 0.15], [0.07, 0.19], [0.03, 0.2], [0.001, 0.2]]),
    [['cyl', 0.015, 0.022, 0.12, 8], 'shiny', 'main', [0.1, 0.13, 0], [0, 0, -0.9]], [['torus', 0.06, 0.012, Math.PI], 'shiny', DARK, [0, 0.2, 0], [0, Math.PI / 2, 0]],
    [['sph', 0.018], 'shiny', DARK, [0, 0.205, 0]]],
  teapot: [[['sph', 0.08, 16, 12], 'shiny', 'main', [0, 0.09, 0], undefined, [1.25, 1, 1.15]], [['cyl', 0.012, 0.022, 0.1, 8], 'shiny', 'main', [0.11, 0.1, 0], [0, 0, -0.9]],
    handle(-0.1, 0.1, 0.045), [['cyl', 0.05, 0.06, 0.03, 14], 'shiny', 'main', [0, 0.16, 0]], [['sph', 0.016], 'shiny', GOLD, [0, 0.185, 0]]],
  toaster: [[['rbox', 0.28, 0.18, 0.16, 0.04], 'metal', 'main', [0, 0.09, 0]], [['box', 0.18, 0.02, 0.03], 'std', DARK, [0, 0.18, -0.035]], [['box', 0.18, 0.02, 0.03], 'std', DARK, [0, 0.18, 0.035]],
    [['box', 0.015, 0.03, 0.03], 'std', DARK, [0.14, 0.13, 0]], ...legs4(0.24, 0.12, 0.01, 0.02, DARK, 'std')],
  microwave: [[['rbox', 0.5, 0.29, 0.36, 0.03], 'shiny', 'main', [0, 0.145, 0]], [['box', 0.32, 0.2, 0.01], 'glass', '#1e293b', [-0.06, 0.15, 0.181]],
    [['box', 0.1, 0.22, 0.01], 'std', DARK, [0.18, 0.15, 0.181]], [['box', 0.06, 0.02, 0.012], 'glow', '#22c55e', [0.18, 0.23, 0.186]]],
  fruitbowl: [vessel([[0.001, 0], [0.08, 0], [0.15, 0.08], [0.17, 0.1], [0.16, 0.1], [0.14, 0.08], [0.001, 0.012]], 'wood'),
    [['sph', 0.05], 'shiny', '#ef4444', [0.05, 0.08, 0.02]], [['sph', 0.05], 'shiny', '#facc15', [-0.05, 0.08, 0.03]], [['sph', 0.045], 'shiny', '#22c55e', [0, 0.1, -0.05]],
    [['sph', 0.04], 'shiny', '#f97316', [0.03, 0.13, -0.01]]],
  jar: [vessel([[0.001, 0], [0.055, 0], [0.06, 0.01], [0.06, 0.15], [0.05, 0.165], [0.05, 0.17], [0.001, 0.17]], 'glass'), [['cyl', 0.055, 0.055, 0.03, 16], 'shiny', '#78350f', [0, 0.185, 0]],
    [['cyl', 0.057, 0.057, 0.09, 16], 'std', 'main', [0, 0.07, 0]]],
  pan: [vessel([[0.001, 0], [0.11, 0], [0.13, 0.05], [0.125, 0.05], [0.105, 0.008], [0.001, 0.008]], 'metal'), [['rbox', 0.2, 0.025, 0.035, 0.012], 'wood', '#3f2a1d', [0.23, 0.04, 0]]],
  pot: [vessel([[0.001, 0], [0.13, 0], [0.135, 0.01], [0.135, 0.2], [0.128, 0.2], [0.128, 0.012], [0.001, 0.012]], 'metal'), [['cyl', 0.135, 0.135, 0.02, 20], 'metal', 'main', [0, 0.21, 0]],
    [['sph', 0.02], 'shiny', DARK, [0, 0.23, 0]], [['torus', 0.03, 0.008, Math.PI], 'metal', 'main', [0.15, 0.17, 0], [0, 0, -Math.PI / 2]], [['torus', 0.03, 0.008, Math.PI], 'metal', 'main', [-0.15, 0.17, 0], [0, 0, Math.PI / 2]]],
  cutlery: [[['rbox', 0.02, 0.008, 0.16, 0.004], 'metal', STEEL, [-0.015, 0.005, 0]], [['sph', 0.016], 'metal', STEEL, [-0.015, 0.006, 0.09], undefined, [1, 0.3, 1.5]],
    [['rbox', 0.02, 0.008, 0.18, 0.004], 'metal', STEEL, [0.02, 0.005, 0.01]], [['box', 0.025, 0.004, 0.04], 'metal', STEEL, [0.02, 0.006, 0.11]]],
  trashbin: [vessel([[0.001, 0], [0.14, 0], [0.165, 0.46], [0.17, 0.47], [0.16, 0.47], [0.13, 0.02], [0.001, 0.02]], 'shiny'), [['cyl', 0.175, 0.175, 0.04, 20], 'shiny', DARK, [0, 0.49, 0]],
    [['box', 0.06, 0.06, 0.02], 'metal', STEEL, [0, 0.42, 0.165]]],
  fridge: [[['rbox', 0.8, 1.9, 0.68, 0.05], 'shiny', 'main', [0, 0.95, 0]], [['box', 0.78, 0.01, 0.01], 'std', '#94a3b8', [0, 1.25, 0.345]],
    [['rbox', 0.03, 0.4, 0.04, 0.012], 'metal', STEEL, [0.3, 1.5, 0.36]], [['rbox', 0.03, 0.5, 0.04, 0.012], 'metal', STEEL, [0.3, 0.85, 0.36]], [['box', 0.12, 0.06, 0.01], 'glow', '#38bdf8', [-0.2, 1.6, 0.345]]],
  stool: [[['cyl', 0.19, 0.19, 0.05, 20], 'wood', 'main', [0, 0.635, 0]], ...[0, 1, 2, 3].map((i) => [['cyl', 0.015, 0.02, 0.62, 6], 'wood', 'main', [Math.cos(i * 1.57 + 0.78) * 0.13, 0.31, Math.sin(i * 1.57 + 0.78) * 0.13], [Math.sin(i * 1.57 + 0.78) * 0.12, 0, -Math.cos(i * 1.57 + 0.78) * 0.12]] as Part),
    [['torus', 0.12, 0.01, Math.PI * 2], 'metal', STEEL, [0, 0.22, 0], [Math.PI / 2, 0, 0]]],
  can: [[['cyl', 0.04, 0.04, 0.11, 16], 'metal', STEEL, [0, 0.06, 0]], [['cyl', 0.0405, 0.0405, 0.08, 16], 'shiny', 'main', [0, 0.06, 0]]],
  cereal: [[['rbox', 0.2, 0.3, 0.07, 0.008], 'std', 'main', [0, 0.15, 0]], [['box', 0.14, 0.12, 0.005], 'std', WHITE, [0, 0.18, 0.036]], [['sph', 0.035], 'std', '#facc15', [0, 0.17, 0.04], undefined, [1, 1, 0.2]]],

  // ---------------- furniture ----------------
  chair: [cushionSeat(0.44, 0.44, 0.47, 'main'), ...legs4(0.44, 0.44, 0.45, 0.04), [['rbox', 0.44, 0.46, 0.04, 0.02], 'wood', 'main', [0, 0.73, -0.2], [-0.08, 0, 0]],
    [['box', 0.3, 0.05, 0.02], 'wood', 'main', [0, 0.85, -0.18]]],
  armchair: [[['rbox', 0.86, 0.42, 0.82, 0.08], 'fabric', 'main', [0, 0.21, 0]], [['rbox', 0.66, 0.16, 0.62, 0.07], 'fabric', 'main', [0, 0.48, 0.06]],
    [['rbox', 0.86, 0.5, 0.18, 0.08], 'fabric', 'main', [0, 0.63, -0.32]], [['rbox', 0.14, 0.32, 0.76, 0.06], 'fabric', 'main', [-0.36, 0.56, 0]], [['rbox', 0.14, 0.32, 0.76, 0.06], 'fabric', 'main', [0.36, 0.56, 0]],
    ...legs4(0.8, 0.76, 0.06, 0.05, DARK, 'wood')],
  sofa: [[['rbox', 2.1, 0.36, 0.86, 0.08], 'fabric', 'main', [0, 0.24, 0]], [['rbox', 0.92, 0.16, 0.66, 0.07], 'fabric', 'main', [-0.47, 0.5, 0.08]], [['rbox', 0.92, 0.16, 0.66, 0.07], 'fabric', 'main', [0.47, 0.5, 0.08]],
    [['rbox', 2.1, 0.5, 0.2, 0.08], 'fabric', 'main', [0, 0.6, -0.33]], [['rbox', 0.18, 0.3, 0.86, 0.07], 'fabric', 'main', [-0.96, 0.52, 0]], [['rbox', 0.18, 0.3, 0.86, 0.07], 'fabric', 'main', [0.96, 0.52, 0]],
    ...legs4(2.0, 0.78, 0.06, 0.05, DARK, 'wood')],
  loveseat: [[['rbox', 1.45, 0.34, 0.82, 0.08], 'fabric', 'main', [0, 0.23, 0]], [['rbox', 1.1, 0.16, 0.62, 0.07], 'fabric', 'main', [0, 0.47, 0.08]],
    [['rbox', 1.45, 0.46, 0.2, 0.08], 'fabric', 'main', [0, 0.57, -0.31]], [['cap', 0.1, 0.62], 'fabric', 'main', [-0.65, 0.48, 0], [Math.PI / 2, 0, 0]], [['cap', 0.1, 0.62], 'fabric', 'main', [0.65, 0.48, 0], [Math.PI / 2, 0, 0]],
    ...legs4(1.35, 0.74, 0.06, 0.05, GOLD, 'metal')],
  coffeetable: [[['rbox', 1.1, 0.05, 0.6, 0.02], 'wood', 'main', [0, 0.4, 0]], [['rbox', 1.0, 0.03, 0.5, 0.01], 'wood', 'main', [0, 0.12, 0]], ...legs4(1.06, 0.56, 0.38, 0.05)],
  sidetable: [[['cyl', 0.23, 0.23, 0.04, 22], 'wood', 'main', [0, 0.54, 0]], [['cyl', 0.03, 0.04, 0.5, 10], 'wood', 'main', [0, 0.27, 0]], [['cyl', 0.16, 0.18, 0.03, 18], 'wood', 'main', [0, 0.015, 0]]],
  diningtable: [[['rbox', 1.7, 0.06, 0.95, 0.025], 'wood', 'main', [0, 0.73, 0]], ...legs4(1.6, 0.85, 0.7, 0.07), [['box', 1.4, 0.08, 0.03], 'wood', 'main', [0, 0.64, 0.4]], [['box', 1.4, 0.08, 0.03], 'wood', 'main', [0, 0.64, -0.4]]],
  roundtable: [[['cyl', 0.45, 0.45, 0.04, 28], 'wood', 'main', [0, 0.74, 0]], [['cyl', 0.47, 0.47, 0.012, 28], 'fabric', '#ffffff', [0, 0.765, 0]], [['cyl', 0.04, 0.05, 0.72, 10], 'metal', DARK, [0, 0.36, 0]],
    [['cyl', 0.24, 0.26, 0.03, 18], 'metal', DARK, [0, 0.015, 0]]],
  bed: [[['rbox', 1.6, 0.3, 2.1, 0.05], 'wood', '#a16207', [0, 0.2, 0]], [['rbox', 1.52, 0.2, 2.0, 0.08], 'fabric', WHITE, [0, 0.45, 0.02]],
    [['rbox', 1.56, 0.06, 1.4, 0.03], 'fabric', 'main', [0, 0.57, 0.33]], [['rbox', 1.6, 0.95, 0.08, 0.04], 'wood', '#a16207', [0, 0.47, -1.04]], ...legs4(1.54, 2.04, 0.06, 0.06, '#78350f')],
  kidbed: [[['rbox', 1.0, 0.28, 1.9, 0.05], 'shiny', 'main', [0, 0.2, 0]], [['rbox', 0.92, 0.18, 1.8, 0.07], 'fabric', WHITE, [0, 0.42, 0]], [['rbox', 0.95, 0.05, 1.2, 0.02], 'fabric', '#fde68a', [0, 0.53, 0.3]],
    [['rbox', 1.0, 0.9, 0.08, 0.04], 'shiny', 'main', [0, 0.45, -0.94]], [['sph', 0.08], 'shiny', '#facc15', [0.42, 0.92, -0.94]], [['sph', 0.08], 'shiny', '#facc15', [-0.42, 0.92, -0.94]]],
  wardrobe: [[['rbox', 1.2, 1.94, 0.58, 0.03], 'wood', 'main', [0, 1.0, 0]], [['box', 0.01, 1.8, 0.01], 'std', '#78350f', [0, 1.0, 0.292]], [['rbox', 0.03, 0.25, 0.04, 0.012], 'metal', GOLD, [-0.07, 1.05, 0.31]],
    [['rbox', 0.03, 0.25, 0.04, 0.012], 'metal', GOLD, [0.07, 1.05, 0.31]], [['box', 1.22, 0.06, 0.6], 'wood', '#78350f', [0, 0.03, 0]], [['box', 1.24, 0.05, 0.62], 'wood', '#78350f', [0, 1.97, 0]]],
  bookshelf: [[['box', 0.04, 1.8, 0.34], 'wood', 'main', [-0.48, 0.9, 0]], [['box', 0.04, 1.8, 0.34], 'wood', 'main', [0.48, 0.9, 0]], [['box', 1.0, 1.8, 0.02], 'wood', 'main', [0, 0.9, -0.16]],
    ...[0.02, 0.45, 0.9, 1.35, 1.78].map((y) => [['box', 0.96, 0.03, 0.32], 'wood', 'main', [0, y, 0]] as Part),
    ...[0.05, 0.48, 0.93, 1.38].flatMap((y, row) => Array.from({ length: 7 }, (_, i) => [['rbox', 0.08, 0.3 + ((i * 7 + row) % 4) * 0.025, 0.24, 0.01], 'std', ['#dc2626', '#2563eb', '#16a34a', '#facc15', '#7c3aed', '#0f172a', '#ea580c'][(i + row * 3) % 7], [-0.38 + i * 0.105 + (row % 2) * 0.02, y + 0.16, 0.02]] as Part))],
  tvunit: [[['rbox', 1.6, 0.46, 0.44, 0.03], 'wood', 'main', [0, 0.23, 0]], [['box', 0.7, 0.3, 0.01], 'std', '#1f2937', [-0.38, 0.23, 0.222]], [['rbox', 1.3, 0.72, 0.05, 0.015], 'shiny', '#0f172a', [0, 0.86, -0.04]],
    [['box', 1.24, 0.66, 0.01], 'glow', '#1d4ed8', [0, 0.86, -0.01]], [['cyl', 0.03, 0.03, 0.06, 8], 'metal', DARK, [0, 0.49, -0.04]], [['rbox', 0.3, 0.02, 0.15, 0.008], 'metal', DARK, [0, 0.47, -0.04]]],
  desk: [[['rbox', 1.3, 0.05, 0.65, 0.02], 'wood', 'main', [0, 0.735, 0]], [['rbox', 0.4, 0.68, 0.6, 0.02], 'wood', 'main', [0.42, 0.36, 0]],
    [['box', 0.03, 0.7, 0.6], 'wood', 'main', [-0.62, 0.35, 0]], [['box', 0.3, 0.008, 0.008], 'metal', STEEL, [0.42, 0.55, 0.302]], [['box', 0.3, 0.008, 0.008], 'metal', STEEL, [0.42, 0.3, 0.302]]],
  nightstand: [[['rbox', 0.46, 0.5, 0.4, 0.03], 'wood', 'main', [0, 0.29, 0]], [['box', 0.4, 0.008, 0.01], 'std', '#78350f', [0, 0.32, 0.2]], [['sph', 0.018], 'metal', GOLD, [0, 0.42, 0.21]],
    [['sph', 0.018], 'metal', GOLD, [0, 0.22, 0.21]], ...legs4(0.42, 0.36, 0.05, 0.04, '#78350f')],
  dresser: [[['rbox', 1.0, 0.82, 0.48, 0.03], 'wood', 'main', [0, 0.47, 0]], ...[0.25, 0.5, 0.75].map((y) => [['box', 0.94, 0.006, 0.01], 'std', '#a16207', [0, y + 0.05, 0.241]] as Part),
    ...[0.18, 0.43, 0.68].flatMap((y) => [-0.25, 0.25].map((x) => [['sph', 0.02], 'metal', GOLD, [x, y, 0.25]] as Part)), ...legs4(0.94, 0.42, 0.06, 0.05, '#78350f')],
  officechair: [[['rbox', 0.48, 0.09, 0.46, 0.04], 'fabric', 'main', [0, 0.5, 0]], [['rbox', 0.46, 0.5, 0.07, 0.04], 'fabric', 'main', [0, 0.82, -0.22], [-0.12, 0, 0]],
    [['cyl', 0.03, 0.03, 0.36, 8], 'metal', STEEL, [0, 0.3, 0]], ...[0, 1, 2, 3, 4].flatMap((i) => {
      const a = (i / 5) * Math.PI * 2;
      return [[['rbox', 0.3, 0.03, 0.04, 0.01], 'metal', DARK, [Math.sin(a) * 0.15, 0.08, Math.cos(a) * 0.15], [0, a + Math.PI / 2, 0]] as Part,
        [['sph', 0.03], 'shiny', DARK, [Math.sin(a) * 0.28, 0.03, Math.cos(a) * 0.28]] as Part];
    }), [['rbox', 0.05, 0.05, 0.3, 0.02], 'std', DARK, [0.25, 0.66, 0]], [['rbox', 0.05, 0.05, 0.3, 0.02], 'std', DARK, [-0.25, 0.66, 0]]],
  bench: [...[0, 1, 2].map((i) => [['rbox', 1.5, 0.04, 0.12, 0.015], 'wood', 'main', [0, 0.45, -0.15 + i * 0.15]] as Part), ...[0, 1].map((i) => [['rbox', 1.5, 0.1, 0.03, 0.012], 'wood', 'main', [0, 0.62 + i * 0.13, -0.24]] as Part),
    ...[-0.65, 0.65].map((x) => [['rbox', 0.06, 0.45, 0.45, 0.02], 'metal', DARK, [x, 0.225, 0]] as Part)],
  mirror: [[['rbox', 0.55, 1.5, 0.05, 0.03], 'wood', 'main', [0, 0.85, 0]], [['box', 0.47, 1.42, 0.01], 'metal', '#e2e8f0', [0, 0.85, 0.028]], [['box', 0.06, 0.6, 0.35], 'wood', 'main', [0, 0.3, -0.12], [0.3, 0, 0]]],

  // ---------------- decoration ----------------
  plant: [vessel([[0.001, 0], [0.15, 0], [0.2, 0.34], [0.21, 0.36], [0.19, 0.36], [0.001, 0.33]], 'shiny'), [['cyl', 0.19, 0.19, 0.02, 18], 'std', SOIL, [0, 0.34, 0]],
    ...[[0, 0.62, 0, 0.22], [0.1, 0.78, 0.05, 0.16], [-0.1, 0.74, -0.06, 0.17], [0.02, 0.9, -0.04, 0.13], [-0.06, 0.6, 0.1, 0.14]].map(([x, y, z, r]) => [['sph', r, 10, 8], 'std', LEAF, [x, y, z], undefined, [1, 1.2, 1]] as Part),
    [['cyl', 0.012, 0.012, 0.3, 6], 'wood', '#3f6212', [0, 0.48, 0]]],
  flowerpot: [vessel([[0.001, 0], [0.07, 0], [0.1, 0.15], [0.105, 0.16], [0.095, 0.16], [0.001, 0.15]], 'std'), [['cyl', 0.005, 0.005, 0.18, 4], 'std', LEAF, [0, 0.24, 0]],
    ...[[0, 0.36, 0, '#f472b6'], [0.05, 0.31, 0.02, '#facc15'], [-0.05, 0.32, -0.02, '#ef4444']].map(([x, y, z, c]) => [['sph', 0.03, 8, 6], 'shiny', c as string, [x as number, y as number, z as number], undefined, [1, 0.6, 1]] as Part),
    [['sph', 0.05, 8, 6], 'std', LEAF, [0, 0.21, 0], undefined, [1.4, 0.5, 1.4]]],
  vase: [vessel([[0.001, 0], [0.05, 0], [0.08, 0.1], [0.075, 0.2], [0.04, 0.28], [0.045, 0.34], [0.04, 0.34], [0.034, 0.29], [0.001, 0.29]], 'shiny')],
  floorlamp: [[['cyl', 0.16, 0.18, 0.03, 20], 'metal', DARK, [0, 0.015, 0]], [['cyl', 0.012, 0.012, 1.3, 8], 'metal', DARK, [0, 0.66, 0]],
    vessel([[0.12, 1.22], [0.2, 1.22], [0.14, 1.52], [0.13, 1.52], [0.19, 1.23], [0.13, 1.23]], 'fabric'), [['sph', 0.05], 'glow', '#fff7d6', [0, 1.3, 0]]],
  tablelamp: [vessel([[0.001, 0], [0.08, 0], [0.09, 0.03], [0.05, 0.08], [0.07, 0.16], [0.02, 0.24], [0.001, 0.24]], 'shiny', '#e7e5e4'),
    vessel([[0.08, 0.24], [0.13, 0.24], [0.09, 0.44], [0.085, 0.44], [0.125, 0.245], [0.085, 0.245]], 'fabric'), [['sph', 0.035], 'glow', '#fff7d6', [0, 0.3, 0]]],
  clock: [[['cyl', 0.18, 0.18, 0.04, 28], 'shiny', 'main', [0, 0.18, 0], [Math.PI / 2, 0, 0]], [['torus', 0.17, 0.014, Math.PI * 2], 'metal', GOLD, [0, 0.18, 0.02]],
    [['box', 0.012, 0.11, 0.008], 'std', DARK, [0, 0.225, 0.024]], [['box', 0.08, 0.012, 0.008], 'std', DARK, [0.035, 0.18, 0.024]], [['sph', 0.012], 'metal', GOLD, [0, 0.18, 0.026]],
    ...Array.from({ length: 12 }, (_, i) => [['box', 0.01, 0.025, 0.006], 'std', DARK, [Math.sin((i / 12) * Math.PI * 2) * 0.14, 0.18 + Math.cos((i / 12) * Math.PI * 2) * 0.14, 0.021]] as Part)],
  painting: [[['rbox', 0.9, 0.65, 0.04, 0.012], 'wood', '#a16207', [0, 0.325, 0]], [['box', 0.8, 0.55, 0.01], 'std', 'main', [0, 0.325, 0.017]],
    [['sph', 0.08, 10, 8], 'std', '#facc15', [0.22, 0.45, 0.022], undefined, [1, 1, 0.1]], [['cone', 0.2, 0.25, 4], 'std', '#16a34a', [-0.15, 0.2, 0.022], undefined, [1.4, 1, 0.05]],
    [['cone', 0.16, 0.2, 4], 'std', '#15803d', [0.08, 0.18, 0.022], undefined, [1.4, 1, 0.05]]],
  photoframe: [[['rbox', 0.17, 0.21, 0.02, 0.008], 'wood', 'main', [0, 0.11, 0.02], [-0.12, 0, 0]], [['box', 0.13, 0.16, 0.005], 'std', '#93c5fd', [0, 0.115, 0.032], [-0.12, 0, 0]],
    [['box', 0.03, 0.15, 0.02], 'wood', 'main', [0, 0.075, -0.03], [0.4, 0, 0]]],
  sculpture: [[['rbox', 0.2, 0.08, 0.2, 0.02], 'shiny', DARK, [0, 0.04, 0]], [['torus', 0.1, 0.03, Math.PI * 2], 'shiny', 'main', [0, 0.24, 0], [0, 0.4, 0]],
    [['sph', 0.06], 'shiny', 'main', [0, 0.42, 0]], [['cyl', 0.015, 0.015, 0.08, 8], 'shiny', 'main', [0, 0.11, 0]]],
  cushion: [[['rbox', 0.44, 0.16, 0.44, 0.07], 'fabric', 'main', [0, 0.08, 0]], [['sph', 0.025], 'fabric', 'main', [0, 0.16, 0], undefined, [1, 0.4, 1]]],
  pillow: [[['rbox', 0.6, 0.14, 0.38, 0.07], 'fabric', 'main', [0, 0.07, 0]]],
  rug: [[['rbox', 2.4, 0.02, 1.6, 0.01], 'fabric', 'main', [0, 0.01, 0]], [['box', 2.0, 0.021, 1.2], 'fabric', '#fde68a', [0, 0.011, 0]], [['box', 1.6, 0.022, 0.8], 'fabric', 'main', [0, 0.012, 0]]],
  candle: [[['cyl', 0.035, 0.035, 0.15, 12], 'std', 'main', [0, 0.085, 0]], [['cyl', 0.05, 0.055, 0.015, 14], 'metal', GOLD, [0, 0.008, 0]], [['sph', 0.012], 'glow', '#fbbf24', [0, 0.18, 0], undefined, [1, 1.8, 1]]],
  globe: [[['sph', 0.13, 18, 12], 'shiny', 'main', [0, 0.3, 0]], [['torus', 0.145, 0.008, Math.PI * 1.4], 'metal', GOLD, [0, 0.3, 0], [0, 0, 0.4]], [['cyl', 0.012, 0.012, 0.14, 6], 'metal', GOLD, [0, 0.1, 0]],
    [['cyl', 0.08, 0.09, 0.03, 16], 'wood', '#78350f', [0, 0.015, 0]], [['sph', 0.06, 8, 6], 'std', '#16a34a', [0.07, 0.34, 0.08], undefined, [1, 0.8, 0.5]]],
  books: [[['rbox', 0.22, 0.05, 0.17, 0.006], 'std', 'main', [0, 0.025, 0]], [['rbox', 0.2, 0.045, 0.16, 0.006], 'std', '#2563eb', [0.01, 0.073, 0], [0, 0.2, 0]],
    [['rbox', 0.18, 0.04, 0.15, 0.006], 'std', '#16a34a', [-0.01, 0.116, 0], [0, -0.15, 0]], [['box', 0.205, 0.03, 0.15], 'std', WHITE, [0.012, 0.025, 0.002]]],
  book: [[['rbox', 0.17, 0.04, 0.23, 0.006], 'std', 'main', [0, 0.02, 0]], [['box', 0.155, 0.03, 0.22], 'std', WHITE, [0.01, 0.02, 0]]],

  // ---------------- bedroom / toys ----------------
  shoe: [[['rbox', 0.11, 0.06, 0.28, 0.03], 'shiny', 'main', [0, 0.035, 0]], [['rbox', 0.1, 0.07, 0.15, 0.035], 'fabric', 'main', [0, 0.08, -0.05]], [['box', 0.112, 0.015, 0.28], 'std', WHITE, [0, 0.008, 0]],
    [['box', 0.06, 0.01, 0.06], 'std', DARK, [0, 0.11, 0.02]]],
  backpack: [[['rbox', 0.3, 0.38, 0.16, 0.07], 'fabric', 'main', [0, 0.21, 0]], [['rbox', 0.22, 0.16, 0.06, 0.04], 'fabric', 'main', [0, 0.14, 0.1]], [['torus', 0.05, 0.012, Math.PI], 'std', DARK, [0, 0.4, -0.02]],
    [['box', 0.03, 0.34, 0.02], 'std', DARK, [0.08, 0.2, -0.09]], [['box', 0.03, 0.34, 0.02], 'std', DARK, [-0.08, 0.2, -0.09]]],
  teddy: [[['sph', 0.1, 14, 10], 'fabric', 'main', [0, 0.14, 0], undefined, [1.05, 1.15, 0.95]], [['sph', 0.08, 14, 10], 'fabric', 'main', [0, 0.31, 0.01]], [['sph', 0.035], 'fabric', 'main', [0.06, 0.38, 0]], [['sph', 0.035], 'fabric', 'main', [-0.06, 0.38, 0]],
    [['sph', 0.035], 'fabric', '#fde3c3', [0, 0.29, 0.075]], [['sph', 0.012], 'shiny', DARK, [0, 0.305, 0.105]], [['sph', 0.01], 'shiny', DARK, [0.03, 0.33, 0.07]], [['sph', 0.01], 'shiny', DARK, [-0.03, 0.33, 0.07]],
    [['sph', 0.045], 'fabric', 'main', [0.1, 0.17, 0.03]], [['sph', 0.045], 'fabric', 'main', [-0.1, 0.17, 0.03]], [['sph', 0.05], 'fabric', 'main', [0.06, 0.04, 0.05]], [['sph', 0.05], 'fabric', 'main', [-0.06, 0.04, 0.05]],
    [['sph', 0.03], 'std', '#ef4444', [0, 0.235, 0.075], undefined, [1.6, 0.6, 0.6]]],
  ball: [[['sph', 0.13, 18, 14], 'shiny', 'main', [0, 0.13, 0]], [['torus', 0.13, 0.008, Math.PI * 2], 'shiny', WHITE, [0, 0.13, 0]], [['torus', 0.13, 0.008, Math.PI * 2], 'shiny', WHITE, [0, 0.13, 0], [Math.PI / 2, 0, 0]]],
  toycar: [[['rbox', 0.16, 0.06, 0.32, 0.025], 'shiny', 'main', [0, 0.06, 0]], [['rbox', 0.14, 0.05, 0.16, 0.025], 'glass', '#bae6fd', [0, 0.11, -0.02]],
    ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z]) => [['cyl', 0.03, 0.03, 0.025, 12], 'shiny', DARK, [x * 0.085, 0.03, z * 0.1], [0, 0, Math.PI / 2]] as Part)],
  blocks: [[['rbox', 0.12, 0.12, 0.12, 0.012], 'shiny', 'main', [-0.04, 0.06, 0]], [['rbox', 0.1, 0.1, 0.1, 0.01], 'shiny', '#3b82f6', [0.06, 0.05, 0.03], [0, 0.4, 0]], [['rbox', 0.09, 0.09, 0.09, 0.01], 'shiny', '#22c55e', [0.0, 0.165, 0.01], [0, 0.8, 0]]],
  duck: [[['sph', 0.09, 14, 10], 'shiny', 'main', [0, 0.08, -0.01], undefined, [1, 0.85, 1.25]], [['sph', 0.06, 14, 10], 'shiny', 'main', [0, 0.16, 0.06]], [['cone', 0.03, 0.06, 10], 'shiny', '#f97316', [0, 0.155, 0.13], [Math.PI / 2, 0, 0], [1.3, 1, 0.6]],
    [['sph', 0.01], 'shiny', DARK, [0.03, 0.18, 0.1]], [['sph', 0.01], 'shiny', DARK, [-0.03, 0.18, 0.1]], [['cone', 0.03, 0.05, 8], 'shiny', 'main', [0, 0.11, -0.12], [-1.2, 0, 0]]],
  robot: [[['rbox', 0.18, 0.16, 0.12, 0.02], 'metal', 'main', [0, 0.17, 0]], [['rbox', 0.13, 0.1, 0.1, 0.02], 'metal', 'main', [0, 0.31, 0]], [['box', 0.09, 0.03, 0.01], 'glow', '#22d3ee', [0, 0.32, 0.051]],
    [['cyl', 0.005, 0.005, 0.05, 4], 'metal', DARK, [0, 0.38, 0]], [['sph', 0.012], 'glow', '#ef4444', [0, 0.41, 0]], [['rbox', 0.05, 0.09, 0.05, 0.015], 'metal', DARK, [0.04, 0.045, 0]], [['rbox', 0.05, 0.09, 0.05, 0.015], 'metal', DARK, [-0.04, 0.045, 0]],
    [['cap', 0.02, 0.08], 'metal', DARK, [0.11, 0.17, 0]], [['cap', 0.02, 0.08], 'metal', DARK, [-0.11, 0.17, 0]]],
  blanket: [[['rbox', 0.48, 0.12, 0.38, 0.05], 'fabric', 'main', [0, 0.06, 0]], [['box', 0.46, 0.005, 0.04], 'fabric', WHITE, [0, 0.122, 0.1]], [['box', 0.46, 0.005, 0.04], 'fabric', WHITE, [0, 0.122, -0.06]]],

  // ---------------- bathroom ----------------
  bucket: [vessel([[0.001, 0], [0.11, 0], [0.15, 0.3], [0.155, 0.31], [0.145, 0.31], [0.105, 0.015], [0.001, 0.015]], 'shiny'), [['torus', 0.15, 0.006, Math.PI], 'metal', STEEL, [0, 0.31, 0], [0, Math.PI / 2, 0]]],
  soap: [vessel([[0.001, 0], [0.035, 0], [0.038, 0.01], [0.036, 0.13], [0.02, 0.14], [0.001, 0.14]], 'shiny'), [['cyl', 0.008, 0.008, 0.04, 6], 'metal', STEEL, [0, 0.16, 0]], [['rbox', 0.05, 0.015, 0.02, 0.006], 'metal', STEEL, [0.015, 0.18, 0]]],
  towel: [[['rbox', 0.32, 0.1, 0.22, 0.04], 'fabric', 'main', [0, 0.05, 0]], [['box', 0.3, 0.006, 0.03], 'fabric', WHITE, [0, 0.1, 0.06]]],
  laundry: [vessel([[0.001, 0], [0.17, 0], [0.21, 0.48], [0.215, 0.5], [0.2, 0.5], [0.16, 0.02], [0.001, 0.02]], 'std'), [['sph', 0.16, 10, 8], 'fabric', '#f472b6', [0.03, 0.44, 0], undefined, [1, 0.5, 1]],
    [['sph', 0.12, 10, 8], 'fabric', '#93c5fd', [-0.06, 0.47, 0.04], undefined, [1, 0.5, 1]]],
  toilet: [vessel([[0.001, 0], [0.13, 0], [0.12, 0.2], [0.17, 0.38], [0.18, 0.4], [0.001, 0.4]], 'shiny', WHITE), [['rbox', 0.4, 0.36, 0.18, 0.04], 'shiny', WHITE, [0, 0.58, -0.25]],
    [['torus', 0.15, 0.025, Math.PI * 2], 'shiny', WHITE, [0, 0.42, 0.02], [Math.PI / 2, 0, 0], [1, 1.25, 1]], [['rbox', 0.06, 0.02, 0.03, 0.008], 'metal', STEEL, [0.12, 0.72, -0.16]]],
  bathtub: [[['rbox', 1.6, 0.56, 0.78, 0.12], 'shiny', 'main', [0, 0.28, 0]], [['rbox', 1.42, 0.06, 0.6, 0.1], 'glass', '#7dd3fc', [0, 0.5, 0]],
    [['cyl', 0.015, 0.015, 0.2, 8], 'metal', STEEL, [-0.68, 0.66, 0]], [['cyl', 0.012, 0.012, 0.12, 8], 'metal', STEEL, [-0.62, 0.75, 0], [0, 0, Math.PI / 2]]],
  washbasin: [[['cyl', 0.06, 0.09, 0.72, 14], 'shiny', 'main', [0, 0.36, -0.05]], vessel([[0.001, 0.72], [0.12, 0.72], [0.26, 0.82], [0.27, 0.86], [0.24, 0.86], [0.11, 0.76], [0.001, 0.76]], 'shiny', 'main'),
    [['cyl', 0.012, 0.012, 0.12, 8], 'metal', STEEL, [0, 0.92, -0.16]], [['cyl', 0.01, 0.01, 0.1, 8], 'metal', STEEL, [0, 0.97, -0.11], [Math.PI / 2, 0, 0]]],
  washer: [[['rbox', 0.6, 0.85, 0.6, 0.04], 'shiny', 'main', [0, 0.425, 0]], [['torus', 0.18, 0.025, Math.PI * 2], 'metal', STEEL, [0, 0.42, 0.3]], [['cyl', 0.17, 0.17, 0.01, 22], 'glass', '#93c5fd', [0, 0.42, 0.3], [Math.PI / 2, 0, 0]],
    [['box', 0.5, 0.1, 0.01], 'std', '#cbd5e1', [0, 0.76, 0.3]], [['cyl', 0.03, 0.03, 0.02, 12], 'metal', DARK, [0.18, 0.76, 0.31], [Math.PI / 2, 0, 0]]],

  // ---------------- office / electronics ----------------
  monitor: [[['rbox', 0.56, 0.34, 0.03, 0.012], 'shiny', 'main', [0, 0.27, 0]], [['box', 0.52, 0.3, 0.005], 'glow', '#38bdf8', [0, 0.27, 0.016]], [['rbox', 0.05, 0.12, 0.03, 0.01], 'metal', DARK, [0, 0.07, -0.03]],
    [['rbox', 0.22, 0.015, 0.16, 0.007], 'metal', DARK, [0, 0.008, -0.02]]],
  laptop: [[['rbox', 0.34, 0.018, 0.24, 0.008], 'metal', 'main', [0, 0.009, 0]], [['box', 0.28, 0.003, 0.12], 'std', DARK, [0, 0.019, 0.02]],
    [['rbox', 0.34, 0.22, 0.012, 0.008], 'metal', 'main', [0, 0.115, -0.115], [-0.2, 0, 0]], [['box', 0.3, 0.18, 0.003], 'glow', '#a5b4fc', [0, 0.115, -0.107], [-0.2, 0, 0]]],
  printer: [[['rbox', 0.46, 0.22, 0.4, 0.03], 'shiny', 'main', [0, 0.11, 0]], [['box', 0.3, 0.02, 0.2], 'std', WHITE, [0, 0.24, -0.05], [0.4, 0, 0]], [['box', 0.3, 0.01, 0.12], 'std', '#94a3b8', [0, 0.06, 0.24]],
    [['box', 0.06, 0.02, 0.01], 'glow', '#22c55e', [0.16, 0.18, 0.201]]],
  watercooler: [[['rbox', 0.34, 0.85, 0.34, 0.03], 'shiny', 'main', [0, 0.425, 0]], vessel([[0.001, 0.85], [0.13, 0.86], [0.15, 0.96], [0.15, 1.16], [0.1, 1.24], [0.001, 1.25]], 'glass', '#7dd3fc'),
    [['box', 0.06, 0.04, 0.04], 'std', '#3b82f6', [-0.06, 0.62, 0.18]], [['box', 0.06, 0.04, 0.04], 'std', '#ef4444', [0.06, 0.62, 0.18]], [['box', 0.2, 0.01, 0.1], 'metal', STEEL, [0, 0.45, 0.16]]],
  filecabinet: [[['rbox', 0.46, 1.1, 0.6, 0.02], 'metal', 'main', [0, 0.55, 0]], ...[0.22, 0.5, 0.78].map((y) => [['rbox', 0.14, 0.02, 0.03, 0.008], 'metal', STEEL, [0, y + 0.1, 0.31]] as Part),
    ...[0.28, 0.56, 0.84].map((y) => [['box', 0.44, 0.006, 0.01], 'std', DARK, [0, y + 0.05, 0.3]] as Part)],
  phone: [[['rbox', 0.18, 0.06, 0.18, 0.02], 'shiny', 'main', [0, 0.03, 0]], [['cap', 0.025, 0.12], 'shiny', 'main', [0, 0.08, -0.03], [0, 0, Math.PI / 2]], [['box', 0.08, 0.004, 0.08], 'std', '#94a3b8', [0.03, 0.062, 0.04]]],
  mugtray: [vessel([[0.001, 0], [0.04, 0], [0.042, 0.1], [0.038, 0.1], [0.036, 0.008], [0.001, 0.008]], 'metal'),
    ...[['#2563eb', 0.01, 0.015], ['#ef4444', -0.012, -0.01], ['#16a34a', 0.012, -0.012]].map(([c, x, z]) => [['cyl', 0.005, 0.005, 0.15, 6], 'shiny', c as string, [x as number, 0.11, z as number], [0.12, 0, 0.1]] as Part)],

  // ---------------- storage / industrial / garden ----------------
  cardbox: [[['rbox', 0.5, 0.4, 0.4, 0.01], 'std', 'main', [0, 0.2, 0]], [['box', 0.502, 0.05, 0.08], 'std', '#a8a29e', [0, 0.4, 0]], [['box', 0.2, 0.12, 0.003], 'std', WHITE, [0.1, 0.25, 0.201]]],
  crate: [[['box', 0.56, 0.56, 0.56], 'wood', 'main', [0, 0.3, 0]], ...[[0, 0.035], [0, 0.565]].flatMap(([, y]) => [[['box', 0.6, 0.07, 0.6], 'wood', '#78350f', [0, y, 0]] as Part]),
    [['box', 0.6, 0.06, 0.02], 'wood', '#78350f', [0, 0.3, 0.29], [0, 0, 0.75]], [['box', 0.6, 0.06, 0.02], 'wood', '#78350f', [0, 0.3, -0.29], [0, 0, -0.75]]],
  barrel: [vessel([[0.001, 0], [0.26, 0], [0.3, 0.2], [0.3, 0.7], [0.26, 0.9], [0.001, 0.9]], 'metal'), [['torus', 0.3, 0.012, Math.PI * 2], 'metal', DARK, [0, 0.3, 0], [Math.PI / 2, 0, 0]],
    [['torus', 0.3, 0.012, Math.PI * 2], 'metal', DARK, [0, 0.6, 0], [Math.PI / 2, 0, 0]], [['cyl', 0.03, 0.03, 0.02, 10], 'metal', DARK, [0.12, 0.905, 0]]],
  paintcan: [[['cyl', 0.1, 0.1, 0.2, 20], 'metal', STEEL, [0, 0.1, 0]], [['cyl', 0.101, 0.101, 0.12, 20], 'shiny', 'main', [0, 0.1, 0]], [['torus', 0.1, 0.004, Math.PI], 'metal', STEEL, [0, 0.2, 0], [0, Math.PI / 2, 0]]],
  toolbox: [[['rbox', 0.46, 0.18, 0.22, 0.02], 'shiny', 'main', [0, 0.09, 0]], [['rbox', 0.46, 0.04, 0.22, 0.015], 'shiny', 'main', [0, 0.2, 0]], [['torus', 0.08, 0.012, Math.PI], 'metal', DARK, [0, 0.22, 0], [0, 0, 0]],
    [['box', 0.06, 0.03, 0.01], 'metal', STEEL, [0, 0.17, 0.111]]],
  cone: [[['rbox', 0.36, 0.03, 0.36, 0.01], 'shiny', 'main', [0, 0.015, 0]], [['cyl', 0.03, 0.14, 0.52, 18], 'shiny', 'main', [0, 0.29, 0]], [['cyl', 0.075, 0.1, 0.08, 18], 'shiny', WHITE, [0, 0.3, 0]],
    [['cyl', 0.045, 0.06, 0.06, 18], 'shiny', WHITE, [0, 0.43, 0]]],
  wateringcan: [vessel([[0.001, 0], [0.09, 0], [0.09, 0.2], [0.07, 0.22], [0.001, 0.22]], 'shiny'), [['cyl', 0.012, 0.02, 0.22, 8], 'shiny', 'main', [0.14, 0.15, 0], [0, 0, -1.0]],
    [['cyl', 0.03, 0.02, 0.03, 10], 'shiny', 'main', [0.23, 0.22, 0], [0, 0, -1.0]], [['torus', 0.07, 0.012, Math.PI], 'shiny', 'main', [-0.02, 0.22, 0], [0, 0, 0.3]]],
  basket: [vessel([[0.001, 0], [0.2, 0.0], [0.22, 0.24], [0.21, 0.24], [0.19, 0.012], [0.001, 0.012]], 'shiny'), [['torus', 0.2, 0.01, Math.PI], 'metal', DARK, [0, 0.24, 0], [0, Math.PI / 2, 0]]],
  shelfunit: [...[-0.58, 0.58].flatMap((x) => [-0.2, 0.2].map((z) => [['box', 0.035, 1.8, 0.035], 'metal', 'main', [x, 0.9, z]] as Part)), ...[0.05, 0.65, 1.25, 1.78].map((y) => [['box', 1.2, 0.025, 0.45], 'metal', 'main', [0, y, 0]] as Part)],
};

// fallbacks keep the game working if a registry entry has no model yet
const FALLBACK: Part[] = [[['rbox', 0.3, 0.3, 0.3, 0.05], 'shiny', 'main', [0, 0.15, 0]]];

export function hasModel(id: string) {
  return !!MODELS[id];
}

function makeGeo(g: Geo, q: number): THREE.BufferGeometry {
  const seg = (n: number) => Math.max(5, Math.round(n * q));
  switch (g[0]) {
    case 'rbox': return new RoundedBoxGeometry(g[1], g[2], g[3], q > 0.8 ? 2 : 1, Math.min(g[4] ?? 0.02, g[1] / 2.1, g[2] / 2.1, g[3] / 2.1));
    case 'box': return new THREE.BoxGeometry(g[1], g[2], g[3]);
    case 'cyl': return new THREE.CylinderGeometry(g[1], g[2], g[3], seg(g[4] ?? 16));
    case 'sph': return new THREE.SphereGeometry(g[1], seg(g[2] ?? 14), seg(g[3] ?? 10));
    case 'lathe': return new THREE.LatheGeometry(g[1].map(([r, y]) => new THREE.Vector2(r, y)), seg(g[2] ?? 20));
    case 'torus': return new THREE.TorusGeometry(g[1], g[2], 6, seg(18), g[3] ?? Math.PI * 2);
    case 'cone': return new THREE.ConeGeometry(g[1], g[2], seg(g[3] ?? 14));
    case 'cap': return new THREE.CapsuleGeometry(g[1], g[2], 3, seg(10));
  }
}

const tmpColor = new THREE.Color();
const geoCache = new Map<string, Map<MatKind, { geo: THREE.BufferGeometry; mainMask: Float32Array }>>();

/**
 * Geometry of a model grouped by material kind, at the origin, with vertex colours baked.
 * `mainMask` marks vertices that take the item's main colour so recolouring is cheap.
 */
export function modelGeometry(id: string, q = 1): Map<MatKind, { geo: THREE.BufferGeometry; mainMask: Float32Array }> {
  const key = `${id}|${q}`;
  const cached = geoCache.get(key);
  if (cached) return cached;
  const parts = MODELS[id] ?? FALLBACK;
  const byKind = new Map<MatKind, THREE.BufferGeometry[]>();
  const masks = new Map<MatKind, number[][]>();
  const m4 = new THREE.Matrix4();
  for (const [g, kind, color, pos, rot, scl] of parts) {
    let geo = makeGeo(g, q);
    if (geo.index) geo = geo.toNonIndexed();
    geo.deleteAttribute('uv');
    m4.compose(new THREE.Vector3(...(pos ?? [0, 0, 0])), new THREE.Quaternion().setFromEuler(new THREE.Euler(...(rot ?? [0, 0, 0]))), new THREE.Vector3(...(scl ?? [1, 1, 1])));
    geo.applyMatrix4(m4);
    const n = geo.attributes.position.count;
    const cols = new Float32Array(n * 3);
    if (color !== 'main') tmpColor.set(color);
    else tmpColor.set('#ffffff');
    for (let i = 0; i < n; i++) cols.set([tmpColor.r, tmpColor.g, tmpColor.b], i * 3);
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    if (!byKind.has(kind)) { byKind.set(kind, []); masks.set(kind, []); }
    byKind.get(kind)!.push(geo);
    masks.get(kind)!.push(new Array(n).fill(color === 'main' ? 1 : 0));
  }
  const out = new Map<MatKind, { geo: THREE.BufferGeometry; mainMask: Float32Array }>();
  for (const [kind, geos] of byKind) {
    const merged = mergeSimple(geos);
    out.set(kind, { geo: merged, mainMask: new Float32Array(masks.get(kind)!.flat()) });
  }
  geoCache.set(key, out);
  return out;
}

/** Merge non-indexed geometries with position/normal/color attributes. */
export function mergeSimple(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let total = 0;
  for (const g of geos) total += g.attributes.position.count;
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), col = new Float32Array(total * 3);
  let o = 0;
  for (const g of geos) {
    pos.set(g.attributes.position.array as Float32Array, o * 3);
    nor.set(g.attributes.normal.array as Float32Array, o * 3);
    col.set(g.attributes.color.array as Float32Array, o * 3);
    o += g.attributes.position.count;
  }
  const m = new THREE.BufferGeometry();
  m.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  m.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  m.setAttribute('color', new THREE.BufferAttribute(col, 3));
  m.computeBoundingSphere();
  return m;
}

/** Copy of a model's geometry with the main colour applied and a world transform. */
export function coloredModel(id: string, main: string, q: number, matrix?: THREE.Matrix4): Map<MatKind, THREE.BufferGeometry> {
  const src = modelGeometry(id, q);
  const out = new Map<MatKind, THREE.BufferGeometry>();
  const c = new THREE.Color(main);
  for (const [kind, { geo, mainMask }] of src) {
    const g = geo.clone();
    const col = g.attributes.color as THREE.BufferAttribute;
    for (let i = 0; i < mainMask.length; i++) if (mainMask[i]) col.setXYZ(i, c.r, c.g, c.b);
    if (matrix) g.applyMatrix4(matrix);
    out.set(kind, g);
  }
  return out;
}

// ---------- shared materials ----------
const matCache = new Map<string, THREE.Material>();
export function propMaterial(kind: MatKind, envTex: (t: 'wood' | 'fabric') => THREE.Texture | null, quality: 'low' | 'medium' | 'high'): THREE.Material {
  const key = kind + quality;
  let m = matCache.get(key);
  if (m) return m;
  const cheap = quality === 'low';
  switch (kind) {
    case 'glow': m = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }); break;
    case 'glass': m = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: 0.42, roughness: 0.05, metalness: 0.1, depthWrite: false }); break;
    case 'metal': m = cheap ? new THREE.MeshLambertMaterial({ vertexColors: true }) : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.32, metalness: 0.75 }); break;
    case 'shiny': m = cheap ? new THREE.MeshLambertMaterial({ vertexColors: true }) : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.28, metalness: 0.02 }); break;
    case 'wood': m = new THREE.MeshLambertMaterial({ vertexColors: true }); void envTex; break;
    case 'fabric': m = new THREE.MeshLambertMaterial({ vertexColors: true }); break;
    default: m = cheap ? new THREE.MeshLambertMaterial({ vertexColors: true }) : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0 });
  }
  matCache.set(key, m);
  return m;
}
export const MAT_KINDS: MatKind[] = ['std', 'shiny', 'metal', 'glass', 'glow', 'wood', 'fabric'];
