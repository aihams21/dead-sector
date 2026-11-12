/* ============================================================
   DEAD SECTOR — صفحة العرض: كل الأرقام تُقرأ من config.js نفسه
   ============================================================ */
import {
  META, RULES, PLAYER_BASE, WEAPONS, WEAPON_STATS, MAX_STAT_LEVEL, statCost,
  PERKS, perkCost, ZOMBIE_TYPES, LEVELS, ENDLESS, CONTROLS, TOUCH_CONTROLS,
} from "../play/src/config.js";

const $ = (s, r = document) => r.querySelector(s);
const nf = new Intl.NumberFormat("en-US");
const n = (v) => nf.format(Math.round(v));

const el = (tag, cls, html) => {
  const d = document.createElement(tag);
  if (cls) d.className = cls;
  if (html != null) d.innerHTML = html;
  return d;
};

const totalEnemies = (lv) =>
  lv.waves.reduce((s, w) => s + (w.walker || 0) + (w.runner || 0) + (w.brute || 0) + (w.boss || 0), 0);

const hex = (v) => `#${v.toString(16).padStart(6, "0")}`;

/* ============================================================
   01 · HERO
   ============================================================ */
const heroStats = [
  { v: LEVELS.length, l: "قطاعات كاملة" },
  { v: WEAPONS.length, l: "أسلحة قابلة للتطوير" },
  { v: Object.keys(ZOMBIE_TYPES).length, l: "أنواع مصابين" },
  { v: WEAPONS.length * Object.keys(WEAPON_STATS).length * MAX_STAT_LEVEL, l: "ترقية سلاح ممكنة" },
];
$("#hero-stats").append(
  ...heroStats.map((s) => el("div", "stat", `<b data-count="${s.v}">0</b><span>${s.l}</span>`))
);

/* ============================================================
   شريط متحرك
   ============================================================ */
const ribbonWords = [
  "DEAD SECTOR", "خمس قطاعات", "سبعة أسلحة", "منظور أول 3D", "زعماء",
  "بلّورات", "بلا تنزيل", "هاتف ولابتوب", "حفظ تلقائي", "اقتصاد مكشوف",
];
$("#ribbon").innerHTML = [...ribbonWords, ...ribbonWords].map((w) => `<span>${w}</span>`).join("");

/* ============================================================
   02 · لماذا
   ============================================================ */
const WHY = [
  {
    ico: "⛨",
    t: "لعبة كاملة، لا تجربة",
    d: "خمس قطاعات، كل واحد بأجوائه وموجاته وزعيمه. تقدّم محفوظ، ترسانة تُفتح تدريجياً، ونهاية حقيقية للمهمة.",
  },
  {
    ico: "◈",
    t: "يعمل على أي جهاز",
    d: "مبني على three.js بجودة رسم تتكيّف مع الجهاز: ضباب ومدى رؤية أقل على الهاتف، وتحكّم لمسي كامل بجانب الفأرة والكيبورد.",
  },
  {
    ico: "₡",
    t: "اقتصاد مكتوب بالأرقام",
    d: "لا صناديق ولا مفاجآت. سعر كل سلاح وكل ترقية وكل مصدر عملة معلن في هذه الصفحة قبل ما تلعب.",
  },
  {
    ico: "✦",
    t: "عملة قوية بمصدر واحد",
    d: "البلّورات لا تُشترى بمال. مصدرها الزعماء والصناديق النادرة ومكافآت القطاعات — يعني لازم تقاتل عشانها.",
  },
  {
    ico: "☠",
    t: "أعداء يفرضون أسلوباً",
    d: "العدّاء يقطع المسافة، الضخم يمتص الرصاص، والزعيم يحتاج تخطيط. كل نوع يغيّر طريقة تعاملك مع الغرفة.",
  },
  {
    ico: "∞",
    t: "قطاع لا نهائي",
    d: "بعد المهمة: موجات بلا سقف، صحة الأعداء تصعد 14% كل موجة، و1.35× مضاعف عملات. هنا يبدأ السباق الحقيقي.",
  },
];
$("#why-cards").append(
  ...WHY.map((c, i) =>
    el(
      "article",
      "card reveal",
      `<span class="n">${String(i + 1).padStart(2, "0")}</span>
       <span class="card-ico" aria-hidden="true">${c.ico}</span>
       <h3>${c.t}</h3><p>${c.d}</p>`
    )
  )
);

