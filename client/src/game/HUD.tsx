import { useEffect, useRef, useState } from 'react';
import type { AbilityId, PublicPlayer } from '@shared/types';
import { ABILITIES, COSMETIC_BY_ID, COSMETICS, MAP_META, MODES, QUICK_CHAT } from '@shared/constants';
import { ACHIEVEMENT_BY_ID } from '@shared/game-rules/progression';
import type { MapDef } from '@shared/maps';
import { useStore, useTouchUI } from '../store/useStore';
import { emit, request, serverClock } from '../multiplayer/net';
import { Btn, Panel, fmtTime } from '../ui/kit';
import { Minimap } from './Minimap';
import { PaintPanel, PosePicker } from './PaintPanel';
import { input, exitLock, cam } from '../controls/input';
import { Joystick, LookArea, RoundBtn } from '../controls/TouchControls';
import { loadPreset } from '../characters/paint';
import { sfx } from '../audio/sound';
import { isSpectating } from './LocalPlayer';
import { SettingsBody } from '../screens/Settings';

const useNow = (ms = 250) => {
  const [now, setNow] = useState(serverClock());
  useEffect(() => { const id = setInterval(() => setNow(serverClock()), ms); return () => clearInterval(id); }, [ms]);
  return now;
};

export function useMe(): PublicPlayer | undefined {
  return useStore((s) => s.room?.players.find((p) => p.id === s.myId));
}

export function activateAbility(id: AbilityId) {
  if (id === 'quickdisguise') {
    const ops = loadPreset();
    if (!ops) { useStore.getState().toast('Save a camouflage in the paint studio first (💾 Save)', 'bad'); sfx('error'); return; }
    emit('ability', { id, data: { ops } });
  } else emit('ability', { id });
}

function PhaseTimer() {
  const room = useStore((s) => s.room)!;
  const now = useNow(200);
  const left = room.phaseEndsAt - now;
  const lastBeep = useRef(-1);
  const secs = Math.ceil(left / 1000);
  useEffect(() => {
    if ((room.phase === 'prep' || room.phase === 'hunt' || room.phase === 'assign') && secs <= 5 && secs > 0 && secs !== lastBeep.current) {
      lastBeep.current = secs;
      sfx('tick');
    }
  }, [secs, room.phase]);
  const label = { assign: 'Get ready', prep: 'Hide & paint!', hunt: 'Hunt', intermission: 'Next round', results: 'Results', lobby: '' }[room.phase];
  const urgent = secs <= 10 && room.phase !== 'results';
  return (
    <div className="flex flex-col items-center">
      <div className={`rounded-2xl px-3 py-1 font-display text-2xl font-bold tabular-nums text-white shadow-lg sm:px-5 sm:py-1.5 sm:text-4xl ${urgent ? 'bg-rose-500 animate-pulse' : room.phase === 'hunt' ? 'bg-indigo-950/80' : 'bg-violet-600/90'}`}>
        {fmtTime(left)}
      </div>
      <div className="mt-1 whitespace-nowrap rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white sm:px-3 sm:text-xs">
        {label}{room.totalRounds > 1 ? ` · Round ${room.round}/${room.totalRounds}` : ''}
      </div>
    </div>
  );
}

function objectiveText(me: PublicPlayer | undefined, phase: string, mode: string): string {
  if (!me || me.team === 'none') return 'Spectating - you will join the next match';
  if (me.caught && me.team === 'hider' && mode !== 'everyone') return 'You were found! Spectating (Q to switch view)';
  if (mode === 'everyone') return phase === 'prep' ? 'Paint yourself and pick a spot - your disguise becomes a statue!' : 'Find the other statues! Poke them to score';
  if (me.team === 'hider') {
    if (phase === 'prep') return 'Paint yourself to match a hiding spot, then strike a pose!';
    return 'Stay still... your eyes close when you freeze. Survive!';
  }
  if (phase === 'prep') return 'You are blindfolded while the hiders paint themselves...';
  return 'Find the hiders! Click / tap suspicious spots to poke them';
}

