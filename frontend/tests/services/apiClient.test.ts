import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  apiClient,
  ApiError,
  setToken,
  getToken,
  clearToken,
  setOnUnauthorized,
  parseJwt,
  isTokenExpired,
  checkBackendHealth,
} from '../../src/services/apiClient';
import { mockFetchSuccess, mockFetchProblemDetail } from '../mockApi';

describe('apiClient HTTP Base Client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    clearToken();
    setOnUnauthorized(null);
  });

  it('deve realizar requisição GET com baseUrl e deserializar JSON', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockFetchSuccess({ ok: true, count: 5 })
    );

    const result = await apiClient<{ ok: boolean; count: number }>('/farms');
    expect(result).toEqual({ ok: true, count: 5 });
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/v1\/farms$/),
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('deve injetar automaticamente o header Authorization: Bearer <token> se token estiver presente no storage', async () => {
    setToken('jwt-token-123');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockFetchSuccess([])
    );

    await apiClient('/farms');

    const headers = fetchSpy.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer jwt-token-123');
  });

  it('não deve enviar header Authorization se token não estiver presente', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockFetchSuccess([])
    );

    await apiClient('/farms');

    const headers = fetchSpy.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers?.['Authorization']).toBeUndefined();
  });

  it('deve retornar null/undefined sem erro em respostas 204 No Content', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockFetchSuccess(null, 204)
    );

    const result = await apiClient('/farms/1', { method: 'DELETE' });
    expect(result).toBeNull();
  });

  it('deve lançar ApiError com status 400 e invalidParams em erro de validação RFC 7807', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockFetchProblemDetail(
        {
          status: 400,
          title: 'Erro de Validação',
          detail: 'Um ou mais campos são inválidos',
          instance: '/api/v1/farms/1/currais',
          invalidParams: {
            macAddress: 'O MAC Address deve conter exatamente 12 caracteres hexadecimais',
            pumpDurationSeconds: 'A duração maxima da bomba e de 60 segundos',
          },
        },
        400
      )
    );

    try {
      await apiClient('/farms/1/currais', { method: 'POST', body: {} });
      expect.fail('Deveria ter lançado ApiError');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(400);
      expect(apiErr.problemDetail.title).toBe('Erro de Validação');
      expect(apiErr.isValidationError()).toBe(true);
      expect(apiErr.hasFieldErrors()).toBe(true);
      expect(apiErr.getFieldError('macAddress')).toContain('12 caracteres');
      expect(apiErr.getInvalidParamsList().length).toBe(2);
    }
  });

  it('deve lançar ApiError com status 401 Unauthorized e acionar setOnUnauthorized', async () => {
    const unauthorizedCallback = vi.fn();
    setOnUnauthorized(unauthorizedCallback);

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

    await expect(apiClient('/auth/login', { method: 'POST' })).rejects.toThrow(ApiError);
    expect(unauthorizedCallback).toHaveBeenCalled();
  });

  it('deve lançar ApiError com status 403 Forbidden em acesso negado', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockFetchProblemDetail(
        {
          status: 403,
          title: 'Acesso Negado',
          detail: 'Você não tem permissão para editar esta fazenda',
        },
        403
      )
    );

    try {
      await apiClient('/farms/99', { method: 'PUT' });
      expect.fail('Deveria ter falhado');
    } catch (err) {
      const apiErr = err as ApiError;
      expect(apiErr.isForbidden()).toBe(true);
      expect(apiErr.status).toBe(403);
    }
  });

  it('deve lançar ApiError com status 404 Not Found quando recurso não existe', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockFetchProblemDetail(
        {
          status: 404,
          title: 'Recurso Não Encontrado',
          detail: 'Fazenda não encontrada com ID: 999',
        },
        404
      )
    );

    try {
      await apiClient('/farms/999');
      expect.fail('Deveria ter falhado');
    } catch (err) {
      const apiErr = err as ApiError;
      expect(apiErr.isNotFound()).toBe(true);
      expect(apiErr.status).toBe(404);
    }
  });

  it('deve lançar ApiError com status 409 Conflict em trava biológica (vaca no curral)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockFetchProblemDetail(
        {
          status: 409,
          title: 'Conflito de Regra de Negócio',
          detail: 'Tem uma vaca no curral neste momento, não tem como acionar a bomba de limpeza',
          instance: '/api/v1/currais/1/limpeza',
        },
        409
      )
    );

    try {
      await apiClient('/currais/1/limpeza', { method: 'POST' });
      expect.fail('Deveria ter lançado ApiError');
    } catch (err) {
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(409);
      expect(apiErr.isConflict()).toBe(true);
      expect(apiErr.message).toContain('Tem uma vaca no curral');
    }
  });

  it('deve tratar com segurança respostas de erro não-JSON (ex: HTML 502/500)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
      json: () => Promise.reject(new Error('SyntaxError: Unexpected token < in JSON')),
      text: () => Promise.resolve('<html><body>502 Bad Gateway</body></html>'),
      headers: new Headers({ 'content-type': 'text/html' }),
    } as unknown as Response);

    await expect(apiClient('/farms')).rejects.toThrow(ApiError);
  });

  it('deve suportar conveniências .get, .post, .put, .patch, .delete e query params', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockFetchSuccess({ data: 123 })
    );

    await apiClient.get('/test', { params: { active: true, count: 10 } });
    expect(fetchSpy.mock.calls[0][0]).toContain('/api/v1/test?active=true&count=10');

    await apiClient.post('/test', { name: 'sample' });
    expect(fetchSpy.mock.calls[1][1]?.method).toBe('POST');

    await apiClient.put('/test', { name: 'updated' });
    expect(fetchSpy.mock.calls[2][1]?.method).toBe('PUT');

    await apiClient.patch('/test', { active: false });
    expect(fetchSpy.mock.calls[3][1]?.method).toBe('PATCH');

    await apiClient.delete('/test');
    expect(fetchSpy.mock.calls[4][1]?.method).toBe('DELETE');
  });

  it('deve decodificar e validar expiração de JWT corretamente via parseJwt e isTokenExpired', () => {
    // Payload: { sub: "test@fazenda.com", userId: 10, userName: "Produtor Teste", exp: Math.floor(Date.now() / 1000) + 3600 }
    const validExp = Math.floor(Date.now() / 1000) + 3600;
    const headerBase64 = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payloadBase64 = btoa(
      JSON.stringify({
        sub: 'test@fazenda.com',
        userId: 10,
        userName: 'Produtor Teste',
        exp: validExp,
      })
    );
    const mockJwt = `${headerBase64}.${payloadBase64}.signature`;

    const claims = parseJwt(mockJwt);
    expect(claims?.userId).toBe(10);
    expect(claims?.userName).toBe('Produtor Teste');
    expect(claims?.sub).toBe('test@fazenda.com');
    expect(isTokenExpired(mockJwt)).toBe(false);

    // Token expirado
    const expiredPayload = btoa(
      JSON.stringify({
        sub: 'test@fazenda.com',
        exp: Math.floor(Date.now() / 1000) - 3600,
      })
    );
    const expiredJwt = `${headerBase64}.${expiredPayload}.signature`;
    expect(isTokenExpired(expiredJwt)).toBe(true);

    expect(parseJwt('invalid.token')).toBeNull();
  });

  it('checkBackendHealth deve retornar true quando o backend responde com status 200, 401 ou 403', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      status: 403,
    } as any);

    const online = await checkBackendHealth();
    expect(online).toBe(true);
  });

  it('checkBackendHealth deve retornar false quando fetch falha por erro de rede', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const online = await checkBackendHealth();
    expect(online).toBe(false);
  });
});
