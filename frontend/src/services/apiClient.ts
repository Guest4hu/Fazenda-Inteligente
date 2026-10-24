/**
 * src/services/apiClient.ts
 * Cliente HTTP centralizado com injeção de autenticação Bearer,
 * suporte a RFC 7807 (ProblemDetail) e classe de erro tipada ApiError.
 */

import type { ProblemDetail, InvalidParam, AuthUser } from '../types/api';

// ============================================================================
// CONSTANTES E CHAVES DE ARMAZENAMENTO
// ============================================================================

export const TOKEN_STORAGE_KEY = 'curral_auth_token';
export const USER_STORAGE_KEY = 'curral_auth_user';
const FALLBACK_TOKEN_KEYS = ['auth_token', 'token'];
const FALLBACK_USER_KEYS = ['auth_user', 'user'];
const DEFAULT_BASE_URL = '/api/v1';

// Estado em memória para acesso síncrono rápido
let inMemoryToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

// ============================================================================
// CLASSE DE ERRO RFC 7807: ApiError
// ============================================================================

export class ApiError extends Error {
  public readonly status: number;
  public readonly title: string;
  public readonly detail: string;
  public readonly instance: string;
  public readonly type: string;
  public readonly invalidParams?: Record<string, string>;
  public readonly problem: ProblemDetail;
  public readonly problemDetail: ProblemDetail;

  constructor(problem: ProblemDetail) {
    const message = problem.detail || problem.title || `HTTP Error ${problem.status}`;
    super(message);
    this.name = 'ApiError';
    this.status = problem.status;
    this.title = problem.title || 'Error';
    this.detail = problem.detail || '';
    this.instance = problem.instance || '';
    this.type = problem.type || 'about:blank';
    this.invalidParams = problem.invalidParams;
    this.problem = problem;
    this.problemDetail = problem;

    // Garante a integridade da cadeia de protótipos para checagens com instanceof
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  public isStatus(code: number): boolean {
    return this.status === code;
  }

  public isUnauthorized(): boolean {
    return this.status === 401;
  }

  public isForbidden(): boolean {
    return this.status === 403;
  }

  public isNotFound(): boolean {
    return this.status === 404;
  }

  public isConflict(): boolean {
    return this.status === 409;
  }

  public isValidationError(): boolean {
    return this.status === 400 && !!this.invalidParams;
  }

  public hasFieldErrors(): boolean {
    return !!this.invalidParams && Object.keys(this.invalidParams).length > 0;
  }

  public getFieldError(fieldName: string): string | undefined {
    return this.invalidParams?.[fieldName];
  }

  public getInvalidParamsList(): InvalidParam[] {
    if (!this.invalidParams) return [];
    return Object.entries(this.invalidParams).map(([name, reason]) => ({
      name,
      reason,
    }));
  }
}

// ============================================================================
// GERENCIAMENTO DE TOKEN E SESSÃO
// ============================================================================

export function getToken(): string | null {
  if (inMemoryToken) {
    return inMemoryToken;
  }
  if (typeof window !== 'undefined' && window.localStorage) {
    const stored =
      window.localStorage.getItem(TOKEN_STORAGE_KEY) ||
      window.localStorage.getItem(FALLBACK_TOKEN_KEYS[0]) ||
      window.localStorage.getItem(FALLBACK_TOKEN_KEYS[1]);
    inMemoryToken = stored;
    return stored;
  }
  return null;
}

export function setToken(token: string | null): void {
  inMemoryToken = token;
  if (typeof window !== 'undefined' && window.localStorage) {
    if (token) {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
      FALLBACK_TOKEN_KEYS.forEach((key) => window.localStorage.setItem(key, token));
    } else {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
      FALLBACK_TOKEN_KEYS.forEach((key) => window.localStorage.removeItem(key));
    }
  }
}

export function clearToken(): void {
  setToken(null);
}

export function hasToken(): boolean {
  return !!getToken();
}

export function getStoredUser(): AuthUser | null {
  if (typeof window !== 'undefined' && window.localStorage) {
    const raw =
      window.localStorage.getItem(USER_STORAGE_KEY) ||
      window.localStorage.getItem(FALLBACK_USER_KEYS[0]) ||
      window.localStorage.getItem(FALLBACK_USER_KEYS[1]);
    if (raw) {
      try {
        return JSON.parse(raw) as AuthUser;
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function setStoredUser(user: AuthUser | null): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    if (user) {
      const serialized = JSON.stringify(user);
      window.localStorage.setItem(USER_STORAGE_KEY, serialized);
      FALLBACK_USER_KEYS.forEach((key) => window.localStorage.setItem(key, serialized));
    } else {
      window.localStorage.removeItem(USER_STORAGE_KEY);
      FALLBACK_USER_KEYS.forEach((key) => window.localStorage.removeItem(key));
    }
  }
}

export function clearAuth(): void {
  clearToken();
  setStoredUser(null);
}

export function setOnUnauthorized(callback: (() => void) | null): void {
  unauthorizedHandler = callback;
}

// ============================================================================
// DECODIFICAÇÃO E VALIDAÇÃO DE JWT
// ============================================================================

export interface JwtClaims {
  sub: string;
  userId: number;
  userName: string;
  exp?: number;
  iss?: string;
  iat?: number;
}

export function parseJwt(token: string): JwtClaims | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload) as JwtClaims;
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string): boolean {
  const claims = parseJwt(token);
  if (!claims || !claims.exp) return false;
  return claims.exp * 1000 < Date.now() + 10000;
}

// Sincronização entre abas
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (
      event.key === TOKEN_STORAGE_KEY ||
      event.key === FALLBACK_TOKEN_KEYS[0] ||
      event.key === FALLBACK_TOKEN_KEYS[1]
    ) {
      inMemoryToken = event.newValue;
    }
  });
}

