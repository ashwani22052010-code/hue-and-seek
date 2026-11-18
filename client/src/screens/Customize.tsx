import { useState } from 'react';
import type { Cosmetics, Profile } from '@shared/types';
import { COSMETICS, type CosmeticSlot, type CosmeticItem } from '@shared/constants';
import { useStore } from '../store/useStore';
import { api } from '../multiplayer/api';
import { Btn, Coins, Panel, ScreenShell } from '../ui/kit';
import { CharacterPreview } from '../characters/CharacterPreview';
import { sfx } from '../audio/sound';

const SLOTS: { slot: CosmeticSlot; label: string }[] = [
  { slot: 'color', label: '🎨 Color' },
  { slot: 'hat', label: '🎩 Hats' },
  { slot: 'glasses', label: '👓 Glasses' },
  { slot: 'shoes', label: '👟 Shoes' },
  { slot: 'accessory', label: '🧣 Extras' },
  { slot: 'victory', label: '🏆 Victory' },
  { slot: 'emote', label: '😄 Emotes' },
];

export async function buyItem(item: CosmeticItem) {
  const s = useStore.getState();
  try {
    const r = await api<{ profile: Profile }>('/shop/buy', { method: 'POST', body: { itemId: item.id } });
    s.set({ profile: r.profile });
    s.toast(`Unlocked ${item.name}!`, 'good');
    sfx('caught');
    return true;
  } catch (e) {
    s.toast((e as Error).message, 'bad');
    sfx('error');
    return false;
  }
}

export function ItemCard({ item, profile, equipped, onEquip, onPreview }: { item: CosmeticItem; profile: Profile; equipped: boolean; onEquip?: () => void; onPreview?: () => void }) {
  const owned = profile.owned.includes(item.id);
  const locked = profile.level < item.level;
  return (
    <div className={`flex flex-col items-center gap-1 rounded-2xl p-2 text-center ${equipped ? 'bg-violet-200 ring-4 ring-violet-500' : 'bg-indigo-50'}`} onMouseEnter={onPreview}>
      <div className="grid h-12 w-12 place-items-center rounded-full text-2xl" style={item.value ? { background: item.value } : undefined}>
        {item.value ? '' : item.icon ?? ICONS[item.slot]}
      </div>
      <div className="text-sm font-bold leading-tight">{item.name}</div>
      {owned ? (
        onEquip ? <Btn size="sm" tone={equipped ? 'ghost' : 'grape'} onClick={onEquip} disabled={equipped}>{equipped ? 'Equipped' : 'Equip'}</Btn> : <span className="text-xs font-bold text-emerald-700">Owned</span>
      ) : locked ? (
        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-bold">🔒 Level {item.level}</span>
      ) : (
        <Btn size="sm" tone="sun" onClick={() => buyItem(item)} disabled={profile.coins < item.price}>🪙 {item.price}</Btn>
      )}
    </div>
  );
}
const ICONS: Record<CosmeticSlot, string> = { color: '', hat: '🎩', glasses: '👓', shoes: '👟', accessory: '🧣', victory: '🏆', emote: '😄' };

export function Customize() {
  const profile = useStore((s) => s.profile);
  const set = useStore((s) => s.set);
  const go = useStore((s) => s.go);
  const toast = useStore((s) => s.toast);
  const [slot, setSlot] = useState<CosmeticSlot>('hat');
  const [preview, setPreview] = useState<Partial<Cosmetics>>({});
  const [anim, setAnim] = useState<string | null>(null);
  if (!profile) return null;
  const shown: Cosmetics = { ...profile.cosmetics, ...preview };

  const equip = async (item: CosmeticItem) => {
    if (item.slot === 'emote') { setAnim(item.id); setTimeout(() => setAnim(null), 2600); return; }
    try {
      const r = await api<{ profile: Profile }>('/me', { method: 'PATCH', body: { cosmetics: { [item.slot]: item.id } } });
      set({ profile: r.profile });
      setPreview({});
      if (item.slot === 'victory') { setAnim(item.id); setTimeout(() => setAnim(null), 3000); }
    } catch (e) {
      toast((e as Error).message, 'bad');
    }
  };

  const items = COSMETICS.filter((c) => c.slot === slot);
  return (
    <ScreenShell title="Customize" onBack={() => go('menu')} right={<Coins n={profile.coins} />}>
      <div className="grid gap-3 lg:grid-cols-[1fr_1.2fr]">
        <Panel className="relative h-72 bg-gradient-to-b from-violet-200/90 to-pink-100/90 sm:h-[460px]">
          <CharacterPreview cosmetics={shown} orbit anim={anim} className="h-full w-full" />
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2">
            <Btn size="sm" tone="ghost" onClick={() => { setAnim(profile.cosmetics.victory); setTimeout(() => setAnim(null), 3000); }}>Preview victory</Btn>
          </div>
          <p className="absolute left-3 top-3 rounded-full bg-white/80 px-2 py-0.5 text-xs font-bold">Drag to rotate</p>
        </Panel>
        <Panel className="p-3">
          <div className="no-scrollbar mb-3 flex gap-1.5 overflow-x-auto">
            {SLOTS.map((s) => (
              <button key={s.slot} onClick={() => { setSlot(s.slot); setPreview({}); }} className={`whitespace-nowrap rounded-xl px-3 py-1.5 text-sm font-bold ${slot === s.slot ? 'bg-violet-600 text-white' : 'bg-indigo-50'}`}>{s.label}</button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {items.map((item) => (
              <ItemCard key={item.id} item={item} profile={profile}
                equipped={item.slot !== 'emote' && (profile.cosmetics as unknown as Record<string, string>)[item.slot] === item.id}
                onEquip={() => equip(item)}
                onPreview={() => item.slot !== 'emote' && setPreview({ [item.slot]: item.id })} />
            ))}
          </div>
          <p className="mt-3 text-xs opacity-60">Cosmetics are purely visual. Hiders always start as a clean white Hueling, so nothing gives an unfair advantage.</p>
        </Panel>
      </div>
    </ScreenShell>
  );
}

export function Shop() {
  const profile = useStore((s) => s.profile);
  const go = useStore((s) => s.go);
  if (!profile) return null;
  const forSale = COSMETICS.filter((c) => c.price > 0);
  return (
    <ScreenShell title="Shop" onBack={() => go('menu')} right={<Coins n={profile.coins} />}>
      <Panel className="p-3">
        <p className="mb-3 text-sm font-bold opacity-70">Earn coins by playing matches, completing daily missions and unlocking achievements.</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {forSale.map((item) => (
            <div key={item.id} className="flex flex-col">
              <span className="mb-1 text-center text-[10px] font-bold uppercase opacity-50">{item.slot}</span>
              <ItemCard item={item} profile={profile} equipped={false} />
            </div>
          ))}
        </div>
      </Panel>
    </ScreenShell>
  );
}
