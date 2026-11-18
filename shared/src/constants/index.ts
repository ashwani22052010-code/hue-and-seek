import type {
  AbilityId, Cosmetics, MapId, ModeId, PatternId, PoseId, RegionId, ShapeId, Team,
} from '../types';

export const GAME_NAME = 'Hue & Seek';
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 8;
export const ROOM_CODE_LENGTH = 6;
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I

// ---------- Timing ----------
export const TICK_RATE = 20; // server snapshots per second
export const CLIENT_SEND_RATE = 15; // client move updates per second
export const INTERP_DELAY_MS = 110;
export const ASSIGN_TIME = 5; // seconds team reveal
export const RESULTS_TIME = 30; // seconds before auto return to lobby
export const INTERMISSION_TIME = 10;
export const RECONNECT_GRACE_MS = 60_000; // keep a disconnected player's slot
export const EMPTY_ROOM_TTL_MS = 60_000; // delete room after empty for this long
export const LOBBY_IDLE_TTL_MS = 30 * 60_000; // delete lobby after idle
export const PUBLIC_AUTOSTART_MS = 15_000;

export const PREP_TIME_OPTIONS = [30, 40, 45, 60];
export const HUNT_TIME_OPTIONS = [90, 120, 180, 240, 300];
export const DEFAULT_SETTINGS = {
  mapId: 'house' as MapId,
  mode: 'classic' as ModeId,
  prepTime: 40,
  huntTime: 180,
  maxPlayers: MAX_PLAYERS,
};

// ---------- Movement / physics ----------
export const PHYS = {
  gravity: -22,
  jumpSpeed: 8.2,
  walkSpeed: 4.6,
  sprintSpeed: 7.2,
  hiderHuntSpeed: 2.2, // hiders are "locked in" during hunt: slow sneaking only
  seekerSpeedBoost: 1.6,
  stepHeight: 0.42,
  maxFall: -30,
};

export const SHAPES: Record<ShapeId, { label: string; scale: [number, number, number]; radius: number; height: number }> = {
  normal: { label: 'Normal', scale: [1, 1, 1], radius: 0.36, height: 1.05 },
  short: { label: 'Short', scale: [1.05, 0.68, 1.05], radius: 0.38, height: 0.72 },
  tall: { label: 'Tall', scale: [0.9, 1.38, 0.9], radius: 0.33, height: 1.45 },
  wide: { label: 'Wide', scale: [1.42, 0.9, 1.25], radius: 0.5, height: 0.95 },
  slim: { label: 'Slim', scale: [0.68, 1.12, 0.68], radius: 0.25, height: 1.18 },
};
export const SHAPE_IDS = Object.keys(SHAPES) as ShapeId[];

export const POSES: Record<PoseId, { label: string; emoji: string; heightFactor: number; funny?: boolean }> = {
  stand: { label: 'Stand', emoji: '🧍', heightFactor: 1 },
  sit: { label: 'Sit', emoji: '🪑', heightFactor: 0.72 },
  crouch: { label: 'Crouch', emoji: '🐸', heightFactor: 0.66 },
  lie: { label: 'Lie Down', emoji: '🛌', heightFactor: 0.45 },
  curl: { label: 'Curl Up', emoji: '🥚', heightFactor: 0.55 },
  starfish: { label: 'Starfish', emoji: '⭐', heightFactor: 0.4, funny: true },
  handstand: { label: 'Handstand', emoji: '🤸', heightFactor: 1.05, funny: true },
  flamingo: { label: 'Flamingo', emoji: '🦩', heightFactor: 1.05, funny: true },
  peek: { label: 'Peek-a-boo', emoji: '🙈', heightFactor: 0.9, funny: true },
};
export const POSE_IDS = Object.keys(POSES) as PoseId[];

/** Character paint atlas layout: UV rects [u0, v0, u1, v1] (v up). */
export const REGIONS: Record<RegionId, { label: string; rect: [number, number, number, number] }> = {
  body: { label: 'Body', rect: [0, 0.375, 1, 1] },
  armL: { label: 'Left Arm', rect: [0, 0.1875, 0.25, 0.375] },
  armR: { label: 'Right Arm', rect: [0.25, 0.1875, 0.5, 0.375] },
  footL: { label: 'Left Foot', rect: [0.5, 0.1875, 0.75, 0.375] },
  footR: { label: 'Right Foot', rect: [0.75, 0.1875, 1, 0.375] },
  tail: { label: 'Tail', rect: [0, 0, 0.5, 0.1875] },
  crest: { label: 'Crest', rect: [0.5, 0, 1, 0.1875] },
};
export const REGION_IDS = Object.keys(REGIONS) as RegionId[];

