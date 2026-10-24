/**
 * tests/components/empiricalChallengeUI.test.tsx
 *
 * M2 CHALLENGER 1 - EMPIRICAL STRESS TEST & ADVERSARIAL HARNESS
 *
 * Verifies:
 * 1. Form validation error mapping on bad registration/login inputs (client & RFC 7807).
 * 2. Farm creation with duplicate name (409 Conflict) and field validation handling.
 * 3. Rapid presence toggling (`switch-presence`) and biological safety emergency stops.
 * 4. Switching between live mode and simulated/demo fallback mode.
 * 5. Verification of all 15 `data-testid` attributes under active user interactions.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import Dashboard from '../../src/pages/dashboard';
import { AuthDialog } from '../../src/components/dashboard/AuthDialog';
import { FarmModal } from '../../src/components/dashboard/FarmModal';
import { AuthProvider, useAuth } from '../../src/context/AuthContext';
import { FarmCorralProvider, useFarmCorral } from '../../src/context/FarmCorralContext';

import { authService } from '../../src/services/authService';
import { farmService } from '../../src/services/farmService';
import { corralService } from '../../src/services/corralService';
import { animalService } from '../../src/services/animalService';
import { odorService } from '../../src/services/odorService';
import { cleanService } from '../../src/services/cleanService';
import { pendencyService } from '../../src/services/pendencyService';
import { ApiError } from '../../src/services/apiClient';

import type {
  FarmResponseDTO,
  CorralResponseDTO,
  CorralMetricsResponseDTO,
  AnimalResponseDTO,
} from '../../src/types/api';

// ============================================================================
// SUITE 1: Form Validation Error Mapping on Bad Registration / Login Inputs
// ============================================================================
describe('Challenge 1: Form Validation Error Mapping on Bad Registration/Login Inputs', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  const renderAuthModal = (props: Partial<React.ComponentProps<typeof AuthDialog>> = {}) => {
    return render(
      <AuthProvider>
        <AuthDialog isOpen={true} onClose={vi.fn()} {...props} />
      </AuthProvider>
    );
  };

  it('1.1: Blocks submission and maps client-side errors for completely empty registration inputs', async () => {
    renderAuthModal({ initialMode: 'register' });

    const submitBtn = screen.getByTestId('button-auth-submit');
    fireEvent.click(submitBtn);

    expect(screen.getByTestId('error-auth-name')).toHaveTextContent('O nome do produtor é obrigatório.');
    expect(screen.getByTestId('error-auth-email')).toHaveTextContent('O e-mail é obrigatório.');
    expect(screen.getByTestId('error-auth-password')).toHaveTextContent('A senha é obrigatória.');
  });

  it('1.2: Enforces email format validation on invalid email inputs', async () => {
    renderAuthModal({ initialMode: 'login' });

    const emailInput = screen.getByTestId('input-auth-email');
    const passwordInput = screen.getByTestId('input-auth-password');
    const submitBtn = screen.getByTestId('button-auth-submit');

    // Email com arroba mas sem domínio/TLD válido (passa no check nativo HTML5 e aciona a validação customizada React)
    fireEvent.change(emailInput, { target: { value: 'usuario@incompleto' } });
    fireEvent.change(passwordInput, { target: { value: 'senha123' } });
    fireEvent.click(submitBtn);

    expect(screen.getByTestId('error-auth-email')).toHaveTextContent('Informe um endereço de e-mail válido.');

    // Email malformado sem arroba via submissão direta do form
    const form = emailInput.closest('form')!;
    fireEvent.change(emailInput, { target: { value: 'usuario_sem_arroba' } });
    fireEvent.submit(form);
    expect(screen.getByTestId('error-auth-email')).toHaveTextContent('Informe um endereço de e-mail válido.');
  });

  it('1.3: Enforces minimum password length >= 6 characters', async () => {
    renderAuthModal({ initialMode: 'login' });

    fireEvent.change(screen.getByTestId('input-auth-email'), { target: { value: 'teste@dominio.com' } });
    fireEvent.change(screen.getByTestId('input-auth-password'), { target: { value: '12345' } }); // 5 caracteres

    fireEvent.click(screen.getByTestId('button-auth-submit'));

    expect(screen.getByTestId('error-auth-password')).toHaveTextContent('A senha deve conter no mínimo 6 caracteres.');
  });

  it('1.4: Enforces producer name length boundary checks (< 3 chars, > 100 chars)', async () => {
    renderAuthModal({ initialMode: 'register' });

    const nameInput = screen.getByTestId('input-auth-name');
    const emailInput = screen.getByTestId('input-auth-email');
    const passwordInput = screen.getByTestId('input-auth-password');
    const submitBtn = screen.getByTestId('button-auth-submit');

    fireEvent.change(emailInput, { target: { value: 'produtor@fazenda.com' } });
    fireEvent.change(passwordInput, { target: { value: 'senhaForte123' } });

    // Nome curto (< 3)
    fireEvent.change(nameInput, { target: { value: 'Zé' } });
    fireEvent.click(submitBtn);
    expect(screen.getByTestId('error-auth-name')).toHaveTextContent('O nome deve conter pelo menos 3 caracteres.');

    // Nome excessivamente longo (> 100)
    const longName = 'A'.repeat(101);
    fireEvent.change(nameInput, { target: { value: longName } });
    fireEvent.click(submitBtn);
    expect(screen.getByTestId('error-auth-name')).toHaveTextContent('O nome não pode exceder 100 caracteres.');
  });

  it('1.5: Clears field-level error messages immediately as the user edits the input', async () => {
    renderAuthModal({ initialMode: 'register' });

    const submitBtn = screen.getByTestId('button-auth-submit');
    fireEvent.click(submitBtn);

    expect(screen.getByTestId('error-auth-email')).toBeInTheDocument();

    // Digita no campo de email
    const emailInput = screen.getByTestId('input-auth-email');
    fireEvent.change(emailInput, { target: { value: 'a' } });

    expect(screen.queryByTestId('error-auth-email')).not.toBeInTheDocument();
  });

  it('1.6: Maps RFC 7807 400 Bad Request invalidParams to corresponding input error fields', async () => {
    vi.spyOn(authService, 'register').mockRejectedValueOnce(
      new ApiError({
        type: 'about:blank',
        title: 'Bad Request',
        status: 400,
        detail: 'Parâmetros inválidos.',
        instance: '/api/v1/auth/register',
        invalidParams: {
          name: 'Nome contém palavras proibidas.',
          email: 'Domínio de e-mail não corporativo.',
          password: 'Senha fraca: requer caracteres especiais.',
        },
      })
    );

    renderAuthModal({ initialMode: 'register' });

    fireEvent.change(screen.getByTestId('input-auth-name'), { target: { value: 'Carlos Silva' } });
    fireEvent.change(screen.getByTestId('input-auth-email'), { target: { value: 'carlos@gmail.com' } });
    fireEvent.change(screen.getByTestId('input-auth-password'), { target: { value: 'senha123' } });

    fireEvent.click(screen.getByTestId('button-auth-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('error-auth-name')).toHaveTextContent('Nome contém palavras proibidas.');
      expect(screen.getByTestId('error-auth-email')).toHaveTextContent('Domínio de e-mail não corporativo.');
      expect(screen.getByTestId('error-auth-password')).toHaveTextContent('Senha fraca: requer caracteres especiais.');
    });
  });

  it('1.7: Maps RFC 7807 401 Unauthorized to alert-auth-error banner', async () => {
    vi.spyOn(authService, 'login').mockRejectedValueOnce(
      new ApiError({
        type: 'about:blank',
        title: 'Unauthorized',
        status: 401,
        detail: 'Credenciais inválidas ou conta desativada.',
        instance: '/api/v1/auth/login',
      })
    );

    renderAuthModal({ initialMode: 'login' });

    fireEvent.change(screen.getByTestId('input-auth-email'), { target: { value: 'carlos@silva.com' } });
    fireEvent.change(screen.getByTestId('input-auth-password'), { target: { value: 'senhaIncorreta' } });

    fireEvent.click(screen.getByTestId('button-auth-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('alert-auth-error')).toHaveTextContent('Credenciais inválidas ou conta desativada.');
    });
  });

  it('1.8: Maps RFC 7807 409 Conflict to alert-auth-error banner on duplicate registration', async () => {
    vi.spyOn(authService, 'register').mockRejectedValueOnce(
      new ApiError({
        type: 'about:blank',
        title: 'Conflict',
        status: 409,
        detail: 'Já existe um produtor registrado com este e-mail.',
        instance: '/api/v1/auth/register',
      })
    );

    renderAuthModal({ initialMode: 'register' });

    fireEvent.change(screen.getByTestId('input-auth-name'), { target: { value: 'Carlos Silva' } });
    fireEvent.change(screen.getByTestId('input-auth-email'), { target: { value: 'carlos@silva.com' } });
    fireEvent.change(screen.getByTestId('input-auth-password'), { target: { value: 'senha123' } });

    fireEvent.click(screen.getByTestId('button-auth-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('alert-auth-error')).toHaveTextContent('Já existe um produtor registrado com este e-mail.');
    });
  });

  it('1.9: Handles non-RFC 7807 network errors gracefully in alert banner without crashing', async () => {
    vi.spyOn(authService, 'login').mockRejectedValueOnce(new Error('Network error: Failed to fetch'));

    renderAuthModal({ initialMode: 'login' });

    fireEvent.change(screen.getByTestId('input-auth-email'), { target: { value: 'carlos@silva.com' } });
    fireEvent.change(screen.getByTestId('input-auth-password'), { target: { value: 'senha123' } });

    fireEvent.click(screen.getByTestId('button-auth-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('alert-auth-error')).toHaveTextContent('Network error: Failed to fetch');
    });
  });
});

// ============================================================================
// SUITE 2: Farm Creation with Duplicate Name (409) and Validation Handling
// ============================================================================
describe('Challenge 2: Farm Creation with Duplicate Name (409) & Validation Handling', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  const renderFarmModal = (props: Partial<React.ComponentProps<typeof FarmModal>> = {}) => {
    return render(
      <AuthProvider>
        <FarmCorralProvider>
          <FarmModal isOpen={true} onClose={vi.fn()} {...props} />
        </FarmCorralProvider>
      </AuthProvider>
    );
  };

  it('2.1: Enforces client-side validation on empty, too short, and excessively long farm names', async () => {
    renderFarmModal();

    const submitBtn = screen.getByTestId('button-farm-submit');
    const inputName = screen.getByTestId('input-farm-name');

    // Vazio
    fireEvent.click(submitBtn);
    expect(screen.getByTestId('error-farm-name')).toHaveTextContent('O nome da fazenda é obrigatório.');

    // 1 caractere
    fireEvent.change(inputName, { target: { value: 'A' } });
    fireEvent.click(submitBtn);
    expect(screen.getByTestId('error-farm-name')).toHaveTextContent('O nome da fazenda deve ter pelo menos 2 caracteres.');

    // > 100 caracteres
    fireEvent.change(inputName, { target: { value: 'X'.repeat(101) } });
    fireEvent.click(submitBtn);
    expect(screen.getByTestId('error-farm-name')).toHaveTextContent('O nome da fazenda não pode exceder 100 caracteres.');
  });

  it('2.2: Catches RFC 7807 409 Conflict for duplicate farm name and displays alert-farm-error', async () => {
    vi.spyOn(farmService, 'createFarm').mockRejectedValueOnce(
      new ApiError({
        type: 'about:blank',
        title: 'Conflict',
        status: 409,
        detail: 'Você já possui uma fazenda com o nome "Fazenda Bela Vista".',
        instance: '/api/v1/farms',
      })
    );

    renderFarmModal();

    fireEvent.change(screen.getByTestId('input-farm-name'), {
      target: { value: 'Fazenda Bela Vista' },
    });
    fireEvent.click(screen.getByTestId('button-farm-submit'));

    await waitFor(() => {
      const alert = screen.getByTestId('alert-farm-error');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent('Você já possui uma fazenda com o nome "Fazenda Bela Vista".');
    });
  });

  it('2.3: Catches RFC 7807 400 Bad Request with invalidParams.name in FarmModal', async () => {
    vi.spyOn(farmService, 'createFarm').mockRejectedValueOnce(
      new ApiError({
        type: 'about:blank',
        title: 'Bad Request',
        status: 400,
        detail: 'Dados inválidos.',
        instance: '/api/v1/farms',
        invalidParams: {
          name: 'O nome da fazenda não pode conter caracteres numéricos isolados.',
        },
      })
    );

    renderFarmModal();

    fireEvent.change(screen.getByTestId('input-farm-name'), {
      target: { value: '12345' },
    });
    fireEvent.click(screen.getByTestId('button-farm-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('error-farm-name')).toHaveTextContent(
        'O nome da fazenda não pode conter caracteres numéricos isolados.'
      );
    });
  });

  it('2.4: Clears error banners in FarmModal when the user modifies input text', async () => {
    vi.spyOn(farmService, 'createFarm').mockRejectedValueOnce(
      new ApiError({
        type: 'about:blank',
        title: 'Conflict',
        status: 409,
        detail: 'Fazenda duplicada.',
        instance: '/api/v1/farms',
      })
    );

    renderFarmModal();

    const inputName = screen.getByTestId('input-farm-name');
    fireEvent.change(inputName, { target: { value: 'Fazenda Repetida' } });
    fireEvent.click(screen.getByTestId('button-farm-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('alert-farm-error')).toBeInTheDocument();
    });

    // Usuário altera o texto
    fireEvent.change(inputName, { target: { value: 'Fazenda Nova' } });
    expect(screen.queryByTestId('alert-farm-error')).not.toBeInTheDocument();
  });

  it('2.5: Cancels and closes FarmModal upon clicking close or cancel buttons', () => {
    const handleClose = vi.fn();
    renderFarmModal({ onClose: handleClose });

    fireEvent.click(screen.getByTestId('button-farm-cancel'));
    expect(handleClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('button-farm-close'));
    expect(handleClose).toHaveBeenCalledTimes(2);
  });
});

// ============================================================================
// SUITE 3: Rapid Presence Toggling (`switch-presence`) & Biological Safety
// ============================================================================
describe('Challenge 3: Rapid Presence Toggling & Biological Safety Locks', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('3.1: Accurately toggles presence status and aria-checked on single clicks', () => {
    render(<Dashboard />);

    const presenceStatus = screen.getByTestId('status-presence');
    const presenceSwitch = screen.getByTestId('switch-presence');

    expect(presenceStatus).toHaveTextContent('Curral livre');
    expect(presenceSwitch).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(presenceSwitch);
    expect(screen.getByTestId('status-presence')).toHaveTextContent('Animal detectado');
    expect(screen.getByTestId('switch-presence')).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(presenceSwitch);
    expect(screen.getByTestId('status-presence')).toHaveTextContent('Curral livre');
    expect(screen.getByTestId('switch-presence')).toHaveAttribute('aria-checked', 'false');
  });

  it('3.2: Rapid multi-toggle burst maintains deterministic state without desync', () => {
    render(<Dashboard />);

    const presenceSwitch = screen.getByTestId('switch-presence');

    // 10 cliques rápidos consecutivos (número par -> deve terminar em Curral livre)
    for (let i = 0; i < 10; i++) {
      fireEvent.click(presenceSwitch);
    }

    expect(screen.getByTestId('status-presence')).toHaveTextContent('Curral livre');
    expect(screen.getByTestId('switch-presence')).toHaveAttribute('aria-checked', 'false');

    // 5 cliques rápidos adicionais (número ímpar -> deve terminar em Animal detectado)
    for (let i = 0; i < 5; i++) {
      fireEvent.click(presenceSwitch);
    }

    expect(screen.getByTestId('status-presence')).toHaveTextContent('Animal detectado');
    expect(screen.getByTestId('switch-presence')).toHaveAttribute('aria-checked', 'true');
  });

  it('3.3: Emergency stop shuts down wash on presence detection and NEVER auto-restarts upon subsequent rapid toggles', () => {
    render(<Dashboard />);

    const buttonLavar = screen.getByTestId('button-lavar');
    const presenceSwitch = screen.getByTestId('switch-presence');
    const statusPump = screen.getByTestId('status-pump');

    // 1. Inicia lavagem
    fireEvent.click(buttonLavar);
    expect(statusPump).toHaveTextContent('Ligada (simulada)');

    // 2. Animal entra -> Parada de Segurança imediata
    fireEvent.click(presenceSwitch);
    expect(statusPump).toHaveTextContent('Desligada (simulada)');
    expect(screen.getByTestId('list-events')).toHaveTextContent(/PARADA DE SEGURANÇA/);

    // 3. Animal sai (desliga presença) -> A bomba NÃO DEVE religar automaticamente!
    fireEvent.click(presenceSwitch);
    expect(statusPump).toHaveTextContent('Desligada (simulada)');

    // 4. Múltiplos toggles rápidos não reiniciam a bomba
    fireEvent.click(presenceSwitch);
    fireEvent.click(presenceSwitch);
    expect(statusPump).toHaveTextContent('Desligada (simulada)');
  });

  it('3.4: Biological Lock rejects repeated wash requests while animal presence is detected', () => {
    render(<Dashboard />);

    const buttonLavar = screen.getByTestId('button-lavar');
    const presenceSwitch = screen.getByTestId('switch-presence');
    const statusPump = screen.getByTestId('status-pump');

    // Ativa presença de animal
    fireEvent.click(presenceSwitch);
    expect(screen.getByTestId('status-presence')).toHaveTextContent('Animal detectado');

    // Spam de 5 tentativas de ligar a bomba
    for (let i = 0; i < 5; i++) {
      fireEvent.click(buttonLavar);
    }

    // A bomba permaneceu desligada
    expect(statusPump).toHaveTextContent('Desligada (simulada)');
    expect(screen.getByTestId('list-events')).toHaveTextContent(/RECUSADA: animal detectado no curral/);
  });

  it('3.5: Wash succeeds normally once curral is freed after presence was detected', () => {
    render(<Dashboard />);

    const buttonLavar = screen.getByTestId('button-lavar');
    const presenceSwitch = screen.getByTestId('switch-presence');
    const statusPump = screen.getByTestId('status-pump');

    // Ativa presença -> bloqueio
    fireEvent.click(presenceSwitch);
    fireEvent.click(buttonLavar);
    expect(statusPump).toHaveTextContent('Desligada (simulada)');

    // Libera o curral
    fireEvent.click(presenceSwitch);
    expect(screen.getByTestId('status-presence')).toHaveTextContent('Curral livre');

    // Agora lavar deve funcionar
    fireEvent.click(buttonLavar);
    expect(statusPump).toHaveTextContent('Ligada (simulada)');
  });
});

// ============================================================================
// SUITE 4: Switching Between Live Mode and Simulated / Demo Fallback Mode
// ============================================================================
describe('Challenge 4: Switching Between Live Mode and Simulated/Demo Fallback Mode', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  const mockFarm: FarmResponseDTO = {
    id: 101,
    name: 'Fazenda Modelo Live',
    createdAt: '2026-10-23T10:00:00',
  };

  const mockCorralOnline: CorralResponseDTO = {
    id: 201,
    farmId: 101,
    name: 'Curral Conectado ESP32',
    macAddress: '240AC4000199',
    cleanTime: '08:00:00',
    limitOdor: 450,
    pumpDurationSeconds: 25,
    deviceStatus: 'ONLINE',
    lastSeenAt: '2026-10-23T12:00:00',
  };

  const mockMetrics: CorralMetricsResponseDTO = {
    corralId: 201,
    corralName: 'Curral Conectado ESP32',
    farmId: 101,
    farmName: 'Fazenda Modelo Live',
    deviceStatus: 'ONLINE',
    lastSeenAt: '2026-10-23T12:00:00',
    totalAnimaisNoCurral: 3,
    totalAnimaisNaFazenda: 10,
    limpezasHojeTotal: 2,
    limpezasHojeManual: 1,
    limpezasHojeOdor: 1,
    limpezasHojeAutomatica: 0,
    pendenciasAbertas: 0,
  };

  it('4.1: Starts in simulated fallback mode when unauthenticated, with appropriate banner and pump status', () => {
    render(<Dashboard />);

    // Banner esp32 indica modo simulado
    expect(screen.getByTestId('banner-esp32')).toHaveTextContent(
      'Não conectado ao ESP32. Tudo aqui é simulado: nenhuma bomba real é controlada.'
    );

    // Status da bomba indica modo simulado
    expect(screen.getByTestId('status-pump')).toHaveTextContent('Desligada (simulada)');

    // Botão atualizar exibe texto de simulação
    expect(screen.getByTestId('button-atualizar')).toHaveTextContent('Atualizar leituras simuladas');
  });

  it('4.2: Transitions cleanly into Live Mode when authenticated with active Corral', async () => {
    // Simula autenticação no localStorage e serviços
    localStorage.setItem('curral_auth_token', 'jwt.valid.token');
    localStorage.setItem(
      'curral_auth_user',
      JSON.stringify({ id: 1, userId: 1, name: 'Produtor Ao Vivo', email: 'produtor@live.com' })
    );
    localStorage.setItem('curral_selected_farm_id', '101');
    localStorage.setItem('curral_selected_corral_id', '201');

    vi.spyOn(farmService, 'listFarms').mockResolvedValue([mockFarm]);
    vi.spyOn(corralService, 'listCorrais').mockResolvedValue([mockCorralOnline]);
    vi.spyOn(corralService, 'getMetrics').mockResolvedValue(mockMetrics);
    vi.spyOn(odorService, 'getOdorReadings').mockResolvedValue([]);
    vi.spyOn(animalService, 'listAnimals').mockResolvedValue([]);
    vi.spyOn(animalService, 'listEvents').mockResolvedValue([]);
    vi.spyOn(pendencyService, 'listPendencies').mockResolvedValue([]);
    vi.spyOn(cleanService, 'listCleanHistory').mockResolvedValue([]);

    render(<Dashboard />);

    // Aguarda sincronização ao vivo
    await waitFor(() => {
      // Banner ESP32 deve exibir status ONLINE do dispositivo
      expect(screen.getByTestId('banner-esp32')).toHaveTextContent(/ESP32 ONLINE/);
      expect(screen.getByTestId('banner-esp32')).toHaveTextContent('240AC4000199');

      // Status da bomba deve refletir hardware sem sufixo simulado
      expect(screen.getByTestId('status-pump')).toHaveTextContent('Desligada');
      expect(screen.getByTestId('status-pump')).not.toHaveTextContent('(simulada)');

      // Botão atualizar exibe texto real
      expect(screen.getByTestId('button-atualizar')).toHaveTextContent('Atualizar leituras');

      // Métricas consolidadas ao vivo são renderizadas
      expect(screen.getByText('3 / 10')).toBeInTheDocument(); // Ocupação
    });
  });

  it('4.3: Transitions safely back to simulated mode when user logs out without crashes', async () => {
    localStorage.setItem('curral_auth_token', 'jwt.valid.token');
    localStorage.setItem(
      'curral_auth_user',
      JSON.stringify({ id: 1, userId: 1, name: 'Produtor Ao Vivo', email: 'produtor@live.com' })
    );
    localStorage.setItem('curral_selected_farm_id', '101');
    localStorage.setItem('curral_selected_corral_id', '201');

    vi.spyOn(farmService, 'listFarms').mockResolvedValue([mockFarm]);
    vi.spyOn(corralService, 'listCorrais').mockResolvedValue([mockCorralOnline]);
    vi.spyOn(corralService, 'getMetrics').mockResolvedValue(mockMetrics);

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByTestId('banner-esp32')).toHaveTextContent(/ESP32 ONLINE/);
    });

    // Clica no botão de logout no Header
    const logoutBtn = screen.getByTestId('button-logout');
    fireEvent.click(logoutBtn);

    // Reverte para banner simulado e bomba simulada
    await waitFor(() => {
      expect(screen.getByTestId('banner-esp32')).toHaveTextContent(
        'Não conectado ao ESP32. Tudo aqui é simulado: nenhuma bomba real é controlada.'
      );
      expect(screen.getByTestId('status-pump')).toHaveTextContent('Desligada (simulada)');
    });
  });
});

// ============================================================================
// SUITE 5: Verification of All 15 `data-testid` Attributes Under User Interactions
// ============================================================================
describe('Challenge 5: Verification of All 15 `data-testid` Attributes Under User Interactions', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('5.1: All 15 data-testid attributes are mounted and respond to interactive events', async () => {
    render(<Dashboard />);

    // 1. banner-esp32
    const banner = screen.getByTestId('banner-esp32');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent(/Não conectado ao ESP32/);

    // 2. status-pump
    const statusPump = screen.getByTestId('status-pump');
    expect(statusPump).toHaveTextContent('Desligada (simulada)');

    // 3. button-lavar
    const buttonLavar = screen.getByTestId('button-lavar');
    expect(buttonLavar).toBeInTheDocument();
    expect(buttonLavar).not.toBeDisabled();

    // 4. button-parar
    const buttonParar = screen.getByTestId('button-parar');
    expect(buttonParar).toBeInTheDocument();

    // 5. status-presence
    const statusPresence = screen.getByTestId('status-presence');
    expect(statusPresence).toHaveTextContent('Curral livre');

    // 6. switch-presence
    const switchPresence = screen.getByTestId('switch-presence');
    expect(switchPresence).toHaveAttribute('aria-checked', 'false');

    // Interação 1: Ligar lavagem e parar
    fireEvent.click(buttonLavar);
    expect(screen.getByTestId('status-pump')).toHaveTextContent('Ligada (simulada)');
    expect(buttonLavar).toBeDisabled();

    fireEvent.click(buttonParar);
    expect(screen.getByTestId('status-pump')).toHaveTextContent('Desligada (simulada)');
    expect(buttonLavar).not.toBeDisabled();

    // Interação 2: Alternar presença
    fireEvent.click(switchPresence);
    expect(screen.getByTestId('status-presence')).toHaveTextContent('Animal detectado');
    expect(screen.getByTestId('switch-presence')).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(switchPresence);
    expect(screen.getByTestId('status-presence')).toHaveTextContent('Curral livre');
    expect(screen.getByTestId('switch-presence')).toHaveAttribute('aria-checked', 'false');

    // 7. mode-manual
    const modeManual = screen.getByTestId('mode-manual');
    expect(modeManual).toHaveAttribute('aria-checked', 'true');

    // 8. mode-automatico
    const modeAuto = screen.getByTestId('mode-automatico');
    expect(modeAuto).toHaveAttribute('aria-checked', 'false');

    // Interação 3: Alternar modo para automático
    fireEvent.click(modeAuto);
    expect(modeAuto).toHaveAttribute('aria-checked', 'true');
    expect(modeManual).toHaveAttribute('aria-checked', 'false');

    // 9. input-time
    const inputTime = screen.getByTestId('input-time');
    expect(inputTime).not.toBeDisabled();
    fireEvent.change(inputTime, { target: { value: '09:15' } });
    expect(inputTime).toHaveValue('09:15');

    // 10. button-salvar-horario
    const buttonSalvar = screen.getByTestId('button-salvar-horario');
    fireEvent.click(buttonSalvar);
    expect(screen.getByText(/Horário salvo: 09:15/)).toBeInTheDocument();

    // 11. value-temp
    const valueTemp = screen.getByTestId('value-temp');
    expect(valueTemp).toBeInTheDocument();
    expect(valueTemp.textContent).toMatch(/\d+(\.\d+)?°C/);

    // 12. value-hum
    const valueHum = screen.getByTestId('value-hum');
    expect(valueHum).toBeInTheDocument();
    expect(valueHum.textContent).toMatch(/\d+(\.\d+)?%/);

    // 13. value-mq
    const valueMq = screen.getByTestId('value-mq');
    expect(valueMq).toBeInTheDocument();
    expect(valueMq.textContent).toMatch(/^\d+$/);

    // 14. button-atualizar
    const buttonAtualizar = screen.getByTestId('button-atualizar');
    expect(buttonAtualizar).toBeInTheDocument();
    fireEvent.click(buttonAtualizar);

    // 15. list-events
    const listEvents = screen.getByTestId('list-events');
    expect(listEvents).toBeInTheDocument();
    expect(listEvents).toHaveTextContent('Leituras simuladas atualizadas.');
    expect(listEvents).toHaveTextContent(/Horário diário salvo: 09:15/);
  });
});
