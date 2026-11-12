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
await page.goto(`${BASE}/play/`, { waitUntil: "networkidle2" });
await sleep(1600);
const cdp = await page.target().createCDPSession();
const touch = (type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts });
const tapSel = async (sel) => {
  const p = await page.evaluate((s) => { const b = document.querySelector(s); if (!b) return null; b.scrollIntoView({ block: "center" }); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sel);
  if (!p) { console.log("MISSING", sel); return false; }
  await touch("touchStart", [{ x: p.x, y: p.y, id: 3 }]);
  await sleep(40);
  await touch("touchEnd", []);
  await sleep(320);
  return true;
};
const rep = () => page.evaluate(() => {
  const s = document.getElementById("screens");
  const cs = getComputedStyle(s);
  const fb = document.getElementById("btn-fire");
  const r = fb.getBoundingClientRect();
  const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return {
    st: window.__DS.game.state, cls: s.className, inline: s.style.cssText.slice(0, 120),
    op: cs.opacity, vis: cs.visibility, trans: cs.transitionProperty + " " + cs.transitionDuration,
    atFire: at ? (at.id || at.className || at.tagName) : "none",
  };
});
console.log("boot", JSON.stringify(await rep()));
await tapSel('[data-action="open"][data-id="levels"]');
console.log("levels", JSON.stringify(await rep()));
await tapSel('.screen.active [data-action="play"]');
console.log("play+0", JSON.stringify(await rep()));
for (const ms of [150, 350, 700, 1500]) { await sleep(ms); console.log(`play+${ms}`, JSON.stringify(await rep())); }
await browser.close();
