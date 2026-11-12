/* واجهة اللعب (HUD) — تُحدَّث بأقل قدر من عمليات DOM */
import * as THREE from "three";

const _v = new THREE.Vector3();

export class HUD {
  constructor() {
    this.el = {
      hud: document.getElementById("hud"),
      hpFill: document.getElementById("hp-fill"),
      hpText: document.getElementById("hp-text"),
      armorFill: document.getElementById("armor-fill"),
      staminaFill: document.getElementById("stamina-fill"),
      ammoCur: document.getElementById("ammo-cur"),
      ammoRes: document.getElementById("ammo-res"),
      weaponName: document.getElementById("weapon-name"),
      reloadBar: document.getElementById("reload-bar"),
      coin: document.getElementById("hud-coins"),
      gem: document.getElementById("hud-gems"),
      waveLabel: document.getElementById("wave-label"),
      waveSub: document.getElementById("wave-sub"),
      waveFill: document.getElementById("wave-fill"),
      bossWrap: document.getElementById("boss-bar"),
      bossFill: document.getElementById("boss-fill"),
      bossName: document.getElementById("boss-name"),
      crosshair: document.getElementById("crosshair"),
      hitmarker: document.getElementById("hitmarker"),
      vignette: document.getElementById("vignette"),
      floats: document.getElementById("floats"),
      toasts: document.getElementById("toasts"),
      kills: document.getElementById("hud-kills"),
      timer: document.getElementById("hud-timer"),
      hint: document.getElementById("hud-hint"),
    };
    this.cache = {};
    this.floatPool = [];
  }

  show(on) { this.el.hud.classList.toggle("on", on); }

  set(key, value, fn) {
    if (this.cache[key] === value) return;
    this.cache[key] = value;
    fn(value);
  }

  vitals(player) {
    const pct = Math.max(0, Math.min(1, player.hp / player.maxHp));
    this.set("hp", Math.round(pct * 100), (v) => {
      this.el.hpFill.style.width = `${v}%`;
      this.el.hpText.textContent = Math.ceil(player.hp);
    });
    this.set("armor", Math.round(player.armor * 100), (v) => {
      this.el.armorFill.style.width = `${Math.min(100, v * 2)}%`;
    });
    this.set("stam", Math.round((player.stamina / 100) * 100), (v) => {
      this.el.staminaFill.style.width = `${v}%`;
    });
    this.el.vignette.style.opacity = String(Math.min(0.85, player.hitFlash * 0.8 + (pct < 0.3 ? 0.28 : 0)));
  }

  ammo(weapons) {
    if (!weapons.rt) return;
    const rt = weapons.rt;
    this.set("ammo", `${weapons.ammo}|${weapons.reserve}`, () => {
      this.el.ammoCur.textContent = String(weapons.ammo);
      this.el.ammoRes.textContent = String(weapons.reserve);
      const low = weapons.ammo <= Math.max(1, rt.magSize * 0.25);
      this.el.ammoCur.classList.toggle("low", low);
    });
    this.set("wname", weapons.currentId, () => {
      this.el.weaponName.textContent = rt.def.nameAr;
    });
    const rp = weapons.reloading > 0 ? 1 - weapons.reloading / weapons.reloadTotal : 0;
    this.el.reloadBar.style.width = `${Math.round(rp * 100)}%`;
    this.el.reloadBar.parentElement.classList.toggle("on", weapons.reloading > 0);
  }

  economy(profile) {
    this.set("coins", profile.coins, (v) => { this.el.coin.textContent = v.toLocaleString("en-US"); });
    this.set("gems", profile.gems, (v) => { this.el.gem.textContent = v.toLocaleString("en-US"); });
  }

  wave(main, sub, progress) {
    this.set("wave", main, (v) => { this.el.waveLabel.textContent = v; });
    this.set("waveSub", sub, (v) => { this.el.waveSub.textContent = v; });
    this.el.waveFill.style.width = `${Math.round(progress * 100)}%`;
  }

  kills(n) { this.set("kills", n, (v) => { this.el.kills.textContent = String(v); }); }
  timer(sec) {
    const t = Math.floor(sec);
    const s = `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
    this.set("timer", s, (v) => { this.el.timer.textContent = v; });
  }

  boss(on, name = "", pct = 1) {
    this.el.bossWrap.classList.toggle("on", on);
    if (!on) return;
    this.el.bossName.textContent = name;
    this.el.bossFill.style.width = `${Math.max(0, pct * 100)}%`;
  }

  hitmarker(headshot = false) {
    const el = this.el.hitmarker;
    el.classList.remove("pop", "head");
    void el.offsetWidth;
    el.classList.add("pop");
    if (headshot) el.classList.add("head");
  }

  spread(amount) {
    this.el.crosshair.style.setProperty("--s", `${(8 + amount * 42).toFixed(1)}px`);
  }

  float(text, worldPos, camera, cls = "") {
    const el = document.createElement("div");
    el.className = `float ${cls}`;
    el.textContent = text;
    this.el.floats.appendChild(el);
    this.floatPool.push({ el, worldPos: worldPos.clone(), t: 0, life: 0.9 });
    if (this.floatPool.length > 26) {
      const old = this.floatPool.shift();
      old.el.remove();
    }
  }

  update(dt, camera) {
    for (let i = this.floatPool.length - 1; i >= 0; i--) {
      const f = this.floatPool[i];
      f.t += dt;
      if (f.t >= f.life) { f.el.remove(); this.floatPool.splice(i, 1); continue; }
      _v.copy(f.worldPos);
      _v.y += f.t * 1.2;
      _v.project(camera);
      if (_v.z > 1) { f.el.style.opacity = "0"; continue; }
      const x = (_v.x * 0.5 + 0.5) * innerWidth;
      const y = (-_v.y * 0.5 + 0.5) * innerHeight;
      f.el.style.transform = `translate(-50%,-50%) translate(${x}px,${y}px) scale(${1 + (1 - f.t / f.life) * 0.25})`;
      f.el.style.opacity = String(1 - Math.pow(f.t / f.life, 2));
    }
  }

  toast(text, kind = "info") {
    const el = document.createElement("div");
    el.className = `toast ${kind}`;
    el.textContent = text;
    this.el.toasts.appendChild(el);
    setTimeout(() => { el.classList.add("out"); }, 1900);
    setTimeout(() => el.remove(), 2500);
  }

  hint(text, ms = 4200) {
    clearTimeout(this._hintT);
    this.el.hint.textContent = text;
    this.el.hint.classList.add("on");
    this._hintT = setTimeout(() => this.el.hint.classList.remove("on"), ms);
  }
}
