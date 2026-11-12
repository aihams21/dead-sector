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

    /* زر ضغط مستمر — Pointer Events (بتشتغل على كل المتصفحات الحديثة)
       وبتشتغل مع اللمس والفأرة والقلم بنفس الكود */
    const hold = (el, onDown, onUp) => {
      if (!el) return;
      let id = null;
      el.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        id = e.pointerId;
        el.classList.add("pressed");
        try { el.setPointerCapture(id); } catch { /* ignore */ }
        onDown?.(e);
      }, { passive: false });
      const release = (e) => {
        if (id !== null && e.pointerId !== id) return;
        id = null;
        el.classList.remove("pressed");
        onUp?.(e);
      };
      el.addEventListener("pointerup", release);
      el.addEventListener("pointercancel", release);
      el.addEventListener("lostpointercapture", release);
    };

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

    let joyId = null;
    let joyOrigin = { x: 0, y: 0 };
    joy.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      joyId = e.pointerId;
      try { joy.setPointerCapture(joyId); } catch { /* ignore */ }
      const r = joy.getBoundingClientRect();
      joyOrigin = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      setJoy(e.clientX - joyOrigin.x, e.clientY - joyOrigin.y);
    }, { passive: false });
    joy.addEventListener("pointermove", (e) => {
      if (e.pointerId !== joyId) return;
      e.preventDefault();
      setJoy(e.clientX - joyOrigin.x, e.clientY - joyOrigin.y);
    }, { passive: false });
    const endJoy = (e) => {
      if (e.pointerId !== joyId) return;
      joyId = null;
      resetJoy();
    };
    joy.addEventListener("pointerup", endJoy);
    joy.addEventListener("pointercancel", endJoy);

    if (lookZone) {
      let lookId = null;
      let lookPos = { x: 0, y: 0 };
      lookZone.addEventListener("pointerdown", (e) => {
        if (joyId !== null) return; /* العصا عندها الأولوية */
        lookId = e.pointerId;
        lookPos = { x: e.clientX, y: e.clientY };
        try { lookZone.setPointerCapture(lookId); } catch { /* ignore */ }
      });
      lookZone.addEventListener("pointermove", (e) => {
        if (e.pointerId !== lookId) return;
        this.look.dx += (e.clientX - lookPos.x) * 0.0042 * this.sensitivity;
        this.look.dy += (e.clientY - lookPos.y) * 0.0042 * this.sensitivity * (this.invert ? -1 : 1);
        lookPos = { x: e.clientX, y: e.clientY };
      });
      const endLook = (e) => {
        if (e.pointerId === lookId) lookId = null;
      };
      lookZone.addEventListener("pointerup", endLook);
      lookZone.addEventListener("pointercancel", endLook);
    }

    hold(fireBtn, () => { this.fire = true; }, () => { this.fire = false; });
    hold(document.getElementById("btn-reload"), () => { this.reloadQueued = true; });
    hold(document.getElementById("btn-jump"), () => { this.jumpQueued = true; });
    hold(document.getElementById("btn-switch"), () => { this.switchQueued = 1; });
    hold(document.getElementById("btn-pause"), () => { this.pausedRequested = true; });
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
