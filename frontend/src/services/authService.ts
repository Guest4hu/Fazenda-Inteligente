/**
 * Authentication and registration service wrapping {@link apiClient} token/user storage.
 */

import {
  apiClient,
  getToken as getClientToken,
  setToken as setClientToken,
  getStoredUser,
  setStoredUser,
  clearAuth,
  parseJwt,
} from './apiClient';
import type {
  AuthResponseDTO,
  LoginRequestDTO,
  RegisterRequestDTO,
  AuthUser,
} from '../types/api';

export type { AuthUser };

/**
 * Authenticates a user with email and password, persisting the returned JWT and user profile.
 *
 * @endpoint POST /api/v1/auth/login
 */
export async function login(data: LoginRequestDTO): Promise<AuthResponseDTO> {
  const response = await apiClient<AuthResponseDTO>('/auth/login', {
    method: 'POST',
    body: data,
    skipAuth: true,
  });

  if (response?.token) {
    setClientToken(response.token);
    const user: AuthUser = {
      id: response.userId,
      userId: response.userId,
      name: response.name,
      email: response.email,
    };
    setStoredUser(user);
  }

  return response;
}

/**
 * Registers a new producer account and stores the issued JWT and profile upon success.
 *
 * @endpoint POST /api/v1/auth/register
 */
export async function register(data: RegisterRequestDTO): Promise<AuthResponseDTO> {
  const response = await apiClient<AuthResponseDTO>('/auth/register', {
    method: 'POST',
    body: data,
    skipAuth: true,
  });

  if (response?.token) {
    setClientToken(response.token);
    const user: AuthUser = {
      id: response.userId,
      userId: response.userId,
      name: response.name,
      email: response.email,
    };
    setStoredUser(user);
  }

  return response;
}

/** Clears the in-memory and localStorage JWT token and stored user profile. */
export function logout(): void {
  clearAuth();
}

/** Returns the active JWT access token, or {@code null} if unauthenticated. */
export function getToken(): string | null {
  return getClientToken();
}

/** Updates or clears the active JWT token across memory and localStorage. */
export function setToken(token: string | null): void {
  setClientToken(token);
}

/**
 * Returns the authenticated user from storage, falling back to decoding JWT claims when present.
 */
export function getUser(): AuthUser | null {
  const stored = getStoredUser();
  if (stored) return stored;

  const token = getClientToken();
  if (token) {
    const claims = parseJwt(token);
    if (claims) {
      return {
        id: claims.userId,
        userId: claims.userId,
        name: claims.userName,
        email: claims.sub,
      };
    }
  }

  return null;
}

export const authService = {
  login,
  register,
  logout,
  getToken,
  setToken,
  getUser,
};

export default authService;
