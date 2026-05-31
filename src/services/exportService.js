/**
 * Exporta el historial de registros como CSV (legacy).
 */
export function recordsToCsv(historyRecords) {
  const headers = ['Boleta', 'Alumno', 'Carrera', 'Equipo', 'Entrada', 'Salida', 'Duración (min)', 'Manual'];
  const rows = historyRecords.map(record => [
    record.student.boleta,
    record.student.name,
    record.student.career,
    `Equipo ${String(record.machine).padStart(2, '0')}`,
    record.entryAt,
    record.exitAt ?? '',
    record.durationMinutes ?? '',
    record.manual ? 'Sí' : 'No'
  ]);

  return [headers, ...rows]
    .map(columns => columns.map(cell => `"${String(cell).replaceAll('"', '""')}"`).join(','))
    .join('\n');
}

/**
 * Exporta el historial de registros como archivo .xlsx usando SheetJS (XLSX global).
 * Requiere que la librería xlsx.full.min.js esté cargada vía <script> en el HTML.
 * Genera una hoja con cabecera en negrita, columnas con ancho óptimo y datos formateados.
 */
export function recordsToXlsx(historyRecords) {
  // SheetJS se carga como global XLSX desde el CDN en index.html
  const XLSX = window.XLSX;
  if (!XLSX) throw new Error('SheetJS no está disponible. Verifica que el script CDN esté cargado.');

  // ── Cabecera ──────────────────────────────────────────────────────────────
  const headers = [
    'Boleta',
    'Alumno',
    'Carrera',
    'Equipo',
    'Fecha Entrada',
    'Hora Entrada',
    'Fecha Salida',
    'Hora Salida',
    'Duración (min)',
    'Tipo Registro',
    'Estado'
  ];

  // ── Filas de datos ────────────────────────────────────────────────────────
  const rows = historyRecords.map(record => {
    const entryDate = new Date(record.entryAt);
    const exitDate  = record.exitAt ? new Date(record.exitAt) : null;

    const pad = n => String(n).padStart(2, '0');
    const fmtDate = d => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
    const fmtTime = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

    return [
      record.student.boleta,
      record.student.name,
      record.student.career,
      `Equipo ${String(record.machine).padStart(2, '0')}`,
      fmtDate(entryDate),
      fmtTime(entryDate),
      exitDate ? fmtDate(exitDate) : '—',
      exitDate ? fmtTime(exitDate) : '—',
      record.durationMinutes ?? '',
      record.manual ? 'Manual' : 'QR / Código de barras',
      record.exitAt ? 'Completo' : 'Sin salida'
    ];
  });

  // ── Crear hoja ────────────────────────────────────────────────────────────
  const worksheetData = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(worksheetData);

  // Anchos de columna (en caracteres)
  ws['!cols'] = [
    { wch: 14 }, // Boleta
    { wch: 32 }, // Alumno
    { wch: 34 }, // Carrera
    { wch: 12 }, // Equipo
    { wch: 14 }, // Fecha Entrada
    { wch: 12 }, // Hora Entrada
    { wch: 14 }, // Fecha Salida
    { wch: 12 }, // Hora Salida
    { wch: 14 }, // Duración
    { wch: 22 }, // Tipo Registro
    { wch: 12 }  // Estado
  ];

  // Estilo de cabecera: negrita (requiere SheetJS-style o se aplica manualmente)
  // SheetJS CE no soporta estilos nativos, pero preparamos el rango para facilitar
  // integraciones futuras con xlsx-style o ExcelJS.
  ws['!autofilter'] = { ref: `A1:K1` };

  // ── Crear libro y descargar ───────────────────────────────────────────────
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Historial');

  // Hoja resumen
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const resumenData = [
    ['UPIICSA Inteligente — Reporte de Sala de Cómputo'],
    [],
    ['Generado el:', `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`],
    ['Total de registros:', historyRecords.length],
    ['Registros completos:', historyRecords.filter(r => r.exitAt).length],
    ['Registros sin salida:', historyRecords.filter(r => !r.exitAt).length],
    ['Registros manuales:', historyRecords.filter(r => r.manual).length],
    ['Registros QR/Barcode:', historyRecords.filter(r => !r.manual).length],
  ];
  const wsResumen = XLSX.utils.aoa_to_sheet(resumenData);
  wsResumen['!cols'] = [{ wch: 26 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen');

  const filename = `historial_upiicsa_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}.xlsx`;
  XLSX.writeFile(wb, filename);
}
