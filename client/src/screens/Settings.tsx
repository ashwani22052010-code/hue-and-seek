import { useStore, type Settings as S } from '../store/useStore';
import { Panel, ScreenShell } from '../ui/kit';
import { sfx } from '../audio/sound';

function Slider({ label, k }: { label: string; k: keyof Pick<S, 'master' | 'music' | 'sfx' | 'ui' | 'voice'> }) {
  const v = useStore((s) => s.settings[k]);
  const update = useStore((s) => s.updateSettings);
  return (
    <label className="flex items-center gap-3 text-sm font-bold">
      <span className="w-20">{label}</span>
      <input type="range" min={0} max={100} value={Math.round(v * 100)} onChange={(e) => update({ [k]: +e.target.value / 100 })} onPointerUp={() => sfx('click')} className="flex-1" />
      <span className="w-10 text-right">{Math.round(v * 100)}%</span>
    </label>
  );
}

export function SettingsBody({ compact }: { compact?: boolean }) {
  const s = useStore((st) => st.settings);
  const update = useStore((st) => st.updateSettings);
  const Toggle = ({ label, on, set }: { label: string; on: boolean; set: (v: boolean) => void }) => (
    <label className="flex items-center justify-between text-sm font-bold">{label}
      <button onClick={() => set(!on)} className={`h-7 w-12 rounded-full p-1 transition ${on ? 'bg-violet-600' : 'bg-slate-300'}`}><span className={`block h-5 w-5 rounded-full bg-white transition ${on ? 'translate-x-5' : ''}`} /></button>
    </label>
  );
  return (
    <div className={`flex flex-col ${compact ? 'gap-2' : 'gap-3'}`}>
      <h3 className="font-display text-lg font-bold">🔊 Audio</h3>
      <Slider label="Master" k="master" />
      <Slider label="Music" k="music" />
      <Slider label="Effects" k="sfx" />
      <Slider label="UI" k="ui" />
      <Slider label="Voice chat" k="voice" />
      <h3 className="mt-2 font-display text-lg font-bold">🖥️ Graphics</h3>
      <div className="flex gap-2">
        {(['low', 'high'] as const).map((q) => (
          <button key={q} onClick={() => update({ quality: q })} className={`flex-1 rounded-xl py-2 text-sm font-bold ${s.quality === q ? 'bg-violet-600 text-white' : 'bg-indigo-50'}`}>{q === 'low' ? 'Performance (mobile)' : 'Quality (shadows)'}</button>
        ))}
      </div>
      <Toggle label="Show FPS" on={s.showFps} set={(v) => update({ showFps: v })} />
      <h3 className="mt-2 font-display text-lg font-bold">🎮 Controls</h3>
      <label className="flex items-center gap-3 text-sm font-bold"><span className="w-28">Sensitivity</span>
        <input type="range" min={30} max={250} value={Math.round(s.sensitivity * 100)} onChange={(e) => update({ sensitivity: +e.target.value / 100 })} className="flex-1" />
      </label>
      <Toggle label="Invert camera Y" on={s.invertY} set={(v) => update({ invertY: v })} />
      <div className="flex items-center justify-between text-sm font-bold">Touch controls
        <select value={s.touch} onChange={(e) => update({ touch: e.target.value as S['touch'] })} className="rounded-xl border-2 border-indigo-200 px-2 py-1">
          <option value="auto">Auto</option><option value="on">Always on</option><option value="off">Off</option>
        </select>
      </div>
    </div>
  );
}

export function Settings() {
  const go = useStore((s) => s.go);
  return (
    <ScreenShell title="Settings" onBack={() => go('menu')}>
      <Panel className="mx-auto max-w-lg p-5"><SettingsBody /></Panel>
    </ScreenShell>
  );
}
