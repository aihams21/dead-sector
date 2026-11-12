/* نقطة الإقلاع: تشغيل اللعبة، إخفاء شاشة التحضير، ودعم معاملات الرابط */
import { Game } from "./game.js";
import { unlockAudio, setVolume } from "./audio.js";
import {
  isFullscreen,
  enterFullscreen,
  exitFullscreen,
  lockLandscape,
  unlockOrientation,
  isTouchDevice,
  onFullscreenChange,
} from "./fullscreen.js";

const canvas = document.getElementById("game");
const boot = document.getElementById("boot");

function hideBoot(delay = 0) {
  if (!boot) return;
  setTimeout(() => {
    boot.classList.add("out");
    setTimeout(() => boot.remove(), 620);
  }, delay);
}

let game = null;

try {
  game = new Game(canvas);
} catch (err) {
  console.error("[dead-sector] فشل الإقلاع:", err);
  if (boot) {
    boot.innerHTML = `<div class="boot-logo">DEAD<span>SECTOR</span></div>
      <p class="boot-fail">تعذّر تشغيل المشهد ثلاثي الأبعاد على هذا الجهاز.<br />
      جرّب متصفحاً أحدث أو فعّل تسريع الرسوميات (WebGL).</p>`;
  }
}

if (game) {
  setVolume(game.profile.settings.sound);
  hideBoot(420);

  /* أول لمسة/ضغطة تفتح قناة الصوت في المتصفح */
  const once = () => {
    unlockAudio();
    setVolume(game.profile.settings.sound);
    window.removeEventListener("pointerdown", once);
    window.removeEventListener("keydown", once);
  };
  window.addEventListener("pointerdown", once, { once: true });
  window.addEventListener("keydown", once, { once: true });

  /* معاملات الرابط: ?level=3&auto=1 (للقطات الشاشة والاختبار) */
  const params = new URLSearchParams(location.search);
  const level = parseInt(params.get("level") || "", 10);
  const auto = params.get("auto");
  const screen = params.get("screen");
  if (screen) game.openScreen(screen);
  if (Number.isFinite(level) && level >= 1) {
    setTimeout(() => {
      game.startLevel(Math.min(5, level), params.get("endless") === "1");
      if (auto === "1") {
        window.__DS?.god();
        window.__DS?.coins(4000);
      }
    }, 260);
  }
}

/* =============== ملء الشاشة + اتجاه الجهاز =============== */
const touch = isTouchDevice();
document.body.classList.toggle("is-touch", touch);

const portraitMQ = window.matchMedia("(orientation: portrait)");
const gate = document.getElementById("gate");
const gateNote = document.getElementById("gate-note");
let gatePaused = false;

/* بوابة «لفّ الجهاز»: تظهر فقط على الهاتف بالطول وأثناء اللعب */
let gateDismissed = false;
function gateActive() {
  if (gateDismissed) return false;
  return (
    document.body.classList.contains("is-touch") &&
    document.body.classList.contains("portrait") &&
    document.body.classList.contains("playing")
  );
}

function syncGate() {
  if (!game) return;
  if (gateActive() && game.state === "playing") {
    gatePaused = true;
    game.pause();
    game.ui.hide(); /* نخفي شاشة الإيقاف ورا البوابة */
  } else if (!gateActive() && gatePaused) {
    gatePaused = false;
    if (game.state === "paused") game.resume();
  }
}

function applyOrientation() {
  /* الاعتماد على أبعاد النافذة: أضمن من matchMedia داخل fullscreen
     على أندرويد (screen.orientation قد يبقى قديماً أثناء القفل) */
  const portrait = window.innerHeight > window.innerWidth;
  document.body.classList.toggle("portrait", portrait);
  document.body.classList.toggle("landscape", !portrait);
  syncGate();
}

/* حرّاس إضافيون: بعض الهواتف ما تطلق حدث دوران داخل fullscreen،
   فتضل البوابة ظاهرة وتحجب كل الأزرار. فحص دوري رخيص = صفر تعليق. */
let lastOrientKey = "";
setInterval(() => {
  const key = `${window.innerHeight > window.innerWidth}|${document.body.classList.contains("playing")}`;
  if (key === lastOrientKey) return;
  lastOrientKey = key;
  applyOrientation();
}, 700);
portraitMQ.addEventListener?.("change", applyOrientation);
try {
  screen.orientation?.addEventListener?.("change", () => setTimeout(applyOrientation, 60));
} catch {
  /* غير مدعوم */
}
applyOrientation();

/* نصوص أزرار ملء الشاشة */
function refreshFsButtons() {
  const full = isFullscreen();
  document.querySelectorAll('[data-action="fullscreen"]').forEach((b) => {
    if (b.closest("#gate")) return;
    b.textContent = full ? "⛶ خروج من ملء الشاشة" : "⛶ ملء الشاشة";
    b.setAttribute("aria-pressed", full ? "true" : "false");
  });
}
onFullscreenChange(() => {
  refreshFsButtons();
  if (!isFullscreen()) unlockOrientation();
  setTimeout(applyOrientation, 80);
});
refreshFsButtons();

/* زر ملء الشاشة: لازم ينطلب من داخل النقرة نفسها */
async function handleFullscreen() {
  if (isFullscreen()) {
    await exitFullscreen();
  } else {
    const ok = await enterFullscreen();
    if (ok && touch) await lockLandscape();
    if (!ok && gateNote) {
      gateNote.textContent = "المتصفح ما سمح بملء الشاشة — لفّ الجهاز يدوياً.";
    }
  }
  refreshFsButtons();
  setTimeout(applyOrientation, 80);
  if (gateActive() && isFullscreen()) syncGate();
}

document.addEventListener("click", (e) => {
  const skip = e.target.closest('[data-action="gate-skip"]');
  if (skip) {
    e.preventDefault();
    e.stopPropagation();
    /* مخرج أمان: نلعب بالطول بدل ما نضل محبوسين ورا البوابة */
    gateDismissed = true;
    document.body.classList.add("gate-off");
    if (game && game.state === "paused") game.resume();
    syncGate();
    return;
  }
  const btn = e.target.closest('[data-action="fullscreen"]');
  if (!btn) return;
  e.preventDefault();
  e.stopPropagation();
  void handleFullscreen();
});

/* أول بدء مرحلة على الهاتف: نحاول ندخل ملء الشاشة داخل نفس الإيماءة */
document.addEventListener(
  "click",
  (e) => {
    if (!touch || !e.target.closest('[data-action="play"], [data-action="endless"]')) return;
    /* بداية مرحلة جديدة: أعد تفعيل بوابة الاتجاه */
    gateDismissed = false;
    document.body.classList.remove("gate-off");
    if (isFullscreen()) return;
    void (async () => {
      if (await enterFullscreen()) await lockLandscape();
      refreshFsButtons();
    })();
  },
  true
);

/* لو الجهاز انقلب/تغيّرت الشاشة أثناء اللعب */
if (gate) gate.addEventListener("pointerdown", (e) => e.stopPropagation());

/* تابع تغيّر كلاسات body (playing تتبدّل من game.js) */
new MutationObserver(syncGate).observe(document.body, {
  attributes: true,
  attributeFilter: ["class"],
});

/* منع تكبير الصفحة بإيماءة اللمس المزدوجة داخل اللعبة فقط */
document.addEventListener(
  "gesturestart",
  (e) => {
    if (document.body.classList.contains("playing")) e.preventDefault();
  },
  { passive: false }
);
