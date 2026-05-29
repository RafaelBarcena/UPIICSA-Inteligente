import { CAREERS, DEMO_STUDENTS, PRESET_OCCUPIED, TOTAL_MACHINES } from '../models/constants.js';
import { $, el, $$ } from '../views/dom.js';
import {
  closeEntryRecord,
  computeOccupiedSet,
  countTodayEntries,
  createEntryRecord,
  createStudentFromManual,
  formatDateInput,
  formatDateTime,
  getAvailableMachines,
  getInitials,
  validateManualRegistration
} from '../services/logic.js';
import { clearState, loadState, saveState } from '../services/storageService.js';
import { recordsToCsv } from '../services/exportService.js';

export function createApp() {
  const state = {
    activeRecords: [],
    historyRecords: [],
    totalToday: 0,
    demoIndex: 0,
    selectedMachine: null,
    currentStudent: null
  };

  let scanTimer = null;
  const refs = {};

  function hydrate() {
    const persisted = loadState();
    state.activeRecords = persisted.activeRecords ?? [];
    state.historyRecords = persisted.historyRecords ?? [];
    state.totalToday = persisted.totalToday ?? 0;
    state.demoIndex = persisted.demoIndex ?? 0;
  }

  function persist() {
    saveState(state);
  }

  function bindRefs() {
    refs.clock = $('#clock');
    refs.scanZone = $('#scanZone');
    refs.scanBtn = $('#scanBtn');
    refs.studentCard = $('#studentCard');
    refs.machineCard = $('#machineCard');
    refs.studentInitials = $('#studentInitials');
    refs.studentName = $('#studentName');
    refs.studentMeta = $('#studentMeta');
    refs.studentCarrera = $('#studentCarrera');
    refs.machinesGrid = $('#machinesGrid');
    refs.confirmBtn = $('#confirmBtn');
    refs.activeList = $('#activeList');
    refs.historyTable = $('#historyTable');
    refs.alertAlumno = $('#alert-alumno');
    refs.manualBoleta = $('#manualBoleta');
    refs.manualNombre = $('#manualNombre');
    refs.manualCarrera = $('#manualCarrera');
    refs.manualEquipo = $('#manualEquipo');
    refs.statOcup = $('#statOcup');
    refs.statLib = $('#statLib');
    refs.statTotal = $('#statTotal');
    refs.statIncomp = $('#statIncomp');
    refs.filtroDesde = $('#filtroDesde');
    refs.filtroHasta = $('#filtroHasta');
    refs.filtroCarrera = $('#filtroCarrera');
  }

  function showAlert(message, type = 'success') {
    refs.alertAlumno.className = `alert show ${type}`;
    refs.alertAlumno.textContent = message;
    window.clearTimeout(refs.alertTimeout);
    refs.alertTimeout = window.setTimeout(() => refs.alertAlumno.classList.remove('show'), 4000);
  }

  function renderClock() {
    refs.clock.textContent = new Date().toLocaleTimeString('es-MX');
  }

  function renderStudentCard(student) {
    refs.studentInitials.textContent = student.initials || getInitials(student.name);
    refs.studentName.textContent = student.name;
    refs.studentMeta.textContent = `Boleta: ${student.boleta}`;
    refs.studentCarrera.textContent = student.career;
    refs.studentCard.classList.add('show');
    refs.machineCard.style.display = 'block';
  }

  function renderMachines() {
    const occupied = computeOccupiedSet(state.activeRecords, PRESET_OCCUPIED);
    const available = getAvailableMachines(state.activeRecords);
    const fragment = document.createDocumentFragment();

    refs.machinesGrid.innerHTML = '';
    for (let machine = 1; machine <= TOTAL_MACHINES; machine += 1) {
      const isOccupied = occupied.has(machine);
      const button = el('button', {
        type: 'button',
        className: `machine ${isOccupied ? 'occupied' : 'available'}${state.selectedMachine === machine ? ' selected' : ''}`
      });
      button.innerHTML = `
        <div class="machine-num">${String(machine).padStart(2, '0')}</div>
        <div class="machine-status">${isOccupied ? 'Ocupado' : 'Libre'}</div>
      `;
      if (!isOccupied) {
        button.addEventListener('click', () => {
          state.selectedMachine = machine;
          refs.confirmBtn.disabled = false;
          renderMachines();
        });
      }
      fragment.appendChild(button);
    }
    refs.machinesGrid.appendChild(fragment);

    refs.manualEquipo.innerHTML = ['<option value="">-- Seleccionar --</option>']
      .concat(available.map(machine => `<option value="${machine}">Equipo ${String(machine).padStart(2, '0')}</option>`))
      .join('');
  }

  function renderActiveList() {
    if (state.activeRecords.length === 0) {
      refs.activeList.innerHTML = '<div style="text-align:center;color:#7a9cc0;font-size:13px;padding:20px">No hay alumnos registrados actualmente.</div>';
      return;
    }

    refs.activeList.innerHTML = '';
    state.activeRecords.forEach((record, index) => {
      const elapsedMinutes = Math.max(1, Math.round((Date.now() - new Date(record.entryAt).getTime()) / 60000));
      const row = el('div', { className: 'active-row' });
      row.innerHTML = `
        <div class="num">${String(record.machine).padStart(2, '0')}</div>
        <div class="info">
          <div class="name">${record.student.name}${record.manual ? ' <span style="background:#2d1a00;color:#ffa726;font-size:10px;padding:1px 6px;border-radius:10px;border:1px solid #5c3400">manual</span>' : ''}</div>
          <div class="meta">${record.student.boleta} · ${record.student.career} · Entrada: ${formatDateTime(new Date(record.entryAt))}</div>
        </div>
        <div class="time">${elapsedMinutes}min</div>
      `;
      const exitBtn = el('button', {
        className: 'exit-btn',
        text: 'Registrar salida',
        onClick: () => registerExit(index)
      });
      row.appendChild(exitBtn);
      refs.activeList.appendChild(row);
    });
  }

  function renderStats() {
    const occupied = computeOccupiedSet(state.activeRecords, PRESET_OCCUPIED);
    refs.statOcup.textContent = String(occupied.size);
    refs.statLib.textContent = String(TOTAL_MACHINES - occupied.size);
    refs.statTotal.textContent = String(countTodayEntries(state.historyRecords, new Date()) + state.activeRecords.length);
    refs.statIncomp.textContent = String(state.activeRecords.length);
  }

  function renderHistory() {
    const from = refs.filtroDesde.value ? new Date(refs.filtroDesde.value + 'T00:00:00') : null;
    const to = refs.filtroHasta.value ? new Date(refs.filtroHasta.value + 'T23:59:59') : null;
    const career = refs.filtroCarrera.value;

    const filtered = state.historyRecords.filter(record => {
      const entry = new Date(record.entryAt);
      if (from && entry < from) return false;
      if (to && entry > to) return false;
      if (career && record.student.career !== career) return false;
      return true;
    });

    if (filtered.length === 0) {
      refs.historyTable.innerHTML = '<div style="padding:16px;color:#7a9cc0">No hay coincidencias para los filtros seleccionados.</div>';
      return;
    }

    refs.historyTable.innerHTML = '';
    const table = el('table', { style: 'width:100%;border-collapse:collapse;font-size:12px' });
    table.innerHTML = `
      <thead><tr>
        ${['Boleta', 'Alumno', 'Carrera', 'Entrada', 'Salida', 'Equipo', 'Duración', 'Estado'].map(col => `<th style="padding:8px 10px;background:#080f1a;color:#7a9cc0;text-align:left;border-bottom:1px solid #1a3a5c;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">${col}</th>`).join('')}
      </tr></thead>
      <tbody>
        ${filtered.map((record, index) => `
          <tr style="background:${index % 2 === 0 ? '#0f1e30' : '#080f1a'}">
            <td style="padding:8px 10px;border-bottom:1px solid #1a3a5c;color:#e8edf2">${record.student.boleta}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #1a3a5c;color:#e8edf2">${record.student.name}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #1a3a5c;color:#e8edf2">${record.student.career}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #1a3a5c;color:#e8edf2">${formatDateTime(new Date(record.entryAt))}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #1a3a5c;color:${record.exitAt ? '#e8edf2' : '#f44336'}">${record.exitAt ? formatDateTime(new Date(record.exitAt)) : '—'}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #1a3a5c;color:#e8edf2">Equipo ${String(record.machine).padStart(2, '0')}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #1a3a5c;color:${record.durationMinutes ? '#4caf50' : '#4da6ff'}">${record.durationMinutes ? `${record.durationMinutes} min` : 'Activo'}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #1a3a5c;color:#e8edf2">${record.manual ? 'Manual' : 'QR/Barcode'}</td>
          </tr>
        `).join('')}
      </tbody>
    `;
    refs.historyTable.appendChild(table);
  }

  function resetScanUi() {
    refs.scanBtn.textContent = '▶ Simular escaneo';
    refs.scanBtn.disabled = false;
    refs.scanZone.classList.remove('scanning');
  }

  function simulateScan() {
    if (scanTimer) return;
    refs.scanZone.classList.add('scanning');
    refs.scanBtn.textContent = 'Leyendo...';
    refs.scanBtn.disabled = true;

    scanTimer = window.setTimeout(() => {
      const student = DEMO_STUDENTS[state.demoIndex % DEMO_STUDENTS.length];
      state.demoIndex += 1;
      state.currentStudent = student;
      state.selectedMachine = null;
      renderStudentCard(student);
      renderMachines();
      refs.confirmBtn.disabled = true;
      showAlert(`Credencial leída: ${student.name}`);
      resetScanUi();
      scanTimer = null;
      persist();
    }, 1200);
  }

  function registerEntry() {
    if (!state.currentStudent || !state.selectedMachine) {
      showAlert('Selecciona un equipo antes de confirmar.', 'error');
      return;
    }

    state.activeRecords.push(createEntryRecord({
      student: state.currentStudent,
      machine: state.selectedMachine,
      manual: false,
      createdAt: new Date()
    }));
    state.totalToday += 1;
    state.currentStudent = null;
    state.selectedMachine = null;
    refs.studentCard.classList.remove('show');
    refs.machineCard.style.display = 'none';
    refs.confirmBtn.disabled = true;
    renderMachines();
    renderStats();
    renderActiveList();
    persist();
    showAlert('Registro confirmado correctamente.');
  }

  function registerManual() {
    const validation = validateManualRegistration(
      {
        boleta: refs.manualBoleta.value,
        name: refs.manualNombre.value,
        career: refs.manualCarrera.value,
        machine: refs.manualEquipo.value
      },
      getAvailableMachines(state.activeRecords)
    );

    if (!validation.valid) {
      showAlert(validation.errors[0], 'error');
      return;
    }

    const student = createStudentFromManual(validation);
    state.activeRecords.push(createEntryRecord({
      student,
      machine: validation.machine,
      manual: true,
      createdAt: new Date()
    }));
    state.totalToday += 1;

    refs.manualBoleta.value = '';
    refs.manualNombre.value = '';
    refs.manualCarrera.value = '';
    refs.manualEquipo.value = '';

    renderMachines();
    renderStats();
    renderActiveList();
    persist();
    showAlert('Registro manual guardado.');
  }

  function registerExit(index) {
    const current = state.activeRecords[index];
    if (!current) return;

    state.historyRecords.unshift(closeEntryRecord(current, new Date()));
    state.activeRecords.splice(index, 1);
    renderMachines();
    renderStats();
    renderActiveList();
    renderHistory();
    persist();
    showAlert(`Salida registrada para ${current.student.name}.`);
  }

  function exportCsv() {
    const csv = recordsToCsv(state.historyRecords);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'historial_upiicsa_inteligente.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  function clearDemoData() {
    if (!window.confirm('¿Eliminar todos los datos guardados del prototipo?')) return;
    state.activeRecords = [];
    state.historyRecords = [];
    state.totalToday = 0;
    state.demoIndex = 0;
    state.currentStudent = null;
    state.selectedMachine = null;
    refs.studentCard.classList.remove('show');
    refs.machineCard.style.display = 'none';
    refs.confirmBtn.disabled = true;
    clearState();
    renderMachines();
    renderStats();
    renderActiveList();
    renderHistory();
    showAlert('Datos reiniciados.');
  }

  function showTab(name) {
    ['alumno', 'admin', 'reportes'].forEach(tab => {
      document.getElementById(`tab-${tab}`).style.display = tab === name ? 'block' : 'none';
    });
    $$('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelector(`.tab[data-tab="${name}"]`).classList.add('active');
    if (name === 'admin') {
      renderStats();
      renderActiveList();
    }
    if (name === 'reportes') renderHistory();
  }

  function wireEvents() {
    refs.scanZone.addEventListener('click', simulateScan);
    refs.scanBtn.addEventListener('click', event => {
      event.stopPropagation();
      simulateScan();
    });
    refs.confirmBtn.addEventListener('click', registerEntry);
    $('#manualRegister').addEventListener('click', registerManual);
    $('#btnFilter').addEventListener('click', renderHistory);
    $('#btnExportCsv').addEventListener('click', exportCsv);
    $('#btnReset').addEventListener('click', clearDemoData);
    $$('.tab').forEach(tab => {
      tab.addEventListener('click', () => showTab(tab.dataset.tab));
    });
  }

  function init() {
    hydrate();
    bindRefs();
    wireEvents();
    renderClock();
    setInterval(renderClock, 1000);

    const today = formatDateInput(new Date());
    refs.filtroDesde.value = today;
    refs.filtroHasta.value = today;
    refs.manualCarrera.innerHTML = ['<option value="">-- Seleccionar --</option>']
      .concat(CAREERS.map(career => `<option>${career}</option>`))
      .join('');
    refs.filtroCarrera.innerHTML = ['<option value="">Todas</option>']
      .concat(CAREERS.map(career => `<option>${career}</option>`))
      .join('');

    renderMachines();
    renderStats();
    renderActiveList();
    renderHistory();
    showTab('alumno');
  }

  return { init };
}
