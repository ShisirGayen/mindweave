
// © Shisir Gayen. All rights reserved.
// MINDWEAVE — Save Schema, Migration and Validation System

import {
  sanitizeCharacter,
  isValidAge
} from '../models/character.js';

// ------------------------------------
// SCHEMA CONFIGURATION
// ------------------------------------

export const SCHEMA_VERSION = 2;

export const LANGS = ['bn', 'en'];

const MAX_JOURNAL = 500;
const MAX_ACHIEVEMENTS = 200;

const CHARACTER_KEYS = [
  'id',
  'startAge',
  'currentAge',
  'createdAt',
  'lastProgressAt'
];

const STATE_KEYS = [
  'v',
  'settings',
  'character',
  'journal',
  'achievements'
];

const SETTINGS_KEYS = [
  'lang',
  'reduceMotion'
];

// ------------------------------------
// BASIC HELPERS
// ------------------------------------

const isObj = (value) =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value);

const hasOwn = (object, key) =>
  Object.prototype.hasOwnProperty.call(object, key);

function hasExactKeys(object, expectedKeys) {
  if (!isObj(object)) return false;

  const actual = Object.keys(object);

  return (
    actual.length === expectedKeys.length &&
    expectedKeys.every((key) => hasOwn(object, key))
  );
}

// ------------------------------------
// JSON COMPATIBILITY VALIDATION
// ------------------------------------

function isJsonCompatible(value, seen = new WeakSet()) {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return true;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value);
  }

  if (typeof value !== 'object') {
    return false;
  }

  if (seen.has(value)) {
    return false;
  }

  seen.add(value);

  try {
    if (Array.isArray(value)) {
      const keys = Reflect.ownKeys(value);

      if (keys.length !== value.length + 1) {
        return false;
      }

      for (let i = 0; i < value.length; i++) {
        if (!hasOwn(value, i)) {
          return false;
        }

        const descriptor =
          Object.getOwnPropertyDescriptor(value, String(i));

        if (
          !descriptor ||
          !descriptor.enumerable ||
          !hasOwn(descriptor, 'value') ||
          !isJsonCompatible(descriptor.value, seen)
        ) {
          return false;
        }
      }

      return true;
    }

    const prototype = Object.getPrototypeOf(value);

    if (
      prototype !== Object.prototype &&
      prototype !== null
    ) {
      return false;
    }

    const keys = Reflect.ownKeys(value);

    for (const key of keys) {
      if (typeof key !== 'string') {
        return false;
      }

      const descriptor =
        Object.getOwnPropertyDescriptor(value, key);

      if (
        !descriptor ||
        !descriptor.enumerable ||
        !hasOwn(descriptor, 'value') ||
        !isJsonCompatible(descriptor.value, seen)
      ) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  } finally {
    seen.delete(value);
  }
}

// ------------------------------------
// REDUCED MOTION
// ------------------------------------

export function osPrefersReducedMotion() {
  try {
    if (
      typeof globalThis.matchMedia !== 'function'
    ) {
      return false;
    }

    return globalThis.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches === true;

  } catch {
    return false;
  }
}

// ------------------------------------
// DEFAULT STATE
// ------------------------------------

export function defaultState() {
  return {
    v: SCHEMA_VERSION,

    settings: {
      lang: 'bn',
      reduceMotion: osPrefersReducedMotion()
    },

    character: null,

    journal: [],

    achievements: []
  };
}

// ------------------------------------
// CHARACTER COMPARISON
// ------------------------------------

function isCharacterUnchanged(raw, sanitized) {
  if (!isObj(raw) || !sanitized) {
    return false;
  }

  if (!hasExactKeys(raw, CHARACTER_KEYS)) {
    return false;
  }

  return CHARACTER_KEYS.every(
    (key) => raw[key] === sanitized[key]
  );
}

// ------------------------------------
// JOURNAL VALIDATION
// ------------------------------------

function validateJournal(raw) {
  if (!Array.isArray(raw)) {
    return {
      value: [],
      repaired: true
    };
  }

  const filtered = raw
    .filter(isObj)
    .slice(-MAX_JOURNAL);

  return {
    value: filtered,

    repaired: filtered.length !== raw.length
  };
}

// ------------------------------------
// ACHIEVEMENT VALIDATION
// ------------------------------------

function validateAchievements(raw) {
  if (!Array.isArray(raw)) {
    return {
      value: [],
      repaired: true
    };
  }

  const filtered = [
    ...new Set(
      raw.filter(
        (item) =>
          typeof item === 'string' &&
          item.length <= 64
      )
    )
  ].slice(0, MAX_ACHIEVEMENTS);

  const unchanged =
    filtered.length === raw.length &&
    filtered.every(
      (item, index) => item === raw[index]
    );

  return {
    value: filtered,
    repaired: !unchanged
  };
}

// ------------------------------------
// VERSION MIGRATION
// ------------------------------------

