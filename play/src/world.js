/* بناء المرحلة: أرضية، مبانٍ، حواجز، إضاءة، أجواء */
import * as THREE from "three";

const ARENA = 34; // نصف طول الساحة

function canvasTex(w, h, draw, repeat = 1) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d");
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function groundTexture(base) {
  const col = new THREE.Color(base);
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = `#${col.getHexString()}`;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 5200; i++) {
      const a = Math.random() * 0.16;
      g.fillStyle = Math.random() > 0.5 ? `rgba(255,255,255,${a * 0.5})` : `rgba(0,0,0,${a})`;
      const s = Math.random() * 3 + 1;
      g.fillRect(Math.random() * w, Math.random() * h, s, s);
    }
    g.strokeStyle = "rgba(0,0,0,0.35)";
    for (let i = 0; i < 16; i++) {
      g.beginPath();
      let x = Math.random() * w, y = Math.random() * h;
      g.moveTo(x, y);
      for (let j = 0; j < 5; j++) {
        x += (Math.random() - 0.5) * 70;
        y += (Math.random() - 0.5) * 70;
        g.lineTo(x, y);
      }
      g.lineWidth = Math.random() * 1.6;
      g.stroke();
    }
  }, 9);
}

function facadeTexture(tint) {
  const base = new THREE.Color(tint);
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = `#${base.getHexString()}`;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2400; i++) {
      g.fillStyle = `rgba(0,0,0,${Math.random() * 0.35})`;
      g.fillRect(Math.random() * w, Math.random() * h, 3, 3);
    }
    // نوافذ
    const cols = 4, rows = 6;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const lit = Math.random() > 0.78;
        const x = 14 + c * 60, y = 12 + r * 40;
        g.fillStyle = lit ? (Math.random() > 0.5 ? "#ffd9a0" : "#9fd8ff") : "#0a0d10";
        g.globalAlpha = lit ? 0.75 : 0.85;
        g.fillRect(x, y, 30, 22);
        g.globalAlpha = 1;
      }
    }
    g.strokeStyle = "rgba(0,0,0,0.5)";
    g.lineWidth = 2;
    g.strokeRect(0, 0, w, h);
  }, 1);
}

