// © Shisir Gayen. All rights reserved.
// Character data model.
// startAge never changes after creation (used later for secret-reward eligibility).
// currentAge changes only through age progression (rules are not final yet).

export const MIN_AGE = 0;
export const MAX_AGE = 100;

// Secret reward window for the starting age. Confirm with the creator whether age 0 (birth) counts.
export const REWARD_MIN_START_AGE = 0;
export const REWARD_MAX_START_AGE = 18;

export const isValidAge = (n) => Number.isInteger(n) && n >= MIN_AGE && n <= MAX_AGE;

function makeId() {
  try {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
      return globalThis.crypto.randomUUID();
    }
  } catch { /* fall through */ }
  return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export function createCharacter(startAge, now = Date.now()) {
  if (!isValidAge(startAge)) throw new RangeError('startAge must be an integer from 0 to 100');
  return { id: makeId(), startAge, currentAge: startAge, createdAt: now, lastProgressAt: now };
}

// Returns a clean character object, or null if the data cannot be trusted.
export function sanitizeCharacter(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (!isValidAge(raw.startAge)) return null;
  const currentAge = isValidAge(raw.currentAge) && raw.currentAge >= raw.startAge ? raw.currentAge : raw.startAge;
  const createdAt = Number.isFinite(raw.createdAt) ? raw.createdAt : Date.now();
  const lastProgressAt = Number.isFinite(raw.lastProgressAt) ? raw.lastProgressAt : createdAt;
  const id = typeof raw.id === 'string' && raw.id.length > 0 ? raw.id.slice(0, 64) : makeId();
  return { id, startAge: raw.startAge, currentAge, createdAt, lastProgressAt };
}

// Hook for future age progression. Returns a new object and never lowers the age.
export function withAge(character, newAge, now = Date.now()) {
  if (!isValidAge(newAge) || newAge < character.currentAge) return character;
  return { ...character, currentAge: newAge, lastProgressAt: now };
}

// Secret reward check. Never show this in the interface.
export const isRewardEligible = (c) =>
  !!c && c.startAge >= REWARD_MIN_START_AGE && c.startAge <= REWARD_MAX_START_AGE;
