import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as authService from '../../src/services/authService';
import { mockFetchSuccess, mockFetchProblemDetail, getFetchCallDetails } from '../mockApi';

describe('authService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    authService.logout();
  });

  describe('Endpoint 1: POST /api/v1/auth/register', () => {
    it('deve registrar produtor rural com sucesso e persistir token e usuário', async () => {
      const fakeResponse = {
        token: 'mock-jwt-token',
        userId: 1,
        name: 'João Produtor',
        email: 'joao@fazenda.com',
      };
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        mockFetchSuccess(fakeResponse, 201)
      );

      const payload = {
        name: 'João Produtor',
        email: 'joao@fazenda.com',
        password: 'senhaSegura123',
      };
      const result = await authService.register(payload);

      expect(result).toEqual(fakeResponse);
      const { url, options, body } = getFetchCallDetails(fetchSpy);
      expect(url).toMatch(/\/auth\/register$/);
      expect(options.method).toBe('POST');
      expect(body).toEqual(payload);

      expect(authService.getToken()).toBe('mock-jwt-token');
      expect(authService.getUser()?.name).toBe('João Produtor');
    });

    it('deve propagar erro 400 com invalidParams se validação falhar', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        mockFetchProblemDetail(
          {
            status: 400,
            title: 'Erro de Validação',
            invalidParams: {
              email: 'must be a well-formed email address',
              password: 'size must be between 6 and 2147483647',
            },
          },
          400
        )
      );

      await expect(
        authService.register({ name: 'J', email: 'invalid', password: '123' })
      ).rejects.toThrow();
    });

    it('deve propagar erro 409 se email já estiver cadastrado', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        mockFetchProblemDetail(
          {
            status: 409,
            detail: 'Email ja cadastado',
          },
          409
        )
      );

      await expect(
        authService.register({
          name: 'João',
          email: 'joao@fazenda.com',
          password: 'secretPassword',
        })
      ).rejects.toThrow();
    });
  });

  describe('Endpoint 2: POST /api/v1/auth/login', () => {
    it('deve efetuar login e retornar credenciais com token persistido', async () => {
      const fakeResponse = {
        token: 'login-token-xyz',
        userId: 10,
        name: 'Maria Fazendeira',
        email: 'maria@fazenda.com',
      };
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        mockFetchSuccess(fakeResponse, 200)
      );

      const result = await authService.login({
        email: 'maria@fazenda.com',
        password: 'senhaSegura123',
      });

      expect(result).toEqual(fakeResponse);
      const { url, options, body } = getFetchCallDetails(fetchSpy);
      expect(url).toMatch(/\/auth\/login$/);
      expect(options.method).toBe('POST');
      expect(body).toEqual({ email: 'maria@fazenda.com', password: 'senhaSegura123' });

      expect(authService.getToken()).toBe('login-token-xyz');
      expect(authService.getUser()?.email).toBe('maria@fazenda.com');
    });

    it('deve propagar erro 401 quando email ou senha forem inválidos', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        mockFetchProblemDetail(
          {
            status: 401,
            title: 'Credenciais Inválidas',
            detail: 'Email ou senha invalidos',
          },
          401
        )
      );

      await expect(
        authService.login({ email: 'wrong@fazenda.com', password: 'wrong' })
      ).rejects.toThrow();
    });

    it('deve limpar token e usuário na execução de logout()', () => {
      authService.setToken('temp-token');
      expect(authService.getToken()).toBe('temp-token');
      authService.logout();
      expect(authService.getToken()).toBeNull();
      expect(authService.getUser()).toBeNull();
    });
  });
});
