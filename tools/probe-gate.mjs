import puppeteer from "puppeteer-core";

const BASE = process.env.DS_URL || "http://127.0.0.1:5173";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-gl=angle", "--use-angle=swiftshader", "--hide-scrollbars", "--mute-audio"],
});

const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
page.on("console", (m) => { if (m.type() === "error") console.log("PAGE ERR:", m.text()); });
page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));
await page.goto(`${BASE}/play/?level=1&auto=1`, { waitUntil: "networkidle2" });
await sleep(1600);

const snap = (tag) => page.evaluate((tag) => {
  const g = window.__DS?.game;
  const gate = document.getElementById("gate");
  const cs = gate ? getComputedStyle(gate) : null;
  const el = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
  return {
    tag,
    state: g?.state,
    bodyClass: document.body.className,
    portraitMQ: matchMedia("(orientation: portrait)").matches,
    gateDisplay: cs?.display,
    topAtCenter: el ? el.id || el.className || el.tagName : "none",
    screensOn: document.getElementById("screens")?.className,
    gateButtons: gate ? [...gate.querySelectorAll("button")].map((b) => b.textContent.trim()) : [],
    enabled: g?.input?.enabled,
  };
}, tag);

console.log(JSON.stringify(await snap("portrait/after-play")));

/* لفّ الجهاز: العرض يصير landscape */
await page.setViewport({ width: 844, height: 390, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await sleep(900);
console.log(JSON.stringify(await snap("landscape/after-rotate")));

/* إعادة للطول ثم للمرض — هل يتعلّق؟ */
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await sleep(500);
await page.setViewport({ width: 844, height: 390, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await sleep(900);
console.log(JSON.stringify(await snap("landscape/second-rotate")));

/* هل أزرار اللعب تشتغل؟ */
const cdp = await page.target().createCDPSession();
const touch = (type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts });
const fire = await page.evaluate(() => {
  const b = document.querySelector("#touch-ui .touch-pad [data-act='fire'], #touch-ui [data-act='fire'], #btn-fire");
  if (!b) return null;
  const r = b.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
});
if (fire) {
  await touch("touchStart", [{ x: fire.x, y: fire.y, id: 1 }]);
  await sleep(500);
  const mid = await page.evaluate(() => ({ fire: window.__DS.game.input.fire, shots: window.__DS.game.run?.shots }));
  await touch("touchEnd", [{ x: fire.x, y: fire.y, id: 1 }]);
  console.log("FIRE:", JSON.stringify(mid));
} else {
  console.log("FIRE: button not found");
}

await browser.close();
