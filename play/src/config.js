/* ============================================================
   DEAD SECTOR — قواعد اللعبة والموازنة (مصدر الحقيقة الوحيد)
   كل الأرقام هنا تُستخدم باللعبة وبصفحة العرض معاً.
   ============================================================ */

export const META = {
  name: "DEAD SECTOR",
  nameAr: "القطاع الميت",
  tagline: "المدينة سقطت. القطاع الأخير بيدك.",
  version: "1.0.0",
};

export const RULES = {
  saveKey: "dead-sector-save-v1",
  coinPerHeadshot: 3,
  waveClearBonus: (lv) => 55 * lv,
  levelClearCoins: (lv) => 140 * lv,
  levelClearGems: (lv) => [1, 1, 2, 2, 3, 3, 4, 4][Math.min(lv, 8) - 1] ?? 4,
  ammoCrateChance: 0.22,
  ammoCrateRestore: 0.35,
  medkitChance: 0.11,
  medkitHeal: 28,
  gemCacheChance: 0.045,
  magnetRadius: 4.2,
  pickupRadius: 1.15,
  waveGap: 4.5,
  maxZombiesAlive: 30,
  maxZombiesAliveMobile: 16,
};

export const PLAYER_BASE = {
  hp: 100,
  speed: 5.3,
  sprintMul: 1.5,
  radius: 0.42,
  eye: 1.62,
  jumpVel: 5.4,
  gravity: 21,
  regenDelay: 9,     // ثانية بلا ضرر قبل بدء التجديد
  regenRate: 2.5,    // HP/ثانية
  staminaMax: 100,
  staminaDrain: 22,  // عند الركض
  staminaRegen: 16,
};

/* ---------- الأسلحة ---------- */
// tierFactor يرفع أسعار التطوير. cost.gems تعني سلاح "بعملة قوية".
export const WEAPONS = [
  {
    id: "pistol", name: "M9 Service", nameAr: "مسدس الخدمة", tier: 1, tierFactor: 1,
    cost: { coins: 0, gems: 0 },
    damage: 27, rpm: 200, mag: 12, reload: 1.2, spread: 0.012, pellets: 1,
    reserve: 120, pierce: 0, headMult: 2.3, auto: false, kick: 0.05, range: 90,
    body: 0x2b333a, accent: 0x8b98a3,
    desc: "بداية كل ناجٍ. دقيق، خفيف، وذخيرته لا تنتهي عملياً.",
  },
  {
    id: "smg", name: "V-9 Vector", nameAr: "رشاش V-9", tier: 2, tierFactor: 1.45,
    cost: { coins: 900, gems: 0 },
    damage: 15, rpm: 820, mag: 30, reload: 1.55, spread: 0.028, pellets: 1,
    reserve: 240, pierce: 0, headMult: 1.9, auto: true, kick: 0.03, range: 70,
    body: 0x30363b, accent: 0xb9c2c9,
    desc: "معدل نيران عالٍ وسيطرة على الحشود القريبة. يبتلع الذخيرة بسرعة.",
  },
  {
    id: "shotgun", name: "R-12 Breaker", nameAr: "بندقية R-12", tier: 3, tierFactor: 1.85,
    cost: { coins: 1800, gems: 0 },
    damage: 14, rpm: 78, mag: 6, reload: 2.35, spread: 0.078, pellets: 8,
    reserve: 48, pierce: 0, headMult: 1.7, auto: false, kick: 0.16, range: 34,
    body: 0x3a2c22, accent: 0xc0a06a,
    desc: "ثماني كريات في الطلقة. ملك المسافة القريبة، بلا فائدة بعيداً.",
  },
  {
    id: "rifle", name: "AK-74 Wolf", nameAr: "بندقية الذئب", tier: 4, tierFactor: 2.3,
    cost: { coins: 3600, gems: 0 },
    damage: 31, rpm: 470, mag: 25, reload: 1.85, spread: 0.015, pellets: 1,
    reserve: 200, pierce: 1, headMult: 2.4, auto: true, kick: 0.06, range: 110,
    body: 0x40352a, accent: 0xd8b98a,
    desc: "الخيار المتوازن: ضرر جيد، مدى طويل، ونيران أوتوماتيكية.",
  },
  {
    id: "lmg", name: "M249 Bastion", nameAr: "مدفع M249", tier: 5, tierFactor: 2.9,
    cost: { coins: 6000, gems: 0 },
    damage: 23, rpm: 720, mag: 90, reload: 3.4, spread: 0.042, pellets: 1,
    reserve: 450, pierce: 1, headMult: 1.8, auto: true, kick: 0.04, range: 95,
    body: 0x2a3034, accent: 0x9fb0bb,
    desc: "مخزن 90 طلقة. تحاصر الطريق وتفرغه — ثم تعيد التلقيم وتنتظر.",
  },
  {
    id: "railgun", name: "ARC-9 Lance", nameAr: "رمح ARC-9", tier: 6, tierFactor: 3.6,
    cost: { coins: 9000, gems: 12 },
    damage: 175, rpm: 62, mag: 4, reload: 2.9, spread: 0.002, pellets: 1,
    reserve: 32, pierce: 3, headMult: 3, auto: false, kick: 0.2, range: 160,
    body: 0x1d2b33, accent: 0x4ff0d0, glow: 0x39f7d8,
    desc: "يخترق 3 أهداف ويسقط الضخم بطلقة واحدة. يُشترى بالبلّورات فقط.",
  },
  {
    id: "hellfire", name: "HF-8 Hellfire", nameAr: "جحيم HF-8", tier: 7, tierFactor: 4.3,
    cost: { coins: 15000, gems: 26 },
    damage: 15, rpm: 1150, mag: 220, reload: 4.8, spread: 0.055, pellets: 1,
    reserve: 660, pierce: 0, headMult: 1.6, auto: true, kick: 0.028, range: 85,
    body: 0x2d1f1c, accent: 0xff7b3d, glow: 0xff5a1f,
    desc: "مدفع دوّار. يُمطر 220 طلقة بلا توقف. أغلى سلاح في القطاع.",
  },
];

