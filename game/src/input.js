// input.js — keyboard state. The harness (and the autopilot) drives the game
// through pressKey/releaseKey, so those are first-class, not a debug hack.
export class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set(); // edge-triggered: consumed by takePressed
    this._onDown = (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
    };
    this._onUp = (e) => { this.keys.delete(e.code); };
    this._onBlur = () => { this.keys.clear(); };
    window.addEventListener('keydown', this._onDown);
    window.addEventListener('keyup', this._onUp);
    window.addEventListener('blur', this._onBlur);
  }
  down(code) { return this.keys.has(code); }
  // Returns true once per physical press.
  takePressed(code) {
    if (this.pressed.has(code)) { this.pressed.delete(code); return true; }
    return false;
  }
  // Harness / autopilot drive.
  pressKey(code) { this.keys.add(code); this.pressed.add(code); }
  releaseKey(code) { this.keys.delete(code); }
  // Steering: -1 left, +1 right; throttle: 0..1; brake: bool.
  steer() {
    let s = 0;
    if (this.down('KeyA') || this.down('ArrowLeft')) s -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) s += 1;
    return s;
  }
  throttle() {
    if (this.down('KeyW') || this.down('ArrowUp')) return 1;
    if (this.down('KeyS') || this.down('ArrowDown')) return -0.6;
    return 0;
  }
  get drift() { return this.down('Space'); }
  // Movement vector on foot (x = strafe right, z = forward), camera-relative.
  moveVec(heading) {
    let f = 0, r = 0;
    if (this.down('KeyW') || this.down('ArrowUp')) f += 1;
    if (this.down('KeyS') || this.down('ArrowDown')) f -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) r += 1;
    if (this.down('KeyA') || this.down('ArrowLeft')) r -= 1;
    if (!f && !r) return { x: 0, z: 0 };
    const sin = Math.sin(heading), cos = Math.cos(heading);
    // Forward is (sin, cos) in world x/z for a heading measured from +z.
    return { x: (sin * f + cos * r), z: (cos * f - sin * r) };
  }
}