/* ============================================================
   03 · القطاعات
   ============================================================ */
$("#levels").append(
  ...LEVELS.map((lv) => {
    const waves = lv.waves.length;
    const enemies = totalEnemies(lv);
    const bosses = lv.waves.reduce((s, w) => s + (w.boss || 0), 0);
    return el(
      "article",
      "level reveal",
      `<span class="level-id">${String(lv.id).padStart(2, "0")}</span>
       <div class="level-body">
         <h3>${lv.nameAr}<span class="lat">${lv.name}</span></h3>
         <p>${lv.desc}</p>
       </div>
       <div class="level-meta">
         <span class="chip">${waves} موجات</span>
         <span class="chip">${enemies} هدف</span>
         ${bosses ? `<span class="chip boss">☠ ${bosses} زعيم</span>` : `<span class="chip">بدون زعيم</span>`}
         <span class="chip reward">₡ ${n(lv.reward.coins)}</span>
         ${lv.reward.gems ? `<span class="chip gem">✦ ${lv.reward.gems}</span>` : ""}
       </div>`
    );
  })
);

/* ============================================================
   04 · الترسانة
   ============================================================ */
$("#weapons").append(
  ...WEAPONS.map((w) => {
    const premium = (w.cost.gems || 0) > 0;
    const price = w.cost.coins === 0 && !premium
      ? `<span class="free-pill">مجاني — سلاح البداية</span>`
      : `${n(w.cost.coins)} ₡${premium ? ` <span class="gem" style="color:var(--gem)">+ ${w.cost.gems} ✦</span>` : ""}`;
    return el(
      "article",
      `weapon reveal${premium ? " premium" : ""}`,
      `<div class="weapon-top">
         <h3>${w.nameAr}<span class="lat">${w.name}</span></h3>
         <span class="weapon-tier">T${w.tier}</span>
       </div>
       <p>${w.desc}</p>
       <div class="weapon-specs">
         <div><b>${w.damage}</b><span>ضرر</span></div>
         <div><b>${w.rpm}</b><span>طلقة/د</span></div>
         <div><b>${w.mag}</b><span>مخزن</span></div>
       </div>
       <div class="weapon-price${premium ? " gems" : ""}">${price}</div>`
    );
  })
);

/* جدول المواصفات */
const wTable = $("#weapon-table");
wTable.innerHTML = `
  <caption>مواصفات كاملة — نفس أرقام ملف موازنة اللعبة (${META.version})</caption>
  <thead>
    <tr>
      <th>السلاح</th><th>المستوى</th><th>ضرر</th><th>معدل</th><th>مخزن</th>
      <th>تلقيم</th><th>اختراق</th><th>مدى</th><th>السعر</th>
    </tr>
  </thead>
  <tbody>
    ${WEAPONS.map(
      (w) => `<tr>
      <td>${w.nameAr}</td>
      <td class="num muted">T${w.tier}</td>
      <td class="num">${w.damage}${w.pellets > 1 ? ` ×${w.pellets}` : ""}</td>
      <td class="num">${w.rpm}</td>
      <td class="num">${w.mag}</td>
      <td class="num">${w.reload}s</td>
      <td class="num">${w.pierce}</td>
      <td class="num">${w.range}m</td>
      <td class="num ${w.cost.gems ? "gem" : "coin"}">${
        w.cost.coins === 0 && !w.cost.gems ? "مجاني" : `${n(w.cost.coins)} ₡${w.cost.gems ? ` + ${w.cost.gems} ✦` : ""}`
      }</td>
    </tr>`
    ).join("")}
  </tbody>`;

/* ============================================================
   05 · التطوير
   ============================================================ */
const STAT_HINTS = {
  damage: "لكل مستوى: +9% ضرر",
  rate: "لكل مستوى: +4.5% معدل نيران",
  mag: "لكل مستوى: +9% سعة المخزن",
  reload: "لكل مستوى: −5% زمن التلقيم",
};
$("#stat-list").append(
  ...Object.entries(WEAPON_STATS).map(([key, st]) =>
    el(
      "div",
      "stat-row",
      `<div>
         <h4>${st.nameAr}</h4>
         <small>${STAT_HINTS[key] || st.fmt(st.per)}</small>
       </div>
       <div class="pips" aria-label="${MAX_STAT_LEVEL} مستويات">${Array.from({ length: MAX_STAT_LEVEL }, (_, i) =>
         `<i class="${i === 0 ? "on" : ""}"></i>`
       ).join("")}</div>
       <span class="lvl">${MAX_STAT_LEVEL} مستويات</span>`
    )
  )
);

