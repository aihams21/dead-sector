/* الزومبي + المقتنيات (عملات/بلّورات/ذخيرة/إسعاف) */
import * as THREE from "three";
import { ZOMBIE_TYPES, RULES } from "./config.js";
import { resolveCollision, isBlocked } from "./world.js";

const _v = new THREE.Vector3();
const boxGeo = (w, h, d) => new THREE.BoxGeometry(w, h, d);

export class Zombie {
  constructor(typeId, level, quality = "high") {
    const def = ZOMBIE_TYPES[typeId];
    this.type = typeId;
    this.def = def;
    const lv = Number.isFinite(level) && level > 0 ? level : 1;
    this.level = lv;
    this.scale = def.scale;
    this.maxHp = Math.round((def.hp + def.growth * (lv - 1)) * (typeId === "boss" ? 1 : 1));
    this.hp = this.maxHp;
    this.speed = def.speed * (1 + 0.035 * (lv - 1)) * (0.9 + Math.random() * 0.2);
    this.radius = 0.42 * def.scale;
    this.damage = Math.round(def.dmg * (1 + 0.09 * (lv - 1)));
    this.alive = true;
    this.dying = 0;
    this.attackCd = 0;
    this.hitFlash = 0;
    this.growlCd = 1 + Math.random() * 4;
    this.phase = Math.random() * Math.PI * 2;
    this.stagger = 0;

    const g = new THREE.Group();
    const low = quality === "low";
    const bodyMat = new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.92, metalness: 0.02, flatShading: true });
    const skinMat = new THREE.MeshStandardMaterial({ color: def.head, roughness: 0.85, flatShading: true });
    this.mats = [bodyMat, skinMat];

    const torso = new THREE.Mesh(boxGeo(0.62, 0.82, 0.36), bodyMat);
    torso.position.y = 1.18;
    g.add(torso);

    const head = new THREE.Mesh(boxGeo(0.34, 0.36, 0.34), skinMat);
    head.position.y = 1.76;
    g.add(head);

    const jaw = new THREE.Mesh(boxGeo(0.24, 0.09, 0.3), new THREE.MeshBasicMaterial({ color: 0x2a0a0a }));
    jaw.position.set(0, 1.63, 0.16);
    g.add(jaw);

    const eyeMat = new THREE.MeshBasicMaterial({ color: this.type === "boss" ? 0xff2b4d : 0xff5a3c });
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(boxGeo(0.07, 0.05, 0.03), eyeMat);
      eye.position.set(sx * 0.09, 1.8, 0.18);
      g.add(eye);
    }

    this.arms = [];
    for (const sx of [-1, 1]) {
      const arm = new THREE.Mesh(boxGeo(0.17, 0.66, 0.17), skinMat);
      arm.position.set(sx * 0.42, 1.32, 0.16);
      arm.rotation.x = -0.9;
      g.add(arm);
      this.arms.push(arm);
    }

    this.legs = [];
    for (const sx of [-1, 1]) {
      const leg = new THREE.Mesh(boxGeo(0.2, 0.78, 0.2), bodyMat);
      leg.position.set(sx * 0.16, 0.4, 0);
      g.add(leg);
      this.legs.push(leg);
    }

    if (this.type === "brute" || this.type === "boss") {
      const shoulderMat = new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.6, metalness: 0.5 });
      for (const sx of [-1, 1]) {
        const pad = new THREE.Mesh(boxGeo(0.34, 0.2, 0.42), shoulderMat);
        pad.position.set(sx * 0.42, 1.55, 0);
        g.add(pad);
      }
    }

    g.scale.setScalar(def.scale);
    g.rotation.y = Math.random() * Math.PI * 2;
    this.group = g;
    this.head = head;
    this.torso = torso;

    for (const m of [torso, head, ...this.arms, ...this.legs]) {
      m.userData.zombie = this;
      m.userData.part = m === head ? "head" : "body";
    }
    this.hitMeshes = [torso, head, ...this.arms, ...this.legs];
    this.legPhase = 0;
  }

  setPosition(x, z) { this.group.position.set(x, 0, z); }

  update(dt, player, world, zombies) {
    if (!this.alive) {
      if (this.dying > 0) {
        this.dying -= dt;
        const k = Math.max(0, this.dying / 1.1);
        this.group.rotation.x = -(1 - k) * Math.PI * 0.48;
        this.group.position.y = -(1 - k) * 0.55;
        if (this.dying <= 0) this.remove = true;
      }
      return;
    }
    if (this.hitFlash > 0) {
      this.hitFlash -= dt;
      const f = Math.max(0, this.hitFlash / 0.12);
      for (const m of this.mats) m.emissive.setRGB(f * 0.9, f * 0.12, f * 0.1);
    }
    if (this.stagger > 0) { this.stagger -= dt; }

    const p = this.group.position;
    let dx = player.x - p.x, dz = player.z - p.z;
    const dist = Math.hypot(dx, dz) || 0.001;
    dx /= dist; dz /= dist;

    // تباعد بين الزومبي
    let sx = 0, sz = 0;
    for (const o of zombies) {
      if (o === this || !o.alive) continue;
      const ox = p.x - o.group.position.x, oz = p.z - o.group.position.z;
      const d2 = ox * ox + oz * oz;
      const minD = this.radius + o.radius;
      if (d2 < minD * minD && d2 > 0.0001) {
        const d = Math.sqrt(d2);
        sx += (ox / d) * (1 - d / minD);
        sz += (oz / d) * (1 - d / minD);
      }
    }

    const reach = 1.15 + this.radius;
    const stop = dist < reach ? 0 : 1;
    const spd = this.speed * (this.stagger > 0 ? 0.25 : 1);
    p.x += (dx * stop + sx * 1.6) * spd * dt;
    p.z += (dz * stop + sz * 1.6) * spd * dt;
    resolveCollision(world.colliders, p, this.radius, world.bounds);

    // اتجاه
    const targetYaw = Math.atan2(dx, dz);
    let diff = ((targetYaw - this.group.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    this.group.rotation.y += diff * Math.min(1, dt * 6);

    // أنيميشن المشي
    this.legPhase += dt * (3.4 + this.speed * 1.4);
    const sw = Math.sin(this.legPhase) * 0.55;
    if (this.legs[0]) { this.legs[0].rotation.x = sw; this.legs[1].rotation.x = -sw; }
    this.arms[0].rotation.x = -0.9 + Math.sin(this.legPhase * 0.9) * 0.12;
    this.arms[1].rotation.x = -0.9 - Math.sin(this.legPhase * 0.9) * 0.12;
    this.group.position.y = Math.sin(this.legPhase * 2) * 0.035 * this.scale;

    // هجوم
    this.attackCd -= dt;
    if (dist < reach + 0.35 && this.attackCd <= 0) {
      this.attackCd = this.def.atk;
      this.arms[0].rotation.x = -2.0;
      this.arms[1].rotation.x = -2.0;
      return { attack: this.damage };
    }
    return null;
  }

  hit(dmg, part, fromDir) {
    if (!this.alive) return false;
    this.hp -= dmg;
    this.hitFlash = 0.12;
    this.stagger = 0.12;
    if (fromDir) {
      this.group.position.x += fromDir.x * 0.1;
      this.group.position.z += fromDir.z * 0.1;
    }
    if (this.hp <= 0) {
      this.hp = 0;
      this.kill();
      return true;
    }
    return false;
  }

  kill() {
    this.alive = false;
    this.dying = 1.1;
    this.arms[0].rotation.x = -2.4;
    this.arms[1].rotation.x = -2.4;
  }

  dispose(scene) {
    scene.remove(this.group);
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
    for (const m of this.mats) m.dispose();
  }
}

/* ------------------------- المقتنيات ------------------------- */
const PICKUP_STYLE = {
  coin: { color: 0xffc857, geo: () => new THREE.CylinderGeometry(0.17, 0.17, 0.05, 10), value: "coins" },
  gem: { color: 0x4ff0d0, geo: () => new THREE.OctahedronGeometry(0.2, 0), value: "gems" },
  ammo: { color: 0x9fb6c6, geo: () => new THREE.BoxGeometry(0.3, 0.22, 0.2), value: "ammo" },
  medkit: { color: 0xff5d6c, geo: () => new THREE.BoxGeometry(0.28, 0.22, 0.28), value: "medkit" },
  cache: { color: 0xffe9a8, geo: () => new THREE.BoxGeometry(0.4, 0.34, 0.4), value: "cache" },
};

export class Pickup {
  constructor(kind, x, z, amount = 1) {
    const s = PICKUP_STYLE[kind];
    this.kind = kind;
    this.amount = amount;
    this.collected = false;
    this.t = Math.random() * 6;
    const mat = new THREE.MeshStandardMaterial({
      color: s.color, emissive: s.color, emissiveIntensity: kind === "ammo" || kind === "medkit" ? 0.25 : 0.85,
      roughness: 0.35, metalness: 0.6,
    });
    this.mesh = new THREE.Mesh(s.geo(), mat);
    this.mesh.position.set(x, 0.55, z);
    this.mesh.castShadow = false;
    this.baseY = 0.55;
  }

  update(dt, player) {
    if (this.collected) return 0;
    this.t += dt;
    const m = this.mesh;
    m.rotation.y += dt * 2.2;
    m.position.y = this.baseY + Math.sin(this.t * 2.6) * 0.09;
    const dx = player.x - m.position.x, dz = player.z - m.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < RULES.magnetRadius) {
      const pull = (1 - dist / RULES.magnetRadius) * 14;
      m.position.x += (dx / (dist || 1)) * pull * dt;
      m.position.z += (dz / (dist || 1)) * pull * dt;
    }
    if (dist < RULES.pickupRadius) {
      this.collected = true;
      return this.kind;
    }
    return 0;
  }

  dispose(scene) {
    scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}

export function spawnPickup(kind, x, z, amount = 1) {
  return new Pickup(kind, x + (Math.random() - 0.5) * 0.5, z + (Math.random() - 0.5) * 0.5, amount);
}

export { isBlocked };
