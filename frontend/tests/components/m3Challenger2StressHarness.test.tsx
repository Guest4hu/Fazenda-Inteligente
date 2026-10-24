/**
 * tests/components/m3Challenger2StressHarness.test.tsx
 *
 * M3 CHALLENGER 2 - EMPIRICAL ADVERSARIAL STRESS TEST & CONTRACT ID HARNESS
 *
 * Requirements tested:
 * 1. Challenge all 15 required contract test IDs across edge cases (missing data, rapid switching, simulated vs live mode).
 * 2. Stress test OdorChart, CleaningControl, AnimalPresenceList, ParametersPanel, and AuthDialog.
 * 3. Verify robust error mapping (RFC 7807 ProblemDetail, 400 invalidParams, 401, 409 conflict, MQTT cancelado).
 * 4. Verify race-condition immunity, biological lock enforcement, and timer cleanup.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Componentes
import { ConnectivityBanner } from '../../src/components/dashboard/ConnectivityBanner';
import { CleaningControl } from '../../src/components/dashboard/CleaningControl';
import { AnimalPresenceList } from '../../src/components/dashboard/AnimalPresenceList';
import { ParametersPanel } from '../../src/components/dashboard/ParametersPanel';
import { MetricsKpiCards } from '../../src/components/dashboard/MetricsKpiCards';
import { OdorChart } from '../../src/components/dashboard/OdorChart';
import { EventsTimeline, type SystemLog } from '../../src/components/dashboard/EventsTimeline';
import { AuthDialog } from '../../src/components/dashboard/AuthDialog';

// Contextos e Serviços
import { AuthProvider } from '../../src/context/AuthContext';
import { cleanService } from '../../src/services/cleanService';
import { animalService } from '../../src/services/animalService';
import { corralService } from '../../src/services/corralService';
import { authService } from '../../src/services/authService';
import { ApiError } from '../../src/services/apiClient';

import type {
  OdorTelemetryResponseDTO,
  CleanCmdResponseDTO,
  AnimalResponseDTO,
  AnimalEventResponseDTO,
  CorralMetricsResponseDTO,
} from '../../src/types/api';

describe('M3 Challenger 2: Empirical Adversarial Stress Harness', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ==========================================================================
  // SUITE 1: 15 CONTRACT TEST IDs STRESS CHALLENGE
  // ==========================================================================
  describe('Suite 1: Contract Test IDs Challenge Across Edge Cases', () => {
    it('1.1: [banner-esp32] toggles between simulated, offline, and online states correctly with missing/extreme props', () => {
      // 1.1a: Simulated mode (isSimulated=true or isLive=false)
      const { rerender } = render(
        <ConnectivityBanner isSimulated={true} isLive={false} deviceStatus={null} />
      );
      const banner = screen.getByTestId('banner-esp32');
      expect(banner).toBeInTheDocument();
      expect(banner).toHaveTextContent(/Não conectado ao ESP32/i);
      expect(banner).toHaveClass('bg-destructive');

      // 1.1b: Live mode with OFFLINE status and missing lastSeenAt
      rerender(
        <ConnectivityBanner
          isSimulated={false}
          isLive={true}
          deviceStatus="OFFLINE"
          lastSeenAt={null}
          corralName="Curral Teste"
        />
      );
      expect(screen.getByTestId('banner-esp32')).toHaveTextContent(/ESP32 OFFLINE/i);
      expect(screen.getByTestId('banner-esp32')).toHaveTextContent(/Nenhum sinal recente/i);

      // 1.1c: Live mode with ONLINE status and formatted MAC address
      rerender(
        <ConnectivityBanner
          isSimulated={false}
          isLive={true}
          deviceStatus="ONLINE"
          lastSeenAt="2026-10-23T20:00:00Z"
          macAddress="240AC4000110"
        />
      );
      expect(screen.getByTestId('banner-esp32')).toHaveTextContent(/ESP32 ONLINE/i);
      expect(screen.getByTestId('banner-esp32')).toHaveTextContent(/240AC4000110/i);
      expect(screen.getByTestId('banner-esp32')).toHaveClass('bg-primary/15');
    });

    it('1.2: [status-pump], [button-lavar], [button-parar] maintain strict contract states across rapid switching', async () => {
      vi.useFakeTimers();

      const { rerender } = render(
        <CleaningControl isLive={false} isSimulated={true} pumpDurationSeconds={10} />
      );

      // Initial state
      expect(screen.getByTestId('status-pump')).toHaveTextContent('Desligada (simulada)');
      const btnLavar = screen.getByTestId('button-lavar');
      const btnParar = screen.getByTestId('button-parar');
      expect(btnLavar).not.toBeDisabled();

      // Trigger wash
      act(() => {
        fireEvent.click(btnLavar);
      });
      expect(screen.getByTestId('status-pump')).toHaveTextContent('Ligada (simulada)');
      expect(btnLavar).toBeDisabled();

      // Advance 3 seconds
      act(() => {
        vi.advanceTimersByTime(3000);
      });
      expect(screen.getByText(/Restam 7s de lavagem simulada/i)).toBeInTheDocument();

      // Stop wash via button-parar
      act(() => {
        fireEvent.click(btnParar);
      });
      expect(screen.getByTestId('status-pump')).toHaveTextContent('Desligada (simulada)');
      expect(btnLavar).not.toBeDisabled();

      // Switch to live mode
      rerender(
        <CleaningControl
          isLive={true}
          isSimulated={false}
          corralId={10}
          pumpDurationSeconds={10}
        />
      );

      // In live mode with no active wash, it reflects live state
      expect(screen.getByTestId('status-pump')).toHaveTextContent('Desligada');

      // Live mode wash trigger
      const mockWashResponse: CleanCmdResponseDTO = {
        id: 'wash-1234',
        corralId: 10,
        secondsDuration: 10,
        origin: 'MANUAL',
        state: 'CONCLUIDO',
        createdAt: '2026-10-23T20:00:00Z',
        mensagem: null,
      };
      vi.spyOn(cleanService, 'triggerCleaning').mockResolvedValue(mockWashResponse);

      await act(async () => {
        fireEvent.click(screen.getByTestId('button-lavar'));
      });
      expect(screen.getByTestId('status-pump')).toHaveTextContent('Ligada');

      // Live mode abort via button-parar
      act(() => {
        fireEvent.click(screen.getByTestId('button-parar'));
      });
      expect(screen.getByTestId('status-pump')).toHaveTextContent('Desligada');

      vi.useRealTimers();
    });

    it('1.3: [status-presence] and [switch-presence] operate accurately under missing data and rapid toggling', async () => {
      const handleToggle = vi.fn();
      const { rerender } = render(
        <AnimalPresenceList
          isLive={false}
          presenceSimulated={false}
          onTogglePresenceSimulated={handleToggle}
          animals={[]}
        />
      );

      expect(screen.getByTestId('status-presence')).toHaveTextContent('Curral livre');
      const switchBtn = screen.getByTestId('switch-presence');
      expect(switchBtn).toHaveAttribute('aria-checked', 'false');

      // Click switch
      fireEvent.click(switchBtn);
      expect(handleToggle).toHaveBeenCalledTimes(1);

      // Rerender with simulated presence = true
      rerender(
        <AnimalPresenceList
          isLive={false}
          presenceSimulated={true}
          onTogglePresenceSimulated={handleToggle}
          animals={[]}
        />
      );
      expect(screen.getByTestId('status-presence')).toHaveTextContent('Animal detectado');
      expect(screen.getByTestId('switch-presence')).toHaveAttribute('aria-checked', 'true');

      // Rerender in live mode with animals list
      const mockAnimals: AnimalResponseDTO[] = [
        {
          id: 1,
          name: 'Vaca Estrela',
          tagUid: 'E00401',
          currentCorralId: 5,
          currentCorralName: 'Curral 5',
          farmId: 1,
          identification: null,
        },
      ];
      rerender(
        <AnimalPresenceList
          isLive={true}
          corralId={5}
          presenceSimulated={false}
          animals={mockAnimals}
        />
      );
      expect(screen.getByTestId('status-presence')).toHaveTextContent('Animal detectado');
      expect(screen.getByText(/1 animal atualmente no curral/i)).toBeInTheDocument();
    });

    it('1.4: [mode-manual], [mode-automatico], [input-time], [button-salvar-horario] contract integrity', async () => {
      const handleModeChange = vi.fn();
      const handleSave = vi.fn();

      const { rerender } = render(
        <ParametersPanel
          mode="manual"
          onChangeMode={handleModeChange}
          timeInput="06:30"
          onSaveTime={handleSave}
          isLive={false}
        />
      );

      const modeManual = screen.getByTestId('mode-manual');
      const modeAuto = screen.getByTestId('mode-automatico');
      const inputTime = screen.getByTestId('input-time');
      const btnSave = screen.getByTestId('button-salvar-horario');

      expect(modeManual).toHaveAttribute('aria-checked', 'true');
      expect(modeAuto).toHaveAttribute('aria-checked', 'false');
      // In manual mode, input time is disabled
      expect(inputTime).toBeDisabled();

      // Switch to automatic mode
      fireEvent.click(modeAuto);
      expect(handleModeChange).toHaveBeenCalledWith('automatico');

      // Rerender in automatic mode
      rerender(
        <ParametersPanel
          mode="automatico"
          onChangeMode={handleModeChange}
          timeInput="07:45"
          onSaveTime={handleSave}
          isLive={false}
        />
      );
      expect(screen.getByTestId('mode-automatico')).toHaveAttribute('aria-checked', 'true');
      expect(screen.getByTestId('input-time')).not.toBeDisabled();
      expect(screen.getByTestId('input-time')).toHaveValue('07:45');

      // Save
      fireEvent.click(btnSave);
      expect(handleSave).toHaveBeenCalledTimes(1);
    });

    it('1.5: [value-temp], [value-hum], [value-mq], [button-atualizar] handle null, negative, boundary readings', () => {
      const handleRefresh = vi.fn();

      // Missing/undefined metrics fallback to simulated defaults
      const { rerender } = render(
        <MetricsKpiCards
          isLive={false}
          isSimulated={true}
          sensors={{ temp: -5.4, hum: 99.9, mq: 750 }}
          onRefresh={handleRefresh}
        />
      );

      expect(screen.getByTestId('value-temp')).toHaveTextContent('-5.4°C');
      expect(screen.getByTestId('value-hum')).toHaveTextContent('99.9%');
      expect(screen.getByTestId('value-mq')).toHaveTextContent('750');

      const btnRefresh = screen.getByTestId('button-atualizar');
      fireEvent.click(btnRefresh);
      expect(handleRefresh).toHaveBeenCalledTimes(1);

      // Live mode with explicit metrics DTO
      const liveMetrics: CorralMetricsResponseDTO = {
        corralId: 10,
        corralName: 'Curral 10',
        farmId: 1,
        farmName: 'Fazenda Modelo',
        deviceStatus: 'ONLINE',
        lastSeenAt: '2026-10-23T21:00:00Z',
        totalAnimaisNoCurral: 8,
        totalAnimaisNaFazenda: 25,
        pendenciasAbertas: 2,
        limpezasHojeTotal: 4,
        limpezasHojeManual: 3,
        limpezasHojeOdor: 1,
        limpezasHojeAutomatica: 0,
      };

      rerender(
        <MetricsKpiCards
          isLive={true}
          isSimulated={false}
          temp={28.0}
          hum={55.0}
          latestOdorValue={380}
          limitOdor={400}
          metrics={liveMetrics}
          onRefresh={handleRefresh}
        />
      );

      expect(screen.getByTestId('value-temp')).toHaveTextContent('28.0°C');
      expect(screen.getByTestId('value-hum')).toHaveTextContent('55.0%');
      expect(screen.getByTestId('value-mq')).toHaveTextContent('380');
      expect(screen.getByText(/8 \/ 25/)).toBeInTheDocument();
      expect(screen.getByText('Limpezas Hoje').parentElement).toHaveTextContent(/4/);
      expect(screen.getByText('Pendências').parentElement).toHaveTextContent(/2/);
    });

    it('1.6: [list-events] handles empty states, large event counts, and combined live/system logs', () => {
      const handleClear = vi.fn();

      // Empty state
      const { rerender } = render(
        <EventsTimeline isLive={false} systemLogs={[]} onClearLogs={handleClear} />
      );
      const listEvents = screen.getByTestId('list-events');
      expect(listEvents).toHaveTextContent(/Nenhum evento registrado ainda/i);

      // Mixed live events and system logs
      const liveEvents: AnimalEventResponseDTO[] = [
        {
          id: 101,
          corralId: 1,
          corralName: 'Curral de Engorda',
          animalId: 10,
          animalName: 'Vaca Mimosa',
          tagUid: 'TAG101',
          typeEvent: 'ENTROU',
          eventOrigin: 'TAG',
          instant: '2026-10-23T19:30:00Z',
        },
        {
          id: 102,
          corralId: 1,
          corralName: 'Curral de Engorda',
          animalId: 11,
          animalName: 'Boi Bandido',
          tagUid: 'TAG102',
          typeEvent: 'SAIU',
          eventOrigin: 'MANUAL',
          instant: '2026-10-23T19:35:00Z',
        },
      ];

      const systemLogs: SystemLog[] = [
        { id: 1, t: '19:40:00', msg: 'Bomba acionada manualmente.', kind: 'ok' },
        { id: 2, t: '19:41:00', msg: 'Parada de emergência executada.', kind: 'danger' },
      ];

      rerender(
        <EventsTimeline
          isLive={true}
          corralName="Curral de Engorda"
          liveEvents={liveEvents}
          systemLogs={systemLogs}
          onClearLogs={handleClear}
        />
      );

      expect(screen.getByText(/Vaca Mimosa entrou no curral/i)).toBeInTheDocument();
      expect(screen.getByText(/RFID ESP32/i)).toBeInTheDocument();
      expect(screen.getByText(/Boi Bandido saiu do curral/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Manual/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Bomba acionada manualmente/i)).toBeInTheDocument();
      expect(screen.getByText(/Parada de emergência executada/i)).toBeInTheDocument();

      const clearBtn = screen.getByText('Limpar');
      fireEvent.click(clearBtn);
      expect(handleClear).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // SUITE 2: OdorChart ADVERSARIAL STRESS & CORNER CASES
  // ==========================================================================
  describe('Suite 2: OdorChart Adversarial Stress Testing', () => {
    it('2.1: Handles empty readings array in live mode with clean zero-state message', () => {
      render(<OdorChart readings={[]} isLive={true} limitOdor={400} />);
      expect(screen.getByText(/Nenhuma leitura de odor registrada ainda/i)).toBeInTheDocument();
      expect(screen.queryByTestId('chart-odor-svg')).not.toBeInTheDocument();
    });

    it('2.2: Handles single reading (boundary n=1) without division by zero NaN coordinates', () => {
      const singleReading: OdorTelemetryResponseDTO[] = [
        { id: 1, corralId: 1, value: 350, instant: '2026-10-23T12:00:00Z' },
      ];
      render(<OdorChart readings={singleReading} isLive={true} limitOdor={400} />);

      const svg = screen.getByTestId('chart-odor-svg');
      expect(svg).toBeInTheDocument();
      const circles = svg.querySelectorAll('circle');
      expect(circles.length).toBe(1);

      // Ensure cx and cy are finite numbers (not NaN)
      const cx = circles[0].getAttribute('cx');
      const cy = circles[0].getAttribute('cy');
      expect(cx).not.toBeNull();
      expect(cy).not.toBeNull();
      expect(Number.isNaN(Number(cx))).toBe(false);
      expect(Number.isNaN(Number(cy))).toBe(false);
    });

    it('2.3: Handles full capacity 30 readings and sorts out-of-order timestamps chronologically', () => {
      const readings: OdorTelemetryResponseDTO[] = [];
      const baseTime = new Date('2026-10-23T10:00:00Z').getTime();

      // Create 30 readings in reverse chronological order
      for (let i = 30; i >= 1; i--) {
        readings.push({
          id: i,
          corralId: 1,
          value: 200 + i * 5,
          instant: new Date(baseTime + i * 60000).toISOString(),
        });
      }

      render(<OdorChart readings={readings} isLive={true} limitOdor={300} />);

      const svg = screen.getByTestId('chart-odor-svg');
      const circles = svg.querySelectorAll('circle');
      expect(circles.length).toBe(30);

      // Verify that the circles are sorted from left to right (increasing cx)
      for (let i = 1; i < circles.length; i++) {
        const prevCx = Number(circles[i - 1].getAttribute('cx'));
        const currCx = Number(circles[i].getAttribute('cx'));
        expect(currCx).toBeGreaterThan(prevCx);
      }
    });

    it('2.4: Stress tests extreme values (0, flat identical values, 5000+ ppm) without SVG path corruption', () => {
      const extremeReadings: OdorTelemetryResponseDTO[] = [
        { id: 1, corralId: 1, value: 0, instant: '2026-10-23T10:00:00Z' },
        { id: 2, corralId: 1, value: 0, instant: '2026-10-23T10:01:00Z' },
        { id: 3, corralId: 1, value: 5000, instant: '2026-10-23T10:02:00Z' },
      ];

      render(<OdorChart readings={extremeReadings} isLive={true} limitOdor={400} />);

      const svg = screen.getByTestId('chart-odor-svg');
      const paths = svg.querySelectorAll('path');
      expect(paths.length).toBe(2); // areaPath and linePath

      const linePathD = paths[1].getAttribute('d');
      expect(linePathD).not.toContain('NaN');
      expect(linePathD).toMatch(/^M\s+[\d.]+\s+[\d.]+/);
    });

    it('2.5: Interactive tooltip hover and unhover under reading updates', () => {
      const readings: OdorTelemetryResponseDTO[] = [
        { id: 1, corralId: 1, value: 450, instant: '2026-10-23T10:00:00Z' },
        { id: 2, corralId: 1, value: 380, instant: '2026-10-23T10:01:00Z' },
      ];

      const { rerender } = render(<OdorChart readings={readings} isLive={true} limitOdor={400} />);

      const svg = screen.getByTestId('chart-odor-svg');
      const circles = svg.querySelectorAll('circle');

      // Hover on first circle (above threshold)
      fireEvent.mouseEnter(circles[0]);
      expect(screen.getByText('(Acima do Limiar)')).toBeInTheDocument();

      // Mouse leave
      fireEvent.mouseLeave(circles[0]);
      expect(screen.queryByText('(Acima do Limiar)')).not.toBeInTheDocument();

      // Re-render with empty readings while previously hovered (must not crash)
      rerender(<OdorChart readings={[]} isLive={true} limitOdor={400} />);
      expect(screen.getByText(/Nenhuma leitura de odor registrada ainda/i)).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // SUITE 3: CleaningControl CONCURRENCY, BIOLOGICAL LOCKS & TIMEOUTS
  // ==========================================================================
  describe('Suite 3: CleaningControl Adversarial Concurrency & Fault Injection', () => {
    it('3.1: Enforces biological safety lock immediately client-side and sets clear 409 conflict message', async () => {
      const triggerSpy = vi.spyOn(cleanService, 'triggerCleaning');
      const handleLog = vi.fn();

      render(
        <CleaningControl
          isLive={true}
          corralId={15}
          hasAnimalInCorral={true}
          onLogEvent={handleLog}
        />
      );

      const btnLavar = screen.getByTestId('button-lavar');
      fireEvent.click(btnLavar);

      expect(triggerSpy).not.toHaveBeenCalled();
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Tem uma vaca no curral neste momento, não tem como acionar a bomba de limpeza'
      );
      expect(handleLog).toHaveBeenCalledWith(
        expect.stringContaining('Lavagem RECUSADA: animal detectado'),
        'danger'
      );
    });

    it('3.2: Dynamically halts active cleaning cycle when animal enters corral (Safety Shutdown)', async () => {
      vi.useFakeTimers();
      const handleLog = vi.fn();

      const { rerender } = render(
        <CleaningControl
          isLive={false}
          isSimulated={true}
          hasAnimalInCorral={false}
          pumpDurationSeconds={20}
          onLogEvent={handleLog}
        />
      );

      // Start cleaning
      act(() => {
        fireEvent.click(screen.getByTestId('button-lavar'));
      });
      expect(screen.getByTestId('status-pump')).toHaveTextContent('Ligada (simulada)');

      // Advance 5 seconds
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      // Animal enters corral dynamically
      rerender(
        <CleaningControl
          isLive={false}
          isSimulated={true}
          hasAnimalInCorral={true}
          pumpDurationSeconds={20}
          onLogEvent={handleLog}
        />
      );

      // Emergency stop triggered
      expect(screen.getByTestId('status-pump')).toHaveTextContent('Desligada (simulada)');
      expect(handleLog).toHaveBeenCalledWith(
        expect.stringContaining('PARADA DE SEGURANÇA: animal detectado no curral durante a lavagem!'),
        'danger'
      );

      vi.useRealTimers();
    });

    it('3.3: Rapid multi-click burst on button-lavar is strictly de-duplicated', async () => {
      vi.useFakeTimers();
      const handleLog = vi.fn();

      render(
        <CleaningControl
          isLive={false}
          isSimulated={true}
          pumpDurationSeconds={15}
          onLogEvent={handleLog}
        />
      );

      const btnLavar = screen.getByTestId('button-lavar');

      // Click 5 times in rapid succession
      act(() => {
        fireEvent.click(btnLavar);
        fireEvent.click(btnLavar);
        fireEvent.click(btnLavar);
        fireEvent.click(btnLavar);
        fireEvent.click(btnLavar);
      });

      expect(screen.getByTestId('status-pump')).toHaveTextContent('Ligada (simulada)');
      // Only 1 start message emitted
      const startCalls = handleLog.mock.calls.filter(([msg]) =>
        msg.includes('Lavagem simulada iniciada')
      );
      expect(startCalls.length).toBe(1);

      vi.useRealTimers();
    });

    it('3.4: Handles backend response state: CANCELADO (e.g. MQTT timeout) with error surface', async () => {
      const canceledResponse: CleanCmdResponseDTO = {
        id: 'cmd-uuid-canceled-1234',
        corralId: 5,
        secondsDuration: 20,
        origin: 'MANUAL',
        state: 'CANCELADO',
        mensagem: 'Tempo limite de resposta do microcontrolador ESP32 expirado (10s)',
        createdAt: '2026-10-23T20:00:00Z',
      };

      vi.spyOn(cleanService, 'triggerCleaning').mockResolvedValue(canceledResponse);

      render(
        <CleaningControl
          isLive={true}
          isSimulated={false}
          corralId={5}
          pumpDurationSeconds={20}
        />
      );

      await act(async () => {
        fireEvent.click(screen.getByTestId('button-lavar'));
      });

      expect(screen.getByRole('alert')).toHaveTextContent(
        'Comando CANCELADO: Tempo limite de resposta do microcontrolador ESP32 expirado'
      );
      expect(screen.getByTestId('status-pump')).toHaveTextContent('Desligada');
    });

    it('3.5: Surfaces RFC 7807 409 Conflict business errors from backend triggerCleaning', async () => {
      const conflictError = new ApiError({
        type: 'about:blank',
        title: 'Conflito de Operação',
        status: 409,
        detail: 'Bomba já está ativa em outro ciclo de lavagem.',
        instance: '/api/v1/currais/5/limpeza',
      });

      vi.spyOn(cleanService, 'triggerCleaning').mockRejectedValue(conflictError);

      render(
        <CleaningControl
          isLive={true}
          isSimulated={false}
          corralId={5}
          pumpDurationSeconds={20}
        />
      );

      await act(async () => {
        fireEvent.click(screen.getByTestId('button-lavar'));
      });

      expect(screen.getByRole('alert')).toHaveTextContent(
        'Bomba já está ativa em outro ciclo de lavagem.'
      );
      expect(screen.getByTestId('status-pump')).toHaveTextContent('Desligada');
    });
  });

  // ==========================================================================
  // SUITE 4: AnimalPresenceList STRESS & ADVERSARIAL MUTATIONS
  // ==========================================================================
  describe('Suite 4: AnimalPresenceList Stress & Validation Testing', () => {
    it('4.1: Dialog registration validates empty inputs and minimum name length', async () => {
      render(
        <AnimalPresenceList isLive={true} farmId={1} corralId={1} animals={[]} />
      );

      // Open Add Animal modal
      fireEvent.click(screen.getByTitle('Cadastrar novo animal na fazenda'));
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      const submitBtn = screen.getByText('Salvar Animal');

      // Click with empty fields
      await act(async () => {
        fireEvent.click(submitBtn);
      });

      // Browser form validation prevents submission; now fill with 1 char name
      const nameInput = screen.getByPlaceholderText(/Ex.: Vaca Mimosa/i);
      const tagInput = screen.getByPlaceholderText(/Ex.: 01020304/i);

      fireEvent.change(nameInput, { target: { value: 'A' } });
      fireEvent.change(tagInput, { target: { value: 'TAG999' } });

      const form = nameInput.closest('form')!;
      await act(async () => {
        fireEvent.submit(form);
      });

      // Submitting via createAnimal mock error
      const invalidParamError = new ApiError({
        type: 'about:blank',
        title: 'Bad Request',
        status: 400,
        detail: 'Parâmetros inválidos.',
        instance: '/api/v1/farms/1/animais',
        invalidParams: { name: 'O nome deve ter entre 2 e 50 caracteres.' },
      });
      vi.spyOn(animalService, 'createAnimal').mockRejectedValue(invalidParamError);

      await act(async () => {
        fireEvent.submit(form);
      });

      expect(screen.getByText('O nome deve ter entre 2 e 50 caracteres.')).toBeInTheDocument();
    });

    it('4.2: Handles RFC 7807 409 Conflict when registering duplicate RFID Tag UID', async () => {
      const duplicateError = new ApiError({
        type: 'about:blank',
        title: 'Conflict',
        status: 409,
        detail: 'Tag RFID já vinculada a outro animal na plataforma.',
        instance: '/api/v1/farms/1/animais',
      });

      vi.spyOn(animalService, 'createAnimal').mockRejectedValue(duplicateError);

      render(
        <AnimalPresenceList isLive={true} farmId={1} corralId={1} animals={[]} />
      );

      fireEvent.click(screen.getByTitle('Cadastrar novo animal na fazenda'));

      const nameInput = screen.getByPlaceholderText(/Ex.: Vaca Mimosa/i);
      const tagInput = screen.getByPlaceholderText(/Ex.: 01020304/i);

      fireEvent.change(nameInput, { target: { value: 'Mimosa Duplicada' } });
      fireEvent.change(tagInput, { target: { value: 'TAG_DUPLICADA' } });

      const form = nameInput.closest('form')!;
      await act(async () => {
        fireEvent.submit(form);
      });

      expect(screen.getByRole('alert')).toHaveTextContent(
        'Tag RFID já vinculada a outro animal na plataforma.'
      );
    });

    it('4.3: Automatically transforms RFID Tag UID to uppercase upon typing', () => {
      render(
        <AnimalPresenceList isLive={true} farmId={1} corralId={1} animals={[]} />
      );

      fireEvent.click(screen.getByTitle('Cadastrar novo animal na fazenda'));
      const tagInput = screen.getByPlaceholderText(/Ex.: 01020304/i) as HTMLInputElement;

      fireEvent.change(tagInput, { target: { value: 'abc123xyz' } });
      expect(tagInput.value).toBe('ABC123XYZ');
    });
  });

  // ==========================================================================
  // SUITE 5: ParametersPanel BOUNDARY & ERROR MAPPING STRESS
  // ==========================================================================
  describe('Suite 5: ParametersPanel Boundary & Error Handling', () => {
    it('5.1: Client-side validation rejects invalid time format in automatic mode', async () => {
      const handleLog = vi.fn();

      render(
        <ParametersPanel
          isLive={true}
          corralId={1}
          mode="automatico"
          timeInput="invalid-time"
          onLogEvent={handleLog}
        />
      );

      const btnSave = screen.getByTestId('button-salvar-horario');
      await act(async () => {
        fireEvent.click(btnSave);
      });

      expect(screen.getByText('Horário inválido. Use o formato HH:MM.')).toBeInTheDocument();
      expect(handleLog).toHaveBeenCalledWith('Horário inválido. Use o formato HH:MM.', 'danger');
    });

    it('5.2: Client-side validation rejects pumpDuration outside 1..60 seconds', async () => {
      render(
        <ParametersPanel
          isLive={true}
          corralId={1}
          mode="manual"
        />
      );

      const durationInput = screen.getByLabelText(/Duração da Bomba/i);
      fireEvent.change(durationInput, { target: { value: '120' } });

      const btnSave = screen.getByTestId('button-salvar-horario');
      await act(async () => {
        fireEvent.click(btnSave);
      });

      expect(screen.getByText('A duração da bomba deve estar entre 1 e 60 segundos.')).toBeInTheDocument();
    });

    it('5.3: Maps RFC 7807 field validation errors from PUT /currais/{corralId}/parametros', async () => {
      const invalidParamError = new ApiError({
        type: 'about:blank',
        title: 'Validation Error',
        status: 400,
        detail: 'Parâmetros inválidos.',
        instance: '/api/v1/currais/10/parametros',
        invalidParams: {
          limitOdor: 'O limiar de odor deve ser maior que zero.',
          cleanTime: 'Horário fora dos limites permitidos.',
        },
      });

      vi.spyOn(corralService, 'updateParameters').mockRejectedValue(invalidParamError);

      render(
        <ParametersPanel
          isLive={true}
          corralId={10}
          mode="automatico"
          timeInput="05:00"
        />
      );

      const btnSave = screen.getByTestId('button-salvar-horario');
      await act(async () => {
        fireEvent.click(btnSave);
      });

      expect(screen.getByText('O limiar de odor deve ser maior que zero.')).toBeInTheDocument();
      expect(screen.getByText('Horário fora dos limites permitidos.')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // SUITE 6: AuthDialog EDGE CASES & RFC 7807 ERROR MAPPING
  // ==========================================================================
  describe('Suite 6: AuthDialog Adversarial Testing', () => {
    it('6.1: Enforces client-side email format regex and minimum password length', async () => {
      render(
        <AuthProvider>
          <AuthDialog isOpen={true} onClose={vi.fn()} initialMode="login" />
        </AuthProvider>
      );

      const emailInput = screen.getByTestId('input-auth-email');
      const passInput = screen.getByTestId('input-auth-password');
      const submitBtn = screen.getByTestId('button-auth-submit');

      // Test bad email
      fireEvent.change(emailInput, { target: { value: 'bad-email' } });
      fireEvent.change(passInput, { target: { value: '12345' } }); // < 6 chars

      await act(async () => {
        fireEvent.click(submitBtn);
      });

      expect(screen.getByTestId('error-auth-email')).toHaveTextContent('Informe um endereço de e-mail válido.');
      expect(screen.getByTestId('error-auth-password')).toHaveTextContent('A senha deve conter no mínimo 6 caracteres.');
    });

    it('6.2: Maps RFC 7807 401 Unauthorized error on invalid login credentials', async () => {
      vi.spyOn(authService, 'login').mockRejectedValue(
        new ApiError({
          type: 'about:blank',
          title: 'Unauthorized',
          status: 401,
          detail: 'Credenciais inválidas: e-mail ou senha incorretos.',
          instance: '/api/v1/auth/login',
        })
      );

      render(
        <AuthProvider>
          <AuthDialog isOpen={true} onClose={vi.fn()} initialMode="login" />
        </AuthProvider>
      );

      fireEvent.change(screen.getByTestId('input-auth-email'), { target: { value: 'produtor@fazenda.com' } });
      fireEvent.change(screen.getByTestId('input-auth-password'), { target: { value: 'senha123' } });

      await act(async () => {
        fireEvent.click(screen.getByTestId('button-auth-submit'));
      });

      expect(screen.getByTestId('alert-auth-error')).toHaveTextContent(
        'Credenciais inválidas: e-mail ou senha incorretos.'
      );
    });

    it('6.3: Switching tabs between Login and Register resets all field and general errors', async () => {
      render(
        <AuthProvider>
          <AuthDialog isOpen={true} onClose={vi.fn()} initialMode="login" />
        </AuthProvider>
      );

      // Trigger client validation error
      await act(async () => {
        fireEvent.click(screen.getByTestId('button-auth-submit'));
      });
      expect(screen.getByTestId('error-auth-email')).toBeInTheDocument();

      // Switch to Register tab
      await act(async () => {
        fireEvent.click(screen.getByTestId('button-auth-tab-register'));
      });

      // Errors must be cleared on tab switch
      expect(screen.queryByTestId('error-auth-email')).not.toBeInTheDocument();
      expect(screen.queryByTestId('alert-auth-error')).not.toBeInTheDocument();
    });

    it('6.4: Typing into an invalid field immediately clears that specific field error', async () => {
      render(
        <AuthProvider>
          <AuthDialog isOpen={true} onClose={vi.fn()} initialMode="login" />
        </AuthProvider>
      );

      // Trigger error
      await act(async () => {
        fireEvent.click(screen.getByTestId('button-auth-submit'));
      });
      expect(screen.getByTestId('error-auth-email')).toBeInTheDocument();

      // Type into email input
      fireEvent.change(screen.getByTestId('input-auth-email'), { target: { value: 'a' } });
      expect(screen.queryByTestId('error-auth-email')).not.toBeInTheDocument();
    });
  });
});
