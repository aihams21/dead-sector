/* فحص آلي لصفحة العرض: تجاوز/خطوط/صور/محتوى — بلا صور */
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
    "--hide-scrollbars",
    "--mute-audio",
    "--font-render-hinting=none",
  ],
});

const report = [];
const add = (scope, level, msg) => report.push({ scope, level, msg });

const auditInPage = (minTouch) => {
  const out = [];
  const vw = innerWidth;

  const isVisible = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0.5 && r.height > 0.5;
  };

  const de = document.documentElement;
  if (de.scrollWidth > vw + 1) {
    out.push(["error", `overflow-x: scrollWidth=${de.scrollWidth} > vw=${vw}`]);
  }

  // عناصر أوسع من الشاشة (عدا الحاويات المقصودة)
  const inScroller = (el) => {
    let p = el.parentElement;
    while (p && p !== document.body) {
      const cs = getComputedStyle(p);
      if (["auto", "scroll", "hidden"].includes(cs.overflowX)) return true;
      p = p.parentElement;
    }
    return false;
  };
  const all = [...document.querySelectorAll("body *")];
  for (const el of all) {
    if (!isVisible(el)) continue;
    if (el.closest(".glow,.grain,#lb-marquee")) continue;
    const r = el.getBoundingClientRect();
    if ((r.right > vw + 6 || r.left < -6) && !inScroller(el)) {
      const tag = el.tagName.toLowerCase();
      if (["div", "section", "article", "header", "footer", "ul", "li", "table", "figure", "p", "h1", "h2", "h3", "main", "nav"].includes(tag)) {
        out.push(["error", `out-of-view ${tag}.${(el.className || "-").toString().slice(0, 40)} rect=${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)} vw=${vw}`]);
      }
    }
  }

  // أهداف لمس
  const taps = [...document.querySelectorAll("a,button,summary,input,select,[role=button]")].filter(isVisible);
  for (const el of taps) {
    const r = el.getBoundingClientRect();
    if (getComputedStyle(el).display === "inline") continue;
    if (r.height < minTouch && !el.closest("summary")) {
      out.push(["warn", `small-target ${el.tagName.toLowerCase()}.${(el.className || "-").toString().slice(0, 28)} ${Math.round(r.width)}x${Math.round(r.height)} < ${minTouch}`]);
    }
  }

  // خطوط صغيرة
  for (const el of all) {
    if (!isVisible(el) || el.children.length) continue;
    const t = el.textContent.trim();
    if (!t) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs && fs < 11) out.push(["warn", `tiny-font ${fs}px "${t.slice(0, 30)}"`]);
  }

  // صور مكسورة
  for (const img of document.querySelectorAll("img")) {
    const src = img.getAttribute("src");
    if (!src) continue; // lightbox فارغة قبل الفتح
    if (!img.complete || img.naturalWidth === 0) {
      out.push(["error", `broken-img ${src}`]);
    }
  }

  // محتوى حقيقي داخل كل قسم
  const sections = [...document.querySelectorAll("section[id]")].map((s) => ({
    id: s.id,
    h: Math.round(s.getBoundingClientRect().height),
    txt: s.innerText.replace(/\s+/g, " ").trim().length,
    kids: s.querySelectorAll("article,li,details,tr").length,
  }));

  return {
    out,
    info: {
      vw,
      docH: de.scrollHeight,
      sections,
      counts: {
        weapons: document.querySelectorAll("#weapons article").length,
        levels: document.querySelectorAll("#levels article").length,
        enemies: document.querySelectorAll("#enemies-grid article").length,
        rules: document.querySelectorAll("#rules-list details").length,
        faq: document.querySelectorAll("#faq-list details").length,
        shots: document.querySelectorAll("#gallery-grid .shot").length,
        perks: document.querySelectorAll("#perks .perk").length,
        stats: document.querySelectorAll("#stat-list .stat-row").length,
        hero: document.querySelectorAll("#hero-stats .stat").length,
        why: document.querySelectorAll("#why-cards .card").length,
        wrows: document.querySelectorAll("#weapon-table tbody tr").length,
      },
    },
  };
};

async function run(label, w, h, mobile) {
  const page = await browser.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  await page.setViewport({ width: w, height: h, deviceScaleFactor: mobile ? 2 : 1, isMobile: !!mobile, hasTouch: !!mobile });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle2", timeout: 60000 });
  await sleep(700);

  // مرّر الصفحة لتحفيز reveal/counters وحمّل كل الصور
  await page.evaluate(async () => {
    document.querySelectorAll("img").forEach((i) => { i.loading = "eager"; });
    const step = innerHeight * 0.8;
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 80));
    }
    scrollTo(0, 0);
    await Promise.all([...document.images].filter((i) => i.src).map((i) => i.decode().catch(() => {})));
  });
  await sleep(600);

  const touch = mobile ? 44 : 40;
  const r = await page.evaluate(auditInPage, touch);
  for (const [level, msg] of r.out) add(`${label}`, level, msg);
  const broken = r.info.sections.filter((s) => s.txt < 40 || s.h < 40);
  const empty = Object.entries(r.info.counts).filter(([, v]) => v === 0);
  console.log(`[${label}] ${w}x${h} h=${r.info.docH} issues=${r.out.length} counts=${JSON.stringify(r.info.counts)}`);
  console.log(`   sections: ${r.info.sections.map((s) => `${s.id}:${s.h}px/${s.txt}ch`).join(" ")}`);
  if (broken.length) add(label, "error", `empty/short sections: ${broken.map((s) => s.id).join(",")}`);
  if (empty.length) add(label, "error", `empty blocks: ${empty.map((e) => e[0]).join(",")}`);
  if (errors.length) add(`${label}/console`, "error", errors.join(" || "));
  await page.close();
}

for (const [w, h, label, mobile] of [
  [1600, 900, "desktop-1600", false],
  [1366, 768, "laptop-1366", false],
  [1024, 768, "tablet-1024", false],
  [820, 1180, "ipad-820", true],
  [430, 900, "mobile-430", true],
  [390, 844, "mobile-390", true],
  [360, 740, "mobile-360", true],
  [844, 390, "landscape-844", true],
]) {
  await run(label, w, h, mobile);
}

await browser.close();

const byScope = {};
for (const r of report) (byScope[r.scope] ||= []).push(r);
console.log("\n===== REPORT =====");
for (const [scope, rows] of Object.entries(byScope)) {
  const errs = rows.filter((x) => x.level === "error");
  const warns = rows.filter((x) => x.level === "warn");
  if (!errs.length && !warns.length) continue;
  console.log(`\n## ${scope} — ${errs.length} error, ${warns.length} warn`);
  for (const r of errs) console.log("  E:", r.msg);
  for (const r of warns.slice(0, 8)) console.log("  W:", r.msg);
  if (warns.length > 8) console.log(`  ... +${warns.length - 8} warn`);
}
const totalE = report.filter((r) => r.level === "error").length;
const totalW = report.filter((r) => r.level === "warn").length;
console.log(`\nTOTAL: ${totalE} errors, ${totalW} warnings`);
