
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

function readResult(key) {
  if (!store) {
    return {
      ok: false,
      value: null,
      reason: 'unavailable'
    };
  }

  try {
    return {
      ok: true,
      value: store.getItem(key)
    };
  } catch {
    return {
      ok: false,
      value: null,
      reason: 'error'
    };
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
// NORMALIZED SAVE WRITER
// ------------------------------------

function writeNormalized(state) {
  let serialized;

  try {
    serialized = JSON.stringify(state);
  } catch {
    return {
      ok: false,
      reason: 'serialization'
    };
  }

  if (typeof serialized !== 'string') {
    return {
      ok: false,
      reason: 'serialization'
    };
  }

  return write(KEYS.main, serialized);
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

  // Read main save.
  const mainRead = readResult(KEYS.main);

  if (!mainRead.ok) {
    return {
      state: defaultState(),
      notice: 'storage-read-error'
    };
  }

  const raw = mainRead.value;

  // ----------------------------------
  // MAIN SAVE DOES NOT EXIST
  // ----------------------------------

  if (raw === null) {
    const backupRead = readResult(KEYS.backup);

    if (!backupRead.ok) {
      return {
        state: defaultState(),
        notice: 'storage-read-error'
      };
    }

    if (backupRead.value !== null) {
      const backup = parse(backupRead.value);

      if (backup.reason === 'newer-version') {
        return {
          state: defaultState(),
          notice: 'newer-version'
        };
      }

      if (backup.ok) {
        const saved = persist(backup.state);

        return {
          state: backup.state,
          notice: saved.ok
            ? 'recovered-backup'
            : 'recovered-backup-unsaved'
        };
      }

      return {
        state: defaultState(),
        notice: 'corrupt-reset'
      };
    }

    return {
      state: defaultState(),
      notice: persistent ? null : 'no-storage'
    };
  }

  // ----------------------------------
  // VALIDATE MAIN SAVE
  // ----------------------------------

  const main = parse(raw);

  if (main.ok) {
    if (main.repaired || main.migrated) {
      const saved = persist(main.state);

      let notice = null;

      if (!saved.ok) {
        notice = main.migrated
          ? 'migration-unsaved'
          : 'repair-unsaved';
      } else {
        notice = main.repaired
          ? 'repaired'
          : 'migrated';
      }

      return {
        state: main.state,
        notice
      };
    }

    return {
      state: main.state,
      notice: null
    };
  }

  // ----------------------------------
  // NEWER VERSION PROTECTION
  // ----------------------------------

  if (main.reason === 'newer-version') {
    return {
      state: defaultState(),
      notice: 'newer-version'
    };
  }

  // ----------------------------------
  // PRESERVE UNREADABLE SAVE
  // ----------------------------------

  const unreadableResult = write(
    KEYS.unreadable,
    raw
  );

  // ----------------------------------
  // BACKUP RECOVERY
  // ----------------------------------

  const backupRead = readResult(KEYS.backup);

  if (!backupRead.ok) {
    return {
      state: defaultState(),
      notice: 'storage-read-error'
    };
  }

  const backup = parse(backupRead.value);

  if (backup.reason === 'newer-version') {
    return {
      state: defaultState(),
      notice: 'newer-version'
    };
  }

  if (backup.ok) {
    const restored = persist(backup.state);

    if (!restored.ok) {
      return {
        state: backup.state,
        notice: 'recovered-backup-unsaved'
      };
    }

    return {
      state: backup.state,
      notice: unreadableResult.ok
        ? 'recovered-backup'
        : 'recovered-backup-unreadable-unsaved'
    };
  }

  return {
    state: defaultState(),
    notice: unreadableResult.ok
      ? 'corrupt-reset'
      : 'corrupt-reset-unreadable-unsaved'
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
      reason: validation.reason === 'newer-version'
        ? 'newer-version'
        : 'invalid-state'
    };
  }

  const previousRead = readResult(KEYS.main);

  if (!previousRead.ok) {
    return {
      ok: false,
      reason: 'read-error'
    };
  }

  const previous = previousRead.value;

  if (previous !== null) {
    const parsedPrevious = parse(previous);

    // Never overwrite a save from a newer schema.
    if (parsedPrevious.reason === 'newer-version') {
      return {
        ok: false,
        reason: 'newer-version'
      };
    }

    if (parsedPrevious.ok) {
      // Preserve the previous valid save as backup.
      const backupResult = write(
        KEYS.backup,
        previous
      );

      if (!backupResult.ok) {
        return backupResult;
      }
    } else {
      // Preserve invalid data before replacing main.
      const unreadableResult = write(
        KEYS.unreadable,
        previous
      );

      if (!unreadableResult.ok) {
        return unreadableResult;
      }
    }
  }

  const result = writeNormalized(
    validation.state
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

  let serialized;

  try {
    serialized = JSON.stringify(validation.state);
  } catch {
    return {
      ok: false,
      reason: 'serialization'
    };
  }

  if (typeof serialized !== 'string') {
    return {
      ok: false,
      reason: 'serialization'
    };
  }

  return write(
    KEYS.archive,
    serialized
  );
}

export function readArchive() {
  const result = readResult(KEYS.archive);

  if (!result.ok) {
    return null;
  }

  const parsed = parse(result.value);

  if (
    !parsed.ok ||
    !parsed.state.character
  ) {
    return null;
  }

  return parsed.state;
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
