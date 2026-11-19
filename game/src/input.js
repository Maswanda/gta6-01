// Keyboard input: real keys plus a scripted interface the test harness
// uses (pressKey / releaseKey), so headless playtests can drive the game.
export class Input {
  constructor() {
    this.keys = new Set();
    this.handlers = {};
    this.attached = false;
  }

  attach() {
    if (this.attached) return;
    this.attached = true;
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.emit(e.code, true);
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      this.emit(e.code, false);
    });
    window.addEventListener('blur', () => this.keys.clear());
  }

  on(code, fn) {
    if (!this.handlers[code]) this.handlers[code] = [];
    this.handlers[code].push(fn);
  }

  emit(code, down) {
    const list = this.handlers[code];
    if (!list) return;
    for (const fn of list) {
      try {
        fn(down);
      } catch (err) {
        console.error('input handler failed', err);
      }
    }
  }

  // Scripted key press (used by the harness and the autopilot).
  pressKey(code) {
    this.keys.add(code);
    this.emit(code, true);
  }

  releaseKey(code) {
    this.keys.delete(code);
    this.emit(code, false);
  }

  tap(code) {
    this.pressKey(code);
    this.releaseKey(code);
  }

  isDown(code) {
    return this.keys.has(code);
  }

  // Driving axes from WASD / arrows.
  driveAxes() {
    let throttle = 0;
    let steer = 0;
    if (this.isDown('KeyW') || this.isDown('ArrowUp')) throttle += 1;
    if (this.isDown('KeyS') || this.isDown('ArrowDown')) throttle -= 1;
    if (this.isDown('KeyA') || this.isDown('ArrowLeft')) steer -= 1;
    if (this.isDown('KeyD') || this.isDown('ArrowRight')) steer += 1;
    return { throttle, steer };
  }

  walkAxes() {
    let x = 0;
    let z = 0;
    if (this.isDown('KeyW') || this.isDown('ArrowUp')) z -= 1;
    if (this.isDown('KeyS') || this.isDown('ArrowDown')) z += 1;
    if (this.isDown('KeyA') || this.isDown('ArrowLeft')) x -= 1;
    if (this.isDown('KeyD') || this.isDown('ArrowRight')) x += 1;
    return { x, z };
  }
}
