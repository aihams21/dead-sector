import puppeteer from "puppeteer-core";

const BASE = process.env.DS_URL || "http://127.0.0.1:5173";
const browser = await puppeteer.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-gl=angle", "--use-angle=swiftshader", "--hide-scrollbars", "--mute-audio"],
});
const page = await browser.newPage();
await page.setViewport({ width: 844, height: 390, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await page.goto(`${BASE}/play/?level=1&auto=1`, { waitUntil: "networkidle2" });
await page.evaluate(() => document.body.classList.add("qa"));
await new Promise((r) => setTimeout(r, 1200));

const out = await page.evaluate(() => {
  const ids = ["joy", "btn-fire", "btn-reload", "btn-jump", "btn-switch", "btn-pause", "hud-hp", "hud-ammo", "wave-bar", "boss-bar", "hud-hint"];
  const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height), getComputedStyle(el).display]; };
  const o = {};
  for (const id of ids) o[id] = r(document.getElementById(id));
  const sel = [".hud-bottom", ".vitals", ".ammo", ".ammo-row", ".wave"];
  for (const s of sel) o[s] = r(document.querySelector(s));
  const overlap = (a, b) => !!a && !!b && a[0] < b[0] + b[2] && b[0] < a[0] + a[2] && a[1] < b[1] + b[3] && b[1] < a[1] + a[3];
  const keys = Object.keys(o).filter((k) => o[k]);
  const pairs = [];
  for (let i = 0; i < keys.length; i++)
    for (let j = i + 1; j < keys.length; j++)
      if (overlap(o[keys[i]], o[keys[j]])) pairs.push([keys[i], keys[j]]);
  return { vw: innerWidth, vh: innerHeight, o, pairs };
});
console.log(JSON.stringify(out, null, 1));
await browser.close();