$("#perks").append(
  ...Object.entries(PERKS).map(([key, p]) =>
    el(
      "div",
      "perk",
      `<span class="perk-ico" aria-hidden="true">${p.icon}</span>
       <div><h4>${p.nameAr}</h4><p>${p.desc}</p></div>
       <span class="max">${p.max} مستويات · من ${n(perkCost(key, 1))} ₡</span>`
    )
  )
);

/* منحنى التكلفة على مسدس الخدمة */
const pistol = WEAPONS[0];
const curve = Array.from({ length: MAX_STAT_LEVEL }, (_, i) => statCost(pistol, "damage", i + 1));
const peak = Math.max(...curve);
$("#cost-bars").innerHTML = curve
  .map(
    (c, i) =>
      `<li><i style="--h:${Math.max(6, (c / peak) * 100)}%;--d:${i * 0.06}s"></i>
       <span>${i + 1}</span></li>`
  )
  .join("");

/* ============================================================
   06 · الأعداء
   ============================================================ */
const ENEMY_NOTE = {
  walker: "العمود الفقري لكل موجة. بطيء، لكنه يظهر بأعداد كبيرة.",
  runner: "يقطع المسافة بسرعة ويضرب بسرعة — يُسقط أولاً.",
  brute: "يحتاج مخزناً كاملاً أو رصاصة مخترقة. يعطي بلّورة.",
  boss: "يظهر في نهاية القطاع. صحة هائلة وضرر يقتل بأربع ضربات.",
};
$("#enemies-grid").append(
  ...Object.entries(ZOMBIE_TYPES).map(([key, z]) =>
    el(
      "article",
      "enemy reveal",
      `<h3>${z.nameAr}<span class="lat">${key.toUpperCase()}</span></h3>
       <dl>
         <div><dt>الصحة</dt><dd>${n(z.hp)}</dd></div>
         <div><dt>لكل موجة</dt><dd>+${n(z.growth)}</dd></div>
         <div><dt>السرعة</dt><dd>${z.speed}</dd></div>
         <div><dt>الضرر</dt><dd>${z.dmg}</dd></div>
         <div><dt>عملات</dt><dd style="color:var(--coin)">₡ ${z.coins}</dd></div>
         <div><dt>بلّورات</dt><dd style="color:var(--gem)">✦ ${z.gems}</dd></div>
       </dl>
       <p class="tagline">${ENEMY_NOTE[key] || ""}</p>`
    )
  )
);

/* ============================================================
   07 · الاقتصاد
   ============================================================ */
const coinSrc = [
  ["زاحف", ZOMBIE_TYPES.walker.coins, "coin"],
  ["عدّاء", ZOMBIE_TYPES.runner.coins, "coin"],
  ["ضخم", ZOMBIE_TYPES.brute.coins, "coin"],
  ["زعيم", ZOMBIE_TYPES.boss.coins, "coin"],
  ["إصابة رأس (زيادة)", `+${RULES.coinPerHeadshot}`, "acid"],
  ["إنهاء موجة (× رقم الموجة)", `+${RULES.waveClearBonus(1)}`, "coin"],
  ["إنهاء قطاع (× رقم القطاع)", `+${n(RULES.levelClearCoins(1))} فأكثر`, "coin"],
];
$("#coin-sources").innerHTML = coinSrc
  .map(([k, v, c]) => `<li><span>${k}</span><b class="${c}">${typeof v === "number" ? n(v) : v} ₡</b></li>`)
  .join("");

const gemSrc = [
  ["إسقاط ضخم", `${ZOMBIE_TYPES.brute.gems} ✦`, "gem"],
  ["إسقاط زعيم", `${ZOMBIE_TYPES.boss.gems} ✦`, "gem"],
  ["صندوق بلّورات نادر", `${(RULES.gemCacheChance * 100).toFixed(1)}% فرصة`, "gem"],
  ["إتمام قطاع 2–5", "1 – 3 ✦", "gem"],
  ["سعر السلاح الأول بالبلّورات", `${WEAPONS.find((w) => w.id === "railgun").cost.gems} ✦`, "gem"],
  ["أغلى سلاح", `${WEAPONS.find((w) => w.id === "hellfire").cost.gems} ✦`, "gem"],
];
$("#gem-sources").innerHTML = gemSrc
  .map(([k, v, c]) => `<li><span>${k}</span><b class="${c}">${v}</b></li>`)
  .join("");

