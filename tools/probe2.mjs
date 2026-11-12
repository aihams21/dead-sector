import puppeteer from "puppeteer-core";
const BASE = "http://127.0.0.1:5173";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: "/usr/bin/chromium", headless: true, args: ["--no-sandbox","--enable-unsafe-swiftshader","--use-gl=angle","--use-angle=swiftshader","--hide-scrollbars","--mute-audio"] });
const page = await browser.newPage();
await page.setViewport({ width: 844, height: 390, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await page.goto(`${BASE}/play/`, { waitUntil: "networkidle2" });
await sleep(1600);
const cdp = await page.target().createCDPSession();
const touch = (t, p) => cdp.send("Input.dispatchTouchEvent", { type: t, touchPoints: p });
async function tapAt(sel) {
  const b = await page.evaluate((s) => { const el = document.querySelector(s); if (!el) return null; el.scrollIntoView({block:"center"}); const r = el.getBoundingClientRect(); return { x: r.left + r.width/2, y: r.top + r.height/2 }; }, sel);
  if (!b) return false;
  await touch("touchStart", [{ x: b.x, y: b.y, id: 1 }]); await sleep(60); await touch("touchEnd", []); await sleep(400);
  return true;
}
await tapAt('.screen.active [data-action="play"]');
await sleep(1500);
const st = await page.evaluate(() => {
  const w = document.getElementById("screens");
  const cs = getComputedStyle(w);
  const c = document.elementFromPoint(innerWidth/2, innerHeight/2);
  const stack = document.elementsFromPoint(innerWidth/2, innerHeight/2).map((e) => e.id || e.className || e.tagName).slice(0,6);
  return { cls: w.className, opacity: cs.opacity, vis: cs.visibility, pe: cs.pointerEvents, display: cs.display, center: c?.id || c?.className, stack, playing: window.__DS.game.state, hudOn: document.getElementById("hud").className };
});
console.log("AFTER PLAY:", JSON.stringify(st));
await sleep(2500);
const st2 = await page.evaluate(() => { const cs = getComputedStyle(document.getElementById("screens")); return { opacity: cs.opacity, vis: cs.visibility }; });
console.log("LATER:", JSON.stringify(st2));
await browser.close();
