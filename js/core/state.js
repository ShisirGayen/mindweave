// © Shisir Gayen. All rights reserved.
// MINDWEAVE - Central State Management System

import {
  defaultState,
  validateState
} from '../systems/validate.js';

import {
  init as initStorage,
  persist,
  isPersistent
} from '../systems/storage.js';

import { emit } from './events.js';

// ------------------------------------
// STATE VARIABLES
// ------------------------------------

let currentState = null;
let initialized = false;
let storageNotice = null;

const subscribers = new Set();

// ------------------------------------
// HELPERS
// ------------------------------------

function cloneState(state) {
  return structuredClone(state);
}

function notifySubscribers(metadata = {}) {
  const snapshot = cloneState(currentState);

  for (const callback of [...subscribers]) {
    try {
      callback(snapshot, metadata);
    } catch (error) {
      console.error(
        '[MINDWEAVE] State subscriber error:',
        error
      );
    }
  }

  emit('state:changed', {
    state: snapshot,
    metadata
  });
}

function ensureInitialized() {
  if (!initialized) {
    throw new Error(
      'State Manager has not been initialized'
    );
  }
}

// ------------------------------------
// INITIALIZE STATE
// ------------------------------------

export function initializeState(customStorage) {
  if (initialized) {
    return {
      ok: true,
      state: getState(),
      notice: storageNotice,
      persistent: isPersistent()
    };
  }

  const result = initStorage(customStorage);

  const validation = validateState(result.state);

  if (!validation.ok) {
    throw new Error(
      'Unable to initialize valid game state'
    );
  }

  currentState = cloneState(validation.state);
  storageNotice = result.notice;
  initialized = true;

  emit('state:initialized', {
    notice: storageNotice,
    persistent: isPersistent()
  });

  return {
    ok: true,
    state: getState(),
    notice: storageNotice,
    persistent: isPersistent()
  };
}

// ------------------------------------
// GET STATE
// ------------------------------------

export function getState() {
  ensureInitialized();

  return cloneState(currentState);
}

// ------------------------------------
// UPDATE STATE
// ------------------------------------

export function updateState(updater, metadata = {}) {
  ensureInitialized();

  if (typeof updater !== 'function') {
    throw new TypeError(
      'State updater must be a function'
    );
  }

  const draft = cloneState(currentState);

  const result = updater(draft);

  const candidate = result === undefined
    ? draft
    : result;

  const validation = validateState(candidate);

  if (!validation.ok) {
    throw new Error(
      `Invalid state update: ${validation.reason}`
    );
  }

  currentState = cloneState(validation.state);

  notifySubscribers({
    ...metadata,
    repaired: validation.repaired,
    migrated: validation.migrated
  });

  return getState();
}

// ------------------------------------
// REPLACE STATE
// ------------------------------------

export function replaceState(newState, metadata = {}) {
  ensureInitialized();

  const validation = validateState(newState);

  if (!validation.ok) {
    throw new Error(
      `Invalid replacement state: ${validation.reason}`
    );
  }

  currentState = cloneState(validation.state);

  notifySubscribers({
    ...metadata,
    replaced: true,
    repaired: validation.repaired
  });

  return getState();
}

// ------------------------------------
// RESET STATE
// ------------------------------------

export function resetState() {
  ensureInitialized();

  currentState = defaultState();

  notifySubscribers({
    reset: true
  });

  return getState();
}

// ------------------------------------
// SUBSCRIBE
// ------------------------------------

export function subscribe(callback) {
  if (typeof callback !== 'function') {
    throw new TypeError(
      'Subscriber must be a function'
    );
  }

  subscribers.add(callback);

  return () => {
    subscribers.delete(callback);
  };
}

// ------------------------------------
// SAVE STATE
// ------------------------------------

export function saveState() {
  ensureInitialized();

  const validation = validateState(currentState);

  if (!validation.ok) {
    return {
      ok: false,
      reason: 'invalid-state'
    };
  }

  currentState = cloneState(validation.state);

  return persist(currentState);
}

// ------------------------------------
// STATUS
// ------------------------------------

export function isInitialized() {
  return initialized;
}

export function getStorageStatus() {
  return {
    persistent: isPersistent(),
    notice: storageNotice
  };
}

export function getStateInfo() {
  ensureInitialized();

  return {
    version: currentState.v,
    initialized,
    subscribers: subscribers.size,
    persistent: isPersistent(),
    notice: storageNotice
  };
        }
