import { useEffect, useState } from 'react';
import type { FriendEntry, LeaderboardEntry, Profile, PublicProfile } from '@shared/types';
import { ACHIEVEMENTS } from '@shared/game-rules/progression';
import { useStore } from '../store/useStore';
import { api, saveToken } from '../multiplayer/api';
import { request, disconnect } from '../multiplayer/net';
import { Btn, LevelBar, Modal, Panel, ScreenShell, Coins, fmtTime } from '../ui/kit';
import { CharacterPreview } from '../characters/CharacterPreview';
import { validateName } from '@shared/game-rules/rules';

export function Leaderboard() {
  const go = useStore((s) => s.go);
  const myId = useStore((s) => s.myId);
  const set = useStore((s) => s.set);
  const [scope, setScope] = useState<'global' | 'friends'>('global');
  const [rows, setRows] = useState<LeaderboardEntry[] | null>(null);
  useEffect(() => {
    setRows(null);
    api<{ entries: LeaderboardEntry[] }>(`/leaderboard?scope=${scope}`).then((r) => setRows(r.entries)).catch(() => setRows([]));
  }, [scope]);
  return (
    <ScreenShell title="Leaderboard" onBack={() => go('menu')}>
      <Panel className="p-3">
        <div className="mb-3 flex gap-2">
          {(['global', 'friends'] as const).map((s) => <Btn key={s} size="sm" tone={scope === s ? 'grape' : 'ghost'} onClick={() => setScope(s)}>{s === 'global' ? '🌍 Global' : '👫 Friends'}</Btn>)}
        </div>
        {!rows ? <p>Loading...</p> : rows.length === 0 ? <p className="opacity-70">No ranked players yet - play a match to get on the board!</p> : (
          <table className="w-full text-left text-sm">
            <thead><tr className="text-xs uppercase opacity-60"><th>#</th><th>Player</th><th className="text-right">Level</th><th className="text-right">XP</th><th className="hidden text-right sm:table-cell">Wins</th><th className="hidden text-right sm:table-cell">Finds</th><th className="hidden text-right sm:table-cell">Escapes</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} onClick={() => set({ viewProfileId: r.id })} className={`cursor-pointer border-t border-indigo-100 hover:bg-indigo-50 ${r.id === myId ? 'bg-violet-100 font-bold' : ''}`}>
                  <td className="py-2 font-display text-lg">{r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : r.rank}</td>
                  <td className="font-bold">{r.name}<span className="text-xs opacity-50">#{r.tag}</span></td>
                  <td className="text-right">{r.level}</td><td className="text-right">{r.xp}</td>
                  <td className="hidden text-right sm:table-cell">{r.wins}</td><td className="hidden text-right sm:table-cell">{r.finds}</td><td className="hidden text-right sm:table-cell">{r.escapes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </ScreenShell>
  );
}

interface FriendsData { friends: FriendEntry[]; incoming: FriendEntry[]; outgoing: FriendEntry[]; recent: { id: string; name: string; tag: string; level: number; lastPlayed: string }[] }

export function Friends() {
  const go = useStore((s) => s.go);
  const set = useStore((s) => s.set);
  const toast = useStore((s) => s.toast);
  const version = useStore((s) => s.friendsVersion);
  const inRoom = useStore((s) => !!s.room);
  const profile = useStore((s) => s.profile);
  const [data, setData] = useState<FriendsData | null>(null);
  const [tag, setTag] = useState('');
  const load = () => api<FriendsData>('/friends').then(setData).catch(() => {});
  useEffect(() => { void load(); }, [version]);
  const add = async (body: Record<string, string>) => {
    try {
      const r = await api<{ status: string }>('/friends/request', { method: 'POST', body });
      toast(r.status === 'accepted' ? 'You are now friends!' : 'Friend request sent!', 'good');
      setTag('');
      void load();
    } catch (e) { toast((e as Error).message, 'bad'); }
  };
  const respond = async (id: string, accept: boolean) => { await api('/friends/respond', { method: 'POST', body: { id, accept } }); void load(); };
  const remove = async (id: string) => { await api(`/friends/${id}`, { method: 'DELETE' }); void load(); };
  const Row = ({ f, children }: { f: { id: string; name: string; tag: string; level: number; online?: boolean }; children?: React.ReactNode }) => (
    <div className="flex items-center gap-2 rounded-2xl bg-indigo-50 p-2">
      {f.online !== undefined && <span className={`h-3 w-3 rounded-full ${f.online ? 'bg-emerald-500' : 'bg-slate-400'}`} title={f.online ? 'Online' : 'Offline'} />}
      <button onClick={() => set({ viewProfileId: f.id })} className="flex-1 truncate text-left font-bold hover:underline">{f.name}<span className="text-xs opacity-50">#{f.tag}</span> <span className="text-xs opacity-60">Lv {f.level}</span></button>
      {children}
    </div>
  );
  return (
    <ScreenShell title="Friends" onBack={() => go('menu')}>
      <div className="grid gap-3 lg:grid-cols-2">
        <Panel className="p-3">
          <p className="mb-2 text-sm font-bold">Your friend tag: <span className="rounded-lg bg-violet-100 px-2 py-0.5 font-display text-lg">{profile?.name}#{profile?.tag}</span></p>
          <form onSubmit={(e) => { e.preventDefault(); void add({ nameTag: tag }); }} className="flex gap-2">
            <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Name#1234" className="min-w-0 flex-1 rounded-2xl border-4 border-indigo-200 px-3 py-2 font-bold outline-none focus:border-violet-500" />
            <Btn tone="mint" type="submit" disabled={!tag.includes('#')}>Add</Btn>
          </form>
          {data && data.incoming.length > 0 && (
            <>
              <h3 className="mb-1 mt-3 font-display font-bold">Requests</h3>
              <div className="flex flex-col gap-1.5">{data.incoming.map((f) => <Row key={f.id} f={f}><Btn size="sm" tone="mint" onClick={() => respond(f.id, true)}>Accept</Btn><Btn size="sm" tone="ghost" onClick={() => respond(f.id, false)}>✕</Btn></Row>)}</div>
            </>
          )}
          <h3 className="mb-1 mt-3 font-display font-bold">Friends</h3>
          {!data ? <p>Loading...</p> : data.friends.length === 0 ? <p className="text-sm opacity-60">No friends yet. Share your tag!</p> : (
            <div className="flex flex-col gap-1.5">
              {data.friends.map((f) => (
                <Row key={f.id} f={f}>
                  {f.online && inRoom && <Btn size="sm" tone="sky" onClick={async () => { const r = await request('friend:invite', { friendId: f.id }); toast(r.ok ? 'Invite sent!' : r.error ?? 'Failed', r.ok ? 'good' : 'bad'); }}>Invite</Btn>}
                  {f.inRoom && <span className="text-xs font-bold text-violet-600">in a room</span>}
                  <button onClick={() => remove(f.id)} className="text-xs font-bold text-rose-500">Remove</button>
                </Row>
              ))}
            </div>
          )}
          {data && data.outgoing.length > 0 && <p className="mt-2 text-xs opacity-60">Pending: {data.outgoing.map((f) => f.name).join(', ')}</p>}
        </Panel>
        <Panel className="p-3">
          <h3 className="mb-2 font-display font-bold">Recently played with</h3>
          {!data ? <p>Loading...</p> : data.recent.length === 0 ? <p className="text-sm opacity-60">Play a match to see players here.</p> : (
            <div className="flex flex-col gap-1.5">
              {data.recent.map((r) => <Row key={r.id} f={r}>{!data.friends.some((f) => f.id === r.id) && <Btn size="sm" tone="mint" onClick={() => add({ id: r.id })}>+ Add</Btn>}</Row>)}
            </div>
          )}
        </Panel>
      </div>
    </ScreenShell>
  );
}

export function PublicProfileModal() {
  const id = useStore((s) => s.viewProfileId);
  const set = useStore((s) => s.set);
  const toast = useStore((s) => s.toast);
  const myId = useStore((s) => s.myId);
  const [data, setData] = useState<{ profile: PublicProfile; isFriend: boolean } | null>(null);
  useEffect(() => { setData(null); if (id) api<{ profile: PublicProfile; isFriend: boolean }>(`/players/${id}`).then(setData).catch(() => set({ viewProfileId: null })); }, [id, set]);
  if (!id) return null;
  return (
    <Modal onClose={() => set({ viewProfileId: null })} wide>
      {!data ? <p>Loading...</p> : (
        <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
          <CharacterPreview cosmetics={data.profile.cosmetics} className="h-48 w-full" />
          <div>
            <h2 className="font-display text-3xl font-bold">{data.profile.name}<span className="text-lg opacity-50">#{data.profile.tag}</span></h2>
            <p className="text-sm font-bold">{data.profile.online ? '🟢 Online' : '⚪ Offline'} · Level {data.profile.level}</p>
            <StatsGrid stats={data.profile.stats} />
            <Achievements unlocked={data.profile.achievements.map((a) => a.id)} />
            {!data.isFriend && id !== myId && <Btn className="mt-3" tone="mint" size="sm" onClick={async () => { try { await api('/friends/request', { method: 'POST', body: { id } }); toast('Friend request sent!', 'good'); } catch (e) { toast((e as Error).message, 'bad'); } }}>+ Add friend</Btn>}
          </div>
        </div>
      )}
    </Modal>
  );
}

function StatsGrid({ stats }: { stats: PublicProfile['stats'] }) {
  const items = [['Matches', stats.matchesPlayed], ['Wins', stats.wins], ['Finds', stats.finds], ['Escapes', stats.escapes], ['Times caught', stats.timesCaught], ['Decoys fooled', stats.decoysFooled], ['Rounds hiding', stats.roundsHider], ['Rounds seeking', stats.roundsSeeker], ['Best hide', fmtTime(stats.bestSurvivalMs)]] as const;
  return (
    <div className="mt-2 grid grid-cols-3 gap-1.5">
      {items.map(([k, v]) => <div key={k} className="rounded-xl bg-indigo-50 p-2 text-center"><div className="font-display text-lg font-bold">{v}</div><div className="text-[10px] font-bold uppercase opacity-60">{k}</div></div>)}
    </div>
  );
}

function Achievements({ unlocked }: { unlocked: string[] }) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-5">
      {ACHIEVEMENTS.map((a) => {
        const has = unlocked.includes(a.id);
        return (
          <div key={a.id} title={a.description} className={`rounded-xl p-2 text-center ${has ? 'bg-amber-100' : 'bg-slate-100 opacity-50 grayscale'}`}>
            <div className="text-2xl">{a.icon}</div>
            <div className="text-[11px] font-bold leading-tight">{a.name}</div>
          </div>
        );
      })}
    </div>
  );
}

export function ProfileScreen() {
  const profile = useStore((s) => s.profile);
  const go = useStore((s) => s.go);
  const set = useStore((s) => s.set);
  const toast = useStore((s) => s.toast);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState(profile?.name ?? '');
  const [history, setHistory] = useState<Record<string, unknown>[]>([]);
  useEffect(() => { api<{ matches: Record<string, unknown>[] }>('/me/history').then((r) => setHistory(r.matches)).catch(() => {}); }, []);
  if (!profile) return null;
  const register = async () => {
    try {
      const r = await api<{ profile: Profile }>('/auth/register', { method: 'POST', body: { username, password } });
      set({ profile: r.profile });
      toast('Account secured! You can now log in on any device.', 'good');
    } catch (e) { toast((e as Error).message, 'bad'); }
  };
  const rename = async () => {
    const v = validateName(name);
    if (!v.ok) return toast(v.error, 'bad');
    try { const r = await api<{ profile: Profile }>('/me', { method: 'PATCH', body: { name: v.name } }); set({ profile: r.profile }); toast('Name updated', 'good'); } catch (e) { toast((e as Error).message, 'bad'); }
  };
  const logout = async () => {
    try { await api('/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
    saveToken(null);
    disconnect();
    set({ token: null, profile: null, room: null, myId: null });
    go('welcome');
  };
  return (
    <ScreenShell title="Profile" onBack={() => go('menu')} right={<Coins n={profile.coins} />}>
      <div className="grid gap-3 lg:grid-cols-[1fr_1.4fr]">
        <Panel className="p-4">
          <CharacterPreview cosmetics={profile.cosmetics} className="mx-auto h-48 w-48" />
          <h2 className="text-center font-display text-3xl font-bold">{profile.name}<span className="text-lg opacity-50">#{profile.tag}</span></h2>
          <div className="my-3"><LevelBar level={profile.level} into={profile.levelXp} needed={profile.levelXpNeeded} /></div>
          <div className="flex gap-2">
            <input value={name} maxLength={16} onChange={(e) => setName(e.target.value)} className="min-w-0 flex-1 rounded-xl border-2 border-indigo-200 px-2 py-1 font-bold" />
            <Btn size="sm" onClick={rename}>Rename</Btn>
          </div>
          <div className="mt-4 rounded-2xl bg-indigo-50 p-3">
            {profile.username ? (
              <p className="text-sm font-bold">🔒 Logged in as <b>{profile.username}</b></p>
            ) : (
              <>
                <p className="mb-2 text-sm font-bold">Secure your progress with a username & password (no email needed):</p>
                <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="username" autoComplete="username" className="mb-2 w-full rounded-xl border-2 border-indigo-200 px-2 py-1 font-bold" />
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="password (6+ chars)" autoComplete="new-password" className="mb-2 w-full rounded-xl border-2 border-indigo-200 px-2 py-1 font-bold" />
                <Btn size="sm" tone="mint" onClick={register}>Save account</Btn>
              </>
            )}
          </div>
          <Btn className="mt-3 w-full" tone="danger" size="sm" onClick={logout}>Log out</Btn>
        </Panel>
        <Panel className="p-4">
          <h3 className="font-display text-xl font-bold">Statistics</h3>
          <StatsGrid stats={profile.stats} />
          <h3 className="mt-4 font-display text-xl font-bold">Achievements ({profile.achievements.length}/{ACHIEVEMENTS.length})</h3>
          <Achievements unlocked={profile.achievements.map((a) => a.id)} />
          <h3 className="mt-4 font-display text-xl font-bold">Recent matches</h3>
          {history.length === 0 ? <p className="text-sm opacity-60">No matches yet.</p> : (
            <div className="mt-1 flex flex-col gap-1">
              {history.map((m) => (
                <div key={String(m.id)} className={`flex justify-between rounded-xl px-3 py-1.5 text-sm font-bold ${m.won ? 'bg-emerald-100' : 'bg-indigo-50'}`}>
                  <span>{m.won ? '🏆' : '🎨'} {String(m.mode)} · {String(m.map_id)} · {m.team === 'hider' ? '🦎' : '🔎'}</span>
                  <span>{String(m.score)} pts · +{String(m.xp_earned)} XP</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </ScreenShell>
  );
}