export const PATTERNS: { id: PatternId; label: string }[] = [
  { id: 'solid', label: 'Solid' },
  { id: 'stripes', label: 'Stripes' },
  { id: 'dots', label: 'Dots' },
  { id: 'camo', label: 'Camo' },
  { id: 'wood', label: 'Wood' },
  { id: 'stone', label: 'Stone' },
  { id: 'metal', label: 'Metal' },
  { id: 'fabric', label: 'Fabric' },
  { id: 'checker', label: 'Checker' },
  { id: 'brick', label: 'Brick' },
  { id: 'noise', label: 'Speckle' },
];
export const PATTERN_IDS = PATTERNS.map((p) => p.id);

export const BRUSH_SIZES = [10, 22, 40, 70]; // px on a 512 atlas
export const PAINT_ATLAS_SIZE = 512;
export const PAINT_MAX_OPS = 1500;
export const PAINT_MAX_POINTS = 96;

// ---------- Tagging ----------
export const TAG_RANGE = 3.2; // metres from seeker eye to poke point
export const TAG_HIT_RADIUS = 0.75; // poke point must be within (hider radius + this)
export const TAG_MISS_COOLDOWN_MS = 1200;
export const DECOY_PENALTY_MS = 3500;

// ---------- Abilities ----------
export interface AbilityDef {
  id: AbilityId;
  team: Team | 'any';
  name: string;
  icon: string;
  description: string;
  cooldownMs: number;
  durationMs: number;
  bonus?: boolean; // chaos-only limited ability
}

export const ABILITIES: Record<AbilityId, AbilityDef> = {
  decoy: { id: 'decoy', team: 'hider', name: 'Decoy', icon: '👥', description: 'Leave a painted fake copy of yourself. Seekers who tag it are stunned.', cooldownMs: 30_000, durationMs: 30_000 },
  freeze: { id: 'freeze', team: 'hider', name: 'Freeze', icon: '🧊', description: 'Become perfectly still: eyes shut, invisible to scanners, sound and footprints.', cooldownMs: 22_000, durationMs: 9_000 },
  colorshift: { id: 'colorshift', team: 'hider', name: 'Color Shift', icon: '🌈', description: 'Your skin briefly shifts toward the colour of the nearest surface.', cooldownMs: 24_000, durationMs: 9_000 },
  silent: { id: 'silent', team: 'hider', name: 'Silent Steps', icon: '🤫', description: 'Move without footstep sounds or footprints.', cooldownMs: 25_000, durationMs: 10_000 },
  quickdisguise: { id: 'quickdisguise', team: 'hider', name: 'Quick Disguise', icon: '🎭', description: 'Instantly apply your saved camouflage preset (works during the hunt).', cooldownMs: 35_000, durationMs: 0 },
  vanish: { id: 'vanish', team: 'hider', name: 'Vanish', icon: '👻', description: 'CHAOS BONUS: turn invisible to seekers for 5 seconds.', cooldownMs: 0, durationMs: 5_000, bonus: true },
  scanner: { id: 'scanner', team: 'seeker', name: 'Scanner Pulse', icon: '📡', description: 'Highlights rough areas where hiders lurk nearby (14m).', cooldownMs: 26_000, durationMs: 4_500 },
  footprints: { id: 'footprints', team: 'seeker', name: 'Footprint Vision', icon: '👣', description: 'Reveals footprints hiders left in the last 20 seconds.', cooldownMs: 22_000, durationMs: 8_000 },
  sound: { id: 'sound', team: 'seeker', name: 'Sound Detection', icon: '👂', description: 'Shows the rough direction of the nearest recently-moving hider.', cooldownMs: 16_000, durationMs: 4_000 },
  speed: { id: 'speed', team: 'seeker', name: 'Speed Boost', icon: '⚡', description: 'Run 60% faster for a few seconds.', cooldownMs: 20_000, durationMs: 5_000 },
  radar: { id: 'radar', team: 'seeker', name: 'Radar', icon: '🛰️', description: 'CHAOS BONUS: arrows point toward every hider for 4 seconds.', cooldownMs: 0, durationMs: 4_000, bonus: true },
};
export const HIDER_ABILITIES: AbilityId[] = ['decoy', 'freeze', 'colorshift', 'silent', 'quickdisguise'];
export const SEEKER_ABILITIES: AbilityId[] = ['scanner', 'footprints', 'sound', 'speed'];
export const SCANNER_RANGE = 14;
export const SOUND_RANGE = 26;

// ---------- Modes ----------
export interface ModeDef {
  id: ModeId;
  name: string;
  tagline: string;
  description: string;
  icon: string;
  color: string;
  prepTime?: number;
}