export function createWorld(level, quality) {
  const group = new THREE.Group();
  const colliders = [];
  const obstacles = [];
  const rng = mulberry32(level.id * 977 + 13);

  // إضاءة
  const hemi = new THREE.HemisphereLight(level.light, 0x0a0c10, level.ambient);
  group.add(hemi);
  const sun = new THREE.DirectionalLight(level.light, quality === "low" ? 0.7 : 1.0);
  sun.position.set(-18, 34, 12);
  if (quality !== "low") {
    sun.castShadow = true;
    sun.shadow.mapSize.set(quality === "high" ? 2048 : 1024, quality === "high" ? 2048 : 1024);
    const d = 42;
    sun.shadow.camera.left = -d; sun.shadow.camera.right = d;
    sun.shadow.camera.top = d; sun.shadow.camera.bottom = -d;
    sun.shadow.camera.far = 110;
    sun.shadow.bias = -0.0015;
  }
  group.add(sun);
  const rim = new THREE.PointLight(level.light, 14, 60, 2);
  rim.position.set(0, 16, -20);
  group.add(rim);

  // أرضية
  const gTex = groundTexture(level.ground);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(ARENA * 2.6, ARENA * 2.6, 1, 1),
    new THREE.MeshStandardMaterial({ map: gTex, roughness: 0.94, metalness: 0.05 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = quality !== "low";
  group.add(ground);

  // جدار الساحة
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x14181d, roughness: 0.9, metalness: 0.15 });
  const wallH = 6.2;
  const wallDefs = [
    [0, -ARENA - 1, ARENA * 2 + 4, 2], [0, ARENA + 1, ARENA * 2 + 4, 2],
    [-ARENA - 1, 0, 2, ARENA * 2 + 4], [ARENA + 1, 0, 2, ARENA * 2 + 4],
  ];
  for (const [x, z, w, d] of wallDefs) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, d), wallMat);
    m.position.set(x, wallH / 2, z);
    m.castShadow = quality !== "low";
    m.receiveShadow = quality !== "low";
    group.add(m);
    colliders.push({ x, z, hw: w / 2, hd: d / 2 });
  }

  // مبانٍ
  const textures = level.palette.map((c) => facadeTexture(c));
  const matCache = textures.map((t) => new THREE.MeshStandardMaterial({ map: t, roughness: 0.88, metalness: 0.1 }));
  const centerClear = 9;
  for (let i = 0; i < level.buildings; i++) {
    const w = 3.5 + rng() * 7;
    const d = 3.5 + rng() * 7;
    const h = 4 + rng() * 12;
    let x, z, tries = 0;
    do {
      const ang = rng() * Math.PI * 2;
      const rad = 11 + rng() * (ARENA - 15);
      x = Math.cos(ang) * rad;
      z = Math.sin(ang) * rad;
      tries++;
    } while (tries < 40 && overlapAny(x, z, w / 2 + 2, d / 2 + 2, colliders) || Math.hypot(x, z) < centerClear);
    if (tries >= 40) continue;
    const mat = matCache[(rng() * matCache.length) | 0];
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, h / 2, z);
    m.rotation.y = rng() > 0.6 ? Math.round(rng() * 3) * (Math.PI / 2) : 0;
    m.castShadow = quality !== "low";
    m.receiveShadow = quality !== "low";
    group.add(m);
    const hw = (Math.abs(Math.cos(m.rotation.y)) * w + Math.abs(Math.sin(m.rotation.y)) * d) / 2;
    const hd = (Math.abs(Math.sin(m.rotation.y)) * w + Math.abs(Math.cos(m.rotation.y)) * d) / 2;
    colliders.push({ x, z, hw, hd });
    obstacles.push({ x, z, h });

    // سطح مضيء على الحافة العليا
    const neon = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.9, 0.09, 0.09),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(level.light).multiplyScalar(0.9) })
    );
    neon.position.set(x, h - 0.3, z - hd + 0.05);
    neon.rotation.y = m.rotation.y;
    group.add(neon);
  }

  // حواجز وصناديق
  for (let i = 0; i < level.props; i++) {
    const kind = rng();
    const ang = rng() * Math.PI * 2;
    const rad = 7 + rng() * (ARENA - 10);
    const x = Math.cos(ang) * rad, z = Math.sin(ang) * rad;
    if (overlapAny(x, z, 1.4, 1.4, colliders)) continue;
    if (kind < 0.45) {
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(1.5, 1.1, 1.5),
        new THREE.MeshStandardMaterial({ color: 0x39322a, roughness: 0.95 })
      );
      box.position.set(x, 0.55, z);
      box.rotation.y = rng() * Math.PI;
      box.castShadow = quality !== "low";
      box.receiveShadow = quality !== "low";
      group.add(box);
      colliders.push({ x, z, hw: 0.85, hd: 0.85 });
    } else if (kind < 0.72) {
      const barrel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.42, 0.42, 1.1, 10),
        new THREE.MeshStandardMaterial({ color: rng() > 0.5 ? 0x8a3a28 : 0x2c4a3a, roughness: 0.7, metalness: 0.35 })
      );
      barrel.position.set(x, 0.55, z);
      barrel.castShadow = quality !== "low";
      group.add(barrel);
      colliders.push({ x, z, hw: 0.5, hd: 0.5 });
    } else {
      // عمود إضاءة
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.14, 5.4, 6),
        new THREE.MeshStandardMaterial({ color: 0x2a2f35, roughness: 0.7, metalness: 0.6 })
      );
      pole.position.set(x, 2.7, z);
      group.add(pole);
      const lamp = new THREE.Mesh(
        new THREE.SphereGeometry(0.26, 8, 8),
        new THREE.MeshBasicMaterial({ color: level.light })
      );
      lamp.position.set(x, 5.3, z);
      group.add(lamp);
      const pl = new THREE.PointLight(level.light, 6, 16, 2);
      pl.position.set(x, 5.1, z);
      group.add(pl);
      colliders.push({ x, z, hw: 0.3, hd: 0.3 });
    }
  }

  // غبار/جزيئات جوية
  const dustCount = quality === "low" ? 90 : 240;
  const dg = new THREE.BufferGeometry();
  const dp = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    dp[i * 3] = (rng() - 0.5) * ARENA * 2;
    dp[i * 3 + 1] = rng() * 9;
    dp[i * 3 + 2] = (rng() - 0.5) * ARENA * 2;
  }
  dg.setAttribute("position", new THREE.BufferAttribute(dp, 3));
  const dust = new THREE.Points(dg, new THREE.PointsMaterial({
    color: level.light, size: 0.07, transparent: true, opacity: 0.5, depthWrite: false,
  }));
  group.add(dust);

  return {
    group, colliders, obstacles, bounds: ARENA - 1.2,
    update(dt, t) {
      dust.rotation.y += dt * 0.008;
      const pos = dg.attributes.position;
      for (let i = 0; i < dustCount; i += 1) {
        let y = pos.getY(i) + dt * (0.12 + (i % 5) * 0.03);
        if (y > 9) y = 0.2;
        pos.setY(i, y);
      }
      pos.needsUpdate = true;
    },
    dispose() { group.traverse((o) => { o.geometry?.dispose?.(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } }); },
  };
}

