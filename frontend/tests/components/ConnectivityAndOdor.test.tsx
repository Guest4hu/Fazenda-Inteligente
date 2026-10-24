import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConnectivityBanner } from '../../src/components/dashboard/ConnectivityBanner';
import { MetricsKpiCards } from '../../src/components/dashboard/MetricsKpiCards';
import { OdorChart } from '../../src/components/dashboard/OdorChart';
import { PendenciesModal, PendenciesAlertBanner } from '../../src/components/dashboard/PendenciesModal';
import { EventsTimeline } from '../../src/components/dashboard/EventsTimeline';
import { pendencyService } from '../../src/services/pendencyService';
import { ApiError } from '../../src/services/apiClient';
import type {
  IdentifyPendencyResponseDTO,
  AnimalResponseDTO,
  OdorTelemetryResponseDTO,
  AnimalEventResponseDTO,
} from '../../src/types/api';

describe('Connectivity, Telemetry & Pendencies Components', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('ConnectivityBanner', () => {
    it('renders simulated warning banner when isSimulated is true', () => {
      render(<ConnectivityBanner isSimulated={true} />);

      const banner = screen.getByTestId('banner-esp32');
      expect(banner).toBeInTheDocument();
      expect(banner).toHaveTextContent(
        'Não conectado ao ESP32. Tudo aqui é simulado: nenhuma bomba real é controlada.'
      );
    });

    it('renders OFFLINE alert when deviceStatus is OFFLINE', () => {
      render(
        <ConnectivityBanner
          isLive={true}
          deviceStatus="OFFLINE"
          corralName="Curral 1"
          lastSeenAt="2026-10-23T14:00:00"
        />
      );

      const banner = screen.getByTestId('banner-esp32');
      expect(banner).toHaveTextContent('ESP32 OFFLINE: O dispositivo do Curral 1 está sem comunicação recente.');
    });

    it('renders ONLINE status when deviceStatus is ONLINE', () => {
      render(
        <ConnectivityBanner
          isLive={true}
          deviceStatus="ONLINE"
          macAddress="240AC4000110"
          lastSeenAt="2026-10-23T14:30:00"
        />
      );

      const banner = screen.getByTestId('banner-esp32');
      expect(banner).toHaveTextContent('ESP32 ONLINE: Dispositivo conectado e operacional (MAC: 240AC4000110)');
    });
  });

  describe('MetricsKpiCards', () => {
    it('renders DHT22 temp, hum, and MQ-135 sensor values with data-testids', () => {
      render(
        <MetricsKpiCards
          temp={28.5}
          hum={65.0}
          mq={380}
          limitOdor={400}
        />
      );

      expect(screen.getByTestId('value-temp')).toHaveTextContent('28.5°C');
      expect(screen.getByTestId('value-hum')).toHaveTextContent('65.0%');
      expect(screen.getByTestId('value-mq')).toHaveTextContent('380');
      expect(screen.getByText(/Normal \(< 400\)/)).toBeInTheDocument();
    });

    it('highlights alert when MQ-135 exceeds limitOdor threshold', () => {
      render(
        <MetricsKpiCards
          temp={29.1}
          hum={70.2}
          mq={450}
          limitOdor={400}
        />
      );

      expect(screen.getByTestId('value-mq')).toHaveTextContent('450');
      expect(screen.getByText(/Limiar excedido \(≥ 400\)/)).toBeInTheDocument();
    });

    it('renders aggregated corral metrics summary when metrics prop is provided', () => {
      render(
        <MetricsKpiCards
          temp={27.0}
          hum={60.0}
          mq={350}
          metrics={{
            corralId: 1,
            corralName: 'Curral 1',
            farmId: 1,
            farmName: 'Fazenda 1',
            totalAnimaisNoCurral: 5,
            totalAnimaisNaFazenda: 20,
            limpezasHojeTotal: 3,
            limpezasHojeManual: 1,
            limpezasHojeOdor: 2,
            limpezasHojeAutomatica: 0,
            deviceStatus: 'ONLINE',
            lastSeenAt: null,
            pendenciasAbertas: 2,
          }}
        />
      );

      expect(screen.getByText('5 / 20')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  describe('OdorChart', () => {
    const mockReadings: OdorTelemetryResponseDTO[] = [
      { id: 1, corralId: 1, value: 350, instant: '2026-10-23T14:00:00' },
      { id: 2, corralId: 1, value: 420, instant: '2026-10-23T14:05:00' },
      { id: 3, corralId: 1, value: 380, instant: '2026-10-23T14:10:00' },
    ];

    it('renders responsive SVG canvas with line path and threshold indicator', () => {
      render(<OdorChart readings={mockReadings} limitOdor={400} isLive={true} />);

      expect(screen.getByText(/Telemetria de Amônia \(MQ-135\)/)).toBeInTheDocument();
      expect(screen.getByText('Limiar de Lavagem: 400')).toBeInTheDocument();
      expect(document.querySelector('svg')).toBeInTheDocument();
      expect(document.querySelectorAll('circle').length).toBe(3);
    });
  });

  describe('PendenciesModal & PendenciesAlertBanner', () => {
    const mockPendencies: IdentifyPendencyResponseDTO[] = [
      {
        id: 101,
        corralId: 1,
        tagUid: 'DEADBEEF',
        typeEvent: 'ENTROU',
        instant: '2026-10-23T13:45:00',
        resolved: false,
        animalIdResolved: null,
        animalNameResolved: null,
        resolvedAt: null,
      },
    ];

    const mockFarmAnimals: AnimalResponseDTO[] = [
      {
        id: 15,
        farmId: 1,
        name: 'Novilha Serena',
        identification: 'BR-99',
        tagUid: 'PENDING_TAG',
        currentCorralId: null,
        currentCorralName: null,
      },
    ];

    it('renders PendenciesAlertBanner and fires onOpenModal', () => {
      const handleOpen = vi.fn();
      render(<PendenciesAlertBanner pendenciesCount={1} onOpenModal={handleOpen} />);

      expect(screen.getByRole('alert')).toHaveTextContent(
        '1 Leitura RFID desconhecida pendente de identificação'
      );
      const resolveBtn = screen.getByRole('button', { name: /Resolver \(1\)/i });
      fireEvent.click(resolveBtn);
      expect(handleOpen).toHaveBeenCalledTimes(1);
    });

    it('resolves RFID pendency via pendencyService.resolvePendency in modal', async () => {
      const resolveSpy = vi.spyOn(pendencyService, 'resolvePendency').mockResolvedValueOnce({
        ...mockPendencies[0],
        resolved: true,
        animalIdResolved: 15,
        animalNameResolved: 'Novilha Serena',
        resolvedAt: new Date().toISOString(),
      });

      const handleResolved = vi.fn();
      const handleLog = vi.fn();

      render(
        <PendenciesModal
          isOpen={true}
          onClose={vi.fn()}
          corralId={1}
          pendencies={mockPendencies}
          farmAnimals={mockFarmAnimals}
          onResolved={handleResolved}
          onLogEvent={handleLog}
        />
      );

      expect(screen.getByText(/Tag UID: DEADBEEF/)).toBeInTheDocument();

      const selectAnimal = screen.getByLabelText(/Selecione o animal para vincular/);
      fireEvent.change(selectAnimal, { target: { value: '15' } });

      const submitBtn = screen.getByRole('button', { name: /Vincular e Resolver/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(resolveSpy).toHaveBeenCalledWith(101, { animalId: 15 });
        expect(handleResolved).toHaveBeenCalled();
        expect(handleLog).toHaveBeenCalledWith(
          'Pendência #101 resolvida: Tag DEADBEEF associada a "Novilha Serena".',
          'ok'
        );
      });
    });

    it('handles RFC 7807 409 Conflict when pendency is already resolved', async () => {
      vi.spyOn(pendencyService, 'resolvePendency').mockRejectedValueOnce(
        new ApiError({
          type: 'about:blank',
          title: 'Conflict',
          status: 409,
          detail: 'Esta pendência de identificação já foi resolvida anteriormente.',
          instance: '/api/v1/pendencias/101/resolver',
        })
      );

      render(
        <PendenciesModal
          isOpen={true}
          onClose={vi.fn()}
          corralId={1}
          pendencies={mockPendencies}
          farmAnimals={mockFarmAnimals}
          onResolved={vi.fn()}
        />
      );

      const selectAnimal = screen.getByLabelText(/Selecione o animal para vincular/);
      fireEvent.change(selectAnimal, { target: { value: '15' } });

      const submitBtn = screen.getByRole('button', { name: /Vincular e Resolver/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(
          'Esta pendência de identificação já foi resolvida anteriormente.'
        );
      });
    });
  });

  describe('EventsTimeline', () => {
    const mockLiveEvents: AnimalEventResponseDTO[] = [
      {
        id: 1,
        corralId: 1,
        corralName: 'Curral 1',
        animalId: 10,
        animalName: 'Vaca Pintada',
        tagUid: '11223344',
        typeEvent: 'ENTROU',
        eventOrigin: 'TAG',
        instant: '2026-10-23T14:15:00',
      },
    ];

    it('renders list-events with RFID events and origin badges', () => {
      render(
        <EventsTimeline
          isLive={true}
          corralName="Curral 1"
          liveEvents={mockLiveEvents}
        />
      );

      const list = screen.getByTestId('list-events');
      expect(list).toBeInTheDocument();
      expect(screen.getByText('Vaca Pintada entrou no curral')).toBeInTheDocument();
      expect(screen.getByText('ENTROU')).toBeInTheDocument();
      expect(screen.getByText('RFID ESP32')).toBeInTheDocument();
    });
  });
});
