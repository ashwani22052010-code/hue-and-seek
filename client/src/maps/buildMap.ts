// Builds optimised render meshes from shared map data.
// Static props and detailed objects are merged per (material, 12 m cell): few draw calls + per-chunk culling.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { MapDef, PropDef } from '@shared/maps';
import type { PatternId, TexId } from '@shared/types';
import { PROPS } from '@shared/props/registry';
import { envTexture, multiplyHex, sampleGray, TEX_TO_PATTERN } from './textures';
import { coloredModel, propMaterial, type MatKind } from '../props/models';

export type Quality = 'low' | 'medium' | 'high';
const CELL = 12;

function isWallLike(p: PropDef) {
  const [w, h, d] = p.d;
  return h > 2.2 && Math.min(w, d) < 0.4;
}

function propGeometry(p: PropDef, quality: Quality): THREE.BufferGeometry {
  const ts = p.ts ?? 1;
  const [w, h, d] = p.d;
  let g: THREE.BufferGeometry;
  if (p.s === 'box') {
    // soften furniture edges on medium/high (walls, floors, ceilings stay crisp and cheap)
    const bevel = quality !== 'low' && !p.ceil && !p.glass && !isWallLike(p) && Math.min(w, h, d) >= 0.08 && Math.max(w, d) < 6;
    g = bevel ? new RoundedBoxGeometry(w, h, d, 1, Math.min(0.035, Math.min(w, h, d) / 4)) : new THREE.BoxGeometry(w, h, d);
    if (!bevel) {
      const uv = g.attributes.uv as THREE.BufferAttribute;
      const su = [d, d, w, w, w, w], sv = [h, h, d, d, h, h];
      for (let f = 0; f < 6; f++)
        for (let k = 0; k < 4; k++) {
          const i = f * 4 + k;
          uv.setXY(i, (uv.getX(i) * su[f]) / ts, (uv.getY(i) * sv[f]) / ts);
        }
    } else {
      // rounded boxes: planar world-scale UVs so textures keep their size
      const pos = g.attributes.position as THREE.BufferAttribute, nor = g.attributes.normal as THREE.BufferAttribute, uv = g.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const ax = Math.abs(nor.getX(i)), ay = Math.abs(nor.getY(i));
        const u = ax > 0.5 ? pos.getZ(i) : pos.getX(i);
        const v = ay > 0.5 ? pos.getZ(i) : pos.getY(i);
        uv.setXY(i, u / ts, v / ts);
      }
    }
  } else if (p.s === 'cyl' || p.s === 'cone') {
    const r = w / 2;
    const seg = quality === 'low' ? 10 : 16;
    g = p.s === 'cyl' ? new THREE.CylinderGeometry(r, r, h, seg, 1) : new THREE.ConeGeometry(r, h, seg, 1);
    if (d !== w) g.scale(1, 1, d / w);
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * Math.PI * w) / ts, (uv.getY(i) * Math.max(h, w)) / ts);
  } else {
    g = quality === 'low' ? new THREE.SphereGeometry(0.5, 10, 8) : new THREE.SphereGeometry(0.5, 16, 12);
    g.scale(w, h, d);
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * Math.PI * w) / ts, (uv.getY(i) * Math.PI * h * 0.5) / ts);
  }
  if (g.index) g = g.toNonIndexed();
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(...p.p),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...(p.rot ?? [0, 0, 0]))),
    new THREE.Vector3(1, 1, 1),
  );
  g.applyMatrix4(m);
  const color = new THREE.Color(p.c);
  const cols = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < cols.length; i += 3) { cols[i] = color.r; cols[i + 1] = color.g; cols[i + 2] = color.b; }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  return g;
}

export interface Chunk {
  mesh: THREE.Mesh;
  starts: number[]; // vertex start per entry (sorted)
  counts: number[];
  props: number[]; // prop index (or item index for item chunks) per range
}

export interface BuiltMap {
  group: THREE.Group;
  chunks: Chunk[];
  itemChunks: Chunk[];
  interactive: Map<string, { group: THREE.Group; meshes: THREE.Mesh[]; hinge?: [number, number] }>;
  propLocation: Map<number, { chunk: Chunk; range: number }>;
  dispose: () => void;
}

const materialCache = new Map<string, THREE.Material>();
function chunkMaterial(tex: TexId | 'glow' | 'glass'): THREE.Material {
  let m = materialCache.get(tex);
  if (!m) {
    m = tex === 'glow'
      ? new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })
      : tex === 'glass'
        ? new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0.2, depthWrite: false })
        : new THREE.MeshLambertMaterial({ vertexColors: true, map: envTexture(tex) });
    materialCache.set(tex, m);
  }
  return m;
}

