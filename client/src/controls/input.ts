// Unified input state for keyboard/mouse and touch controls. Read every frame by the local player.
export const input = {
  keys: new Set<string>(),
  joyX: 0, // touch joystick (-1..1)
  joyY: 0,
  lookDX: 0, // accumulated camera deltas (pixels)
  lookDY: 0,
  zoom: 0,
  jump: false, // edge-triggered flags, consumed by the game loop
  interact: false,
  tag: false,
  tagAt: null as null | { x: number; y: number }, // screen position for tap-to-tag
  sprintHeld: false,
  pointerLocked: false,
};

export const cam = { yaw: Math.PI, pitch: 0.32, dist: 5.2 };

export function consumeLook() {
  const d = { x: input.lookDX, y: input.lookDY };
  input.lookDX = 0;
  input.lookDY = 0;
  return d;
}

export function moveAxes(): { x: number; y: number; sprint: boolean } {
  const k = input.keys;
  let x = 0, y = 0;
  if (k.has('KeyW') || k.has('ArrowUp')) y += 1;
  if (k.has('KeyS') || k.has('ArrowDown')) y -= 1;
  if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
  if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
  x += input.joyX;
  y += input.joyY;
  const len = Math.hypot(x, y);
  if (len > 1) { x /= len; y /= len; }
  const sprint = k.has('ShiftLeft') || k.has('ShiftRight') || input.sprintHeld || Math.hypot(input.joyX, input.joyY) > 0.95;
  return { x, y, sprint };
}

const isTyping = (e: KeyboardEvent) => {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
};

type KeyHandler = (code: string, e: KeyboardEvent) => void;
const keyHandlers = new Set<KeyHandler>();
export function onKey(h: KeyHandler) {
  keyHandlers.add(h);
  return () => { keyHandlers.delete(h); };
}

let installed = false;
export function installInput() {
  if (installed) return;
  installed = true;
  window.addEventListener('keydown', (e) => {
    if (isTyping(e)) return;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
    if (!e.repeat) {
      if (e.code === 'Space') input.jump = true;
      if (e.code === 'KeyE') input.interact = true;
      if (e.code === 'KeyF') input.tag = true;
      keyHandlers.forEach((h) => h(e.code, e));
    }
    input.keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => input.keys.delete(e.code));
  window.addEventListener('blur', () => input.keys.clear());
  document.addEventListener('pointerlockchange', () => {
    input.pointerLocked = !!document.pointerLockElement;
  });
  window.addEventListener('mousemove', (e) => {
    if (input.pointerLocked) {
      input.lookDX += e.movementX;
      input.lookDY += e.movementY;
    }
  });
  window.addEventListener('wheel', (e) => { input.zoom += Math.sign(e.deltaY); }, { passive: true });
}

export function requestLock(el: HTMLElement) {
  try {
    const r = el.requestPointerLock?.() as unknown as Promise<void> | undefined;
    r?.catch?.(() => {});
  } catch { /* unsupported */ }
}
export function exitLock() {
  if (document.pointerLockElement) document.exitPointerLock();
}
