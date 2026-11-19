// input.js — Keyboard and mouse state for Solmar Bay.
// Keys are tracked by event.code so WASD, arrows, E/F/G/R/T and the
// number keys all work the same in a real browser and headless.
// pressKey / releaseKey let the test harness (and the ?shot= staging)
// drive the game programmatically.
export class Input {
  constructor() {
    this.keys = new Set();
    this.justPressed = new Set();
    this.mouse = { x: 0, y: 0, down: false };
    this._onKeyDown = (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.justPressed.add(e.code);
    };
    this._onKeyUp = (e) => {
      this.keys.delete(e.code);
    };
    this._onBlur = () => {
      this.keys.clear();
    };
    this._onMouseMove = (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
    };
    this._onMouseDown = () => {
      this.mouse.down = true;
    };
    this._onMouseUp = () => {
      this.mouse.down = false;
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
  }
  down(code) {
    return this.keys.has(code);
  }
  pressed(code) {
    return this.justPressed.has(code);
  }
  pressKey(code) {
    this.keys.add(code);
    this.justPressed.add(code);
  }
  releaseKey(code) {
    this.keys.delete(code);
  }
  endFrame() {
    this.justPressed.clear();
  }
  destroy() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mouseup', this._onMouseUp);
  }
}