function chunkify(entries: { key: string; idx: number; geo: THREE.BufferGeometry }[], material: (key: string) => THREE.Material, shadows: (key: string) => [boolean, boolean], kind: 'map' | 'item'): Chunk[] {
  const buckets = new Map<string, { idx: number[]; geos: THREE.BufferGeometry[] }>();
  for (const e of entries) {
    let b = buckets.get(e.key);
    if (!b) buckets.set(e.key, (b = { idx: [], geos: [] }));
    b.idx.push(e.idx);
    b.geos.push(e.geo);
  }
  const chunks: Chunk[] = [];
  for (const [key, b] of buckets) {
    const starts: number[] = [], counts: number[] = [];
    let v = 0;
    for (const g of b.geos) { starts.push(v); counts.push(g.attributes.position.count); v += g.attributes.position.count; }
    const merged = mergeGeometries(b.geos, false)!;
    b.geos.forEach((g) => g.dispose());
    merged.computeBoundingSphere();
    const mesh = new THREE.Mesh(merged, material(key));
    const [cast, receive] = shadows(key);
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    const chunk: Chunk = { mesh, starts, counts, props: b.idx };
    mesh.userData = kind === 'map' ? { kind: 'map', chunk } : { kind: 'item', chunk };
    if (key.startsWith('glass')) mesh.renderOrder = 2;
    chunks.push(chunk);
  }
  return chunks;
}

export function buildMap(def: MapDef, quality: Quality, overrides: Record<number, string> = {}): BuiltMap {
  const shadows = quality === 'high';
  const q = quality === 'low' ? 0.6 : quality === 'medium' ? 0.85 : 1;
  const group = new THREE.Group();
  const interactive = new Map<string, { group: THREE.Group; meshes: THREE.Mesh[]; hinge?: [number, number] }>();
  const disposables: THREE.BufferGeometry[] = [];
  const entries: { key: string; idx: number; geo: THREE.BufferGeometry }[] = [];

  def.props.forEach((p, i) => {
    if (p.group) {
      const it = def.interactables.find((x) => x.id === p.group);
      let entry = interactive.get(p.group);
      if (!entry) {
        const g = new THREE.Group();
        if (it?.hinge) g.position.set(it.hinge[0], it.p[1] - 1, it.hinge[1]);
        entry = { group: g, meshes: [], hinge: it?.hinge };
        interactive.set(p.group, entry);
        group.add(g);
      }
      const geo = propGeometry(p, quality);
      if (entry.hinge) geo.translate(-entry.hinge[0], -(it!.p[1] - 1), -entry.hinge[1]);
      disposables.push(geo);
      const mat = p.glow
        ? new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })
        : new THREE.MeshLambertMaterial({ vertexColors: true, map: envTexture(p.tex ?? 'none') });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.userData = { kind: 'map', single: i };
      mesh.castShadow = shadows;
      mesh.receiveShadow = shadows;
      entry.meshes.push(mesh);
      entry.group.add(mesh);
      return;
    }
    const tex = p.glow ? 'glow' : p.glass ? 'glass' : p.tex ?? 'none';
    const geo = propGeometry(p, quality);
    if (overrides[i]) {
      const c = new THREE.Color(overrides[i]);
      const col = geo.attributes.color as THREE.BufferAttribute;
      for (let k = 0; k < col.count; k++) col.setXYZ(k, c.r, c.g, c.b);
    }
    entries.push({ key: `${tex}|${p.ceil ? 'c' : ''}|${Math.floor(p.p[0] / CELL)}|${Math.floor(p.p[2] / CELL)}`, idx: i, geo });
  });

  const chunks = chunkify(entries, (key) => chunkMaterial(key.split('|')[0] as TexId), (key) => {
    const [tex, ceil] = key.split('|');
    return [shadows && tex !== 'glow' && tex !== 'glass' && ceil !== 'c', shadows];
  }, 'map');
  const propLocation = new Map<number, { chunk: Chunk; range: number }>();
  for (const c of chunks) { group.add(c.mesh); c.props.forEach((pi, r) => propLocation.set(pi, { chunk: c, range: r })); }

  // detailed objects
  const itemEntries: { key: string; idx: number; geo: THREE.BufferGeometry }[] = [];
  const m4 = new THREE.Matrix4();
  def.items.forEach((it, i) => {
    const type = PROPS[it.t];
    const s = it.s ?? 1;
    m4.compose(new THREE.Vector3(...it.p), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, it.r, 0)), new THREE.Vector3(s, s, s));
    for (const [kind, geo] of coloredModel(it.t, it.c ?? type?.color ?? '#cccccc', q, m4)) {
      itemEntries.push({ key: `${kind}|${Math.floor(it.p[0] / CELL)}|${Math.floor(it.p[2] / CELL)}`, idx: i, geo });
    }
  });
  const itemChunks = chunkify(itemEntries, (key) => propMaterial(key.split('|')[0] as MatKind, () => null, quality), (key) => {
    const kind = key.split('|')[0];
    return [shadows && kind !== 'glow' && kind !== 'glass', shadows];
  }, 'item');
  for (const c of itemChunks) group.add(c.mesh);

  // ground beneath everything (visible through windows)
  const b = def.bounds;
  const groundGeo = new THREE.PlaneGeometry(b.maxX - b.minX + 120, b.maxZ - b.minZ + 120);
  groundGeo.rotateX(-Math.PI / 2);
  disposables.push(groundGeo);
  const ground = new THREE.Mesh(groundGeo, new THREE.MeshLambertMaterial({ color: new THREE.Color('#86c46b') }));
  ground.position.set((b.minX + b.maxX) / 2, -0.015, (b.minZ + b.maxZ) / 2);
  ground.receiveShadow = shadows;
  ground.userData = { kind: 'map', ground: def.floor.c };
  group.add(ground);

  return {
    group, chunks, itemChunks, interactive, propLocation,
    dispose: () => {
      disposables.forEach((g) => g.dispose());
      [...chunks, ...itemChunks].forEach((c) => c.mesh.geometry.dispose());
    },
  };
}

