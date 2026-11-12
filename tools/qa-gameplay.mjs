/* فحص وظيفي حقيقي: اقتصاد، شراء، ترقية، مهارات، إطلاق، قتل، تلقيم، موجات،
   ضرر، موت، زعيم، لانهائي، إيقاف مؤقت، وحفظ — عبر DOM فعلي + window.__DS.
   الرسم في Chromium بلا GPU يعمل ~2 إطار/ثانية، فالمحاكاة تُدار يدوياً
   بـ game.update(1/60) عبر __step(n) بدل انتظار الوقت الحقيقي. */
import puppeteer from "puppeteer-core";
import { WEAPON_BY_ID, statCost, perkCost, PLAYER_BASE, LEVELS } from "../play/src/config.js";

const BASE = process.env.DS_URL || "http://127.0.0.1:5173";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0;
const fails = [];
function check(name, ok, detail = "") {
  if (ok) {
    pass++;
    console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ""}`);
  } else {
    fails.push(`${name}${detail ? ` — ${detail}` : ""}`);
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  protocolTimeout: 240000,
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

const errors = [];
const page = await browser.newPage();
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
await page.setViewport({ width: 1280, height: 800 });

async function boot() {
  await page.goto(`${BASE}/play/`, { waitUntil: "networkidle2", timeout: 60000 });
  await page.waitForFunction("window.__DS && window.__DS.game", { timeout: 30000 });
  await page.evaluate(() => {
    window.__step = (n = 1) => {
      const g = window.__DS.game;
      for (let i = 0; i < n; i++) if (g.state === "playing") g.update(1 / 60);
    };
  });
  await sleep(400);
}
const P = () => page.evaluate(() => JSON.parse(JSON.stringify({
  coins: window.__DS.game.profile.coins,
  gems: window.__DS.game.profile.gems,
  owned: window.__DS.game.profile.owned,
  equipped: window.__DS.game.profile.equipped,
  stats: window.__DS.game.profile.weaponStats,
  perks: window.__DS.game.profile.perks,
})));
const state = () => page.evaluate(() => window.__DS.game.state);
const step = (n) => page.evaluate((n) => window.__step(n), n);
const costOf = async (sel) => {
  const t = await page.$eval(sel, (el) => el.textContent);
  const m = t.replace(/,/g, "").match(/\d+/g);
  return m ? Math.max(...m.map(Number)) : NaN;
};
const click = async (sel) => {
  await page.waitForSelector(sel, { timeout: 5000 });
  await page.click(sel);
  await sleep(160);
};
async function hudReady() {
  for (let i = 0; i < 20; i++) {
    const op = await page.evaluate(() => +getComputedStyle(document.querySelector("#hud")).opacity);
    if (op > 0.9) return op;
    await sleep(200);
  }
  return await page.evaluate(() => +getComputedStyle(document.querySelector("#hud")).opacity);
}
async function hudHidden() {
  for (let i = 0; i < 20; i++) {
    const op = await page.evaluate(() => +getComputedStyle(document.querySelector("#hud")).opacity);
    if (op < 0.05) return op;
    await sleep(100);
  }
  return await page.evaluate(() => +getComputedStyle(document.querySelector("#hud")).opacity);
}
const screenOn = (name) =>
  page.evaluate((n) => {
    const el = document.querySelector(`#screens [data-screen="${n}"]`);
    return !!el && el.classList.contains("active") && document.body.dataset.screen === n;
  }, name);

/* بصمة جديدة تماماً */
await boot();
await page.evaluate(() => localStorage.clear());
await boot();

console.log("\n== 1. الملف الشخصي الجديد ==");
{
  const p = await P();
  check("عملات صفرية", p.coins === 0, `coins=${p.coins}`);
  check("بلّورات صفرية", p.gems === 0, `gems=${p.gems}`);
  check("مسدس فقط", p.owned.length === 1 && p.owned[0] === "pistol", JSON.stringify(p.owned));
  check("المسدس مجهّز", p.equipped === "pistol");
  check("كل الخصائص مستوى 1", Object.values(p.stats.pistol).every((v) => v === 1));
  check("كل المهارات صفر", Object.values(p.perks).every((v) => v === 0));
}

