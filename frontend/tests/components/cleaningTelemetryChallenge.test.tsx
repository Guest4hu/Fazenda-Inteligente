/**
 * tests/components/cleaningTelemetryChallenge.test.tsx
 * Empirical Challenge Harness for Milestone 2:
 * 1. Biological safety lock (preventive block, dynamic mid-wash shutoff, alias prop, RFC 7807 409 conflict).
 * 2. Pump concurrency lock & offline ESP32 message surfaces (disabled state, backend conflict, ConnectivityBanner).
 * 3. MQTT timeout response (state: CANCELADO handling, message fallback, history styling).
 * 4. Odor chart rendering across cardinalities (0, 1, 15, 30 readings) and extreme values (0, boundary, 5000+).
 * 5. Dashboard integration of interlocks.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CleaningControl } from '../../src/components/dashboard/CleaningControl';
import { ConnectivityBanner } from '../../src/components/dashboard/ConnectivityBanner';
import { OdorChart } from '../../src/components/dashboard/OdorChart';
import Dashboard from '../../src/pages/dashboard';
import { cleanService } from '../../src/services/cleanService';
import { corralService } from '../../src/services/corralService';
import { animalService } from '../../src/services/animalService';
import { odorService } from '../../src/services/odorService';
import { pendencyService } from '../../src/services/pendencyService';
import { farmService } from '../../src/services/farmService';
import { ApiError } from '../../src/services/apiClient';
import type { OdorTelemetryResponseDTO, CleanCmdResponseDTO } from '../../src/types/api';

describe('Empirical Challenge Suite: Cleaning Interlocks & Odor Telemetry', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  // ==========================================================================
  // Section 1: Biological Safety Lock
  // ==========================================================================
  describe('1. Biological Safety Lock Challenges', () => {
    it('1.1: Blocks wash in simulated mode when hasAnimalInCorral is true and displays safety message', () => {
      const handleLog = vi.fn();
      render(
        <CleaningControl
          isLive={false}
          isSimulated={true}
          hasAnimalInCorral={true}
          onLogEvent={handleLog}
        />
      );

      const buttonLavar = screen.getByTestId('button-lavar');
      fireEvent.click(buttonLavar);

      // Verify clear safety alert message
      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent(
        'Tem uma vaca no curral neste momento, não tem como acionar a bomba de limpeza'
      );
      // Status pump must remain off
      expect(screen.getByTestId('status-pump')).toHaveTextContent('Desligada (simulada)');
      // Danger log event emitted
      expect(handleLog).toHaveBeenCalledWith(
        expect.stringContaining('Lavagem RECUSADA: animal detectado no curral'),
        'danger'
      );
    });

    it('1.2: Blocks wash in live mode client-side without calling cleanService.triggerCleaning', () => {
      const triggerSpy = vi.spyOn(cleanService, 'triggerCleaning');
      const handleLog = vi.fn();

      render(
        <CleaningControl
          isLive={true}
          isSimulated={false}
          corralId={42}
          hasAnimalInCorral={true}
          onLogEvent={handleLog}
        />
      );

      fireEvent.click(screen.getByTestId('button-lavar'));

      // Service method must NEVER be called
      expect(triggerSpy).not.toHaveBeenCalled();
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Tem uma vaca no curral neste momento, não tem como acionar a bomba de limpeza'
      );
      expect(screen.getByTestId('status-pump')).toHaveTextContent('Desligada');
    });

    it('1.3: Respects hasPresence alias prop when hasAnimalInCorral is undefined', () => {
      const triggerSpy = vi.spyOn(cleanService, 'triggerCleaning');

      render(
        <CleaningControl
          isLive={true}
          isSimulated={false}
          corralId={42}
          hasPresence={true}
        />
      );

      fireEvent.click(screen.getByTestId('button-lavar'));

      expect(triggerSpy).not.toHaveBeenCalled();
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Tem uma vaca no curral neste momento, não tem como acionar a bomba de limpeza'
      );
    });

    it('1.4: Dynamic Emergency Shutoff: Aborts active wash if animal appears mid-cycle', async () => {
      vi.useFakeTimers();
      const handleLog = vi.fn();

      const { rerender } = render(
        <CleaningControl
          isLive={false}
          isSimulated={true}
          pumpDurationSeconds={30}
          hasAnimalInCorral={false}
          onLogEvent={handleLog}
        />
      );

      // Start washing while corral is empty
      fireEvent.click(screen.getByTestId('button-lavar'));
      expect(screen.getByTestId('status-pump')).toHaveTextContent('Ligada (simulada)');

      // Advance timer by 5 seconds
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(screen.getByText(/Restam 25s/)).toBeInTheDocument();

      // Animal enters corral dynamically!
      rerender(
        <CleaningControl
          isLive={false}
          isSimulated={true}
          pumpDurationSeconds={30}
          hasAnimalInCorral={true}
          onLogEvent={handleLog}
        />
      );

      // Pump must be forcibly shut down immediately
      expect(screen.getByTestId('status-pump')).toHaveTextContent('Desligada (simulada)');
      expect(handleLog).toHaveBeenCalledWith(
        expect.stringContaining('PARADA DE SEGURANÇA: animal detectado no curral durante a lavagem! Bomba desligada.'),
        'danger'
      );

      vi.useRealTimers();
    });

    it('1.5: Surfaces backend biological lock 409 Conflict if out of sync with client', async () => {
      vi.spyOn(cleanService, 'triggerCleaning').mockRejectedValueOnce(
        new ApiError({
          type: 'about:blank',
          title: 'Conflict',
          status: 409,
          detail: 'Tem uma vaca no curral neste momento, não tem como acionar a bomba de limpeza',
          instance: '/api/v1/currais/42/limpeza',
        })
      );

      const handleLog = vi.fn();

      render(
        <CleaningControl
          isLive={true}
          isSimulated={false}
          corralId={42}
          hasAnimalInCorral={false}
          onLogEvent={handleLog}
        />
      );

      fireEvent.click(screen.getByTestId('button-lavar'));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(
          'Tem uma vaca no curral neste momento, não tem como acionar a bomba de limpeza'
        );
        expect(screen.getByTestId('status-pump')).toHaveTextContent('Desligada');
        expect(handleLog).toHaveBeenCalledWith(
          expect.stringContaining('Lavagem recusada: Tem uma vaca no curral'),
          'danger'
        );
      });
    });

    it('1.6: Dismisses conflict alert when user clicks close button', () => {
      render(
        <CleaningControl
          isLive={false}
          isSimulated={true}
          hasAnimalInCorral={true}
        />
      );

      fireEvent.click(screen.getByTestId('button-lavar'));
      expect(screen.getByRole('alert')).toBeInTheDocument();

      const closeBtn = screen.getByRole('button', { name: 'Fechar alerta' });
      fireEvent.click(closeBtn);

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Section 2: Pump Concurrency Lock & Offline ESP32 Messages
  // ==========================================================================
  describe('2. Pump Concurrency Lock & ESP32 Status Messages', () => {
    it('2.1: Disables "Lavar agora" button while pump is active', async () => {
      vi.spyOn(cleanService, 'triggerCleaning').mockResolvedValueOnce({
        id: 'cmd-active',
        corralId: 42,
        origin: 'MANUAL',
        state: 'CONCLUIDO',
        secondsDuration: 20,
        createdAt: new Date().toISOString(),
        mensagem: null,
      });

      render(
        <CleaningControl
          isLive={true}
          isSimulated={false}
          corralId={42}
          hasAnimalInCorral={false}
        />
      );

      const buttonLavar = screen.getByTestId('button-lavar');
      expect(buttonLavar).toBeEnabled();

      fireEvent.click(buttonLavar);

      await waitFor(() => {
        expect(screen.getByTestId('status-pump')).toHaveTextContent('Ligada');
        expect(buttonLavar).toBeDisabled();
      });
    });

    it('2.2: Surfaces backend pump concurrency lock (409 Conflict) gracefully', async () => {
      vi.spyOn(cleanService, 'triggerCleaning').mockRejectedValueOnce(
        new ApiError({
          type: 'about:blank',
          title: 'Conflict',
          status: 409,
          detail: 'A bomba já está em andamento para este curral',
          instance: '/api/v1/currais/42/limpeza',
        })
      );

      render(
        <CleaningControl
          isLive={true}
          isSimulated={false}
          corralId={42}
          hasAnimalInCorral={false}
        />
      );

      fireEvent.click(screen.getByTestId('button-lavar'));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(
          'A bomba já está em andamento para este curral'
        );
        expect(screen.getByTestId('status-pump')).toHaveTextContent('Desligada');
      });
    });

    it('2.3: Surfaces backend offline ESP32 message (409 Conflict)', async () => {
      vi.spyOn(cleanService, 'triggerCleaning').mockRejectedValueOnce(
        new ApiError({
          type: 'about:blank',
          title: 'Conflict',
          status: 409,
          detail: 'O dispositivo deste curral está offline. Impossível acionar a bomba de limpeza.',
          instance: '/api/v1/currais/42/limpeza',
        })
      );

      render(
        <CleaningControl
          isLive={true}
          isSimulated={false}
          corralId={42}
          hasAnimalInCorral={false}
        />
      );

      fireEvent.click(screen.getByTestId('button-lavar'));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(
          'O dispositivo deste curral está offline. Impossível acionar a bomba de limpeza.'
        );
        expect(screen.getByTestId('status-pump')).toHaveTextContent('Desligada');
      });
    });

    it('2.4: ConnectivityBanner clearly renders OFFLINE state with device name and last contact', () => {
      render(
        <ConnectivityBanner
          isLive={true}
          deviceStatus="OFFLINE"
          corralName="Curral de Engorda"
          lastSeenAt="2026-10-23T18:45:00"
        />
      );

      const banner = screen.getByTestId('banner-esp32');
      expect(banner).toHaveAttribute('role', 'alert');
      expect(banner).toHaveTextContent('ESP32 OFFLINE: O dispositivo do Curral de Engorda está sem comunicação recente.');
      expect(banner).toHaveTextContent('Último contato: 18:45:00');
    });

    it('2.5: ConnectivityBanner handles null or missing lastSeenAt gracefully without NaN/Invalid Date', () => {
      render(
        <ConnectivityBanner
          isLive={true}
          deviceStatus="OFFLINE"
          corralName="Curral 2"
          lastSeenAt={null}
        />
      );

      const banner = screen.getByTestId('banner-esp32');
      expect(banner).toHaveTextContent('Último contato: Nenhum sinal recente');
    });

    it('2.6: ConnectivityBanner clearly renders ONLINE state with MAC address', () => {
      render(
        <ConnectivityBanner
          isLive={true}
          deviceStatus="ONLINE"
          macAddress="AABBCCDDEEFF"
          lastSeenAt="2026-10-23T19:00:00"
        />
      );

      const banner = screen.getByTestId('banner-esp32');
      expect(banner).toHaveAttribute('role', 'status');
      expect(banner).toHaveTextContent('ESP32 ONLINE: Dispositivo conectado e operacional (MAC: AABBCCDDEEFF)');
    });
  });

  // ==========================================================================
  // Section 3: MQTT Timeout Response (state: CANCELADO)
  // ==========================================================================
  describe('3. MQTT Timeout Response (state: CANCELADO)', () => {
    it('3.1: Handles backend 200 OK with state: CANCELADO by presenting error alert and keeping pump off', async () => {
      vi.spyOn(cleanService, 'triggerCleaning').mockResolvedValueOnce({
        id: 'cmd-timeout-1',
        corralId: 42,
        origin: 'MANUAL',
        state: 'CANCELADO',
        secondsDuration: 20,
        createdAt: new Date().toISOString(),
        mensagem: 'Timeout MQTT: ESP32 não respondeu dentro do limite de 10s',
      });

      const handleLog = vi.fn();

      render(
        <CleaningControl
          isLive={true}
          isSimulated={false}
          corralId={42}
          hasAnimalInCorral={false}
          onLogEvent={handleLog}
        />
      );

      fireEvent.click(screen.getByTestId('button-lavar'));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(
          'Comando CANCELADO: Timeout MQTT: ESP32 não respondeu dentro do limite de 10s'
        );
        expect(screen.getByTestId('status-pump')).toHaveTextContent('Desligada');
        expect(handleLog).toHaveBeenCalledWith(
          'Falha na lavagem: Timeout MQTT: ESP32 não respondeu dentro do limite de 10s',
          'danger'
        );
      });
    });

    it('3.2: Uses fallback message when state: CANCELADO provides empty mensagem field', async () => {
      vi.spyOn(cleanService, 'triggerCleaning').mockResolvedValueOnce({
        id: 'cmd-timeout-empty',
        corralId: 42,
        origin: 'MANUAL',
        state: 'CANCELADO',
        secondsDuration: 20,
        createdAt: new Date().toISOString(),
        mensagem: null,
      });

      render(
        <CleaningControl
          isLive={true}
          isSimulated={false}
          corralId={42}
          hasAnimalInCorral={false}
        />
      );

      fireEvent.click(screen.getByTestId('button-lavar'));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(
          'Comando CANCELADO: Dispositivo não respondeu a tempo ou reportou falha'
        );
      });
    });

    it('3.3: Correctly differentiates CANCELADO vs CONCLUIDO in cleaning history table', async () => {
      const mockHistory: CleanCmdResponseDTO[] = [
        {
          id: 'hist-ok',
          corralId: 42,
          origin: 'MANUAL',
          state: 'CONCLUIDO',
          secondsDuration: 20,
          createdAt: '2026-10-23T15:00:00',
          mensagem: 'Lavagem concluída com sucesso',
        },
        {
          id: 'hist-timeout',
          corralId: 42,
          origin: 'AUTOMATICA',
          state: 'CANCELADO',
          secondsDuration: 20,
          createdAt: '2026-10-23T14:00:00',
          mensagem: 'Falha de comunicação MQTT',
        },
      ];

      vi.spyOn(cleanService, 'listCleanHistory').mockResolvedValueOnce(mockHistory);

      render(
        <CleaningControl
          isLive={true}
          isSimulated={false}
          corralId={42}
          hasAnimalInCorral={false}
        />
      );

      // Open history section
      fireEvent.click(screen.getByText('Ver Histórico de Limpezas'));

      await waitFor(() => {
        const badges = screen.getAllByText(/(CONCLUIDO|CANCELADO)/);
        expect(badges.length).toBe(2);

        const canceladoBadge = screen.getByText('CANCELADO');
        expect(canceladoBadge.className).toContain('text-destructive');
        expect(screen.getByText('Falha de comunicação MQTT')).toBeInTheDocument();

        const concluidoBadge = screen.getByText('CONCLUIDO');
        expect(concluidoBadge.className).toContain('text-primary');
        expect(screen.getByText('Lavagem concluída com sucesso')).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Section 4: Odor Chart Rendering Across Cardinalities and Extreme Values
  // ==========================================================================
  describe('4. Odor Chart Rendering (0, 1, 15, 30 readings & Extreme Values)', () => {
    it('4.1: Cardinality 0 readings in live mode renders empty state placeholder without SVG errors', () => {
      render(<OdorChart readings={[]} isLive={true} limitOdor={400} />);

      expect(screen.getByText('Sem Dados')).toBeInTheDocument();
      expect(screen.getByText('Nenhuma leitura de odor registrada ainda')).toBeInTheDocument();
      expect(screen.queryByTestId('chart-odor-svg')).not.toBeInTheDocument();
    });

    it('4.2: Cardinality 0 readings in simulated mode renders 5 simulated fallback trend points', () => {
      render(<OdorChart readings={[]} isLive={false} limitOdor={400} simulatedMqValue={450} />);

      expect(screen.getByText('Tendência Simulada')).toBeInTheDocument();
      const svg = screen.getByTestId('chart-odor-svg');
      expect(svg).toBeInTheDocument();
      const circles = svg.querySelectorAll('circle');
      expect(circles.length).toBe(5);
    });

    it('4.3: Cardinality 1 reading renders a single centered point avoiding division by zero', () => {
      const singleReading: OdorTelemetryResponseDTO[] = [
        { id: 1, corralId: 10, value: 380, instant: '2026-10-23T19:00:00' },
      ];

      render(<OdorChart readings={singleReading} isLive={true} limitOdor={400} />);

      expect(screen.getByText('1 amostras')).toBeInTheDocument();
      expect(screen.getByText('380')).toBeInTheDocument();

      const svg = screen.getByTestId('chart-odor-svg');
      expect(svg).toBeInTheDocument();

      const circles = svg.querySelectorAll('circle');
      expect(circles.length).toBe(1);

      // Verify centered position (padLeft: 45, width: 600, padRight: 20 => (600 - 45 - 20) / 2 + 45 = 312.5)
      expect(circles[0].getAttribute('cx')).toBe('312.5');

      // Verify line path does not contain NaN
      const paths = svg.querySelectorAll('path');
      paths.forEach((p) => {
        expect(p.getAttribute('d')).not.toContain('NaN');
      });

      // Hover over point to verify tooltip
      if (circles[0]) {
        fireEvent.mouseEnter(circles[0]);
        expect(screen.getByText('19:00:00')).toBeInTheDocument();
      }
    });

    it('4.4: Cardinality 15 readings sorts chronologically and renders 15 nodes', () => {
      const fifteenReadings: OdorTelemetryResponseDTO[] = Array.from({ length: 15 }, (_, i) => ({
        id: i + 1,
        corralId: 10,
        value: 300 + (i * 10), // 300 to 440
        // Mix order to stress sort logic
        instant: new Date(Date.UTC(2026, 9, 23, 10, 15 - i, 0)).toISOString(),
      }));

      render(<OdorChart readings={fifteenReadings} isLive={true} limitOdor={400} />);

      expect(screen.getByText('15 amostras')).toBeInTheDocument();

      const svg = screen.getByTestId('chart-odor-svg');
      const circles = svg.querySelectorAll('circle');
      expect(circles.length).toBe(15);

      // All paths must have valid coordinates
      const paths = svg.querySelectorAll('path');
      paths.forEach((p) => {
        expect(p.getAttribute('d')).not.toContain('NaN');
      });
    });

    it('4.5: Cardinality 30 readings (maximum API capacity) renders complete telemetry spectrum', () => {
      const thirtyReadings: OdorTelemetryResponseDTO[] = Array.from({ length: 30 }, (_, i) => ({
        id: i + 1,
        corralId: 10,
        value: 320 + Math.floor(Math.sin(i) * 60),
        instant: new Date(Date.UTC(2026, 9, 23, 12, i, 0)).toISOString(),
      }));

      render(<OdorChart readings={thirtyReadings} isLive={true} limitOdor={400} />);

      expect(screen.getByText('30 amostras')).toBeInTheDocument();

      const svg = screen.getByTestId('chart-odor-svg');
      const circles = svg.querySelectorAll('circle');
      expect(circles.length).toBe(30);

      // Verify threshold line exists
      const thresholdLine = svg.querySelector('line[stroke="#f59e0b"]');
      expect(thresholdLine).toBeInTheDocument();
    });

    it('4.6: Extreme Values: Handles 0 (sensor lower limit) without negative coordinates', () => {
      const zeroReading: OdorTelemetryResponseDTO[] = [
        { id: 1, corralId: 10, value: 0, instant: '2026-10-23T19:00:00' },
        { id: 2, corralId: 10, value: 350, instant: '2026-10-23T19:05:00' },
      ];

      render(<OdorChart readings={zeroReading} isLive={true} limitOdor={400} />);

      const svg = screen.getByTestId('chart-odor-svg');
      const circles = svg.querySelectorAll('circle');
      expect(circles.length).toBe(2);

      circles.forEach((c) => {
        const cy = parseFloat(c.getAttribute('cy') || '0');
        expect(cy).toBeGreaterThan(0);
        expect(cy).toBeLessThanOrEqual(180);
      });
    });

    it('4.7: Extreme Values: Differentiates exact threshold value and values far above limitOdor (up to 5000)', () => {
      const extremeReadings: OdorTelemetryResponseDTO[] = [
        { id: 1, corralId: 10, value: 200, instant: '2026-10-23T19:00:00' }, // normal
        { id: 2, corralId: 10, value: 400, instant: '2026-10-23T19:01:00' }, // exact limit
        { id: 3, corralId: 10, value: 1200, instant: '2026-10-23T19:02:00' }, // severe
        { id: 4, corralId: 10, value: 5000, instant: '2026-10-23T19:03:00' }, // extreme peak
      ];

      render(<OdorChart readings={extremeReadings} isLive={true} limitOdor={400} />);

      // Latest value must be 5000 and colored red (destructive)
      const latestValueDisplay = screen.getByText('5000');
      expect(latestValueDisplay.className).toContain('text-destructive');

      const svg = screen.getByTestId('chart-odor-svg');
      const circles = svg.querySelectorAll('circle');
      expect(circles.length).toBe(4);

      // Node 1 (200) should be primary
      expect(circles[0].getAttribute('class')).toContain('fill-primary');

      // Node 2 (400 - exact limit) should be destructive
      expect(circles[1].getAttribute('class')).toContain('fill-destructive');

      // Node 3 (1200) should be destructive
      expect(circles[2].getAttribute('class')).toContain('fill-destructive');

      // Node 4 (5000) should be destructive
      expect(circles[3].getAttribute('class')).toContain('fill-destructive');

      // Verify coordinate scaling does not overflow SVG bounds
      circles.forEach((c) => {
        const cy = parseFloat(c.getAttribute('cy') || '0');
        expect(cy).toBeGreaterThanOrEqual(15);
        expect(cy).toBeLessThanOrEqual(160);
      });

      // Hover over extreme point to check tooltip warning badge
      if (circles[3]) {
        fireEvent.mouseEnter(circles[3]);
        expect(screen.getByText('(Acima do Limiar)')).toBeInTheDocument();
      }
    });

    it('4.8: Loading state displays skeleton pulse placeholder', () => {
      render(<OdorChart isLoading={true} isLive={true} />);

      expect(screen.getByText('Carregando leituras de odor...')).toBeInTheDocument();
      expect(screen.queryByTestId('chart-odor-svg')).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Section 5: Dashboard End-to-End Interlock Integration
  // ==========================================================================
  describe('5. Dashboard End-to-End Interlock Integration', () => {
    it('5.1: Biological safety lock activates when presence is toggled in Dashboard', async () => {
      localStorage.setItem('curral_auth_token', 'mock-jwt-token');
      localStorage.setItem(
        'curral_auth_user',
        JSON.stringify({ id: 1, userId: 1, name: 'Admin', email: 'admin@curral.com' })
      );
      localStorage.setItem('curral_selected_farm_id', '1');
      localStorage.setItem('curral_selected_corral_id', '10');

      vi.spyOn(farmService, 'listFarms').mockResolvedValueOnce([
        { id: 1, name: 'Fazenda Modelo', createdAt: '2026-10-23T10:00:00' },
      ]);
      vi.spyOn(corralService, 'listCorrais').mockResolvedValueOnce([
        {
          id: 10,
          farmId: 1,
          name: 'Curral de Testes',
          macAddress: '240AC4000110',
          cleanTime: null,
          limitOdor: 400,
          pumpDurationSeconds: 30,
          deviceStatus: 'ONLINE',
          lastSeenAt: '2026-10-23T12:00:00',
        },
      ]);

      render(<Dashboard />);

      await waitFor(() => {
        const corralOptions = screen.getAllByText('Curral de Testes');
        expect(corralOptions.length).toBeGreaterThanOrEqual(1);
        expect(corralOptions[0]).toBeInTheDocument();
      });

      // Switch presence on
      const presenceSwitch = screen.getByTestId('switch-presence');
      fireEvent.click(presenceSwitch);

      expect(screen.getByTestId('status-presence')).toHaveTextContent('Animal detectado');

      // Attempt wash
      const buttonLavar = screen.getByTestId('button-lavar');
      fireEvent.click(buttonLavar);

      // Pump remains off
      expect(screen.getByTestId('status-pump')).toHaveTextContent('Desligada');

      // Safety alert message is visible
      expect(
        screen.getByText('Tem uma vaca no curral neste momento, não tem como acionar a bomba de limpeza')
      ).toBeInTheDocument();
    });

    it('5.2: Dynamic safety shutdown when animal enters corral during active cleaning in Dashboard', () => {
      render(<Dashboard />);

      const buttonLavar = screen.getByTestId('button-lavar');
      const presenceSwitch = screen.getByTestId('switch-presence');

      // Start wash
      fireEvent.click(buttonLavar);
      expect(screen.getByTestId('status-pump')).toHaveTextContent('Ligada (simulada)');

      // Animal detected while washing!
      fireEvent.click(presenceSwitch);

      // Pump must be forcibly shut down immediately
      expect(screen.getByTestId('status-pump')).toHaveTextContent('Desligada (simulada)');
      expect(screen.getByTestId('list-events')).toHaveTextContent(/PARADA DE SEGURANÇA/);
    });
  });
});