function TeamBadge() {
  const me = useMe();
  const room = useStore((s) => s.room)!;
  const hiders = room.players.filter((p) => p.team === 'hider');
  const alive = hiders.filter((p) => !p.caught).length;
  const seekers = room.players.filter((p) => p.team === 'seeker').length;
  const team = me?.team ?? 'none';
  return (
    <div className="flex flex-col gap-1.5">
      <div className={`w-fit rounded-2xl px-2.5 py-1 font-display text-xs font-bold text-white shadow-lg sm:px-3 sm:py-1.5 sm:text-base ${team === 'hider' ? 'bg-emerald-500' : team === 'seeker' ? 'bg-rose-500' : 'bg-slate-500'}`}>
        {team === 'hider' ? '🦎 HIDER' : team === 'seeker' ? '🔎 SEEKER' : '👀 SPECTATOR'}
        {me?.side && <span className={`ml-2 rounded-full px-2 text-xs ${me.side === 'red' ? 'bg-red-700' : 'bg-blue-700'}`}>{me.side.toUpperCase()}</span>}
      </div>
      <div className="flex flex-wrap gap-1 text-[10px] font-bold text-white sm:gap-1.5 sm:text-xs">
        {room.settings.mode !== 'everyone' && <span className="rounded-full bg-emerald-600/80 px-2 py-0.5">🦎 {alive}/{hiders.length}</span>}
        {room.settings.mode !== 'everyone' && <span className="rounded-full bg-rose-600/80 px-2 py-0.5">🔎 {seekers}</span>}
        <span className="hidden rounded-full bg-black/40 px-2 py-0.5 sm:inline">{MODES[room.settings.mode].icon} {MODES[room.settings.mode].name}</span>
      </div>
      {room.teamScores && (
        <div className="flex gap-1.5 text-xs font-bold text-white">
          <span className="rounded-full bg-red-600 px-2 py-0.5">Red {room.teamScores.red}</span>
          <span className="rounded-full bg-blue-600 px-2 py-0.5">Blue {room.teamScores.blue}</span>
        </div>
      )}
      {me && me.team !== 'none' && <span className="w-fit rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-amber-950 sm:text-xs">⭐ {me.score} pts</span>}
    </div>
  );
}

function AbilityBar({ vertical }: { vertical?: boolean }) {
  const abilities = useStore((s) => s.abilities);
  const tagReadyAt = useStore((s) => s.tagReadyAt);
  const phase = useStore((s) => s.room?.phase);
  const me = useMe();
  const now = useNow(100);
  if (!abilities.length || (phase !== 'hunt' && phase !== 'prep')) return null;
  return (
    <div className={`pointer-events-auto flex ${vertical ? 'flex-col' : 'flex-row'} gap-2`}>
      {me?.team === 'seeker' && phase === 'hunt' && tagReadyAt > now && (
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-rose-600/90 text-center text-[10px] font-bold leading-tight text-white">STUNNED<br />{((tagReadyAt - now) / 1000).toFixed(1)}s</div>
      )}
      {abilities.map((a, i) => {
        const def = ABILITIES[a.id];
        const cd = Math.max(0, a.readyAt - now);
        const active = a.activeUntil > now;
        const prepOnly = phase === 'prep' && a.id !== 'quickdisguise';
        const disabled = (cd > 0 && !def.bonus) || prepOnly || (def.bonus && !a.charges);
        const pct = def.cooldownMs ? cd / def.cooldownMs : 0;
        return (
          <button
            key={a.id}
            title={`${def.name}: ${def.description}`}
            onClick={() => !disabled && activateAbility(a.id)}
            onPointerDown={(e) => e.stopPropagation()}
            className={`relative h-14 w-14 overflow-hidden rounded-2xl border-4 text-2xl shadow-lg transition ${active ? 'border-amber-300 bg-amber-400 animate-pulse' : def.bonus ? 'border-fuchsia-300 bg-fuchsia-500' : 'border-white/80 bg-violet-600'} ${disabled ? 'opacity-60' : 'hover:scale-105'}`}
          >
            <span className="relative z-10">{def.icon}</span>
            {cd > 0 && !def.bonus && (
              <>
                <div className="absolute inset-x-0 bottom-0 bg-black/55" style={{ height: `${pct * 100}%` }} />
                <span className="absolute inset-0 z-20 grid place-items-center font-display text-base font-bold text-white">{Math.ceil(cd / 1000)}</span>
              </>
            )}
            <span className="absolute left-1 top-0.5 z-20 text-[9px] font-bold text-white/90">{i + 1}</span>
          </button>
        );
      })}
    </div>
  );
}

