/* فحص تخطيطي آلي: تداخل/تجاوز/أحجام لمس/خطوط — بلا صور */
import puppeteer from "puppeteer-core";

const BASE = process.env.DS_URL || "http://127.0.0.1:5173";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

const report = [];
function add(scope, level, msg) {
  report.push({ scope, level, msg });
}

/* سكربت داخل الصفحة: يجمع كل المخالفات لشاشة معيّنة */
const auditInPage = (scope, minTouch) => {
  const out = [];
  const vw = innerWidth;
  const vh = innerHeight;
  const screenEl = document.querySelector(".screen.active") || document.body;

  const isVisible = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0.5 && r.height > 0.5;
  };

  // 1) تجاوز أفقي عام
  const de = document.documentElement;
  if (de.scrollWidth > vw + 1) {
    out.push(["error", `overflow-x: page scrollWidth=${de.scrollWidth} > vw=${vw}`]);
  }

  // 2) عناصر خارج الشاشة (مع تجاهل اللي جوّا حاوية تمرير)
  const inScroller = (el) => {
    let p = el.parentElement;
    while (p && p !== document.body) {
      const cs = getComputedStyle(p);
      if (["auto", "scroll"].includes(cs.overflowY) || ["auto", "scroll"].includes(cs.overflowX)) return true;
      p = p.parentElement;
    }
    return false;
  };
  const all = [...screenEl.querySelectorAll("*")];
  for (const el of all) {
    if (!isVisible(el)) continue;
    if (el.closest("#hud,.fx,canvas,#touch-ui")) continue;
    const r = el.getBoundingClientRect();
    if (r.right > vw + 2 || r.left < -2 || r.bottom > vh + 2 || r.top < -2) {
      const tag = el.tagName.toLowerCase();
      if (["html", "body", "main", "section", "div", "header", "footer", "ul", "li"].includes(tag) &&
          !inScroller(el) &&
          (r.right > vw + 8 || r.left < -8 || r.bottom > vh + 8 || r.top < -8)) {
        out.push(["error", `out-of-view ${tag}.${el.className || "-"} rect=${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)} vw=${vw} vh=${vh}`]);
      }
    }
  }

  // 3) أهداف لمس صغيرة
  const taps = [...screenEl.querySelectorAll("button,[data-action],a,input,select")].filter(isVisible);
  for (const el of taps) {
    const r = el.getBoundingClientRect();
    const lab = el.closest("label");
    if (lab && lab.getBoundingClientRect().height >= minTouch) continue; // الحقل جوّا label كبير = هدف اللمس هو الـlabel
    if (r.width < minTouch || r.height < minTouch) {
      out.push(["warn", `small-target ${el.tagName.toLowerCase()}.${el.className || "-"} ${Math.round(r.width)}x${Math.round(r.height)} < ${minTouch}`]);
    }
  }

  // 4) تداخل بين أزرار/عناصر تفاعلية
  for (let i = 0; i < taps.length; i++) {
    for (let j = i + 1; j < taps.length; j++) {
      const a = taps[i].getBoundingClientRect();
      const b = taps[j].getBoundingClientRect();
      const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (ox > 4 && oy > 4) {
        const area = ox * oy;
        const minArea = Math.min(a.width * a.height, b.width * b.height);
        if (area / minArea > 0.25) {
          out.push(["error", `overlap ${taps[i].tagName.toLowerCase()}.${taps[i].className || "-"} × ${taps[j].tagName.toLowerCase()}.${taps[j].className || "-"} (${Math.round(area)}px²)`]);
        }
      }
    }
  }

  // 5) نص مقطوع (truncation غير مقصود)
  for (const el of all) {
    if (!isVisible(el) || el.children.length) continue;
    const cs = getComputedStyle(el);
    const clippedX = el.scrollWidth > el.clientWidth + 2 && cs.overflowX !== "visible" && cs.textOverflow !== "ellipsis";
    const clippedY = el.scrollHeight > el.clientHeight + 2 && cs.overflowY !== "visible" && cs.overflow !== "visible" && el.scrollHeight > 4;
    if (clippedX && el.textContent.trim()) {
      out.push(["warn", `text-clip-x "${el.textContent.trim().slice(0, 40)}" sw=${el.scrollWidth} cw=${el.clientWidth}`]);
    }
    if (clippedY && el.textContent.trim() && cs.maxHeight !== "none") {
      out.push(["warn", `text-clip-y "${el.textContent.trim().slice(0, 40)}" sh=${el.scrollHeight} ch=${el.clientHeight}`]);
    }
  }

  // 6) خطوط صغيرة جداً
  for (const el of all) {
    if (!isVisible(el) || el.children.length) continue;
    const t = el.textContent.trim();
    if (!t) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs && fs < 11) out.push(["warn", `tiny-font ${fs}px "${t.slice(0, 30)}"`]);
  }

  // 7) حاوية قابلة للتمرير بلا مؤشر
  const scrollers = all.filter((el) => {
    const cs = getComputedStyle(el);
    return isVisible(el) && el.scrollHeight > el.clientHeight + 4 &&
      ["auto", "scroll"].includes(cs.overflowY);
  });

  return {
    out,
    info: {
      vw, vh,
      screen: document.querySelector(".screen.active")?.dataset.screen || "-",
      scrollers: scrollers.map((s) => `${s.tagName.toLowerCase()}.${s.className || "-"}:${s.scrollHeight}/${s.clientHeight}`),
      docH: de.scrollHeight,
    },
  };
};

