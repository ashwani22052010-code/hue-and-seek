import { useEffect, useMemo, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import type { MapDef } from '@shared/maps';
import { buildMapWorld } from '@shared/maps';
import type { PublicPlayer, Vec3 } from '@shared/types';
import { FLAG_GROUNDED, FLAG_MOVING, FLAG_PAINTING, FLAG_SPRINT } from '@shared/types';
import { CLIENT_SEND_RATE, PHYS, POSES, SHAPES, TAG_RANGE } from '@shared/constants';
import { raycastWorld, stepCharacter, type MoveState } from '@shared/game-rules/physics';
import { useStore } from '../store/useStore';
import { cam, consumeLook, input, moveAxes } from '../controls/input';
import { emit, onTeleport, getLastSpawn, sampleRemote, serverClock, visibleIds } from '../multiplayer/net';
import { Hueling, newLive } from '../characters/Hueling';
import { paintFor } from '../characters/paint';
import { registry, raycastTargets } from './registry';
import { sfx } from '../audio/sound';
import { fx } from './fxBus';

export function myPlayer(): PublicPlayer | undefined {
  const s = useStore.getState();
  return s.room?.players.find((p) => p.id === s.myId);
}

/** Mirrors the server's movement rules so prediction rarely needs correcting. */
function movementAllowed(me: PublicPlayer | undefined, phase: string, frozen: boolean, paintMode: boolean) {
  if (!me || me.team === 'none') return false;
  if (me.caught && me.team === 'hider') return false;
  if (phase === 'assign' || phase === 'intermission' || phase === 'results' || phase === 'lobby') return false;
  if (phase === 'prep' && me.team === 'seeker') return false;
  return !frozen && !paintMode;
}

export function isSpectating(me: PublicPlayer | undefined, mode: string | undefined) {
  if (!me) return true;
  if (me.team === 'none') return true;
  return me.caught && me.team === 'hider' && mode !== 'everyone';
}

const ray = new THREE.Raycaster();

export function LocalPlayer({ def }: { def: MapDef }) {
  const world = useMemo(() => buildMapWorld(def), [def]);
  const { camera, gl } = useThree();
  const myId = useStore((s) => s.myId)!;
  const me = useStore((s) => s.room?.players.find((p) => p.id === s.myId));
  const phase = useStore((s) => s.room?.phase ?? 'lobby');
  const mode = useStore((s) => s.room?.settings.mode);
  const st = useRef<MoveState>({ p: [0, 0, 0], v: [0, 0, 0], grounded: true });
  const yaw = useRef(0);
  const group = useRef<THREE.Group>(null!);
  const live = useRef(newLive());
  const lastSend = useRef(0);
  const seq = useRef(0);
  const stepTimer = useRef(0);
  const wasGrounded = useRef(true);
  const aimTimer = useRef(0);
  const camPos = useRef(new THREE.Vector3());
  const camTarget = useRef(new THREE.Vector3());
  const lastSent = useRef<string>('');

  useEffect(() => {
    registry.world = world;
    registry.map = def;
    const sp = getLastSpawn();
    if (sp) { st.current.p = [...sp.p]; if (sp.r !== undefined) yaw.current = sp.r; }
    return onTeleport((p, r) => {
      st.current.p = [...p];
      st.current.v = [0, 0, 0];
      if (r !== undefined) { yaw.current = r; cam.yaw = r + Math.PI; }
    });
  }, [world, def]);

  const autopilot = useRef<Vec3[]>([]);
  const camOverride = useRef<null | { pos: Vec3; target: Vec3 }>(null);
  useEffect(() => {
    // Automation hooks (used by the E2E test). They only drive the same inputs a player can, and
    // everything they cause is validated by the server exactly like keyboard/mouse input.
    (window as unknown as { __hueTest: unknown }).__hueTest = {
      pos: () => [...st.current.p],
      walk: (pts: Vec3[]) => { autopilot.current = pts.map((q) => [...q] as Vec3); },
      walking: () => autopilot.current.length > 0,
      aimAt: (x: number, y: number, z: number) => {
        const p = st.current.p;
        const sh = useStore.getState().room?.phase === 'hunt' ? 0.55 : 0;
        let sx = p[0], sz = p[2];
        for (let i = 0; i < 4; i++) {
          cam.yaw = Math.atan2(-(x - sx), -(z - sz));
          sx = p[0] + Math.cos(cam.yaw) * sh;
          sz = p[2] - Math.sin(cam.yaw) * sh;
        }
        const L = Math.hypot(x - sx, z - sz);
        cam.pitch = Math.atan2(0.95 - y, Math.max(0.5, L));
      },
      paintOps: (id: string) => paintFor(id).ops.length,
      camOverride: (v: null | { pos: Vec3; target: Vec3 }) => { camOverride.current = v; },
    };
    return fx.on((e) => {
      if (e.kind === 'emote' && e.id === myId) {
        live.current.anim = e.emote;
        live.current.animStart = performance.now() / 1000;
        setTimeout(() => { if (live.current.anim === e.emote) live.current.anim = null; }, 2600);
      }
    });
  }, [myId]);
  // victory animation on the results screen
  useEffect(() => {
    if (phase !== 'results') { if (live.current.anim?.startsWith('vic_')) live.current.anim = null; return; }
    const res = useStore.getState().room?.results;
    const mine = res?.players.find((x) => x.id === myId);
    if (mine?.won && me) { live.current.anim = me.cosmetics.victory; live.current.animStart = performance.now() / 1000; }
  }, [phase, myId, me]);

  const showPaint = me?.team === 'hider' && (phase === 'prep' || phase === 'hunt' || phase === 'assign');
  const paintTex = showPaint ? paintFor(myId).texture : null;

  const onMeshes = useCallback((meshes: THREE.Mesh[]) => registry.characters.set(myId, meshes), [myId]);
  const userData = useMemo(() => ({ kind: 'player', playerId: myId }), [myId]);

  // tag (seeker poke) from crosshair or a tap position
  const tryTag = useCallback((screen: { x: number; y: number } | null) => {
    const s = useStore.getState();
    const meNow = myPlayer();
    if (!meNow || s.room?.phase !== 'hunt' || meNow.team !== 'seeker' || s.paintMode) return;
    if (serverClock() < s.tagReadyAt) { sfx('error'); return; }
    const ndc = screen ? new THREE.Vector2((screen.x / gl.domElement.clientWidth) * 2 - 1, -(screen.y / gl.domElement.clientHeight) * 2 + 1) : new THREE.Vector2(0, 0);
    ray.setFromCamera(ndc, camera);
    ray.far = 40;
    const hits = ray.intersectObjects(raycastTargets(myId), false);
    const hit = hits[0];
    if (!hit) return;
    const eye = new THREE.Vector3(st.current.p[0], st.current.p[1] + 0.9, st.current.p[2]);
    if (hit.point.distanceTo(eye) > TAG_RANGE + 0.2) {
      s.toast('Too far away - get closer to poke!', 'info');
      sfx('error');
      return;
    }
    emit('tag', { p: [hit.point.x, hit.point.y, hit.point.z] });
    fx.emit({ kind: 'poke', p: [hit.point.x, hit.point.y, hit.point.z], hit: true });
  }, [camera, gl, myId]);

  useEffect(() => {
    const el = gl.domElement;
    const down = (e: PointerEvent) => {
      if (useStore.getState().paintMode) return;
      if (e.pointerType === 'mouse' && e.button === 0 && input.pointerLocked) tryTag(null);
    };
    el.addEventListener('pointerdown', down);
    return () => el.removeEventListener('pointerdown', down);
  }, [gl, tryTag]);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const s = useStore.getState();
    const room = s.room;
    if (!room) return;
    const meNow = room.players.find((p) => p.id === myId);
    const now = Date.now();
    const myActive = s.active[myId] ?? {};
    const frozen = (myActive.freeze ?? 0) > serverClock();
    const speedBoost = (myActive.speed ?? 0) > serverClock();
    const vanish = (myActive.vanish ?? 0) > serverClock();
    const spectating = isSpectating(meNow, room.settings.mode);
    const canMove = movementAllowed(meNow, room.phase, frozen, s.paintMode);

    // ---- camera look input ----
    const look = consumeLook();
    const sens = 0.0032 * s.settings.sensitivity;
    cam.yaw -= look.x * sens;
    cam.pitch = THREE.MathUtils.clamp(cam.pitch + look.y * sens * (s.settings.invertY ? -1 : 1), -0.6, 1.25);
    if (input.zoom) { cam.dist = THREE.MathUtils.clamp(cam.dist + input.zoom * 0.4, 2.2, 9); input.zoom = 0; }

    // ---- movement ----
    const shape = SHAPES[meNow?.look.shape ?? 'normal'];
    const axes = moveAxes();
    const fwd = { x: -Math.sin(cam.yaw), z: -Math.cos(cam.yaw) };
    const right = { x: Math.cos(cam.yaw), z: -Math.sin(cam.yaw) };
    let ix = 0, iz = 0;
    if (autopilot.current.length) {
      const t = autopilot.current[0];
      const dx = t[0] - st.current.p[0], dz = t[2] - st.current.p[2];
      const dl = Math.hypot(dx, dz);
      if (dl < Math.max(0.15, PHYS.walkSpeed * dt * 1.2)) autopilot.current.shift();
      else { axes.x = (dx * right.x + dz * right.z) / dl; axes.y = (dx * fwd.x + dz * fwd.z) / dl; axes.sprint = false; }
    }
    if (canMove) { ix = fwd.x * axes.y + right.x * axes.x; iz = fwd.z * axes.y + right.z * axes.x; }
    const hiderHunt = meNow?.team === 'hider' && room.phase === 'hunt' && room.settings.mode !== 'everyone';
    let speed = hiderHunt ? PHYS.hiderHuntSpeed : axes.sprint ? PHYS.sprintSpeed : PHYS.walkSpeed;
    if (speedBoost) speed *= PHYS.seekerSpeedBoost;
    const jump = input.jump && canMove;
    input.jump = false;
    if (!spectating) {
      const height = shape.height;
      stepCharacter(world, st.current, { x: ix, z: iz, jump, sprint: axes.sprint }, dt, { radius: shape.radius, height, speed, disabled: registry.disabledGroups });
      if (jump && !st.current.grounded) sfx('jump');
    }
    const moving = Math.hypot(st.current.v[0], st.current.v[2]) > 0.3;
    if (moving && canMove) {
      const target = Math.atan2(ix, iz);
      let d = target - yaw.current;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      yaw.current += d * Math.min(1, dt * 12);
    }
    if (s.paintMode) yaw.current = yaw.current; // keep facing while painting

    // footsteps / landing
    if (moving && st.current.grounded && !spectating) {
      stepTimer.current -= dt;
      if (stepTimer.current <= 0) {
        stepTimer.current = axes.sprint ? 0.26 : 0.36;
        const silent = (myActive.silent ?? 0) > serverClock();
        sfx('step', undefined, silent ? 0.15 : hiderHunt ? 0.5 : 0.8);
      }
    }
    if (!wasGrounded.current && st.current.grounded) sfx('land', undefined, 0.6);
    wasGrounded.current = st.current.grounded;

    // ---- render self ----
    const p = st.current.p;
    group.current.position.set(p[0], p[1], p[2]);
    group.current.rotation.y = yaw.current;
    group.current.visible = !spectating;
    const L = live.current;
    L.moving = moving;
    L.sprint = axes.sprint;
    L.grounded = st.current.grounded;
    L.eyesClosed = frozen || (meNow?.team === 'hider' && !moving && (room.phase === 'hunt') && now - (lastMoveAt.current) > 1500);
    if (moving) lastMoveAt.current = now;
    const tint = s.tints[myId];
    const storm = s.chaosFx?.event === 'color_storm' && s.chaosFx.until > now ? s.chaosFx.color : null;
    L.tint = tint && tint.until > serverClock() ? tint.color : storm ?? null;
    L.tintAmt = tint && tint.until > serverClock() ? 0.55 : storm ? 0.35 : 0;
    L.opacity = vanish ? 0.35 : 1;
    registry.local.p = [p[0], p[1], p[2]];
    registry.local.yaw = yaw.current;
    registry.local.camYaw = cam.yaw;

    // ---- send to server ----
    const flags = (st.current.grounded ? FLAG_GROUNDED : 0) | (moving ? FLAG_MOVING : 0) | (axes.sprint && moving ? FLAG_SPRINT : 0) | (s.paintMode ? FLAG_PAINTING : 0);
    if (!spectating && now - lastSend.current >= 1000 / CLIENT_SEND_RATE) {
      const key = `${p[0].toFixed(2)},${p[1].toFixed(2)},${p[2].toFixed(2)},${yaw.current.toFixed(2)},${flags}`;
      if (key !== lastSent.current || now - lastSend.current > 500) {
        lastSend.current = now;
        lastSent.current = key;
        emit('move', { p: [+p[0].toFixed(3), +p[1].toFixed(3), +p[2].toFixed(3)], r: +yaw.current.toFixed(3), f: flags, s: seq.current++ });
      }
    }

    // ---- interactables nearby ----
    let near: { id: string; label: string } | null = null;
    if (!spectating && (room.phase === 'prep' || room.phase === 'hunt') && !(room.phase === 'prep' && meNow?.team === 'seeker')) {
      let best = 2.8;
      for (const it of def.interactables) {
        const d = Math.hypot(it.p[0] - p[0], it.p[1] - (p[1] + 0.5), it.p[2] - p[2]);
        if (d < best) { best = d; near = { id: it.id, label: it.label }; }
      }
    }
    if ((near?.id ?? null) !== (s.nearInteract?.id ?? null)) s.set({ nearInteract: near });
    if (input.interact) {
      input.interact = false;
      if (near) emit('interact', { id: near.id });
    }
    if (input.tag) { input.tag = false; tryTag(null); }
    if (input.tagAt) { const at = input.tagAt; input.tagAt = null; tryTag(at); }

    // ---- camera ----
    let focus: Vec3 = [p[0], p[1], p[2]];
    if (spectating) {
      const ids = visibleIds().filter((id) => id !== myId);
      if (ids.length) {
        const target = sampleRemote(ids[((s.spectateIdx % ids.length) + ids.length) % ids.length]);
        if (target) focus = target.p;
      } else {
        const b = def.bounds;
        focus = [(b.minX + b.maxX) / 2, 0, (b.minZ + b.maxZ) / 2];
      }
    }
    const height = shape.height * (POSES[meNow?.look.pose ?? 'stand']?.heightFactor ?? 1);
    const paintCam = s.paintMode;
    // portrait phones: the paint studio is a bottom sheet, so pull back and raise the character on screen
    const portrait = state.size.width / state.size.height < 0.9;
    const dist = paintCam ? (portrait ? 3.7 : 2.3) : spectating ? 8 : cam.dist;
    const pitch = paintCam ? THREE.MathUtils.clamp(cam.pitch, -0.5, 1.2) : cam.pitch;
    const targetY = focus[1] + (paintCam ? height * 0.55 - (portrait ? 0.75 : 0) : Math.max(0.9, height * 0.95));
    // seekers get an over-the-shoulder camera so their own body never blocks the crosshair
    const shoulder = !paintCam && !spectating && meNow?.team === 'seeker' && room.phase === 'hunt' ? 0.55 : 0;
    camTarget.current.set(focus[0] + Math.cos(cam.yaw) * shoulder, targetY, focus[2] - Math.sin(cam.yaw) * shoulder);
    const dir = new THREE.Vector3(Math.sin(cam.yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(cam.yaw) * Math.cos(pitch));
    // camera collision against map geometry
    const o: Vec3 = [camTarget.current.x, camTarget.current.y, camTarget.current.z];
    const hit = raycastWorld(world, o, [dir.x, dir.y, dir.z], dist, registry.disabledGroups);
    const d = hit === Infinity ? dist : Math.max(0.6, hit - 0.25);
    const wanted = camTarget.current.clone().add(dir.multiplyScalar(d));
    camPos.current.lerp(wanted, camPos.current.lengthSq() === 0 ? 1 : Math.min(1, dt * 14));
    camera.position.copy(camPos.current);
    camera.lookAt(camTarget.current);
    if (camOverride.current) {
      camera.position.set(...camOverride.current.pos);
      camera.lookAt(...camOverride.current.target);
    }

    // ---- seeker aim assist indicator ----
    aimTimer.current -= dt;
    if (aimTimer.current <= 0 && meNow?.team === 'seeker' && room.phase === 'hunt') {
      aimTimer.current = 0.12;
      ray.setFromCamera(new THREE.Vector2(0, 0), camera);
      ray.far = 30;
      const h = ray.intersectObjects(raycastTargets(myId), false)[0];
      const inRange = !!h && h.point.distanceTo(new THREE.Vector3(p[0], p[1] + 0.9, p[2])) <= TAG_RANGE;
      if (inRange !== s.aimTarget) s.set({ aimTarget: inRange });
    }
  });
  const lastMoveAt = useRef(Date.now());

  if (!me) return null;
  const showCosmetics = me.team !== 'hider' || phase === 'results';
  return (
    <group ref={group}>
      <Hueling
        look={me.look}
        cosmetics={me.cosmetics}
        showCosmetics={showCosmetics}
        paint={paintTex}
        live={live.current}
        onMeshes={onMeshes}
        userData={userData}
      />
    </group>
  );
}
