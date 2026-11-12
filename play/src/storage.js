/* التخزين المحلي — كل تقدّم اللاعب */
import { RULES, WEAPONS, PERKS } from "./config.js";

const blankStats = () => ({ damage: 1, rate: 1, mag: 1, reload: 1 });

export function defaultProfile() {
  return {
    v: 1,
    coins: 0,
    gems: 0,
    owned: ["pistol"],
    equipped: "pistol",
    weaponStats: { pistol: blankStats() },
    perks: { vitality: 0, armor: 0, agility: 0, scavenger: 0 },
    progress: { unlocked: 1, cleared: 0, bestEndless: 0 },
    stats: { kills: 0, headshots: 0, waves: 0, runs: 0, playtime: 0 },
    settings: { sens: 1, sound: 0.7, quality: "auto", invert: false },
    seen: false,
  };
}

function normalize(p) {
  const d = defaultProfile();
  const out = { ...d, ...p };
  out.settings = { ...d.settings, ...(p.settings || {}) };
  out.perks = { ...d.perks, ...(p.perks || {}) };
  out.progress = { ...d.progress, ...(p.progress || {}) };
  out.stats = { ...d.stats, ...(p.stats || {}) };
  out.weaponStats = { ...(p.weaponStats || {}) };
  for (const w of WEAPONS) {
    if (out.owned.includes(w.id)) out.weaponStats[w.id] = { ...blankStats(), ...(out.weaponStats[w.id] || {}) };
  }
  if (!out.owned.includes(out.equipped)) out.equipped = out.owned[0] || "pistol";
  for (const k of Object.keys(PERKS)) out.perks[k] = Math.min(PERKS[k].max, out.perks[k] | 0);
  return out;
}

export const storage = {
  load() {
    try {
      const raw = localStorage.getItem(RULES.saveKey);
      if (!raw) return defaultProfile();
      return normalize(JSON.parse(raw));
    } catch {
      return defaultProfile();
    }
  },
  save(profile) {
    try {
      localStorage.setItem(RULES.saveKey, JSON.stringify(profile));
      return true;
    } catch {
      return false;
    }
  },
  wipe() {
    try { localStorage.removeItem(RULES.saveKey); } catch {}
    return defaultProfile();
  },
};
