// Central registry of environment objects. Adding a new object = one entry here + one model in
// client/src/props/models.ts. Gameplay (server validation, physics, network) only uses this file.

export type PropCategory = 'kitchen' | 'furniture' | 'decoration' | 'electronics' | 'toys' | 'bathroom' | 'office' | 'garden' | 'store' | 'industrial';

/** How a transformed player moves as this object (visual motion style + physics tuning). */
export type MoveStyle =
  | 'upright' // stays upright, slight wobble (jugs, vases, bottles)
  | 'roll' // rolls along the ground (balls)
  | 'tip' // rocks from leg to leg (chairs, stools, boxes)
  | 'slide' // glides flat (plates, books, office chairs on wheels)
  | 'hop' // little hops (shoes, pillows, toys)
  | 'waddle'; // side-to-side waddle (bins, bags, teddies)

export interface PropType {
  id: string;
  name: string;
  icon: string;
  category: PropCategory;
  /** Bounding size [w, h, d] in metres at scale 1 (object sits on y = 0). */
  size: [number, number, number];
  /** Main colour used when a map doesn't specify one. */
  color: string;
  /** Can hiders turn into it? */
  transformable: boolean;
  /** Does the world copy block movement? */
  solid: boolean;
  move: { style: MoveStyle; speed: number; jump: number };
  rotation: { followMove: boolean; turnRate: number };
  /** Network sync: every disguise is replicated via room state + 20 Hz snapshots (no per-prop tuning needed yet). */
  sync?: 'standard';
}

type Def = Omit<PropType, 'move' | 'rotation'> & { move?: Partial<PropType['move']>; rotation?: Partial<PropType['rotation']> };

const T = (d: Def): PropType => ({
  ...d,
  move: { style: 'upright', speed: 1, jump: 1, ...d.move },
  rotation: { followMove: true, turnRate: 10, ...d.rotation },
  sync: 'standard',
});

