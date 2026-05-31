import { USERS } from '../models/constants.js';

const SESSION_KEY = 'upiicsa-session-v1';

/**
 * Intenta autenticar con usuario y contraseña.
 * Devuelve { ok: true, user } o { ok: false, error }
 */
export function login(username, password) {
  const user = USERS.find(
    u => u.username === username.trim() && u.password === password
  );
  if (!user) {
    return { ok: false, error: 'Usuario o contraseña incorrectos.' };
  }
  const session = { username: user.username, role: user.role, displayName: user.displayName, loginAt: new Date().toISOString() };
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch { /* storage no disponible */ }
  return { ok: true, user: session };
}

/**
 * Cierra la sesión activa.
 */
export function logout() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch { /* noop */ }
}

/**
 * Devuelve la sesión activa o null.
 */
export function getSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Comprueba si hay sesión activa.
 */
export function isAuthenticated() {
  return getSession() !== null;
}

/**
 * Comprueba si la sesión activa tiene un rol determinado.
 * 'admin' puede acceder a todo.
 */
export function hasRole(requiredRole) {
  const session = getSession();
  if (!session) return false;
  if (session.role === 'admin') return true;
  return session.role === requiredRole;
}