export const WEAPON_BY_ID = Object.fromEntries(WEAPONS.map((w) => [w.id, w]));

/* ---------- ترقيات الأسلحة ---------- */
export const WEAPON_STATS = {
  damage: { nameAr: "الضرر", per: 0.09, base: 95, fmt: (v) => `+${Math.round(v * 100)}%` },
  rate: { nameAr: "معدل النيران", per: 0.045, base: 120, fmt: (v) => `+${Math.round(v * 100)}%` },
  mag: { nameAr: "المخزن", per: 0.09, base: 78, fmt: (v) => `+${Math.round(v * 100)}%` },
  reload: { nameAr: "سرعة التلقيم", per: 0.05, base: 88, fmt: (v) => `−${Math.round(v * 100)}%` },
};
export const MAX_STAT_LEVEL = 8;
export const statCost = (weapon, statKey, level) =>
  Math.round(WEAPON_STATS[statKey].base * weapon.tierFactor * Math.pow(1.58, level - 1) / 5) * 5;

/* ---------- ترقيات اللاعب ---------- */
export const PERKS = {
  vitality: { nameAr: "الحيوية", desc: "+14 حد أقصى للصحة لكل مستوى", base: 180, per: 14, max: 8, icon: "♥" },
  armor: { nameAr: "الدروع", desc: "+5% تقليل ضرر لكل مستوى", base: 220, per: 0.05, max: 6, icon: "◆" },
  agility: { nameAr: "الرشاقة", desc: "+4% سرعة حركة وركض أطول", base: 200, per: 0.04, max: 6, icon: "»" },
  scavenger: { nameAr: "الجمّاع", desc: "+12% عملات من كل هدف", base: 260, per: 0.12, max: 6, icon: "₡" },
};
export const perkCost = (key, level) =>
  Math.round((PERKS[key].base * Math.pow(1.5, level - 1)) / 5) * 5;

/* ---------- الزومبي ---------- */
export const ZOMBIE_TYPES = {
  walker: { nameAr: "زاحف", hp: 62, growth: 15, speed: 1.55, dmg: 9, coins: 11, gems: 0, color: 0x5b6849, head: 0x8a9668, scale: 1, atk: 1.15 },
  runner: { nameAr: "عدّاء", hp: 40, growth: 10, speed: 3.45, dmg: 7, coins: 14, gems: 0, color: 0x6d3a34, head: 0x9c5a50, scale: 0.92, atk: 0.85 },
  brute: { nameAr: "ضخم", hp: 290, growth: 48, speed: 1.2, dmg: 23, coins: 46, gems: 1, color: 0x474b56, head: 0x6d7280, scale: 1.5, atk: 1.5 },
  boss: { nameAr: "الوحش", hp: 2500, growth: 780, speed: 1.4, dmg: 31, coins: 320, gems: 7, color: 0x3c2430, head: 0x7a3550, scale: 2.5, atk: 1.35 },
};

