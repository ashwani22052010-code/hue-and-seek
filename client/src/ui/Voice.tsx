// Voice chat controls: quick mic toggle + panel to choose who hears you and whom you hear.
import type { VoiceTarget } from '../store/useStore';
import { useStore } from '../store/useStore';
import { voice, isVoiceSpectator } from '../multiplayer/voice';
import { Modal } from './kit';
import { sfx } from '../audio/sound';

const ACTIVE = ['assign', 'prep', 'hunt', 'intermission'];

export async function toggleMic() {
  const v = useStore.getState().voice;
  const err = await voice.setMic(!v.mic);
  if (err) { useStore.getState().toast(err, 'bad'); sfx('error'); }
  else sfx(v.mic ? 'click' : 'pop');
}

export function VoiceBar({ vertical }: { vertical?: boolean }) {
  const v = useStore((s) => s.voice);
  const room = useStore((s) => s.room);
  const set = useStore((s) => s.set);
  const names = useStore((s) => s.room?.players);
  if (!room) return null;
  const openPanel = () => set({ voice: { ...useStore.getState().voice, panel: true } });
  const talking = (names ?? []).filter((p) => v.speaking[p.id]);
  return (
    <div className={`pointer-events-auto flex items-center gap-2 ${vertical ? 'flex-col' : ''}`} onPointerDown={(e) => e.stopPropagation()}>
      {v.on && (
        <button
          aria-label={v.mic ? 'Mute microphone' : 'Unmute microphone'}
          onClick={toggleMic}
          disabled={v.busy}
          className={`grid h-11 w-11 place-items-center rounded-full text-xl shadow transition ${v.mic ? (v.speaking[useStore.getState().myId ?? ''] ? 'bg-emerald-400 ring-4 ring-emerald-200' : 'bg-emerald-500') : 'bg-rose-500'}`}
          title="Mic on/off (V)"
        >
          {v.mic ? '🎙️' : '🔇'}
        </button>
      )}
      <button aria-label="Voice chat settings" onClick={openPanel} className={`h-11 rounded-full px-3 text-sm font-bold shadow ${v.on ? 'bg-white/90 text-indigo-950' : 'bg-white/85 text-indigo-950'}`}>
        {v.on ? `🎧 ${v.mic ? (v.hearsMe.length ? `${v.hearsMe.length} hear you` : 'nobody hears') : 'listening'}` : '🎧 Voice'}
      </button>
      {talking.length > 0 && (
        <div className={`flex gap-1 ${vertical ? 'flex-col items-start' : ''}`}>
          {talking.slice(0, 4).map((p) => (
            <span key={p.id} className="animate-pulse rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-bold text-white shadow">🔊 {p.name}</span>
          ))}
        </div>
      )}
    </div>
  );
}

const TARGETS: { id: VoiceTarget; icon: string; label: string; hint: string }[] = [
  { id: 'all', icon: '🌍', label: 'Everyone', hint: 'Everybody in voice hears you' },
  { id: 'team', icon: '🛡️', label: 'My team', hint: 'Only your team during a round (everyone in the lobby)' },
  { id: 'custom', icon: '✋', label: 'Choose', hint: 'Only the players you tick below' },
];

