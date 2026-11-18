import { useState } from 'react';
import type { Profile } from '@shared/types';
import { DEFAULT_COSMETICS } from '@shared/constants';
import { validateName } from '@shared/game-rules/rules';
import { useStore } from '../store/useStore';
import { api, saveToken } from '../multiplayer/api';
import { connect } from '../multiplayer/net';
import { Btn, Panel } from '../ui/kit';
import { CharacterPreview } from '../characters/CharacterPreview';
import { Logo } from './MainMenu';

export function Welcome() {
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'guest' | 'login'>('guest');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = useStore((s) => s.set);
  const go = useStore((s) => s.go);

  const finish = (token: string, profile: Profile) => {
    saveToken(token);
    set({ token, profile, myId: profile.id });
    connect(token);
    go('menu');
  };

  const submit = async () => {
    setErr('');
    setBusy(true);
    try {
      if (mode === 'guest') {
        const v = validateName(name);
        if (!v.ok) throw new Error(v.error);
        const r = await api<{ token: string; profile: Profile }>('/auth/guest', { method: 'POST', body: { name: v.name } });
        finish(r.token, r.profile);
      } else {
        const r = await api<{ token: string; profile: Profile }>('/auth/login', { method: 'POST', body: { username, password } });
        finish(r.token, r.profile);
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative z-10 flex min-h-full flex-col items-center justify-center gap-4 p-4">
      <Logo />
      <CharacterPreview cosmetics={DEFAULT_COSMETICS} className="h-48 w-48 sm:h-56 sm:w-56" anim="em_wave" />
      <Panel className="w-full max-w-sm p-5 animate-pop">
        <div className="mb-4 flex rounded-2xl bg-indigo-100 p-1 font-display font-bold">
          <button className={`flex-1 rounded-xl py-2 ${mode === 'guest' ? 'bg-white shadow' : ''}`} onClick={() => setMode('guest')}>New player</button>
          <button className={`flex-1 rounded-xl py-2 ${mode === 'login' ? 'bg-white shadow' : ''}`} onClick={() => setMode('login')}>I have an account</button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); void submit(); }} className="flex flex-col gap-3">
          {mode === 'guest' ? (
            <>
              <label className="font-display font-semibold">Pick a nickname</label>
              <input autoFocus maxLength={16} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. SneakyBean" className="rounded-2xl border-4 border-indigo-200 px-4 py-3 text-lg font-bold outline-none focus:border-violet-500" />
              <p className="text-xs opacity-60">No email or personal info needed. You can add a password later to keep your progress across devices.</p>
            </>
          ) : (
            <>
              <input autoFocus value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" autoComplete="username" className="rounded-2xl border-4 border-indigo-200 px-4 py-3 font-bold outline-none focus:border-violet-500" />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" autoComplete="current-password" className="rounded-2xl border-4 border-indigo-200 px-4 py-3 font-bold outline-none focus:border-violet-500" />
            </>
          )}
          {err && <p className="rounded-xl bg-rose-100 px-3 py-2 text-sm font-bold text-rose-700">{err}</p>}
          <Btn tone="pink" size="lg" type="submit" disabled={busy}>{busy ? '...' : mode === 'guest' ? "Let's play!" : 'Log in'}</Btn>
        </form>
      </Panel>
    </div>
  );
}
