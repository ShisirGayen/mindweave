
// © Shisir Gayen. All rights reserved.
// MINDWEAVE - Safe Save Storage System
// Handles validation, backups, corrupted saves and storage failures.

import {
  validateState,
  defaultState
} from './validate.js';

// ------------------------------------
// STORAGE KEYS
// ------------------------------------

const KEYS = {
  main: 'mindweave.save',
  backup: 'mindweave.save.bak',
  unreadable: 'mindweave.save.unreadable',
  archive: 'mindweave.save.prevlife'
};

// ------------------------------------
// STORAGE VARIABLES
// ------------------------------------

let store = null;
let persistent = false;

// ------------------------------------
// MEMORY STORAGE
// ------------------------------------

function memoryStore() {
  const memory = new Map();

  return {
    getItem(key) {
      return memory.has(key)
        ? memory.get(key)
        : null;
    },

    setItem(key, value) {
      memory.set(key, String(value));
    },

    removeItem(key) {
      memory.delete(key);
    }
  };
}

// ------------------------------------
// STORAGE DETECTION
// ------------------------------------

function detect() {
  try {
    const local = globalThis.localStorage;

    if (!local) {
      throw new Error('localStorage unavailable');
    }

    local.setItem('mindweave.probe', '1');
    local.removeItem('mindweave.probe');

    return {
      store: local,
      persistent: true
    };
  } catch {
    return {
      store: memoryStore(),
      persistent: false
    };
  }
}

// ------------------------------------
// ERROR HELPERS
// ------------------------------------

function isQuota(error) {
  return !!error && (
    error.name === 'QuotaExceededError' ||
    error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    error.code === 22 ||
    error.code === 1014
  );
}

function storageFailure(error) {
  return {
    ok: false,
    reason: isQuota(error)
      ? 'quota'
      : 'error'
  };
}

// ------------------------------------
// SAFE READ / WRITE
// ------------------------------------

function read(key) {
  if (!store) {
    return null;
  }

  try {
    return store.getItem(key);
  } catch {
    return null;
  }
}

function write(key, value) {
  if (!store) {
    return {
      ok: false,
      reason: 'error'
    };
  }

  try {
    store.setItem(key, value);

    return {
      ok: true
    };
  } catch (error) {
    return storageFailure(error);
  }
}

// ------------------------------------
// SAVE PARSING
// ------------------------------------

function parse(raw) {
  if (typeof raw !== 'string') {
    return {
      ok: false,
      reason: 'missing'
    };
  }

  try {
    return validateState(JSON.parse(raw));
  } catch {
    return {
      ok: false,
      reason: 'bad-json'
    };
  }
}

// ------------------------------------
// INITIALIZE STORAGE
// ------------------------------------

export function init(custom) {
  if (custom !== undefined && custom !== null) {
    if (
      typeof custom.getItem !== 'function' ||
      typeof custom.setItem !== 'function' ||
      typeof custom.removeItem !== 'function'
    ) {
      throw new TypeError(
        'Custom storage must provide getItem, setItem and removeItem'
      );
    }

    store = custom;
    persistent = true;
  } else {
    const detected = detect();

    store = detected.store;
    persistent = detected.persistent;
  }

  const raw = read(KEYS.main);

  if (raw === null) {
    return {
      state: defaultState(),
      notice: persistent ? null : 'no-storage'
    };
  }

  const main = parse(raw);

  if (main.ok) {
    return {
      state: main.state,
      notice: main.repaired
        ? 'repaired'
        : null
    };
  }

  // Preserve unreadable save before recovery.
  write(KEYS.unreadable, raw);

  // Attempt backup recovery.
  const backup = parse(read(KEYS.backup));

  if (backup.ok) {
    return {
      state: backup.state,
      notice: 'recovered-backup'
    };
  }

  return {
    state: defaultState(),
    notice: main.reason === 'newer-version'
      ? 'newer-version'
      : 'corrupt-reset'
  };
}

// ------------------------------------
// PERSIST MAIN SAVE
// ------------------------------------

export function persist(state) {
  const validation = validateState(state);

  if (!validation.ok) {
    return {
      ok: false,
      reason: 'invalid-state'
    };
  }

  const previous = read(KEYS.main);

  // Keep the previous valid save as backup.
  if (previous !== null) {
    const parsedPrevious = parse(previous);

    if (parsedPrevious.ok) {
      write(KEYS.backup, previous);
    }
  }

  const result = write(
    KEYS.main,
    JSON.stringify(validation.state)
  );

  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    persistent
  };
}

// ------------------------------------
// STORAGE STATUS
// ------------------------------------

export const isPersistent = () => persistent;

// ------------------------------------
// PREVIOUS LIFE ARCHIVE
// ------------------------------------

export function archiveSave(state) {
  const validation = validateState(state);

  if (!validation.ok) {
    return {
      ok: false,
      reason: 'invalid-state'
    };
  }

  return write(
    KEYS.archive,
    JSON.stringify(validation.state)
  );
}

export function readArchive() {
  const result = parse(read(KEYS.archive));

  if (
    !result.ok ||
    !result.state.character
  ) {
    return null;
  }

  return result.state;
}

export function clearArchive() {
  if (!store) return;

  try {
    store.removeItem(KEYS.archive);
  } catch {
    // Ignore storage removal errors.
  }
}

// ------------------------------------
// CLEAR ALL SAVED DATA
// ------------------------------------

export function clearAll() {
  if (!store) return;

  for (const key of Object.values(KEYS)) {
    try {
      store.removeItem(key);
    } catch {
      // Continue clearing remaining keys.
    }
  }
}
