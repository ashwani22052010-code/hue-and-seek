import type { MapId, TexId, Vec3 } from '../types';

export type PropShape = 'box' | 'cyl' | 'sphere' | 'cone';

export interface PropDef {
  s: PropShape;
  p: Vec3; // centre
  d: Vec3; // full dimensions
  rot?: Vec3; // euler radians (visual + rotated AABB collider)
  c: string; // base colour (hex)
  tex?: TexId;
  ts?: number; // metres per texture tile
  solid?: boolean; // default true
  decor?: boolean; // eligible for chaos decoration shuffle
  group?: string; // interactable group id
  glow?: boolean; // emissive
  ceil?: boolean; // ceiling / roof slab (never casts shadows)
  glass?: boolean; // transparent window pane
}

/** A detailed object from the prop registry placed in the map (y = bottom). */
export interface ItemDef {
  t: string; // prop type id (shared/src/props/registry.ts)
  p: Vec3;
  r: number; // yaw
  c?: string; // main colour override
  s?: number; // uniform scale
}

export type InteractableKind = 'door' | 'lamp' | 'sound';

export interface InteractableDef {
  id: string;
  kind: InteractableKind;
  label: string;
  p: Vec3; // where players interact
  defaultActive: boolean;
  sound?: 'squeak' | 'bell' | 'horn' | 'chime' | 'piano' | 'boing';
  hinge?: [number, number]; // door hinge (x,z)
  openAngle?: number; // radians
}

export interface LightDef {
  p: Vec3;
  c: string;
  i: number;
  dist: number;
  group?: string; // lamp interactable id
}

export interface MapDef {
  id: MapId;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  floor: { c: string; tex: TexId; ts?: number };
  sky: string;
  fog: string;
  ambient: number;
  hemi: [string, string, number];
  sun: { c: string; i: number; dir: Vec3 };
  hiderSpawns: Vec3[];
  seekerSpawns: Vec3[];
  props: PropDef[];
  items: ItemDef[];
  interactables: InteractableDef[];
  lights: LightDef[];
}