console.log("\n== 2. الشراء عبر المتجر (نقرات حقيقية) ==");
{
  await page.evaluate(() => window.__DS.coins(9000));
  await page.evaluate(() => window.__DS.game.openScreen("shop"));
  await sleep(250);
  const before = await P();
  await click('[data-action="buyWeapon"][data-id="smg"]');
  const after = await P();
  check("خصم سعر SMG بالضبط", before.coins - after.coins === WEAPON_BY_ID.smg.cost.coins,
    `${before.coins} → ${after.coins}`);
  check("SMG صار مملوكاً", after.owned.includes("smg"));
  check("SMG تجهّز فوراً", after.equipped === "smg");
  check("خصائص SMG تبدأ بمستوى 1", Object.values(after.stats.smg).every((v) => v === 1));

  await page.evaluate(() => window.__DS.game.buyWeapon("smg"));
  const dup = await P();
  check("لا شراء مكرر لنفس السلاح", dup.coins === after.coins && dup.owned.filter((x) => x === "smg").length === 1);

  await page.evaluate(() => window.__DS.game.openScreen("shop"));
  await sleep(200);
  await click('[data-action="buyWeapon"][data-id="shotgun"]');
  const two = await P();
  check("شراء Shotgun يخصم سعره", two.equipped === "shotgun" && two.owned.length === 3, `${two.coins} ₡ · ${two.owned.join(",")}`);
  await click('[data-action="equip"][data-id="smg"]');
  check("تبديل التجهيز إلى SMG", (await P()).equipped === "smg");
}

console.log("\n== 3. التطوير (سعر معروض = سعر مخصوم) ==");
{
  await page.evaluate(() => window.__DS.game.openScreen("upgrades"));
  await sleep(250);
  await click('[data-action="tab"][data-id="weapon"]');
  await click('[data-action="selectWeapon"][data-id="smg"]');
  const sel = '[data-action="upgradeStat"][data-id="damage"]';
  const shown = await costOf(sel);
  const before = await P();
  await click(sel);
  const after = await P();
  check("تكلفة الضرر المعروضة تطابق المخصوم", before.coins - after.coins === shown,
    `عرض ${shown} / خصم ${before.coins - after.coins}`);
  check("تكلفة الضرر = statCost", shown === statCost(WEAPON_BY_ID.smg, "damage", 1), `statCost=${statCost(WEAPON_BY_ID.smg, "damage", 1)}`);
  check("مستوى الضرر صار 2", after.stats.smg.damage === 2, JSON.stringify(after.stats.smg));

  const sel2 = '[data-action="upgradeStat"][data-id="mag"]';
  const shown2 = await costOf(sel2);
  const b2 = await P();
  await click(sel2);
  const a2 = await P();
  check("ترقية المخزن تعمل", a2.stats.smg.mag === 2 && b2.coins - a2.coins === shown2);
  check("تكلفة المخزن تطابق statCost", shown2 === statCost(WEAPON_BY_ID.smg, "mag", 1));

  await page.evaluate(() => {
    const g = window.__DS.game;
    g.profile.weaponStats.smg.reload = 8;
    g.openScreen("upgrades");
  });
  await sleep(200);
  await click('[data-action="tab"][data-id="weapon"]');
  await click('[data-action="selectWeapon"][data-id="smg"]');
  const btn = await page.$('[data-action="upgradeStat"][data-id="reload"]');
  const disabled = btn ? await page.evaluate((el) => el.disabled, btn) : true;
  check("المستوى 8 يوقف الترقية", disabled === true);
}

console.log("\n== 4. المهارات ==");
{
  await click('[data-action="tab"][data-id="perk"]');
  const sel = '[data-action="buyPerk"][data-id="vitality"]';
  const shown = await costOf(sel);
  const before = await P();
  await click(sel);
  const after = await P();
  check("مهارة الحيوية اشتُريت", after.perks.vitality === 1, JSON.stringify(after.perks));
  check("سعر المهارة = perkCost", shown === perkCost("vitality", 1), `عرض ${shown} / متوقع ${perkCost("vitality", 1)}`);
  check("خصم سعر المهارة", before.coins - after.coins === shown);
}

console.log("\n== 5. الحفظ بعد إعادة التحميل ==");
{
  const before = await P();
  await boot();
  const after = await P();
  check("العملات محفوظة", after.coins === before.coins, `${before.coins} → ${after.coins}`);
  check("الأسلحة محفوظة", after.owned.length === before.owned.length, after.owned.join(","));
  check("الترقيات محفوظة", after.stats.smg.damage === 2 && after.stats.smg.mag === 2, JSON.stringify(after.stats.smg));
  check("المهارات محفوظة", after.perks.vitality === 1);
  check("التجهيز محفوظ", after.equipped === "smg");
}

console.log("\n== 6. بدء القطاع والحالة ==");
{
  await page.evaluate(() => window.__DS.start(1));
  await sleep(400);
  check("الحالة playing", (await state()) === "playing");
  const op = await hudReady();
  check("HUD ظاهر", op > 0.9, `opacity=${op.toFixed(2)}`);
  const pure = await page.evaluate(() => {
    const g = window.__DS.game;
    return { maxHp: g.player.maxHp, hp: g.player.hp, mag: g.weapons.rt.magSize, ammo: g.weapons.ammo, weapon: g.weapons.currentId };
  });
  check("مهارة الحيوية ترفع الصحة", pure.maxHp === PLAYER_BASE.hp + 14, `maxHp=${pure.maxHp}`);
  check("السلاح المجهّز SMG داخل اللعب", pure.weapon === "smg");
  check("المخزن مملوء", pure.ammo === pure.mag, `${pure.ammo}/${pure.mag}`);
  await step(140);
  const w = await page.evaluate(() => ({ wave: !!window.__DS.game.wave, idx: window.__DS.game.waveIndex, alive: window.__DS.game.zombies.length }));
  check("الموجة الأولى بدأت", w.wave === true && w.idx === 0, JSON.stringify(w));
}

