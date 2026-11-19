// Static imports of every map (server side; the client uses lazy MAP_LOADERS instead).
import type { MapId } from '../types';
import type { MapDef } from './types';
import { buildHouse } from './house';
import { buildSupermarket } from './supermarket';
import { buildSchool } from './school';
import { buildToyWorld } from './toyworld';
import { buildFactory } from './factory';
import { buildOffice } from './office';
import { buildRestaurant } from './restaurant';

const builders: Record<MapId, () => MapDef> = {
  house: buildHouse,
  supermarket: buildSupermarket,
  school: buildSchool,
  toyworld: buildToyWorld,
  factory: buildFactory,
  office: buildOffice,
  restaurant: buildRestaurant,
};
const cache = new Map<MapId, MapDef>();
export function getMapSync(id: MapId): MapDef {
  let m = cache.get(id);
  if (!m) cache.set(id, (m = builders[id]()));
  return m;
}
