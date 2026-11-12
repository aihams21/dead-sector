/* الواجهات: الرئيسية، المستويات، المتجر، التطوير، الإيقاف، النتائج */
import { WEAPONS, WEAPON_BY_ID, WEAPON_STATS, MAX_STAT_LEVEL, statCost, PERKS, perkCost, LEVELS, RULES, META } from "./config.js";
import { weaponRuntime } from "./weapons.js";

const fmt = (n) => n.toLocaleString("en-US");
const coin = (n) => `<span class="pill coin">₡ ${fmt(n)}</span>`;
const gem = (n) => `<span class="pill gem">✦ ${fmt(n)}</span>`;

function priceTag(cost) {
  const parts = [];
  if (cost.gems) parts.push(gem(cost.gems));
  if (cost.coins) parts.push(coin(cost.coins));
  if (!cost.gems && !cost.coins) parts.push(`<span class="pill free">مملوك</span>`);
  return parts.join("");
}

function statBar(label, value, max) {
  return `<div class="statbar"><i style="width:${Math.round((value / max) * 100)}%"></i><b>${label}</b></div>`;
}

export class UI {
  constructor(profile, hooks) {
    this.profile = profile;
    this.hooks = hooks;
    this.screens = document.querySelectorAll("[data-screen]");
    this.wrap = document.getElementById("screens");
    this.activeWeapon = profile.equipped;
    this.tab = "weapon";
    this.bind();
  }

