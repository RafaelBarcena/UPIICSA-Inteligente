import { PRESET_OCCUPIED, TOTAL_MACHINES } from '../models/constants.js';

export function formatTime(date) {
  return new Intl.DateTimeFormat('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(date);
}

export function formatDateTime(date) {
  return new Intl.DateTimeFormat('es-MX', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

export function formatDateInput(date) {
  return date.toISOString().slice(0, 10);
}

export function getInitials(fullName) {
  return fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map(word => word[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2) || '??';
}

export function computeOccupiedSet(activeRecords, preset = PRESET_OCCUPIED) {
  const occupied = new Set(preset);
  activeRecords.forEach(record => occupied.add(record.machine));
  return occupied;
}

export function getAvailableMachines(activeRecords, totalMachines = TOTAL_MACHINES, preset = PRESET_OCCUPIED) {
  const occupied = computeOccupiedSet(activeRecords, preset);
  return Array.from({ length: totalMachines }, (_, index) => index + 1).filter(machine => !occupied.has(machine));
}

export function validateManualRegistration(payload, availableMachines) {
  const errors = [];
  const boleta = payload.boleta?.trim();
  const name = payload.name?.trim();
  const career = payload.career?.trim();
  const machine = Number.parseInt(payload.machine, 10);

  if (!boleta) errors.push('La boleta es obligatoria.');
  if (!name) errors.push('El nombre completo es obligatorio.');
  if (!career) errors.push('La carrera es obligatoria.');
  if (!Number.isInteger(machine) || machine <= 0) errors.push('Selecciona un número de equipo válido.');
  if (Number.isInteger(machine) && !availableMachines.includes(machine)) errors.push('El equipo seleccionado ya no está disponible.');

  return { valid: errors.length === 0, errors, machine, boleta, name, career };
}

export function createStudentFromManual({ boleta, name, career }) {
  return {
    boleta: boleta.trim(),
    name: name.trim(),
    career: career.trim(),
    initials: getInitials(name)
  };
}

export function createEntryRecord({ student, machine, manual = false, createdAt = new Date() }) {
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    student,
    machine,
    manual,
    entryAt: createdAt.toISOString(),
    exitAt: null
  };
}

export function closeEntryRecord(record, exitDate = new Date()) {
  const entryDate = new Date(record.entryAt);
  const minutes = Math.max(1, Math.round((exitDate.getTime() - entryDate.getTime()) / 60000));
  return {
    ...record,
    exitAt: exitDate.toISOString(),
    durationMinutes: minutes
  };
}

export function countTodayEntries(records, referenceDate = new Date()) {
  const today = formatDateInput(referenceDate);
  return records.filter(record => formatDateInput(new Date(record.entryAt)) === today).length;
}

export function normalizeRecordDates(record) {
  return {
    ...record,
    entryAt: typeof record.entryAt === 'string' ? record.entryAt : new Date(record.entryAt).toISOString(),
    exitAt: record.exitAt ? (typeof record.exitAt === 'string' ? record.exitAt : new Date(record.exitAt).toISOString()) : null
  };
}
