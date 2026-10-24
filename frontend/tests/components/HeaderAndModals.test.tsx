import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Header } from '../../src/components/dashboard/Header';
import { FarmModal } from '../../src/components/dashboard/FarmModal';
import { CorralModal } from '../../src/components/dashboard/CorralModal';
import { FarmCorralProvider } from '../../src/context/FarmCorralContext';
import { AuthProvider } from '../../src/context/AuthContext';
import { farmService } from '../../src/services/farmService';
import { corralService } from '../../src/services/corralService';
import { ApiError } from '../../src/services/apiClient';
import type { FarmResponseDTO, CorralResponseDTO } from '../../src/types/api';

describe('Header & Farm/Corral Modals - Tenant Administration', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  const mockFarms: FarmResponseDTO[] = [
    { id: 1, name: 'Fazenda Santa Luzia', createdAt: '2026-10-23T10:00:00' },
    { id: 2, name: 'Fazenda Esperança', createdAt: '2026-10-23T10:00:00' },
  ];

  const mockCorrais: CorralResponseDTO[] = [
    {
      id: 10,
      farmId: 1,
      name: 'Curral Norte',
      macAddress: '240AC4000110',
      cleanTime: '06:30:00',
      limitOdor: 400,
      pumpDurationSeconds: 30,
      deviceStatus: 'ONLINE',
      lastSeenAt: '2026-10-23T12:00:00',
    },
  ];

  it('renders login button when unauthenticated in Header', () => {
    const handleOpenAuth = vi.fn();

    render(
      <Header
        isAuthenticated={false}
        user={null}
        onOpenAuthModal={handleOpenAuth}
      />
    );

    const loginBtn = screen.getByTestId('button-open-login');
    expect(loginBtn).toBeInTheDocument();
    fireEvent.click(loginBtn);
    expect(handleOpenAuth).toHaveBeenCalledTimes(1);
  });

  it('renders user profile badge and logout button when authenticated in Header', () => {
    const handleLogout = vi.fn();

    render(
      <Header
        isAuthenticated={true}
        user={{ id: 1, userId: 1, name: 'Produtor Silva', email: 'silva@fazenda.com' }}
        onLogout={handleLogout}
      />
    );

    expect(screen.getByTestId('user-profile-badge')).toHaveTextContent('Produtor Silva');
    const logoutBtn = screen.getByTestId('button-logout');
    expect(logoutBtn).toBeInTheDocument();

    fireEvent.click(logoutBtn);
    expect(handleLogout).toHaveBeenCalledTimes(1);
  });

  it('renders farm and corral selector dropdowns with options', () => {
    const handleSelectFarm = vi.fn();
    const handleSelectCorral = vi.fn();

    render(
      <Header
        isAuthenticated={true}
        user={{ id: 1, name: 'Produtor Silva', email: 'silva@fazenda.com' }}
        farms={mockFarms}
        selectedFarmId={1}
        onSelectFarm={handleSelectFarm}
        corrais={mockCorrais}
        selectedCorralId={10}
        onSelectCorral={handleSelectCorral}
      />
    );

    const selectFarm = screen.getByTestId('select-farm');
    expect(selectFarm).toBeInTheDocument();
    expect(selectFarm).toHaveValue('1');

    const selectCorral = screen.getByTestId('select-corral');
    expect(selectCorral).toBeInTheDocument();
    expect(selectCorral).toHaveValue('10');

    expect(screen.getByTestId('badge-corral-status')).toHaveTextContent('ONLINE');
  });

  it('creates new farm via FarmModal and calls farmService.createFarm', async () => {
    const createSpy = vi.spyOn(farmService, 'createFarm').mockResolvedValueOnce({
      id: 3,
      name: 'Fazenda Nova Esperança',
      createdAt: new Date().toISOString(),
    });

    const handleClose = vi.fn();
    const handleSuccess = vi.fn();

    render(
      <AuthProvider>
        <FarmCorralProvider>
          <FarmModal isOpen={true} onClose={handleClose} onSuccess={handleSuccess} />
        </FarmCorralProvider>
      </AuthProvider>
    );

    expect(screen.getByTestId('modal-farm')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('input-farm-name'), {
      target: { value: 'Fazenda Nova Esperança' },
    });

    fireEvent.click(screen.getByTestId('button-farm-submit'));

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith({ name: 'Fazenda Nova Esperança' });
      expect(handleSuccess).toHaveBeenCalled();
      expect(handleClose).toHaveBeenCalled();
    });
  });

  it('creates new corral via CorralModal with sanitized MAC address', async () => {
    const createSpy = vi.spyOn(corralService, 'createCorral').mockResolvedValueOnce({
      id: 11,
      farmId: 1,
      name: 'Curral Sul',
      macAddress: '240AC4000120',
      cleanTime: '07:00:00',
      limitOdor: 400,
      pumpDurationSeconds: 30,
      deviceStatus: 'OFFLINE',
      lastSeenAt: null,
    });

    const handleClose = vi.fn();
    const handleSuccess = vi.fn();

    render(
      <AuthProvider>
        <FarmCorralProvider>
          <CorralModal
            isOpen={true}
            farmId={1}
            onClose={handleClose}
            onSuccess={handleSuccess}
          />
        </FarmCorralProvider>
      </AuthProvider>
    );

    expect(screen.getByTestId('modal-corral')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('input-corral-name'), {
      target: { value: 'Curral Sul' },
    });
    // Entra com MAC formatado com dois pontos (deve ser sanitizado para 12 hex)
    fireEvent.change(screen.getByTestId('input-corral-mac'), {
      target: { value: '24:0A:C4:00:01:20' },
    });
    fireEvent.change(screen.getByTestId('input-corral-time'), {
      target: { value: '07:00' },
    });

    fireEvent.click(screen.getByTestId('button-corral-submit'));

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith(1, {
        name: 'Curral Sul',
        macAddress: '240AC4000120',
        cleanTime: '07:00:00',
        limitOdor: 400,
        pumpDurationSeconds: 30,
      });
      expect(handleSuccess).toHaveBeenCalled();
      expect(handleClose).toHaveBeenCalled();
    });
  });

  it('displays RFC 7807 409 Conflict error in CorralModal when MAC is already in use', async () => {
    vi.spyOn(corralService, 'createCorral').mockRejectedValueOnce(
      new ApiError({
        type: 'about:blank',
        title: 'Conflict',
        status: 409,
        detail: 'MAC Address já cadastrado em outro curral.',
        instance: '/api/v1/farms/1/currais',
      })
    );

    render(
      <AuthProvider>
        <FarmCorralProvider>
          <CorralModal isOpen={true} farmId={1} onClose={vi.fn()} />
        </FarmCorralProvider>
      </AuthProvider>
    );

    fireEvent.change(screen.getByTestId('input-corral-name'), {
      target: { value: 'Curral Duplicado' },
    });
    fireEvent.change(screen.getByTestId('input-corral-mac'), {
      target: { value: '240AC4000110' },
    });

    fireEvent.click(screen.getByTestId('button-corral-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('alert-corral-error')).toHaveTextContent(
        'MAC Address já cadastrado em outro curral.'
      );
    });
  });

  it('preenche MAC padrão Wokwi ao clicar no botão de atalho', () => {
    render(
      <AuthProvider>
        <FarmCorralProvider>
          <CorralModal isOpen={true} farmId={1} onClose={vi.fn()} />
        </FarmCorralProvider>
      </AuthProvider>
    );

    const wokwiBtn = screen.getByRole('button', { name: /Preencher Wokwi/i });
    expect(wokwiBtn).toBeInTheDocument();
    fireEvent.click(wokwiBtn);

    expect(screen.getByTestId('input-corral-mac')).toHaveValue('240AC4000110');
  });

  it('exibe pílula de status do Backend API quando isBackendOnline é fornecido', () => {
    const { rerender } = render(
      <Header isAuthenticated={false} isBackendOnline={true} />
    );

    expect(screen.getByText('API: Online')).toBeInTheDocument();

    rerender(<Header isAuthenticated={false} isBackendOnline={false} />);
    expect(screen.getByText('API: Offline')).toBeInTheDocument();
  });

  it('exibe guia de onboarding para criar fazenda quando autenticado sem fazendas', () => {
    render(
      <Header
        isAuthenticated={true}
        user={{ id: 1, name: 'Produtor Novo', email: 'novo@fazenda.com' }}
        farms={[]}
      />
    );

    expect(screen.getByText(/Você ainda não possui fazendas cadastradas/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Criar Fazenda' })).toBeInTheDocument();
  });
});
