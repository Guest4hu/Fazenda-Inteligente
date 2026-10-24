import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

// Limpeza automática do DOM e instâncias SSE após cada teste
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  if ((globalThis as any).MockEventSource?.instances) {
    (globalThis as any).MockEventSource.instances.forEach((inst: any) => inst.close?.());
    (globalThis as any).MockEventSource.instances = [];
  }
});

// Reseta storages antes de cada teste
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.restoreAllMocks();
});

// Mock de window.matchMedia para ambientes jsdom
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock de ResizeObserver para componentes responsivos e gráficos
class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
window.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

// Mock de EventSource para suporte a Server-Sent Events (SSE) em testes jsdom
export class MockEventSource {
  static instances: MockEventSource[] = [];
  public url: string;
  public withCredentials: boolean;
  public readyState: number = 0; // 0: CONNECTING, 1: OPEN, 2: CLOSED
  public onopen: ((ev: Event) => void) | null = null;
  public onmessage: ((ev: MessageEvent) => void) | null = null;
  public onerror: ((ev: Event) => void) | null = null;
  private listeners: Record<string, ((ev: any) => void)[]> = {};

  constructor(url: string | URL, eventSourceInitDict?: EventSourceInit) {
    this.url = String(url);
    this.withCredentials = eventSourceInitDict?.withCredentials ?? false;
    MockEventSource.instances.push(this);
    setTimeout(() => {
      if (this.readyState === 0) {
        this.readyState = 1;
        const ev = new Event('open');
        this.onopen?.(ev);
        this.dispatchEvent(ev);
      }
    }, 0);
  }

  addEventListener(type: string, listener: (ev: any) => void) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(listener);
  }

  removeEventListener(type: string, listener: (ev: any) => void) {
    if (this.listeners[type]) {
      this.listeners[type] = this.listeners[type].filter((l) => l !== listener);
    }
  }

  dispatchEvent(event: Event): boolean {
    const list = this.listeners[event.type] || [];
    list.forEach((fn) => fn(event));
    return true;
  }

  emit(type: string, data: any) {
    const serialized = typeof data === 'string' ? data : JSON.stringify(data);
    const event = new MessageEvent(type, { data: serialized });
    if (type === 'message' && this.onmessage) {
      this.onmessage(event);
    }
    this.dispatchEvent(event);
  }

  close() {
    this.readyState = 2;
  }
}

(globalThis as any).MockEventSource = MockEventSource;
if (typeof (globalThis as any).EventSource === 'undefined') {
  (globalThis as any).EventSource = MockEventSource;
}
if (typeof window !== 'undefined' && typeof (window as any).EventSource === 'undefined') {
  (window as any).EventSource = MockEventSource;
}