const drops = [
  ["صندوق ذخيرة", `${(RULES.ammoCrateChance * 100).toFixed(0)}% · يستعيد ${RULES.ammoCrateRestore * 100}%`, "acid"],
  ["حقيبة إسعاف", `${(RULES.medkitChance * 100).toFixed(0)}% · تعالج ${RULES.medkitHeal}`, "acid"],
  ["بلّورة مفردة", `${(RULES.gemCacheChance * 100).toFixed(1)}%`, "gem"],
  ["تجاذب الغنائم", `${RULES.magnetRadius}m`, ""],
  ["التقاط تلقائي", `${RULES.pickupRadius}m`, ""],
  ["أقصى زومبي حي (لابتوب)", `${RULES.maxZombiesAlive}`, ""],
  ["أقصى زومبي حي (هاتف)", `${RULES.maxZombiesAliveMobile}`, ""],
];
$("#drops").innerHTML = drops
  .map(([k, v, c]) => `<li><span>${k}</span><b class="${c}">${v}</b></li>`)
  .join("");

/* ============================================================
   08 · التحكّم
   ============================================================ */
$("#controls-desktop").innerHTML = CONTROLS.map(
  (c) => `<li><kbd>${c.k}</kbd><span>${c.ar}</span></li>`
).join("");
$("#controls-touch").innerHTML = TOUCH_CONTROLS.map(
  (c) => `<li><kbd>${c.k}</kbd><span>${c.ar}</span></li>`
).join("");

/* ============================================================
   09 · المعرض
   ============================================================ */
const SHOTS = [
  { src: "/shots/01-menu.png", cap: "شاشة البداية", span: "span-8" },
  { src: "/shots/06-combat.png", cap: "قتال مباشر — 6 أهداف حول اللاعب", span: "span-4" },
  { src: "/shots/03-shop.png", cap: "متجر الأسلحة — الشاشة كاملة", span: "span-5" },
  { src: "/shots/04-upgrades.png", cap: "ورشة التطوير — 4 خصائص × 8 مستويات", span: "span-7" },
  { src: "/shots/02-levels.png", cap: "اختيار القطاع", span: "span-6" },
  { src: "/shots/07-pause.png", cap: "الإيقاف المؤقت والإحصاءات", span: "span-6" },
];
$("#gallery-grid").innerHTML = SHOTS.map(
  (s) => `<figure class="shot ${s.span}" data-full="${s.src}" role="button" tabindex="0" aria-label="تكبير: ${s.cap}">
      <img src="${s.src}" alt="${s.cap}" loading="lazy" decoding="async" />
      <figcaption><span>◆</span>${s.cap}</figcaption>
    </figure>`
).join("");

/* ============================================================
   10 · القواعد
   ============================================================ */
