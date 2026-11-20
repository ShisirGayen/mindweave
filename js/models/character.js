
// © Shisir Gayen. All rights reserved.
// MINDWEAVE — Character Data Model

export const MIN_AGE = 0;
export const MAX_AGE = 100;

export const REWARD_MIN_START_AGE = 1;
export const REWARD_MAX_START_AGE = 18;

// Basic validation
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

// ID generation
function makeId() {
  try {
    if (
      globalThis.crypto &&
      typeof globalThis.crypto.randomUUID === 'function'
    ) {
      return globalThis.crypto.randomUUID();
    }
  } catch {
    // Fallback
  }

  return (
    'c' +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 10)
  );
}

// Internal protected character factory
function buildCharacter({
  id,
  startAge,
  currentAge,
  createdAt,
  lastProgressAt
}) {
  const character = {
    id,
    startAge,
    currentAge,
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

// Character creation
export function createCharacter(startAge, now = Date.now()) {
  if (!isValidAge(startAge)) {
    throw new RangeError(
      'startAge must be an integer from 0 to 100.'
    );
  }

  if (!isValidTimestamp(now)) {
    throw new RangeError(
      'Invalid creation timestamp.'
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

// Character sanitization
export function sanitizeCharacter(raw) {
  if (!isObject(raw)) {
    return null;
  }

  if (!isValidAge(raw.startAge)) {
    return null;
  }

  const startAge = raw.startAge;

  const currentAge =
    isValidAge(raw.currentAge) &&
    raw.currentAge >= startAge
      ? raw.currentAge
      : startAge;

  const createdAt = isValidTimestamp(raw.createdAt)
    ? raw.createdAt
    : Date.now();

  const lastProgressAt =
    isValidTimestamp(raw.lastProgressAt) &&
    raw.lastProgressAt >= createdAt
      ? raw.lastProgressAt
      : createdAt;

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

// Age progression
export function withAge(character, newAge, now = Date.now()) {
  if (!isObject(character)) {
    return character;
  }

  if (
    !isValidAge(character.startAge) ||
    !isValidAge(character.currentAge) ||
    character.currentAge < character.startAge
  ) {
    return character;
  }

  if (
    !isValidTimestamp(character.createdAt) ||
    !isValidTimestamp(character.lastProgressAt) ||
    character.lastProgressAt < character.createdAt
  ) {
    return character;
  }

  if (!isValidAge(newAge)) {
    return character;
  }

  if (newAge < character.currentAge) {
    return character;
  }

  if (newAge === character.currentAge) {
    return character;
  }

  if (
    !isValidTimestamp(now) ||
    now < character.lastProgressAt
  ) {
    return character;
  }

  return buildCharacter({
    id: character.id,
    startAge: character.startAge,
    currentAge: newAge,
    createdAt: character.createdAt,
    lastProgressAt: now
  });
}

// Secret reward eligibility
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
