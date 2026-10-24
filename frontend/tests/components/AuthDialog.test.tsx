import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthDialog } from '../../src/components/dashboard/AuthDialog';
import { AuthProvider } from '../../src/context/AuthContext';
import { authService } from '../../src/services/authService';
import { ApiError } from '../../src/services/apiClient';

describe('AuthDialog Component - RFC 7807 & Form Interactivity', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  const renderWithAuth = (props: React.ComponentProps<typeof AuthDialog>) => {
    return render(
      <AuthProvider>
        <AuthDialog {...props} />
      </AuthProvider>
    );
  };

  it('renders login tab by default with required inputs and test IDs', () => {
    renderWithAuth({ isOpen: true, onClose: vi.fn() });

    expect(screen.getByTestId('auth-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('button-auth-tab-login')).toBeInTheDocument();
    expect(screen.getByTestId('button-auth-tab-register')).toBeInTheDocument();
    expect(screen.getByTestId('input-auth-email')).toBeInTheDocument();
    expect(screen.getByTestId('input-auth-password')).toBeInTheDocument();
    expect(screen.getByTestId('button-auth-submit')).toHaveTextContent('Entrar na Plataforma');

    // Campo nome não deve estar presente no modo login
    expect(screen.queryByTestId('input-auth-name')).not.toBeInTheDocument();
  });

  it('switches to register tab and shows name input', () => {
    renderWithAuth({ isOpen: true, onClose: vi.fn() });

    const tabRegister = screen.getByTestId('button-auth-tab-register');
    fireEvent.click(tabRegister);

    expect(screen.getByTestId('input-auth-name')).toBeInTheDocument();
    expect(screen.getByTestId('button-auth-submit')).toHaveTextContent('Cadastrar Produtor');
  });

  it('displays client-side validation errors when submitting empty form', async () => {
    renderWithAuth({ isOpen: true, onClose: vi.fn(), initialMode: 'register' });

    const submitBtn = screen.getByTestId('button-auth-submit');
    fireEvent.click(submitBtn);

    expect(screen.getByTestId('error-auth-name')).toHaveTextContent('O nome do produtor é obrigatório.');
    expect(screen.getByTestId('error-auth-email')).toHaveTextContent('O e-mail é obrigatório.');
    expect(screen.getByTestId('error-auth-password')).toHaveTextContent('A senha é obrigatória.');
  });

  it('displays RFC 7807 401 Credenciais Inválidas in alert-auth-error banner', async () => {
    vi.spyOn(authService, 'login').mockRejectedValueOnce(
      new ApiError({
        type: 'about:blank',
        title: 'Unauthorized',
        status: 401,
        detail: 'E-mail ou senha inválidos. Por favor, tente novamente.',
        instance: '/api/v1/auth/login',
      })
    );

    renderWithAuth({ isOpen: true, onClose: vi.fn() });

    fireEvent.change(screen.getByTestId('input-auth-email'), {
      target: { value: 'usuario@errado.com' },
    });
    fireEvent.change(screen.getByTestId('input-auth-password'), {
      target: { value: 'senha123' },
    });

    fireEvent.click(screen.getByTestId('button-auth-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('alert-auth-error')).toHaveTextContent(
        'E-mail ou senha inválidos. Por favor, tente novamente.'
      );
    });
  });

  it('displays RFC 7807 400 invalidParams field-level error messages', async () => {
    vi.spyOn(authService, 'register').mockRejectedValueOnce(
      new ApiError({
        type: 'about:blank',
        title: 'Bad Request',
        status: 400,
        detail: 'Dados cadastrais inválidos.',
        instance: '/api/v1/auth/register',
        invalidParams: {
          name: 'O nome não pode conter caracteres especiais.',
          email: 'Formato de e-mail corporativo requerido.',
          password: 'A senha deve conter ao menos um número.',
        },
      })
    );

    renderWithAuth({ isOpen: true, onClose: vi.fn(), initialMode: 'register' });

    fireEvent.change(screen.getByTestId('input-auth-name'), {
      target: { value: 'Produtor Teste' },
    });
    fireEvent.change(screen.getByTestId('input-auth-email'), {
      target: { value: 'produtor@email.com' },
    });
    fireEvent.change(screen.getByTestId('input-auth-password'), {
      target: { value: 'senhaForte1' },
    });

    fireEvent.click(screen.getByTestId('button-auth-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('error-auth-name')).toHaveTextContent(
        'O nome não pode conter caracteres especiais.'
      );
      expect(screen.getByTestId('error-auth-email')).toHaveTextContent(
        'Formato de e-mail corporativo requerido.'
      );
      expect(screen.getByTestId('error-auth-password')).toHaveTextContent(
        'A senha deve conter ao menos um número.'
      );
    });
  });

  it('displays RFC 7807 409 Conflict message on duplicate email registration', async () => {
    vi.spyOn(authService, 'register').mockRejectedValueOnce(
      new ApiError({
        type: 'about:blank',
        title: 'Conflict',
        status: 409,
        detail: 'Este e-mail já está em uso por outro produtor.',
        instance: '/api/v1/auth/register',
      })
    );

    renderWithAuth({ isOpen: true, onClose: vi.fn(), initialMode: 'register' });

    fireEvent.change(screen.getByTestId('input-auth-name'), {
      target: { value: 'Produtor Duplicado' },
    });
    fireEvent.change(screen.getByTestId('input-auth-email'), {
      target: { value: 'duplicado@email.com' },
    });
    fireEvent.change(screen.getByTestId('input-auth-password'), {
      target: { value: 'senha123' },
    });

    fireEvent.click(screen.getByTestId('button-auth-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('alert-auth-error')).toHaveTextContent(
        'Este e-mail já está em uso por outro produtor.'
      );
    });
  });

  it('calls onSuccess and onClose upon successful login', async () => {
    const handleSuccess = vi.fn();
    const handleClose = vi.fn();

    vi.spyOn(authService, 'login').mockResolvedValueOnce({
      token: 'jwt.test.token',
      userId: 42,
      name: 'João Produtor',
      email: 'joao@fazenda.com',
    });

    renderWithAuth({
      isOpen: true,
      onClose: handleClose,
      onSuccess: handleSuccess,
    });

    fireEvent.change(screen.getByTestId('input-auth-email'), {
      target: { value: 'joao@fazenda.com' },
    });
    fireEvent.change(screen.getByTestId('input-auth-password'), {
      target: { value: 'senha123' },
    });

    fireEvent.click(screen.getByTestId('button-auth-submit'));

    await waitFor(() => {
      expect(handleSuccess).toHaveBeenCalledTimes(1);
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });

  it('fills demo credentials when clicking button-quick-demo-login', () => {
    renderWithAuth({ isOpen: true, onClose: vi.fn() });

    const quickFillBtn = screen.getByTestId('button-quick-demo-login');
    expect(quickFillBtn).toBeInTheDocument();

    fireEvent.click(quickFillBtn);

    expect(screen.getByTestId('input-auth-email')).toHaveValue('produtor@fazenda.com');
    expect(screen.getByTestId('input-auth-password')).toHaveValue('senhaSegura123');
  });

  it('renders alert-backend-offline banner when isBackendOnline is false', () => {
    renderWithAuth({ isOpen: true, onClose: vi.fn(), isBackendOnline: false });

    const offlineAlert = screen.getByTestId('alert-backend-offline');
    expect(offlineAlert).toBeInTheDocument();
    expect(offlineAlert).toHaveTextContent(/Servidor Backend Offline \(porta 8080\)/i);
  });

  it('shows register suggestion when demo login fails with 401', async () => {
    vi.spyOn(authService, 'login').mockRejectedValueOnce(
      new ApiError({
        type: 'about:blank',
        title: 'Unauthorized',
        status: 401,
        detail: 'Credenciais inválidas.',
        instance: '/api/v1/auth/login',
      })
    );

    renderWithAuth({ isOpen: true, onClose: vi.fn() });

    const quickFillBtn = screen.getByTestId('button-quick-demo-login');
    fireEvent.click(quickFillBtn);

    fireEvent.click(screen.getByTestId('button-auth-submit'));

    await waitFor(() => {
      expect(screen.getByText(/Cadastrar conta de teste agora/i)).toBeInTheDocument();
    });

    // Clica para alternar e cadastrar
    fireEvent.click(screen.getByText(/Cadastrar conta de teste agora/i));

    expect(screen.getByTestId('button-auth-submit')).toHaveTextContent('Cadastrar Produtor');
    expect(screen.getByTestId('input-auth-name')).toHaveValue('Produtor Fazenda');
    expect(screen.getByTestId('input-auth-email')).toHaveValue('produtor@fazenda.com');
    expect(screen.getByTestId('input-auth-password')).toHaveValue('senhaSegura123');
  });
});
