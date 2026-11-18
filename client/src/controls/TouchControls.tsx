// Mobile controls: left virtual joystick, right-side camera drag (tap = poke for seekers), action buttons.
import { useRef, useState, type ReactNode } from 'react';
import { input } from './input';

export function Joystick() {
  const base = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0, active: false });
  const pid = useRef<number | null>(null);
  const R = 52;
  const update = (cx: number, cy: number) => {
    const r = base.current!.getBoundingClientRect();
    let dx = cx - (r.left + r.width / 2), dy = cy - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy);
    if (d > R) { dx = (dx / d) * R; dy = (dy / d) * R; }
    setKnob({ x: dx, y: dy, active: true });
    input.joyX = dx / R;
    input.joyY = -dy / R;
  };
  const end = () => {
    pid.current = null;
    setKnob({ x: 0, y: 0, active: false });
    input.joyX = 0;
    input.joyY = 0;
  };
  return (
    <div
      ref={base}
      className="pointer-events-auto relative h-36 w-36 touch-none rounded-full border-4 border-white/40 bg-white/15 backdrop-blur-sm"
      onPointerDown={(e) => { pid.current = e.pointerId; (e.target as HTMLElement).setPointerCapture(e.pointerId); update(e.clientX, e.clientY); }}
      onPointerMove={(e) => { if (pid.current === e.pointerId) update(e.clientX, e.clientY); }}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <div className={`absolute left-1/2 top-1/2 h-16 w-16 rounded-full border-4 border-white/80 ${knob.active ? 'bg-white/70' : 'bg-white/40'}`} style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }} />
    </div>
  );
}

/** Full-screen layer behind the HUD buttons that turns drags into camera movement and taps into pokes. */
export function LookArea({ tapToTag }: { tapToTag: boolean }) {
  const last = useRef<Map<number, { x: number; y: number; sx: number; sy: number; t: number }>>(new Map());
  return (
    <div
      className="pointer-events-auto absolute inset-0 touch-none"
      onPointerDown={(e) => { last.current.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() }); }}
      onPointerMove={(e) => {
        const l = last.current.get(e.pointerId);
        if (!l || e.pointerType === 'mouse') return;
        input.lookDX += (e.clientX - l.x) * 1.6;
        input.lookDY += (e.clientY - l.y) * 1.6;
        l.x = e.clientX;
        l.y = e.clientY;
      }}
      onPointerUp={(e) => {
        const l = last.current.get(e.pointerId);
        last.current.delete(e.pointerId);
        if (l && tapToTag && Math.hypot(e.clientX - l.sx, e.clientY - l.sy) < 12 && performance.now() - l.t < 300) input.tagAt = { x: e.clientX, y: e.clientY };
      }}
      onPointerCancel={(e) => last.current.delete(e.pointerId)}
    />
  );
}

export function RoundBtn({ children, onDown, onUp, active, className = '', label, size = 'md' }: { children: ReactNode; onDown: () => void; onUp?: () => void; active?: boolean; className?: string; label?: string; size?: 'sm' | 'md' | 'lg' }) {
  const sz = { sm: 'h-12 w-12 text-lg', md: 'h-16 w-16 text-2xl', lg: 'h-20 w-20 text-3xl' }[size];
  return (
    <button
      aria-label={label}
      className={`pointer-events-auto relative grid touch-none select-none place-items-center rounded-full border-4 border-white/70 font-display font-bold shadow-lg active:scale-95 ${active ? 'bg-violet-500 text-white' : 'bg-white/30 text-white backdrop-blur-sm'} ${sz} ${className}`}
      onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); onDown(); }}
      onPointerUp={(e) => { e.stopPropagation(); onUp?.(); }}
      onPointerCancel={() => onUp?.()}
    >
      {children}
      {label && <span className="absolute -bottom-4 whitespace-nowrap text-[10px] font-bold text-white drop-shadow">{label}</span>}
    </button>
  );
}
