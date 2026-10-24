import { vi, expect } from 'vitest';
import type { ProblemDetail } from '../src/types/api';

/**
 * Cria uma resposta fetch bem-sucedida simulada.
 */
export function mockFetchSuccess<T>(data: T, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 201 ? 'Created' : status === 204 ? 'No Content' : 'OK',
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(typeof data === 'string' ? data : JSON.stringify(data)),
    headers: new Headers({ 'content-type': 'application/json' }),
  } as unknown as Response;
}

/**
 * Cria uma resposta de erro no padrão RFC 7807 (ProblemDetail).
 */
export function mockFetchProblemDetail(problem: Partial<ProblemDetail>, status = 400): Response {
  const fullProblem: ProblemDetail = {
    type: problem.type || 'about:blank',
    title: problem.title || 'Erro na requisição',
    status: problem.status || status,
    detail: problem.detail || 'Ocorreu um erro no servidor',
    instance: problem.instance || '/api/v1',
    ...(problem.invalidParams ? { invalidParams: problem.invalidParams } : {}),
  };

  return {
    ok: false,
    status: fullProblem.status,
    statusText: fullProblem.title,
    json: () => Promise.resolve(fullProblem),
    text: () => Promise.resolve(JSON.stringify(fullProblem)),
    headers: new Headers({ 'content-type': 'application/problem+json' }),
  } as unknown as Response;
}

/**
 * Captura o último chamado do fetch simulado e retorna a URL e as opções parseadas.
 */
export function getFetchCallDetails(fetchSpy: any) {
  expect(fetchSpy).toHaveBeenCalled();
  const lastCall = fetchSpy.mock.calls[fetchSpy.mock.calls.length - 1];
  const url = lastCall[0] as string;
  const options = (lastCall[1] || {}) as RequestInit;
  const body = options.body ? JSON.parse(options.body as string) : undefined;
  const headers = options.headers as Record<string, string> | Headers | undefined;

  return { url, options, body, headers };
}
