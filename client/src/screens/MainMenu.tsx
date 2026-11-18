import { useState } from 'react';
import { useStore } from '../store/useStore';
import { request } from '../multiplayer/net';
import { Btn, Coins, LevelBar, Modal, Panel } from '../ui/kit';
import { CharacterPreview } from '../characters/CharacterPreview';
import { sfx } from '../audio/sound';

export function Logo({ small }: { small?: boolean }) {
  const letters = 'HUE & SEEK'.split('');
  const colors = ['#f472b6', '#facc15', '#34d399', '#ffffff', '#ffffff', '#ffffff', '#60a5fa', '#c084fc', '#fb923c', '#22d3ee'];
  return (
    <h1 className={`select-none text-center font-display font-bold leading-none tracking-tight ${small ? 'text-4xl' : 'text-6xl sm:text-8xl'}`}>
      {letters.map((l, i) => (
        <span key={i} className="inline-block text-outline drop-shadow-[0_6px_0_rgba(30,27,75,0.45)]" style={{ color: colors[i], animation: `floaty ${3 + (i % 3) * 0.4}s ease-in-out ${i * 0.12}s infinite` }}>
          {l === ' ' ? ' ' : l}
        </span>
      ))}
    </h1>
  );
}

export function JoinRoomModal({ onClose }: { onClose: () => void }) {
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const go = useStore((s) => s.go);
  const join = async () => {
    setBusy(true);
    setErr('');
    const r = await request('room:join', { code: code.trim().toUpperCase() });
    setBusy(false);
    if (!r.ok) { setErr(r.error ?? 'Could not join'); sfx('error'); return; }
    onClose();
    go('lobby');
  };
  return (
    <Modal title="Join a room" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); void join(); }} className="flex flex-col gap-3">
        <input autoFocus value={code} maxLength={6} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} placeholder="ABC123"
          className="rounded-2xl border-4 border-indigo-200 px-4 py-3 text-center font-display text-4xl font-bold tracking-[0.3em] outline-none focus:border-violet-500" />
        {err && <p className="rounded-xl bg-rose-100 px-3 py-2 text-sm font-bold text-rose-700">{err}</p>}
        <Btn tone="mint" size="lg" type="submit" disabled={code.length !== 6 || busy}>Join</Btn>
      </form>
    </Modal>
  );
}