function DirectionArrows() {
  const fx = useStore((s) => s.effects);
  const now = Date.now();
  const [, force] = useState(0);
  useEffect(() => { const id = setInterval(() => force((n) => n + 1), 60); return () => clearInterval(id); }, []);
  const camYaw = cam.yaw;
  const arrows: { a: number; color: string; label?: string }[] = [];
  if (fx.sound && fx.sound.until > now && fx.sound.angle !== null) arrows.push({ a: fx.sound.angle, color: '#38bdf8', label: fx.sound.dist === 'near' ? 'NEAR' : 'FAR' });
  if (fx.radar && fx.radar.until > now) fx.radar.angles.forEach((a) => arrows.push({ a, color: '#e879f9' }));
  if (!arrows.length) return null;
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2">
      {arrows.map((ar, i) => {
        // screen angle: world angle relative to the camera's forward direction (camera looks toward yaw+PI)
        const rel = ar.a - (camYaw + Math.PI);
        return (
          <div key={i} className="absolute left-1/2 top-1/2" style={{ transform: `rotate(${-rel}rad) translateY(-118px)` }}>
            <div className="-translate-x-1/2 text-center">
              <div style={{ color: ar.color }} className="text-4xl drop-shadow-[0_2px_2px_rgba(0,0,0,0.6)]">▲</div>
              {ar.label && <div className="text-[10px] font-bold text-white drop-shadow">{ar.label}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function QuickMenus() {
  const qm = useStore((s) => s.quickMenu);
  const set = useStore((s) => s.set);
  const owned = useStore((s) => s.profile?.owned ?? []);
  if (qm === 'none') return null;
  const emotes = COSMETICS.filter((c) => c.slot === 'emote' && (c.price === 0 || owned.includes(c.id)));
  return (
    <div className="pointer-events-auto absolute bottom-28 left-1/2 z-30 w-[min(92vw,420px)] -translate-x-1/2 animate-pop" onPointerDown={(e) => e.stopPropagation()}>
      <Panel className="p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-display font-bold">{qm === 'chat' ? '💬 Quick Chat' : qm === 'emote' ? '😄 Emotes' : '🤸 Pose'}</span>
          <button onClick={() => set({ quickMenu: 'none' })} className="rounded-full bg-indigo-100 px-2 text-sm font-bold">✕</button>
        </div>
        {qm === 'chat' && (
          <div className="grid grid-cols-2 gap-1.5">
            {QUICK_CHAT.map((m, i) => (
              <button key={i} onClick={() => { emit('chat', { msg: i }); set({ quickMenu: 'none' }); }} className="rounded-xl bg-indigo-50 px-2 py-1.5 text-left text-sm font-bold hover:bg-indigo-100">{m}</button>
            ))}
          </div>
        )}
        {qm === 'emote' && (
          <div className="grid grid-cols-3 gap-1.5">
            {emotes.map((e) => (
              <button key={e.id} onClick={() => { emit('emote', { id: e.id }); set({ quickMenu: 'none' }); }} className="rounded-xl bg-indigo-50 px-2 py-2 text-sm font-bold hover:bg-indigo-100">{e.name}</button>
            ))}
          </div>
        )}
        {qm === 'pose' && <PosePicker compact />}
      </Panel>
    </div>
  );
}

function PauseMenu() {
  const set = useStore((s) => s.set);
  const go = useStore((s) => s.go);
  const [settings, setSettings] = useState(false);
  return (
    <div className="pointer-events-auto absolute inset-0 z-40 grid place-items-center bg-indigo-950/60 p-4 backdrop-blur-sm" onPointerDown={(e) => e.stopPropagation()}>
      <Panel className="w-full max-w-sm p-5 animate-pop">
        <h2 className="mb-4 text-center font-display text-3xl font-bold">Paused</h2>
        {settings ? (
          <>
            <SettingsBody compact />
            <Btn tone="ghost" className="mt-3 w-full" onClick={() => setSettings(false)}>Back</Btn>
          </>
        ) : (
          <div className="flex flex-col gap-3">
            <Btn tone="mint" size="lg" onClick={() => set({ pauseOpen: false })}>Resume</Btn>
            <Btn tone="sky" onClick={() => setSettings(true)}>Settings</Btn>
            <div className="rounded-2xl bg-indigo-50 p-3 text-xs leading-relaxed">
              <b>Controls:</b> WASD move · Mouse look · Space jump · Shift sprint · E interact · P paint (prep) · 1-5 abilities · Click/F poke (seeker) · C pose · T chat · G emote · Q switch spectate · Esc pause
            </div>
            <Btn tone="danger" onClick={async () => { await request('room:leave'); set({ room: null, pauseOpen: false }); go('menu'); }}>Leave Match</Btn>
          </div>
        )}
      </Panel>
    </div>
  );
}

function AssignOverlay() {
  const me = useMe();
  const room = useStore((s) => s.room)!;
  const mode = MODES[room.settings.mode];
  const team = me?.team ?? 'none';
  return (
    <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-indigo-950/40">
      <div className="animate-pop text-center">
        <div className="mb-2 font-display text-lg font-bold uppercase tracking-widest text-white/90">{mode.icon} {mode.name} · {MAP_META[room.settings.mapId].name}</div>
        <div className={`rounded-[2rem] px-10 py-6 font-display text-5xl font-bold text-white shadow-2xl sm:text-7xl ${team === 'hider' ? 'bg-emerald-500' : team === 'seeker' ? 'bg-rose-500' : 'bg-slate-500'}`}>
          {room.settings.mode === 'everyone' ? 'EVERYONE HIDES!' : team === 'hider' ? 'YOU HIDE!' : team === 'seeker' ? 'YOU SEEK!' : 'SPECTATING'}
        </div>
        <p className="mx-auto mt-3 max-w-md text-lg font-bold text-white drop-shadow">{objectiveText(me, 'prep', room.settings.mode)}</p>
      </div>
    </div>
  );
}

function Blindfold() {
  const room = useStore((s) => s.room)!;
  const now = useNow(200);
  return (
    <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-[radial-gradient(circle,#1e1b4b_0%,#000_75%)]">
      <div className="text-center text-white">
        <div className="mb-3 text-7xl animate-wiggle">🙈</div>
        <div className="font-display text-3xl font-bold">You're blindfolded!</div>
        <div className="mt-1 text-lg opacity-80">Hiders are painting themselves... count with me!</div>
        <div className="mt-4 font-display text-6xl font-bold tabular-nums">{Math.max(0, Math.ceil((room.phaseEndsAt - now) / 1000))}</div>
      </div>
    </div>
  );
}

function Intermission() {
  const room = useStore((s) => s.room)!;
  return (
    <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-indigo-950/50">
      <Panel className="animate-pop p-6 text-center">
        <div className="font-display text-3xl font-bold">Round {room.round} complete!</div>
        {room.teamScores && (
          <div className="mt-3 flex justify-center gap-4 font-display text-2xl font-bold">
            <span className="rounded-2xl bg-red-500 px-4 py-2 text-white">Red {room.teamScores.red}</span>
            <span className="rounded-2xl bg-blue-500 px-4 py-2 text-white">Blue {room.teamScores.blue}</span>
          </div>
        )}
        <p className="mt-3 font-bold opacity-70">Teams swap roles next round...</p>
      </Panel>
    </div>
  );
}

function Results() {
  const room = useStore((s) => s.room)!;
  const myId = useStore((s) => s.myId);
  const go = useStore((s) => s.go);
  const set = useStore((s) => s.set);
  const res = room.results;
  const now = useNow(500);
  const [hidden, setHidden] = useState(false);
  if (!res) return null;
  const isHost = room.hostId === myId;
  const mine = res.players.find((p) => p.id === myId);
  const me = room.players.find((p) => p.id === myId);
  if (hidden) return <div className="pointer-events-auto absolute bottom-24 left-1/2 z-30 -translate-x-1/2"><Btn tone="sun" onClick={() => setHidden(false)}>Show results</Btn></div>;
  return (
    <div className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center overflow-y-auto bg-indigo-950/55 p-3 backdrop-blur-[2px]" onPointerDown={(e) => e.stopPropagation()}>
      <Panel className="w-full max-w-2xl animate-pop p-4 sm:p-6">
        <div className="text-center">
          <div className="text-5xl">{mine?.won ? '🏆' : '🎨'}</div>
          <h2 className="font-display text-3xl font-bold sm:text-4xl">{res.winnerLabel}</h2>
          <p className="text-sm font-bold opacity-60">{MODES[res.mode].name} · {MAP_META[res.mapId].name} · {fmtTime(res.durationMs)} · {res.totalFinds} found</p>
          {res.teamScores && <p className="mt-1 font-display text-xl font-bold"><span className="text-red-600">Red {res.teamScores.red}</span> vs <span className="text-blue-600">Blue {res.teamScores.blue}</span></p>}
        </div>
        {mine && (
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <span className="rounded-full bg-violet-600 px-3 py-1 font-display font-bold text-white">+{mine.xp} XP</span>
            <span className="rounded-full bg-amber-400 px-3 py-1 font-display font-bold text-amber-950">+{mine.coins} 🪙</span>
            {mine.levelUp && <span className="animate-bounce rounded-full bg-pink-500 px-3 py-1 font-display font-bold text-white">LEVEL UP!</span>}
            {mine.newAchievements?.map((a) => <span key={a} className="rounded-full bg-emerald-500 px-3 py-1 text-sm font-bold text-white">{ACHIEVEMENT_BY_ID[a]?.icon} {ACHIEVEMENT_BY_ID[a]?.name}</span>)}
          </div>
        )}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase opacity-60"><th className="py-1">Player</th><th>Team</th><th className="text-right">Found</th><th className="text-right">Hidden</th><th className="text-right">Score</th><th className="text-right">XP</th></tr>
            </thead>
            <tbody>
              {res.players.map((p) => (
                <tr key={p.id} className={`border-t border-indigo-100 ${p.id === myId ? 'bg-violet-50 font-bold' : ''}`}>
                  <td className="py-1.5">{p.won && '👑 '}{p.name}</td>
                  <td>{p.side ? <span className={p.side === 'red' ? 'text-red-600' : 'text-blue-600'}>{p.side}</span> : p.team === 'hider' ? '🦎' : '🔎'}{p.caught ? ' ✖' : ''}</td>
                  <td className="text-right">{p.finds}</td>
                  <td className="text-right">{p.team === 'hider' || res.mode === 'everyone' ? fmtTime(p.survivedMs) : '—'}</td>
                  <td className="text-right">{p.score}</td>
                  <td className="text-right">+{p.xp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {isHost ? (
            <Btn tone="mint" size="lg" onClick={async () => { const r = await request('room:start'); if (!r.ok) useStore.getState().toast(r.error ?? 'Could not start', 'bad'); }}>▶ Play Again</Btn>
          ) : (
            <Btn tone="mint" size="lg" onClick={() => emit('room:ready', { ready: !me?.ready })}>{me?.ready ? '✓ Ready for rematch' : '▶ Play Again'}</Btn>
          )}
          <Btn tone="sky" size="lg" onClick={async () => { if (isHost) await request('room:lobby'); else go('lobby'); }}>🏠 Return to Lobby</Btn>
          <Btn tone="ghost" onClick={() => setHidden(true)}>👀 View map</Btn>
          <Btn tone="ghost" onClick={async () => { await request('room:leave'); set({ room: null }); go('menu'); }}>Leave</Btn>
        </div>
        <p className="mt-2 text-center text-xs font-bold opacity-60">
          {isHost ? 'Start a rematch when players are ready.' : 'Waiting for the host...'} Returning to lobby in {Math.max(0, Math.ceil((room.phaseEndsAt - now) / 1000))}s
        </p>
      </Panel>
    </div>
  );
}

export function HUD({ def }: { def: MapDef | null }) {
  const room = useStore((s) => s.room);
  const me = useMe();
  const s = useStore();
  const touch = useTouchUI();
  if (!room) return null;
  const phase = room.phase;
  const spectating = isSpectating(me, room.settings.mode);
  const canPaint = me?.team === 'hider' && phase === 'prep';
  const seekerHunt = me?.team === 'seeker' && phase === 'hunt';
  const blind = me?.team === 'seeker' && (phase === 'prep') && room.settings.mode !== 'everyone';
  const canPose = me?.team === 'hider' && (phase === 'prep' || phase === 'hunt') && !me.caught;
  const hideHud = phase === 'results';

  return (
    <div className="pointer-events-none absolute inset-0 z-10 select-none font-body">
      {touch && !s.paintMode && !s.pauseOpen && phase !== 'results' && <LookArea tapToTag={seekerHunt} />}

      {!hideHud && (
        <>
          <div className="absolute left-2 top-2 max-w-[34vw] sm:left-3 sm:top-3 sm:max-w-none"><TeamBadge /></div>
          <div className="absolute left-1/2 top-2 -translate-x-1/2 sm:top-3"><PhaseTimer /></div>
          <div className="absolute right-2 top-2 flex flex-col items-end gap-2 sm:right-3 sm:top-3">
            <div className="flex gap-2">
              {s.settings.showFps && <span className="rounded-full bg-black/50 px-2 py-1 text-xs font-bold text-white">{s.fps} FPS</span>}
              <button aria-label="Pause" onClick={() => { exitLock(); s.set({ pauseOpen: true }); }} className="pointer-events-auto grid h-10 w-10 place-items-center rounded-full bg-white/80 text-lg font-bold shadow">⏸</button>
            </div>
            {def && !touch && <Minimap def={def} size={150} />}
            {def && touch && <Minimap def={def} size={96} />}
          </div>
          <div className="absolute left-1/2 top-[4.4rem] max-w-[38vw] -translate-x-1/2 rounded-2xl bg-black/45 px-3 py-1 text-center text-[10px] font-bold leading-tight text-white sm:top-[4.9rem] sm:max-w-[90vw] sm:rounded-full sm:px-4 sm:text-sm">
            {objectiveText(me, phase, room.settings.mode)}
          </div>
        </>
      )}

      {phase === 'assign' && <AssignOverlay />}
      {blind && <Blindfold />}
      {phase === 'intermission' && <Intermission />}
      {phase === 'results' && <Results />}

      {/* crosshair */}
      {seekerHunt && !s.paintMode && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className={`h-7 w-7 rounded-full border-[3px] transition ${s.aimTarget ? 'scale-110 border-amber-300 bg-amber-300/30' : 'border-white/90'}`} />
          <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
        </div>
      )}
      <DirectionArrows />

      {/* interaction prompt */}
      {s.nearInteract && !s.paintMode && (
        <div className="absolute bottom-40 left-1/2 -translate-x-1/2 sm:bottom-28">
          <button onPointerDown={(e) => { e.stopPropagation(); input.interact = true; }} className="pointer-events-auto rounded-2xl bg-white/90 px-4 py-2 font-display font-bold shadow-lg">
            <span className="mr-2 rounded-lg bg-indigo-950 px-2 py-0.5 text-white">{touch ? 'Tap' : 'E'}</span>{s.nearInteract.label}
          </button>
        </div>
      )}

      {/* hider paint prompt */}
      {canPaint && !s.paintMode && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 sm:bottom-6">
          <Btn tone="pink" size="lg" className="pointer-events-auto ring-4 ring-pink-200/70" onPointerDown={(e) => e.stopPropagation()} onClick={() => { exitLock(); s.set({ paintMode: true }); }}>
            🎨 Paint yourself {!touch && <span className="ml-1 rounded bg-white/30 px-1.5 text-sm">P</span>}
          </Btn>
        </div>
      )}
      {s.paintMode && canPaint && <PaintPanel />}

      {/* abilities */}
      {!hideHud && !spectating && (
        <div className={`absolute ${touch ? 'right-3 top-1/2 -translate-y-1/2' : 'bottom-5 right-5'}`}>
          <AbilityBar vertical={touch} />
        </div>
      )}

      {/* social buttons */}
      {!hideHud && (
        <div className={`pointer-events-auto absolute flex gap-2 ${touch ? 'left-3 top-36 flex-col' : 'bottom-5 left-5'}`} onPointerDown={(e) => e.stopPropagation()}>
          <button onClick={() => s.set({ quickMenu: s.quickMenu === 'chat' ? 'none' : 'chat' })} className="grid h-11 w-11 place-items-center rounded-full bg-white/85 text-xl shadow" aria-label="Quick chat">💬</button>
          <button onClick={() => s.set({ quickMenu: s.quickMenu === 'emote' ? 'none' : 'emote' })} className="grid h-11 w-11 place-items-center rounded-full bg-white/85 text-xl shadow" aria-label="Emotes">😄</button>
          {canPose && <button onClick={() => s.set({ quickMenu: s.quickMenu === 'pose' ? 'none' : 'pose' })} className="grid h-11 w-11 place-items-center rounded-full bg-white/85 text-xl shadow" aria-label="Pose">🤸</button>}
          {spectating && <button onClick={() => s.set({ spectateIdx: s.spectateIdx + 1 })} className="h-11 rounded-full bg-white/85 px-3 text-sm font-bold shadow">Next view ▶</button>}
        </div>
      )}
      <QuickMenus />

      {/* touch controls */}
      {touch && !s.paintMode && !hideHud && !spectating && (
        <>
          <div className="pointer-events-none absolute bottom-6 left-6 safe-b"><Joystick /></div>
          <div className="pointer-events-none absolute bottom-6 right-24 flex items-end gap-4 safe-b">
            {seekerHunt && <RoundBtn size="lg" label="Poke" active onDown={() => { input.tag = true; }}>👆</RoundBtn>}
            <RoundBtn label="Sprint" active={s.settings && input.sprintHeld} onDown={() => { input.sprintHeld = true; }} onUp={() => { input.sprintHeld = false; }}>⚡</RoundBtn>
            <RoundBtn label="Jump" onDown={() => { input.jump = true; }}>⤒</RoundBtn>
          </div>
        </>
      )}

      {!s.connected && (
        <div className="pointer-events-auto absolute inset-0 z-50 grid place-items-center bg-black/60">
          <div className="text-center font-display text-2xl font-bold text-white"><div className="mb-3 animate-spin text-5xl">🔄</div>Connection lost - reconnecting...</div>
        </div>
      )}
      {s.pauseOpen && <PauseMenu />}
    </div>
  );
}

export { COSMETIC_BY_ID };
