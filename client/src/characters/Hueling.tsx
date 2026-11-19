// The Hueling: a slim, smooth, fully paintable mascot with a jointed rig and procedural animation.
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { Cosmetics, PlayerLook, PoseId } from '@shared/types';
import { SHAPES, cosmeticColor } from '@shared/constants';
import { characterGeometries, makeCharacterMaterial, RIG } from './geometry';
import { HeadCosmetics, TorsoCosmetics, ShoeView } from './Cosmetics';

/** Mutable per-frame state supplied by the owner (avoids React re-renders at 60fps). */
export interface HuelingLive {
  moving: boolean;
  sprint: boolean;
  grounded: boolean;
  eyesClosed: boolean;
  anim: string | null; // emote / victory / defeat id
  animStart: number;
  tint: string | null;
  tintAmt: number;
  opacity: number;
  turn: number; // yaw rate (rad/s), used for leaning into turns
}
export const newLive = (): HuelingLive => ({
  moving: false, sprint: false, grounded: true, eyesClosed: false, anim: null, animStart: 0, tint: null, tintAmt: 0, opacity: 1, turn: 0,
});

interface Props {
  look: PlayerLook;
  cosmetics: Cosmetics;
  showCosmetics: boolean;
  paint: THREE.Texture | null; // null => outfit colour (seekers / lobby)
  live: HuelingLive;
  onMeshes?: (meshes: THREE.Mesh[]) => void;
  userData?: Record<string, unknown>;
}

/** Joint targets for a pose (radians; x = pitch, z = roll). */
interface J {
  rootY: number; rootX: number; rootZ: number; hipsY: number; lean: number; headX: number;
  thL: [number, number]; thR: [number, number]; knL: number; knR: number;
  shL: [number, number]; shR: [number, number]; sq: number;
}
const J0: J = { rootY: 0, rootX: 0, rootZ: 0, hipsY: 0, lean: 0, headX: 0, thL: [0, 0.02], thR: [0, -0.02], knL: 0, knR: 0, shL: [0, 0.12], shR: [0, -0.12], sq: 1 };
const P = (o: Partial<J>): J => ({ ...J0, ...o });
const POSE: Record<PoseId, J> = {
  stand: J0,
  sit: P({ hipsY: -0.27, thL: [-1.5, 0.12], thR: [-1.5, -0.12], knL: 1.45, knR: 1.45, shL: [-0.45, 0.2], shR: [-0.45, -0.2], lean: -0.05 }),
  crouch: P({ hipsY: -0.22, thL: [-1.05, 0.18], thR: [-1.05, -0.18], knL: 2.0, knR: 2.0, lean: 0.38, shL: [-0.7, 0.15], shR: [-0.7, -0.15], headX: -0.25 }),
  lie: P({ rootX: -Math.PI / 2, rootY: 0.16, shL: [0, 0.35], shR: [0, -0.35] }),
  curl: P({ hipsY: -0.31, thL: [-1.9, 0.22], thR: [-1.9, -0.22], knL: 2.5, knR: 2.5, lean: 0.7, headX: 0.45, shL: [-1.3, -0.35], shR: [-1.3, 0.35], sq: 0.96 }),
  starfish: P({ rootX: Math.PI / 2, rootY: 0.15, shL: [0, 1.45], shR: [0, -1.45], thL: [0, 0.55], thR: [0, -0.55] }),
  handstand: P({ rootX: Math.PI, rootY: 1.4, shL: [0, 2.95], shR: [0, -2.95], thL: [0, 0.25], thR: [0, -0.25] }),
  flamingo: P({ thR: [0.25, -0.05], knR: 2.1, shL: [0, 1.35], shR: [0, -1.35], rootZ: 0.04 }),
  peek: P({ shL: [-2.45, -0.5], shR: [-2.45, 0.5], headX: 0.12 }),
};

