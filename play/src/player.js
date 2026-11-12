/* اللاعب: كاميرا منظور أول، حركة، صحة، دروع، تجديد */
import * as THREE from "three";
import { PLAYER_BASE, PERKS } from "./config.js";
import { resolveCollision } from "./world.js";
import { sfx } from "./audio.js";

export class Player {
  constructor(camera, world) {
    this.camera = camera;
    this.world = world;
    this.pos = new THREE.Vector3(0, 0, 8);
    this.vel = new THREE.Vector3();
    this.yaw = Math.PI;
    this.pitch = 0;
    this.vy = 0;
    this.y = 0;
    this.grounded = true;
    this.bobT = 0;
    this.recoilPitch = 0;
    this.maxHp = PLAYER_BASE.hp;
    this.hp = this.maxHp;
    this.armor = 0;
    this.speedMul = 1;
    this.scavenger = 1;
    this.stamina = PLAYER_BASE.staminaMax;
    this.timeSinceHit = 99;
    this.dead = false;
    this.hitFlash = 0;
    this.walkCycle = 0;
  }

  configure(perks = {}, extra = {}) {
    const vit = perks.vitality || 0;
    this.maxHp = PLAYER_BASE.hp + vit * PERKS.vitality.per;
    this.hp = extra.fullHeal ? this.maxHp : Math.min(this.hp || this.maxHp, this.maxHp);
    this.armor = (perks.armor || 0) * PERKS.armor.per;
    this.speedMul = 1 + (perks.agility || 0) * PERKS.agility.per;
    this.scavenger = 1 + (perks.scavenger || 0) * PERKS.scavenger.per;
  }

  reset(x = 0, z = 8) {
    this.pos.set(x, 0, z);
    this.vel.set(0, 0, 0);
    this.vy = 0;
    this.y = 0;
    this.hp = this.maxHp;
    this.stamina = PLAYER_BASE.staminaMax;
    this.dead = false;
    this.timeSinceHit = 99;
    this.yaw = Math.PI;
    this.pitch = 0;
  }

  applyLook(dx, dy) {
    this.yaw -= dx;
    this.pitch -= dy;
    this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
  }

  addRecoil(amount) {
    this.pitch = Math.min(1.45, this.pitch + amount * 0.6);
    this.recoilPitch += amount * 0.25;
  }

  update(dt, input) {
    if (this.dead) return;
    const look = input.consumeLook();
    this.applyLook(look.dx, look.dy);

    const moving = Math.hypot(input.move.x, input.move.y);
    const sprintWanted = input.sprinting && moving > 0.5 && this.stamina > 1;
    let speed = PLAYER_BASE.speed * this.speedMul * (sprintWanted ? PLAYER_BASE.sprintMul : 1);
    if (this.timeSinceHit < 0.35) speed *= 0.72;

    if (sprintWanted) {
      this.stamina = Math.max(0, this.stamina - PLAYER_BASE.staminaDrain * dt);
    } else {
      this.stamina = Math.min(PLAYER_BASE.staminaMax, this.stamina + PLAYER_BASE.staminaRegen * dt);
    }

    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const fwd = { x: -sin, z: -cos };
    const right = { x: cos, z: -sin };
    const desiredX = (fwd.x * input.move.y + right.x * input.move.x) * speed;
    const desiredZ = (fwd.z * input.move.y + right.z * input.move.x) * speed;
    const accel = this.grounded ? 14 : 4;
    this.vel.x += (desiredX - this.vel.x) * Math.min(1, accel * dt);
    this.vel.z += (desiredZ - this.vel.z) * Math.min(1, accel * dt);

    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    resolveCollision(this.world.colliders, this.pos, PLAYER_BASE.radius, this.world.bounds);

    if (input.jumpQueued && this.grounded) {
      this.vy = PLAYER_BASE.jumpVel;
      this.grounded = false;
    }
    input.jumpQueued = false;
    if (!this.grounded) {
      this.vy -= PLAYER_BASE.gravity * dt;
      this.y += this.vy * dt;
      if (this.y <= 0) { this.y = 0; this.vy = 0; this.grounded = true; sfx.step(); }
    }

    // اهتزاز المشي
    const spd = Math.hypot(this.vel.x, this.vel.z);
    this.walkCycle += dt * spd * 1.9;
    const bob = Math.sin(this.walkCycle) * 0.028 * Math.min(1, spd / 5);
    const roll = Math.sin(this.walkCycle * 0.5) * 0.006 * Math.min(1, spd / 5);

    this.timeSinceHit += dt;
    if (this.timeSinceHit > PLAYER_BASE.regenDelay && this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + PLAYER_BASE.regenRate * dt);
    }
    this.hitFlash = Math.max(0, this.hitFlash - dt * 2.2);
    this.recoilPitch = Math.max(0, this.recoilPitch - dt * 2.4);

    this.camera.position.set(this.pos.x, this.y + PLAYER_BASE.eye + bob, this.pos.z);
    this.camera.rotation.set(this.pitch, this.yaw, roll, "YXZ");
    this.camera.rotation.x += this.recoilPitch * 0.4;
  }

  damage(amount, source) {
    if (this.dead) return 0;
    const real = amount * (1 - Math.min(0.55, this.armor));
    this.hp -= real;
    this.timeSinceHit = 0;
    this.hitFlash = 1;
    sfx.hurt();
    if (this.hp <= 0) { this.hp = 0; this.dead = true; }
    return real;
  }

  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
    sfx.heal();
  }
}
