import puppeteer from "puppeteer-core";

const BASE = process.env.DS_URL || "http://127.0.0.1:5173";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-gl=angle", "--use-angle=swiftshader", "--hide-scrollbars", "--mute-audio"],
});

/* ---------- 1) سطح المكتب: فأرة حقيقية ---------- */
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  page.on("console", (m) => { if (m.type() === "error") console.log("PAGE ERR:", m.text()); });
  await page.goto(`${BASE}/play/?level=1&auto=1`, { waitUntil: "networkidle2" });
  await sleep(1500);
  await page.evaluate(() => document.body.classList.add("qa"));

  const pre = await page.evaluate(() => {
    const g = window.__DS.game;
    return {
      isTouch: g.input.isTouch,
      bodyTouch: document.body.classList.contains("is-touch"),
      state: g.state,
      enabled: g.input.enabled,
      canvasZ: getComputedStyle(document.getElementById("game")).zIndex,
      topAtCenter: (() => { const e = document.elementFromPoint(640, 400); return e ? e.id || e.className || e.tagName : "none"; })(),
    };
  });
  console.log("DESKTOP pre:", JSON.stringify(pre));

  await page.mouse.move(640, 400);
  await page.mouse.down();
  const onDown = await page.evaluate(() => ({
    fire: window.__DS.game.input.fire,
    lock: !!document.pointerLockElement,
  }));
  console.log("DESKTOP mousedown:", JSON.stringify(onDown));

  const yaw0 = await page.evaluate(() => window.__DS.game.player.yaw);
  await page.mouse.move(760, 400);
  await page.mouse.move(880, 400);
  await sleep(80);
  const afterMove = await page.evaluate(() => ({
    yaw: window.__DS.game.player.yaw,
    locked: !!document.pointerLockElement,
    queued: window.__DS.game.input.look.dx,
  }));
  await page.mouse.up();
  console.log("DESKTOP look:", JSON.stringify({ yaw0, ...afterMove }));

  /* إطلاق فعلي: هل الزومبي نزل hp؟ */
  const shot = await page.evaluate(async () => {
    const g = window.__DS.game;
    g.zombies.length = 0;
    window.__DS.spawn("walker", 1);
    const z = g.zombies[g.zombies.length - 1];
    const d = g.player.pos.clone();
    g.camera.getWorldDirection(d);
    z.setPosition(g.player.pos.x + d.x * 7, g.player.pos.z + d.z * 7);
    g.player.pitch = 0; g.camera.updateMatrixWorld(true); g.scene.updateMatrixWorld(true);
    const hp0 = z.hp;
    return { hp0 };
  });
  await page.mouse.move(640, 400);
  await page.mouse.down();
  await sleep(500);
  const hurt = await page.evaluate(() => {
    const g = window.__DS.game;
    return { fire: g.input.fire, shots: g.run.shots, hits: g.run.hits, hps: g.zombies.map((z) => (z.alive ? z.hp : 0)) };
  });
  await page.mouse.up();
  console.log("DESKTOP shoot:", JSON.stringify(shot), "->", JSON.stringify(hurt));
  await page.close();
}

/* ---------- 2) هاتف: لمس متعدد ---------- */
{
  const page = await browser.newPage();
  await page.setViewport({ width: 844, height: 390, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await page.goto(`${BASE}/play/?level=1&auto=1`, { waitUntil: "networkidle2" });
  await sleep(1500);
  await page.evaluate(() => document.body.classList.add("qa"));

  const pre = await page.evaluate(() => {
    const g = window.__DS.game;
    return { isTouch: g.input.isTouch, bodyTouch: document.body.classList.contains("is-touch"), state: g.state };
  });
  console.log("TOUCH pre:", JSON.stringify(pre));

  /* إصبع 1 على العصا + إصبع 2 على منطقة النظر */
  const joy = await page.evaluate(() => { const r = document.getElementById("joy").getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  const cdp = await page.target().createCDPSession();
  const touch = (type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts });

  await touch("touchStart", [{ x: joy.x, y: joy.y, id: 1 }]);
  await touch("touchMove", [{ x: joy.x + 30, y: joy.y - 10, id: 1 }]);
  const moving = await page.evaluate(() => ({ mx: window.__DS.game.input.move.x, my: window.__DS.game.input.move.y }));
  const yaw0 = await page.evaluate(() => window.__DS.game.player.yaw);
  await touch("touchStart", [
    { x: joy.x + 30, y: joy.y - 10, id: 1 },
    { x: 500, y: 150, id: 2 },
  ]);
  await touch("touchMove", [
    { x: joy.x + 30, y: joy.y - 10, id: 1 },
    { x: 640, y: 150, id: 2 },
  ]);
  await sleep(120);
  const look = await page.evaluate(() => ({ yaw: window.__DS.game.player.yaw, dx: window.__DS.game.input.look.dx }));
  await touch("touchEnd", [{ x: joy.x + 30, y: joy.y - 10, id: 1 }]);
  console.log("TOUCH joy:", JSON.stringify(moving), "look:", JSON.stringify({ yaw0, ...look }));
  await page.close();
}

await browser.close();