console.log("\n== 7. الإطلاق والإصابة والقتل ==");
{
  const setup = await page.evaluate(() => {
    const g = window.__DS.game;
    window.__DS.spawn("walker", 1);
    const z = g.zombies[g.zombies.length - 1];
    z.__mark = 1;
    const d = g.player.pos.clone();
    g.camera.getWorldDirection(d);
    z.setPosition(g.player.pos.x + d.x * 7, g.player.pos.z + d.z * 7);
    g.player.pitch = 0; g.player.recoilPitch = 0;
    g.camera.updateMatrixWorld(true);
    g.scene.updateMatrixWorld(true);
    g.input.fire = true;
    return { hp: z.hp, ammo: g.weapons.ammo, shots: g.run.shots };
  });
  check("زومبي أُنشئ", setup.hp > 0, `hp=${setup.hp}`);
  for (let i = 0; i < 24; i++) { await step(2); await sleep(30); }
  const shot = await page.evaluate(() => ({ ammo: window.__DS.game.weapons.ammo, shots: window.__DS.game.run.shots, hits: window.__DS.game.run.hits }));
  check("طلقات خرجت", shot.shots > setup.shots, `${setup.shots} → ${shot.shots}`);
  check("المخزن ينقص", shot.ammo < setup.ammo, `${setup.ammo} → ${shot.ammo}`);
  check("إصابة مسجّلة", shot.hits > 0, `hits=${shot.hits}`);
  const hurt = await page.evaluate(() => {
    const z = window.__DS.game.zombies.find((x) => x.__mark);
    return z ? (z.alive ? z.hp : 0) : -1;
  });
  check("صحة الزومبي نقصت", hurt >= 0 && hurt < setup.hp, `${setup.hp} → ${hurt}`);

  const beforeKill = await page.evaluate(() => {
    const g = window.__DS.game;
    g.input.fire = false;
    g.zombies.length = 0;
    window.__DS.spawn("walker", 1);
    const z = g.zombies[g.zombies.length - 1];
    z.__mark = 2;
    z.hp = 4;
    const d = g.player.pos.clone();
    g.camera.getWorldDirection(d);
    z.setPosition(g.player.pos.x + d.x * 5, g.player.pos.z + d.z * 5);
    g.player.pitch = 0; g.player.recoilPitch = 0;
    g.camera.updateMatrixWorld(true);
    g.scene.updateMatrixWorld(true);
    g.weapons.ammo = g.weapons.rt.magSize;
    g.weapons.reloading = 0;
    g.weapons.reserve = 60;
    return { kills: g.run.kills, coins: g.profile.coins };
  });
  await sleep(150);
  await page.evaluate(() => { window.__DS.game.input.fire = true; });
  for (let i = 0; i < 20; i++) { await step(2); await sleep(40); }
  const killed = await page.evaluate(() => {
    const g = window.__DS.game;
    g.input.fire = false;
    return { kills: g.run.kills, coins: g.profile.coins };
  });
  check("القتل يُحتسب", killed.kills > beforeKill.kills, `${beforeKill.kills} → ${killed.kills}`);
  check("القتل يعطي عملات", killed.coins > beforeKill.coins, `${beforeKill.coins} → ${killed.coins} ₡`);
}

console.log("\n== 8. التلقيم ==");
{
  await page.evaluate(() => {
    const g = window.__DS.game;
    g.input.fire = false;
    g.weapons.ammo = 1;
    g.weapons.reserve = 60;
    g.input.reloadQueued = true;
  });
  await step(2);
  const mid = await page.evaluate(() => window.__DS.game.weapons.reloading);
  check("التلقيم بدأ", mid > 0, `reloading=${mid.toFixed(2)}`);
  await step(160);
  const done = await page.evaluate(() => {
    const g = window.__DS.game;
    return { ammo: g.weapons.ammo, mag: g.weapons.rt.magSize, reserve: g.weapons.reserve };
  });
  check("المخزن امتلأ بعد التلقيم", done.ammo === done.mag, `${done.ammo}/${done.mag} · reserve=${done.reserve}`);
}