export const MODES: Record<ModeId, ModeDef> = {
  classic: { id: 'classic', name: 'Classic', icon: '🎨', color: '#7c5cff', tagline: 'Paint. Hide. Survive.', description: 'Hiders camouflage themselves; seekers must tag every hider before time runs out.' },
  infection: { id: 'infection', name: 'Infection', icon: '🦠', color: '#22c55e', tagline: 'Caught? Now you hunt.', description: 'Every hider who gets tagged joins the seekers. Last one standing wins it for the hiders.' },
  everyone: { id: 'everyone', name: 'Everyone Hides', icon: '🙈', color: '#f59e0b', tagline: 'Hide your statue. Find theirs.', description: 'Everyone paints and hides. Then your disguise is frozen as a statue and everybody hunts for points.', prepTime: 60 },
  teambattle: { id: 'teambattle', name: 'Team Battle', icon: '⚔️', color: '#ef4444', tagline: 'Red vs Blue, two rounds.', description: 'Two teams take turns hiding and seeking. Highest combined score after both rounds wins.' },
  chaos: { id: 'chaos', name: 'Chaos', icon: '🌪️', color: '#ec4899', tagline: 'Expect the unexpected.', description: 'Classic rules plus random events: blackouts, fog, colour storms, decoration shuffles and bonus powers.' },
};
export const MODE_IDS = Object.keys(MODES) as ModeId[];

// ---------- Maps meta (geometry lives in /maps) ----------
export const MAP_META: Record<MapId, { name: string; description: string; icon: string; colors: [string, string] }> = {
  house: { name: 'Cozy House', description: 'Living room, kitchen, bedroom and a loft up the stairs.', icon: '🏠', colors: ['#f97316', '#fde68a'] },
  supermarket: { name: 'MegaMart', description: 'Aisles of snacks, humming fridges and a cluttered stockroom.', icon: '🛒', colors: ['#06b6d4', '#a7f3d0'] },
  school: { name: 'Sunnyvale School', description: 'Classrooms, a library, long hallways and a playground.', icon: '🏫', colors: ['#eab308', '#93c5fd'] },
  toyworld: { name: 'Toy World', description: 'Giant blocks, a huge teddy, ball pit and crayon forest.', icon: '🧸', colors: ['#ec4899', '#c4b5fd'] },
  factory: { name: 'Rust Factory', description: 'Dim machinery halls, pipes, catwalks and storage rooms.', icon: '🏭', colors: ['#64748b', '#f59e0b'] },
};
export const MAP_IDS = Object.keys(MAP_META) as MapId[];

// ---------- Cosmetics ----------
export type CosmeticSlot = 'hat' | 'glasses' | 'shoes' | 'accessory' | 'color' | 'victory' | 'emote';
export interface CosmeticItem {
  id: string;
  slot: CosmeticSlot;
  name: string;
  price: number; // coins (0 = free / level unlock)
  level: number; // required level
  value?: string; // color hex for color slot
  icon?: string;
}

