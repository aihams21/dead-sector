/* نظام الأسلحة: نموذج بمنظور الشخص الأول + إطلاق + تلقيم + ارتداد */
import * as THREE from "three";
import { WEAPONS, WEAPON_BY_ID, WEAPON_STATS } from "./config.js";
import { sfx } from "./audio.js";

export function weaponRuntime(def, stats = {}) {
  const d = stats.damage ?? 1, r = stats.rate ?? 1, m = stats.mag ?? 1, l = stats.reload ?? 1;
  return {
    def,
    damage: def.damage * (1 + WEAPON_STATS.damage.per * (d - 1)),
    interval: 60 / def.rpm / (1 + WEAPON_STATS.rate.per * (r - 1)),
    magSize: Math.round(def.mag * (1 + WEAPON_STATS.mag.per * (m - 1))),
    reloadTime: def.reload * Math.max(0.45, 1 - WEAPON_STATS.reload.per * (l - 1)),
    spread: def.spread,
    pellets: def.pellets,
    headMult: def.headMult,
    pierce: def.pierce,
    range: def.range,
  };
}

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.55, ...opts });
}

function buildModel(def) {
  const g = new THREE.Group();
  const bodyM = mat(def.body);
  const accentM = mat(def.accent, { metalness: 0.8, roughness: 0.35 });
  const darkM = mat(0x15181c, { metalness: 0.4 });

  const add = (w, h, d, x, y, z, material, rx = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x, y, z);
    m.rotation.x = rx;
    g.add(m);
    return m;
  };

  const long = def.id === "railgun" ? 1.15 : def.id === "lmg" || def.id === "hellfire" ? 1.0 : def.id === "rifle" ? 0.92 : def.id === "shotgun" ? 0.85 : 0.6;
  add(0.11, 0.14, 0.5, 0, 0, 0, bodyM);                     // جسم
  add(0.075, 0.075, long * 0.62, 0, 0.035, -0.3 - long * 0.2, accentM); // ماسورة
  add(0.1, 0.1, 0.12, 0, 0.05, -0.36 - long * 0.42, darkM);  // فوهة
  add(0.09, 0.2, 0.13, 0, -0.16, 0.02, darkM, 0.18);         // مقبض
  add(0.07, 0.06, 0.2, 0, 0.11, -0.02, darkM);               // منظار

  if (def.id === "smg" || def.id === "rifle" || def.id === "lmg" || def.id === "hellfire") {
    add(0.07, 0.24, 0.12, 0, -0.2, -0.16, accentM, -0.12);   // مخزن
  }
  if (def.id === "shotgun") {
    add(0.09, 0.09, 0.42, 0, -0.02, -0.42, darkM);           // مخزن أنبوبي
  }
  if (def.id === "lmg" || def.id === "hellfire") {
    add(0.14, 0.16, 0.22, 0, -0.02, 0.18, darkM);            // صندوق ذخيرة
    add(0.05, 0.05, 0.5, 0, 0.09, -0.5, accentM);
  }
  if (def.id === "railgun") {
    add(0.05, 0.05, 0.9, 0, 0.1, -0.5, accentM);
    const coil = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.018, 6, 12), new THREE.MeshBasicMaterial({ color: def.glow || 0x39f7d8 }));
    coil.position.set(0, 0.035, -0.62);
    g.add(coil);
    g.userData.coil = coil;
  }
  if (def.id === "hellfire") {
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.34, 8), darkM);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.035, -0.62);
    g.add(barrel);
  }

  // يدين
  const handM = mat(0x2c2a28, { metalness: 0.05, roughness: 0.9 });
  add(0.1, 0.12, 0.13, 0.02, -0.15, 0.03, handM);
  add(0.1, 0.1, 0.16, -0.03, -0.1, -0.32, handM);

  g.userData.basePos = new THREE.Vector3(0.26, -0.24, -0.5);
  g.position.copy(g.userData.basePos);
  return g;
}

