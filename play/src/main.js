/* نقطة الإقلاع: تشغيل اللعبة، إخفاء شاشة التحضير، ودعم معاملات الرابط */
import { Game } from "./game.js";
import { unlockAudio, setVolume } from "./audio.js";

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

/* إشارة للـCSS: هل الجهاز يعتمد اللمس؟ */
const coarse = window.matchMedia("(pointer: coarse)").matches;
document.body.classList.toggle("is-touch", coarse);

/* منع تكبير الصفحة بإيماءة اللمس المزدوجة داخل اللعبة فقط */
document.addEventListener(
  "gesturestart",
  (e) => {
    if (document.body.classList.contains("playing")) e.preventDefault();
  },
  { passive: false }
);
