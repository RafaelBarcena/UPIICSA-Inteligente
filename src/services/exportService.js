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
