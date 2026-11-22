// © Shisir Gayen. All rights reserved.
// MINDWEAVE — Application Entry Point

import {
  initializeGame,
  startGame,
  getGameState,
  modifyGameState,
  isGameRunning
} from './core/game.js';

import {
  createCharacter,
  isRewardEligible
} from './models/character.js';

import { on } from './core/events.js';

import {
  saveState,
  getStorageStatus
} from './core/state.js';

// ------------------------------------
// DOM ELEMENTS
// ------------------------------------

const elements = {
  systemStatus: document.getElementById('system-status'),
  saveStatus: document.getElementById('save-status'),
  newLifeButton: document.getElementById('new-life-button'),
  continueButton: document.getElementById('continue-button'),
  dialog: document.getElementById('game-dialog'),
  closeDialogButton: document.getElementById('close-dialog'),
  dialogTitle: document.getElementById('dialog-title'),
  dialogMessage: document.getElementById('dialog-message'),
  characterFormContainer: document.getElementById('character-form-container')
};

let appReady = false;
let busy = false;

// ------------------------------------
// UI HELPERS
// ------------------------------------

function setText(element, value) {
  if (element) element.textContent = value;
}

function setSystemStatus(value) {
  setText(elements.systemStatus, value);
}

function setSaveStatus(value) {
  setText(elements.saveStatus, value);
}

function openDialog() {
  if (!elements.dialog) return;

  if (typeof elements.dialog.showModal === 'function') {
    if (!elements.dialog.open) elements.dialog.showModal();
  } else {
    elements.dialog.setAttribute('open', '');
  }
}

function closeDialog() {
  if (!elements.dialog) return;

  if (typeof elements.dialog.close === 'function') {
    if (elements.dialog.open) elements.dialog.close();
  } else {
    elements.dialog.removeAttribute('open');
  }
}

// ------------------------------------
// CHARACTER CREATION FORM
// ------------------------------------

function renderCharacterForm() {
  const container = elements.characterFormContainer;

  if (!container) return;

  container.replaceChildren();

  const form = document.createElement('form');
  form.id = 'character-creation-form';
  form.className = 'character-form';

  const label = document.createElement('label');
  label.htmlFor = 'character-start-age';
  label.textContent = 'Choose your starting age';

  const ageInput = document.createElement('input');
  ageInput.id = 'character-start-age';
  ageInput.name = 'startAge';
  ageInput.type = 'number';
  ageInput.min = '0';
  ageInput.max = '100';
  ageInput.step = '1';
  ageInput.value = '18';
  ageInput.required = true;
  ageInput.inputMode = 'numeric';
  ageInput.autocomplete = 'off';

  const hint = document.createElement('p');
  hint.className = 'form-hint';
  hint.textContent =
    'Your journey begins at this age. Your starting age cannot be changed later.';

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'primary-button';
  submit.textContent = 'CREATE MY LIFE';

  const error = document.createElement('p');
  error.className = 'form-error';
  error.setAttribute('role', 'alert');
  error.setAttribute('aria-live', 'polite');

  form.append(label, ageInput, hint, submit, error);

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const age = Number(ageInput.value);

    if (!Number.isInteger(age) || age < 0 || age > 100) {
      error.textContent =
        'Enter a whole number between 0 and 100.';
      ageInput.focus();
      return;
    }

    beginNewLife(age, submit, error);
  });

  container.append(form);
}

// ------------------------------------
// SAVE STATUS
// ------------------------------------

function refreshJourneyStatus() {
  if (!appReady) return;

  try {
    const state = getGameState();
    const character = state.character;

    if (character) {
      if (elements.continueButton) {
        elements.continueButton.disabled = false;
      }

      setSaveStatus(
        `YOUR JOURNEY IS SAVED. CURRENT AGE: ${character.currentAge}.`
      );
    } else {
      if (elements.continueButton) {
        elements.continueButton.disabled = true;
      }

      setSaveStatus('YOUR JOURNEY HAS NOT BEGUN.');
    }
  } catch (error) {
    console.error('[MINDWEAVE] Status error:', error);
    setSaveStatus('JOURNEY STATUS IS UNAVAILABLE.');
  }
}

function persistCurrentState() {
  try {
    const result = saveState();

    if (result.ok) {
      setSaveStatus('JOURNEY SAVED SUCCESSFULLY.');
      return true;
    }

    console.error('[MINDWEAVE] Save failed:', result.reason);
    setSaveStatus('SAVE FAILED. PLEASE TRY AGAIN.');

    return false;
  } catch (error) {
    console.error('[MINDWEAVE] Save error:', error);
    setSaveStatus('SAVE FAILED. PLEASE TRY AGAIN.');

    return false;
  }
}

// ------------------------------------
// CREATE NEW LIFE
// ------------------------------------

