/* المدخلات: كيبورد/فأرة للّابتوب + تحكم لمس للهاتف */
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.look = { dx: 0, dy: 0 };
    this.move = { x: 0, y: 0 };
    this.fire = false;
    this.jumpQueued = false;
    this.reloadQueued = false;
    this.switchQueued = 0;
    this.slotQueued = null;
    this.pausedRequested = false;
    this.isTouch = matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
    this.pointerLocked = false;
    this.sensitivity = 1;
    this.invert = false;
    this._joyId = null;
    this._lookId = null;
    this._joyOrigin = { x: 0, y: 0 };
    this.enabled = false;
    this.bind();
  }

  bind() {
    addEventListener("keydown", (e) => {
      if (!this.enabled) return;
      if (e.code === "Escape") { this.pausedRequested = true; return; }
      this.keys.add(e.code);
      if (e.code === "KeyR") this.reloadQueued = true;
      if (e.code === "Space") { this.jumpQueued = true; e.preventDefault(); }
      if (e.code === "KeyQ") this.switchQueued = 1;
      if (/^Digit[1-7]$/.test(e.code)) this.slotQueued = parseInt(e.code.slice(5), 10) - 1;
      if (e.code === "KeyE") this.switchQueued = 1;
    });
    addEventListener("keyup", (e) => this.keys.delete(e.code));
    addEventListener("blur", () => { this.keys.clear(); this.fire = false; });

    document.addEventListener("mousemove", (e) => {
      if (!this.pointerLocked || !this.enabled) return;
      this.look.dx += e.movementX * 0.0022 * this.sensitivity;
      this.look.dy += e.movementY * 0.0022 * this.sensitivity * (this.invert ? -1 : 1);
    });
    this.canvas.addEventListener("mousedown", (e) => {
      if (!this.enabled) return;
      if (e.button === 0) this.fire = true;
      if (!this.pointerLocked && !this.isTouch) this.lockPointer();
    });
    addEventListener("mouseup", (e) => { if (e.button === 0) this.fire = false; });
    document.addEventListener("pointerlockchange", () => {
      this.pointerLocked = document.pointerLockElement === this.canvas;
      if (!this.pointerLocked && this.enabled) this.pausedRequested = true;
    });
    this.bindTouch();
  }

  lockPointer() {
    if (this.isTouch) return;
    this.canvas.requestPointerLock?.();
  }

  unlock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  bindTouch() {
    const joy = document.getElementById("joy");
    const knob = document.getElementById("joy-knob");
    const lookZone = document.getElementById("look-zone");
    const fireBtn = document.getElementById("btn-fire");
    if (!joy) return;

    const setJoy = (dx, dy) => {
      const max = 52;
      const d = Math.hypot(dx, dy);
      const k = d > max ? max / d : 1;
      const kx = dx * k, ky = dy * k;
      knob.style.transform = `translate(${kx}px, ${ky}px)`;
      this.move.x = kx / max;
      this.move.y = -ky / max;
    };
    const resetJoy = () => {
      knob.style.transform = "translate(0px,0px)";
      this.move.x = 0; this.move.y = 0;
    };

    joy.addEventListener("touchstart", (e) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      this._joyId = t.identifier;
      const r = joy.getBoundingClientRect();
      this._joyOrigin = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      setJoy(t.clientX - this._joyOrigin.x, t.clientY - this._joyOrigin.y);
    }, { passive: false });
    joy.addEventListener("touchmove", (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier !== this._joyId) continue;
        setJoy(t.clientX - this._joyOrigin.x, t.clientY - this._joyOrigin.y);
      }
    }, { passive: false });
    const endJoy = (e) => {
      for (const t of e.changedTouches) if (t.identifier === this._joyId) { this._joyId = null; resetJoy(); }
    };
    joy.addEventListener("touchend", endJoy);
    joy.addEventListener("touchcancel", endJoy);

    if (lookZone) {
      lookZone.addEventListener("touchstart", (e) => {
        const t = e.changedTouches[0];
        this._lookId = t.identifier;
        this._lookPos = { x: t.clientX, y: t.clientY };
      }, { passive: true });
      lookZone.addEventListener("touchmove", (e) => {
        for (const t of e.changedTouches) {
          if (t.identifier !== this._lookId) continue;
          this.look.dx += (t.clientX - this._lookPos.x) * 0.0042 * this.sensitivity;
          this.look.dy += (t.clientY - this._lookPos.y) * 0.0042 * this.sensitivity * (this.invert ? -1 : 1);
          this._lookPos = { x: t.clientX, y: t.clientY };
        }
      }, { passive: true });
      const endLook = (e) => {
        for (const t of e.changedTouches) if (t.identifier === this._lookId) this._lookId = null;
      };
      lookZone.addEventListener("touchend", endLook);
      lookZone.addEventListener("touchcancel", endLook);
    }

    fireBtn?.addEventListener("touchstart", (e) => { e.preventDefault(); this.fire = true; }, { passive: false });
    fireBtn?.addEventListener("touchend", (e) => { e.preventDefault(); this.fire = false; }, { passive: false });
    fireBtn?.addEventListener("touchcancel", () => { this.fire = false; });
    document.getElementById("btn-reload")?.addEventListener("touchstart", (e) => { e.preventDefault(); this.reloadQueued = true; }, { passive: false });
    document.getElementById("btn-jump")?.addEventListener("touchstart", (e) => { e.preventDefault(); this.jumpQueued = true; }, { passive: false });
    document.getElementById("btn-switch")?.addEventListener("touchstart", (e) => { e.preventDefault(); this.switchQueued = 1; }, { passive: false });
  }

  consumeLook() {
    const l = { dx: this.look.dx, dy: this.look.dy };
    this.look.dx = 0; this.look.dy = 0;
    return l;
  }

  update() {
    if (!this.isTouch) {
      let x = 0, y = 0;
      if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) y += 1;
      if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) y -= 1;
      if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) x += 1;
      if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) x -= 1;
      const len = Math.hypot(x, y) || 1;
      this.move.x = x / len;
      this.move.y = y / len;
    }
  }

  get sprinting() {
    return this.keys.has("ShiftLeft") || this.keys.has("ShiftRight") || (this.isTouch && Math.hypot(this.move.x, this.move.y) > 0.92 && this._autoSprint);
  }

  reset() {
    this.keys.clear();
    this.look.dx = 0; this.look.dy = 0;
    this.move.x = 0; this.move.y = 0;
    this.fire = false;
    this.jumpQueued = false;
    this.reloadQueued = false;
    this.switchQueued = 0;
    this.slotQueued = null;
    this.pausedRequested = false;
  }
}