  bind() {
    document.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      const a = btn.dataset.action;
      const id = btn.dataset.id;
      const h = this.hooks;
      switch (a) {
        case "open": h.onOpen?.(id); break;
        case "close": h.onClose?.(); break;
        case "play": h.onPlay?.(parseInt(id, 10)); break;
        case "endless": h.onEndless?.(); break;
        case "buyWeapon": h.onBuyWeapon?.(id); break;
        case "equip": h.onEquip?.(id); break;
        case "selectWeapon": this.activeWeapon = id; this.renderUpgrades(); break;
        case "upgradeStat": h.onUpgradeWeapon?.(this.activeWeapon, id); break;
        case "buyPerk": h.onBuyPerk?.(id); break;
        case "resume": h.onResume?.(); break;
        case "restart": h.onRestart?.(); break;
        case "next": h.onNextLevel?.(); break;
        case "menu": h.onQuit?.(); break;
        case "tab": this.tab = id; this.renderUpgrades(); break;
        case "reset": if (confirm("محو كل التقدّم؟ لا يمكن الرجوع.")) h.onReset?.(); break;
        case "toggleSound": h.onToggleSound?.(); break;
      }
    });
    document.getElementById("opt-sens")?.addEventListener("input", (e) => this.hooks.onSettings?.({ sens: parseFloat(e.target.value) }));
    document.getElementById("opt-vol")?.addEventListener("input", (e) => this.hooks.onSettings?.({ sound: parseFloat(e.target.value) }));
    document.getElementById("opt-quality")?.addEventListener("change", (e) => this.hooks.onSettings?.({ quality: e.target.value }));
    document.getElementById("opt-invert")?.addEventListener("change", (e) => this.hooks.onSettings?.({ invert: e.target.checked }));
  }

  setProfile(p) { this.profile = p; }

  show(name) {
    this.wrap.classList.add("on");
    for (const s of this.screens) s.classList.toggle("active", s.dataset.screen === name);
    document.body.dataset.screen = name;
  }

  hide() {
    this.wrap.classList.remove("on");
    for (const s of this.screens) s.classList.remove("active");
    document.body.dataset.screen = "";
  }

  refreshHeader() {
    document.querySelectorAll("[data-wallet]").forEach((el) => {
      el.innerHTML = `${coin(this.profile.coins)}${gem(this.profile.gems)}`;
    });
  }

  renderHome() {
    const p = this.profile;
    const cleared = p.progress.cleared;
    const next = Math.min(LEVELS.length, Math.max(1, p.progress.unlocked));
    const lvl = LEVELS[next - 1];
    document.getElementById("home-continue").innerHTML = `
      <div class="continue-card">
        <div class="cc-top"><span class="tag">المهمة الحالية</span><span class="cc-num">${String(next).padStart(2, "0")} / 05</span></div>
        <h3>${lvl.nameAr}</h3>
        <p>${lvl.desc}</p>
        <button class="btn primary big" data-action="play" data-id="${next}">ابدأ المرحلة</button>
      </div>`;
    document.getElementById("home-stats").innerHTML = `
      <div><b>${fmt(p.stats.kills)}</b><span>زومبي مُصفّى</span></div>
      <div><b>${fmt(p.stats.headshots)}</b><span>إصابة رأس</span></div>
      <div><b>${cleared}/5</b><span>مراحل مكتملة</span></div>
      <div><b>${fmt(p.progress.bestEndless)}</b><span>أفضل موجة لا نهائية</span></div>`;
    this.refreshHeader();
  }

  renderLevels() {
    const p = this.profile;
    const el = document.getElementById("levels-list");
    el.innerHTML = LEVELS.map((l) => {
      const unlocked = l.id <= p.progress.unlocked;
      const cleared = l.id <= p.progress.cleared;
      const total = l.waves.reduce((s, w) => s + Object.entries(w).filter(([k]) => k !== "rate" && k !== "bossWave").reduce((a, [, v]) => a + v, 0), 0);
      return `
      <article class="level-card ${unlocked ? "" : "locked"} ${cleared ? "cleared" : ""}">
        <div class="lc-head">
          <span class="lc-id">${String(l.id).padStart(2, "0")}</span>
          <div>
            <h4>${l.nameAr}</h4>
            <span class="lc-en">${l.name}</span>
          </div>
          ${cleared ? `<span class="badge done">مكتملة</span>` : unlocked ? `<span class="badge">متاحة</span>` : `<span class="badge lock">مقفلة</span>`}
        </div>
        <p>${l.desc}</p>
        <div class="lc-meta">
          <span>${l.waves.length} موجات</span>
          <span>${total} هدف</span>
          <span>${l.waves.some((w) => w.bossWave) ? "زعيم" : "بدون زعيم"}</span>
        </div>
        <div class="lc-reward">${coin(l.reward.coins)}${l.reward.gems ? gem(l.reward.gems) : ""}</div>
        <button class="btn ${unlocked ? "primary" : "ghost"}" ${unlocked ? `data-action="play" data-id="${l.id}"` : "disabled"}>
          ${unlocked ? (cleared ? "أعد المحاولة" : "ابدأ") : "أكمل المرحلة السابقة"}
        </button>
      </article>`;
    }).join("") + `
      <article class="level-card endless">
        <div class="lc-head">
          <span class="lc-id">∞</span>
          <div><h4>${"القطاع اللانهائي"}</h4><span class="lc-en">Endless Sector</span></div>
          <span class="badge">بعد المرحلة 5</span>
        </div>
        <p>موجات بلا نهاية، صعوبة تتصاعد، وعملات أكثر 35%. كل موجة تحطّم رقمك القياسي.</p>
        <div class="lc-meta"><span>أفضل موجة: ${p.progress.bestEndless}</span><span>مكافأة مضاعفة</span></div>
        <button class="btn ${p.progress.cleared >= 5 ? "primary" : "ghost"}" ${p.progress.cleared >= 5 ? `data-action="endless"` : "disabled"}>
          ${p.progress.cleared >= 5 ? "ادخل القطاع" : "أكمل المراحل الخمس أولاً"}
        </button>
      </article>`;
    this.refreshHeader();
  }

  renderShop() {
    const p = this.profile;
    const el = document.getElementById("shop-grid");
    el.innerHTML = WEAPONS.map((w) => {
      const owned = p.owned.includes(w.id);
      const equipped = p.equipped === w.id;
      const rt = weaponRuntime(w, p.weaponStats[w.id]);
      const dps = Math.round((rt.damage * rt.pellets) / rt.interval);
      const canAfford = (p.coins >= (w.cost.coins || 0)) && (p.gems >= (w.cost.gems || 0));
      return `
      <article class="wcard ${owned ? "owned" : ""} ${equipped ? "equipped" : ""}">
        <div class="wc-top">
          <span class="tier">T${w.tier}</span>
          <h4>${w.nameAr}</h4>
          <span class="wc-en">${w.name}</span>
        </div>
        <div class="wc-stats">
          ${statBar("ضرر", rt.damage * rt.pellets, 180)}
          ${statBar("سرعة", 1150 - Math.min(1100, rt.interval * 1000), 1150)}
          ${statBar("مخزن", rt.magSize, 240)}
          ${statBar("DPS", dps, 900)}
        </div>
        <p class="wc-desc">${w.desc}</p>
        <div class="wc-foot">
          <div class="wc-price">${owned ? (equipped ? `<span class="pill on">مُجهّز</span>` : `<span class="pill free">مملوك</span>`) : priceTag(w.cost)}</div>
          ${owned
            ? `<button class="btn small ${equipped ? "ghost" : "primary"}" ${equipped ? "disabled" : `data-action="equip" data-id="${w.id}"`}>${equipped ? "قيد الاستخدام" : "تجهيز"}</button>`
            : `<button class="btn small ${canAfford ? "primary" : "ghost"}" data-action="buyWeapon" data-id="${w.id}">شراء</button>`}
        </div>
      </article>`;
    }).join("");
    this.refreshHeader();
  }

  renderUpgrades() {
    const p = this.profile;
    const tabs = document.getElementById("up-tabs");
    tabs.innerHTML = `
      <button class="tab ${this.tab === "weapon" ? "on" : ""}" data-action="tab" data-id="weapon">ترقية الأسلحة</button>
      <button class="tab ${this.tab === "perk" ? "on" : ""}" data-action="tab" data-id="perk">مهارات الناجي</button>`;
    const body = document.getElementById("up-body");
    if (this.tab === "weapon") {
      if (!p.owned.includes(this.activeWeapon)) this.activeWeapon = p.owned[0];
      const list = p.owned.map((id) => {
        const w = WEAPON_BY_ID[id];
        return `<button class="chip ${this.activeWeapon === id ? "on" : ""}" data-action="selectWeapon" data-id="${id}">${w.nameAr}</button>`;
      }).join("");
      const w = WEAPON_BY_ID[this.activeWeapon];
      const st = p.weaponStats[this.activeWeapon] || { damage: 1, rate: 1, mag: 1, reload: 1 };
      const rows = Object.entries(WEAPON_STATS).map(([key, s]) => {
        const lvl = st[key] || 1;
        const maxed = lvl >= MAX_STAT_LEVEL;
        const cost = statCost(w, key, lvl);
        const pips = Array.from({ length: MAX_STAT_LEVEL }, (_, i) => `<i class="${i < lvl ? "on" : ""}"></i>`).join("");
        return `
          <div class="urow">
            <div class="uinfo">
              <b>${s.nameAr}</b>
              <span>مستوى ${lvl} / ${MAX_STAT_LEVEL} · ${lvl > 1 ? s.fmt((lvl - 1) * s.per) : "الافتراضي"}</span>
              <div class="pips">${pips}</div>
            </div>
            <button class="btn small ${maxed ? "ghost" : p.coins >= cost ? "primary" : "ghost"}" ${maxed ? "disabled" : `data-action="upgradeStat" data-id="${key}"`}>
              ${maxed ? "أقصى" : coin(cost)}
            </button>
          </div>`;
      }).join("");
      const rt = weaponRuntime(w, st);
      body.innerHTML = `
        <div class="level-chips">${list}</div>
        <div class="up-grid">
          <div class="up-hero">
            <span class="tag">${w.name}</span>
            <h3>${w.nameAr}</h3>
            <p>${w.desc}</p>
            <div class="up-numbers">
              <div><b>${(rt.damage * rt.pellets).toFixed(0)}</b><span>ضرر/طلقة</span></div>
              <div><b>${Math.round((rt.damage * rt.pellets) / rt.interval)}</b><span>DPS تقديري</span></div>
              <div><b>${rt.magSize}</b><span>مخزن</span></div>
              <div><b>${rt.reloadTime.toFixed(2)}s</b><span>تلقيم</span></div>
            </div>
          </div>
          <div class="up-rows">${rows}</div>
        </div>`;
    } else {
      const rows = Object.entries(PERKS).map(([key, perk]) => {
        const lvl = p.perks[key] || 0;
        const maxed = lvl >= perk.max;
        const cost = perkCost(key, lvl + 1);
        const pips = Array.from({ length: perk.max }, (_, i) => `<i class="${i < lvl ? "on" : ""}"></i>`).join("");
        return `
          <div class="urow perk">
            <div class="uicon">${perk.icon}</div>
            <div class="uinfo">
              <b>${perk.nameAr}</b>
              <span>${perk.desc} · مستوى ${lvl}/${perk.max}</span>
              <div class="pips">${pips}</div>
            </div>
            <button class="btn small ${maxed ? "ghost" : p.coins >= cost ? "primary" : "ghost"}" ${maxed ? "disabled" : `data-action="buyPerk" data-id="${key}"`}>
              ${maxed ? "أقصى" : coin(cost)}
            </button>
          </div>`;
      }).join("");
      body.innerHTML = `
        <div class="up-grid single">
          <div class="up-hero">
            <span class="tag">دائم</span>
            <h3>مهارات الناجي</h3>
            <p>ترقيات تبقى معك في كل المراحل. تُشترى بالعملات فقط، وتبقى بعد أي فشل.</p>
            <div class="up-numbers">
              <div><b>${Math.round(100 + (p.perks.vitality || 0) * PERKS.vitality.per)}</b><span>أقصى صحة</span></div>
              <div><b>${Math.round((p.perks.armor || 0) * PERKS.armor.per * 100)}%</b><span>تقليل ضرر</span></div>
              <div><b>+${Math.round((p.perks.agility || 0) * PERKS.agility.per * 100)}%</b><span>سرعة</span></div>
              <div><b>+${Math.round((p.perks.scavenger || 0) * PERKS.scavenger.per * 100)}%</b><span>عملات</span></div>
            </div>
          </div>
          <div class="up-rows">${rows}</div>
        </div>`;
    }
    this.refreshHeader();
  }

  renderSettings() {
    const s = this.profile.settings;
    const sens = document.getElementById("opt-sens");
    const vol = document.getElementById("opt-vol");
    const q = document.getElementById("opt-quality");
    const inv = document.getElementById("opt-invert");
    if (sens) sens.value = s.sens;
    if (vol) vol.value = s.sound;
    if (q) q.value = s.quality;
    if (inv) inv.checked = s.invert;
    const soundBtn = document.getElementById("opt-sound-state");
    if (soundBtn) soundBtn.textContent = s.sound > 0 ? "الصوت مفعّل" : "الصوت مكتوم";
  }

  renderRules() {
    document.getElementById("rules-body").innerHTML = `
      <div class="rules-grid">
        <article><h4>الاقتصاد</h4>
          <ul>
            <li>كل زومبي يسقط عملات <b>₡</b> على الأرض — تُجمع تلقائياً عند الاقتراب.</li>
            <li>إصابة الرأس تعطي <b>+${RULES.coinPerHeadshot} ₡</b> إضافية لكل هدف.</li>
            <li>إنهاء الموجة يعطي مكافأة، وإنهاء المرحلة يعطي عملات وبلّورات <b>✦</b>.</li>
            <li><b>البلّورات</b> تُسقط من الزعماء فقط، ومنها تُشترى الأسلحة القوية.</li>
            <li>العملات المستهلكة لا تُسترد — لا يوجد بيع عكسي.</li>
          </ul>
        </article>
        <article><h4>الصعوبة</h4>
          <ul>
            <li>صحة الزومبي تزيد <b>${Math.round(15 / 62 * 100)}%</b> تقريباً لكل مرحلة، وضرره <b>9%</b> لكل مرحلة.</li>
            <li>كل مرحلة تفتح نوعاً جديداً: الزاحف ← العدّاء ← الضخم ← الزعيم.</li>
            <li>عدد الأهداف في الموجة يزيد، والفاصل بين الموجات يقصر.</li>
            <li>القطاع اللانهائي: صحة +14% لكل موجة و3 أعداء إضافيين.</li>
          </ul>
        </article>
        <article><h4>القتال</h4>
          <ul>
            <li>الطلقات تُحسب فورياً (Hitscan) — لا يوجد تباطؤ للرصاص.</li>
            <li>إصابة الرأس تضاعف الضرر: مسدس ×2.3، قناصة ×3.</li>
            <li>سلاح ARC-9 يخترق 3 أهداف في خط واحد.</li>
            <li>الصحة تتجدد ببطء بعد ${PLAYER_REGEN} ثانية بلا ضرر، والمسعف يعطي +${RULES.medkitHeal}.</li>
            <li>الذخيرة محدودة لكل سلاح؛ صناديق الذخيرة تعيد ${Math.round(RULES.ammoCrateRestore * 100)}% من الاحتياطي.</li>
          </ul>
        </article>
        <article><h4>التقدّم</h4>
          <ul>
            <li>كل شيء يُحفظ محلياً على جهازك تلقائياً.</li>
            <li>التطوير بلا حد للخسارة: الأسلحة والمهارات تبقى بعد الموت.</li>
            <li>أقصى مستوى لكل خاصية سلاح: ${MAX_STAT_LEVEL}.</li>
            <li>المرحلة التالية تُفتح فقط بعد إكمال السابقة.</li>
          </ul>
        </article>
      </div>`;
  }

  renderResult(data) {
    const el = document.getElementById("result-panel");
    const win = data.win;
    el.innerHTML = `
      <span class="tag">${win ? "القطاع آمن… مؤقتاً" : "سقطت في القطاع"}</span>
      <h2>${win ? "أُنجزت المهمة" : "انتهت المحاولة"}</h2>
      <p>${win ? `أكملت ${data.levelName} في ${data.time}` : `صمدت حتى الموجة ${data.wave} من ${data.waves}`}</p>
      <div class="result-stats">
        <div><b>${fmt(data.kills)}</b><span>قتيل</span></div>
        <div><b>${fmt(data.headshots)}</b><span>إصابة رأس</span></div>
        <div><b>${fmt(data.coins)} ₡</b><span>عملات</span></div>
        <div><b>${fmt(data.gems)} ✦</b><span>بلّورات</span></div>
        <div><b>${data.accuracy}%</b><span>دقة</span></div>
        <div><b>${fmt(data.xp)}</b><span>هدف</span></div>
      </div>
      <div class="result-actions">
        ${win && data.hasNext ? `<button class="btn primary big" data-action="next">المرحلة التالية</button>` : ""}
        <button class="btn ${win ? "ghost" : "primary"} big" data-action="restart">${win ? "إعادة" : "حاول مرة أخرى"}</button>
        <button class="btn ghost" data-action="menu">القائمة</button>
      </div>`;
  }
}

const PLAYER_REGEN = 9;
