import { useCallback, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { DecoyState, PublicPlayer, StatueState } from '@shared/types';
import { FLAG_EYES_CLOSED, FLAG_GROUNDED, FLAG_MOVING, FLAG_SILENT, FLAG_SPRINT } from '@shared/types';
import { SHAPES } from '@shared/constants';
import { useStore } from '../store/useStore';
import { sampleRemote, serverClock } from '../multiplayer/net';
import { Hueling, newLive } from '../characters/Hueling';
import { paintFor } from '../characters/paint';
import { registry } from './registry';
import { sfx } from '../audio/sound';
import { fx } from './fxBus';

// ---------- canvas text sprites (no external font downloads) ----------
function makeLabel(text: string, bg: string, fg = '#ffffff', size = 34) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d')!;
  ctx.font = `700 ${size}px Fredoka, Nunito, sans-serif`;
  const w = Math.ceil(ctx.measureText(text).width) + 28;
  c.width = w;
  c.height = size + 20;
  ctx.font = `700 ${size}px Fredoka, Nunito, sans-serif`;
  ctx.fillStyle = bg;
  const r = c.height / 2;
  ctx.beginPath();
  ctx.roundRect(0, 0, w, c.height, r);
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 14, c.height / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
  const sprite = new THREE.Sprite(mat);
  const scale = 0.0072;
  sprite.scale.set(c.width * scale, c.height * scale, 1);
  sprite.renderOrder = 10;
  return sprite;
}

export function Label({ text, bg, y, fg }: { text: string; bg: string; y: number; fg?: string }) {
  const sprite = useMemo(() => makeLabel(text, bg, fg), [text, bg, fg]);
  useEffect(() => () => { sprite.material.map?.dispose(); sprite.material.dispose(); }, [sprite]);
  return <primitive object={sprite} position={[0, y, 0]} />;
}

function Bubble({ playerId, y }: { playerId: string; y: number }) {
  const b = useStore((s) => s.bubbles[playerId]);
  const ref = useRef<THREE.Group>(null);
  useFrame(() => { if (ref.current) ref.current.visible = !!b && b.until > Date.now(); });
  if (!b) return null;
  return <group ref={ref}><Label text={b.text} bg="rgba(255,255,255,0.95)" fg="#1e1b4b" y={y} /></group>;
}

// ---------- remote player ----------
function RemotePlayer({ p, showName }: { p: PublicPlayer; showName: boolean }) {
  const group = useRef<THREE.Group>(null!);
  const live = useRef(newLive());
  const stepT = useRef(0);
  const phase = useStore((s) => s.room?.phase);
  const isHiderPaint = p.team === 'hider' && (phase === 'prep' || phase === 'hunt' || phase === 'assign');
  const paint = isHiderPaint ? paintFor(p.id).texture : null;
  const onMeshes = useCallback((m: THREE.Mesh[]) => registry.characters.set(p.id, m), [p.id]);
  const userData = useMemo(() => ({ kind: 'player', playerId: p.id }), [p.id]);

  useEffect(() => fx.on((e) => {
    if (e.kind === 'emote' && e.id === p.id) { live.current.anim = e.emote; live.current.animStart = performanceNowSec(); setTimeout(() => { if (live.current.anim === e.emote) live.current.anim = null; }, 2600); }
  }), [p.id]);
  useEffect(() => () => { registry.characters.delete(p.id); }, [p.id]);

  useFrame((_, dt) => {
    const s = sampleRemote(p.id);
    const g = group.current;
    if (!s) { g.visible = false; return; }
    g.visible = true;
    g.position.set(s.p[0], s.p[1], s.p[2]);
    g.rotation.y = s.yaw;
    const L = live.current;
    L.moving = !!(s.f & FLAG_MOVING);
    L.sprint = !!(s.f & FLAG_SPRINT);
    L.grounded = !!(s.f & FLAG_GROUNDED);
    L.eyesClosed = !!(s.f & FLAG_EYES_CLOSED);
    const st = useStore.getState();
    const now = Date.now();
    const tint = st.tints[p.id];
    const storm = st.chaosFx?.event === 'color_storm' && st.chaosFx.until > now ? st.chaosFx.color : null;
    const tActive = tint && tint.until > serverClock();
    L.tint = tActive ? tint.color : storm ?? null;
    L.tintAmt = tActive ? 0.55 : storm ? 0.35 : 0;
    const vanish = (st.active[p.id]?.vanish ?? 0) > serverClock();
    L.opacity = vanish ? 0.3 : 1;
    // positional footsteps: sneaking hiders can be heard!
    if (L.moving && L.grounded && !(s.f & FLAG_SILENT)) {
      stepT.current -= dt;
      if (stepT.current <= 0) {
        stepT.current = L.sprint ? 0.26 : 0.38;
        sfx('step', s.p, p.team === 'hider' ? 0.9 : 0.7);
      }
    }
  });

  const h = SHAPES[p.look.shape].height;
  const showCos = p.team !== 'hider' || phase === 'results';
  return (
    <group ref={group} visible={false}>
      <Hueling look={p.look} cosmetics={p.cosmetics} showCosmetics={showCos} paint={paint} live={live.current} onMeshes={onMeshes} userData={userData} />
      {showName && <Label text={p.name} bg={p.team === 'seeker' ? 'rgba(239,68,68,0.9)' : p.team === 'hider' ? 'rgba(34,197,94,0.9)' : 'rgba(30,27,75,0.8)'} y={h + 0.55} />}
      <Bubble playerId={p.id} y={h + 1.0} />
    </group>
  );
}
const performanceNowSec = () => performance.now() / 1000;

