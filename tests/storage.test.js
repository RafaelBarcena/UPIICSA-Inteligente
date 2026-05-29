import test from 'node:test';
import assert from 'node:assert/strict';

const memoryStorage = () => {
  const data = new Map();
  return {
    getItem: key => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: key => data.delete(key)
  };
};

test('storage roundtrip works', async () => {
  const { saveState, loadState } = await import('../src/services/storageService.js');
  const storage = memoryStorage();
  const original = {
    activeRecords: [{ id: '1', student: { boleta: '1', name: 'A', career: 'B' }, machine: 2, manual: false, entryAt: '2026-01-01T10:00:00.000Z', exitAt: null }],
    historyRecords: [],
    totalToday: 1,
    demoIndex: 2
  };
  saveState(original, storage);
  const loaded = loadState(storage);
  assert.equal(loaded.totalToday, 1);
  assert.equal(loaded.demoIndex, 2);
  assert.equal(loaded.activeRecords[0].machine, 2);
});

test('clearState removes the key', async () => {
  const { clearState, saveState } = await import('../src/services/storageService.js');
  const storage = memoryStorage();
  saveState({ activeRecords: [], historyRecords: [], totalToday: 0, demoIndex: 0 }, storage);
  clearState(storage);
  assert.equal(storage.getItem('upiicsa-inteligente-v1'), null);
});
