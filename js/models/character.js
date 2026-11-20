
// © Shisir Gayen. All rights reserved.
// MINDWEAVE — Character Data Model
// The Hidden Rules of a Living World.
//
// Core Rules:
// 1. startAge is permanent after character creation.
// 2. currentAge can only change through withAge().
// 3. Character ages must remain within MIN_AGE and MAX_AGE.
// 4. Secret reward eligibility depends only on startAge.
// 5. Eligible starting age: 1–18.
// 6. Character data must remain JSON-serializable.

export const MIN_AGE = 0;
export const MAX_AGE = 100;

export const REWARD_MIN_START_AGE = 1;
export const REWARD_MAX_START_AGE = 18;

// --------------------------------------------------
// BASIC VALIDATION
// --------------------------------------------------

export const isValidAge = (age) =>
  Number.isInteger(age) &&
  age >= MIN_AGE &&
  age <= MAX_AGE;

const isValidTimestamp = (value) =>
  Number.isFinite(value) && value >= 0;

const isObject = (value) =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value);

// --------------------------------------------------
// CHARACTER ID GENERATION
// --------------------------------------------------

function makeId() {
  try {
    if (
      globalThis.crypto &&
      typeof globalThis.crypto.randomUUID === 'function'
    ) {
      return globalThis.crypto.randomUUID();
    }
  } catch {
    // Use fallback ID generation.
  }

  return (
    'c' +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 10)
  );
}

// --------------------------------------------------
// INTERNAL CHARACTER FACTORY
// --------------------------------------------------

// Creates a character with protected age properties.
// Both properties remain enumerable for JSON serialization.

function buildCharacter({
  id,
  startAge,
  currentAge,
  createdAt,
  lastProgressAt
}) {
  const character = {
    id,
    createdAt,
    lastProgressAt
  };

  Object.defineProperties(character, {
    startAge: {
      value: startAge,
      writable: false,
      enumerable: true,
      configurable: false
    },

    currentAge: {
      value: currentAge,
      writable: false,
      enumerable: true,
      configurable: false
    }
  });

  return character;
}

// --------------------------------------------------
// CHARACTER CREATION
// --------------------------------------------------

export function createCharacter(startAge, now = Date.now()) {
  if (!isValidAge(startAge)) {
    throw new RangeError(
      'startAge must be an integer from 0 to 100.'
    );
  }

  if (!isValidTimestamp(now)) {
    throw new RangeError(
      'Creation timestamp must be a valid non-negative number.'
    );
  }

  return buildCharacter({
    id: makeId(),
    startAge,
    currentAge: startAge,
    createdAt: now,
    lastProgressAt: now
  });
}

// --------------------------------------------------
// CHARACTER SANITIZATION
// --------------------------------------------------

// Returns a clean and protected character object.
// Returns null if the starting age is invalid.

export function sanitizeCharacter(raw) {
  if (!isObject(raw)) {
    return null;
  }

  if (!isValidAge(raw.startAge)) {
    return null;
  }

  const startAge = raw.startAge;

  // Repair invalid or inconsistent current age.
  const currentAge =
    isValidAge(raw.currentAge) &&
    raw.currentAge >= startAge
      ? raw.currentAge
      : startAge;

  // Repair invalid creation timestamp.
  const createdAt = isValidTimestamp(raw.createdAt)
    ? raw.createdAt
    : Date.now();

  // Progress timestamp cannot precede creation.
  const lastProgressAt =
    isValidTimestamp(raw.lastProgressAt) &&
    raw.lastProgressAt >= createdAt
      ? raw.lastProgressAt
      : createdAt;

  // Preserve valid IDs and repair invalid ones.
  const id =
    typeof raw.id === 'string' &&
    raw.id.trim().length > 0
      ? raw.id.trim().slice(0, 64)
      : makeId();

  return buildCharacter({
    id,
    startAge,
    currentAge,
    createdAt,
    lastProgressAt
  });
}

// --------------------------------------------------
// CHARACTER AGE PROGRESSION
// --------------------------------------------------

// Returns a NEW character object.
// The original character remains unchanged.
//
// Age cannot decrease.
// Age cannot exceed MAX_AGE.
// Age cannot change outside this function.

export function withAge(character, newAge, now = Date.now()) {
  if (!isObject(character)) {
    return character;
  }

  // Validate existing character age data.
  if (
    !isValidAge(character.startAge) ||
    !isValidAge(character.currentAge) ||
    character.currentAge < character.startAge
  ) {
    return character;
  }

  // Validate progression timestamp data.
  if (
    !isValidTimestamp(character.createdAt) ||
    !isValidTimestamp(character.lastProgressAt) ||
    character.lastProgressAt < character.createdAt
  ) {
    return character;
  }

  // Validate the requested age.
  if (!isValidAge(newAge)) {
    return character;
  }

  // Prevent age regression.
  if (newAge < character.currentAge) {
    return character;
  }

  // No unnecessary update.
  if (newAge === character.currentAge) {
    return character;
  }

  // Validate progression time.
  if (
    !isValidTimestamp(now) ||
    now < character.lastProgressAt
  ) {
    return character;
  }

  // Return a new protected character.
  return buildCharacter({
    id: character.id,
    startAge: character.startAge,
    currentAge: newAge,
    createdAt: character.createdAt,
    lastProgressAt: now
  });
}

// --------------------------------------------------
// SECRET REWARD ELIGIBILITY
// --------------------------------------------------

// Secret reward eligibility is based on ORIGINAL starting age.
// Current age never affects this eligibility.
//
// Eligible: 1–18
// Ineligible: 0 and 19–100
//
// This function does not expose reward information
// through the game interface.

export const isRewardEligible = (character) => {
  if (!isObject(character)) {
    return false;
  }

  const startAge = character.startAge;

  return (
    isValidAge(startAge) &&
    startAge >= REWARD_MIN_START_AGE &&
    startAge <= REWARD_MAX_START_AGE
  );
};
