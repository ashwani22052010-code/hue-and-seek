// Mobile third-person controls.
// One multi-touch layer under the HUD buttons:
//   - a touch that STARTS on the left 42% of the screen drives a floating joystick (it appears under the thumb)
//   - a touch that starts anywhere else rotates the camera (drag) or performs a tap action
// Movement is always relative to the camera's horizontal forward/right (see LocalPlayer), so pushing the
// stick up always walks "into the screen" no matter how the camera has been turned.
import { useRef, useState, type ReactNode } from 'react';
import { input } from './input';
import { useStore } from '../store/useStore';

const R = 58; // joystick radius in px
const DEAD = 0.12;

interface Stick { id: number; ox: number; oy: number; x: number; y: number }
interface LookPtr { x: number; y: number; sx: number; sy: number; t: number }

export function TouchLayer({ onTap, moveEnabled }: { onTap: (x: number, y: number) => void; moveEnabled: boolean }) {
  const [stick, setStick] = useState<Stick | null>(null);
  const stickRef = useRef<Stick | null>(null);
  const looks = useRef(new Map<number, LookPtr>());

  const updateStick = (s: Stick) => {
    const sens = useStore.getState().settings.joySens ?? 1;
    const r = R / Math.max(0.5, sens);
    let dx = s.x - s.ox, dy = s.y - s.oy;
    const d = Math.hypot(dx, dy);
    if (d > r) { dx = (dx / d) * r; dy = (dy / d) * r; }
    let mag = Math.min(1, d / r);
    mag = mag < DEAD ? 0 : (mag - DEAD) / (1 - DEAD);
    const len = Math.hypot(dx, dy) || 1;
    // screen up (negative y) = forward
    input.joyX = (dx / len) * mag;
    input.joyY = (-dy / len) * mag;
    stickRef.current = s;
    setStick({ ...s, x: s.ox + dx, y: s.oy + dy });
  };
  const endStick = () => {
    stickRef.current = null;
    setStick(null);
    input.joyX = 0;
    input.joyY = 0;
  };

  return (
    <div
      data-testid="touch-layer"
      className="pointer-events-auto absolute inset-0 touch-none"
      onPointerDown={(e) => {
        if (e.pointerType === 'mouse') return;
        try { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); } catch { /* synthetic / unsupported pointer */ }
        const leftZone = e.clientX < window.innerWidth * 0.42;
        if (leftZone && moveEnabled && !stickRef.current) {
          updateStick({ id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY });
          return;
        }
        looks.current.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() });
      }}
      onPointerMove={(e) => {
        if (e.pointerType === 'mouse') return;
        const s = stickRef.current;
        if (s && s.id === e.pointerId) { updateStick({ ...s, x: e.clientX, y: e.clientY }); return; }
        const l = looks.current.get(e.pointerId);
        if (!l) return;
        const k = 1.5 * (useStore.getState().settings.touchLook ?? 1);
        input.lookDX += (e.clientX - l.x) * k;
        input.lookDY += (e.clientY - l.y) * k;
        l.x = e.clientX;
        l.y = e.clientY;
      }}
      onPointerUp={(e) => {
        if (stickRef.current?.id === e.pointerId) { endStick(); return; }
        const l = looks.current.get(e.pointerId);
        looks.current.delete(e.pointerId);
        if (l && Math.hypot(e.clientX - l.sx, e.clientY - l.sy) < 12 && performance.now() - l.t < 320) onTap(e.clientX, e.clientY);
      }}
      onPointerCancel={(e) => {
        if (stickRef.current?.id === e.pointerId) endStick();
        looks.current.delete(e.pointerId);
      }}
    >
      {moveEnabled && !stick && (
        <div className="pointer-events-none absolute bottom-8 left-8 grid h-32 w-32 place-items-center rounded-full border-4 border-white/30 bg-white/10 text-center text-[10px] font-bold text-white/70 safe-b">
          <div className="h-14 w-14 rounded-full border-4 border-white/50 bg-white/20" />
          <span className="absolute -bottom-5">MOVE</span>
        </div>
      )}
      {stick && (
        <>
          <div className="pointer-events-none absolute h-[116px] w-[116px] -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white/50 bg-white/15 backdrop-blur-sm" style={{ left: stick.ox, top: stick.oy }} />
          <div className="pointer-events-none absolute h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white/90 bg-white/60" style={{ left: stick.x, top: stick.y }} />
        </>
      )}
    </div>
  );
}

export function RoundBtn({ children, onDown, onUp, active, className = '', label, size = 'md', testId }: { children: ReactNode; onDown: () => void; onUp?: () => void; active?: boolean; className?: string; label?: string; size?: 'sm' | 'md' | 'lg'; testId?: string }) {
  const sz = { sm: 'h-12 w-12 text-lg', md: 'h-16 w-16 text-2xl', lg: 'h-20 w-20 text-3xl' }[size];
  return (
    <button
      aria-label={label}
      data-testid={testId}
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
