import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Dashboard from '../../src/pages/dashboard';
import { farmService } from '../../src/services/farmService';
import { corralService } from '../../src/services/corralService';
import { animalService } from '../../src/services/animalService';
import { odorService } from '../../src/services/odorService';
import { pendencyService } from '../../src/services/pendencyService';
import { cleanService } from '../../src/services/cleanService';
import { MockEventSource } from '../setup';
import type {
  FarmResponseDTO,
  CorralResponseDTO,
  CorralMetricsResponseDTO,
  AnimalResponseDTO,
  AnimalEventResponseDTO,
  OdorTelemetryResponseDTO,
  IdentifyPendencyResponseDTO,
  CleanCmdResponseDTO,
} from '../../src/types/api';

describe('Dashboard SSE Real-Time Integration & Fallback Suite', () => {
  const mockFarm: FarmResponseDTO = {
    id: 10,
    name: 'Fazenda SSE Primavera',
    createdAt: '2026-10-24T08:00:00',
  };

  const mockCorral: CorralResponseDTO = {
    id: 100,
    farmId: 10,
    name: 'Curral SSE 100',
    macAddress: '240AC4000100',
    cleanTime: '06:00:00',
    limitOdor: 400,
    pumpDurationSeconds: 30,
    deviceStatus: 'ONLINE',
    lastSeenAt: '2026-10-24T12:00:00',
  };

  const mockMetrics: CorralMetricsResponseDTO = {
    corralId: 100,
    corralName: 'Curral SSE 100',
    farmId: 10,
    farmName: 'Fazenda SSE Primavera',
    totalAnimaisNoCurral: 0,
    totalAnimaisNaFazenda: 5,
    limpezasHojeTotal: 1,
    limpezasHojeManual: 1,
    limpezasHojeOdor: 0,
    limpezasHojeAutomatica: 0,
    deviceStatus: 'ONLINE',
    lastSeenAt: '2026-10-24T12:00:00',
    pendenciasAbertas: 0,
  };

  const mockAnimal: AnimalResponseDTO = {
    id: 7,
    farmId: 10,
    name: 'Estrela',
    identification: 'BR-007',
    tagUid: 'TAG-ESTRELA-77',
    currentCorralId: null,
    currentCorralName: null,
  };

  beforeEach(() => {
    localStorage.clear();
    MockEventSource.instances = [];

    // Autentica o produtor e seleciona a fazenda e curral
    localStorage.setItem('curral_auth_token', 'jwt-token-sse-realtime');
    localStorage.setItem(
      'curral_auth_user',
      JSON.stringify({ id: 1, userId: 1, name: 'Produtor SSE', email: 'produtor@sse.com' })
    );
    localStorage.setItem('curral_selected_farm_id', '10');
    localStorage.setItem('curral_selected_corral_id', '100');

    // Mocks dos serviços REST iniciais
    vi.spyOn(farmService, 'listFarms').mockResolvedValue([mockFarm]);
    vi.spyOn(corralService, 'listCorrais').mockResolvedValue([mockCorral]);
    vi.spyOn(corralService, 'getMetrics').mockResolvedValue(mockMetrics);
    vi.spyOn(odorService, 'getOdorReadings').mockResolvedValue([]);
    vi.spyOn(animalService, 'listAnimals').mockResolvedValue([mockAnimal]);
    vi.spyOn(animalService, 'listEvents').mockResolvedValue([]);
    vi.spyOn(pendencyService, 'listPendencies').mockResolvedValue([]);
    vi.spyOn(cleanService, 'listCleanHistory').mockResolvedValue([]);
  });

  afterEach(() => {
    MockEventSource.instances.forEach((inst) => inst.close());
    MockEventSource.instances = [];
    vi.restoreAllMocks();
  });

  it('1. Establishes SSE stream connection and displays live SSE badges in header and connectivity banner', async () => {
    render(<Dashboard />);

    await waitFor(() => {
      expect(MockEventSource.instances.length).toBeGreaterThanOrEqual(1);
    });

    const sseInstance = MockEventSource.instances[MockEventSource.instances.length - 1];
    expect(sseInstance.url).toContain('/farms/10/currais/100/stream?token=jwt-token-sse-realtime');

    // Emite evento de conexão
    act(() => {
      sseInstance.emit('connected', { corralId: 100, status: 'connected' });
    });

    await waitFor(() => {
      expect(screen.getByTestId('badge-sse-live')).toBeInTheDocument();
      expect(screen.getByTestId('badge-sse-header')).toBeInTheDocument();
      expect(screen.getByTestId('list-events')).toHaveTextContent(
        'Transmissão SSE conectada ao vivo para o curral.'
      );
    });
  });

  it('2. Receives real-time "odor" event and updates readings without needing polling sync', async () => {
    render(<Dashboard />);

    await waitFor(() => {
      expect(MockEventSource.instances.length).toBeGreaterThanOrEqual(1);
    });

    const sseInstance = MockEventSource.instances[MockEventSource.instances.length - 1];

    const telemetry: OdorTelemetryResponseDTO = {
      id: 999,
      corralId: 100,
      value: 580,
      instant: '2026-10-24T12:05:00',
    };

    act(() => {
      sseInstance.emit('odor', telemetry);
    });

    await waitFor(() => {
      // Valor de odor deve ser atualizado no card de MQ-135
      expect(screen.getByTestId('value-mq')).toHaveTextContent('580');
      // Deve registrar log de nível crítico
      expect(screen.getByTestId('list-events')).toHaveTextContent(
        /Alerta de Odor: Nível crítico de 580 ppm detectado/
      );
    });
  });

  it('3. Receives real-time "presenca" (ENTROU) event and triggers biological lock safety shutdown on active wash', async () => {
    render(<Dashboard />);

    await waitFor(() => {
      expect(MockEventSource.instances.length).toBeGreaterThanOrEqual(1);
    });

    const sseInstance = MockEventSource.instances[MockEventSource.instances.length - 1];

    // O curral está inicialmente sem animais
    expect(screen.getByTestId('status-presence')).toHaveTextContent('Curral livre');

    // Inicia lavagem manual via mock de triggerCleaning
    vi.spyOn(cleanService, 'triggerCleaning').mockResolvedValueOnce({
      id: 'cmd-sse-wash',
      corralId: 100,
      origin: 'MANUAL',
      state: 'EM_ANDAMENTO',
      secondsDuration: 30,
      createdAt: '2026-10-24T12:10:00',
      mensagem: null,
    });

    fireEvent.click(screen.getByTestId('button-lavar'));

    // Aguarda início da lavagem
    await waitFor(() => {
      expect(screen.getByTestId('status-pump')).toHaveTextContent('Ligada');
    });

    // Emite evento SSE de presença: Estrela ENTROU no curral
    const enterEvent: AnimalEventResponseDTO = {
      id: 888,
      corralId: 100,
      corralName: 'Curral SSE 100',
      animalId: 7,
      animalName: 'Estrela',
      tagUid: 'TAG-ESTRELA-77',
      typeEvent: 'ENTROU',
      eventOrigin: 'TAG',
      instant: '2026-10-24T12:10:05',
    };

    act(() => {
      sseInstance.emit('presenca', enterEvent);
    });

    // A bomba deve ser desligada imediatamente por parada de segurança
    await waitFor(() => {
      expect(screen.getByTestId('status-pump')).toHaveTextContent('Desligada');
      expect(screen.getByTestId('status-presence')).toHaveTextContent('Animal detectado');
      expect(screen.getByTestId('list-events')).toHaveTextContent(/PARADA DE SEGURANÇA/);
    });
  });

  it('4. Receives real-time "pendencia" event and displays open pendency alert banner', async () => {
    render(<Dashboard />);

    await waitFor(() => {
      expect(MockEventSource.instances.length).toBeGreaterThanOrEqual(1);
    });

    const sseInstance = MockEventSource.instances[MockEventSource.instances.length - 1];

    // Inicialmente sem botão de cadastro de animal da pendência
    expect(screen.queryByTestId('button-banner-add-animal')).not.toBeInTheDocument();

    // Emite nova pendência para tag RFID desconhecida
    const newPendency: IdentifyPendencyResponseDTO = {
      id: 701,
      corralId: 100,
      tagUid: 'TAG-DESCONHECIDA-999',
      typeEvent: 'ENTROU',
      instant: '2026-10-24T12:15:00',
      resolved: false,
      animalIdResolved: null,
      animalNameResolved: null,
      resolvedAt: null,
    };

    act(() => {
      sseInstance.emit('pendencia', newPendency);
    });

    await waitFor(() => {
      expect(screen.getByTestId('button-banner-add-animal')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent(/1 Leitura RFID desconhecida/i);
      expect(screen.getByTestId('list-events')).toHaveTextContent(
        'Tag RFID desconhecida detectada (TAG-DESCONHECIDA-999). Pendência gerada.'
      );
    });

    // Emite resolução da pendência
    const resolvedPendency: IdentifyPendencyResponseDTO = {
      ...newPendency,
      resolved: true,
      animalIdResolved: 7,
      animalNameResolved: 'Estrela',
      resolvedAt: '2026-10-24T12:16:00',
    };

    act(() => {
      sseInstance.emit('pendencia', resolvedPendency);
    });

    await waitFor(() => {
      expect(screen.queryByTestId('button-banner-add-animal')).not.toBeInTheDocument();
      expect(screen.getByTestId('list-events')).toHaveTextContent(
        'Pendência de identificação (Tag: TAG-DESCONHECIDA-999) resolvida com sucesso.'
      );
    });
  });

  it('5. Receives real-time "limpeza" event and updates cleaning history table', async () => {
    render(<Dashboard />);

    await waitFor(() => {
      expect(MockEventSource.instances.length).toBeGreaterThanOrEqual(1);
    });

    const sseInstance = MockEventSource.instances[MockEventSource.instances.length - 1];

    const cleanEvent: CleanCmdResponseDTO = {
      id: 'cmd-sse-auto-complete',
      corralId: 100,
      origin: 'AUTOMATICA',
      state: 'CONCLUIDO',
      secondsDuration: 25,
      createdAt: '2026-10-24T12:20:00',
      mensagem: 'Ciclo diário automatizado concluído',
    };

    vi.spyOn(cleanService, 'listCleanHistory').mockResolvedValue([cleanEvent]);

    act(() => {
      sseInstance.emit('limpeza', cleanEvent);
    });

    await waitFor(() => {
      expect(screen.getByTestId('list-events')).toHaveTextContent(
        'Ciclo de limpeza concluído com sucesso (AUTOMATICA). Bomba desligada.'
      );
    });

    // Expande histórico de limpezas para verificar registro
    fireEvent.click(screen.getByText('Ver Histórico de Limpezas'));
    await waitFor(() => {
      expect(screen.getByText('AUTOMATICA')).toBeInTheDocument();
      expect(screen.getByText('CONCLUIDO')).toBeInTheDocument();
    });
  });

  it('6. Receives real-time "status" event and updates device online/offline indication', async () => {
    render(<Dashboard />);

    await waitFor(() => {
      expect(MockEventSource.instances.length).toBeGreaterThanOrEqual(1);
    });

    const sseInstance = MockEventSource.instances[MockEventSource.instances.length - 1];

    // Dispositivo fica OFFLINE
    act(() => {
      sseInstance.emit('status', {
        ...mockCorral,
        deviceStatus: 'OFFLINE',
        lastSeenAt: '2026-10-24T11:00:00',
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('banner-esp32')).toHaveTextContent(/ESP32 OFFLINE/);
      expect(screen.getByTestId('list-events')).toHaveTextContent(
        'Dispositivo ESP32 do curral está OFFLINE.'
      );
    });

    // Dispositivo volta para ONLINE
    act(() => {
      sseInstance.emit('status', {
        ...mockCorral,
        deviceStatus: 'ONLINE',
        lastSeenAt: '2026-10-24T12:25:00',
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('banner-esp32')).toHaveTextContent(/ESP32 ONLINE/);
      expect(screen.getByTestId('list-events')).toHaveTextContent(
        'Dispositivo ESP32 do curral está ONLINE.'
      );
    });
  });

  it('7. Triggers biological safety lock when a new animal enters during active wash with empty animals array', async () => {
    vi.spyOn(animalService, 'listAnimals').mockResolvedValue([]);
    render(<Dashboard />);

    await waitFor(() => {
      expect(MockEventSource.instances.length).toBeGreaterThanOrEqual(1);
    });

    const sseInstance = MockEventSource.instances[MockEventSource.instances.length - 1];

    // Inicia lavagem
    vi.spyOn(cleanService, 'triggerCleaning').mockResolvedValueOnce({
      id: 'cmd-sse-wash-unregistered',
      corralId: 100,
      origin: 'MANUAL',
      state: 'EM_ANDAMENTO',
      secondsDuration: 30,
      createdAt: '2026-10-24T12:10:00',
      mensagem: null,
    });

    fireEvent.click(screen.getByTestId('button-lavar'));

    await waitFor(() => {
      expect(screen.getByTestId('status-pump')).toHaveTextContent('Ligada');
    });

    // Emite evento ENTROU de animal que não constava na lista inicial
    const newAnimalEnterEvent: AnimalEventResponseDTO = {
      id: 991,
      corralId: 100,
      corralName: 'Curral SSE 100',
      animalId: 44,
      animalName: 'Vaca Surpresa',
      tagUid: 'TAG-SURPRESA-44',
      typeEvent: 'ENTROU',
      eventOrigin: 'TAG',
      instant: '2026-10-24T12:10:15',
    };

    act(() => {
      sseInstance.emit('presenca', newAnimalEnterEvent);
    });

    await waitFor(() => {
      expect(screen.getByTestId('status-pump')).toHaveTextContent('Desligada');
      expect(screen.getByTestId('list-events')).toHaveTextContent(/PARADA DE SEGURANÇA/);
    });
  });

  it('8. Populates synthesized metrics and updates KPI counters upon receiving SSE events when initial metrics were null', async () => {
    vi.spyOn(corralService, 'getMetrics').mockResolvedValue(null as any);
    render(<Dashboard />);

    await waitFor(() => {
      expect(MockEventSource.instances.length).toBeGreaterThanOrEqual(1);
    });

    const sseInstance = MockEventSource.instances[MockEventSource.instances.length - 1];

    // Emite evento de odor quando metrics é null
    act(() => {
      sseInstance.emit('odor', {
        id: 101,
        corralId: 100,
        value: 350,
        instant: '2026-10-24T12:30:00',
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('value-mq')).toHaveTextContent('350');
      expect(screen.getByTestId('banner-esp32')).toHaveTextContent(/ESP32 ONLINE/);
    });
  });
});
