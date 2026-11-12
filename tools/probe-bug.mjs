import puppeteer from "puppeteer-core";

const BASE = process.env.DS_URL || "http://127.0.0.1:5173";
const ARGS = ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-gl=angle", "--use-angle=swiftshader", "--hide-scrollbars", "--mute-audio"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run(label, viewport, mobile) {
  const browser = await puppeteer.launch({ executablePath: "/usr/bin/chromium", headless: true, args: ARGS });
  const page = await browser.newPage();
  await page.setViewport(viewport);
  const errs = [];
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  page.on("pageerror", (e) => errs.push("PAGEERROR " + e.message));
  await page.goto(`${BASE}/play/`, { waitUntil: "networkidle2" });
  await sleep(1400);
  await page.evaluate(() => document.body.classList.add("qa"));

  // 1) امنح المال، اشرِ البندقية، طوّرها، ابدأ مرحلة جديدة
  const bought = await page.evaluate(() => {
    const g = window.__DS.game;
    window.__DS.coins(40000);
    g.buyWeapon("rifle");
    const before = JSON.parse(JSON.stringify(g.profile.weaponStats.rifle));
    for (let i = 0; i < 3; i++) g.upgradeWeapon("rifle", "damage");
    g.upgradeWeapon("rifle", "mag");
    return { owned: g.profile.owned, equipped: g.profile.equipped, before, after: g.profile.weaponStats.rifle };
  });
  console.log(`[${label}] shop:`, JSON.stringify(bought));

  const started = await page.evaluate(() => {
    const g = window.__DS.game;
    g.startLevel(2);
    return { state: g.state, enabled: g.input.enabled, cls: document.body.className, ammo: g.weapons.ammo, rt: !!g.weapons.rt, zLevel: g.zLevel };
  });
  console.log(`[${label}] start:`, JSON.stringify(started));

  // 2) هل الحلقة حيّة؟ (نعدّ فريمات)
  const frames = await page.evaluate(async () => {
    const t0 = window.__DS.game.time;
    await new Promise((r) => setTimeout(r, 700));
    return { dTime: +(window.__DS.game.time - t0).toFixed(3), state: window.__DS.game.state };
  });
  console.log(`[${label}] loop:`, JSON.stringify(frames));

  // 3) هل النظر يشتغل بالماوس (بدون ما تضغط زر)؟
  const look = await page.evaluate(async () => {
    const g = window.__DS.game;
    const y0 = g.player.yaw;
    for (let i = 0; i < 12; i++) {
      document.dispatchEvent(new MouseEvent("mousemove", { movementX: 25, movementY: 0, bubbles: true }));
      await new Promise((r) => requestAnimationFrame(r));
    }
    return { y0: +y0.toFixed(3), y1: +g.player.yaw.toFixed(3) };
  });
  console.log(`[${label}] look-noclick:`, JSON.stringify(look));

  // 4) هل أزرار اللمس (pointerdown) بتوصل؟
  const touch = await page.evaluate(async () => {
    const btn = document.getElementById("btn-fire");
    const g = window.__DS.game;
    const r = btn.getBoundingClientRect();
    const opt = { pointerId: 7, pointerType: "touch", bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
    btn.dispatchEvent(new PointerEvent("pointerdown", opt));
    const fireNow = g.input.fire;
    await new Promise((res) => setTimeout(res, 400));
    const shots = g.run.shots;
    btn.dispatchEvent(new PointerEvent("pointerup", opt));
    return { fireNow, shots, ammo: g.weapons.ammo, state: g.state };
  });
  console.log(`[${label}] touch-fire:`, JSON.stringify(touch));

  console.log(`[${label}] ERRORS:`, errs.length ? errs.slice(0, 6) : "none");
  await browser.close();
}

await run("desktop", { width: 1280, height: 800 }, false);
await run("mobile", { width: 844, height: 390, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, true);
