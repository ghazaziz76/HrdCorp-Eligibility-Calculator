// Pure CRUD over localStorage['hrd_saved_plans'].
// Plan record: { id, name, schemeId, schemeLabel, inputs, resultSnapshot, savedAt, updatedAt }
export const STORAGE_KEY = 'hrd_saved_plans';

const LS_BUDGET_BYTES = 5 * 1024 * 1024; // ~5 MB typical localStorage budget

const read = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
};
const write = (arr) => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(arr)); } catch {} };
const now = () => new Date().toISOString();
const newId = () => Date.now().toString() + Math.floor(Math.random() * 1000);

export function loadPlans() { return read(); }

export function savePlan(plan) {
  const ts = now();
  const full = { ...plan, id: newId(), savedAt: ts, updatedAt: ts };
  write([full, ...read()]);
  return full;
}

export function updatePlan(id, patch) {
  const arr = read();
  const i = arr.findIndex(p => p.id === id);
  if (i < 0) return null;
  arr[i] = { ...arr[i], ...patch, updatedAt: now() };
  write(arr);
  return arr[i];
}

export function renamePlan(id, name) { return updatePlan(id, { name }); }

export function duplicatePlan(id) {
  const arr = read();
  const src = arr.find(p => p.id === id);
  if (!src) return null;
  const ts = now();
  const copy = { ...src, id: newId(), name: `${src.name} (copy)`, savedAt: ts, updatedAt: ts };
  write([copy, ...arr]);
  return copy;
}

export function deletePlan(id) {
  write(read().filter(p => p.id !== id));
}

export function storageUsageRatio() {
  const used = (localStorage.getItem(STORAGE_KEY) || '').length;
  return Math.min(1, used / LS_BUDGET_BYTES);
}
