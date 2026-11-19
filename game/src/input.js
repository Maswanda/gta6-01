// Keyboard input: held keys + edge-triggered actions (consumed once per frame).
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_RADIO = 4;
export const ACTION_ENTER = 8;
export const ACTION_ROB = 16;

export function createInput() {
  const keys = new Set();
  let actions = 0;
  const down = (e) => {
    if (e.repeat) return;
    keys.add(e.code);
    if (e.code === 'Space' || e.code === 'Enter') actions |= ACTION_CONFIRM;
    if (e.code === 'KeyP' || e.code === 'Escape') actions |= ACTION_PAUSE;
    if (e.code === 'KeyR') actions |= ACTION_RADIO;
    if (e.code === 'KeyF') actions |= ACTION_ENTER;
    if (e.code === 'KeyE') actions |= ACTION_ROB;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  };
  const up = (e) => keys.delete(e.code);
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  return {
    // -1..1 steering, -1..1 throttle (W/S or arrows). Space = handbrake/drift.
    axis() {
      let steer = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) steer -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) steer += 1;
      let throttle = 0;
      if (keys.has('KeyW') || keys.has('ArrowUp')) throttle += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) throttle -= 1;
      const drift = keys.has('Space');
      const run = keys.has('ShiftLeft') || keys.has('ShiftRight');
      return { steer, throttle, drift, run };
    },
    firing() { return keys.has('KeyJ') || false; },
    takeActions() {
      const a = actions;
      actions = 0;
      return a;
    },
    // Test/autopilot hook: pretend keys are held.
    setVirtual(code, held) {
      if (held) keys.add(code); else keys.delete(code);
    },
  };
}