export function isBlocked(colliders, x, z, r = 0.4) {
  for (const c of colliders) {
    const cx = Math.max(c.x - c.hw, Math.min(x, c.x + c.hw));
    const cz = Math.max(c.z - c.hd, Math.min(z, c.z + c.hd));
    const dx = x - cx, dz = z - cz;
    if (dx * dx + dz * dz < r * r) return true;
  }
  return false;
}

export function resolveCollision(colliders, pos, r = 0.42, bounds = ARENA - 1.2) {
  for (const c of colliders) {
    const cx = Math.max(c.x - c.hw, Math.min(pos.x, c.x + c.hw));
    const cz = Math.max(c.z - c.hd, Math.min(pos.z, c.z + c.hd));
    let dx = pos.x - cx, dz = pos.z - cz;
    let dist = Math.hypot(dx, dz);
    if (dist < r) {
      if (dist < 1e-5) { dx = 0; dz = 1; dist = 1; }
      const push = r - dist;
      pos.x += (dx / dist) * push;
      pos.z += (dz / dist) * push;
    }
  }
  pos.x = Math.max(-bounds, Math.min(bounds, pos.x));
  pos.z = Math.max(-bounds, Math.min(bounds, pos.z));
  return pos;
}

function overlapAny(x, z, hw, hd, colliders) {
  for (const c of colliders) {
    if (Math.abs(x - c.x) < c.hw + hw && Math.abs(z - c.z) < c.hd + hd) return true;
  }
  return false;
}

export function findSpawnPoint(colliders, player, bounds, minDist = 18, maxDist = 28) {
  for (let i = 0; i < 40; i++) {
    const ang = Math.random() * Math.PI * 2;
    const rad = minDist + Math.random() * (maxDist - minDist);
    const x = Math.max(-bounds, Math.min(bounds, player.x + Math.cos(ang) * rad));
    const z = Math.max(-bounds, Math.min(bounds, player.z + Math.sin(ang) * rad));
    if (!isBlocked(colliders, x, z, 1.1)) return { x, z };
  }
  return { x: player.x + minDist * 0.6, z: player.z + minDist * 0.6 };
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export { ARENA };
