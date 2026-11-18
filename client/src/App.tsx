import { lazy, Suspense, useEffect } from 'react';
import type { Profile } from '@shared/types';
import { useStore } from './store/useStore';
import { api, loadToken, saveToken } from './multiplayer/api';
import { connect, request } from './multiplayer/net';
import { Welcome } from './screens/Welcome';
import { MainMenu } from './screens/MainMenu';
import { Lobby } from './screens/Lobby';
import { Settings } from './screens/Settings';
import { Customize, Shop } from './screens/Customize';
import { Friends, Leaderboard, ProfileScreen, PublicProfileModal } from './screens/Social';
import { Btn, Panel, Spinner } from './ui/kit';
import { playMusic } from './audio/sound';

// The 3D game bundle is only loaded once a match starts.
const GameScreen = lazy(() => import('./game/GameScreen').then((m) => ({ default: m.GameScreen })));

function Toasts() {
  const toasts = useStore((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed left-1/2 top-24 z-[60] flex w-[min(92vw,420px)] -translate-x-1/2 flex-col items-center gap-2">
      {toasts.map((t) => (
        <div key={t.id} className={`animate-pop rounded-2xl px-4 py-2 text-center font-display font-semibold shadow-lg ${t.tone === 'good' ? 'bg-emerald-500 text-white' : t.tone === 'bad' ? 'bg-rose-500 text-white' : 'bg-white text-indigo-950'}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

function InvitePopup() {
  const invite = useStore((s) => s.invite);
  const set = useStore((s) => s.set);
  const go = useStore((s) => s.go);
  const toast = useStore((s) => s.toast);
  if (!invite) return null;
  return (
    <div className="fixed bottom-4 right-4 z-[60] w-72 animate-slideup">
      <Panel className="p-4">
        <p className="font-display text-lg font-bold">🎉 {invite.fromName} invited you!</p>
        <p className="text-sm opacity-70">Room {invite.code}</p>
        <div className="mt-3 flex gap-2">
          <Btn tone="mint" size="sm" onClick={async () => {
            const r = await request('room:join', { code: invite.code });
            set({ invite: null });
            if (r.ok) go('lobby'); else toast(r.error ?? 'Could not join', 'bad');
          }}>Join</Btn>
          <Btn tone="ghost" size="sm" onClick={() => set({ invite: null })}>Later</Btn>
        </div>
      </Panel>
    </div>
  );
}

function Background() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden game-bg">
      <div className="blob left-[5%] top-[60%] h-40 w-40 bg-yellow-300" />
      <div className="blob left-[70%] top-[8%] h-56 w-56 bg-cyan-300" style={{ animationDelay: '1s' }} />
      <div className="blob left-[85%] top-[70%] h-32 w-32 bg-lime-300" style={{ animationDelay: '2s' }} />
      <div className="blob left-[30%] top-[5%] h-24 w-24 bg-pink-300" style={{ animationDelay: '3s' }} />
    </div>
  );
}

export default function App() {
  const screen = useStore((s) => s.screen);
  const set = useStore((s) => s.set);
  const go = useStore((s) => s.go);
  const connected = useStore((s) => s.connected);
  const profile = useStore((s) => s.profile);

  // boot: restore session
  useEffect(() => {
    const token = loadToken();
    if (!token) { go('welcome'); return; }
    set({ token });
    api<{ profile: Profile }>('/me')
      .then(({ profile }) => {
        set({ profile, myId: profile.id });
        connect(token);
        go('menu');
      })
      .catch(() => { saveToken(null); set({ token: null }); go('welcome'); });
  }, [go, set]);

  // invite links: /?join=CODE
  useEffect(() => {
    if (!connected || !profile) return;
    const code = new URLSearchParams(location.search).get('join');
    if (!code) return;
    history.replaceState(null, '', location.pathname);
    void request('room:join', { code }).then((r) => {
      if (r.ok) go('lobby');
      else useStore.getState().toast(r.error ?? 'Could not join room', 'bad');
    });
  }, [connected, profile, go]);

  useEffect(() => {
    if (['menu', 'welcome', 'customize', 'shop', 'leaderboard', 'friends', 'profile', 'settings'].includes(screen)) playMusic('lobby');
  }, [screen]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      {screen !== 'game' && <Background />}
      <div className="relative h-full w-full overflow-y-auto">
        {screen === 'boot' && <div className="grid h-full place-items-center"><Spinner /></div>}
        {screen === 'welcome' && <Welcome />}
        {screen === 'menu' && <MainMenu />}
        {screen === 'lobby' && <Lobby />}
        {screen === 'customize' && <Customize />}
        {screen === 'shop' && <Shop />}
        {screen === 'leaderboard' && <Leaderboard />}
        {screen === 'friends' && <Friends />}
        {screen === 'profile' && <ProfileScreen />}
        {screen === 'settings' && <Settings />}
        {screen === 'game' && (
          <Suspense fallback={<div className="grid h-full place-items-center game-bg"><Spinner /></div>}>
            <GameScreen />
          </Suspense>
        )}
      </div>
      <Toasts />
      <InvitePopup />
      <PublicProfileModal />
    </div>
  );
}
