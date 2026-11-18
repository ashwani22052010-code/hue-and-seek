import { useEffect, useState } from 'react';
import type { FriendEntry, MapId, ModeId } from '@shared/types';
import { HUNT_TIME_OPTIONS, MAP_IDS, MAP_META, MIN_PLAYERS, MODES, MODE_IDS, PREP_TIME_OPTIONS, QUICK_CHAT } from '@shared/constants';
import { useStore } from '../store/useStore';
import { emit, request, serverClock } from '../multiplayer/net';
import { api } from '../multiplayer/api';
import { Btn, Modal, Panel } from '../ui/kit';
import { LobbyLineup } from '../characters/CharacterPreview';
import { playMusic, sfx } from '../audio/sound';
import { VoiceBar } from '../ui/Voice';

function InviteFriends({ onClose }: { onClose: () => void }) {
  const [friends, setFriends] = useState<FriendEntry[] | null>(null);
  const toast = useStore((s) => s.toast);
  useEffect(() => { api<{ friends: FriendEntry[] }>('/friends').then((r) => setFriends(r.friends)).catch(() => setFriends([])); }, []);
  return (
    <Modal title="Invite friends" onClose={onClose}>
      {!friends ? <p>Loading...</p> : friends.length === 0 ? <p className="opacity-70">No friends yet - add some from the Friends screen!</p> : (
        <div className="flex flex-col gap-2">
          {friends.map((f) => (
            <div key={f.id} className="flex items-center gap-2 rounded-2xl bg-indigo-50 p-2">
              <span className={`h-3 w-3 rounded-full ${f.online ? 'bg-emerald-500' : 'bg-slate-400'}`} />
              <span className="flex-1 font-bold">{f.name}<span className="opacity-50">#{f.tag}</span></span>
              <Btn size="sm" tone="mint" disabled={!f.online} onClick={async () => {
                const r = await request('friend:invite', { friendId: f.id });
                toast(r.ok ? `Invite sent to ${f.name}!` : r.error ?? 'Failed', r.ok ? 'good' : 'bad');
              }}>{f.online ? 'Invite' : 'Offline'}</Btn>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

export function Lobby() {
  const room = useStore((s) => s.room);
  const myId = useStore((s) => s.myId);
  const go = useStore((s) => s.go);
  const set = useStore((s) => s.set);
  const toast = useStore((s) => s.toast);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [now, setNow] = useState(serverClock());
  const bubbles = useStore((s) => s.bubbles);

  useEffect(() => { playMusic('lobby'); }, []);
  useEffect(() => { const id = setInterval(() => setNow(serverClock()), 250); return () => clearInterval(id); }, []);
  useEffect(() => { if (!room) go('menu'); }, [room, go]);
  if (!room) return null;

  const me = room.players.find((p) => p.id === myId);
  const isHost = room.hostId === myId;
  const inMatch = room.phase !== 'lobby';
  const settings = room.settings;
  const change = async (patch: Record<string, unknown>) => {
    const r = await request('room:settings', patch);
    if (!r.ok) toast(r.error ?? 'Failed', 'bad');
  };
  const start = async () => {
    const r = await request('room:start');
    if (!r.ok) { toast(r.error ?? 'Cannot start', 'bad'); sfx('error'); }
  };
  const leave = async () => {
    await request('room:leave');
    set({ room: null });
    go('menu');
  };
  const copy = async (text: string, label: string) => {
    try { await navigator.clipboard.writeText(text); toast(`${label} copied!`, 'good'); } catch { toast(text, 'info'); }
  };
  const connected = room.players.filter((p) => p.connected);
  const allReady = connected.every((p) => p.ready || p.id === room.hostId);
  const canStart = connected.length >= MIN_PLAYERS && allReady;

  return (
    <div className="relative z-10 mx-auto flex h-full w-full max-w-6xl flex-col gap-3 overflow-y-auto p-3 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Btn tone="ghost" size="sm" onClick={leave}>← Leave</Btn>
        <div className="flex items-center gap-2 rounded-2xl bg-white/90 px-3 py-1.5 shadow">
          <span className="text-xs font-bold uppercase opacity-60">{room.isPublic ? 'Public room' : 'Room code'}</span>
          <span className="font-display text-2xl font-bold tracking-[0.2em]" data-testid="room-code">{room.code}</span>
          <button onClick={() => copy(room.code, 'Room code')} className="rounded-lg bg-indigo-100 px-2 py-1 text-xs font-bold">Copy</button>
          <button onClick={() => copy(`${location.origin}/?join=${room.code}`, 'Invite link')} className="rounded-lg bg-indigo-100 px-2 py-1 text-xs font-bold">Link</button>
        </div>
        <Btn tone="sky" size="sm" onClick={() => setInviteOpen(true)}>👫 Invite friends</Btn>
        <VoiceBar />
        {inMatch && <Btn tone="pink" size="sm" onClick={() => go('game')}>Match in progress - watch ▶</Btn>}
      </div>

      <div className="grid gap-3 lg:min-h-0 lg:flex-1 lg:grid-cols-[1.3fr_1fr]">
        <div className="flex flex-col gap-3 lg:min-h-0">
          <Panel className="relative h-56 overflow-hidden bg-gradient-to-b from-violet-200/90 to-pink-100/90 sm:h-72">
            <LobbyLineup players={room.players.map((p) => ({ id: p.id, name: p.name, cosmetics: p.cosmetics, ready: p.ready || p.id === room.hostId, host: p.id === room.hostId }))} />
            {Object.entries(bubbles).filter(([, b]) => b.until > Date.now()).slice(-3).map(([pid, b]) => (
              <div key={pid} className="absolute left-3 top-3 animate-pop rounded-2xl bg-white px-3 py-1 text-sm font-bold shadow" style={{ top: 12 + room.players.findIndex((p) => p.id === pid) * 4 }}>
                {room.players.find((p) => p.id === pid)?.name}: {b.text}
              </div>
            ))}
          </Panel>
          <Panel className="p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-display text-lg font-bold">Players {room.players.length}/{settings.maxPlayers}</h3>
              <button onClick={() => setChatOpen(!chatOpen)} className="rounded-full bg-indigo-100 px-3 py-1 text-sm font-bold">💬 Quick chat</button>
            </div>
            {chatOpen && (
              <div className="mb-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {QUICK_CHAT.map((m, i) => <button key={i} onClick={() => { emit('chat', { msg: i }); setChatOpen(false); }} className="rounded-xl bg-indigo-50 px-2 py-1 text-left text-sm font-bold hover:bg-indigo-100">{m}</button>)}
              </div>
            )}
            <div className="flex flex-col gap-1.5" data-testid="player-list">
              {room.players.map((p) => (
                <div key={p.id} className={`flex items-center gap-2 rounded-2xl px-3 py-2 ${p.id === myId ? 'bg-violet-100' : 'bg-indigo-50'}`}>
                  <span className={`h-3 w-3 shrink-0 rounded-full ${p.connected ? 'bg-emerald-500' : 'bg-amber-400 animate-pulse'}`} title={p.connected ? 'Online' : 'Reconnecting'} />
                  <span className="truncate font-bold">{p.id === room.hostId && '👑 '}{p.name}<span className="text-xs opacity-50">#{p.tag}</span></span>
                  <span className="rounded-full bg-violet-600 px-2 text-xs font-bold text-white">Lv {p.level}</span>
                  {!p.connected && <span className="text-xs font-bold text-amber-600">reconnecting...</span>}
                  <span className="ml-auto text-sm font-bold">{p.id === room.hostId && !room.isPublic ? 'Host' : p.ready ? '✅ Ready' : '⏳'}</span>
                  {isHost && p.id !== myId && (
                    <>
                      <button title="Make host" onClick={async () => { const r = await request('room:transfer', { playerId: p.id }); if (!r.ok) toast(r.error!, 'bad'); }} className="rounded-lg bg-amber-100 px-2 py-0.5 text-xs font-bold">👑</button>
                      <button title="Kick" onClick={async () => { const r = await request('room:kick', { playerId: p.id }); if (!r.ok) toast(r.error!, 'bad'); }} className="rounded-lg bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700">Kick</button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <div className="flex flex-col gap-3">
          <Panel className="p-3">
            <h3 className="mb-2 font-display text-lg font-bold">Map {!isHost && <span className="text-xs opacity-50">(host picks)</span>}</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {MAP_IDS.map((id: MapId) => (
                <button key={id} disabled={!isHost || inMatch} onClick={() => change({ mapId: id })}
                  className={`rounded-2xl p-2 text-left text-white transition ${settings.mapId === id ? 'ring-4 ring-violet-500 scale-[1.02]' : 'opacity-80 hover:opacity-100'}`}
                  style={{ background: `linear-gradient(135deg, ${MAP_META[id].colors[0]}, ${MAP_META[id].colors[1]})` }}>
                  <div className="text-2xl">{MAP_META[id].icon}</div>
                  <div className="font-display text-sm font-bold leading-tight drop-shadow">{MAP_META[id].name}</div>
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs opacity-70">{MAP_META[settings.mapId].description}</p>
          </Panel>
          <Panel className="p-3">
            <h3 className="mb-2 font-display text-lg font-bold">Mode</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {MODE_IDS.map((id: ModeId) => (
                <button key={id} disabled={!isHost || inMatch} onClick={() => change({ mode: id })}
                  className={`rounded-2xl p-2 text-left transition ${settings.mode === id ? 'text-white ring-4 ring-violet-500' : 'bg-indigo-50 hover:bg-indigo-100'}`}
                  style={settings.mode === id ? { background: MODES[id].color } : undefined}>
                  <div className="text-xl">{MODES[id].icon}</div>
                  <div className="font-display text-sm font-bold">{MODES[id].name}</div>
                  <div className="text-[10px] font-bold opacity-80">{MODES[id].tagline}</div>
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs opacity-70">{MODES[settings.mode].description}</p>
            <div className="mt-2 grid grid-cols-2 gap-2 text-sm font-bold">
              <label className="flex flex-col">Prep time
                <select disabled={!isHost || inMatch || settings.mode === 'everyone'} value={settings.prepTime} onChange={(e) => change({ prepTime: +e.target.value })} className="rounded-xl border-2 border-indigo-200 px-2 py-1">
                  {PREP_TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}s</option>)}
                </select>
              </label>
              <label className="flex flex-col">Hunt time
                <select disabled={!isHost || inMatch} value={settings.huntTime} onChange={(e) => change({ huntTime: +e.target.value })} className="rounded-xl border-2 border-indigo-200 px-2 py-1">
                  {HUNT_TIME_OPTIONS.map((t) => <option key={t} value={t}>{Math.floor(t / 60)}:{String(t % 60).padStart(2, '0')}</option>)}
                </select>
              </label>
            </div>
          </Panel>
          <div className="flex flex-col gap-2">
            {room.autoStartAt && <div className="rounded-2xl bg-emerald-500 px-4 py-2 text-center font-display text-lg font-bold text-white">Starting in {Math.max(0, Math.ceil((room.autoStartAt - now) / 1000))}...</div>}
            {(!isHost || room.isPublic) && !inMatch && (
              <Btn tone={me?.ready ? 'ghost' : 'mint'} size="xl" onClick={() => emit('room:ready', { ready: !me?.ready })} data-testid="ready-btn">
                {me?.ready ? '✓ Ready! (tap to cancel)' : "I'm Ready"}
              </Btn>
            )}
            {isHost && !inMatch && (
              <Btn tone="pink" size="xl" disabled={!canStart} onClick={start} data-testid="start-btn">
                ▶ Start Match
              </Btn>
            )}
            {isHost && !canStart && !inMatch && (
              <p className="text-center text-sm font-bold text-white drop-shadow">
                {connected.length < MIN_PLAYERS ? `Waiting for at least ${MIN_PLAYERS} players - share the code!` : 'Waiting for everyone to be ready...'}
              </p>
            )}
          </div>
        </div>
      </div>
      {inviteOpen && <InviteFriends onClose={() => setInviteOpen(false)} />}
    </div>
  );
}
