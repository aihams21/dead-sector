/* أداة لقطات الشاشة: تشغيل اللعبة في Chromium بلا واجهة وأخذ لقطات حقيقية */
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";

const BASE = process.env.DS_URL || "http://127.0.0.1:5173";
const OUT = process.env.DS_OUT || "./public/shots";
mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  protocolTimeout: 180000,
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--enable-unsafe-swiftshader",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--hide-scrollbars",
    "--mute-audio",
    "--font-render-hinting=none",
  ],
});

const page = await browser.newPage();
const errors = [];
page.on("console", (m) => {
  if (m.type() === "error" || m.type() === "warning") errors.push(`${m.type()}: ${m.text()}`);
});
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("requestfailed", (r) => errors.push(`reqfail: ${r.url()} ${r.failure()?.errorText}`));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function boot(w = 1600, h = 900, scale = 1) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: scale });
  await page.goto(`${BASE}/play/`, { waitUntil: "networkidle2", timeout: 60000 });
  await page.waitForFunction("window.__DS && window.__DS.game", { timeout: 30000 });
  await sleep(1200);
}

async function shot(name, opts = {}) {
  await page.screenshot({ path: `${OUT}/${name}.png`, ...opts });
  console.log("shot:", name);
}

const mode = process.argv[2] || "smoke";

if (mode === "smoke") {
  await boot();
  const info = await page.evaluate(() => ({
    state: window.__DS.state,
    wrapOn: document.getElementById("screens").classList.contains("on"),
    active: [...document.querySelectorAll(".screen")].filter((s) => s.classList.contains("active")).map((s) => s.dataset.screen),
    renderer: window.__DS.game.renderer?.info?.render,
    gl: (() => {
      const c = document.createElement("canvas");
      const g = c.getContext("webgl2") || c.getContext("webgl");
      return g ? g.getParameter(g.VERSION) : "NO-WEBGL";
    })(),
  }));
  console.log(JSON.stringify(info, null, 1));
  await shot("smoke-menu");
}

if (mode === "capture") {
  await boot(1600, 900);
  await shot("01-menu");

  await page.evaluate(() => window.__DS.game.openScreen("levels"));
  await sleep(600);
  await shot("02-levels");

  await page.evaluate(() => {
    window.__DS.coins(9000);
    window.__DS.game.profile.gems = 40;
    window.__DS.game.openScreen("shop");
  });
  await sleep(600);
  await shot("03-shop");

  await page.evaluate(() => window.__DS.game.openScreen("upgrades"));
  await sleep(600);
  await shot("04-upgrades");

  await page.evaluate(() => window.__DS.game.openScreen("rules"));
  await sleep(600);
  await shot("05-rules");

  // قتال حقيقي
  await page.evaluate(() => {
    window.__DS.start(1);
    window.__DS.god();
  });
  await sleep(1800);
  await page.evaluate(() => {
    const g = window.__DS.game;
    window.__DS.spawn("walker", 4);
    window.__DS.spawn("runner", 2);
    g.player.pos.set(0, 0, 16);
    g.player.yaw = 0;
    g.zombies.forEach((z, i) => {
      const x = -6 + i * 2.4;
      const d = 6 + (i % 3) * 3.2;
      z.setPosition(x, 16 - d);
    });
  });
  await sleep(1200);
  await page.evaluate(() => {
    const g = window.__DS.game;
    g.input.fire = true;
    let now = performance.now() / 1000;
    for (let i = 0; i < 5; i++) g.shoot(now + i * 0.15);
    g.input.fire = false;
    g.player.hp = Math.round(g.player.maxHp * 0.42);
  });
  await sleep(140);
  await shot("06-combat");

  await page.keyboard.press("Escape");
  await sleep(700);
  await shot("07-pause");

  const info = await page.evaluate(() => ({
    state: window.__DS.state,
    zombies: window.__DS.game.zombies.length,
    hp: window.__DS.game.player.hp,
    coins: window.__DS.game.profile.coins,
    calls: window.__DS.game.renderer.info.render.calls,
  }));
  console.log("state:", JSON.stringify(info));

  // موبايل
  const mobile = await browser.newPage();
  await mobile.setViewport({ width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await mobile.goto(`${BASE}/play/`, { waitUntil: "networkidle2", timeout: 60000 });
  await mobile.waitForFunction("window.__DS && window.__DS.game", { timeout: 30000 });
  await sleep(1000);
  await mobile.evaluate(() => {
    window.__DS.start(3);
    window.__DS.god();
  });
  await sleep(1800);
  await mobile.evaluate(() => {
    window.__DS.spawn("walker", 4);
    window.__DS.spawn("brute", 1);
  });
  await sleep(900);
  await mobile.screenshot({ path: `${OUT}/08-mobile.png` });
  console.log("shot: 08-mobile");
  await mobile.close();
}

console.log("ERRORS:\n" + (errors.length ? errors.join("\n") : "none"));
await browser.close();
