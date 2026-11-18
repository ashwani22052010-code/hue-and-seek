// Builds optimised render meshes from shared map data.
// Static props are merged per (material, 12m cell) => few draw calls + frustum culling per chunk.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { MapDef, PropDef } from '@shared/maps';
import type { TexId } from '@shared/types';
import { envTexture, multiplyHex, sampleGray, TEX_TO_PATTERN } from './textures';

const CELL = 12;

function propGeometry(p: PropDef): THREE.BufferGeometry {
  const ts = p.ts ?? 1;
  const [w, h, d] = p.d;
  let g: THREE.BufferGeometry;
  if (p.s === 'box') {
    g = new THREE.BoxGeometry(w, h, d);
    const uv = g.attributes.uv as THREE.BufferAttribute;
    const su = [d, d, w, w, w, w], sv = [h, h, d, d, h, h];
    for (let f = 0; f < 6; f++)
      for (let k = 0; k < 4; k++) {
        const i = f * 4 + k;
        uv.setXY(i, (uv.getX(i) * su[f]) / ts, (uv.getY(i) * sv[f]) / ts);
      }
  } else if (p.s === 'cyl' || p.s === 'cone') {
    const r = w / 2;
    g = p.s === 'cyl' ? new THREE.CylinderGeometry(r, r, h, 14, 1) : new THREE.ConeGeometry(r, h, 14, 1);
    if (d !== w) g.scale(1, 1, d / w);
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * Math.PI * w) / ts, (uv.getY(i) * Math.max(h, w)) / ts);
  } else {
    g = new THREE.SphereGeometry(0.5, 14, 10);
    g.scale(w, h, d);
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * Math.PI * w) / ts, (uv.getY(i) * Math.PI * h * 0.5) / ts);
  }
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
  starts: number[]; // vertex start per prop (sorted)
  counts: number[];
  props: number[]; // prop index per range
}

export interface BuiltMap {
  group: THREE.Group;
  chunks: Chunk[];
  interactive: Map<string, { group: THREE.Group; meshes: THREE.Mesh[]; hinge?: [number, number] }>;
  propLocation: Map<number, { chunk: Chunk; range: number }>;
  dispose: () => void;
}

const materialCache = new Map<string, THREE.Material>();
function chunkMaterial(tex: TexId | 'glow'): THREE.Material {
  let m = materialCache.get(tex);
  if (!m) {
    m = tex === 'glow'
      ? new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })
      : new THREE.MeshLambertMaterial({ vertexColors: true, map: envTexture(tex) });
    materialCache.set(tex, m);
  }
  return m;
}

export function buildMap(def: MapDef, shadows: boolean): BuiltMap {
  const group = new THREE.Group();
  const buckets = new Map<string, { idx: number[]; tex: TexId | 'glow' }>();
  const interactive = new Map<string, { group: THREE.Group; meshes: THREE.Mesh[]; hinge?: [number, number] }>();
  const disposables: THREE.BufferGeometry[] = [];

  def.props.forEach((p, i) => {
    if (p.group) {
      const it = def.interactables.find((x) => x.id === p.group);
      let entry = interactive.get(p.group);
      if (!entry) {
        const g = new THREE.Group();
        if (it?.hinge) g.position.set(it.hinge[0], 0, it.hinge[1]);
        entry = { group: g, meshes: [], hinge: it?.hinge };
        interactive.set(p.group, entry);
        group.add(g);
      }
      const geo = propGeometry(p);
      if (entry.hinge) geo.translate(-entry.hinge[0], 0, -entry.hinge[1]);
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
    const tex: TexId | 'glow' = p.glow ? 'glow' : p.tex ?? 'none';
    const key = `${tex}|${Math.floor(p.p[0] / CELL)}|${Math.floor(p.p[2] / CELL)}`;
    let b = buckets.get(key);
    if (!b) buckets.set(key, (b = { idx: [], tex }));
    b.idx.push(i);
  });

  const chunks: Chunk[] = [];
  const propLocation = new Map<number, { chunk: Chunk; range: number }>();
  for (const b of buckets.values()) {
    const geos = b.idx.map((i) => propGeometry(def.props[i]));
    const starts: number[] = [], counts: number[] = [];
    let v = 0;
    for (const g of geos) { starts.push(v); counts.push(g.attributes.position.count); v += g.attributes.position.count; }
    const merged = mergeGeometries(geos.map((g) => (g.index ? g : g)), false)!;
    geos.forEach((g) => g.dispose());
    merged.computeBoundingSphere();
    disposables.push(merged);
    const mesh = new THREE.Mesh(merged, chunkMaterial(b.tex));
    mesh.castShadow = shadows && b.tex !== 'glow';
    mesh.receiveShadow = shadows;
    const chunk: Chunk = { mesh, starts, counts, props: b.idx };
    mesh.userData = { kind: 'map', chunk };
    b.idx.forEach((pi, r) => propLocation.set(pi, { chunk, range: r }));
    chunks.push(chunk);
    group.add(mesh);
  }

  // ground beneath everything
  const b = def.bounds;
  const groundGeo = new THREE.PlaneGeometry(b.maxX - b.minX + 80, b.maxZ - b.minZ + 80);
  groundGeo.rotateX(-Math.PI / 2);
  disposables.push(groundGeo);
  const ground = new THREE.Mesh(groundGeo, new THREE.MeshLambertMaterial({ color: new THREE.Color(def.floor.c).multiplyScalar(0.7) }));
  ground.position.set((b.minX + b.maxX) / 2, -0.015, (b.minZ + b.maxZ) / 2);
  ground.receiveShadow = shadows;
  ground.userData = { kind: 'map', ground: def.floor.c };
  group.add(ground);

  return {
    group, chunks, interactive, propLocation,
    dispose: () => disposables.forEach((g) => g.dispose()),
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

/** Eyedropper: the base colour, the "flat" colour including texture shading, and the surface texture. */
export function sampleMapHit(def: MapDef, hit: THREE.Intersection, overrides: Record<number, string>): { base: string; flat: string; tex: TexId; pattern: ReturnType<() => typeof TEX_TO_PATTERN[TexId]> } | null {
  const ud = hit.object.userData as { chunk?: Chunk; single?: number; ground?: string };
  let propIndex: number | undefined;
  if (ud.ground) return { base: ud.ground, flat: ud.ground, tex: 'none', pattern: 'solid' };
  if (ud.single !== undefined) propIndex = ud.single;
  else if (ud.chunk && hit.face) {
    const v = hit.face.a;
    const { starts } = ud.chunk;
    let lo = 0, hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= v) lo = mid; else hi = mid - 1;
    }
    propIndex = ud.chunk.props[lo];
  }
  if (propIndex === undefined) return null;
  const prop = def.props[propIndex];
  const base = overrides[propIndex] ?? prop.c;
  const tex: TexId = prop.glow ? 'none' : prop.tex ?? 'none';
  let flat = base;
  if (tex !== 'none' && hit.uv) flat = multiplyHex(base, sampleGray(tex, hit.uv.x, hit.uv.y));
  return { base, flat, tex, pattern: TEX_TO_PATTERN[tex] };
}