function beginNewLife(age, submitButton, errorElement) {
  if (busy) return;

  try {
    const existingCharacter = getGameState().character;

    if (
      existingCharacter &&
      !window.confirm(
        'Starting a new life will replace your current character. Continue?'
      )
    ) {
      return;
    }
  } catch (error) {
    console.error('[MINDWEAVE] Existing save check failed:', error);
  }

  busy = true;

  if (submitButton) submitButton.disabled = true;
  if (errorElement) errorElement.textContent = '';

  try {
    const character = createCharacter(age);

    modifyGameState((draft) => {
      draft.character = character;

      draft.journal = [
        ...draft.journal,
        {
          type: 'life-created',
          timestamp: character.createdAt,
          age: character.startAge
        }
      ];

      return draft;
    });

    const saved = persistCurrentState();

    startGame();
    closeDialog();

    setSystemStatus('JOURNEY ACTIVE');

    if (elements.continueButton) {
      elements.continueButton.disabled = false;
    }

    if (saved) {
      setSaveStatus(
        `YOUR JOURNEY HAS BEGUN. CURRENT AGE: ${character.currentAge}.`
      );
    } else {
      setSaveStatus(
        'LIFE CREATED, BUT SAVE FAILED. CHECK STORAGE.'
      );
    }

    if (isRewardEligible(character)) {
      console.info('[MINDWEAVE] Character meets reward eligibility rules.');
    }

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });

  } catch (error) {
    console.error('[MINDWEAVE] Character creation failed:', error);

    if (errorElement) {
      errorElement.textContent =
        'Something went wrong. Your life was not created. Please try again.';
    }
  } finally {
    busy = false;

    if (submitButton) {
      submitButton.disabled = false;
    }
  }
}

// ------------------------------------
// CONTINUE JOURNEY
// ------------------------------------

function continueJourney() {
  if (!appReady || busy) return;

  try {
    const state = getGameState();

    if (!state.character) {
      refreshJourneyStatus();
      return;
    }

    if (!isGameRunning()) {
      startGame();
    }

    setSystemStatus('JOURNEY ACTIVE');

    setSaveStatus(
      `WELCOME BACK. CURRENT AGE: ${state.character.currentAge}.`
    );

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });

  } catch (error) {
    console.error('[MINDWEAVE] Continue failed:', error);

    setSystemStatus('SYSTEM ERROR');
    setSaveStatus('COULD NOT LOAD YOUR JOURNEY.');
  }
}

// ------------------------------------
// GAME EVENTS
// ------------------------------------

function connectEvents() {
  on('game:initialized', (payload) => {
    setSystemStatus('SYSTEM READY');

    if (payload?.persistent === false) {
      setSaveStatus(
        'TEMPORARY STORAGE ACTIVE. PROGRESS MAY NOT SURVIVE CLOSING THIS TAB.'
      );
    }
  });

  on('game:stateChanged', () => {
    refreshJourneyStatus();
  });

  on('game:started', () => {
    setSystemStatus('JOURNEY ACTIVE');
  });

  on('game:paused', () => {
    setSystemStatus('JOURNEY PAUSED');
  });

  on('game:stopped', (payload) => {
    setSystemStatus('JOURNEY STOPPED');

    if (payload?.save?.ok) {
      setSaveStatus('JOURNEY SAVED.');
    }
  });
}

// ------------------------------------
// USER CONTROLS
// ------------------------------------

function connectControls() {
  elements.newLifeButton?.addEventListener('click', () => {
    if (!appReady || busy) return;

    setText(elements.dialogTitle, 'CREATE YOUR CHARACTER');
    setText(elements.dialogMessage, 'Your story begins with a choice.');

    renderCharacterForm();
    openDialog();
  });

  elements.continueButton?.addEventListener(
    'click',
    continueJourney
  );

  elements.closeDialogButton?.addEventListener(
    'click',
    closeDialog
  );

  elements.dialog?.addEventListener('click', (event) => {
    if (event.target === elements.dialog) {
      closeDialog();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (
      event.key === 'Escape' &&
      elements.dialog?.open
    ) {
      closeDialog();
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (
      document.visibilityState === 'hidden' &&
      appReady
    ) {
      persistCurrentState();
    }
  });
}

// ------------------------------------
// APPLICATION INITIALIZATION
// ------------------------------------

function initializeApp() {
  if (!elements.newLifeButton || !elements.dialog) {
    setSystemStatus('INTERFACE ERROR');
    setSaveStatus('REQUIRED GAME ELEMENTS ARE MISSING.');
    return;
  }

  try {
    connectEvents();

    const result = initializeGame();

    if (!result || result.ok !== true) {
      throw new Error(
        result?.error || 'Game initialization failed.'
      );
    }

    appReady = true;

    connectControls();

    const storage = getStorageStatus();

    if (storage.persistent) {
      setSystemStatus('SYSTEM READY');
    } else {
      setSystemStatus('LIMITED STORAGE');

      setSaveStatus(
        'TEMPORARY STORAGE ACTIVE. PROGRESS MAY NOT SURVIVE CLOSING THIS TAB.'
      );
    }

    refreshJourneyStatus();

    console.info(
      '[MINDWEAVE] Application initialized successfully.'
    );

  } catch (error) {
    console.error(
      '[MINDWEAVE] Initialization failed:',
      error
    );

    setSystemStatus('SYSTEM ERROR');
    setSaveStatus(
      'MINDWEAVE COULD NOT START. PLEASE RELOAD THE PAGE.'
    );

    if (elements.newLifeButton) {
      elements.newLifeButton.disabled = true;
    }

    if (elements.continueButton) {
      elements.continueButton.disabled = true;
    }
  }
}

// ------------------------------------
// START APPLICATION
// ------------------------------------

if (document.readyState === 'loading') {
  document.addEventListener(
    'DOMContentLoaded',
    initializeApp,
    { once: true }
  );
} else {
  initializeApp();
  }
  
