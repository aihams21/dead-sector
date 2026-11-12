/* مؤثرات: شرار، دم، خطوط طلقات، وميض فوهة */
import * as THREE from "three";

const MAX = 900;
const VERT = `
attribute float aSize;
attribute float aAlpha;
attribute vec3 aColor;
varying float vAlpha;
varying vec3 vColor;
void main() {
  vAlpha = aAlpha;
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * (320.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = `
varying float vAlpha;
varying vec3 vColor;
void main() {
  vec2 d = gl_PointCoord - vec2(0.5);
  float r = dot(d, d);
  if (r > 0.25) discard;
  float a = vAlpha * smoothstep(0.25, 0.02, r);
  gl_FragColor = vec4(vColor, a);
}`;

export class FX {
  constructor(scene, quality = "high") {
    this.scene = scene;
    this.quality = quality;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(MAX * 3);
    const col = new Float32Array(MAX * 3);
    const size = new Float32Array(MAX);
    const alpha = new Float32Array(MAX);
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
    geo.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    geo.setAttribute("aAlpha", new THREE.BufferAttribute(alpha, 1));
    this.geo = geo;
    this.pos = pos; this.col = col; this.size = size; this.alpha = alpha;
    this.vel = new Float32Array(MAX * 3);
    this.life = new Float32Array(MAX);
    this.maxLife = new Float32Array(MAX);
    this.grav = new Float32Array(MAX);
    this.cursor = 0;
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.tracers = [];
  }

  spawn(x, y, z, vx, vy, vz, color, size, life, gravity = 9) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % MAX;
    const i3 = i * 3;
    this.pos[i3] = x; this.pos[i3 + 1] = y; this.pos[i3 + 2] = z;
    this.vel[i3] = vx; this.vel[i3 + 1] = vy; this.vel[i3 + 2] = vz;
    this.col[i3] = color.r; this.col[i3 + 1] = color.g; this.col[i3 + 2] = color.b;
    this.size[i] = size;
    this.alpha[i] = 1;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.grav[i] = gravity;
    return i;
  }

  burst(p, color, count = 12, { speed = 6, size = 0.5, life = 0.7, gravity = 9, dir = null, spread = 1 } = {}) {
    const c = color instanceof THREE.Color ? color : new THREE.Color(color);
    const q = this.quality === "low" ? Math.ceil(count * 0.5) : count;
    for (let i = 0; i < q; i++) {
      let vx = (Math.random() - 0.5) * 2 * speed * spread;
      let vy = (Math.random() - 0.5) * 2 * speed * spread + speed * 0.2;
      let vz = (Math.random() - 0.5) * 2 * speed * spread;
      if (dir) {
        vx += dir.x * speed * 0.8; vy += dir.y * speed * 0.8; vz += dir.z * speed * 0.8;
      }
      const c2 = c.clone().offsetHSL(0, 0, (Math.random() - 0.5) * 0.22);
      this.spawn(p.x, p.y, p.z, vx, vy, vz, c2, size * (0.6 + Math.random() * 0.9), life * (0.6 + Math.random() * 0.7), gravity);
    }
  }

  tracer(from, to, color = 0xffd9a0) {
    if (this.tracers.length > 24) return;
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.tracers.push({ line, t: 0, life: 0.075 });
  }

  update(dt) {
    const { pos, vel, life, maxLife, alpha, grav, col } = this;
    let dirty = false;
    for (let i = 0; i < MAX; i++) {
      if (life[i] <= 0) continue;
      dirty = true;
      life[i] -= dt;
      const i3 = i * 3;
      vel[i3 + 1] -= grav[i] * dt;
      pos[i3] += vel[i3] * dt;
      pos[i3 + 1] += vel[i3 + 1] * dt;
      pos[i3 + 2] += vel[i3 + 2] * dt;
      if (pos[i3 + 1] < 0.03) { pos[i3 + 1] = 0.03; vel[i3 + 1] *= -0.28; vel[i3] *= 0.6; vel[i3 + 2] *= 0.6; }
      const k = Math.max(0, life[i] / maxLife[i]);
      alpha[i] = k * k;
      if (life[i] <= 0) { alpha[i] = 0; }
    }
    if (dirty) {
      this.geo.attributes.position.needsUpdate = true;
      this.geo.attributes.aAlpha.needsUpdate = true;
      this.geo.attributes.aColor.needsUpdate = true;
      this.geo.attributes.aSize.needsUpdate = true;
    }
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tr = this.tracers[i];
      tr.t += dt;
      tr.line.material.opacity = Math.max(0, 0.85 * (1 - tr.t / tr.life));
      if (tr.t >= tr.life) {
        this.scene.remove(tr.line);
        tr.line.geometry.dispose();
        tr.line.material.dispose();
        this.tracers.splice(i, 1);
      }
    }
  }

  reset() {
    this.life.fill(0);
    this.alpha.fill(0);
    this.geo.attributes.aAlpha.needsUpdate = true;
    for (const tr of this.tracers) { this.scene.remove(tr.line); tr.line.geometry.dispose(); tr.line.material.dispose(); }
    this.tracers.length = 0;
  }
}