async function audit(page, scope, minTouch = 40) {
  const { out, info } = await page.evaluate(auditInPage, scope, minTouch);
  for (const [level, msg] of out) add(scope, level, msg);
  console.log(`[${scope}] vw=${info.vw} vh=${info.vh} screen=${info.screen} scroll=${info.docH} issues=${out.length}`);
  if (info.scrollers.length) console.log(`   scroll-containers: ${info.scrollers.join(" | ")}`);
}

async function bootDesktop() {
  const page = await browser.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  await page.setViewport({ width: 1600, height: 900 });
  await page.goto(`${BASE}/play/`, { waitUntil: "networkidle2", timeout: 60000 });
  await page.waitForFunction("window.__DS && window.__DS.game", { timeout: 30000 });
  await sleep(900);
  return { page, errors };
}

/* ---------- ديسكتوب ---------- */
{
  const { page, errors } = await bootDesktop();
  await audit(page, "desktop/home");
  for (const s of ["levels", "shop", "upgrades", "rules", "settings"]) {
    await page.evaluate((sn) => {
      window.__DS.game.profile.coins = 9000;
      window.__DS.game.profile.gems = 40;
      window.__DS.game.openScreen(sn);
    }, s);
    await sleep(350);
    await audit(page, `desktop/${s}`);
  }

  // شاشة اللعب + HUD
  await page.evaluate(() => { window.__DS.start(1); window.__DS.god(); });
  await sleep(1600);
  await page.evaluate(() => { window.__DS.spawn("walker", 3); window.__DS.spawn("brute", 1); });
  await sleep(1000);
  await audit(page, "desktop/play");
  const hud = await page.evaluate(() => {
    const ids = ["#hud", "#hud-coins", "#wave-label", "#boss-bar", "#crosshair", "#hud-hint", "#weapon-name", "#ammo-cur"];
    const o = {};
    for (const id of ids) {
      const el = document.querySelector(id);
      o[id] = el ? (() => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
        return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), op: cs.opacity, disp: cs.display }; })() : "MISSING";
    }
    return o;
  });
  console.log("HUD:", JSON.stringify(hud));

  // إيقاف
  await page.keyboard.press("Escape");
  await sleep(700);
  await audit(page, "desktop/pause");

  // نتيجة
  await page.evaluate(() => window.__DS.game.endRun(false));
  await sleep(800);
  await audit(page, "desktop/result");

  if (errors.length) add("desktop/console", "error", errors.join(" || "));
  await page.close();
}

/* ---------- موبايل ---------- */
for (const [w, h, label] of [[430, 900, "iphone15"], [390, 844, "iphone14"], [360, 740, "android-sm"], [820, 1180, "ipad"]]) {
  const page = await browser.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto(`${BASE}/play/`, { waitUntil: "networkidle2", timeout: 60000 });
  await page.waitForFunction("window.__DS && window.__DS.game", { timeout: 30000 });
  await sleep(900);
  await audit(page, `${label}/home`, 44);
  for (const s of ["levels", "shop", "upgrades", "rules", "settings"]) {
    await page.evaluate((sn) => {
      window.__DS.game.profile.coins = 9000;
      window.__DS.game.profile.gems = 40;
      window.__DS.game.openScreen(sn);
    }, s);
    await sleep(300);
    await audit(page, `${label}/${s}`, 44);
  }
  await page.evaluate(() => { window.__DS.start(2); window.__DS.god(); });
  await sleep(1600);
  await page.evaluate(() => { window.__DS.spawn("walker", 3); });
  await sleep(900);
  await audit(page, `${label}/play`, 44);
  const touch = await page.evaluate(() => {
    const o = {};
    for (const el of document.querySelectorAll("#touch-ui,#touch-ui *")) {
      if (!el.id && !el.className) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1) continue;
      o[el.id || el.className] = [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)];
    }
    return { touchDisplay: getComputedStyle(document.getElementById("touch-ui")).display, o };
  });
  console.log(`${label} touch:`, JSON.stringify(touch));
  if (errors.length) add(`${label}/console`, "error", errors.join(" || "));
  await page.close();
}

/* ---------- أفقي على الموبايل ---------- */
{
  const page = await browser.newPage();
  await page.setViewport({ width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto(`${BASE}/play/`, { waitUntil: "networkidle2", timeout: 60000 });
  await page.waitForFunction("window.__DS && window.__DS.game", { timeout: 30000 });
  await sleep(800);
  await audit(page, "landscape/home", 44);
  await page.evaluate(() => window.__DS.start(1));
  await sleep(1500);
  await audit(page, "landscape/play", 44);
  const rot = await page.evaluate(() => {
    const el = document.getElementById("rotate-hint");
    return el ? { display: getComputedStyle(el).display, op: getComputedStyle(el).opacity, text: el.textContent.trim().slice(0, 60) } : "MISSING";
  });
  console.log("rotate:", JSON.stringify(rot));
  await page.close();
}

await browser.close();

/* ---------- التقرير ---------- */
const byScope = {};
for (const r of report) (byScope[r.scope] ||= []).push(r);
console.log("\n===== REPORT =====");
for (const [scope, rows] of Object.entries(byScope)) {
  const errs = rows.filter((x) => x.level === "error");
  const warns = rows.filter((x) => x.level === "warn");
  if (!errs.length && !warns.length) continue;
  console.log(`\n## ${scope} — ${errs.length} error, ${warns.length} warn`);
  for (const r of errs) console.log("  E:", r.msg);
  for (const r of warns.slice(0, 12)) console.log("  W:", r.msg);
  if (warns.length > 12) console.log(`  ... +${warns.length - 12} warn`);
}
const totalE = report.filter((r) => r.level === "error").length;
const totalW = report.filter((r) => r.level === "warn").length;
console.log(`\nTOTAL: ${totalE} errors, ${totalW} warnings`);
