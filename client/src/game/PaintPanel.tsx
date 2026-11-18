import { useEffect, useState } from 'react';
import type { PoseId, ShapeId } from '@shared/types';
import { BRUSH_SIZES, PATTERNS, POSES, POSE_IDS, SHAPES, SHAPE_IDS } from '@shared/constants';
import { hexToRgb, hsvToRgb, rgbToHex, rgbToHsv, isHex } from '@shared/game-rules/rules';
import { useStore, type Tool } from '../store/useStore';
import { emit } from '../multiplayer/net';
import { clearPaint, fill, redo, savePresetNow, undo, applyPresetNow } from './painting';
import { colorTile } from '../maps/textures';
import { sfx } from '../audio/sound';

function ColorPicker() {
  const color = useStore((s) => s.color);
  const recent = useStore((s) => s.recentColors);
  const set = useStore((s) => s.set);
  const [hsv, setHsv] = useState(() => rgbToHsv(...hexToRgb(color)));
  const [hexText, setHexText] = useState(color);
  const [showRgb, setShowRgb] = useState(false);
  useEffect(() => {
    setHexText(color);
    const cur = rgbToHex(...hsvToRgb(...hsv));
    if (cur !== color) setHsv(rgbToHsv(...hexToRgb(color)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [color]);
  const update = (h: number, s: number, v: number) => {
    setHsv([h, s, v]);
    set({ color: rgbToHex(...hsvToRgb(h, s, v)) });
  };
  const rgb = hexToRgb(color);
  const pureHue = rgbToHex(...hsvToRgb(hsv[0], 1, 1));
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="h-11 w-11 shrink-0 rounded-xl border-4 border-white shadow" style={{ background: color }} />
        <input
          aria-label="Hex colour"
          value={hexText}
          onChange={(e) => {
            const v = e.target.value.trim();
            setHexText(v);
            const norm = (v.startsWith('#') ? v : '#' + v).toLowerCase();
            if (isHex(norm)) set({ color: norm });
          }}
          className="w-24 rounded-lg border-2 border-indigo-200 px-2 py-1 font-mono text-sm uppercase"
        />
        <button onClick={() => setShowRgb(!showRgb)} className="rounded-lg bg-indigo-100 px-2 py-1 text-xs font-bold">{showRgb ? 'HSV' : 'RGB'}</button>
      </div>
      {!showRgb ? (
        <>
          <label className="block text-[11px] font-bold uppercase opacity-60">Hue</label>
          <input type="range" min={0} max={359} value={Math.round(hsv[0])} onChange={(e) => update(+e.target.value, hsv[1], hsv[2])} className="hue-slider h-3 w-full cursor-pointer appearance-none rounded-full" />
          <label className="block text-[11px] font-bold uppercase opacity-60">Saturation</label>
          <input type="range" min={0} max={100} value={Math.round(hsv[1] * 100)} onChange={(e) => update(hsv[0], +e.target.value / 100, hsv[2])} className="h-3 w-full cursor-pointer appearance-none rounded-full" style={{ background: `linear-gradient(90deg, #fff, ${pureHue})` }} />
          <label className="block text-[11px] font-bold uppercase opacity-60">Brightness</label>
          <input type="range" min={0} max={100} value={Math.round(hsv[2] * 100)} onChange={(e) => update(hsv[0], hsv[1], +e.target.value / 100)} className="h-3 w-full cursor-pointer appearance-none rounded-full" style={{ background: `linear-gradient(90deg, #000, ${rgbToHex(...hsvToRgb(hsv[0], hsv[1], 1))})` }} />
        </>
      ) : (
        (['R', 'G', 'B'] as const).map((ch, i) => (
          <div key={ch} className="flex items-center gap-2">
            <span className="w-4 text-xs font-bold">{ch}</span>
            <input type="range" min={0} max={255} value={rgb[i]} onChange={(e) => { const n = [...rgb] as [number, number, number]; n[i] = +e.target.value; set({ color: rgbToHex(...n) }); }} className="w-full" />
            <span className="w-8 text-right font-mono text-xs">{rgb[i]}</span>
          </div>
        ))
      )}
      <div className="flex flex-wrap gap-1.5">
        {recent.map((c) => (
          <button key={c} aria-label={`Use ${c}`} onClick={() => set({ color: c })} className={`h-6 w-6 rounded-md border-2 ${c === color ? 'border-violet-600' : 'border-white'} shadow`} style={{ background: c }} />
        ))}
      </div>
    </div>
  );
}

function PatternGrid() {
  const pattern = useStore((s) => s.pattern);
  const color = useStore((s) => s.color);
  const set = useStore((s) => s.set);
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {PATTERNS.map((p) => (
        <button key={p.id} onClick={() => set({ pattern: p.id })} className={`overflow-hidden rounded-lg border-2 text-[10px] font-bold ${pattern === p.id ? 'border-violet-600 ring-2 ring-violet-300' : 'border-white'}`}>
          <div className="h-8 w-full" style={{ backgroundImage: `url(${colorTile(p.id, color).toDataURL()})`, backgroundSize: '48px' }} />
          <div className="bg-white py-0.5">{p.label}</div>
        </button>
      ))}
    </div>
  );
}

const TOOLS: { id: Tool; icon: string; label: string }[] = [
  { id: 'brush', icon: '🖌️', label: 'Brush' },
  { id: 'fill', icon: '🪣', label: 'Fill part' },
  { id: 'fillall', icon: '🎨', label: 'Fill all' },
  { id: 'eyedropper', icon: '💧', label: 'Eyedropper' },
];

export function PosePicker({ compact }: { compact?: boolean }) {
  const myLook = useStore((s) => s.room?.players.find((p) => p.id === s.myId)?.look);
  return (
    <div className={`grid ${compact ? 'grid-cols-5' : 'grid-cols-3'} gap-1.5`}>
      {POSE_IDS.map((id: PoseId) => (
        <button key={id} onClick={() => { emit('look', { pose: id }); sfx('click'); }} className={`rounded-xl px-1 py-1.5 text-center text-[11px] font-bold ${myLook?.pose === id ? 'bg-violet-600 text-white' : 'bg-indigo-50 hover:bg-indigo-100'}`}>
          <div className="text-lg leading-none">{POSES[id].emoji}</div>
          {POSES[id].label}
        </button>
      ))}
    </div>
  );
}

function ShapePicker() {
  const myLook = useStore((s) => s.room?.players.find((p) => p.id === s.myId)?.look);
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {SHAPE_IDS.map((id: ShapeId) => (
        <button key={id} onClick={() => { emit('look', { shape: id }); sfx('click'); }} className={`flex flex-col items-center rounded-xl py-1.5 text-[11px] font-bold ${myLook?.shape === id ? 'bg-violet-600 text-white' : 'bg-indigo-50 hover:bg-indigo-100'}`}>
          <div className="mb-1 rounded-full bg-current opacity-60" style={{ width: 14 * SHAPES[id].scale[0], height: 20 * SHAPES[id].scale[1] }} />
          {SHAPES[id].label}
        </button>
      ))}
    </div>
  );
}

