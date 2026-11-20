// © Shisir Gayen. All rights reserved.
// MINDWEAVE - Central State Manager

import {
  defaultState,
  validateState
} from '../systems/validate.js';

import {
  init as initStorage,
  persist,
  isPersistent
} from '../systems/storage.js';

// ------------------------------------
// INTERNAL STATE
// ------------------------------------

let currentState = null;
let initialized = false;

const subscribers = new Set();

// ------------------------------------
// UTILITIES
// ------------------------------------

function cloneState(value) {
  return JSON.parse(JSON.stringify(value));
}

function ensureInitialized() {
  if (!initialized) {
    initializeState();
  }
}

function notifySubscribers(metadata = {}) {
  const snapshot = cloneState(currentState);

  for (const callback of subscribers) {
    try {
      callback(cloneState(snapshot), metadata);
    } catch (error) {
      console.error(
        '[MINDWEAVE] State subscriber error:',
        error
      );
    }
  }
}

// ------------------------------------
// INITIALIZATION
// ------------------------------------

export function initializeState(customStorage) {
  if (initialized) {
    return {
      state: cloneState(currentState),
      notice: null,
      persistent: isPersistent()
    };
  }

  const loaded = initStorage(customStorage);

  currentState = loaded.state || defaultState();
  initialized = true;

  let saveWarning = null;

  // Restore repaired or recovered data safely.
  if (
    loaded.notice === 'repaired' ||
    loaded.notice === 'recovered-backup'
  ) {
    const result = persist(currentState);

    if (!result.ok) {
      saveWarning = result.reason;
    }
  }

  return {
    state: cloneState(currentState),
    notice: loaded.notice,
    persistent: isPersistent(),
    saveWarning
  };
}

// ------------------------------------
// GET CURRENT STATE
// ------------------------------------

export function getState() {
  ensureInitialized();

  return cloneState(currentState);
}

// ------------------------------------
// UPDATE STATE
// ------------------------------------

export function updateState(updater) {
  ensureInitialized();

  let candidate;

  if (typeof updater === 'function') {
    const draft = cloneState(currentState);

    const result = updater(draft);

    candidate = result === undefined
      ? draft
      : result;

  } else {
    candidate = updater;
  }

  const validation = validateState(candidate);

  if (!validation.ok) {
    throw new Error(
      'Invalid MINDWEAVE state: ' +
      validation.reason
    );
  }

  currentState = validation.state;

  const saveResult = persist(currentState);

  notifySubscribers({
    type: 'update',
    saved: saveResult.ok,
    persistent: isPersistent(),
    repaired: validation.repaired,
    migrated: validation.migrated
  });

  return {
    state: cloneState(currentState),
    save: saveResult
  };
}

// ------------------------------------
// REPLACE ENTIRE STATE
// ------------------------------------

export function replaceState(newState) {
  return updateState(newState);
}

// ------------------------------------
// RESET STATE
// ------------------------------------

export function resetState() {
  return updateState(defaultState());
}

// ------------------------------------
// SUBSCRIPTION SYSTEM
// ------------------------------------

export function subscribe(callback) {
  if (typeof callback !== 'function') {
    throw new TypeError(
      'Subscriber must be a function'
    );
  }

  subscribers.add(callback);

  return function unsubscribe() {
    subscribers.delete(callback);
  };
}

// ------------------------------------
// MANUAL SAVE
// ------------------------------------

export function saveState() {
  ensureInitialized();

  return persist(currentState);
}

// ------------------------------------
// STATUS
// ------------------------------------

export function isInitialized() {
  return initialized;
}

export function getStorageStatus() {
  ensureInitialized();

  return {
    persistent: isPersistent(),
    initialized
  };
}

// ------------------------------------
// DEBUG INFORMATION
// ------------------------------------

export function getStateInfo() {
  ensureInitialized();

  return {
    version: currentState.v,
    characterExists: currentState.character !== null,
    journalEntries: currentState.journal.length,
    achievements: currentState.achievements.length,
    subscribers: subscribers.size,
    persistent: isPersistent()
  };
      }
// © Shisir Gayen. All rights reserved.
// MINDWEAVE - Central Event Management System

const events = new Map();

let eventId = 0;

// Register an event listener
export function on(eventName, callback) {
  if (typeof eventName !== 'string' || !eventName.trim()) {
    throw new TypeError('Invalid event name');
  }

  if (typeof callback !== 'function') {
    throw new TypeError('Callback must be a function');
  }

  if (!events.has(eventName)) {
    events.set(eventName, new Map());
  }

  const id = ++eventId;

  events.get(eventName).set(id, callback);

  return () => off(eventName, id);
}

// Remove an event listener
export function off(eventName, id) {
  const listeners = events.get(eventName);

  if (!listeners) return false;

  const removed = listeners.delete(id);

  if (listeners.size === 0) {
    events.delete(eventName);
  }

  return removed;
}

// Emit an event
export function emit(eventName, payload = null) {
  const listeners = events.get(eventName);

  if (!listeners) return 0;

  const callbacks = [...listeners.values()];
  let executed = 0;

  for (const callback of callbacks) {
    try {
      callback(payload);
      executed++;
    } catch (error) {
      console.error(
        `[MINDWEAVE] Event error: ${eventName}`,
        error
      );
    }
  }

  return executed;
}

// Register a listener that runs only once
export function once(eventName, callback) {
  let unsubscribe;

  unsubscribe = on(eventName, (payload) => {
    unsubscribe();
    callback(payload);
  });

  return unsubscribe;
}

// Remove all listeners for an event
export function clear(eventName) {
  if (eventName === undefined) {
    events.clear();
    return;
  }

  events.delete(eventName);
}

// Get event listener count
export function listenerCount(eventName) {
  return events.get(eventName)?.size ?? 0;
}

// Get registered event names
export function getEventNames() {
  return [...events.keys()];
}