/* ---------- المراحل ---------- */
// sky/fog/ground = لوحة المرحلة. waves = موجة بعد موجة، الصعوبة تتصاعد.
export const LEVELS = [
  {
    id: 1, nameAr: "أطراف المدينة", name: "Outskirts",
    desc: "شوارع ميتة وأعمدة كهرباء مقطوعة. أول ليلة في القطاع.",
    sky: 0x0b1420, fog: 0x0d1826, fogNear: 12, fogFar: 78, ground: 0x1c222a,
    light: 0x8fb6ff, ambient: 0.36, buildings: 26, props: 34, palette: [0x2a323c, 0x232a33, 0x313a46],
    reward: { coins: 300, gems: 0 },
    waves: [
      { walker: 8, rate: 1.6 },
      { walker: 12, runner: 2, rate: 1.35 },
      { walker: 14, runner: 6, rate: 1.1, brute: 1 },
    ],
  },
  {
    id: 2, nameAr: "المترو المهجور", name: "Subway",
    desc: "أنفاق تحت المدينة. الضوء الوحيد هو كشافك… وعدّاؤون يسمعون أنفاسك.",
    sky: 0x06120e, fog: 0x081a13, fogNear: 8, fogFar: 60, ground: 0x14191b,
    light: 0x7dffc4, ambient: 0.3, buildings: 22, props: 42, palette: [0x1d2a26, 0x243330, 0x182320],
    reward: { coins: 380, gems: 1 },
    waves: [
      { walker: 10, runner: 4, rate: 1.3 },
      { walker: 12, runner: 8, rate: 1.1 },
      { walker: 12, runner: 10, brute: 2, rate: 0.95 },
    ],
  },
  {
    id: 3, nameAr: "مستشفى الرحمة", name: "Mercy Hospital",
    desc: "حيث بدأ كل شيء. الأرضيات بيضاء… والوحش الأول يستيقظ في الطابق السفلي.",
    sky: 0x0c1219, fog: 0x121c24, fogNear: 10, fogFar: 66, ground: 0x1b2228,
    light: 0xd7f6ff, ambient: 0.4, buildings: 28, props: 30, palette: [0x2f3b44, 0x27333c, 0x3a4750],
    reward: { coins: 500, gems: 2 },
    waves: [
      { walker: 14, runner: 6, rate: 1.15 },
      { walker: 14, runner: 10, brute: 2, rate: 1 },
      { walker: 16, runner: 12, brute: 3, rate: 0.9 },
      { boss: 1, walker: 8, runner: 6, rate: 1.4, bossWave: true },
    ],
  },
  {
    id: 4, nameAr: "القاعدة العسكرية", name: "Black Ridge Base",
    desc: "جيش سقط في ساعة. عتاد كثير، وضخام كثر. لا أحد يعود من هنا فارغ اليدين.",
    sky: 0x1a0f08, fog: 0x2a170d, fogNear: 14, fogFar: 84, ground: 0x241d16,
    light: 0xffb36b, ambient: 0.42, buildings: 32, props: 44, palette: [0x3b3428, 0x2d281f, 0x4a4132],
    reward: { coins: 700, gems: 2 },
    waves: [
      { walker: 16, runner: 10, brute: 3, rate: 1.05 },
      { walker: 18, runner: 12, brute: 4, rate: 0.95 },
      { walker: 16, runner: 14, brute: 5, rate: 0.85 },
      { boss: 1, walker: 12, runner: 10, brute: 2, rate: 1.2, bossWave: true },
    ],
  },
  {
    id: 5, nameAr: "مختبر أوميغا", name: "Omega Lab",
    desc: "المصدر. إن فجّرته، تنتهي الليلة. إن فشلت، لن يكون هناك فجر.",
    sky: 0x140509, fog: 0x24080f, fogNear: 9, fogFar: 62, ground: 0x1d1116,
    light: 0xff6b8a, ambient: 0.34, buildings: 30, props: 36, palette: [0x3a2029, 0x2b161d, 0x4a2833],
    reward: { coins: 1000, gems: 3 },
    waves: [
      { walker: 18, runner: 14, brute: 4, rate: 0.95 },
      { walker: 20, runner: 16, brute: 6, rate: 0.85 },
      { walker: 18, runner: 18, brute: 6, rate: 0.75 },
      { boss: 2, walker: 16, runner: 14, brute: 4, rate: 1.05, bossWave: true },
    ],
  },
];

/* ---------- القطاع اللانهائي ---------- */
export const ENDLESS = {
  nameAr: "القطاع اللانهائي",
  desc: "موجات بلا نهاية. كل موجة أعتى من السابقة. سجّل أطول صمود.",
  coinMul: 1.35,
  hpMulPerWave: 0.14,
  countPerWave: 3,
  baseCount: 12,
};

export const CONTROLS = [
  { k: "W A S D", ar: "حركة" },
  { k: "الفأرة", ar: "النظر والتصويب" },
  { k: "زر الفأرة الأيسر", ar: "إطلاق" },
  { k: "R", ar: "تلقيم" },
  { k: "1 – 7", ar: "تبديل السلاح" },
  { k: "Shift", ar: "ركض" },
  { k: "Space", ar: "قفز" },
  { k: "Esc", ar: "إيقاف مؤقت" },
];

export const TOUCH_CONTROLS = [
  { k: "العصا اليسرى", ar: "حركة" },
  { k: "سحب اليمين", ar: "النظر" },
  { k: "زر النار", ar: "إطلاق مستمر" },
  { k: "زر التلقيم", ar: "تلقيم" },
  { k: "زر التبديل", ar: "السلاح التالي" },
  { k: "زر القفز", ar: "قفز" },
];
