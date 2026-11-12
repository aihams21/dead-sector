/* ملء الشاشة + قفل الاتجاه — تعمل على الهاتف واللابتوب
   ملاحظة: ملء الشاشة لازم ينطلب داخل إيماءة المستخدم (نقرة/لمسة)،
   وإلا المتصفح بيرفضه — لهيك مناداة enterFullscreen بتصير جوا معالج النقر. */

const doc = typeof document !== "undefined" ? document : null;

function fsElement() {
  if (!doc) return null;
  return (
    doc.fullscreenElement ||
    doc.webkitFullscreenElement ||
    doc.mozFullScreenElement ||
    doc.msFullscreenElement ||
    null
  );
}

export function isFullscreen() {
  return !!fsElement();
}

export function fullscreenSupported() {
  if (typeof document === "undefined") return false;
  const el = doc.documentElement;
  return !!(el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen);
}

export async function enterFullscreen(el = doc?.documentElement) {
  if (!el) return false;
  if (isFullscreen()) return true;
  const fn = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
  if (!fn) return false;
  /* navigationUI: "hide" بتشيل شرائط المتصفح على أندرويد */
  try {
    await fn.call(el, { navigationUI: "hide" });
    return true;
  } catch {
    try {
      await fn.call(el);
      return true;
    } catch {
      return false;
    }
  }
}

export async function exitFullscreen() {
  if (!doc || !isFullscreen()) return true;
  unlockOrientation();
  const fn = doc.exitFullscreen || doc.webkitExitFullscreen || doc.mozCancelFullScreen || doc.msExitFullscreen;
  try {
    await fn?.call(doc);
    return true;
  } catch {
    return false;
  }
}

export async function toggleFullscreen() {
  if (isFullscreen()) {
    const ok = await exitFullscreen();
    return { ok, fullscreen: isFullscreen() };
  }
  const ok = await enterFullscreen();
  if (ok) lockLandscape();
  return { ok, fullscreen: isFullscreen() };
}

/* قفل أفقي — مدعوم على أندرويد داخل ملء الشاشة فقط، وبيرمي على iOS/الديسكتوب */
export async function lockLandscape() {
  const o = typeof screen !== "undefined" ? screen.orientation : null;
  if (!o || typeof o.lock !== "function") return false;
  try {
    await o.lock("landscape");
    return true;
  } catch {
    return false;
  }
}

export function unlockOrientation() {
  try {
    screen.orientation?.unlock?.();
  } catch {
    /* لا شيء */
  }
}

export const isTouchDevice = () =>
  typeof window !== "undefined" &&
  (matchMedia("(pointer: coarse)").matches || matchMedia("(hover: none)").matches);

/* متابعة تغيّر حالة ملء الشاشة (لاستبدال نص الأزرار) */
export function onFullscreenChange(handler) {
  if (typeof document === "undefined") return () => {};
  const events = ["fullscreenchange", "webkitfullscreenchange", "mozfullscreenchange", "MSFullscreenChange"];
  for (const ev of events) document.addEventListener(ev, handler);
  return () => {
    for (const ev of events) document.removeEventListener(ev, handler);
  };
}
