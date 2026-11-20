// © Shisir Gayen. All rights reserved.
// Safe save storage: validation, backup, corrupted-save preservation and failure reporting.
// Callers get plain results; they never touch localStorage directly.
import { validateState, defaultState } from './validate.js';

const KEYS = {
  main: 'mindweave.save',
  backup: 'mindweave.save.bak',
  unreadable: 'mindweave.save.unreadable',
  archive: 'mindweave.save.prevlife'
};

let store = null;
let persistent = false;

function memoryStore() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); }
  };
}

// Uses localStorage when it really works; otherwise falls back to memory for this session only.
function detect() {
  try {
    const ls = globalThis.localStorage;
    if (!ls) throw new Error('no localStorage');
    ls.setItem('mindweave.probe', '1');
    ls.removeItem('mindweave.probe');
    return { store: ls, persistent: true };
  } catch {
    return { store: memoryStore(), persistent: false };
  }
}

const isQuota = (e) =>
  !!e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014);

function read(key) {
  try { return store.getItem(key); } catch { return null; }
}
function write(key, value) {
  try { store.setItem(key, value); return { ok: true }; }
  catch (e) { return { ok: false, reason: isQuota(e) ? 'quota' : 'error' }; }
}
function parse(raw) {
  if (typeof raw !== 'string') return { ok: false, reason: 'missing' };
  try { return validateState(JSON.parse(raw)); }
  catch { return { ok: false, reason: 'bad-json' }; }
}

// Loads the save. Returns { state, notice }.
// notice: null | 'repaired' | 'recovered-backup' | 'corrupt-reset' | 'newer-version' | 'no-storage'
export function init(custom) {
  if (custom) { store = custom; persistent = true; }
  else { const d = detect(); store = d.store; persistent = d.persistent; }

  const raw = read(KEYS.main);
  if (raw === null) return { state: defaultState(), notice: persistent ? null : 'no-storage' };

  const main = parse(raw);
  if (main.ok) return { state: main.state, notice: main.repaired ? 'repaired' : null };

  // Unreadable save: keep a copy (never silently destroy it), then try the backup.
  write(KEYS.unreadable, raw);
  const bak = parse(read(KEYS.backup));
  if (bak.ok) return { state: bak.state, notice: 'recovered-backup' };
  return { state: defaultState(), notice: main.reason === 'newer-version' ? 'newer-version' : 'corrupt-reset' };
}

// Saves the state. Returns { ok:true, persistent } or { ok:false, reason:'quota'|'error' }.
export function persist(state) {
  const prev = read(KEYS.main);
  if (prev !== null && parse(prev).ok) write(KEYS.backup, prev); // best effort
  const r = write(KEYS.main, JSON.stringify(state));
  return r.ok ? { ok: true, persistent } : r;
}

export const isPersistent = () => persistent;

// Previous-life slot: keeps the old life when the player starts a new one, so it can be restored.
export const archiveSave = (state) => write(KEYS.archive, JSON.stringify(state));
export function readArchive() {
  const r = parse(read(KEYS.archive));
  return r.ok && r.state.character ? r.state : null;
}
export function clearArchive() {
  try { store.removeItem(KEYS.archive); } catch { /* ignore */ }
}

// Deletes every MINDWEAVE key (used by "delete all saved data").
export function clearAll() {
  for (const k of Object.values(KEYS)) {
    try { store.removeItem(k); } catch { /* ignore */ }
  }
                    }
