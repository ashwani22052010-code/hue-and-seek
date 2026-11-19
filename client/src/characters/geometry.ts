// Slim mascot geometry. Every part's UVs are remapped into its region (or a sub-rect of it)
// of the shared 512x512 paint atlas, so the whole body stays paintable.
import * as THREE from 'three';
import type { RegionId } from '@shared/types';
import { REGIONS } from '@shared/constants';

/** Rig dimensions (metres, normal shape). Feet touch y = 0. */
export const RIG = {
  hip: 0.5, // hip joint height
  torsoH: 0.47,
  neckY: 0.5, // relative to hips
  headY: 0.69, // head centre relative to hips
  headR: 0.165,
  shoulderX: 0.185,
  shoulderY: 0.41,
  legX: 0.08,
  thigh: 0.25,
  shin: 0.22,
};
export const TOTAL_H = RIG.hip + RIG.headY + RIG.headR; // ~1.36

type Sub = [number, number, number, number];
function remap(geo: THREE.BufferGeometry, region: RegionId, sub: Sub = [0, 0, 1, 1]) {
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  const [r0, s0, r1, s1] = REGIONS[region].rect;
  const u0 = r0 + (r1 - r0) * sub[0], u1 = r0 + (r1 - r0) * sub[2];
  const v0 = s0 + (s1 - s0) * sub[1], v1 = s0 + (s1 - s0) * sub[3];
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
  uv.needsUpdate = true;
  return geo;
}

export interface CharacterGeometries {
  torso: THREE.BufferGeometry;
  neck: THREE.BufferGeometry;
  head: THREE.BufferGeometry;
  upperArm: [THREE.BufferGeometry, THREE.BufferGeometry];
  hand: [THREE.BufferGeometry, THREE.BufferGeometry];
  thigh: [THREE.BufferGeometry, THREE.BufferGeometry];
  shin: [THREE.BufferGeometry, THREE.BufferGeometry];
  foot: [THREE.BufferGeometry, THREE.BufferGeometry];
  eye: THREE.BufferGeometry;
  pupil: THREE.BufferGeometry;
  lid: THREE.BufferGeometry;
}

const cache: Record<'hi' | 'lo', CharacterGeometries | null> = { hi: null, lo: null };

export function characterGeometries(lod: 'hi' | 'lo' = 'hi'): CharacterGeometries {
  const c = cache[lod];
  if (c) return c;
  const q = lod === 'hi' ? 1 : 0.55;
  const n = (v: number) => Math.max(5, Math.round(v * q));
  // torso: smooth tapered bean (hips -> waist -> chest -> rounded shoulders)
  const prof: [number, number][] = [[0.001, -0.02], [0.1, -0.015], [0.135, 0.02], [0.145, 0.08], [0.13, 0.17], [0.14, 0.27], [0.155, 0.35], [0.15, 0.41], [0.12, 0.45], [0.07, 0.475], [0.001, 0.48]];
  const torso = remap(new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), n(28), -Math.PI, Math.PI * 2), 'body');
  torso.computeVertexNormals();
  const neck = remap(new THREE.CylinderGeometry(0.045, 0.055, 0.1, n(12)), 'body', [0, 0.92, 1, 1]);
  const head = remap(new THREE.SphereGeometry(RIG.headR, n(28), n(20), -Math.PI / 2, Math.PI * 2), 'head');
  const arm = (r: RegionId) => remap(new THREE.CapsuleGeometry(0.043, 0.24, 4, n(12)), r, [0, 0.3, 1, 1]);
  const hand = (r: RegionId) => remap(new THREE.SphereGeometry(0.05, n(12), n(10)), r, [0, 0, 1, 0.3]);
  const thigh = (r: RegionId) => remap(new THREE.CapsuleGeometry(0.058, 0.16, 4, n(12)), r, [0, 0.6, 1, 1]);
  const shin = (r: RegionId) => remap(new THREE.CapsuleGeometry(0.05, 0.14, 4, n(12)), r, [0, 0.25, 1, 0.6]);
  const foot = (r: RegionId) => {
    const g = new THREE.SphereGeometry(0.06, n(12), n(10));
    g.scale(0.95, 0.62, 1.55);
    g.translate(0, 0, 0.035);
    return remap(g, r, [0, 0, 1, 0.25]);
  };
  const eye = new THREE.SphereGeometry(0.044, n(16), n(12));
  const pupil = new THREE.SphereGeometry(0.023, n(12), n(8));
  // eyelids take their colour from the head paint right around the eyes (front of the head = u 0.5)
  const lid = remap(new THREE.SphereGeometry(0.047, n(16), n(12)), 'head', [0.44, 0.52, 0.56, 0.62]);
  const g: CharacterGeometries = {
    torso, neck, head, eye, pupil, lid,
    upperArm: [arm('armL'), arm('armR')], hand: [hand('armL'), hand('armR')],
    thigh: [thigh('legL'), thigh('legR')], shin: [shin('legL'), shin('legR')], foot: [foot('legL'), foot('legR')],
  };
  cache[lod] = g;
  return g;
}

/** Character paint material with a tint uniform (Color Shift / Color Storm) and opacity for vanish. */
export function makeCharacterMaterial(): THREE.MeshStandardMaterial & { userData: { tint: { value: THREE.Color }; tintAmt: { value: number } } } {
  // smooth, clean white "vinyl toy" finish
  const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.55, metalness: 0 });
  const tint = { value: new THREE.Color('#ffffff') };
  const tintAmt = { value: 0 };
  mat.userData.tint = tint;
  mat.userData.tintAmt = tintAmt;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTint = tint;
    shader.uniforms.uTintAmt = tintAmt;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uTint;\nuniform float uTintAmt;')
      .replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, uTint, uTintAmt);');
  };
  mat.customProgramCacheKey = () => 'hueling-tint-v2';
  return mat as never;
}
