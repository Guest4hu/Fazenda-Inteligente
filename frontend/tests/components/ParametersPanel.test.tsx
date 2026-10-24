import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ParametersPanel } from '../../src/components/dashboard/ParametersPanel';
import { corralService } from '../../src/services/corralService';
import { ApiError } from '../../src/services/apiClient';

describe('ParametersPanel Component - Operational Configuration & RFC 7807', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders mode controls, time input, and parameter inputs', () => {
    render(<ParametersPanel isLive={false} isSimulated={true} />);

    expect(screen.getByTestId('mode-manual')).toBeInTheDocument();
    expect(screen.getByTestId('mode-automatico')).toBeInTheDocument();
    expect(screen.getByTestId('input-time')).toBeInTheDocument();
    expect(screen.getByTestId('button-salvar-horario')).toBeInTheDocument();
    expect(screen.getByLabelText('Limiar de Odor (MQ-135)')).toBeInTheDocument();
    expect(screen.getByLabelText('Duração da Bomba (s)')).toBeInTheDocument();
  });

  it('switches operational mode and notifies onLogEvent', () => {
    const handleLog = vi.fn();
    const handleModeChange = vi.fn();

    render(
      <ParametersPanel
        isLive={false}
        isSimulated={true}
        onChangeMode={handleModeChange}
        onLogEvent={handleLog}
      />
    );

    const modeAuto = screen.getByTestId('mode-automatico');
    fireEvent.click(modeAuto);

    expect(handleModeChange).toHaveBeenCalledWith('automatico');
    expect(handleLog).toHaveBeenCalledWith('Modo automático ativado.', 'info');
  });

  it('saves daily scheduled time in simulated mode', () => {
    const handleLog = vi.fn();

    render(
      <ParametersPanel
        isLive={false}
        isSimulated={true}
        onLogEvent={handleLog}
      />
    );

    const inputTime = screen.getByTestId('input-time');
    fireEvent.change(inputTime, { target: { value: '08:15' } });

    const saveBtn = screen.getByTestId('button-salvar-horario');
    fireEvent.click(saveBtn);

    expect(screen.getByText(/Horário salvo: 08:15/)).toBeInTheDocument();
  });

  it('submits updated parameters via corralService when live', async () => {
    const updateSpy = vi.spyOn(corralService, 'updateParameters').mockResolvedValueOnce({
      id: 5,
      farmId: 1,
      name: 'Curral Principal',
      macAddress: '240AC4000110',
      cleanTime: '06:30:00',
      limitOdor: 450,
      pumpDurationSeconds: 40,
      deviceStatus: 'ONLINE',
      lastSeenAt: new Date().toISOString(),
    });

    const handleLog = vi.fn();
    const handleUpdated = vi.fn();

    render(
      <ParametersPanel
        isLive={true}
        isSimulated={false}
        corralId={5}
        corral={{
          id: 5,
          farmId: 1,
          name: 'Curral Principal',
          macAddress: '240AC4000110',
          cleanTime: '06:30:00',
          limitOdor: 400,
          pumpDurationSeconds: 30,
          deviceStatus: 'ONLINE',
          lastSeenAt: null,
        }}
        onParametersUpdated={handleUpdated}
        onLogEvent={handleLog}
      />
    );

    const odorInput = screen.getByLabelText('Limiar de Odor (MQ-135)');
    fireEvent.change(odorInput, { target: { value: '450' } });

    const durationInput = screen.getByLabelText('Duração da Bomba (s)');
    fireEvent.change(durationInput, { target: { value: '40' } });

    const saveBtn = screen.getByTestId('button-salvar-horario');
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(5, {
        cleanTime: '06:30:00',
        limitOdor: 450,
        pumpDurationSeconds: 40,
      });
      expect(handleUpdated).toHaveBeenCalled();
      expect(handleLog).toHaveBeenCalledWith(
        'Parâmetros operacionais do curral atualizados com sucesso.',
        'ok'
      );
    });
  });

  it('displays RFC 7807 400 invalidParams feedback when parameter validation fails', async () => {
    vi.spyOn(corralService, 'updateParameters').mockRejectedValueOnce(
      new ApiError({
        type: 'about:blank',
        title: 'Bad Request',
        status: 400,
        detail: 'Erro de validação nos parâmetros operacionais.',
        instance: '/api/v1/currais/5/parametros',
        invalidParams: {
          pumpDurationSeconds: 'A duração maxima da bomba e de 60 segundos',
          limitOdor: 'O limiar de odor deve ser maior que zero',
        },
      })
    );

    render(
      <ParametersPanel
        isLive={true}
        isSimulated={false}
        corralId={5}
      />
    );

    const saveBtn = screen.getByTestId('button-salvar-horario');
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(
        screen.getByText('A duração maxima da bomba e de 60 segundos')
      ).toBeInTheDocument();
      expect(
        screen.getByText('O limiar de odor deve ser maior que zero')
      ).toBeInTheDocument();
    });
  });
});
