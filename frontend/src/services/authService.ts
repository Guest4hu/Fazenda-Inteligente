/**
 * src/services/authService.ts
 * Módulo de Autenticação e Registro de Usuários / Produtores Rurais.
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
 * Autentica um produtor rural com e-mail e senha.
 * Endpoint: POST /api/v1/auth/login
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
 * Registra um novo produtor rural na plataforma.
 * Endpoint: POST /api/v1/auth/register
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

/**
 * Encerra a sessão do usuário no cliente.
 */
export function logout(): void {
  clearAuth();
}

/**
 * Retorna o token JWT atual.
 */
export function getToken(): string | null {
  return getClientToken();
}

/**
 * Define ou remove o token JWT do armazenamento.
 */
export function setToken(token: string | null): void {
  setClientToken(token);
}

/**
 * Retorna os dados do usuário autenticado no momento.
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
