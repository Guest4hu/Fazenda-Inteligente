import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Dashboard from '../../src/pages/dashboard';

describe('Dashboard Component - 15 Data-TestIds & Simulation Integration', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders all 15 required data-testid attributes in the DOM', () => {
    render(<Dashboard />);

    // 1. banner-esp32
    expect(screen.getByTestId('banner-esp32')).toBeInTheDocument();
    // 2. status-pump
    expect(screen.getByTestId('status-pump')).toBeInTheDocument();
    // 3. button-lavar
    expect(screen.getByTestId('button-lavar')).toBeInTheDocument();
    // 4. button-parar
    expect(screen.getByTestId('button-parar')).toBeInTheDocument();
    // 5. status-presence
    expect(screen.getByTestId('status-presence')).toBeInTheDocument();
    // 6. switch-presence
    expect(screen.getByTestId('switch-presence')).toBeInTheDocument();
    // 7. mode-manual
    expect(screen.getByTestId('mode-manual')).toBeInTheDocument();
    // 8. mode-automatico
    expect(screen.getByTestId('mode-automatico')).toBeInTheDocument();
    // 9. input-time
    expect(screen.getByTestId('input-time')).toBeInTheDocument();
    // 10. button-salvar-horario
    expect(screen.getByTestId('button-salvar-horario')).toBeInTheDocument();
    // 11. value-temp
    expect(screen.getByTestId('value-temp')).toBeInTheDocument();
    // 12. value-hum
    expect(screen.getByTestId('value-hum')).toBeInTheDocument();
    // 13. value-mq
    expect(screen.getByTestId('value-mq')).toBeInTheDocument();
    // 14. button-atualizar
    expect(screen.getByTestId('button-atualizar')).toBeInTheDocument();
    // 15. list-events
    expect(screen.getByTestId('list-events')).toBeInTheDocument();
  });

  it('toggles presence switch and updates status-presence text', () => {
    render(<Dashboard />);

    const presenceStatus = screen.getByTestId('status-presence');
    const presenceSwitch = screen.getByTestId('switch-presence');

    expect(presenceStatus).toHaveTextContent('Curral livre');

    // Clica para simular presença de animal
    fireEvent.click(presenceSwitch);
    expect(screen.getByTestId('status-presence')).toHaveTextContent('Animal detectado');

    // Clica novamente para liberar o curral
    fireEvent.click(presenceSwitch);
    expect(screen.getByTestId('status-presence')).toHaveTextContent('Curral livre');
  });

  it('prevents washing when animal is detected (Biological Lock)', () => {
    render(<Dashboard />);

    const presenceSwitch = screen.getByTestId('switch-presence');
    const buttonLavar = screen.getByTestId('button-lavar');
    const statusPump = screen.getByTestId('status-pump');

    // Ativa presença de animal
    fireEvent.click(presenceSwitch);

    // Tenta lavar
    fireEvent.click(buttonLavar);

    // A bomba continua desligada
    expect(statusPump).toHaveTextContent('Desligada (simulada)');

    // Log de recusa é adicionado à timeline
    const listEvents = screen.getByTestId('list-events');
    expect(listEvents).toHaveTextContent(/RECUSADA: animal detectado no curral/);
  });

  it('starts washing when curral is clear and stops on button-parar click', () => {
    render(<Dashboard />);

    const buttonLavar = screen.getByTestId('button-lavar');
    const buttonParar = screen.getByTestId('button-parar');
    const statusPump = screen.getByTestId('status-pump');

    expect(statusPump).toHaveTextContent('Desligada (simulada)');

    // Inicia lavagem
    fireEvent.click(buttonLavar);
    expect(statusPump).toHaveTextContent('Ligada (simulada)');

    // Interrompe lavagem
    fireEvent.click(buttonParar);
    expect(statusPump).toHaveTextContent('Desligada (simulada)');
  });

  it('stops active wash immediately if animal enters during cleaning (Safety Stop)', () => {
    render(<Dashboard />);

    const buttonLavar = screen.getByTestId('button-lavar');
    const presenceSwitch = screen.getByTestId('switch-presence');
    const statusPump = screen.getByTestId('status-pump');

    // Inicia lavagem
    fireEvent.click(buttonLavar);
    expect(statusPump).toHaveTextContent('Ligada (simulada)');

    // Animal entra no curral durante a lavagem
    fireEvent.click(presenceSwitch);

    // Bomba deve desligar imediatamente
    expect(statusPump).toHaveTextContent('Desligada (simulada)');
    const listEvents = screen.getByTestId('list-events');
    expect(listEvents).toHaveTextContent(/PARADA DE SEGURANÇA/);
  });

  it('switches operational mode between manual and automatico', () => {
    render(<Dashboard />);

    const modeManual = screen.getByTestId('mode-manual');
    const modeAuto = screen.getByTestId('mode-automatico');

    expect(modeManual).toHaveAttribute('aria-checked', 'true');
    expect(modeAuto).toHaveAttribute('aria-checked', 'false');

    // Altera para automático
    fireEvent.click(modeAuto);
    expect(modeAuto).toHaveAttribute('aria-checked', 'true');
    expect(modeManual).toHaveAttribute('aria-checked', 'false');
  });

  it('updates time input and saves scheduled time', () => {
    render(<Dashboard />);

    const inputTime = screen.getByTestId('input-time');
    const buttonSalvar = screen.getByTestId('button-salvar-horario');

    fireEvent.change(inputTime, { target: { value: '07:45' } });
    fireEvent.click(buttonSalvar);

    expect(screen.getByText(/Horário salvo: 07:45/)).toBeInTheDocument();
  });

  it('updates simulated readings when clicking button-atualizar', () => {
    render(<Dashboard />);

    const buttonAtualizar = screen.getByTestId('button-atualizar');
    fireEvent.click(buttonAtualizar);

    const listEvents = screen.getByTestId('list-events');
    expect(listEvents).toHaveTextContent('Leituras simuladas atualizadas.');
  });
});
