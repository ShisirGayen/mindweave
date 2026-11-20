
// © Shisir Gayen. All rights reserved.
// MINDWEAVE - Central Event Management System

const events = new Map();

let eventId = 0;

// Validate event name
function validateEventName(eventName) {
  if (
    typeof eventName !== 'string' ||
    eventName.trim().length === 0
  ) {
    throw new TypeError('Invalid event name');
  }
}

// Register an event listener
export function on(eventName, callback) {
  validateEventName(eventName);

  if (typeof callback !== 'function') {
    throw new TypeError('Callback must be a function');
  }

  if (!events.has(eventName)) {
    events.set(eventName, new Map());
  }

  const id = ++eventId;

  events.get(eventName).set(id, callback);

  // Return unsubscribe function
  return () => off(eventName, id);
}

// Remove an event listener
export function off(eventName, id) {
  validateEventName(eventName);

  const listeners = events.get(eventName);

  if (!listeners) {
    return false;
  }

  const removed = listeners.delete(id);

  if (listeners.size === 0) {
    events.delete(eventName);
  }

  return removed;
}

// Emit an event to all registered listeners
export function emit(eventName, payload = null) {
  validateEventName(eventName);

  const listeners = events.get(eventName);

  if (!listeners || listeners.size === 0) {
    return 0;
  }

  // Snapshot prevents listener changes from affecting this emission
  const callbacks = [...listeners.values()];

  let executed = 0;

  for (const callback of callbacks) {
    try {
      callback(payload);
      executed++;
    } catch (error) {
      console.error(
        `[MINDWEAVE] Event listener error: ${eventName}`,
        error
      );
    }
  }

  return executed;
}

// Register a listener that runs only once
export function once(eventName, callback) {
  validateEventName(eventName);

  if (typeof callback !== 'function') {
    throw new TypeError('Callback must be a function');
  }

  let unsubscribe;

  unsubscribe = on(eventName, (payload) => {
    unsubscribe();
    callback(payload);
  });

  return unsubscribe;
}

// Remove all listeners for an event
// If eventName is omitted, remove all registered events
export function clear(eventName) {
  if (eventName === undefined) {
    events.clear();
    return;
  }

  validateEventName(eventName);

  events.delete(eventName);
}

// Get the number of listeners for an event
export function listenerCount(eventName) {
  validateEventName(eventName);

  return events.get(eventName)?.size ?? 0;
}

// Get all registered event names
export function getEventNames() {
  return [...events.keys()];
      }