export function MainMenu() {
  const profile = useStore((s) => s.profile);
  const connected = useStore((s) => s.connected);
  const mmStatus = useStore((s) => s.mmStatus);
  const go = useStore((s) => s.go);
  const set = useStore((s) => s.set);
  const toast = useStore((s) => s.toast);
  const [joinOpen, setJoinOpen] = useState(false);
  const [playOpen, setPlayOpen] = useState(false);

  const findMatch = async () => {
    setPlayOpen(false);
    set({ mmStatus: 'Searching for a public match...' });
    await new Promise((r) => setTimeout(r, 600));
    const r = await request('mm:find');
    if (!r.ok) { set({ mmStatus: null }); toast(r.error ?? 'Matchmaking failed', 'bad'); return; }
    set({ mmStatus: r.created ? 'No open rooms found - created a new public room!' : 'Match found! Joining...' });
    setTimeout(() => { set({ mmStatus: null }); go('lobby'); }, 700);
  };
  const createRoom = async () => {
    setPlayOpen(false);
    const r = await request('room:create', { isPublic: false });
    if (!r.ok) return toast(r.error ?? 'Could not create room', 'bad');
    go('lobby');
  };

  if (!profile) return null;
  return (
    <div className="relative z-10 mx-auto flex min-h-full max-w-6xl flex-col gap-4 p-3 sm:p-6 lg:flex-row lg:items-center">
      <div className="flex flex-1 flex-col items-center gap-4">
        <Logo />
        <p className="font-display text-lg font-semibold text-white/90 drop-shadow">Paint yourself. Blend in. Don't get poked.</p>
        <div className="grid w-full max-w-md grid-cols-2 gap-3">
          <Btn tone="pink" size="xl" className="col-span-2" disabled={!connected} onClick={() => setPlayOpen(true)}>▶ Play Online</Btn>
          <Btn tone="sun" size="lg" disabled={!connected} onClick={createRoom}>➕ Create Room</Btn>
          <Btn tone="sky" size="lg" disabled={!connected} onClick={() => setJoinOpen(true)}>🔑 Join Room</Btn>
          <Btn tone="mint" disabled={!connected} onClick={findMatch}>🌍 Public Match</Btn>
          <Btn tone="grape" onClick={() => go('customize')}>👕 Customize</Btn>
          <Btn tone="ghost" onClick={() => go('shop')}>🛍️ Shop</Btn>
          <Btn tone="ghost" onClick={() => go('leaderboard')}>🏆 Leaderboard</Btn>
          <Btn tone="ghost" onClick={() => go('friends')}>👫 Friends</Btn>
          <Btn tone="ghost" onClick={() => go('settings')}>⚙️ Settings</Btn>
        </div>
        {!connected && <p className="rounded-full bg-black/40 px-4 py-1 text-sm font-bold text-white">Connecting to the game server...</p>}
      </div>

      <div className="flex w-full flex-col gap-3 lg:w-[380px]">
        <Panel className="p-4">
          <div className="flex items-center gap-3">
            <CharacterPreview cosmetics={profile.cosmetics} zoom={2.3} className="h-32 w-28 shrink-0" />
            <div className="min-w-0 flex-1">
              <button onClick={() => go('profile')} className="block max-w-full truncate text-left font-display text-2xl font-bold hover:underline">
                {profile.name}<span className="text-base opacity-50">#{profile.tag}</span>
              </button>
              <div className="my-2"><LevelBar level={profile.level} into={profile.levelXp} needed={profile.levelXpNeeded} /></div>
              <div className="flex items-center gap-2"><Coins n={profile.coins} /><span className="text-xs font-bold opacity-60">{profile.stats.wins} wins · {profile.stats.finds} finds</span></div>
            </div>
          </div>
        </Panel>
        <Panel className="p-4">
          <h3 className="mb-2 font-display text-lg font-bold">📅 Daily Missions</h3>
          <div className="flex flex-col gap-2">
            {profile.missions.map((m) => (
              <div key={m.id} className={`rounded-2xl p-2.5 ${m.completed ? 'bg-emerald-100' : 'bg-indigo-50'}`}>
                <div className="flex items-center justify-between text-sm font-bold">
                  <span>{m.completed ? '✅ ' : ''}{m.title}</span>
                  <span className="text-xs opacity-70">+{m.rewardXp} XP · {m.rewardCoins}🪙</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-indigo-950/10">
                  <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500" style={{ width: `${(m.progress / m.goal) * 100}%` }} />
                </div>
                <div className="mt-0.5 text-right text-[11px] font-bold opacity-60">{m.progress}/{m.goal}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {joinOpen && <JoinRoomModal onClose={() => setJoinOpen(false)} />}
      {playOpen && (
        <Modal title="Play Online" onClose={() => setPlayOpen(false)}>
          <div className="flex flex-col gap-3">
            <Btn tone="mint" size="lg" onClick={findMatch}>🌍 Find a public match</Btn>
            <Btn tone="sun" size="lg" onClick={createRoom}>➕ Create a private room</Btn>
            <Btn tone="sky" size="lg" onClick={() => { setPlayOpen(false); setJoinOpen(true); }}>🔑 Join with a code</Btn>
          </div>
        </Modal>
      )}
      {mmStatus && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-indigo-950/70 backdrop-blur">
          <Panel className="flex flex-col items-center gap-3 p-6 animate-pop">
            <div className="relative grid h-20 w-20 place-items-center">
              <span className="absolute inset-0 animate-pulseRing rounded-full bg-violet-400" />
              <span className="text-5xl">🔎</span>
            </div>
            <p className="font-display text-xl font-bold">{mmStatus}</p>
          </Panel>
        </div>
      )}
    </div>
  );
}
