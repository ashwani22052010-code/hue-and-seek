// Reusable game-style UI building blocks.
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { sfx } from '../audio/sound';

type Tone = 'grape' | 'pink' | 'mint' | 'sun' | 'sky' | 'ghost' | 'danger' | 'dark';
const TONES: Record<Tone, string> = {
  grape: 'bg-violet-500 hover:bg-violet-400 text-white shadow-[0_5px_0_#5b21b6] active:shadow-[0_1px_0_#5b21b6]',
  pink: 'bg-pink-500 hover:bg-pink-400 text-white shadow-[0_5px_0_#9d174d] active:shadow-[0_1px_0_#9d174d]',
  mint: 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-[0_5px_0_#047857] active:shadow-[0_1px_0_#047857]',
  sun: 'bg-amber-400 hover:bg-amber-300 text-amber-950 shadow-[0_5px_0_#b45309] active:shadow-[0_1px_0_#b45309]',
  sky: 'bg-sky-500 hover:bg-sky-400 text-white shadow-[0_5px_0_#0369a1] active:shadow-[0_1px_0_#0369a1]',
  danger: 'bg-rose-500 hover:bg-rose-400 text-white shadow-[0_5px_0_#9f1239] active:shadow-[0_1px_0_#9f1239]',
  ghost: 'bg-white/80 hover:bg-white text-indigo-950 shadow-[0_5px_0_rgba(30,27,75,0.25)] active:shadow-[0_1px_0_rgba(30,27,75,0.25)]',
  dark: 'bg-indigo-950/80 hover:bg-indigo-900 text-white shadow-[0_5px_0_rgba(0,0,0,0.4)] active:shadow-[0_1px_0_rgba(0,0,0,0.4)]',
};

export function Btn({ tone = 'grape', size = 'md', className = '', children, onClick, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const sz = { sm: 'px-3 py-1.5 text-sm rounded-xl', md: 'px-5 py-2.5 text-base rounded-2xl', lg: 'px-6 py-3.5 text-lg rounded-2xl', xl: 'px-8 py-4 text-2xl rounded-3xl' }[size];
  return (
    <button
      {...rest}
      onClick={(e) => { sfx('click'); onClick?.(e); }}
      className={`font-display font-semibold tracking-wide transition-all duration-100 active:translate-y-1 disabled:opacity-50 disabled:pointer-events-none select-none ${sz} ${TONES[tone]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-3xl bg-white/90 backdrop-blur-md text-indigo-950 shadow-[0_10px_0_rgba(30,27,75,0.18),0_20px_50px_rgba(30,27,75,0.25)] ${className}`}>{children}</div>;
}

export function Modal({ children, onClose, title, wide }: { children: ReactNode; onClose?: () => void; title?: string; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-indigo-950/60 p-4 backdrop-blur-sm animate-[pop_.25s_ease-out]" onClick={onClose}>
      <Panel className={`relative w-full ${wide ? 'max-w-3xl' : 'max-w-md'} max-h-[92vh] overflow-y-auto p-5 sm:p-6 animate-pop`}>
        <div onClick={(e) => e.stopPropagation()}>
          {title && <h2 className="mb-4 pr-10 font-display text-2xl font-bold">{title}</h2>}
          {onClose && (
            <button aria-label="Close" onClick={onClose} className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-indigo-100 font-bold text-indigo-900 hover:bg-indigo-200">✕</button>
          )}
          {children}
        </div>
      </Panel>
    </div>
  );
}

export function ScreenShell({ title, onBack, children, right }: { title: string; onBack: () => void; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="relative z-10 mx-auto flex h-full w-full max-w-6xl flex-col px-3 pb-4 pt-3 sm:px-6 sm:pt-6">
      <div className="mb-3 flex items-center gap-3 sm:mb-5">
        <Btn tone="ghost" size="sm" onClick={onBack} aria-label="Back">← Back</Btn>
        <h1 className="font-display text-2xl font-bold text-white drop-shadow-[0_3px_0_rgba(30,27,75,0.5)] sm:text-4xl">{title}</h1>
        <div className="ml-auto">{right}</div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}

export function Coins({ n }: { n: number }) {
  return <span className="inline-flex items-center gap-1 rounded-full bg-amber-300 px-3 py-1 font-display font-bold text-amber-950 shadow-[0_3px_0_#b45309]">🪙 {n}</span>;
}

export function LevelBar({ level, into, needed }: { level: number; into: number; needed: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-violet-600 font-display font-bold text-white shadow-[0_3px_0_#4c1d95]">{level}</span>
      <div className="h-3 w-full overflow-hidden rounded-full bg-indigo-950/20">
        <div className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-500 transition-all" style={{ width: `${Math.min(100, (into / needed) * 100)}%` }} />
      </div>
      <span className="shrink-0 text-xs font-bold opacity-70">{into}/{needed} XP</span>
    </div>
  );
}

export function Spinner() {
  return <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/30 border-t-white" />;
}

export const fmtTime = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
