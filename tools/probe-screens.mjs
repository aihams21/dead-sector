import puppeteer from "puppeteer-core";
const BASE = process.env.DS_URL || "http://127.0.0.1:5173";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({
  executablePath: "/usr/bin/chromium", headless: true,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-gl=angle", "--use-angle=swiftshader", "--hide-scrollbars", "--mute-audio"],
});
const page = await browser.newPage();
await page.setViewport({ width: 844, height: 390, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));
await page.goto(`${BASE}/play/?level=1&auto=1`, { waitUntil: "networkidle2" });
await sleep(1500);
const state = () => page.evaluate(() => {
  const s = document.getElementById("screens");
  const cs = getComputedStyle(s);
  const probe = document.elementFromPoint(innerWidth * 0.86, innerHeight * 0.86);
  const fb = document.getElementById("btn-fire");
  const r = fb?.getBoundingClientRect();
  const at = r ? document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) : null;
  return {
    cls: s.className, op: cs.opacity, vis: cs.visibility, pe: cs.pointerEvents, z: cs.zIndex,
    atFire: at ? (at.id || at.className || at.tagName) : "none",
    at0: probe ? (probe.id || probe.tagName) : "none",
    state: window.__DS.game.state,
  };
});
console.log("t0", JSON.stringify(await state()));
for (const ms of [100, 300, 600, 1200]) { await sleep(ms); console.log(`+${ms}`, JSON.stringify(await state())); }
await browser.close();
