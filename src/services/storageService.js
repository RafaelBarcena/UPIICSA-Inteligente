import { STORAGE_KEY } from '../models/constants.js';
import { normalizeRecordDates } from './logic.js';

export function loadState(storage = window.localStorage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) {
      return { activeRecords: [], historyRecords: [], totalToday: 0, demoIndex: 0 };
    }
    const parsed = JSON.parse(raw);
    return {
      activeRecords: Array.isArray(parsed.activeRecords) ? parsed.activeRecords.map(normalizeRecordDates) : [],
      historyRecords: Array.isArray(parsed.historyRecords) ? parsed.historyRecords.map(normalizeRecordDates) : [],
      totalToday: Number.isFinite(parsed.totalToday) ? parsed.totalToday : 0,
      demoIndex: Number.isFinite(parsed.demoIndex) ? parsed.demoIndex : 0
    };
  } catch {
    return { activeRecords: [], historyRecords: [], totalToday: 0, demoIndex: 0 };
  }
}

export function saveState(state, storage = window.localStorage) {
  storage.setItem(STORAGE_KEY, JSON.stringify({
    activeRecords: state.activeRecords,
    historyRecords: state.historyRecords,
    totalToday: state.totalToday,
    demoIndex: state.demoIndex
  }));
}

export function clearState(storage = window.localStorage) {
  storage.removeItem(STORAGE_KEY);
}
