// © Shisir Gayen. All rights reserved.
// MINDWEAVE - Central Game Controller

import {
  initializeState,
  getState,
  updateState,
  subscribe,
  saveState
} from './state.js';

import {
  emit,
  clear
} from './events.js';

// ------------------------------------
// GAME STATUS
// ------------------------------------

const STATUS = Object.freeze({
  READY: 'ready',
  RUNNING: 'running',
  PAUSED: 'paused',
  STOPPED: 'stopped'
});

let status = STATUS.READY;
let initialized = false;
let unsubscribeState = null;

// ------------------------------------
// INITIALIZE GAME
// ------------------------------------

export function initializeGame(customStorage) {
  if (initialized) {
    return {
      ok: true,
      status,
      state: getState()
    };
  }

  try {
    const result = initializeState(customStorage);

    unsubscribeState = subscribe((state, metadata) => {
      emit('game:stateChanged', {
        state,
        metadata
      });
    });

    initialized = true;
    status = STATUS.READY;

    emit('game:initialized', {
      notice: result.notice,
      persistent: result.persistent
    });

    return {
      ok: true,
      status,
      ...result
    };

  } catch (error) {
    console.error('[MINDWEAVE] Initialization failed:', error);

    return {
      ok: false,
      error: error.message
    };
  }
}

// ------------------------------------
// START GAME
// ------------------------------------

export function startGame() {
  if (!initialized) {
    throw new Error('Initialize game before starting');
  }

  if (status === STATUS.RUNNING) {
    return false;
  }

  status = STATUS.RUNNING;

  emit('game:started', {
    state: getState()
  });

  return true;
}

// ------------------------------------
// PAUSE GAME
// ------------------------------------

export function pauseGame() {
  if (status !== STATUS.RUNNING) {
    return false;
  }

  status = STATUS.PAUSED;

  emit('game:paused', {
    state: getState()
  });

  return true;
}

// ------------------------------------
// RESUME GAME
// ------------------------------------

export function resumeGame() {
  if (status !== STATUS.PAUSED) {
    return false;
  }

  status = STATUS.RUNNING;

  emit('game:resumed', {
    state: getState()
  });

  return true;
}

// ------------------------------------
// STOP GAME
// ------------------------------------

export function stopGame() {
  if (!initialized) return false;

  const saveResult = saveState();

  status = STATUS.STOPPED;

  emit('game:stopped', {
    save: saveResult
  });

  return saveResult.ok;
}

// ------------------------------------
// STATE ACCESS
// ------------------------------------

export function getGameState() {
  if (!initialized) {
    throw new Error('Game is not initialized');
  }

  return getState();
}

export function modifyGameState(updater) {
  if (!initialized) {
    throw new Error('Game is not initialized');
  }

  return updateState(updater);
}

// ------------------------------------
// GAME STATUS
// ------------------------------------

export function getGameStatus() {
  return status;
}

export function isGameRunning() {
  return status === STATUS.RUNNING;
}

export function isGameInitialized() {
  return initialized;
}

// ------------------------------------
// SHUTDOWN
// ------------------------------------

export function shutdownGame() {
  if (!initialized) return false;

  const saved = saveState();

  if (unsubscribeState) {
    unsubscribeState();
    unsubscribeState = null;
  }

  clear();

  status = STATUS.STOPPED;
  initialized = false;

  emit('game:shutdown');

  return saved.ok;
}

export { STATUS };
    