export const COSMETICS: CosmeticItem[] = [
  // hats
  { id: 'hat_none', slot: 'hat', name: 'No Hat', price: 0, level: 1, icon: '🚫' },
  { id: 'hat_cap', slot: 'hat', name: 'Ball Cap', price: 0, level: 1, icon: '🧢' },
  { id: 'hat_beanie', slot: 'hat', name: 'Beanie', price: 0, level: 2, icon: '🧶' },
  { id: 'hat_party', slot: 'hat', name: 'Party Cone', price: 120, level: 1, icon: '🥳' },
  { id: 'hat_propeller', slot: 'hat', name: 'Propeller', price: 200, level: 3, icon: '🚁' },
  { id: 'hat_tophat', slot: 'hat', name: 'Top Hat', price: 300, level: 4, icon: '🎩' },
  { id: 'hat_bunny', slot: 'hat', name: 'Bunny Ears', price: 250, level: 5, icon: '🐰' },
  { id: 'hat_chef', slot: 'hat', name: 'Chef Hat', price: 350, level: 6, icon: '👨‍🍳' },
  { id: 'hat_crown', slot: 'hat', name: 'Royal Crown', price: 800, level: 10, icon: '👑' },
  // glasses
  { id: 'gl_none', slot: 'glasses', name: 'No Glasses', price: 0, level: 1, icon: '🚫' },
  { id: 'gl_round', slot: 'glasses', name: 'Round Specs', price: 0, level: 1, icon: '👓' },
  { id: 'gl_shades', slot: 'glasses', name: 'Cool Shades', price: 150, level: 2, icon: '🕶️' },
  { id: 'gl_star', slot: 'glasses', name: 'Star Glasses', price: 250, level: 4, icon: '🤩' },
  { id: 'gl_monocle', slot: 'glasses', name: 'Monocle', price: 400, level: 7, icon: '🧐' },
  // shoes
  { id: 'sh_none', slot: 'shoes', name: 'Barefoot', price: 0, level: 1, icon: '🦶' },
  { id: 'sh_sneaker', slot: 'shoes', name: 'Sneakers', price: 0, level: 1, icon: '👟' },
  { id: 'sh_boots', slot: 'shoes', name: 'Rain Boots', price: 150, level: 3, icon: '🥾' },
  { id: 'sh_gold', slot: 'shoes', name: 'Golden Kicks', price: 600, level: 8, icon: '✨' },
  // accessories
  { id: 'ac_none', slot: 'accessory', name: 'None', price: 0, level: 1, icon: '🚫' },
  { id: 'ac_scarf', slot: 'accessory', name: 'Cozy Scarf', price: 0, level: 1, icon: '🧣' },
  { id: 'ac_bowtie', slot: 'accessory', name: 'Bow Tie', price: 100, level: 2, icon: '🎀' },
  { id: 'ac_backpack', slot: 'accessory', name: 'Backpack', price: 220, level: 3, icon: '🎒' },
  { id: 'ac_cape', slot: 'accessory', name: 'Hero Cape', price: 450, level: 6, icon: '🦸' },
  // body colours
  { id: 'col_lilac', slot: 'color', name: 'Lilac', price: 0, level: 1, value: '#a78bfa' },
  { id: 'col_mint', slot: 'color', name: 'Mint', price: 0, level: 1, value: '#5eead4' },
  { id: 'col_peach', slot: 'color', name: 'Peach', price: 0, level: 1, value: '#fdba74' },
  { id: 'col_sky', slot: 'color', name: 'Sky', price: 0, level: 1, value: '#7dd3fc' },
  { id: 'col_lemon', slot: 'color', name: 'Lemon', price: 60, level: 1, value: '#fde047' },
  { id: 'col_rose', slot: 'color', name: 'Rose', price: 60, level: 2, value: '#fb7185' },
  { id: 'col_lime', slot: 'color', name: 'Lime', price: 80, level: 3, value: '#a3e635' },
  { id: 'col_midnight', slot: 'color', name: 'Midnight', price: 200, level: 5, value: '#4338ca' },
  { id: 'col_gold', slot: 'color', name: 'Gold', price: 500, level: 9, value: '#f59e0b' },
  // victory animations
  { id: 'vic_jump', slot: 'victory', name: 'Happy Hops', price: 0, level: 1, icon: '🐇' },
  { id: 'vic_spin', slot: 'victory', name: 'Tornado Spin', price: 150, level: 2, icon: '🌪️' },
  { id: 'vic_flip', slot: 'victory', name: 'Backflip', price: 300, level: 4, icon: '🤸' },
  { id: 'vic_wobble', slot: 'victory', name: 'Jelly Wobble', price: 250, level: 3, icon: '🍮' },
  // emotes (all equippable at once once owned)
  { id: 'em_wave', slot: 'emote', name: 'Wave 👋', price: 0, level: 1, icon: '👋' },
  { id: 'em_laugh', slot: 'emote', name: 'Laugh 😂', price: 0, level: 1, icon: '😂' },
  { id: 'em_dance', slot: 'emote', name: 'Dance 💃', price: 100, level: 2, icon: '💃' },
  { id: 'em_think', slot: 'emote', name: 'Hmm 🤔', price: 80, level: 1, icon: '🤔' },
  { id: 'em_heart', slot: 'emote', name: 'Love ❤️', price: 120, level: 3, icon: '❤️' },
  { id: 'em_taunt', slot: 'emote', name: 'Catch me 😜', price: 200, level: 5, icon: '😜' },
];
export const COSMETIC_BY_ID: Record<string, CosmeticItem> = Object.fromEntries(COSMETICS.map((c) => [c.id, c]));
export const DEFAULT_OWNED = COSMETICS.filter((c) => c.price === 0 && c.level <= 1).map((c) => c.id);
export const DEFAULT_COSMETICS: Cosmetics = {
  color: 'col_lilac',
  hat: 'hat_cap',
  glasses: 'gl_none',
  shoes: 'sh_sneaker',
  accessory: 'ac_none',
  victory: 'vic_jump',
};

export function cosmeticColor(id: string): string {
  return COSMETIC_BY_ID[id]?.value ?? '#a78bfa';
}

// ---------- Social ----------
export const QUICK_CHAT: string[] = [
  'Hi everyone! 👋',
  'Good luck! 🍀',
  'Ready!',
  'Where is everyone? 👀',
  'Found you! 😆',
  'So close!',
  'Nice hiding spot!',
  'GG! 🎉',
  'One more round?',
  'Brb',
  'Hehe 🤫',
  'Over here!',
];

export const NAME_MIN = 3;
export const NAME_MAX = 16;
