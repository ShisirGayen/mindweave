// © Shisir Gayen. All rights reserved.
// Save schema: default state, version migration and validation/repair.
import { sanitizeCharacter } from '../models/character.js';

export const SCHEMA_VERSION = 2;
export const LANGS = ['bn', 'en'];
const MAX_JOURNAL = 500;
const MAX_ACHIEVEMENTS = 200;

const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);

export function osPrefersReducedMotion() {
  try {
    return !!(globalThis.matchMedia && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches);
  } catch { return false; }
}

export function defaultState() {
  return {
    v: SCHEMA_VERSION,
    settings: { lang: 'bn', reduceMotion: osPrefersReducedMotion() },
    character: null,
    journal: [],
    achievements: []
  };
}

// Upgrades an older save to the current shape. Each step handles exactly one version.
function migrate(raw) {
  const d = { ...raw };
  let v = Number.isInteger(d.v) ? d.v : 1;
  if (v < 2) {
    // v1 stored { life: { startAge, createdAt } }; v2 stores a full character model.
    const life = isObj(d.life) ? d.life : null;
    d.character = life
      ? sanitizeCharacter({ startAge: life.startAge, currentAge: life.startAge, createdAt: life.createdAt })
      : null;
    delete d.life;
    v = 2;
  }
  d.v = v;
  return d;
}

// Returns { ok:true, state, repaired, migrated } or { ok:false, reason }.
export function validateState(raw) {
  if (!isObj(raw)) return { ok: false, reason: 'not-object' };
  if (Number.isInteger(raw.v) && raw.v > SCHEMA_VERSION) return { ok: false, reason: 'newer-version' };

  const migrated = !Number.isInteger(raw.v) || raw.v < SCHEMA_VERSION;
  const d = migrate(raw);
  const base = defaultState();
  let repaired = false;

  const src = isObj(d.settings) ? d.settings : {};
  if (!isObj(d.settings)) repaired = true;
  const lang = LANGS.includes(src.lang) ? src.lang : base.settings.lang;
  const reduceMotion = typeof src.reduceMotion === 'boolean' ? src.reduceMotion : base.settings.reduceMotion;
  if (lang !== src.lang || reduceMotion !== src.reduceMotion) repaired = true;

  let character = null;
  if (d.character != null) {
    character = sanitizeCharacter(d.character);
    if (!character || JSON.stringify(character) !== JSON.stringify(d.character)) repaired = true;
  }

  let journal = [];
  if (Array.isArray(d.journal)) {
    journal = d.journal.filter(isObj).slice(-MAX_JOURNAL);
    if (journal.length !== d.journal.length) repaired = true;
  } else if (d.journal !== undefined) repaired = true;

  let achievements = [];
  if (Array.isArray(d.achievements)) {
    achievements = [...new Set(d.achievements.filter((a) => typeof a === 'string' && a.length <= 64))].slice(0, MAX_ACHIEVEMENTS);
    if (achievements.length !== d.achievements.length) repaired = true;
  } else if (d.achievements !== undefined) repaired = true;

  return {
    ok: true,
    repaired,
    migrated,
    state: { v: SCHEMA_VERSION, settings: { lang, reduceMotion }, character, journal, achievements }
  };
}
