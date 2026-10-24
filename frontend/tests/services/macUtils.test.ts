import { describe, it, expect } from 'vitest';
import { sanitizeMacAddress } from '../../src/services/macUtils';

describe('macUtils.sanitizeMacAddress', () => {
  it('deve manter MAC address limpo de 12 caracteres hexadecimais em maiúsculas', () => {
    expect(sanitizeMacAddress('240AC4000110')).toBe('240AC4000110');
  });

  it('deve converter caracteres minúsculos para maiúsculos', () => {
    expect(sanitizeMacAddress('240ac4000110')).toBe('240AC4000110');
  });

  it('deve remover dois pontos (:)', () => {
    expect(sanitizeMacAddress('24:0A:C4:00:01:10')).toBe('240AC4000110');
  });

  it('deve remover hifens (-)', () => {
    expect(sanitizeMacAddress('24-0a-c4-00-01-10')).toBe('240AC4000110');
  });

  it('deve remover espaços e pontos', () => {
    expect(sanitizeMacAddress('24.0a.c4.00.01.10')).toBe('240AC4000110');
    expect(sanitizeMacAddress(' 24 0a c4 00 01 10 ')).toBe('240AC4000110');
  });

  it('deve lançar erro se MAC estiver vazio ou indefinido', () => {
    expect(() => sanitizeMacAddress('')).toThrow('MAC address is required');
  });

  it('deve lançar erro se contiver caracteres inválidos não-hexadecimais ou tamanho incorreto', () => {
    expect(() => sanitizeMacAddress('240AC4')).toThrow('12 hexadecimal characters');
    expect(() => sanitizeMacAddress('240AC4000110AABB')).toThrow('12 hexadecimal characters');
    expect(() => sanitizeMacAddress('240AC400011Z')).toThrow('12 hexadecimal characters');
  });
});
