// Non-reactive registry of scene objects used for raycasting and gameplay queries.
import type * as THREE from 'three';
import type { MapDef } from '@shared/maps';
import type { CollisionWorld } from '@shared/game-rules/physics';
import type { BuiltMap } from '../maps/buildMap';

export const registry = {
  map: null as MapDef | null,
  world: null as CollisionWorld | null,
  built: null as BuiltMap | null,
  mapMeshes: [] as THREE.Object3D[],
  characters: new Map<string, THREE.Mesh[]>(), // playerId -> paintable meshes
  extras: new Map<string, THREE.Mesh[]>(), // decoys / statues
  disabledGroups: new Set<string>(),
  local: { p: [0, 0, 0] as [number, number, number], yaw: 0, camYaw: 0 },
};

export function raycastTargets(includeSelf: string | null): THREE.Object3D[] {
  const out: THREE.Object3D[] = [...registry.mapMeshes];
  for (const [id, meshes] of registry.characters) if (id !== includeSelf) out.push(...meshes);
  for (const meshes of registry.extras.values()) out.push(...meshes);
  return out;
}