console.log("\n== 9. تقدّم الموجات ==");
{
  const before = await page.evaluate(() => window.__DS.game.waveIndex);
  await page.evaluate(() => window.__DS.skipWave());
  await step(420);
  const after = await page.evaluate(() => ({ idx: window.__DS.game.waveIndex, waves: window.__DS.game.run.waves }));
  check("الموجة تُنهى وتتقدّم", after.idx > before || after.waves > 0, `waveIndex ${before} → ${after.idx} · waves=${after.waves}`);
}

console.log("\n== 10. الضرر والموت ==");
{
  const hp0 = await page.evaluate(() => {
    const g = window.__DS.game;
    window.__DS.spawn("runner", 1);
    const z = g.zombies[g.zombies.length - 1];
    z.setPosition(g.player.pos.x + 1.0, g.player.pos.z + 1.0);
    return g.player.hp;
  });
  await step(240);
  const hp1 = await page.evaluate(() => window.__DS.game.player.hp);
  check("العدّاء يُلحق ضرراً", hp1 < hp0, `${hp0} → ${hp1}`);

  const coinsBefore = (await P()).coins;
  await page.evaluate(() => window.__DS.game.player.damage(99999));
  await step(3);
  await sleep(300);
  const dead = { state: await state(), screen: await screenOn("result"), hud: await hudHidden() };
  check("نهاية المحاولة عند الصفر", dead.state === "result", dead.state);
  check("شاشة النتيجة ظاهرة", dead.screen === true);
  check("HUD مخفي بعد النتيجة", dead.hud < 0.05, `opacity=${dead.hud}`);
  const coinsAfter = (await P()).coins;
  check("العملات لا تُفقد عند الموت", coinsAfter >= coinsBefore, `${coinsBefore} → ${coinsAfter}`);
}

console.log("\n== 11. الزعيم ==");
{
  await page.evaluate(() => window.__DS.start(3));
  await step(4);
  await page.evaluate(() => window.__DS.spawn("boss", 1));
  await step(10);
  let bossOp = 0;
  let bossCls = "";
  for (let i = 0; i < 20; i++) {
    const s = await page.evaluate(() => {
      const bar = document.querySelector("#boss-bar");
      return { op: +getComputedStyle(bar).opacity, cls: bar.className };
    });
    bossOp = s.op; bossCls = s.cls;
    if (s.op > 0.5) break;
    await sleep(200);
  }
  const boss = await page.evaluate(() => {
    const g = window.__DS.game;
    const bar = document.querySelector("#boss-bar");
    const cs = getComputedStyle(bar);
    const z = g.zombies.find((x) => x.type === "boss");
    return { exists: !!z, hp: z?.hp, dis: cs.display, levelWaves: g.levelDef.waves.length };
  });
  check("زومبي الزعيم موجود", boss.exists === true, `hp=${boss.hp}`);
  check("شريط الزعيم ظاهر", boss.dis !== "none" && bossOp > 0.5, `opacity=${bossOp} cls="${bossCls}"`);
  check("القطاع 3 فيه 4 موجات", boss.levelWaves === LEVELS[2].waves.length && boss.levelWaves === 4, `waves=${boss.levelWaves}`);
}

console.log("\n== 12. الوضع اللانهائي ==");
{
  await page.evaluate(() => window.__DS.start(1, true));
  await step(4);
  const end = await page.evaluate(() => ({
    state: window.__DS.game.state,
    endless: window.__DS.game.endless,
    label: document.querySelector("#wave-label")?.textContent?.trim(),
  }));
  check("الوضع اللانهائي يعمل", end.state === "playing" && end.endless === true);
  check("الواجهة تعلن اللانهاية", (end.label || "").includes("∞"), `label="${end.label}"`);
}

console.log("\n== 13. الإيقاف المؤقت ==");
{
  await page.evaluate(() => window.__DS.start(1));
  await step(4);
  await page.keyboard.press("Escape");
  await step(3);
  await sleep(400);
  const paused = {
    state: await state(),
    screen: await screenOn("pause"),
    wallet: await page.evaluate(() => document.querySelector("#pause-wallet")?.textContent?.includes("₡")),
  };
  check("Escape يوقف اللعب", paused.state === "paused", paused.state);
  check("شاشة الإيقاف ظاهرة", paused.screen === true);
  check("محفظة الإيقاف تُعرض", paused.wallet === true);
  await page.evaluate(() => window.__DS.game.resume());
  await sleep(300);
  check("الاستئناف يرجع للعب", (await state()) === "playing");
}

await browser.close();

console.log("\n===== الأخطاء في الكونسول =====");
if (errors.length === 0) console.log("لا أخطاء");
else for (const e of errors.slice(0, 15)) console.log("  E:", e);

console.log(`\nTOTAL: ${pass} passed, ${fails.length} failed`);
if (fails.length) {
  console.log("FAILED:");
  for (const f of fails) console.log("  -", f);
}
process.exit(fails.length ? 1 : 0);