const list: PropType[] = [
  // ---------------- kitchen ----------------
  T({ id: 'jug', name: 'Water Jug', icon: '🫗', category: 'kitchen', size: [0.2, 0.3, 0.17], color: '#bae6fd', transformable: true, solid: false, move: { style: 'upright' } }),
  T({ id: 'mug', name: 'Coffee Mug', icon: '☕', category: 'kitchen', size: [0.13, 0.11, 0.09], color: '#f97316', transformable: true, solid: false, move: { style: 'upright', speed: 0.95 } }),
  T({ id: 'glass', name: 'Glass', icon: '🥛', category: 'kitchen', size: [0.08, 0.14, 0.08], color: '#e0f2fe', transformable: true, solid: false, move: { style: 'upright' } }),
  T({ id: 'plate', name: 'Plate', icon: '🍽️', category: 'kitchen', size: [0.26, 0.03, 0.26], color: '#f8fafc', transformable: true, solid: false, move: { style: 'slide' } }),
  T({ id: 'bowl', name: 'Bowl', icon: '🥣', category: 'kitchen', size: [0.18, 0.08, 0.18], color: '#fde68a', transformable: true, solid: false, move: { style: 'slide' } }),
  T({ id: 'bottle', name: 'Bottle', icon: '🍾', category: 'kitchen', size: [0.08, 0.3, 0.08], color: '#16a34a', transformable: true, solid: false, move: { style: 'upright' } }),
  T({ id: 'kettle', name: 'Kettle', icon: '🫖', category: 'kitchen', size: [0.24, 0.24, 0.17], color: '#ef4444', transformable: true, solid: false, move: { style: 'upright' } }),
  T({ id: 'teapot', name: 'Teapot', icon: '🫖', category: 'kitchen', size: [0.26, 0.2, 0.16], color: '#e0e7ff', transformable: true, solid: false, move: { style: 'waddle' } }),
  T({ id: 'toaster', name: 'Toaster', icon: '🍞', category: 'kitchen', size: [0.28, 0.2, 0.17], color: '#cbd5e1', transformable: true, solid: false, move: { style: 'hop' } }),
  T({ id: 'microwave', name: 'Microwave', icon: '📦', category: 'electronics', size: [0.5, 0.3, 0.36], color: '#e2e8f0', transformable: true, solid: false, move: { style: 'slide', speed: 0.85 } }),
  T({ id: 'fruitbowl', name: 'Fruit Basket', icon: '🧺', category: 'kitchen', size: [0.34, 0.2, 0.34], color: '#a16207', transformable: true, solid: false, move: { style: 'slide' } }),
  T({ id: 'jar', name: 'Storage Jar', icon: '🫙', category: 'kitchen', size: [0.13, 0.2, 0.13], color: '#fef3c7', transformable: true, solid: false, move: { style: 'upright' } }),
  T({ id: 'pan', name: 'Frying Pan', icon: '🍳', category: 'kitchen', size: [0.46, 0.06, 0.27], color: '#334155', transformable: true, solid: false, move: { style: 'slide' } }),
  T({ id: 'pot', name: 'Cooking Pot', icon: '🍲', category: 'kitchen', size: [0.34, 0.24, 0.3], color: '#94a3b8', transformable: true, solid: false, move: { style: 'waddle' } }),
  T({ id: 'cutlery', name: 'Spoon & Fork', icon: '🍴', category: 'kitchen', size: [0.06, 0.02, 0.2], color: '#cbd5e1', transformable: false, solid: false }),
  T({ id: 'trashbin', name: 'Trash Bin', icon: '🗑️', category: 'kitchen', size: [0.34, 0.5, 0.34], color: '#475569', transformable: true, solid: true, move: { style: 'waddle', speed: 0.9 } }),
  T({ id: 'fridge', name: 'Refrigerator', icon: '🧊', category: 'electronics', size: [0.8, 1.9, 0.7], color: '#f1f5f9', transformable: false, solid: true }),
  T({ id: 'stool', name: 'Stool', icon: '🪑', category: 'furniture', size: [0.38, 0.66, 0.38], color: '#b45309', transformable: true, solid: true, move: { style: 'tip' } }),
  T({ id: 'can', name: 'Tin Can', icon: '🥫', category: 'store', size: [0.08, 0.12, 0.08], color: '#dc2626', transformable: true, solid: false, move: { style: 'roll', speed: 1.05 } }),
  T({ id: 'cereal', name: 'Cereal Box', icon: '🥣', category: 'store', size: [0.2, 0.3, 0.07], color: '#f59e0b', transformable: true, solid: false, move: { style: 'hop' } }),
  T({ id: 'wineglass', name: 'Wine Glass', icon: '🍷', category: 'kitchen', size: [0.08, 0.2, 0.08], color: '#e0f2fe', transformable: true, solid: false, move: { style: 'upright' } }),

  // ---------------- furniture ----------------
  T({ id: 'chair', name: 'Chair', icon: '🪑', category: 'furniture', size: [0.46, 0.95, 0.48], color: '#92400e', transformable: true, solid: true, move: { style: 'tip', speed: 0.9, jump: 0.8 } }),
  T({ id: 'armchair', name: 'Armchair', icon: '🛋️', category: 'furniture', size: [0.86, 0.88, 0.84], color: '#0f766e', transformable: false, solid: true }),
  T({ id: 'sofa', name: 'Sofa', icon: '🛋️', category: 'furniture', size: [2.1, 0.86, 0.9], color: '#64748b', transformable: false, solid: true }),
  T({ id: 'loveseat', name: 'Loveseat', icon: '🛋️', category: 'furniture', size: [1.45, 0.82, 0.86], color: '#be123c', transformable: false, solid: true }),
  T({ id: 'coffeetable', name: 'Coffee Table', icon: '🪵', category: 'furniture', size: [1.1, 0.42, 0.6], color: '#78350f', transformable: false, solid: true }),
  T({ id: 'sidetable', name: 'Side Table', icon: '🪵', category: 'furniture', size: [0.46, 0.56, 0.46], color: '#a16207', transformable: true, solid: true, move: { style: 'tip', speed: 0.9 } }),
  T({ id: 'diningtable', name: 'Dining Table', icon: '🍽️', category: 'furniture', size: [1.7, 0.76, 0.95], color: '#b45309', transformable: false, solid: true }),
  T({ id: 'roundtable', name: 'Round Table', icon: '🍽️', category: 'furniture', size: [0.9, 0.76, 0.9], color: '#f5f5f4', transformable: false, solid: true }),
  T({ id: 'bed', name: 'Bed', icon: '🛏️', category: 'furniture', size: [1.6, 0.95, 2.15], color: '#f472b6', transformable: false, solid: true }),
  T({ id: 'kidbed', name: 'Kids Bed', icon: '🛏️', category: 'furniture', size: [1.0, 0.9, 1.9], color: '#38bdf8', transformable: false, solid: true }),
  T({ id: 'wardrobe', name: 'Wardrobe', icon: '🚪', category: 'furniture', size: [1.2, 2.0, 0.6], color: '#d6b583', transformable: false, solid: true }),
  T({ id: 'bookshelf', name: 'Bookshelf', icon: '📚', category: 'furniture', size: [1.0, 1.8, 0.34], color: '#7c2d12', transformable: false, solid: true }),
  T({ id: 'tvunit', name: 'TV & Stand', icon: '📺', category: 'electronics', size: [1.6, 1.2, 0.45], color: '#3f2a1d', transformable: false, solid: true }),
  T({ id: 'desk', name: 'Desk', icon: '🗄️', category: 'furniture', size: [1.3, 0.76, 0.65], color: '#e7e5e4', transformable: false, solid: true }),
  T({ id: 'nightstand', name: 'Nightstand', icon: '🗄️', category: 'furniture', size: [0.46, 0.56, 0.4], color: '#a16207', transformable: true, solid: true, move: { style: 'tip', speed: 0.85 } }),
  T({ id: 'dresser', name: 'Dresser', icon: '🗄️', category: 'furniture', size: [1.0, 0.9, 0.48], color: '#fde68a', transformable: false, solid: true }),
  T({ id: 'officechair', name: 'Office Chair', icon: '🪑', category: 'office', size: [0.62, 1.05, 0.62], color: '#1e293b', transformable: true, solid: true, move: { style: 'slide', speed: 1.05 } }),
  T({ id: 'bench', name: 'Bench', icon: '🪑', category: 'garden', size: [1.5, 0.8, 0.5], color: '#a16207', transformable: false, solid: true }),
  T({ id: 'mirror', name: 'Standing Mirror', icon: '🪞', category: 'decoration', size: [0.55, 1.6, 0.35], color: '#d6b583', transformable: false, solid: true }),

  // ---------------- decoration ----------------
  T({ id: 'plant', name: 'Potted Plant', icon: '🪴', category: 'decoration', size: [0.5, 1.0, 0.5], color: '#c2410c', transformable: true, solid: true, move: { style: 'waddle', speed: 0.9 } }),
  T({ id: 'flowerpot', name: 'Flower Pot', icon: '🌷', category: 'decoration', size: [0.22, 0.38, 0.22], color: '#ea580c', transformable: true, solid: false, move: { style: 'upright' } }),
  T({ id: 'vase', name: 'Vase', icon: '🏺', category: 'decoration', size: [0.17, 0.34, 0.17], color: '#1d4ed8', transformable: true, solid: false, move: { style: 'upright' } }),
  T({ id: 'floorlamp', name: 'Floor Lamp', icon: '🛋️', category: 'decoration', size: [0.42, 1.55, 0.42], color: '#fde68a', transformable: true, solid: true, move: { style: 'upright', speed: 0.85, jump: 0.7 } }),
  T({ id: 'tablelamp', name: 'Table Lamp', icon: '💡', category: 'decoration', size: [0.28, 0.46, 0.28], color: '#fbcfe8', transformable: true, solid: false, move: { style: 'upright' } }),
  T({ id: 'clock', name: 'Clock', icon: '🕰️', category: 'decoration', size: [0.36, 0.36, 0.06], color: '#f8fafc', transformable: true, solid: false, move: { style: 'roll', speed: 1 } }),
  T({ id: 'painting', name: 'Painting', icon: '🖼️', category: 'decoration', size: [0.9, 0.65, 0.04], color: '#38bdf8', transformable: false, solid: false }),
  T({ id: 'photoframe', name: 'Photo Frame', icon: '🖼️', category: 'decoration', size: [0.17, 0.21, 0.08], color: '#a16207', transformable: true, solid: false, move: { style: 'hop' } }),
  T({ id: 'sculpture', name: 'Sculpture', icon: '🗿', category: 'decoration', size: [0.22, 0.48, 0.22], color: '#e7e5e4', transformable: true, solid: false, move: { style: 'upright' } }),
  T({ id: 'cushion', name: 'Cushion', icon: '🛋️', category: 'decoration', size: [0.44, 0.16, 0.44], color: '#fca5a5', transformable: true, solid: false, move: { style: 'hop' } }),
  T({ id: 'pillow', name: 'Pillow', icon: '🛏️', category: 'decoration', size: [0.6, 0.15, 0.38], color: '#ffffff', transformable: true, solid: false, move: { style: 'hop' } }),
  T({ id: 'rug', name: 'Rug', icon: '🟥', category: 'decoration', size: [2.4, 0.02, 1.6], color: '#be123c', transformable: false, solid: false }),
  T({ id: 'candle', name: 'Candle', icon: '🕯️', category: 'decoration', size: [0.08, 0.2, 0.08], color: '#fef9c3', transformable: true, solid: false, move: { style: 'upright' } }),
  T({ id: 'globe', name: 'Globe', icon: '🌍', category: 'decoration', size: [0.3, 0.46, 0.3], color: '#0ea5e9', transformable: true, solid: false, move: { style: 'upright' } }),
  T({ id: 'books', name: 'Stack of Books', icon: '📚', category: 'decoration', size: [0.24, 0.16, 0.18], color: '#dc2626', transformable: true, solid: false, move: { style: 'slide' } }),
  T({ id: 'book', name: 'Book', icon: '📕', category: 'office', size: [0.17, 0.04, 0.23], color: '#2563eb', transformable: true, solid: false, move: { style: 'slide' } }),

  // ---------------- bedroom / toys ----------------
  T({ id: 'shoe', name: 'Sneaker', icon: '👟', category: 'decoration', size: [0.12, 0.11, 0.29], color: '#f8fafc', transformable: true, solid: false, move: { style: 'hop', speed: 1.05 } }),
  T({ id: 'backpack', name: 'Backpack', icon: '🎒', category: 'decoration', size: [0.32, 0.44, 0.2], color: '#16a34a', transformable: true, solid: false, move: { style: 'waddle' } }),
  T({ id: 'teddy', name: 'Teddy Bear', icon: '🧸', category: 'toys', size: [0.32, 0.42, 0.26], color: '#b8794a', transformable: true, solid: false, move: { style: 'waddle' } }),
  T({ id: 'ball', name: 'Ball', icon: '⚽', category: 'toys', size: [0.26, 0.26, 0.26], color: '#ef4444', transformable: true, solid: false, move: { style: 'roll', speed: 1.1, jump: 1.15 } }),
  T({ id: 'toycar', name: 'Toy Car', icon: '🚗', category: 'toys', size: [0.18, 0.13, 0.32], color: '#2563eb', transformable: true, solid: false, move: { style: 'slide', speed: 1.15 } }),
  T({ id: 'blocks', name: 'Toy Blocks', icon: '🧱', category: 'toys', size: [0.2, 0.2, 0.2], color: '#facc15', transformable: true, solid: false, move: { style: 'hop' } }),
  T({ id: 'duck', name: 'Rubber Duck', icon: '🦆', category: 'toys', size: [0.2, 0.2, 0.24], color: '#facc15', transformable: true, solid: false, move: { style: 'waddle', speed: 1.05 } }),
  T({ id: 'robot', name: 'Toy Robot', icon: '🤖', category: 'toys', size: [0.22, 0.36, 0.16], color: '#94a3b8', transformable: true, solid: false, move: { style: 'waddle' } }),
  T({ id: 'blanket', name: 'Folded Blanket', icon: '🧣', category: 'bathroom', size: [0.48, 0.12, 0.38], color: '#a78bfa', transformable: true, solid: false, move: { style: 'slide' } }),

  // ---------------- bathroom ----------------
  T({ id: 'bucket', name: 'Bucket', icon: '🪣', category: 'bathroom', size: [0.3, 0.32, 0.3], color: '#3b82f6', transformable: true, solid: false, move: { style: 'waddle' } }),
  T({ id: 'soap', name: 'Soap Dispenser', icon: '🧴', category: 'bathroom', size: [0.08, 0.2, 0.08], color: '#f0abfc', transformable: true, solid: false, move: { style: 'upright' } }),
  T({ id: 'towel', name: 'Towel', icon: '🧻', category: 'bathroom', size: [0.32, 0.1, 0.22], color: '#5eead4', transformable: true, solid: false, move: { style: 'slide' } }),
  T({ id: 'laundry', name: 'Laundry Basket', icon: '🧺', category: 'bathroom', size: [0.46, 0.5, 0.36], color: '#fcd34d', transformable: true, solid: true, move: { style: 'waddle', speed: 0.9 } }),
  T({ id: 'toilet', name: 'Toilet', icon: '🚽', category: 'bathroom', size: [0.42, 0.78, 0.68], color: '#ffffff', transformable: false, solid: true }),
  T({ id: 'bathtub', name: 'Bathtub', icon: '🛁', category: 'bathroom', size: [1.6, 0.58, 0.78], color: '#ffffff', transformable: false, solid: true }),
  T({ id: 'washbasin', name: 'Washbasin', icon: '🚰', category: 'bathroom', size: [0.6, 0.9, 0.46], color: '#ffffff', transformable: false, solid: true }),
  T({ id: 'washer', name: 'Washing Machine', icon: '🫧', category: 'electronics', size: [0.6, 0.86, 0.6], color: '#f8fafc', transformable: false, solid: true }),

  // ---------------- office / electronics ----------------
  T({ id: 'monitor', name: 'Monitor', icon: '🖥️', category: 'electronics', size: [0.56, 0.44, 0.2], color: '#111827', transformable: true, solid: false, move: { style: 'slide', speed: 0.9 } }),
  T({ id: 'laptop', name: 'Laptop', icon: '💻', category: 'electronics', size: [0.34, 0.22, 0.25], color: '#9ca3af', transformable: true, solid: false, move: { style: 'slide' } }),
  T({ id: 'printer', name: 'Printer', icon: '🖨️', category: 'office', size: [0.46, 0.3, 0.4], color: '#e5e7eb', transformable: true, solid: false, move: { style: 'hop', speed: 0.85 } }),
  T({ id: 'watercooler', name: 'Water Cooler', icon: '🚰', category: 'office', size: [0.36, 1.25, 0.36], color: '#f8fafc', transformable: true, solid: true, move: { style: 'upright', speed: 0.8, jump: 0.7 } }),
  T({ id: 'filecabinet', name: 'File Cabinet', icon: '🗄️', category: 'office', size: [0.46, 1.1, 0.6], color: '#64748b', transformable: true, solid: true, move: { style: 'tip', speed: 0.8, jump: 0.6 } }),
  T({ id: 'phone', name: 'Desk Phone', icon: '☎️', category: 'office', size: [0.2, 0.1, 0.18], color: '#1f2937', transformable: true, solid: false, move: { style: 'hop' } }),
  T({ id: 'mugtray', name: 'Pen Holder', icon: '🖊️', category: 'office', size: [0.09, 0.18, 0.09], color: '#0f172a', transformable: true, solid: false, move: { style: 'upright' } }),

  // ---------------- storage / industrial / garden ----------------
  T({ id: 'cardbox', name: 'Cardboard Box', icon: '📦', category: 'industrial', size: [0.5, 0.4, 0.4], color: '#c8a26b', transformable: true, solid: true, move: { style: 'tip' } }),
  T({ id: 'crate', name: 'Wooden Crate', icon: '📦', category: 'industrial', size: [0.6, 0.6, 0.6], color: '#b45309', transformable: true, solid: true, move: { style: 'tip', speed: 0.85, jump: 0.75 } }),
  T({ id: 'barrel', name: 'Barrel', icon: '🛢️', category: 'industrial', size: [0.6, 0.9, 0.6], color: '#1d4ed8', transformable: true, solid: true, move: { style: 'waddle', speed: 0.85, jump: 0.7 } }),
  T({ id: 'paintcan', name: 'Paint Can', icon: '🥫', category: 'industrial', size: [0.2, 0.22, 0.2], color: '#f8fafc', transformable: true, solid: false, move: { style: 'upright' } }),
  T({ id: 'toolbox', name: 'Toolbox', icon: '🧰', category: 'industrial', size: [0.46, 0.26, 0.22], color: '#dc2626', transformable: true, solid: false, move: { style: 'hop' } }),
  T({ id: 'cone', name: 'Traffic Cone', icon: '🚧', category: 'industrial', size: [0.36, 0.56, 0.36], color: '#f97316', transformable: true, solid: false, move: { style: 'waddle', speed: 1 } }),
  T({ id: 'wateringcan', name: 'Watering Can', icon: '🚿', category: 'garden', size: [0.34, 0.28, 0.15], color: '#22c55e', transformable: true, solid: false, move: { style: 'waddle' } }),
  T({ id: 'basket', name: 'Shopping Basket', icon: '🧺', category: 'store', size: [0.46, 0.26, 0.32], color: '#dc2626', transformable: true, solid: false, move: { style: 'slide' } }),
  T({ id: 'shelfunit', name: 'Metal Shelf', icon: '🗄️', category: 'industrial', size: [1.2, 1.8, 0.45], color: '#64748b', transformable: false, solid: true }),
];

export const PROPS: Record<string, PropType> = Object.fromEntries(list.map((p) => [p.id, p]));
export const PROP_IDS = list.map((p) => p.id);
export const TRANSFORMABLE_IDS = list.filter((p) => p.transformable).map((p) => p.id);

/** Collision capsule for a player disguised as this object. */
export function propCollider(id: string, scale = 1): { radius: number; height: number } {
  const p = PROPS[id];
  if (!p) return { radius: 0.27, height: 1.34 };
  const radius = Math.min(0.55, Math.max(0.09, (Math.max(p.size[0], p.size[2]) / 2) * 0.85 * scale));
  return { radius, height: Math.max(0.1, p.size[1] * scale) };
}
