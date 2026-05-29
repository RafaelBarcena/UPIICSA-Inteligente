import test from 'node:test';
import assert from 'node:assert/strict';
import { getAvailableMachines, getInitials, validateManualRegistration } from '../src/services/logic.js';

test('getInitials returns two letters', () => {
  assert.equal(getInitials('García López Alejandro'), 'LA');
  assert.equal(getInitials('Ana'), 'A');
});

test('validateManualRegistration rejects missing fields', () => {
  const result = validateManualRegistration({ boleta: '', name: '', career: '', machine: '' }, [1, 2, 4]);
  assert.equal(result.valid, false);
  assert.ok(result.errors.length >= 3);
});

test('validateManualRegistration accepts available machine', () => {
  const result = validateManualRegistration(
    { boleta: '2024000001', name: 'Test User', career: 'Ing. en Sistemas Computacionales', machine: '2' },
    [1, 2, 4]
  );
  assert.equal(result.valid, true);
  assert.equal(result.machine, 2);
});

test('getAvailableMachines excludes occupied machines', () => {
  const activeRecords = [{ machine: 5 }, { machine: 8 }];
  const available = getAvailableMachines(activeRecords, 10, [3]);
  assert.deepEqual(available, [1, 2, 4, 6, 7, 9, 10]);
});