function migrate(raw) {
  const data = { ...raw };

  const version = hasOwn(data, 'v')
    ? data.v
    : 1;

  if (!Number.isInteger(version) || version < 1) {
    return {
      ok: false,
      reason: 'invalid-version'
    };
  }

  if (version > SCHEMA_VERSION) {
    return {
      ok: false,
      reason: 'newer-version'
    };
  }

  let migrated = false;

  // ----------------------------------
  // VERSION 1 -> VERSION 2
  // ----------------------------------

  if (version === 1) {
    const life = isObj(data.life)
      ? data.life
      : null;

    if (life) {
      data.character = sanitizeCharacter({
        id: life.id,
        startAge: life.startAge,
        currentAge: life.currentAge,
        createdAt: life.createdAt,
        lastProgressAt: life.lastProgressAt
      });
    }

    delete data.life;

    data.v = 2;

    migrated = true;
  }

  return {
    ok: true,
    data,
    migrated
  };
}

// ------------------------------------
// MAIN STATE VALIDATION
// ------------------------------------

export function validateState(raw) {
  try {
    // --------------------------------
    // ROOT VALIDATION
    // --------------------------------

    if (!isObj(raw)) {
      return {
        ok: false,
        reason: 'not-object'
      };
    }

    // Reject unsafe or non-JSON data.
    if (!isJsonCompatible(raw)) {
      return {
        ok: false,
        reason: 'not-json-compatible'
      };
    }

    // --------------------------------
    // VERSION VALIDATION
    // --------------------------------

    if (
      hasOwn(raw, 'v') &&
      (
        !Number.isInteger(raw.v) ||
        raw.v < 1
      )
    ) {
      return {
        ok: false,
        reason: 'invalid-version'
      };
    }

    if (
      Number.isInteger(raw.v) &&
      raw.v > SCHEMA_VERSION
    ) {
      return {
        ok: false,
        reason: 'newer-version'
      };
    }

    // --------------------------------
    // MIGRATION
    // --------------------------------

    const migration = migrate(raw);

    if (!migration.ok) {
      return migration;
    }

    const data = migration.data;

    const migrated = migration.migrated;

    const base = defaultState();

    let repaired = false;

    // --------------------------------
    // ROOT STRUCTURE
    // --------------------------------

    if (!hasExactKeys(data, STATE_KEYS)) {
      repaired = true;
    }

    // --------------------------------
    // SETTINGS VALIDATION
    // --------------------------------

    const sourceSettings = isObj(data.settings)
      ? data.settings
      : {};

    if (
      !isObj(data.settings) ||
      !hasExactKeys(sourceSettings, SETTINGS_KEYS)
    ) {
      repaired = true;
    }

    const lang = LANGS.includes(sourceSettings.lang)
      ? sourceSettings.lang
      : base.settings.lang;

    const reduceMotion =
      typeof sourceSettings.reduceMotion === 'boolean'
        ? sourceSettings.reduceMotion
        : base.settings.reduceMotion;

    if (
      lang !== sourceSettings.lang ||
      reduceMotion !== sourceSettings.reduceMotion
    ) {
      repaired = true;
    }

    // --------------------------------
    // CHARACTER VALIDATION
    // --------------------------------

    let character = null;

    if (!hasOwn(data, 'character')) {
      repaired = true;
    } else if (data.character !== null) {
      character = sanitizeCharacter(data.character);

      if (
        !character ||
        !isCharacterUnchanged(
          data.character,
          character
        )
      ) {
        repaired = true;
      }
    }

    // --------------------------------
    // CHARACTER AGE INTEGRITY
    // --------------------------------

    if (character) {
      const validStartAge =
        isValidAge(character.startAge);

      const validCurrentAge =
        isValidAge(character.currentAge) &&
        character.currentAge >= character.startAge;

      if (!validStartAge || !validCurrentAge) {
        character = null;
        repaired = true;
      }
    }

    // --------------------------------
    // JOURNAL VALIDATION
    // --------------------------------

    const journalResult = validateJournal(
      hasOwn(data, 'journal')
        ? data.journal
        : []
    );

    const journal = journalResult.value;

    if (
      !hasOwn(data, 'journal') ||
      journalResult.repaired
    ) {
      repaired = true;
    }

    // --------------------------------
    // ACHIEVEMENT VALIDATION
    // --------------------------------

    const achievementResult = validateAchievements(
      hasOwn(data, 'achievements')
        ? data.achievements
        : []
    );

    const achievements = achievementResult.value;

    if (
      !hasOwn(data, 'achievements') ||
      achievementResult.repaired
    ) {
      repaired = true;
    }

    // --------------------------------
    // FINAL STATE
    // --------------------------------

    const state = {
      v: SCHEMA_VERSION,

      settings: {
        lang,
        reduceMotion
      },

      character,

      journal,

      achievements
    };

    // Final serialization safety check.
    if (!isJsonCompatible(state)) {
      return {
        ok: false,
        reason: 'serialization-failed'
      };
    }

    return {
      ok: true,

      state,

      repaired,

      migrated
    };

  } catch {
    return {
      ok: false,
      reason: 'validation-failed'
    };
  }
}
  
