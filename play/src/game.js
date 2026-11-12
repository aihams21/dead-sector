/* محرّك اللعبة: حلقة الرسم، الموجات، القتال، الاقتصاد */
import * as THREE from "three";
import { LEVELS, ZOMBIE_TYPES, RULES, PLAYER_BASE, WEAPONS, WEAPON_BY_ID, PERKS, ENDLESS, statCost, perkCost, MAX_STAT_LEVEL } from "./config.js";
import { storage } from "./storage.js";
import { createWorld, findSpawnPoint } from "./world.js";
import { Zombie, Pickup, spawnPickup } from "./entities.js";
import { WeaponSystem, weaponRuntime } from "./weapons.js";
import { Player } from "./player.js";
import { Input } from "./input.js";
import { HUD } from "./hud.js";
import { UI } from "./ui.js";
import { FX } from "./fx.js";
import { sfx, unlockAudio, setVolume, startAmbient, stopAmbient } from "./audio.js";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* نسخة من المرحلة الأولى بإضاءة أفتح — خلفية القوائم */
const MENU_LEVEL = {
  ...LEVELS[0],
  sky: 0x121c29, fog: 0x1a2836, fogNear: 18, fogFar: 96,
  ambient: 0.62, buildings: 20, props: 24,
  light: 0x9cc4ff,
};