const lerp = THREE.MathUtils.lerp;
function lerpJ(c: J, t: J, k: number) {
  c.rootY = lerp(c.rootY, t.rootY, k); c.rootX = lerp(c.rootX, t.rootX, k); c.rootZ = lerp(c.rootZ, t.rootZ, k);
  c.hipsY = lerp(c.hipsY, t.hipsY, k); c.lean = lerp(c.lean, t.lean, k); c.headX = lerp(c.headX, t.headX, k); c.sq = lerp(c.sq, t.sq, k);
  for (let i = 0; i < 2; i++) {
    c.thL[i] = lerp(c.thL[i], t.thL[i], k); c.thR[i] = lerp(c.thR[i], t.thR[i], k);
    c.shL[i] = lerp(c.shL[i], t.shL[i], k); c.shR[i] = lerp(c.shR[i], t.shR[i], k);
  }
  c.knL = lerp(c.knL, t.knL, k); c.knR = lerp(c.knR, t.knR, k);
}

export function Hueling({ look, cosmetics, showCosmetics, paint, live, onMeshes, userData }: Props) {
  const geo = useMemo(() => characterGeometries('hi'), []);
  const geoLo = useMemo(() => characterGeometries('lo'), []);
  const mat = useMemo(() => makeCharacterMaterial(), []);
  const eyeMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.2 }), []);
  const pupilMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#1e1b4b' }), []);
  const r = {
    root: useRef<THREE.Group>(null!), shape: useRef<THREE.Group>(null!), hips: useRef<THREE.Group>(null!), chest: useRef<THREE.Group>(null!),
    head: useRef<THREE.Group>(null!), shL: useRef<THREE.Group>(null!), shR: useRef<THREE.Group>(null!),
    thL: useRef<THREE.Group>(null!), thR: useRef<THREE.Group>(null!), knL: useRef<THREE.Group>(null!), knR: useRef<THREE.Group>(null!),
    eyes: useRef<THREE.Group>(null!), lids: useRef<THREE.Group>(null!), torso: useRef<THREE.Mesh>(null!), headMesh: useRef<THREE.Mesh>(null!),
  };
  const paintMeshes = useRef<THREE.Mesh[]>([]);
  const cur = useRef<J>(structuredClone(J0));
  const phase = useRef(0);
  const lod = useRef<'hi' | 'lo'>('hi');
  const tmpV = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    mat.map = paint;
    mat.color.set(paint ? '#ffffff' : cosmeticColor(cosmetics.color));
    mat.needsUpdate = true;
  }, [paint, cosmetics.color, mat]);

  useEffect(() => {
    const list = paintMeshes.current.filter(Boolean);
    for (const m of list) m.userData = { ...m.userData, ...userData };
    onMeshes?.(list);
  }, [onMeshes, userData]);
  useEffect(() => () => { mat.dispose(); eyeMat.dispose(); pupilMat.dispose(); }, [mat, eyeMat, pupilMat]);

  const reg = (i: number) => (m: THREE.Mesh | null) => { if (m) paintMeshes.current[i] = m; };

  useFrame((state, dt) => {
    dt = Math.min(dt, 0.1);
    const t = state.clock.elapsedTime;
    const c = cur.current;
    lerpJ(c, POSE[look.pose] ?? J0, Math.min(1, dt * 10));
    let { rootY, rootX, rootZ, hipsY, lean, headX } = c;
    let rootRY = 0;
    const thL = [...c.thL], thR = [...c.thR], shL = [...c.shL], shR = [...c.shR];
    let knL = c.knL, knR = c.knR, sqY = c.sq, sqX = 1;

    // ---- locomotion: walk / run cycle with knees, arm swing, bob and lean ----
    const standing = look.pose === 'stand' || look.pose === 'flamingo' || look.pose === 'peek';
    if (live.moving && standing) {
      const run = live.sprint;
      phase.current += dt * (run ? 11.5 : 7.5);
      const s = Math.sin(phase.current), s2 = Math.sin(phase.current + Math.PI);
      const A = run ? 0.85 : 0.5;
      thL[0] = s * A; thR[0] = s2 * A;
      knL = Math.max(0, -Math.cos(phase.current)) * (run ? 1.3 : 0.7);
      knR = Math.max(0, Math.cos(phase.current)) * (run ? 1.3 : 0.7);
      shL[0] = -s * (run ? 0.9 : 0.5); shR[0] = -s2 * (run ? 0.9 : 0.5);
      hipsY += Math.abs(Math.cos(phase.current)) * (run ? 0.045 : 0.025);
      lean += run ? 0.2 : 0.06;
      rootZ += s * 0.025;
    } else if (standing) {
      // idle: breathing, gentle sway, occasional glance
      sqY *= 1 + Math.sin(t * 2.1) * 0.012;
      shL[1] += Math.sin(t * 1.3) * 0.03; shR[1] -= Math.sin(t * 1.3) * 0.03;
      headX += Math.sin(t * 0.6) * 0.04;
      rootRY = Math.sin(t * 0.35) * 0.06;
    }
    if (!live.grounded && standing) { thL[0] = -0.5; thR[0] = -0.2; knL = 1.1; knR = 0.6; shL[1] = 1.0; shR[1] = -1.0; }
    rootZ += THREE.MathUtils.clamp(-live.turn * 0.04, -0.18, 0.18); // lean into turns

    // ---- emotes, victory, defeat ----
    if (live.anim) {
      const a = t - live.animStart;
      switch (live.anim) {
        case 'em_wave': shR[0] = -2.7; shR[1] = -0.3 + Math.sin(a * 14) * 0.4; break;
        case 'em_dance': rootZ += Math.sin(a * 9) * 0.18; hipsY += Math.abs(Math.sin(a * 9)) * 0.06; shL[1] = 1.2 + Math.sin(a * 9) * 0.6; shR[1] = -1.2 + Math.sin(a * 9) * 0.6; thL[0] = Math.sin(a * 9) * 0.4; break;
        case 'em_laugh': lean -= 0.25; sqY *= 1 + Math.sin(a * 30) * 0.03; shL[0] = -0.8; shR[0] = -0.8; break;
        case 'em_think': shR[0] = -2.2; shR[1] = 0.6; headX = 0.2; rootZ += 0.06; break;
        case 'em_heart': rootY += Math.abs(Math.sin(a * 6)) * 0.25; shL[1] = 2.6; shR[1] = -2.6; break;
        case 'em_taunt': rootRY = a * 9; shL[1] = 1.4; shR[1] = -1.4; break;
        case 'vic_jump': rootY += Math.abs(Math.sin(a * 5)) * 0.5; shL[1] = 2.7; shR[1] = -2.7; knL = knR = Math.abs(Math.cos(a * 5)) * 0.8; break;
        case 'vic_spin': rootRY = a * 12; rootY += 0.1; shL[1] = 1.5; shR[1] = -1.5; break;
        case 'vic_flip': { const ph = (a % 1.4) / 1.4; rootY += Math.sin(ph * Math.PI) * 0.9; rootX = -ph * Math.PI * 2; shL[1] = 2.4; shR[1] = -2.4; knL = knR = 1.2; break; }
        case 'vic_wobble': sqY *= 1 + Math.sin(a * 12) * 0.14; sqX = 1 - Math.sin(a * 12) * 0.08; shL[1] = 1 + Math.sin(a * 12); shR[1] = -1 - Math.sin(a * 12); break;
        case 'defeat': headX = 0.55; lean = 0.3; shL[0] = 0.15; shR[0] = 0.15; shL[1] = 0.05; shR[1] = -0.05; hipsY -= 0.03; break;
      }
    }

    // ---- apply ----
    const sh = SHAPES[look.shape].scale;
    const k = Math.min(1, dt * 10);
    const S = r.shape.current.scale;
    S.set(lerp(S.x, sh[0] * sqX, k), lerp(S.y, sh[1] * sqY, k), lerp(S.z, sh[2] * sqX, k));
    r.root.current.position.y = rootY * sh[1];
    r.root.current.rotation.set(rootX, rootRY, rootZ);
    r.hips.current.position.y = RIG.hip + hipsY;
    r.chest.current.rotation.x = lean;
    r.head.current.rotation.x = headX;
    r.thL.current.rotation.set(thL[0], 0, thL[1]);
    r.thR.current.rotation.set(thR[0], 0, thR[1]);
    r.knL.current.rotation.x = knL;
    r.knR.current.rotation.x = knR;
    r.shL.current.rotation.set(shL[0], 0, shL[1]);
    r.shR.current.rotation.set(shR[0], 0, shR[1]);

    const closed = live.eyesClosed || look.pose === 'peek';
    r.lids.current.visible = closed;
    r.eyes.current.visible = !closed;

    const u = mat.userData;
    if (live.tint) u.tint.value.set(live.tint);
    u.tintAmt.value = lerp(u.tintAmt.value, live.tint ? live.tintAmt : 0, Math.min(1, dt * 4));
    const transparent = live.opacity < 0.999;
    if (mat.transparent !== transparent) { mat.transparent = transparent; mat.needsUpdate = true; }
    mat.opacity = live.opacity;

    // level of detail
    r.torso.current.getWorldPosition(tmpV);
    const want = tmpV.distanceTo(state.camera.position) > 14 ? 'lo' : 'hi';
    if (want !== lod.current) {
      lod.current = want;
      const g = want === 'lo' ? geoLo : geo;
      r.torso.current.geometry = g.torso;
      r.headMesh.current.geometry = g.head;
    }
  });

  return (
    <group ref={r.root}>
      <group ref={r.shape}>
        <group ref={r.hips} position={[0, RIG.hip, 0]}>
          <group ref={r.chest}>
            <mesh ref={(m) => { r.torso.current = m!; reg(0)(m); }} geometry={geo.torso} material={mat} castShadow receiveShadow />
            <mesh ref={reg(1)} geometry={geo.neck} material={mat} position={[0, RIG.neckY, 0]} castShadow />
            <group ref={r.head} position={[0, RIG.headY, 0]}>
              <mesh ref={(m) => { r.headMesh.current = m!; reg(2)(m); }} geometry={geo.head} material={mat} castShadow />
              <group ref={r.eyes}>
                {[0.06, -0.06].map((x) => (
                  <group key={x} position={[x, 0.02, 0.128]}>
                    <mesh geometry={geo.eye} material={eyeMat} />
                    <mesh geometry={geo.pupil} material={pupilMat} position={[0, 0.003, 0.03]} />
                  </group>
                ))}
              </group>
              <group ref={r.lids}>
                {[0.06, -0.06].map((x, i) => (
                  <mesh key={x} ref={reg(3 + i)} geometry={geo.lid} material={mat} position={[x, 0.02, 0.128]} scale={[1, 0.9, 0.8]} />
                ))}
              </group>
              {showCosmetics && <HeadCosmetics c={cosmetics} />}
            </group>
            {([['L', 1, r.shL, 0], ['R', -1, r.shR, 1]] as const).map(([side, sx, ref, i]) => (
              <group key={side} ref={ref} position={[sx * RIG.shoulderX, RIG.shoulderY, 0]}>
                <mesh ref={reg(5 + i)} geometry={geo.upperArm[i]} material={mat} position={[0, -0.155, 0]} castShadow />
                <mesh ref={reg(7 + i)} geometry={geo.hand[i]} material={mat} position={[0, -0.33, 0]} castShadow />
              </group>
            ))}
            {showCosmetics && <TorsoCosmetics c={cosmetics} />}
          </group>
          {([['L', 1, r.thL, r.knL, 0], ['R', -1, r.thR, r.knR, 1]] as const).map(([side, sx, th, kn, i]) => (
            <group key={side} ref={th} position={[sx * RIG.legX, 0, 0]}>
              <mesh ref={reg(9 + i)} geometry={geo.thigh[i]} material={mat} position={[0, -0.125, 0]} castShadow />
              <group ref={kn} position={[0, -RIG.thigh, 0]}>
                <mesh ref={reg(11 + i)} geometry={geo.shin[i]} material={mat} position={[0, -0.11, 0]} castShadow />
                <mesh ref={reg(13 + i)} geometry={geo.foot[i]} material={mat} position={[0, -RIG.shin, 0]} castShadow>
                  {showCosmetics && <ShoeView id={cosmetics.shoes} />}
                </mesh>
              </group>
            </group>
          ))}
        </group>
      </group>
    </group>
  );
}
