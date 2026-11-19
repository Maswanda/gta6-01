// input.js — Solmar Bay: keyboard and mouse, one pad for the whole game.
// Tracks held keys and per-frame presses; the game loop calls endFrame()
// once a tick so a press is seen exactly once.
export class InputPad {
  constructor() {
    this.down = new Set();
    this.hit = new Set();
    this.mouseDown = false;
    this.mouseX = 0;
    this.mouseY = 0;
    addEventListener('keydown', (e) => {
      if (!this.down.has(e.code)) this.hit.add(e.code);
      this.down.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) {
        e.preventDefault();
      }
    });
    addEventListener('keyup', (e) => this.down.delete(e.code));
    addEventListener('mousedown', (e) => {
      this.mouseDown = true;
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    });
    addEventListener('mouseup', () => {
      this.mouseDown = false;
    });
    addEventListener('mousemove', (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    });
    addEventListener('blur', () => {
      this.down.clear();
      this.hit.clear();
      this.mouseDown = false;
    });
  }
  isDown(code) {
    return this.down.has(code);
  }
  wasPressed(code) {
    return this.hit.has(code);
  }
  endFrame() {
    this.hit.clear();
  }
  // Let an autopilot (or a test) press keys without a keyboard.
  inject(code, down) {
    if (down) this.down.add(code);
    else this.down.delete(code);
  }
  // -1..1 steering / movement axes from WASD or arrows.
  moveX() {
    const r = this.isDown('KeyD') || this.isDown('ArrowRight') ? 1 : 0;
    const l = this.isDown('KeyA') || this.isDown('ArrowLeft') ? 1 : 0;
    return r - l;
  }
  moveY() {
    const f = this.isDown('KeyW') || this.isDown('ArrowUp') ? 1 : 0;
    const b = this.isDown('KeyS') || this.isDown('ArrowDown') ? 1 : 0;
    return f - b;
  }
  get running() {
    return this.isDown('ShiftLeft') || this.isDown('ShiftRight');
  }
  get handbrake() {
    return this.isDown('Space');
  }
}