export function RemotePlayers() {
  const players = useStore((s) => s.room?.players);
  const myId = useStore((s) => s.myId);
  const me = players?.find((p) => p.id === myId);
  const phase = useStore((s) => s.room?.phase);
  if (!players) return null;
  return (
    <>
      {players.filter((p) => p.id !== myId).map((p) => {
        // Name tags would give hiders away: seekers only see other seekers' names.
        const showName = p.team === 'seeker' || me?.team === 'hider' || me?.team === 'none' || !!me?.caught || phase === 'results';
        return <RemotePlayer key={p.id} p={p} showName={showName} />;
      })}
    </>
  );
}

// ---------- decoys & statues ----------
function StaticCopy({ id, ownerId, pos, yaw, look, kind, found }: { id: string; ownerId: string; pos: [number, number, number]; yaw: number; look: DecoyState['look']; kind: 'decoy' | 'statue'; found?: boolean }) {
  const live = useMemo(() => { const l = newLive(); l.eyesClosed = true; return l; }, []);
  const owner = useStore((s) => s.room?.players.find((p) => p.id === ownerId));
  const onMeshes = useCallback((m: THREE.Mesh[]) => registry.extras.set(id, m), [id]);
  const userData = useMemo(() => ({ kind, id, ownerId }), [kind, id, ownerId]);
  useEffect(() => () => { registry.extras.delete(id); }, [id]);
  useEffect(() => { if (found) registry.extras.delete(id); }, [found, id]);
  if (!owner) return null;
  return (
    <group position={pos} rotation={[0, yaw, 0]}>
      <Hueling look={look} cosmetics={owner.cosmetics} showCosmetics={false} paint={paintFor(ownerId).texture} live={live} onMeshes={found ? undefined : onMeshes} userData={userData} />
      {found && <Label text={`Found: ${owner.name}`} bg="rgba(239,68,68,0.9)" y={1.6} />}
    </group>
  );
}

export function DecoysAndStatues() {
  const decoys = useStore((s) => s.decoys);
  const statues = useStore((s) => s.statues);
  const myId = useStore((s) => s.myId);
  return (
    <>
      {decoys.map((d) => <StaticCopy key={d.id} id={'decoy:' + d.id} ownerId={d.ownerId} pos={d.p} yaw={d.r} look={d.look} kind="decoy" />)}
      {statues.map((s: StatueState) => (
        <StaticCopy key={s.ownerId} id={'statue:' + s.ownerId} ownerId={s.ownerId} pos={s.p} yaw={s.r} look={s.look} kind="statue" found={s.found || undefined} />
      ))}
      {statues.filter((s) => s.ownerId === myId && !s.found).map((s) => (
        <group key="mine" position={[s.p[0], s.p[1] + 1.7, s.p[2]]}><Label text="Your statue" bg="rgba(124,58,237,0.9)" y={0} /></group>
      ))}
    </>
  );
}
