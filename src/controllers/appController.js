import { CAREERS, DEMO_STUDENTS, PRESET_OCCUPIED, TOTAL_MACHINES, WARN_MINUTES } from '../models/constants.js';
import { $, el, $$ } from '../views/dom.js';
import {
  closeEntryRecord,
  computeOccupiedSet,
  computeRemainingSeconds,
  countTodayEntries,
  createEntryRecord,
  createStudentFromManual,
  formatCountdown,
  formatDateInput,
  formatDateTime,
  getAvailableMachines,
  getInitials,
  timerClass,
  validateManualRegistration
} from '../services/logic.js';
import { clearState, loadState, saveState } from '../services/storageService.js';
import { recordsToCsv, recordsToXlsx } from '../services/exportService.js';
import { login, logout, getSession, isAuthenticated } from '../services/authService.js';

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
  let tickInterval = null; // intervalo global de 1 segundo para temporizadores
  const refs = {};
  // Conjunto de IDs de registros que ya recibieron el aviso de 10 min
  const notified10 = new Set();
  const notifiedExpired = new Set();

  // ──────────────────────────────────────────────────────────────
  // PERSISTENCIA
  // ──────────────────────────────────────────────────────────────
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

  // ──────────────────────────────────────────────────────────────
  // REFS DOM
  // ──────────────────────────────────────────────────────────────
  function bindRefs() {
    refs.clock           = $('#clock');
    refs.scanZone        = $('#scanZone');
    refs.scanBtn         = $('#scanBtn');
    refs.studentCard     = $('#studentCard');
    refs.machineCard     = $('#machineCard');
    refs.studentInitials = $('#studentInitials');
    refs.studentName     = $('#studentName');
    refs.studentMeta     = $('#studentMeta');
    refs.studentCarrera  = $('#studentCarrera');
    refs.machinesGrid    = $('#machinesGrid');
    refs.confirmBtn      = $('#confirmBtn');
    refs.activeList      = $('#activeList');
    refs.historyTable    = $('#historyTable');
    refs.alertAlumno     = $('#alert-alumno');
    refs.manualBoleta    = $('#manualBoleta');
    refs.manualNombre    = $('#manualNombre');
    refs.manualCarrera   = $('#manualCarrera');
    refs.manualEquipo    = $('#manualEquipo');
    refs.statOcup        = $('#statOcup');
    refs.statLib         = $('#statLib');
    refs.statTotal       = $('#statTotal');
    refs.statIncomp      = $('#statIncomp');
    refs.filtroDesde     = $('#filtroDesde');
    refs.filtroHasta     = $('#filtroHasta');
    refs.filtroCarrera   = $('#filtroCarrera');
    // Auth
    refs.loginOverlay    = $('#loginOverlay');
    refs.loginUsername   = $('#loginUsername');
    refs.loginPassword   = $('#loginPassword');
    refs.loginBtn        = $('#loginBtn');
    refs.loginError      = $('#loginError');
    refs.sessionBar      = $('#sessionBar');
    refs.sessionName     = $('#sessionName');
    refs.logoutBtn       = $('#logoutBtn');
    refs.digitalClock    = $('#digitalClock');
  }

  // ──────────────────────────────────────────────────────────────
  // ALERTAS
  // ──────────────────────────────────────────────────────────────
  function showAlert(message, type = 'success') {
    refs.alertAlumno.className = `alert show ${type}`;
    refs.alertAlumno.textContent = message;
    window.clearTimeout(refs.alertTimeout);
    refs.alertTimeout = window.setTimeout(() => refs.alertAlumno.classList.remove('show'), 5000);
  }

  // ──────────────────────────────────────────────────────────────
  // AUTENTICACIÓN
  // ──────────────────────────────────────────────────────────────
  function showLoginOverlay() {
    refs.loginOverlay.classList.add('visible');
    refs.loginUsername.value = '';
    refs.loginPassword.value = '';
    refs.loginError.textContent = '';
    refs.loginUsername.focus();
  }

  function hideLoginOverlay() {
    refs.loginOverlay.classList.remove('visible');
  }

  function updateSessionBar() {
    const session = getSession();
    if (session) {
      refs.sessionBar.classList.add('visible');
      refs.sessionName.textContent = `${session.displayName} (${session.role})`;
    } else {
      refs.sessionBar.classList.remove('visible');
    }
  }

  function handleLogin() {
    const username = refs.loginUsername.value.trim();
    const password = refs.loginPassword.value;
    const result = login(username, password);
    if (result.ok) {
      hideLoginOverlay();
      updateSessionBar();
      // Redirigir al tab que originó el login
      showTab(refs._pendingTab || 'admin');
      refs._pendingTab = null;
    } else {
      refs.loginError.textContent = result.error;
      refs.loginPassword.value = '';
      refs.loginPassword.focus();
    }
  }

  function handleLogout() {
    logout();
    updateSessionBar();
    showTab('alumno');
  }

  // ──────────────────────────────────────────────────────────────
  // RELOJ DIGITAL
  // ──────────────────────────────────────────────────────────────
  function renderClocks() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateStr = now.toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    refs.clock.textContent = timeStr;
    if (refs.digitalClock) {
      refs.digitalClock.querySelector('.dclock-time').textContent = timeStr;
      refs.digitalClock.querySelector('.dclock-date').textContent = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
    }
  }

  // ──────────────────────────────────────────────────────────────
  // MÁQUINAS
  // ──────────────────────────────────────────────────────────────
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
      .concat(available.map(m => `<option value="${m}">Equipo ${String(m).padStart(2, '0')}</option>`))
      .join('');
  }

  // ──────────────────────────────────────────────────────────────
  // LISTA ACTIVA CON TEMPORIZADORES
  // ──────────────────────────────────────────────────────────────
  function renderActiveList() {
    if (state.activeRecords.length === 0) {
      refs.activeList.innerHTML = '<div style="text-align:center;color:#7a9cc0;font-size:13px;padding:20px">No hay alumnos registrados actualmente.</div>';
      return;
    }

    refs.activeList.innerHTML = '';
    state.activeRecords.forEach((record, index) => {
      const remaining  = computeRemainingSeconds(record.entryAt);
      const countdown  = formatCountdown(remaining);
      const tClass     = timerClass(remaining);
      const manualBadge = record.manual
        ? ' <span style="background:#2d1a00;color:#ffa726;font-size:10px;padding:1px 6px;border-radius:10px;border:1px solid #5c3400">manual</span>'
        : '';

      const row = el('div', { className: 'active-row' });
      row.innerHTML = `
        <div class="num">${String(record.machine).padStart(2, '0')}</div>
        <div class="info">
          <div class="name">${record.student.name}${manualBadge}</div>
          <div class="meta">${record.student.boleta} · ${record.student.career} · Entrada: ${formatDateTime(new Date(record.entryAt))}</div>
        </div>
        <div class="timer ${tClass}" title="Tiempo restante de sesión">
          <div class="timer-label">Tiempo restante</div>
          <div class="timer-digits">${countdown}</div>
        </div>
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

  // ──────────────────────────────────────────────────────────────
  // TICK DE 1 SEGUNDO — temporizadores + avisos
  // ──────────────────────────────────────────────────────────────
  function tick() {
    // Actualizar relojes
    renderClocks();

    // Si el panel admin está visible, actualizar temporizadores
    const adminTab = document.getElementById('tab-admin');
    if (adminTab && adminTab.style.display !== 'none') {
      renderActiveList();
    }

    // Revisar avisos de tiempo
    state.activeRecords.forEach(record => {
      const remaining = computeRemainingSeconds(record.entryAt);
      const warnSeconds = WARN_MINUTES * 60;

      // Aviso a 10 minutos (una sola vez por registro)
      if (remaining <= warnSeconds && remaining > 0 && !notified10.has(record.id)) {
        notified10.add(record.id);
        showAlert(
          `⚠️ ${record.student.name} — Equipo ${String(record.machine).padStart(2, '0')}: quedan ${WARN_MINUTES} minutos de sesión.`,
          'warning'
        );
      }

      // Aviso de tiempo agotado (una sola vez por registro)
      if (remaining <= 0 && !notifiedExpired.has(record.id)) {
        notifiedExpired.add(record.id);
        showAlert(
          `🔴 ${record.student.name} — Equipo ${String(record.machine).padStart(2, '0')}: tiempo de sesión agotado.`,
          'error'
        );
      }
    });
  }

  // ──────────────────────────────────────────────────────────────
  // ESTADÍSTICAS
  // ──────────────────────────────────────────────────────────────
  function renderStats() {
    const occupied = computeOccupiedSet(state.activeRecords, PRESET_OCCUPIED);
    refs.statOcup.textContent   = String(occupied.size);
    refs.statLib.textContent    = String(TOTAL_MACHINES - occupied.size);
    refs.statTotal.textContent  = String(countTodayEntries(state.historyRecords, new Date()) + state.activeRecords.length);
    refs.statIncomp.textContent = String(state.activeRecords.length);
  }

  // ──────────────────────────────────────────────────────────────
  // HISTORIAL
  // ──────────────────────────────────────────────────────────────
  function renderHistory() {
    const from   = refs.filtroDesde.value ? new Date(refs.filtroDesde.value + 'T00:00:00') : null;
    const to     = refs.filtroHasta.value ? new Date(refs.filtroHasta.value + 'T23:59:59') : null;
    const career = refs.filtroCarrera.value;

    const filtered = state.historyRecords.filter(record => {
      const entry = new Date(record.entryAt);
      if (from && entry < from) return false;
      if (to && entry > to)     return false;
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
        ${['Boleta','Alumno','Carrera','Entrada','Salida','Equipo','Duración','Estado'].map(col =>
          `<th style="padding:8px 10px;background:#080f1a;color:#7a9cc0;text-align:left;border-bottom:1px solid #1a3a5c;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">${col}</th>`
        ).join('')}
      </tr></thead>
      <tbody>
        ${filtered.map((record, i) => `
          <tr style="background:${i % 2 === 0 ? '#0f1e30' : '#080f1a'}">
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

  // ──────────────────────────────────────────────────────────────
  // SCAN
  // ──────────────────────────────────────────────────────────────
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

  // ──────────────────────────────────────────────────────────────
  // REGISTROS
  // ──────────────────────────────────────────────────────────────
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
        name:   refs.manualNombre.value,
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
    refs.manualBoleta.value  = '';
    refs.manualNombre.value  = '';
    refs.manualCarrera.value = '';
    refs.manualEquipo.value  = '';
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
    // Limpiar flags de notificación del registro que salió
    notified10.delete(current.id);
    notifiedExpired.delete(current.id);
    renderMachines();
    renderStats();
    renderActiveList();
    renderHistory();
    persist();
    showAlert(`Salida registrada para ${current.student.name}.`);
  }

  // ──────────────────────────────────────────────────────────────
  // EXPORTACIÓN
  // ──────────────────────────────────────────────────────────────
  function exportCsv() {
    const csv  = recordsToCsv(state.historyRecords);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'historial_upiicsa_inteligente.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  function exportXlsx() {
    try {
      recordsToXlsx(state.historyRecords);
    } catch (err) {
      showAlert(`Error al exportar Excel: ${err.message}`, 'error');
    }
  }

  // ──────────────────────────────────────────────────────────────
  // RESET
  // ──────────────────────────────────────────────────────────────
  function clearDemoData() {
    if (!window.confirm('¿Eliminar todos los datos guardados del prototipo?')) return;
    state.activeRecords    = [];
    state.historyRecords   = [];
    state.totalToday       = 0;
    state.demoIndex        = 0;
    state.currentStudent   = null;
    state.selectedMachine  = null;
    notified10.clear();
    notifiedExpired.clear();
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

  // ──────────────────────────────────────────────────────────────
  // NAVEGACIÓN DE TABS
  // ──────────────────────────────────────────────────────────────
  function showTab(name) {
    // Tabs protegidos requieren autenticación
    const protectedTabs = ['admin', 'reportes'];
    if (protectedTabs.includes(name) && !isAuthenticated()) {
      refs._pendingTab = name;
      showLoginOverlay();
      return;
    }

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

  // ──────────────────────────────────────────────────────────────
  // EVENTOS
  // ──────────────────────────────────────────────────────────────
  function wireEvents() {
    // Scan
    refs.scanZone.addEventListener('click', simulateScan);
    refs.scanBtn.addEventListener('click', event => {
      event.stopPropagation();
      simulateScan();
    });
    refs.confirmBtn.addEventListener('click', registerEntry);

    // Admin
    $('#manualRegister').addEventListener('click', registerManual);

    // Reportes
    $('#btnFilter').addEventListener('click', renderHistory);
    $('#btnExportCsv').addEventListener('click', exportCsv);
    $('#btnExportXlsx').addEventListener('click', exportXlsx);
    $('#btnReset').addEventListener('click', clearDemoData);

    // Tabs
    $$('.tab').forEach(tab => {
      tab.addEventListener('click', () => showTab(tab.dataset.tab));
    });

    // Auth
    refs.loginBtn.addEventListener('click', handleLogin);
    refs.logoutBtn.addEventListener('click', handleLogout);
    refs.loginPassword.addEventListener('keydown', e => {
      if (e.key === 'Enter') handleLogin();
    });
    refs.loginUsername.addEventListener('keydown', e => {
      if (e.key === 'Enter') refs.loginPassword.focus();
    });
  }

  // ──────────────────────────────────────────────────────────────
  // INIT
  // ──────────────────────────────────────────────────────────────
  function init() {
    hydrate();
    bindRefs();
    wireEvents();
    updateSessionBar();

    // Rellenar selects de carrera
    const careerOptions = ['<option value="">-- Seleccionar --</option>']
      .concat(CAREERS.map(c => `<option>${c}</option>`))
      .join('');
    refs.manualCarrera.innerHTML = careerOptions;
    refs.filtroCarrera.innerHTML = ['<option value="">Todas</option>']
      .concat(CAREERS.map(c => `<option>${c}</option>`))
      .join('');

    // Fechas por defecto en filtro
    const today = formatDateInput(new Date());
    refs.filtroDesde.value = today;
    refs.filtroHasta.value = today;

    // Renderizado inicial
    renderMachines();
    renderStats();
    renderActiveList();
    renderHistory();
    renderClocks();

    // Intervalo único de 1 segundo — relojes + temporizadores + avisos
    tickInterval = setInterval(tick, 1000);

    showTab('alumno');
  }

  return { init };
}
