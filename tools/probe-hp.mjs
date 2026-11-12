import puppeteer from "puppeteer-core";

const BASE = process.env.DS_URL || "http://127.0.0.1:5173";
const browser = await puppeteer.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-gl=angle", "--use-angle=swiftshader", "--hide-scrollbars", "--mute-audio"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
page.on("console", (m) => { if (m.type() === "error") console.log("PAGE ERR:", m.text()); });
await page.goto(`${BASE}/play/?level=1&auto=1`, { waitUntil: "networkidle2" });
await new Promise((r) => setTimeout(r, 1600));

const out = await page.evaluate(() => {
  const g = window.__DS.game;
  g.zombies.length = 0;
  window.__DS.spawn("walker", 1);
  const z = g.zombies[g.zombies.length - 1];
  const before = { hp: z.hp, max: z.maxHp, alive: z.alive, pos: z.group.position.toArray() };
  z.hit(10, "body", null);
  const afterHit = { hp: z.hp, alive: z.alive };
  const rt = g.weapons.rt;
  return { before, afterHit, rt: { damage: rt.damage, headMult: rt.headMult, range: rt.range }, type: typeof z.hp };
});
console.log(JSON.stringify(out, null, 2));
await browser.close();