/** Recolour props (chaos "decoration shuffle"). */
export function applyPropColors(built: BuiltMap, def: MapDef, overrides: Record<number, string>) {
  const touched = new Set<THREE.BufferAttribute>();
  const c = new THREE.Color();
  for (const [k, hex] of Object.entries(overrides)) {
    const loc = built.propLocation.get(Number(k));
    if (!loc) continue;
    c.set(hex);
    const attr = loc.chunk.mesh.geometry.attributes.color as THREE.BufferAttribute;
    const s = loc.chunk.starts[loc.range], n = loc.chunk.counts[loc.range];
    for (let i = s; i < s + n; i++) attr.setXYZ(i, c.r, c.g, c.b);
    touched.add(attr);
  }
  touched.forEach((a) => (a.needsUpdate = true));
  void def;
}

/** Which entry of a chunk a ray hit (binary search over vertex ranges). */
export function chunkEntryAt(chunk: Chunk, hit: THREE.Intersection): number | undefined {
  if (!hit.face) return undefined;
  const v = hit.face.a;
  const { starts } = chunk;
  let lo = 0, hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= v) lo = mid; else hi = mid - 1;
  }
  return chunk.props[lo];
}

/** Index of the detailed object hit by a ray, if any. */
export function itemAtHit(hit: THREE.Intersection): number | undefined {
  const ud = hit.object.userData as { kind?: string; chunk?: Chunk };
  if (ud.kind !== 'item' || !ud.chunk) return undefined;
  return chunkEntryAt(ud.chunk, hit);
}

/** Eyedropper: the base colour, the "flat" colour including texture shading, and the surface texture. */
export function sampleMapHit(def: MapDef, hit: THREE.Intersection, overrides: Record<number, string>): { base: string; flat: string; tex: TexId; pattern: PatternId } | null {
  const ud = hit.object.userData as { kind?: string; chunk?: Chunk; single?: number; ground?: string };
  if (ud.ground) return { base: ud.ground, flat: ud.ground, tex: 'none', pattern: 'solid' };
  if (ud.kind === 'item' && hit.face) {
    // read the exact vertex colour of the object's part that was hit
    const col = (hit.object as THREE.Mesh).geometry.attributes.color as THREE.BufferAttribute;
    const c = new THREE.Color(col.getX(hit.face.a), col.getY(hit.face.a), col.getZ(hit.face.a));
    const hex = '#' + c.getHexString();
    return { base: hex, flat: hex, tex: 'none', pattern: 'solid' };
  }
  let propIndex: number | undefined;
  if (ud.single !== undefined) propIndex = ud.single;
  else if (ud.chunk) propIndex = chunkEntryAt(ud.chunk, hit);
  if (propIndex === undefined) return null;
  const prop = def.props[propIndex];
  const base = overrides[propIndex] ?? prop.c;
  const tex: TexId = prop.glow || prop.glass ? 'none' : prop.tex ?? 'none';
  let flat = base;
  if (tex !== 'none' && hit.uv) flat = multiplyHex(base, sampleGray(tex, hit.uv.x, hit.uv.y));
  return { base, flat, tex, pattern: TEX_TO_PATTERN[tex] };
}
