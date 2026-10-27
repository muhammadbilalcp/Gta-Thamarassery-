// Keyboard + mouse (pointer lock) + mobile touch virtual input.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set(); // keys that went down this frame
    this.virtualKeys = new Set();
    this.virtualPressed = new Set();
    this.virtualMoveX = 0;
    this.virtualMoveY = 0;
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheel = 0;
    this.locked = false;
    this.enabled = true;
    this.sensitivity = 0.0023;
    this.lastMouseMove = 0;

    this._onKeyDown = (e) => {
      if (e.repeat) return;
      if (!this.enabled) return;
      const block = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'F1'];
      if (block.includes(e.code)) e.preventDefault();
      this.keys.add(e.code);
      this.pressed.add(e.code);
    };
    this._onKeyUp = (e) => {
      this.keys.delete(e.code);
    };
    this._onBlur = () => {
      this.keys.clear();
      this.virtualKeys.clear();
    };
    this._onLockChange = () => {
      this.locked = document.pointerLockElement === this.canvas;
    };
    this._onMouseMove = (e) => {
      if (!this.locked && !this.dragging) return;
      this.mouseDX += e.movementX || 0;
      this.mouseDY += e.movementY || 0;
      this.lastMouseMove = performance.now();
    };
    this._onMouseDown = (e) => {
      if (e.button === 0) {
        if (!this.locked) {
          this.requestLock();
        }
        this.pressed.add('KeyF');
        this.virtualPressed.add('VirtualPunch');
      }
      this.dragging = true;
    };
    this._onMouseUp = () => {
      this.dragging = false;
    };
    this._onWheel = (e) => {
      this.wheel += Math.sign(e.deltaY);
      e.preventDefault();
    };
    this._onContextMenu = (e) => e.preventDefault();

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    document.addEventListener('pointerlockchange', this._onLockChange);
    document.addEventListener('mousemove', this._onMouseMove);
    canvas.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    canvas.addEventListener('wheel', this._onWheel, { passive: false });
    canvas.addEventListener('contextmenu', this._onContextMenu);
  }

  // --- Mobile Virtual Controls Bridge ---
  setVirtualMove(x, y) {
    this.virtualMoveX = Math.max(-1, Math.min(1, x));
    this.virtualMoveY = Math.max(-1, Math.min(1, y));
  }

  setVirtualKey(code, down) {
    if (down) {
      if (!this.virtualKeys.has(code)) {
        this.virtualPressed.add(code);
      }
      this.virtualKeys.add(code);
    } else {
      this.virtualKeys.delete(code);
    }
  }

  tapVirtualKey(code) {
    this.virtualPressed.add(code);
    this.virtualKeys.add(code);
    setTimeout(() => {
      this.virtualKeys.delete(code);
    }, 150);
  }

  addLook(dx, dy) {
    this.mouseDX += dx;
    this.mouseDY += dy;
    this.lastMouseMove = performance.now();
  }

  requestLock() {
    if (this.locked || !this.enabled) return;
    try {
      const p = this.canvas.requestPointerLock?.();
      if (p && p.catch) p.catch(() => {});
    } catch {
      /* pointer lock is optional */
    }
  }

  exitLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  down(code) {
    return this.keys.has(code) || this.virtualKeys.has(code);
  }

  hit(code) {
    return this.pressed.has(code) || this.virtualPressed.has(code);
  }

  /** -1..1 axes from WASD / arrow keys or virtual joystick. */
  get moveX() {
    let kx = (this.down('KeyD') || this.down('ArrowRight') ? 1 : 0) - (this.down('KeyA') || this.down('ArrowLeft') ? 1 : 0);
    return Math.abs(this.virtualMoveX) > 0.04 ? this.virtualMoveX : kx;
  }

  get moveY() {
    let ky = (this.down('KeyW') || this.down('ArrowUp') ? 1 : 0) - (this.down('KeyS') || this.down('ArrowDown') ? 1 : 0);
    return Math.abs(this.virtualMoveY) > 0.04 ? this.virtualMoveY : ky;
  }

  get sprint() {
    return this.down('ShiftLeft') || this.down('ShiftRight') || this.down('VirtualSprint');
  }

  /** Call at the end of each frame. */
  endFrame() {
    this.pressed.clear();
    this.virtualPressed.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheel = 0;
  }

  dispose() {
    this.enabled = false;
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    document.removeEventListener('pointerlockchange', this._onLockChange);
    document.removeEventListener('mousemove', this._onMouseMove);
    this.canvas?.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mouseup', this._onMouseUp);
    this.canvas?.removeEventListener('wheel', this._onWheel);
    this.canvas?.removeEventListener('contextmenu', this._onContextMenu);
  }
}