export function VoicePanel() {
  const v = useStore((s) => s.voice);
  const room = useStore((s) => s.room);
  const myId = useStore((s) => s.myId);
  const set = useStore((s) => s.set);
  const toast = useStore((s) => s.toast);
  if (!v.panel || !room) return null;
  const close = () => set({ voice: { ...useStore.getState().voice, panel: false } });
  const me = room.players.find((p) => p.id === myId);
  const others = room.players.filter((p) => p.id !== myId);
  const active = ACTIVE.includes(room.phase);
  const spectatorLock = active && isVoiceSpectator(me);
  const hears = new Set(v.hearsMe);

  const toggleVoice = async () => {
    if (v.on) { voice.disable(); sfx('click'); return; }
    const err = await voice.enable();
    if (err) { toast(err, 'bad'); sfx('error'); } else sfx('pop');
  };

  return (
    <Modal title="🎧 Voice Chat" onClose={close}>
      {room.isPublic ? (
        <p className="rounded-2xl bg-amber-100 p-3 text-sm font-bold text-amber-900">
          Voice chat is only available in private rooms. Create a room and share the code with your friends to talk together.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between rounded-2xl bg-indigo-50 p-3">
            <div>
              <div className="font-display text-lg font-bold">Voice chat</div>
              <div className="text-xs font-bold opacity-60">{v.on ? 'You are in the voice channel' : 'Turn on to hear your friends'}</div>
            </div>
            <button aria-label="Voice chat on/off" disabled={v.busy} onClick={toggleVoice} className={`h-9 w-16 rounded-full p-1 transition ${v.on ? 'bg-emerald-500' : 'bg-slate-300'}`}>
              <span className={`block h-7 w-7 rounded-full bg-white shadow transition ${v.on ? 'translate-x-7' : ''}`} />
            </button>
          </div>

          {v.on && (
            <>
              <button onClick={toggleMic} disabled={v.busy}
                className={`rounded-2xl py-3 font-display text-lg font-bold text-white shadow-[0_5px_0_rgba(0,0,0,0.2)] active:translate-y-1 ${v.mic ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                {v.mic ? '🎙️ Mic is ON - tap to mute' : '🔇 Mic is OFF - tap to talk'}
              </button>

              <div>
                <div className="mb-1 font-display font-bold">Who hears me?</div>
                <div className="grid grid-cols-3 gap-1.5">
                  {TARGETS.map((t) => (
                    <button key={t.id} onClick={() => { voice.setTarget(t.id); sfx('click'); }}
                      className={`rounded-2xl p-2 text-center text-sm font-bold ${v.target === t.id ? 'bg-violet-600 text-white shadow-[0_3px_0_#4c1d95]' : 'bg-indigo-50'}`}>
                      <div className="text-xl">{t.icon}</div>{t.label}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-xs font-bold opacity-60">{TARGETS.find((t) => t.id === v.target)?.hint}</p>
                {spectatorLock && <p className="mt-1 rounded-xl bg-amber-100 p-2 text-xs font-bold text-amber-900">You were found, so until the round ends only other caught players can hear you (no hints!).</p>}
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between font-display font-bold">
                  <span>Players</span>
                  <span className="text-xs opacity-60">{v.mic ? `${hears.size} can hear you now` : 'mic off - nobody hears you'}</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {others.length === 0 && <p className="text-sm opacity-60">Nobody else is here yet.</p>}
                  {others.map((p) => {
                    const inVoice = p.voice?.on && p.connected;
                    const status = v.status[p.id];
                    const muted = v.muted.includes(p.id);
                    return (
                      <div key={p.id} className="flex items-center gap-2 rounded-2xl bg-indigo-50 px-2 py-1.5">
                        {v.target === 'custom' && (
                          <input type="checkbox" aria-label={`${p.name} hears me`} checked={v.custom.includes(p.id)} onChange={() => voice.toggleCustom(p.id)} className="h-5 w-5 accent-violet-600" />
                        )}
                        <span className={`text-lg ${v.speaking[p.id] ? 'animate-pulse' : 'opacity-40'}`}>🔊</span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-bold">{p.name}{active && p.team !== 'none' ? <span className="ml-1 text-[10px] opacity-60">{p.team === 'hider' ? '🦎' : '🔎'}</span> : null}</div>
                          <div className="text-[10px] font-bold opacity-60">
                            {!inVoice ? 'not in voice' : status === 'connected' ? (hears.has(p.id) ? 'hears you' : 'connected') : status === 'failed' ? "can't connect (network)" : 'connecting...'}
                            {inVoice && !p.voice.mic ? ' · mic off' : ''}
                          </div>
                        </div>
                        {inVoice && (
                          <button onClick={() => voice.toggleMute(p.id)} className={`rounded-xl px-2 py-1 text-xs font-bold ${muted ? 'bg-rose-100 text-rose-700' : 'bg-white'}`}>
                            {muted ? '🔇 Muted' : '🔈 Hear'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
          <p className="text-[11px] opacity-60">Voice goes directly between players&apos; devices. Only people in this private room can join. Use 🔈/🔇 to choose whom you hear.</p>
        </div>
      )}
    </Modal>
  );
}
