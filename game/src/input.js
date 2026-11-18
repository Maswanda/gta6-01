// Keyboard + mouse input v2. Tracks held keys and edge-triggered presses
// (consume() reports a key once, so E / R / Escape fire a single action).
// New in v2: M opens the mission tracker, 1/2/3 pick a weapon, Q cycles
// weapons, H honks the horn, and T works the side activities (taxi, race).
export class Input {
  constructor() {
    this.down = new Set();
    this.pressed = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheel = 0;
    this.dragging = false;
    this.anyKey = false;
  }

  attach(canvas) {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.down.add(e.code);
      this.pressed.add(e.code);
      this.anyKey = true;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => {
      this.down.clear();
      this.dragging = false;
    });
    canvas.addEventListener('pointerdown', (e) => {
      this.dragging = true;
      canvas.setPointerCapture(e.pointerId);
      // Track mouse buttons so Mouse0 (punch) and Mouse2 (shoot) work.
      const code = e.button === 2 ? 'Mouse2' : 'Mouse0';
      this.down.add(code);
      this.pressed.add(code);
    });
    canvas.addEventListener('pointerup', (e) => {
      this.dragging = false;
      const code = e.button === 2 ? 'Mouse2' : 'Mouse0';
      this.down.delete(code);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      this.mouseDX += e.movementX || 0;
      this.mouseDY += e.movementY || 0;
    });
    canvas.addEventListener('wheel', (e) => {
      this.wheel += e.deltaY;
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  held(code) {
    return this.down.has(code);
  }

  // True once for the frame the key went down; clears after being read.
  consume(code) {
    if (!this.pressed.has(code)) return false;
    this.pressed.delete(code);
    return true;
  }

  // WASD / arrows as a -1..1 pair, already normalised by the caller.
  moveAxes() {
    let x = 0;
    let y = 0;
    if (this.held('KeyA') || this.held('ArrowLeft')) x -= 1;
    if (this.held('KeyD') || this.held('ArrowRight')) x += 1;
    if (this.held('KeyW') || this.held('ArrowUp')) y += 1;
    if (this.held('KeyS') || this.held('ArrowDown')) y -= 1;
    return { x, y };
  }

  // The weapon key the player just pressed, if any.
  weaponKey() {
    if (this.consume('Digit1')) return 'pistol';
    if (this.consume('Digit2')) return 'shotgun';
    if (this.consume('Digit3')) return 'smg';
    return null;
  }

  endFrame() {
    this.pressed.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheel = 0;
  }
}
