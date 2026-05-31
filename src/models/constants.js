export const STORAGE_KEY = 'upiicsa-inteligente-v1';

export const TOTAL_MACHINES = 20;

export const PRESET_OCCUPIED = [3, 7, 11, 15, 18];

export const SESSION_LIMIT_MINUTES = 60;
export const WARN_MINUTES = 10;

// Usuarios del sistema — en producción esto viviría en un backend seguro
export const USERS = [
  { username: 'encargado', password: 'upiicsa2026', role: 'admin', displayName: 'Encargado General' },
  { username: 'admin',     password: 'admin123',    role: 'admin', displayName: 'Administrador' },
  { username: 'reporte',   password: 'reporte123',  role: 'reportes', displayName: 'Visualizador' }
];

export const CAREERS = [
  'Lic. en Ciencias de la Informática',
  'Ing. en Informatica',
  'Lic. en Administración Industrial',
  'Ing. en Transporte',
  'Ing. Ferroviaria',
  'Ing. Industrial'
];

export const DEMO_STUDENTS = [
  { boleta: '2022650001', name: 'García López Alejandro',      career: 'Lic. en Ciencias de la Informática', initials: 'AG' },
  { boleta: '2023120045', name: 'Martínez Ruiz Valentina',     career: 'Ing. en Informatica',               initials: 'VM' },
  { boleta: '2024310012', name: 'Torres Sánchez Miguel Ángel', career: 'Lic. en Administración Industrial', initials: 'TM' },
  { boleta: '2021980033', name: 'Hernández Flores Daniela',    career: 'Ing. Industrial',                   initials: 'HD' }
];