export class WeaponSystem {
  constructor(camera, scene, fx, quality = "high") {
    this.camera = camera;
    this.scene = scene;
    this.fx = fx;
    this.quality = quality;
    this.root = new THREE.Group();
    camera.add(this.root);
    this.models = {};
    for (const w of WEAPONS) {
      const m = buildModel(w);
      m.visible = false;
      this.root.add(m);
      this.models[w.id] = m;
    }
    this.rt = null;
    this.ammo = 0;
    this.reserve = 0;
    this.nextShot = 0;
    this.reloading = 0;
    this.reloadTotal = 0;
    this.recoil = 0;
    this.recoilPitch = 0;
    this.kick = 0;
    this.switchT = 0;
    this.bobT = 0;
    this.flashT = 0;
    this.muzzleLight = new THREE.PointLight(0xffc98a, 0, 12, 2);
    this.muzzleLight.position.set(0.28, -0.18, -1.2);
    camera.add(this.muzzleLight);
    this.flashSprite = new THREE.Mesh(
      new THREE.PlaneGeometry(0.5, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    this.flashSprite.position.set(0.2, -0.12, -1.05);
    camera.add(this.flashSprite);
    this.eventMesh = null;
  }

  equip(id, stats, keepAmmo = {}) {
    const def = WEAPON_BY_ID[id];
    if (!def) return;
    this.rt = weaponRuntime(def, stats);
    for (const key in this.models) this.models[key].visible = key === id;
    this.model = this.models[id];
    this.currentId = id;
    if (keepAmmo[id]) {
      this.ammo = keepAmmo[id].ammo;
      this.reserve = keepAmmo[id].reserve;
    } else {
      this.ammo = this.rt.magSize;
      this.reserve = Math.round(def.reserve * 0.6);
    }
    this.reloading = 0;
    this.switchT = 0.32;
    this.nextShot = 0;
  }

  refillAll(profile, full = true) {
    this.ammoPer = {};
    for (const id of profile.owned) {
      const rt = weaponRuntime(WEAPON_BY_ID[id], profile.weaponStats[id]);
      this.ammoPer[id] = { ammo: rt.magSize, reserve: Math.round(WEAPON_BY_ID[id].reserve * (full ? 1 : 0.5)) };
    }
    if (this.currentId && this.ammoPer[this.currentId]) {
      this.ammo = this.ammoPer[this.currentId].ammo;
      this.reserve = this.ammoPer[this.currentId].reserve;
    }
  }

  store() {
    if (!this.currentId) return;
    this.ammoPer = this.ammoPer || {};
    this.ammoPer[this.currentId] = { ammo: this.ammo, reserve: this.reserve };
  }

  addReserve(frac) {
    if (!this.rt) return;
    const max = WEAPON_BY_ID[this.currentId].reserve;
    this.reserve = Math.min(max, this.reserve + Math.round(max * frac));
  }

  get isReloading() { return this.reloading > 0; }

  startReload() {
    if (!this.rt || this.reloading > 0) return false;
    if (this.ammo >= this.rt.magSize) return false;
    if (this.reserve <= 0) return false;
    this.reloading = this.rt.reloadTime;
    this.reloadTotal = this.rt.reloadTime;
    sfx.reloadStart();
    return true;
  }

  tryFire(now, triggerDown) {
    if (!this.rt || this.reloading > 0 || this.switchT > 0.12) return null;
    if (!triggerDown) return null;
    if (now < this.nextShot) return null;
    if (this.ammo <= 0) {
      if (now > this.nextShot) { sfx.empty(); this.nextShot = now + 0.3; }
      return null;
    }
    this.nextShot = now + this.rt.interval;
    this.ammo--;
    sfx.shoot(this.currentId);
    this.kick = 1;
    this.flashT = 0.065;
    this.recoilPitch = Math.min(0.055, 0.012 + this.rt.def.kick * 0.28);
    const dirs = [];
    const baseDir = new THREE.Vector3();
    this.camera.getWorldDirection(baseDir);
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(baseDir, up).normalize();
    const realUp = new THREE.Vector3().crossVectors(right, baseDir).normalize();
    const origin = this.camera.getWorldPosition(new THREE.Vector3());
    const spreadMul = this.rt.def.id === "shotgun" ? 1 : 1;
    for (let i = 0; i < this.rt.pellets; i++) {
      const sp = this.rt.spread * spreadMul;
      const a = (Math.random() - 0.5) * sp * 2;
      const b = (Math.random() - 0.5) * sp * 2;
      const d = baseDir.clone()
        .addScaledVector(right, a)
        .addScaledVector(realUp, b)
        .normalize();
      dirs.push(d);
    }
    if (this.ammo === 0) setTimeout(() => this.startReload(), 260);
    return { origin, dirs, rt: this.rt, muzzle: this.getMuzzleWorld() };
  }

  getMuzzleWorld() {
    const v = new THREE.Vector3(0.2, -0.1, -1.0);
    return this.camera.localToWorld(v);
  }

  update(dt, { moving = 0, sprinting = false, grounded = true } = {}) {
    if (!this.rt || !this.model) return;
    if (this.reloading > 0) {
      this.reloading -= dt;
      const k = 1 - this.reloading / this.reloadTotal;
      this.model.rotation.x = Math.sin(Math.PI * Math.min(1, k)) * 0.55 - 0.05;
      this.model.position.y = this.model.userData.basePos.y - Math.sin(Math.PI * k) * 0.16;
      if (this.reloading <= 0) {
        const need = this.rt.magSize - this.ammo;
        const take = Math.min(need, this.reserve);
        this.ammo += take;
        this.reserve -= take;
        this.model.rotation.x = 0;
        this.model.position.y = this.model.userData.basePos.y;
        sfx.reloadEnd();
      }
    }
    if (this.switchT > 0) this.switchT = Math.max(0, this.switchT - dt);
    this.bobT += dt * (sprinting ? 11 : 6.5) * (moving > 0.1 ? 1 : 0.25);
    const bobAmt = (moving > 0.1 ? (sprinting ? 0.022 : 0.013) : 0.004) * (grounded ? 1 : 0.3);
    this.recoil = Math.max(0, this.recoil - dt * 7);
    this.kick = Math.max(0, this.kick - dt * 9);
    const sway = Math.sin(this.bobT) * bobAmt;
    const swayY = Math.cos(this.bobT * 2) * bobAmt * 0.8;
    const base = this.model.userData.basePos;
    const switchDrop = this.switchT > 0 ? (this.switchT / 0.32) * 0.35 : 0;
    this.model.position.set(
      base.x + sway * 1.6,
      base.y + swayY - switchDrop,
      base.z + this.kick * 0.09
    );
    this.model.rotation.set(this.kick * 0.22, sway * 0.5, sway * 0.4);
    if (this.model.userData.coil) {
      this.model.userData.coil.material.color.setHex(0x39f7d8);
    }
    this.flashT = Math.max(0, this.flashT - dt);
    const on = this.flashT > 0;
    this.muzzleLight.intensity = on ? 26 : 0;
    this.flashSprite.material.opacity = on ? 0.85 : 0;
    this.flashSprite.scale.setScalar(on ? 0.7 + Math.random() * 0.5 : 0.1);
    this.flashSprite.rotation.z = Math.random() * 6.28;
  }

  consumeRecoil() {
    const r = this.recoilPitch;
    this.recoilPitch = 0;
    return r;
  }

  dispose() {
    this.camera.remove(this.root);
    this.camera.remove(this.muzzleLight);
    this.camera.remove(this.flashSprite);
  }
}
