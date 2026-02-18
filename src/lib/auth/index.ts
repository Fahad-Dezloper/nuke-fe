// Auth module public API
export { AuthProvider } from './provider';
export { useAuth } from './use-auth';
export {
  authStateAtom,
  isAuthenticatedAtom,
  isAuthenticatingAtom,
  authErrorAtom,
  loginAtom,
  logoutAuthAtom,
  hydrateAuthAtom,
} from './store';
export {
  login,
  getToken,
  getJWT,
  setToken,
  clearAuth,
  isAuthenticated,
  isTokenValid,
} from './auth.service';
export type { LoginRequest, LoginResponse, AuthToken, AuthState } from './types';
export { AUTH_STORAGE_KEYS, TOKEN_EXPIRY_BUFFER_SECONDS } from './types';
