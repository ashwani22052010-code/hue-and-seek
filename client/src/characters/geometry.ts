// Character geometry: every part's UVs are remapped into its own region of the shared paint atlas.
import * as THREE from 'three';
import type { RegionId } from '@shared/types';
import { REGIONS } from '@shared/constants';

function remapUV(geo: THREE.BufferGeometry, rect: [number, number, number, number]) {
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  const [u0, v0, u1, v1] = rect;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
  uv.needsUpdate = true;
  return geo;
}
const region = (geo: THREE.BufferGeometry, r: RegionId) => remapUV(geo, REGIONS[r].rect);

export const BODY_H = 1.02;
export const EYE_Y = 0.7;

function bodyProfile(segments: number): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [];
  const R = 0.36, c = 0.42;
  for (let i = 0; i <= segments; i++) {
    const a = -Math.PI / 2 + (i / segments) * Math.PI;
    const top = a > 0;
    const x = Math.max(0.0001, R * Math.cos(a) * (top ? 0.92 : 1));
    const y = c + (top ? 0.6 : 0.42) * Math.sin(a);
    pts.push(new THREE.Vector2(x, Math.max(0, y)));
  }
  return pts;
}

export interface CharacterGeometries {
  body: THREE.BufferGeometry;
  arm: [THREE.BufferGeometry, THREE.BufferGeometry];
  foot: [THREE.BufferGeometry, THREE.BufferGeometry];
  tail: THREE.BufferGeometry;
  crest: THREE.BufferGeometry;
  eye: THREE.BufferGeometry;
  pupil: THREE.BufferGeometry;
  lid: THREE.BufferGeometry;
}

const cache: Record<'hi' | 'lo', CharacterGeometries | null> = { hi: null, lo: null };

/** LOD: 'lo' is used for distant characters. */
export function characterGeometries(lod: 'hi' | 'lo' = 'hi'): CharacterGeometries {
  const c = cache[lod];
  if (c) return c;
  const q = lod === 'hi' ? 1 : 0.5;
  const body = region(new THREE.LatheGeometry(bodyProfile(Math.round(22 * q)), Math.round(30 * q), -Math.PI, Math.PI * 2), 'body');
  body.computeVertexNormals();
  const arm = (r: RegionId) => region(new THREE.CapsuleGeometry(0.075, 0.2, 3, Math.round(10 * q)), r);
  const foot = (r: RegionId) => region(new THREE.SphereGeometry(0.13, Math.round(12 * q), Math.round(8 * q)), r);
  const tail = region(new THREE.ConeGeometry(0.08, 0.32, Math.round(10 * q), 2), 'tail');
  const crest = region(new THREE.SphereGeometry(0.1, Math.round(10 * q), Math.round(8 * q)), 'crest');
  const eye = new THREE.SphereGeometry(0.1, Math.round(16 * q), Math.round(12 * q));
  const pupil = new THREE.SphereGeometry(0.05, Math.round(12 * q), Math.round(8 * q));
  // eyelids take their colour from the body paint right around the eyes
  const lidRect: [number, number, number, number] = (() => {
    const [u0, v0, u1, v1] = REGIONS.body.rect;
    const ev = EYE_Y / BODY_H;
    return [u0 + (u1 - u0) * 0.45, v0 + (v1 - v0) * (ev - 0.05), u0 + (u1 - u0) * 0.55, v0 + (v1 - v0) * (ev + 0.05)];
  })();
  const lid = remapUV(new THREE.SphereGeometry(0.106, Math.round(16 * q), Math.round(12 * q)), lidRect);
  const g: CharacterGeometries = { body, arm: [arm('armL'), arm('armR')], foot: [foot('footL'), foot('footR')], tail, crest, eye, pupil, lid };
  cache[lod] = g;
  return g;
}

/** Character paint material with a tint uniform (Color Shift / Color Storm) and opacity for vanish. */
export function makeCharacterMaterial(): THREE.MeshLambertMaterial & { userData: { tint: { value: THREE.Color }; tintAmt: { value: number } } } {
  const mat = new THREE.MeshLambertMaterial({ color: '#ffffff', transparent: false });
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
  mat.customProgramCacheKey = () => 'hueling-tint';
  return mat as never;
}