export function PaintPanel() {
  const s = useStore();
  const [tab, setTab] = useState<'color' | 'pattern' | 'pose' | 'shape'>('color');
  const tabs = [['color', '🎨 Color'], ['pattern', '🧩 Pattern'], ['pose', '🤸 Pose'], ['shape', '📐 Shape']] as const;
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.code === 'KeyZ') undo();
      if (e.code === 'KeyY') redo();
      if (e.code === 'KeyB') s.set({ tool: 'brush' });
      if (e.code === 'KeyI') s.set({ tool: 'eyedropper' });
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [s]);
  return (
    <div className="pointer-events-auto absolute bottom-0 left-0 right-0 z-30 max-h-[46vh] overflow-y-auto rounded-t-3xl bg-white/95 p-3 text-indigo-950 shadow-2xl backdrop-blur sm:bottom-auto sm:left-auto sm:right-3 sm:top-20 sm:max-h-[calc(100vh-6rem)] sm:w-80 sm:rounded-3xl animate-slideup" onPointerDown={(e) => e.stopPropagation()}>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-display text-lg font-bold">Camouflage Studio</h3>
        <button onClick={() => s.set({ paintMode: false })} className="rounded-full bg-indigo-100 px-3 py-1 text-sm font-bold">Done ✓</button>
      </div>
      <div className="mb-2 grid grid-cols-4 gap-1.5">
        {TOOLS.map((t) => (
          <button key={t.id} onClick={() => { s.set({ tool: t.id }); sfx('click'); }} className={`rounded-xl py-1.5 text-[11px] font-bold ${s.tool === t.id ? 'bg-violet-600 text-white shadow-[0_3px_0_#4c1d95]' : 'bg-indigo-50'}`}>
            <div className="text-lg leading-none">{t.icon}</div>{t.label}
          </button>
        ))}
      </div>
      {s.tool === 'eyedropper' && (
        <div className="mb-2 rounded-xl bg-amber-100 p-2 text-xs font-bold text-amber-900">
          Tap any surface (or another player) to copy its colour.
          <label className="mt-1 flex items-center gap-2"><input type="checkbox" checked={s.matchTexture} onChange={(e) => s.set({ matchTexture: e.target.checked })} /> Also match its texture pattern</label>
        </div>
      )}
      {s.tool === 'brush' && (
        <div className="mb-2 flex items-center gap-2">
          <span className="text-xs font-bold">Brush</span>
          {BRUSH_SIZES.map((b) => (
            <button key={b} aria-label={`Brush ${b}`} onClick={() => s.set({ brush: b })} className={`grid h-9 w-9 place-items-center rounded-full ${s.brush === b ? 'bg-violet-600' : 'bg-indigo-100'}`}>
              <span className="rounded-full" style={{ width: 4 + b / 3.5, height: 4 + b / 3.5, background: s.brush === b ? '#fff' : s.color }} />
            </button>
          ))}
        </div>
      )}
      <div className="mb-2 grid grid-cols-5 gap-1.5 text-xs font-bold">
        <button onClick={undo} className="rounded-xl bg-indigo-50 py-1.5">↶ Undo</button>
        <button onClick={redo} className="rounded-xl bg-indigo-50 py-1.5">↷ Redo</button>
        <button onClick={() => fill('all')} className="rounded-xl bg-indigo-50 py-1.5">Fill all</button>
        <button onClick={clearPaint} className="rounded-xl bg-rose-100 py-1.5 text-rose-700">Clear</button>
        <button onClick={savePresetNow} title="Save preset for Quick Disguise" className="rounded-xl bg-emerald-100 py-1.5 text-emerald-800">💾 Save</button>
      </div>
      <div className="mb-2 flex gap-1 rounded-xl bg-indigo-50 p-1">
        {tabs.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={`flex-1 rounded-lg py-1 text-[11px] font-bold ${tab === id ? 'bg-white shadow' : ''}`}>{label}</button>
        ))}
      </div>
      {tab === 'color' && <ColorPicker />}
      {tab === 'pattern' && <PatternGrid />}
      {tab === 'pose' && <PosePicker />}
      {tab === 'shape' && <ShapePicker />}
      <div className="mt-2 flex items-center justify-between text-[11px] opacity-70">
        <span>Drag on yourself to paint · drag elsewhere to rotate</span>
        <button onClick={applyPresetNow} className="underline">Load preset</button>
      </div>
    </div>
  );
}