const RULE_SET = [
  {
    t: "كيف تبدأ اللعبة",
    b: [
      "تبدأ بمسدس الخدمة وصحة 100 وذخيرة احتياطية 120. لا سلاح غيره، ولا ترقيات.",
      "كل قطاع ينتهي عند إسقاط كل موجاته. القطاع التالي يفتح فقط بعد إتمام اللي قبله.",
      "إذا نزلت صحتك لصفر تنتهي المحاولة، وتُرجع للقائمة الرئيسية مع الحفاظ على كل ما جمعته من عملات.",
    ],
  },
  {
    t: "قواعد الشراء",
    b: [
      "الأسلحة الخمسة الأولى تُشترى بالعملات ₡ فقط. سلاحان يتطلبان بلّورات ✦ مع العملات في نفس الوقت.",
      "شراء السلاح يجعله مجهّزاً فوراً، ويبدأ بمستوى ترقية 1 في كل خصائصه.",
      "لا استرجاع ولا بيع: كل شراء دائم. اختر بترتيب يناسب أسلوبك.",
      "لا يمكن تجهيز سلاح غير مشترى، ولا يمكن شراء سلاح مرتين.",
    ],
  },
  {
    t: "قواعد التطوير",
    b: [
      `كل سلاح عنده ${Object.keys(WEAPON_STATS).length} خصائص، كل واحدة ${MAX_STAT_LEVEL} مستويات كحد أقصى.`,
      "الضرر +9% لكل مستوى، معدل النيران +4.5%، المخزن +9%، زمن التلقيم −5%.",
      "تكلفة الترقية تصعد ×1.58 كل مستوى، وتتضاعف حسب فئة السلاح (المسدس أرخص، الجحيم أغلى 4.3×).",
      "الترقيات على السلاح نفسه فقط — ما تنتقل لسلاح آخر عند التبديل.",
    ],
  },
  {
    t: "تصاعد الصعوبة",
    b: [
      "كل موجة تزيد عدد الأعداء وتقلّل زمن ظهورهم. القطاع الأخير يبدأ بـ18 زاحفاً و14 عدّاءً في الموجة الأولى.",
      "صحة كل نوع تصعد بمقدار ثابت لكل موجة: زاحف +15، عدّاء +10، ضخم +48، زعيم +780.",
      "الزعماء يظهرون في القطاع 3 (واحد)، 4 (واحد)، 5 (اثنان) فقط — لا زعيم في أول قطاعين.",
      "في القطاع اللانهائي: +14% صحة لكل موجة و+3 أعداء، مع 1.35× مضاعف عملات.",
    ],
  },
  {
    t: "قواعد القتال",
    b: [
      "الإصابة في الرأس تضاعف الضرر ×1.6 إلى ×3 حسب السلاح، وتضيف 3 عملات.",
      "بندقية R-12 تطلق 8 كريات في الطلقة الواحدة؛ رمح ARC-9 يخترق 3 أهداف.",
      "الصحة تتجدد تلقائياً بعد 9 ثوانٍ بلا ضرر، بمعدل 2.5 نقطة في الثانية.",
      "الركض يستهلك التحمل (22/ثانية) ويُعاد شحنه (16/ثانية) عند التوقف.",
      "الضخم والزعيم لا يتأثران بالارتداد — لا تتوقع إيقافهما بالرصاص.",
    ],
  },
  {
    t: "قواعد العملات والبلّورات",
    b: [
      "العملات ₡ تُجمع من الأعداء، من إصابة الرأس، ومن إنهاء الموجات والقطاعات.",
      "مكافأة إنهاء الموجة = 55 × رقم الموجة، ومكافأة القطاع = 140 × رقم القطاع وأكثر.",
      "البلّورات ✦ لا تُشترى بمال حقيقي ولا تُحوّل إلى عملات. مصدرها الزعماء والضخام والصناديق النادرة.",
      "لا يوجد متجر مدفوع، ولا إعلانات، ولا عناصر تُشترى بوقت حقيقي. التقدّم من اللعب فقط.",
    ],
  },
  {
    t: "الحفظ والتقدّم",
    b: [
      `الحفظ تلقائي في متصفحك تحت المفتاح ${RULES.saveKey}.`,
      "العملات، البلّورات، الأسلحة المشتراة، الترقيات، والمهارات كلها محفوظة.",
      "حذف بيانات الموقع يمسح التقدّم نهائياً — لا يوجد حساب سحابي ولا استرجاع.",
      "القطاعات المفتوحة محفوظة أيضاً، فلا تحتاج تعيد من الأول بعد الإغلاق.",
    ],
  },
  {
    t: "العدالة والنزاهة",
    b: [
      "لا يوجد أي عنصر يُشترى بالمال الحقيقي، ولا أي تفوّق مدفوع — كل التقدّم من وقت اللعب.",
      "جودة الرسم تنزل تلقائياً على الأجهزة الضعيفة بدل خفض سرعة اللعبة.",
      "أقصى عدد أعداء حي 30 على اللابتوب و16 على الهاتف — حدّ أداء لا حدّ صعوبة.",
    ],
  },
];
$("#rules-list").innerHTML = RULE_SET.map(
  (r, i) => `<details class="rule reveal"${i === 0 ? " open" : ""}>
      <summary><span class="ridx">${String(i + 1).padStart(2, "0")}</span>${r.t}<span class="plus">+</span></summary>
      <div class="body"><ul>${r.b.map((x) => `<li>${x}</li>`).join("")}</ul></div>
    </details>`
).join("");

/* ============================================================
   11 · الأسئلة
   ============================================================ */
