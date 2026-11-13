import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CleaningControl } from '../../src/components/dashboard/CleaningControl';
import { cleanService } from '../../src/services/cleanService';
import { ApiError } from '../../src/services/apiClient';

describe('CleaningControl Component - Biological Locks & Fail-Fast RFC 7807', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders initial pump status and buttons', () => {
    render(<CleaningControl isLive={false} isSimulated={true} />);

    expect(screen.getByTestId('status-pump')).toHaveTextContent('Desligada (simulada)');
    expect(screen.getByTestId('button-lavar')).toBeEnabled();
    expect(screen.getByTestId('button-parar')).toBeInTheDocument();
  });

  it('blocks washing immediately when hasAnimalInCorral is true', () => {
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

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Tem uma vaca no curral neste momento, não tem como acionar a bomba de limpeza'
    );
    expect(screen.getByTestId('status-pump')).toHaveTextContent('Desligada (simulada)');
  });

  it('triggers live cleaning via cleanService.triggerCleaning when online', async () => {
    const triggerSpy = vi.spyOn(cleanService, 'triggerCleaning').mockResolvedValueOnce({
      id: 'cmd-uuid-1234',
      corralId: 10,
      origin: 'MANUAL',
      state: 'CONCLUIDO',
      secondsDuration: 25,
      createdAt: new Date().toISOString(),
      mensagem: 'Comando executado com sucesso',
    });

    const handleLog = vi.fn();

    render(
      <CleaningControl
        isLive={true}
        isSimulated={false}
        corralId={10}
        corralName="Curral 1"
        pumpDurationSeconds={25}
        hasAnimalInCorral={false}
        onLogEvent={handleLog}
      />
    );

    expect(screen.getByTestId('status-pump')).toHaveTextContent('Desligada');

    fireEvent.click(screen.getByTestId('button-lavar'));

    await waitFor(() => {
      expect(triggerSpy).toHaveBeenCalledWith(10, {
        origin: 'MANUAL',
        secondsDuration: 25,
      });
      expect(screen.getByTestId('status-pump')).toHaveTextContent('Ligada');
    });
  });

  it('handles RFC 7807 409 Conflict from server when cleaning is refused', async () => {
    vi.spyOn(cleanService, 'triggerCleaning').mockRejectedValueOnce(
      new ApiError({
        type: 'about:blank',
        title: 'Conflict',
        status: 409,
        detail: 'A bomba já está em andamento para este curral',
        instance: '/api/v1/currais/10/limpeza',
      })
    );

    const handleLog = vi.fn();

    render(
      <CleaningControl
        isLive={true}
        isSimulated={false}
        corralId={10}
        hasAnimalInCorral={false}
        onLogEvent={handleLog}
      />
    );

    fireEvent.click(screen.getByTestId('button-lavar'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'A bomba já está em andamento para este curral'
      );
      expect(screen.getByTestId('status-pump')).toHaveTextContent('Desligada');
      expect(handleLog).toHaveBeenCalledWith(
        'Lavagem recusada: A bomba já está em andamento para este curral',
        'danger'
      );
    });
  });

  it('handles MQTT timeout CANCELADO state from backend', async () => {
    vi.spyOn(cleanService, 'triggerCleaning').mockResolvedValueOnce({
      id: 'cmd-uuid-5678',
      corralId: 10,
      origin: 'MANUAL',
      state: 'CANCELADO',
      secondsDuration: 30,
      createdAt: new Date().toISOString(),
      mensagem: 'Aviso: Dispositivo não respondeu a tempo ou reportou falha',
    });

    const handleLog = vi.fn();

    render(
      <CleaningControl
        isLive={true}
        isSimulated={false}
        corralId={10}
        hasAnimalInCorral={false}
        onLogEvent={handleLog}
      />
    );

    fireEvent.click(screen.getByTestId('button-lavar'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Comando CANCELADO: Aviso: Dispositivo não respondeu a tempo ou reportou falha'
      );
      expect(screen.getByTestId('status-pump')).toHaveTextContent('Desligada');
    });
  });

  it('fetches and displays clean history when history button is toggled', async () => {
    const listSpy = vi.spyOn(cleanService, 'listCleanHistory').mockResolvedValueOnce([
      {
        id: 'hist-1',
        corralId: 10,
        origin: 'MANUAL',
        state: 'CONCLUIDO',
        secondsDuration: 30,
        createdAt: '2026-10-23T14:30:00',
        mensagem: 'Ciclo manual finalizado',
      },
    ]);

    render(
      <CleaningControl
        isLive={true}
        isSimulated={false}
        corralId={10}
        hasAnimalInCorral={false}
      />
    );

    const historyBtn = screen.getByText('Ver Histórico de Limpezas');
    fireEvent.click(historyBtn);

    await waitFor(() => {
      expect(listSpy).toHaveBeenCalledWith(10);
      expect(screen.getByText('CONCLUIDO')).toBeInTheDocument();
      expect(screen.getByText('Ciclo manual finalizado')).toBeInTheDocument();
    });
  });

  it('displays badge-biological-lock when hasAnimalInCorral is true', () => {
    render(<CleaningControl hasAnimalInCorral={true} />);
    expect(screen.getByTestId('badge-biological-lock')).toBeInTheDocument();
    expect(screen.getByTestId('badge-biological-lock')).toHaveTextContent(/Trava Biológica Ativa/i);
  });

  it('dispatches stopCleaning when Parar button is clicked in live mode', async () => {
    vi.spyOn(cleanService, 'triggerCleaning').mockResolvedValueOnce({
      id: 'cmd-1',
      corralId: 10,
      origin: 'MANUAL',
      state: 'CONCLUIDO',
      secondsDuration: 25,
      createdAt: new Date().toISOString(),
      mensagem: 'Iniciado',
    });

    const stopSpy = vi.spyOn(cleanService, 'stopCleaning').mockResolvedValueOnce({
      id: 'stop-1',
      corralId: 10,
      origin: 'MANUAL',
      state: 'CANCELADO',
      secondsDuration: 0,
      createdAt: new Date().toISOString(),
      mensagem: 'Bomba parada e confirmada com sucesso!',
    });

    const handleLog = vi.fn();

    render(
      <CleaningControl
        isLive={true}
        isSimulated={false}
        corralId={10}
        corralName="Curral 1"
        pumpDurationSeconds={25}
        hasAnimalInCorral={false}
        onLogEvent={handleLog}
      />
    );

    // Inicia a lavagem
    fireEvent.click(screen.getByTestId('button-lavar'));

    await waitFor(() => {
      expect(screen.getByTestId('status-pump')).toHaveTextContent('Ligada');
    });

    // Clica em Parar
    fireEvent.click(screen.getByTestId('button-parar'));

    await waitFor(() => {
      expect(stopSpy).toHaveBeenCalledWith(10);
      expect(screen.getByTestId('status-pump')).toHaveTextContent('Desligada');
      expect(handleLog).toHaveBeenCalledWith(
        'Parar acionado pelo operador. Bomba DESLIGADA.',
        'warn'
      );
    });
  });

  it('dispatches stopCleaning when biological lock triggers during live wash', async () => {
    vi.spyOn(cleanService, 'triggerCleaning').mockResolvedValueOnce({
      id: 'cmd-2',
      corralId: 10,
      origin: 'MANUAL',
      state: 'CONCLUIDO',
      secondsDuration: 25,
      createdAt: new Date().toISOString(),
      mensagem: 'Iniciado',
    });

    const stopSpy = vi.spyOn(cleanService, 'stopCleaning').mockResolvedValueOnce({
      id: 'stop-2',
      corralId: 10,
      origin: 'MANUAL',
      state: 'CANCELADO',
      secondsDuration: 0,
      createdAt: new Date().toISOString(),
      mensagem: 'Bomba parada',
    });

    const { rerender } = render(
      <CleaningControl
        isLive={true}
        isSimulated={false}
        corralId={10}
        hasAnimalInCorral={false}
      />
    );

    fireEvent.click(screen.getByTestId('button-lavar'));

    await waitFor(() => {
      expect(screen.getByTestId('status-pump')).toHaveTextContent('Ligada');
    });

    // Animal entra no curral
    rerender(
      <CleaningControl
        isLive={true}
        isSimulated={false}
        corralId={10}
        hasAnimalInCorral={true}
      />
    );

    await waitFor(() => {
      expect(stopSpy).toHaveBeenCalledWith(10);
      expect(screen.getByTestId('status-pump')).toHaveTextContent('Desligada');
    });
  });

  describe('Custom Wash Duration Configuration', () => {
    it('renders input-wash-duration initialized with pumpDurationSeconds prop', () => {
      render(
        <CleaningControl
          isLive={true}
          isSimulated={false}
          corralId={10}
          pumpDurationSeconds={35}
        />
      );

      const durationInput = screen.getByTestId('input-wash-duration') as HTMLInputElement;
      expect(durationInput).toBeInTheDocument();
      expect(durationInput.value).toBe('35');
    });

    it('allows typing custom duration and sends it in triggerCleaning payload', async () => {
      const triggerSpy = vi.spyOn(cleanService, 'triggerCleaning').mockResolvedValueOnce({
        id: 'cmd-custom-1',
        corralId: 10,
        origin: 'MANUAL',
        state: 'CONCLUIDO',
        secondsDuration: 45,
        createdAt: new Date().toISOString(),
        mensagem: 'Comando executado',
      });

      render(
        <CleaningControl
          isLive={true}
          isSimulated={false}
          corralId={10}
          pumpDurationSeconds={20}
          hasAnimalInCorral={false}
        />
      );

      const durationInput = screen.getByTestId('input-wash-duration');
      fireEvent.change(durationInput, { target: { value: '45' } });
      expect((durationInput as HTMLInputElement).value).toBe('45');

      fireEvent.click(screen.getByTestId('button-lavar'));

      await waitFor(() => {
        expect(triggerSpy).toHaveBeenCalledWith(10, {
          origin: 'MANUAL',
          secondsDuration: 45,
        });
      });
    });

    it('allows clicking quick preset button to set duration and trigger clean', async () => {
      const triggerSpy = vi.spyOn(cleanService, 'triggerCleaning').mockResolvedValueOnce({
        id: 'cmd-custom-2',
        corralId: 10,
        origin: 'MANUAL',
        state: 'CONCLUIDO',
        secondsDuration: 60,
        createdAt: new Date().toISOString(),
        mensagem: 'Comando executado',
      });

      render(
        <CleaningControl
          isLive={true}
          isSimulated={false}
          corralId={10}
          pumpDurationSeconds={20}
          hasAnimalInCorral={false}
        />
      );

      const btn60 = screen.getByTestId('btn-duration-60');
      fireEvent.click(btn60);

      const durationInput = screen.getByTestId('input-wash-duration') as HTMLInputElement;
      expect(durationInput.value).toBe('60');

      fireEvent.click(screen.getByTestId('button-lavar'));

      await waitFor(() => {
        expect(triggerSpy).toHaveBeenCalledWith(10, {
          origin: 'MANUAL',
          secondsDuration: 60,
        });
      });
    });

    it('validates duration bounds (>60 or <1) and blocks wash without triggering API', async () => {
      const triggerSpy = vi.spyOn(cleanService, 'triggerCleaning');
      const handleLog = vi.fn();

      render(
        <CleaningControl
          isLive={true}
          isSimulated={false}
          corralId={10}
          hasAnimalInCorral={false}
          onLogEvent={handleLog}
        />
      );

      const durationInput = screen.getByTestId('input-wash-duration');
      fireEvent.change(durationInput, { target: { value: '75' } });

      fireEvent.click(screen.getByTestId('button-lavar'));

      await waitFor(() => {
        expect(triggerSpy).not.toHaveBeenCalled();
        expect(screen.getByRole('alert')).toHaveTextContent(
          'A duração da lavagem deve ser entre 1 e 60 segundos.'
        );
        expect(handleLog).toHaveBeenCalledWith(
          'Lavagem recusada: A duração da lavagem deve ser entre 1 e 60 segundos.',
          'danger'
        );
      });
    });

    it('passes custom duration to onStartWashSimulated in simulated mode', () => {
      const startSimMock = vi.fn();

      render(
        <CleaningControl
          isLive={false}
          isSimulated={true}
          pumpDurationSeconds={20}
          hasAnimalInCorral={false}
          onStartWashSimulated={startSimMock}
        />
      );

      const durationInput = screen.getByTestId('input-wash-duration');
      fireEvent.change(durationInput, { target: { value: '15' } });

      fireEvent.click(screen.getByTestId('button-lavar'));

      expect(startSimMock).toHaveBeenCalledWith(15);
    });

    it('disables duration input while washing is active', () => {
      render(
        <CleaningControl
          isLive={false}
          isSimulated={true}
          washingSimulated={true}
          remainingSimulated={15}
        />
      );

      const durationInput = screen.getByTestId('input-wash-duration');
      expect(durationInput).toBeDisabled();

      const btn10 = screen.getByTestId('btn-duration-10');
      expect(btn10).toBeDisabled();
    });
  });
});
