import puppeteer from "puppeteer-core";

const BASE = process.env.DS_URL || "http://127.0.0.1:5173";
const ARGS = ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-gl=angle", "--use-angle=swiftshader", "--hide-scrollbars", "--mute-audio"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: "/usr/bin/chromium", headless: true, args: ARGS });
const page = await browser.newPage();
await page.setViewport({ width: 844, height: 390, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const errs = [];
page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
page.on("pageerror", (e) => errs.push("PAGEERROR " + e.message));
await page.goto(`${BASE}/play/`, { waitUntil: "networkidle2" });
await sleep(1600);

const cdp = await page.target().createCDPSession();
const touch = (type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts });

/* لمسة حقيقية بإحداثيات الشاشة (تمرّ عبر hit-testing كأنها إصبع) */
async function tap(sel, label) {
  const box = await page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return null;
    el.scrollIntoView({ block: "center" });
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return { offscreen: true };
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: Math.round(r.width), h: Math.round(r.height) };
  }, sel);
  if (!box) { console.log(`tap ${label}: MISSING ${sel}`); return null; }
  if (box.offscreen) { console.log(`tap ${label}: ZERO-SIZE ${sel}`); return null; }
  const hit = await page.evaluate((p) => {
    const e = document.elementFromPoint(p.x, p.y);
    if (!e) return "none";
    const b = e.closest("[data-action]");
    return { tag: e.id || e.className || e.tagName, action: b?.dataset.action || null, id: b?.dataset.id || null };
  }, box);
  await touch("touchStart", [{ x: box.x, y: box.y, id: 1 }]);
  await sleep(60);
  await touch("touchEnd", []);
  await sleep(320);
  console.log(`tap ${label} (${sel}) @${Math.round(box.x)},${Math.round(box.y)} ${box.w}x${box.h} hit=${JSON.stringify(hit)}`);
  return hit;
}

const snap = (tag) => page.evaluate((t) => {
  const g = window.__DS.game;
  const c = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
  const wrap = document.getElementById("screens");
  const active = [...document.querySelectorAll("[data-screen]")].filter((s) => s.classList.contains("active")).map((s) => s.dataset.screen || s.id);
  const cs = getComputedStyle(wrap);
  return {
    tag: t,
    state: g.state,
    enabled: g.input.enabled,
    bodyScreen: document.body.dataset.screen,
    wrapOn: wrap.classList.contains("on"),
    wrapPE: cs.pointerEvents, wrapVis: cs.visibility, wrapDisplay: cs.display, wrapZ: cs.zIndex,
    active,
    center: c?.id || c?.className || c?.tagName,
    gate: getComputedStyle(document.getElementById("gate")).display,
    coins: g.profile.coins,
    equipped: g.profile.equipped,
    owned: g.profile.ownedWeapons || g.profile.weapons,
    ammo: g.weapons?.ammo ?? null,
    shots: g.run?.shots ?? null,
  };
}, tag);

console.log("STEP0:", JSON.stringify(await snap("boot")));

await page.evaluate(() => window.__DS.coins(60000));
await sleep(80);

const ACTIVE = ".screen.active ";
await tap(ACTIVE + '[data-action="open"][data-id="shop"]', "open shop");
console.log("STEP1:", JSON.stringify(await snap("shop")));
await tap(ACTIVE + '[data-action="buyWeapon"][data-id="rifle"]', "buy rifle");
console.log("STEP2:", JSON.stringify(await snap("bought")));
await tap(ACTIVE + '[data-action="close"]', "back home");
await tap(ACTIVE + '[data-action="open"][data-id="upgrades"]', "open upgrades");
await tap(ACTIVE + '[data-action="tab"][data-id="weapon"]', "tab weapon");
await tap(ACTIVE + '[data-action="upgradeStat"][data-id="damage"]', "upgrade damage");
await tap(ACTIVE + '[data-action="upgradeStat"][data-id="mag"]', "upgrade mag");
console.log("STEP3:", JSON.stringify(await snap("upgraded")));
await tap(ACTIVE + '[data-action="close"]', "back home 2");
await tap(ACTIVE + '[data-action="open"][data-id="levels"]', "open levels");
console.log("STEP4:", JSON.stringify(await snap("levels")));
const playSel = await page.evaluate(() => {
  const b = document.querySelector('.screen.active [data-action="play"]');
  if (!b) return null;
  const r = b.getBoundingClientRect();
  return { id: b.dataset.id, disabled: b.disabled, rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], label: b.textContent.trim().slice(0, 20) };
});
console.log("PLAY BTN:", JSON.stringify(playSel));
await tap('.screen.active [data-action="play"]', "play first available level");
await sleep(900);
console.log("STEP5:", JSON.stringify(await snap("playing")));

/* هل أزرار اللعب تستجيب للّمس؟ */
async function holdBtn(id, label) {
  const r = await page.evaluate((i) => {
    const b = document.getElementById(i);
    if (!b) return null;
    const q = b.getBoundingClientRect();
    return { x: q.left + q.width / 2, y: q.top + q.height / 2, w: Math.round(q.width), h: Math.round(q.height) };
  }, id);
  if (!r) { console.log(`hold ${label}: MISSING #${id}`); return; }
  const hit = await page.evaluate((p) => {
    const e = document.elementFromPoint(p.x, p.y);
    return e ? (e.id || e.className || e.tagName) : "none";
  }, r);
  const before = await page.evaluate(() => ({ f: window.__DS.game.input.fire, s: window.__DS.game.run?.shots ?? null, t: window.__DS.game.time }));
  await touch("touchStart", [{ x: r.x, y: r.y, id: 2 }]);
  await sleep(120);
  const during = await page.evaluate(() => ({ f: window.__DS.game.input.fire, m: { ...window.__DS.game.input.move } }));
  await sleep(520);
  await touch("touchEnd", []);
  await sleep(150);
  const after = await page.evaluate(() => ({ f: window.__DS.game.input.fire, s: window.__DS.game.run?.shots ?? null, t: window.__DS.game.time }));
  console.log(`hold ${label} #${id} @${Math.round(r.x)},${Math.round(r.y)} ${r.w}x${r.h} hit=${hit} before=${JSON.stringify(before)} during=${JSON.stringify(during)} after=${JSON.stringify(after)}`);
}

await holdBtn("btn-fire", "fire");
await holdBtn("btn-reload", "reload");

/* فحص شامل: كل عنصر تفاعلي مرئي أثناء اللعب — هل يُصاب بالوسط؟ */
const coexist = await page.evaluate(() => {
  const out = [];
  for (const el of document.querySelectorAll("[data-action], #btn-fire, #btn-reload, #btn-jump, #btn-switch, #btn-pause, .touch-pad, #joy")) {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none" || +cs.opacity === 0) continue;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    if (cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight) continue;
    const hit = document.elementFromPoint(cx, cy);
    const ok = hit === el || el.contains(hit);
    out.push({ el: el.id || el.dataset.action || el.className, ok, hit: ok ? null : (hit?.id || hit?.className || hit?.tagName) });
  }
  return { total: out.length, blocked: out.filter((o) => !o.ok) };
});
console.log("COEXIST:", JSON.stringify(coexist));

console.log("ERRORS:", errs.length ? errs.slice(0, 8) : "none");
await browser.close();