const FAQ = [
  ["هل اللعبة مجانية فعلاً؟", "نعم. لا يوجد أي عنصر مدفوع، ولا إعلانات، ولا حساب. تفتح الرابط وتلعب. البلّورات تُكسب باللعب فقط."],
  ["هل تعمل على الهاتف؟", "نعم. الواجهة تتحول تلقائياً لتحكّم لمسي: عصا للحركة، سحب للنظر، أزرار للنار والتلقيم والتبديل والقفز. اللعبة تعمل بالطول وبالعرض."],
  ["هل تحتاج تحميل أو تسجيل؟", "لا. كل شيء يعمل في المتصفح. أول تحميل يحتاج اتصالاً، وبعدها تعمل الصفحة من الكاش."],
  ["هل يُحفظ تقدّمي؟", "نعم، في متصفحك على نفس الجهاز. إذا حذفت بيانات الموقع، يبدأ التقدّم من جديد."],
  ["كم وقت تاخذ المهمة؟", "خمس قطاعات بـ72 موجة إجمالاً. الجلسة الواحدة عادة بين 8 و20 دقيقة حسب مستواك، والقطاع اللانهائي بلا سقف."],
  ["كيف أحصل على البلّورات؟", "من الزعماء (7 لكل زعيم)، من الضخام (1)، من صناديق نادرة بنسبة 4.5%، ومن مكافآت إتمام القطاعات."],
  ["هل يمكن تشغيلها بلا إنترنت؟", "بعد التحميل الأول، الأصول تُخزّن في الكاش وتعمل بلا اتصال في أغلب المتصفحات."],
  ["ما الأجهزة المدعومة؟", "أي متصفح حديث يدعم WebGL 2: Chrome وSafari وEdge وFirefox على ويندوز وماك ولينكس وأندرويد وiOS."],
];
$("#faq-list").innerHTML = FAQ.map(
  ([q, a], i) => `<details class="rule">
      <summary><span class="ridx">${String(i + 1).padStart(2, "0")}</span>${q}<span class="plus">+</span></summary>
      <div class="body">${a}</div>
    </details>`
).join("");

/* ============================================================
   سلوك الصفحة
   ============================================================ */
$("#version").textContent = META.version;
$("#year").textContent = new Date().getFullYear();

/* شريط التنقل */
const nav = $("#nav");
const onScroll = () => nav.classList.toggle("stuck", window.scrollY > 12);
onScroll();
window.addEventListener("scroll", onScroll, { passive: true });

/* الظهور التدريجي + عدّادات */
const revealIO = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add("in");
      revealIO.unobserve(e.target);
    }
  },
  { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
);
document.querySelectorAll(".reveal").forEach((node, i) => {
  node.style.setProperty("--d", `${(i % 4) * 0.06}s`);
  revealIO.observe(node);
});

const countIO = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const target = +e.target.dataset.count;
      const start = performance.now();
      const dur = 900;
      const tick = (t) => {
        const p = Math.min(1, (t - start) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        e.target.textContent = n(target * eased);
        if (p < 1) requestAnimationFrame(tick);
        else e.target.textContent = n(target);
      };
      requestAnimationFrame(tick);
      countIO.unobserve(e.target);
    }
  },
  { threshold: 0.6 }
);
document.querySelectorAll("[data-count]").forEach((c) => countIO.observe(c));

/* معرض مكبّر */
const lb = $("#lightbox");
const lbImg = lb.querySelector("img");
const openLb = (src, alt) => {
  lbImg.src = src;
  lbImg.alt = alt || "";
  lb.hidden = false;
  document.body.style.overflow = "hidden";
};
const closeLb = () => {
  lb.hidden = true;
  lbImg.src = "";
  document.body.style.overflow = "";
};
document.querySelectorAll("#gallery-grid .shot").forEach((fig) => {
  const go = () => openLb(fig.dataset.full, fig.querySelector("img")?.alt);
  fig.addEventListener("click", go);
  fig.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      go();
    }
  });
});
lb.addEventListener("click", (e) => {
  if (e.target === lb || e.target.closest(".lb-close")) closeLb();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !lb.hidden) closeLb();
});

/* قياس بسيط للتجربة (بدون تتبّع خارجي) */
document.querySelectorAll("[data-cta]").forEach((a) => {
  a.addEventListener("click", () => {
    try {
      localStorage.setItem("ds-last-cta", a.dataset.cta);
    } catch {}
  });
});

console.info(`[landing] ${META.name} v${META.version} — ${LEVELS.length} قطاعات · ${WEAPONS.length} أسلحة`);