// ============================================================================
// UTILITÁRIOS DE URL E REQUISIÇÃO
// ============================================================================

export function getBaseUrl(): string {
  if (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_BASE_URL) {
    return (import.meta as any).env.VITE_API_BASE_URL;
  }
  return DEFAULT_BASE_URL;
}

export function resolveUrl(endpoint: string): string {
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }

  const base = getBaseUrl().replace(/\/+$/, '');
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  if (cleanEndpoint === base || cleanEndpoint.startsWith(`${base}/`)) {
    return cleanEndpoint;
  }

  return `${base}${cleanEndpoint}`;
}

export interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined | null>;
  skipAuth?: boolean;
}

/**
 * Verifica se o servidor backend Spring Boot está respondendo na rede.
 * Retorna true se responder 200, 401 ou 403 (API viva).
 */
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const url = resolveUrl('/farms');
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    return response.status === 200 || response.status === 401 || response.status === 403;
  } catch {
    return false;
  }
}

// ============================================================================
// CLIENTE HTTP PRINCIPAL
// ============================================================================

export async function apiClient<T>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
  const { body, params, skipAuth, headers: customHeaders, ...fetchInit } = options;

  let url = resolveUrl(endpoint);

  // Adicionar query parameters caso informados
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null) {
        searchParams.append(key, String(val));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString;
    }
  }

  // Normalizar cabeçalhos em objeto chave-valor
  const requestHeaders: Record<string, string> = {};

  if (customHeaders) {
    if (customHeaders instanceof Headers) {
      customHeaders.forEach((val, key) => {
        requestHeaders[key] = val;
      });
    } else if (Array.isArray(customHeaders)) {
      customHeaders.forEach(([key, val]) => {
        requestHeaders[key] = val;
      });
    } else {
      Object.assign(requestHeaders, customHeaders);
    }
  }

  // Injetar token de autenticação caso não seja explicitamente ignorado
  if (!skipAuth) {
    const hasAuth = Object.keys(requestHeaders).some(
      (k) => k.toLowerCase() === 'authorization'
    );
    if (!hasAuth) {
      const token = getToken();
      if (token) {
        requestHeaders['Authorization'] = `Bearer ${token}`;
      }
    }
  }

  // Serialização do corpo da requisição
  let bodyContent: BodyInit | undefined = undefined;
  if (body !== undefined && body !== null) {
    if (
      typeof body === 'string' ||
      (typeof FormData !== 'undefined' && body instanceof FormData) ||
      (typeof Blob !== 'undefined' && body instanceof Blob)
    ) {
      bodyContent = body as BodyInit;
    } else {
      const hasContentType = Object.keys(requestHeaders).some(
        (k) => k.toLowerCase() === 'content-type'
      );
      if (!hasContentType) {
        requestHeaders['Content-Type'] = 'application/json';
      }
      bodyContent = JSON.stringify(body);
    }
  }

  const hasAccept = Object.keys(requestHeaders).some(
    (k) => k.toLowerCase() === 'accept'
  );
  if (!hasAccept) {
    requestHeaders['Accept'] = 'application/json';
  }

  const method = fetchInit.method ? fetchInit.method.toUpperCase() : 'GET';

  const response = await fetch(url, {
    ...fetchInit,
    method,
    headers: requestHeaders,
    body: bodyContent,
  });

  // Tratamento de falhas HTTP (4xx / 5xx)
  if (!response.ok) {
    let problemDetail: ProblemDetail;

    try {
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json') || contentType.includes('application/problem+json')) {
        const errorJson = await response.json();
        problemDetail = {
          type: errorJson.type || 'about:blank',
          title: errorJson.title || response.statusText || 'Error',
          status: typeof errorJson.status === 'number' ? errorJson.status : response.status,
          detail: errorJson.detail || '',
          instance: errorJson.instance || endpoint,
          invalidParams: errorJson.invalidParams,
          ...errorJson,
        };
      } else {
        const rawText = await response.text();
        problemDetail = {
          type: 'about:blank',
          title: response.statusText || 'Error',
          status: response.status,
          detail: rawText || '',
          instance: endpoint,
        };
      }
    } catch {
      problemDetail = {
        type: 'about:blank',
        title: response.statusText || 'Error',
        status: response.status,
        detail: '',
        instance: endpoint,
      };
    }

    // Se receber 401 e houver callback registrado, aciona callback
    if (response.status === 401 && unauthorizedHandler) {
      unauthorizedHandler();
    }

    throw new ApiError(problemDetail);
  }

  // Tratamento de status 204 No Content
  if (response.status === 204) {
    return null as unknown as T;
  }

  const contentLength = response.headers.get('content-length');
  if (contentLength === '0') {
    return null as unknown as T;
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json') || contentType.includes('application/problem+json')) {
    const text = await response.text();
    if (!text || text.trim() === '') {
      return null as unknown as T;
    }
    return JSON.parse(text) as T;
  }

  const text = await response.text();
  return (text ? text : null) as unknown as T;
}

// ============================================================================
// CONVENIENCE METHODS (.get, .post, .put, .patch, .delete)
// ============================================================================

apiClient.get = function <T>(endpoint: string, options?: Omit<ApiRequestOptions, 'method' | 'body'>): Promise<T> {
  return apiClient<T>(endpoint, { ...options, method: 'GET' });
};

apiClient.post = function <T>(endpoint: string, body?: unknown, options?: Omit<ApiRequestOptions, 'method' | 'body'>): Promise<T> {
  return apiClient<T>(endpoint, { ...options, method: 'POST', body });
};

apiClient.put = function <T>(endpoint: string, body?: unknown, options?: Omit<ApiRequestOptions, 'method' | 'body'>): Promise<T> {
  return apiClient<T>(endpoint, { ...options, method: 'PUT', body });
};

apiClient.patch = function <T>(endpoint: string, body?: unknown, options?: Omit<ApiRequestOptions, 'method' | 'body'>): Promise<T> {
  return apiClient<T>(endpoint, { ...options, method: 'PATCH', body });
};

apiClient.delete = function <T>(endpoint: string, options?: Omit<ApiRequestOptions, 'method' | 'body'>): Promise<T> {
  return apiClient<T>(endpoint, { ...options, method: 'DELETE' });
};