function detectQuality() {
  const coarse = matchMedia("(pointer: coarse)").matches;
  const mem = navigator.deviceMemory || 8;
  if (coarse && mem <= 4) return "low";
  if (coarse) return "medium";
  return "high";
}

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.profile = storage.load();
    this.quality = this.profile.settings.quality === "auto" ? detectQuality() : this.profile.settings.quality;
    this.isMobile = matchMedia("(pointer: coarse)").matches || innerWidth < 820;
    this.state = "menu";
    this.zombies = [];
    this.pickups = [];
    this.levelDef = null;
    this.world = null;
    this.run = null;
    this.wave = null;
    this.shake = 0;
    this.clock = new THREE.Clock();
    this.time = 0;

    this.initThree();
    this.hud = new HUD();
    this.input = new Input(canvas);
    this.input.sensitivity = this.profile.settings.sens;
    this.input.invert = this.profile.settings.invert;
    this.ui = new UI(this.profile, this.hooks());
    this.buildShell();
    this.toMenu();

    document.body.classList.toggle("is-touch", this.input.isTouch);
    addEventListener("resize", () => this.resize());
    document.addEventListener("visibilitychange", () => { if (document.hidden && this.state === "playing") this.pause(); });
    this.resize();
    this.loop();
    this.installDebug();
  }

  hooks() {
    return {
      onOpen: (name) => this.openScreen(name),
      onClose: () => this.openScreen("home"),
      onPlay: (id) => this.startLevel(id),
      onEndless: () => this.startLevel(5, true),
      onBuyWeapon: (id) => this.buyWeapon(id),
      onEquip: (id) => this.equipWeapon(id),
      onUpgradeWeapon: (id, stat) => this.upgradeWeapon(id, stat),
      onBuyPerk: (id) => this.buyPerk(id),
      onResume: () => this.resume(),
      onRestart: () => this.startLevel(this.run?.levelId ?? 1, this.run?.endless),
      onNextLevel: () => this.startLevel(Math.min(5, (this.run?.levelId ?? 1) + 1)),
      onQuit: () => this.toMenu(),
      onReset: () => { this.profile = storage.wipe(); this.ui.setProfile(this.profile); this.toMenu(); },
      onToggleSound: () => {
        const s = this.profile.settings;
        s.sound = s.sound > 0 ? 0 : 0.7;
        setVolume(s.sound);
        this.ui.renderSettings();
        storage.save(this.profile);
      },
      onSettings: (patch) => {
        Object.assign(this.profile.settings, patch);
        if (patch.sens !== undefined) this.input.sensitivity = patch.sens;
        if (patch.sound !== undefined) { setVolume(patch.sound); unlockAudio(); }
        if (patch.invert !== undefined) this.input.invert = patch.invert;
        if (patch.quality) { this.quality = patch.quality === "auto" ? detectQuality() : patch.quality; this.applyQuality(); }
        storage.save(this.profile);
      },
    };
  }

  /* ---------------- three.js ---------------- */
  initThree() {
    const renderer = new THREE.WebGLRenderer({
      canvas: this.canvas, antialias: this.quality !== "low", powerPreference: "high-performance",
      alpha: false, stencil: false,
    });
    renderer.setPixelRatio(Math.min(devicePixelRatio, this.quality === "low" ? 1 : this.quality === "medium" ? 1.4 : 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = this.quality === "high";
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer = renderer;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05070a);
    this.camera = new THREE.PerspectiveCamera(this.isMobile ? 82 : 76, 1, 0.05, 240);
    this.camera.position.set(0, PLAYER_BASE.eye, 12);
    this.scene.add(this.camera);
    this.fx = new FX(this.scene, this.quality);
  }

  applyQuality() {
    this.renderer.shadowMap.enabled = this.quality === "high";
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.quality === "low" ? 1 : this.quality === "medium" ? 1.4 : 2));
    this.renderer.shadowMap.needsUpdate = true;
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  buildShell() {
    this.weapons = new WeaponSystem(this.camera, this.scene, this.fx, this.quality);
    this.player = new Player(this.camera, { colliders: [], bounds: 32 });
    this.raycaster = new THREE.Raycaster();
    this.tmpV = new THREE.Vector3();
    // شاشة البداية: مشهد خفيف
    this.scene.fog = new THREE.Fog(0x05070a, 10, 60);
    this.buildEnvironment(MENU_LEVEL, "menu");
    this.weapons.root.visible = false;
  }

  /* ---------------- الواجهات ---------------- */
  openScreen(name) {
    if (name === "home") { this.ui.renderHome(); this.ui.show("home"); }
    else if (name === "levels") { this.ui.renderLevels(); this.ui.show("levels"); }
    else if (name === "shop") { this.ui.renderShop(); this.ui.show("shop"); }
    else if (name === "upgrades") { this.ui.renderUpgrades(); this.ui.show("upgrades"); }
    else if (name === "settings") { this.ui.renderSettings(); this.ui.show("settings"); }
    else if (name === "rules") { this.ui.renderRules(); this.ui.show("rules"); }
    else { this.ui.show(name); }
  }

  toMenu() {
    this.stopRun();
    if (this.worldKind !== "menu") this.buildEnvironment(MENU_LEVEL, "menu");
    this.state = "menu";
    this.ui.renderHome();
    this.ui.show("home");
    this.ui.refreshHeader();
    this.hud.show(false);
    stopAmbient();
    document.body.classList.remove("playing");
    this.input.enabled = false;
    this.input.unlock();
  }

  /* ---------------- الشراء والتطوير ---------------- */
  pay(coins = 0, gems = 0) {
    if (this.profile.coins < coins || this.profile.gems < gems) return false;
    this.profile.coins -= coins;
    this.profile.gems -= gems;
    storage.save(this.profile);
    return true;
  }

  buyWeapon(id) {
    const w = WEAPON_BY_ID[id];
    if (!w || this.profile.owned.includes(id)) return;
    if (!this.pay(w.cost.coins || 0, w.cost.gems || 0)) { sfx.deny(); this.flashScreen("لا تملك ما يكفي"); return; }
    this.profile.owned.push(id);
    this.profile.weaponStats[id] = { damage: 1, rate: 1, mag: 1, reload: 1 };
    this.profile.equipped = id;
    storage.save(this.profile);
    sfx.buy();
    this.ui.renderShop();
    this.ui.refreshHeader();
  }

  equipWeapon(id) {
    if (!this.profile.owned.includes(id)) return;
    this.profile.equipped = id;
    storage.save(this.profile);
    sfx.buy();
    this.ui.renderShop();
    this.ui.refreshHeader();
    if (this.state === "playing") {
      this.weapons.store();
      this.weapons.equip(id, this.profile.weaponStats[id], this.weapons.ammoPer);
    }
  }

  upgradeWeapon(id, stat) {
    const w = WEAPON_BY_ID[id];
    if (!w || !this.profile.owned.includes(id)) return;
    const st = this.profile.weaponStats[id];
    const lvl = st[stat] || 1;
    if (lvl >= MAX_STAT_LEVEL) return;
    const cost = statCost(w, stat, lvl);
    if (!this.pay(cost)) { sfx.deny(); this.flashScreen("عملات غير كافية"); return; }
    st[stat] = lvl + 1;
    storage.save(this.profile);
    sfx.buy();
    this.ui.renderUpgrades();
    this.ui.refreshHeader();
  }

  buyPerk(key) {
    const perk = PERKS[key];
    if (!perk) return;
    const lvl = this.profile.perks[key] || 0;
    if (lvl >= perk.max) return;
    const cost = perkCost(key, lvl + 1);
    if (!this.pay(cost)) { sfx.deny(); this.flashScreen("عملات غير كافية"); return; }
    this.profile.perks[key] = lvl + 1;
    storage.save(this.profile);
    sfx.buy();
    this.player.configure(this.profile.perks);
    this.ui.renderUpgrades();
    this.ui.refreshHeader();
  }

  flashScreen(text) {
    this.hud.toast(text, "bad");
  }

  /* ---------------- بدء مرحلة ---------------- */
  startLevel(levelId, endless = false) {
    unlockAudio();
    this.stopRun();
    const def = LEVELS[Math.min(LEVELS.length, Math.max(1, levelId)) - 1];
    this.levelDef = def;
    this.endless = endless;
    this.zLevel = endless ? 5 : def.id;
    this.run = {
      levelId: def.id, endless, waveIndex: 0, kills: 0, headshots: 0,
      shots: 0, hits: 0, coins: 0, gems: 0, time: 0, startedAt: performance.now(),
    };
    this.buildEnvironment(def);
    this.player.world = this.world;
    this.player.configure(this.profile.perks, { fullHeal: true });
    this.player.reset(0, 14);
    this.player.yaw = 0;
    this.weapons.equip(this.profile.equipped, this.profile.weaponStats[this.profile.equipped], {});
    this.weapons.refillAll(this.profile, true);
    this.weapons.equip(this.profile.equipped, this.profile.weaponStats[this.profile.equipped], this.weapons.ammoPer);
    this.weapons.root.visible = true;

    this.state = "playing";
    this.ui.hide();
    this.hud.show(true);
    this.hud.boss(false);
    document.body.classList.add("playing");
    this.input.reset();
    this.input.enabled = true;
    setVolume(this.profile.settings.sound);
    startAmbient(def.id === 2 ? "subway" : def.id === 5 ? "lab" : "city");
    this.waveIndex = 0;
    this.wave = null;
    this.waveGap = 1.6;
    this.zombies.length = 0;
    this.pickups.length = 0;
    this.fx.reset();
    this.hud.toast(`${def.nameAr} — ${def.name}`, "good");
    this.hud.hint(this.input.isTouch ? "العصا للحركة · اسحب لليمين للنظر · زر النار للقتال" : "WASD للحركة · الفأرة للتصويب · زر الفأرة للإطلاق · R للتلقيم");
    this.openScreenClear();
    /* آخر خطوة: أي فشل في قفل المؤشر ما بيوقف تهيئة المرحلة */
    this.input.lockPointer();
  }

  openScreenClear() {
    this.ui.hide();
  }

  buildEnvironment(def, kind = "level") {
    if (this.world) {
      this.scene.remove(this.world.group);
      this.world.dispose?.();
    }
    this.worldKind = kind;
    this.world = createWorld(def, this.quality);
    this.scene.add(this.world.group);
    this.scene.background = new THREE.Color(def.sky);
    this.scene.fog = new THREE.Fog(def.fog, def.fogNear, def.fogFar);
  }

  stopRun() {
    for (const z of this.zombies) z.dispose(this.scene);
    this.zombies.length = 0;
    for (const p of this.pickups) p.dispose(this.scene);
    this.pickups.length = 0;
    this.fx?.reset();
    if (this.weapons) this.weapons.root.visible = false;
    this.state = "menu";
    this.input.enabled = false;
    stopAmbient();
  }

  /* ---------------- الموجات ---------------- */
  buildWave() {
    if (this.endless) {
      const n = this.waveIndex + 1;
      const counts = { walker: ENDLESS.baseCount + n * 2, runner: n >= 2 ? 4 + n * 2 : 0, brute: Math.floor(n / 2) };
      if (n % 5 === 0) counts.boss = 1 + Math.floor(n / 15);
      return { counts, rate: Math.max(0.55, 1.5 - n * 0.05), bossWave: n % 5 === 0 };
    }
    const def = this.levelDef.waves[this.waveIndex];
    if (!def) return null;
    const counts = {};
    for (const [k, v] of Object.entries(def)) {
      if (k === "rate" || k === "bossWave") continue;
      counts[k] = v;
    }
    return { counts, rate: def.rate, bossWave: !!def.bossWave };
  }

  startWave() {
    const w = this.buildWave();
    if (!w) { this.endRun(true); return; }
    const queue = [];
    for (const [type, count] of Object.entries(w.counts)) {
      for (let i = 0; i < count; i++) queue.push(type);
    }
    // خلط
    for (let i = queue.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }
    this.wave = {
      queue, total: queue.length, spawned: 0, killed: 0, rate: w.rate,
      spawnTimer: 0.4, bossWave: w.bossWave, active: true, gap: 0,
      index: this.waveIndex,
    };
    this.run.waveIndex = this.waveIndex;
    this.zLevel = this.endless ? Math.min(30, 5 + this.waveIndex * 0.9) : this.levelDef.id;
    sfx.waveStart();
    this.hud.toast(w.bossWave ? "موجة الزعيم — استعد" : `الموجة ${this.waveIndex + 1}`, w.bossWave ? "bad" : "info");
  }

  spawnZombie(type) {
    const z = new Zombie(type, this.zLevel, this.quality);
    const p = this.player.pos;
    const sp = findSpawnPoint(this.world.colliders, p, this.world.bounds, 17, 27);
    z.setPosition(sp.x, sp.z);
    this.scene.add(z.group);
    this.zombies.push(z);
    if (type === "boss") {
      this.hud.boss(true, `الوحش — موجة ${this.waveIndex + 1}`, 1);
      this.shake = 0.5;
    }
  }

  maxAlive() {
    return this.input.isTouch ? RULES.maxZombiesAliveMobile : RULES.maxZombiesAlive;
  }

  updateWaves(dt) {
    if (!this.wave) {
      this.waveGap -= dt;
      if (this.waveGap <= 0) this.startWave();
      else this.hud.wave(`الموجة ${this.waveIndex + 1} / ${this.endless ? "∞" : this.levelDef.waves.length}`, `تبدأ بعد ${Math.ceil(this.waveGap)} ثانية`, 0);
      return;
    }
    const w = this.wave;
    if (!w.active) return;

    if (w.queue.length > 0) {
      w.spawnTimer -= dt;
      const alive = this.zombies.filter((z) => z.alive).length;
      if (w.spawnTimer <= 0 && alive < this.maxAlive()) {
        this.spawnZombie(w.queue.shift());
        w.spawned++;
        w.spawnTimer = w.rate * (0.75 + Math.random() * 0.6);
      }
    }

    const remaining = w.queue.length + this.zombies.filter((z) => z.alive).length;
    const done = w.total - remaining;
    const isBossWave = w.bossWave;
    this.hud.wave(
      `${this.endless ? "الموجة" : "الموجة"} ${this.waveIndex + 1} / ${this.endless ? "∞" : this.levelDef.waves.length}`,
      remaining > 0 ? `${remaining} هدف متبقّي` : "المنطقة نظيفة",
      w.total ? done / w.total : 0
    );

    if (w.queue.length === 0 && remaining === 0) {
      w.active = false;
      const bonus = RULES.waveClearBonus(this.levelDef.id) * (this.endless ? ENDLESS.coinMul : 1);
      this.awardCoins(Math.round(bonus), null, "مكافأة موجة");
      this.profile.stats.waves++;
      this.hud.boss(false);
      sfx.waveStart();
      if (this.endless) {
        this.waveIndex++;
        this.waveGap = 3.4;
        this.wave = null;
        this.profile.progress.bestEndless = Math.max(this.profile.progress.bestEndless, this.waveIndex);
        this.hud.toast(`موجة ${this.waveIndex} أُنجزت`, "good");
        this.awardGems(this.waveIndex % 5 === 0 ? 1 : 0, null);
      } else if (this.waveIndex + 1 >= this.levelDef.waves.length) {
        this.endRun(true);
      } else {
        this.waveIndex++;
        this.waveGap = RULES.waveGap;
        this.wave = null;
      }
    } else if (isBossWave) {
      const boss = this.zombies.find((z) => z.alive && z.type === "boss");
      if (boss) this.hud.boss(true, `الوحش — صحة ${Math.ceil((boss.hp / boss.maxHp) * 100)}%`, boss.hp / boss.maxHp);
    }
  }

  awardCoins(amount, pos, label) {
    if (amount <= 0) return;
    const scaled = Math.round(amount * this.player.scavenger);
    this.profile.coins += scaled;
    if (this.run) this.run.coins += scaled;
    this.hud.economy(this.profile);
    if (label) this.hud.toast(`${label} +${scaled} ₡`, "good");
    if (pos) this.hud.float(`+${scaled} ₡`, pos, this.camera, "coin");
  }

  awardGems(amount, pos) {
    if (amount <= 0) return;
    this.profile.gems += amount;
    if (this.run) this.run.gems += amount;
    this.hud.economy(this.profile);
    sfx.gem();
    if (pos) this.hud.float(`+${amount} ✦`, pos, this.camera, "gem");
  }

  /* ---------------- القتال ---------------- */
  shoot(now) {
    const shot = this.weapons.tryFire(now, this.input.fire);
    if (!shot) return;
    this.player.addRecoil(this.weapons.consumeRecoil());
    this.shake = Math.min(0.32, this.shake + shot.rt.def.kick * 0.8);
    const meshes = [];
    for (const z of this.zombies) if (z.alive) meshes.push(...z.hitMeshes);
    let anyHit = false;
    for (const dir of shot.dirs) {
      this.raycaster.set(shot.origin, dir);
      this.raycaster.far = shot.rt.range;
      const hits = this.raycaster.intersectObjects(meshes, false);
      const pierced = [];
      let endPoint = shot.origin.clone().addScaledVector(dir, shot.rt.range);
      let count = 0;
      for (const h of hits) {
        const z = h.object.userData.zombie;
        if (!z || !z.alive || pierced.includes(z)) continue;
        pierced.push(z);
        const isHead = h.object.userData.part === "head";
        let dmg = shot.rt.damage * (isHead ? shot.rt.headMult : 1);
        const falloff = 1 - clamp((h.distance - 18) / 90, 0, 0.35);
        dmg *= falloff;
        z.hit(dmg, h.object.userData.part, dir);
        anyHit = true;
        this.fx.burst(h.point, 0x9b1c1c, isHead ? 16 : 9, { speed: isHead ? 7 : 5, size: 0.16, life: 0.55, dir });
        this.hud.float(`${Math.round(dmg)}`, h.point, this.camera, isHead ? "head" : "");
        if (isHead) {
          this.run.headshots++;
          this.awardCoins(RULES.coinPerHeadshot, null);
          sfx.headshot();
          this.hud.hitmarker(true);
        } else {
          sfx.hit();
          this.hud.hitmarker(false);
        }
        if (z.alive === false) this.onKill(z, h.point);
        if (count === 0) endPoint = h.point.clone();
        count++;
        if (count > shot.rt.pierce) break;
      }
      this.fx.tracer(this.weapons.getMuzzleWorld(), endPoint, shot.rt.def.glow || 0xffd9a0);
      // أثر على الأرض/الجدار عند عدم الإصابة
      if (hits.length === 0) {
        const groundHit = new THREE.Vector3().copy(shot.origin).addScaledVector(dir, shot.rt.range);
        if (groundHit.y < 0.1) {
          this.fx.burst(new THREE.Vector3(groundHit.x, 0.08, groundHit.z), 0x6a6a5c, 4, { speed: 2.5, size: 0.1, life: 0.4 });
        }
      }
    }
    this.run.shots++;
    if (anyHit) this.run.hits++;
    this.hud.ammo(this.weapons);
  }

  onKill(z, point) {
    const def = z.def;
    this.run.kills++;
    this.profile.stats.kills++;
    sfx.kill();
    this.hud.kills(this.run.kills);
    if (this.isMobile) this.hud.hitmarker(false);

    const coinValue = Math.round(def.coins * (1 + this.zLevel * 0.12) * (this.endless ? ENDLESS.coinMul : 1));
    const direct = point ? coinValue : coinValue;
    this.awardCoins(direct, point);
    // عملات متطايرة
    const drops = z.type === "boss" ? 9 : z.type === "brute" ? 4 : Math.random() > 0.45 ? 1 : 0;
    for (let i = 0; i < drops; i++) {
      const p = new Pickup("coin", z.group.position.x, z.group.position.z, Math.max(2, Math.round(coinValue * 0.4)));
      p.mesh.position.x += (Math.random() - 0.5) * 2.2;
      p.mesh.position.z += (Math.random() - 0.5) * 2.2;
      this.scene.add(p.mesh);
      this.pickups.push(p);
    }
    if (def.gems > 0) this.awardGems(def.gems, point);
    if (z.type === "boss") {
      this.hud.boss(false);
      this.shake = 0.6;
      this.hud.toast("الزعيم سقط", "good");
      for (let i = 0; i < 10; i++) this.fx.burst(z.group.position.clone().setY(1.4), 0xff3b5c, 6, { speed: 8, size: 0.3, life: 1.1 });
    }
    // إسقاطات
    const r = Math.random();
    if (r < RULES.ammoCrateChance) this.dropPickup("ammo", z.group.position);
    else if (r < RULES.ammoCrateChance + RULES.medkitChance) this.dropPickup("medkit", z.group.position);
    else if (r < RULES.ammoCrateChance + RULES.medkitChance + RULES.gemCacheChance) this.dropPickup("cache", z.group.position);
  }

  dropPickup(kind, pos) {
    const p = spawnPickup(kind, pos.x, pos.z);
    this.scene.add(p.mesh);
    this.pickups.push(p);
  }

  collect(kind, pickup) {
    const pos = pickup.mesh.position.clone();
    if (kind === "coin") { this.awardCoins(pickup.amount, pos); sfx.coin(); }
    else if (kind === "ammo") { this.weapons.addReserve(RULES.ammoCrateRestore); this.hud.toast("ذخيرة +", "info"); sfx.reloadEnd(); }
    else if (kind === "medkit") { this.player.heal(RULES.medkitHeal); this.hud.toast(`صحة +${RULES.medkitHeal}`, "good"); }
    else if (kind === "cache") { this.awardGems(1, pos); }
    this.hud.economy(this.profile);
    this.hud.ammo(this.weapons);
  }

  /* ---------------- الحلقة ---------------- */
  loop() {
    requestAnimationFrame(() => this.loop());
    const dt = Math.min(0.05, this.clock.getDelta());
    this.time += dt;
    if (this.state === "playing") this.update(dt);
    else if (this.state === "menu") this.updateMenuScene(dt);
    else this.fx.update(dt * 0.4);
    this.world?.update?.(dt, this.time);
    this.renderer.render(this.scene, this.camera);
  }

  updateMenuScene(dt) {
    // كاميرا تدور ببطء داخل الساحة خلف القوائم
    const a = this.time * 0.06;
    const r = 7.2;
    this.camera.position.set(Math.sin(a) * r, 2.45 + Math.sin(this.time * 0.5) * 0.06, Math.cos(a) * r);
    this.tmpV.set(Math.sin(a + Math.PI) * 6, 2.0, Math.cos(a + Math.PI) * 6);
    this.camera.lookAt(this.tmpV);
    this.fx.update(dt);
  }

  update(dt) {
    const now = performance.now() / 1000;
    this.run.time += dt;
    if (this.input.pausedRequested) { this.input.reset(); this.pause(); return; }

    this.input.update();
    this.player.update(dt, this.input);

    if (this.input.reloadQueued) { this.input.reloadQueued = false; this.weapons.startReload(); }
    if (this.input.switchQueued) { this.input.switchQueued = 0; this.cycleWeapon(); }
    if (this.input.slotQueued !== null) {
      const idx = this.input.slotQueued;
      this.input.slotQueued = null;
      const owned = this.profile.owned;
      if (idx >= 0 && idx < owned.length) this.equipInRun(owned[idx]);
    }
    if (this.player.dead) { this.endRun(false); return; }

    this.shoot(now);

    const moving = Math.hypot(this.player.vel.x, this.player.vel.z) / (PLAYER_BASE.speed * this.player.speedMul);
    this.weapons.update(dt, { moving, sprinting: this.input.sprinting, grounded: this.player.grounded });

    // الزومبي
    let aliveBoss = null;
    for (let i = this.zombies.length - 1; i >= 0; i--) {
      const z = this.zombies[i];
      const res = z.update(dt, this.player.pos, this.world, this.zombies);
      if (res?.attack) {
        this.player.damage(res.attack, z);
        this.shake = Math.min(0.6, this.shake + 0.25);
        this.hud.vitals(this.player);
        if (this.player.dead) { this.endRun(false); return; }
      }
      if (z.type === "boss" && z.alive) aliveBoss = z;
      if (z.remove) { z.dispose(this.scene); this.zombies.splice(i, 1); }
    }
    if (!aliveBoss && this.wave?.bossWave) this.hud.boss(false);

    // المقتنيات
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      const kind = p.update(dt, this.player.pos);
      if (kind) { this.collect(kind, p); p.dispose(this.scene); this.pickups.splice(i, 1); }
    }

    this.updateWaves(dt);
    this.fx.update(dt);

    // اهتزاز الكاميرا
    this.shake = Math.max(0, this.shake - dt * 2.2);
    if (this.shake > 0.001) {
      const s = this.shake * 0.03;
      this.camera.rotation.x += (Math.random() - 0.5) * s;
      this.camera.rotation.y += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s * 0.6;
    }

    this.hud.vitals(this.player);
    this.hud.ammo(this.weapons);
    this.hud.economy(this.profile);
    this.hud.kills(this.run.kills);
    this.hud.timer(this.run.time);
    this.hud.spread(this.weapons.reloading > 0 ? 0.5 : Math.min(0.6, this.weapons.rt.spread * 6));
    this.hud.update(dt, this.camera);
  }

  cycleWeapon() {
    const owned = this.profile.owned;
    if (owned.length < 2) return;
    const i = owned.indexOf(this.weapons.currentId);
    this.equipInRun(owned[(i + 1) % owned.length]);
  }

  equipInRun(id) {
    if (!this.profile.owned.includes(id) || this.weapons.currentId === id) return;
    this.weapons.store();
    this.weapons.equip(id, this.profile.weaponStats[id], this.weapons.ammoPer);
    this.hud.ammo(this.weapons);
    sfx.reloadEnd();
  }

  /* ---------------- الإيقاف والنتائج ---------------- */
  pause() {
    if (this.state !== "playing") return;
    this.state = "paused";
    this.input.enabled = false;
    this.input.unlock();
    this.ui.show("pause");
    this.ui.refreshHeader();
    document.querySelectorAll("#pause-wallet").forEach((el) => {
      el.innerHTML = `<span class="pill coin">₡ ${this.profile.coins.toLocaleString("en-US")}</span><span class="pill gem">✦ ${this.profile.gems.toLocaleString("en-US")}</span>`;
    });
  }

  resume() {
    if (this.state !== "paused") return;
    this.state = "playing";
    this.ui.hide();
    this.input.enabled = true;
    this.input.reset();
    document.body.classList.add("playing");
    this.input.lockPointer();
  }

  endRun(win) {
    if (this.state === "result") return;
    this.state = "result";
    this.input.enabled = false;
    this.input.unlock();
    this.hud.show(false);
    stopAmbient();
    document.body.classList.remove("playing");

    const r = this.run;
    if (!r) return;
    this.profile.stats.playtime += r.time;
    this.profile.stats.runs++;
    if (win) {
      r.coins += this.levelDef.reward.coins;
      r.gems += this.levelDef.reward.gems;
      this.profile.coins += this.levelDef.reward.coins;
      this.profile.gems += this.levelDef.reward.gems;
      if (!this.endless) {
        this.profile.progress.cleared = Math.max(this.profile.progress.cleared, r.levelId);
        this.profile.progress.unlocked = Math.max(this.profile.progress.unlocked, Math.min(5, r.levelId + 1));
      }
      sfx.levelWin();
    } else {
      sfx.levelLose();
    }
    storage.save(this.profile);

    const acc = r.shots ? Math.round((r.hits / r.shots) * 100) : 0;
    this.ui.renderResult({
      win, levelName: this.levelDef?.nameAr || "", wave: this.waveIndex + 1,
      waves: this.endless ? "∞" : (this.levelDef?.waves.length || 1),
      kills: r.kills, headshots: r.headshots, coins: r.coins, gems: r.gems,
      accuracy: acc, xp: r.kills * 10 + r.headshots * 5,
      time: `${String(Math.floor(r.time / 60)).padStart(2, "0")}:${String(Math.floor(r.time % 60)).padStart(2, "0")}`,
      hasNext: !this.endless && r.levelId < 5,
    });
    this.ui.show("result");
    this.ui.refreshHeader();
  }

  /* ---------------- أدوات ---------------- */
  installDebug() {
    window.__DS = {
      game: this,
      get state() { return window.__DS.game.state; },
      start: (id = 1, endless = false) => this.startLevel(id, endless),
      spawn: (type = "walker", n = 3) => { for (let i = 0; i < n; i++) this.spawnZombie(type); },
      coins: (n) => { this.profile.coins += n; this.hud.economy(this.profile); },
      god: () => { this.player.damage = () => 0; },
      skipWave: () => { if (this.wave) { this.wave.queue.length = 0; this.zombies.forEach((z) => z.kill()); } },
      hud: this.hud,
    };
  }
}
