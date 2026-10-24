/**
 * tests/components/authDialogChallenge.test.tsx
 *
 * M2 CHALLENGER 1 - EMPIRICAL ADVERSARIAL CHALLENGE HARNESS
 * Target Component: src/components/dashboard/AuthDialog.tsx
 *
 * Verifies:
 * 1. Client-side email validation under diverse invalid inputs (no arroba, missing domain, spaces, malformed TLD, etc.)
 * 2. Form `<p data-testid="error-auth-email">` DOM presence on submit without browser HTML5 validation intercept (noValidate test)
 * 3. Whitespace trimming and valid input submission flow (login and register)
 * 4. Error clearing interactivity, tab switching, and RFC 7807 error handling
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthDialog } from '../../src/components/dashboard/AuthDialog';
import { AuthProvider } from '../../src/context/AuthContext';
import { authService } from '../../src/services/authService';
import { ApiError } from '../../src/services/apiClient';

describe('Adversarial Challenge: AuthDialog Client-Side Email Validation & Submission', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  const renderAuthDialog = (props: Partial<React.ComponentProps<typeof AuthDialog>> = {}) => {
    return render(
      <AuthProvider>
        <AuthDialog isOpen={true} onClose={vi.fn()} {...props} />
      </AuthProvider>
    );
  };

  // ==========================================================================
  // SUITE 1: Invalid Email Inputs & HTML5 Constraint Intercept Challenge
  // ==========================================================================
  describe('1. Email Validation under Invalid Inputs & HTML5 noValidate', () => {
    it('1.1: Form has explicit noValidate attribute to prevent browser constraint interception', () => {
      renderAuthDialog();
      const emailInput = screen.getByTestId('input-auth-email');
      const form = emailInput.closest('form');
      expect(form).not.toBeNull();
      expect(form).toHaveAttribute('noValidate');
    });

    it('1.2: Rejects email without @ (usuario_sem_arroba) and renders error-auth-email on button click', async () => {
      renderAuthDialog({ initialMode: 'login' });

      const emailInput = screen.getByTestId('input-auth-email');
      const passwordInput = screen.getByTestId('input-auth-password');
      const submitBtn = screen.getByTestId('button-auth-submit');

      fireEvent.change(emailInput, { target: { value: 'usuario_sem_arroba' } });
      fireEvent.change(passwordInput, { target: { value: 'senha123' } });
      fireEvent.click(submitBtn);

      const errorMsg = screen.getByTestId('error-auth-email');
      expect(errorMsg).toBeInTheDocument();
      expect(errorMsg).toHaveTextContent('Informe um endereço de e-mail válido.');
    });

    it('1.3: Rejects email without domain (sem_dominio@) and renders error-auth-email on button click', async () => {
      renderAuthDialog({ initialMode: 'login' });

      fireEvent.change(screen.getByTestId('input-auth-email'), { target: { value: 'sem_dominio@' } });
      fireEvent.change(screen.getByTestId('input-auth-password'), { target: { value: 'senha123' } });
      fireEvent.click(screen.getByTestId('button-auth-submit'));

      const errorMsg = screen.getByTestId('error-auth-email');
      expect(errorMsg).toBeInTheDocument();
      expect(errorMsg).toHaveTextContent('Informe um endereço de e-mail válido.');
    });

    it('1.4: Rejects email without username (@sem_usuario.com) and renders error-auth-email', async () => {
      renderAuthDialog({ initialMode: 'login' });

      fireEvent.change(screen.getByTestId('input-auth-email'), { target: { value: '@sem_usuario.com' } });
      fireEvent.change(screen.getByTestId('input-auth-password'), { target: { value: 'senha123' } });
      fireEvent.click(screen.getByTestId('button-auth-submit'));

      const errorMsg = screen.getByTestId('error-auth-email');
      expect(errorMsg).toBeInTheDocument();
      expect(errorMsg).toHaveTextContent('Informe um endereço de e-mail válido.');
    });

    it('1.5: Rejects email with empty domain name before dot (usuario@.com)', async () => {
      renderAuthDialog({ initialMode: 'login' });

      fireEvent.change(screen.getByTestId('input-auth-email'), { target: { value: 'usuario@.com' } });
      fireEvent.change(screen.getByTestId('input-auth-password'), { target: { value: 'senha123' } });
      fireEvent.click(screen.getByTestId('button-auth-submit'));

      const errorMsg = screen.getByTestId('error-auth-email');
      expect(errorMsg).toBeInTheDocument();
      expect(errorMsg).toHaveTextContent('Informe um endereço de e-mail válido.');
    });

    it('1.6: Rejects email without TLD (usuario@dominio)', async () => {
      renderAuthDialog({ initialMode: 'login' });

      fireEvent.change(screen.getByTestId('input-auth-email'), { target: { value: 'usuario@dominio' } });
      fireEvent.change(screen.getByTestId('input-auth-password'), { target: { value: 'senha123' } });
      fireEvent.click(screen.getByTestId('button-auth-submit'));

      const errorMsg = screen.getByTestId('error-auth-email');
      expect(errorMsg).toBeInTheDocument();
      expect(errorMsg).toHaveTextContent('Informe um endereço de e-mail válido.');
    });

    it('1.7: Rejects email with whitespace in middle (usuario @dominio.com)', async () => {
      renderAuthDialog({ initialMode: 'login' });

      fireEvent.change(screen.getByTestId('input-auth-email'), { target: { value: 'usuario @dominio.com' } });
      fireEvent.change(screen.getByTestId('input-auth-password'), { target: { value: 'senha123' } });
      fireEvent.click(screen.getByTestId('button-auth-submit'));

      const errorMsg = screen.getByTestId('error-auth-email');
      expect(errorMsg).toBeInTheDocument();
      expect(errorMsg).toHaveTextContent('Informe um endereço de e-mail válido.');
    });

    it('1.8: Rejects email with double @ (usuario@@dominio.com)', async () => {
      renderAuthDialog({ initialMode: 'login' });

      fireEvent.change(screen.getByTestId('input-auth-email'), { target: { value: 'usuario@@dominio.com' } });
      fireEvent.change(screen.getByTestId('input-auth-password'), { target: { value: 'senha123' } });
      fireEvent.click(screen.getByTestId('button-auth-submit'));

      const errorMsg = screen.getByTestId('error-auth-email');
      expect(errorMsg).toBeInTheDocument();
      expect(errorMsg).toHaveTextContent('Informe um endereço de e-mail válido.');
    });

    it('1.9: Rejects completely empty email string and displays "O e-mail é obrigatório."', async () => {
      renderAuthDialog({ initialMode: 'login' });

      fireEvent.change(screen.getByTestId('input-auth-email'), { target: { value: '' } });
      fireEvent.change(screen.getByTestId('input-auth-password'), { target: { value: 'senha123' } });
      fireEvent.click(screen.getByTestId('button-auth-submit'));

      const errorMsg = screen.getByTestId('error-auth-email');
      expect(errorMsg).toBeInTheDocument();
      expect(errorMsg).toHaveTextContent('O e-mail é obrigatório.');
    });

    it('1.10: Rejects whitespace-only email string and displays "O e-mail é obrigatório."', async () => {
      renderAuthDialog({ initialMode: 'login' });

      fireEvent.change(screen.getByTestId('input-auth-email'), { target: { value: '    ' } });
      fireEvent.change(screen.getByTestId('input-auth-password'), { target: { value: 'senha123' } });
      fireEvent.click(screen.getByTestId('button-auth-submit'));

      const errorMsg = screen.getByTestId('error-auth-email');
      expect(errorMsg).toBeInTheDocument();
      expect(errorMsg).toHaveTextContent('O e-mail é obrigatório.');
    });

    it('1.11: Both button click and form submit event dispatch produce identical validation results', async () => {
      renderAuthDialog({ initialMode: 'login' });

      const emailInput = screen.getByTestId('input-auth-email');
      const form = emailInput.closest('form')!;

      // Form submit event directly
      fireEvent.change(emailInput, { target: { value: 'teste_invalido' } });
      fireEvent.submit(form);

      expect(screen.getByTestId('error-auth-email')).toHaveTextContent('Informe um endereço de e-mail válido.');
    });
  });

  // ==========================================================================
  // SUITE 2: Valid Email Inputs, Trimming & Submission
  // ==========================================================================
  describe('2. Valid Inputs, Trimming & Submission Flow', () => {
    it('2.1: Valid standard email triggers authService.login with trimmed payload', async () => {
      const loginSpy = vi.spyOn(authService, 'login').mockResolvedValueOnce({
        token: 'token.xyz.123',
        userId: 1,
        name: 'Produtor Teste',
        email: 'produtor@fazenda.com',
      });

      const handleSuccess = vi.fn();
      const handleClose = vi.fn();

      renderAuthDialog({
        initialMode: 'login',
        onSuccess: handleSuccess,
        onClose: handleClose,
      });

      // Email com espaços ao redor
      fireEvent.change(screen.getByTestId('input-auth-email'), {
        target: { value: '   produtor@fazenda.com   ' },
      });
      fireEvent.change(screen.getByTestId('input-auth-password'), {
        target: { value: 'senhaSegura123' },
      });

      fireEvent.click(screen.getByTestId('button-auth-submit'));

      await waitFor(() => {
        expect(loginSpy).toHaveBeenCalledWith({
          email: 'produtor@fazenda.com',
          password: 'senhaSegura123',
        });
        expect(handleSuccess).toHaveBeenCalledTimes(1);
        expect(handleClose).toHaveBeenCalledTimes(1);
      });
    });

    it('2.2: Valid complex email with plus-tag and subdomains succeeds', async () => {
      const loginSpy = vi.spyOn(authService, 'login').mockResolvedValueOnce({
        token: 'token.abc.456',
        userId: 2,
        name: 'Carlos Fazenda',
        email: 'carlos+tag123@agro.sub.fazenda.com.br',
      });

      renderAuthDialog({ initialMode: 'login' });

      fireEvent.change(screen.getByTestId('input-auth-email'), {
        target: { value: 'carlos+tag123@agro.sub.fazenda.com.br' },
      });
      fireEvent.change(screen.getByTestId('input-auth-password'), {
        target: { value: 'minhaSenhaForte' },
      });

      fireEvent.click(screen.getByTestId('button-auth-submit'));

      await waitFor(() => {
        expect(loginSpy).toHaveBeenCalledWith({
          email: 'carlos+tag123@agro.sub.fazenda.com.br',
          password: 'minhaSenhaForte',
        });
      });
    });

    it('2.3: Valid register form trims name and email and triggers authService.register', async () => {
      const registerSpy = vi.spyOn(authService, 'register').mockResolvedValueOnce({
        token: 'token.reg.789',
        userId: 3,
        name: 'Produtor Novo',
        email: 'novo@fazenda.com',
      });

      const handleSuccess = vi.fn();
      const handleClose = vi.fn();

      renderAuthDialog({
        initialMode: 'register',
        onSuccess: handleSuccess,
        onClose: handleClose,
      });

      fireEvent.change(screen.getByTestId('input-auth-name'), {
        target: { value: '   Produtor Novo   ' },
      });
      fireEvent.change(screen.getByTestId('input-auth-email'), {
        target: { value: '   novo@fazenda.com   ' },
      });
      fireEvent.change(screen.getByTestId('input-auth-password'), {
        target: { value: 'senhaRegistro123' },
      });

      fireEvent.click(screen.getByTestId('button-auth-submit'));

      await waitFor(() => {
        expect(registerSpy).toHaveBeenCalledWith({
          name: 'Produtor Novo',
          email: 'novo@fazenda.com',
          password: 'senhaRegistro123',
        });
        expect(handleSuccess).toHaveBeenCalledTimes(1);
        expect(handleClose).toHaveBeenCalledTimes(1);
      });
    });

    it('2.4: Does not trigger auth service when client validation fails', async () => {
      const loginSpy = vi.spyOn(authService, 'login');

      renderAuthDialog({ initialMode: 'login' });

      fireEvent.change(screen.getByTestId('input-auth-email'), {
        target: { value: 'invalido' },
      });
      fireEvent.change(screen.getByTestId('input-auth-password'), {
        target: { value: '123' },
      });

      fireEvent.click(screen.getByTestId('button-auth-submit'));

      expect(loginSpy).not.toHaveBeenCalled();
      expect(screen.getByTestId('error-auth-email')).toBeInTheDocument();
      expect(screen.getByTestId('error-auth-password')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // SUITE 3: Interactive UI Behavior & Edge Cases
  // ==========================================================================
  describe('3. Dynamic Interactivity, Error Resets & RFC 7807', () => {
    it('3.1: Clears email error immediately as soon as user types into email input', () => {
      renderAuthDialog({ initialMode: 'login' });

      fireEvent.change(screen.getByTestId('input-auth-email'), {
        target: { value: 'sem_arroba' },
      });
      fireEvent.click(screen.getByTestId('button-auth-submit'));

      expect(screen.getByTestId('error-auth-email')).toBeInTheDocument();

      // Digita novo caractere
      fireEvent.change(screen.getByTestId('input-auth-email'), {
        target: { value: 'sem_arroba@' },
      });

      expect(screen.queryByTestId('error-auth-email')).not.toBeInTheDocument();
    });

    it('3.2: Switching between login and register tabs resets all field and general errors', async () => {
      renderAuthDialog({ initialMode: 'login' });

      // Dispara erro no modo login
      fireEvent.click(screen.getByTestId('button-auth-submit'));
      expect(screen.getByTestId('error-auth-email')).toBeInTheDocument();

      // Alterna para aba register
      fireEvent.click(screen.getByTestId('button-auth-tab-register'));
      expect(screen.queryByTestId('error-auth-email')).not.toBeInTheDocument();
      expect(screen.queryByTestId('error-auth-password')).not.toBeInTheDocument();

      // Alterna de volta para login
      fireEvent.click(screen.getByTestId('button-auth-tab-login'));
      expect(screen.queryByTestId('error-auth-email')).not.toBeInTheDocument();
    });

    it('3.3: Renders RFC 7807 400 invalidParams.email directly on error-auth-email', async () => {
      vi.spyOn(authService, 'login').mockRejectedValueOnce(
        new ApiError({
          type: 'about:blank',
          title: 'Bad Request',
          status: 400,
          detail: 'Validação falhou.',
          instance: '/api/v1/auth/login',
          invalidParams: {
            email: 'E-mail corporativo institucional obrigatório.',
          },
        })
      );

      renderAuthDialog({ initialMode: 'login' });

      fireEvent.change(screen.getByTestId('input-auth-email'), {
        target: { value: 'usuario@public.com' },
      });
      fireEvent.change(screen.getByTestId('input-auth-password'), {
        target: { value: 'senha123456' },
      });

      fireEvent.click(screen.getByTestId('button-auth-submit'));

      await waitFor(() => {
        const emailErr = screen.getByTestId('error-auth-email');
        expect(emailErr).toHaveTextContent('E-mail corporativo institucional obrigatório.');
      });
    });

    it('3.4: Renders RFC 7807 401 in alert-auth-error banner', async () => {
      vi.spyOn(authService, 'login').mockRejectedValueOnce(
        new ApiError({
          type: 'about:blank',
          title: 'Unauthorized',
          status: 401,
          detail: 'Credenciais de produtor inválidas.',
          instance: '/api/v1/auth/login',
        })
      );

      renderAuthDialog({ initialMode: 'login' });

      fireEvent.change(screen.getByTestId('input-auth-email'), {
        target: { value: 'usuario@fazenda.com' },
      });
      fireEvent.change(screen.getByTestId('input-auth-password'), {
        target: { value: 'senhaIncorreta' },
      });

      fireEvent.click(screen.getByTestId('button-auth-submit'));

      await waitFor(() => {
        expect(screen.getByTestId('alert-auth-error')).toHaveTextContent(
          'Credenciais de produtor inválidas.'
        );
      });
    });

    it('3.5: Renders RFC 7807 409 Conflict in alert-auth-error banner', async () => {
      vi.spyOn(authService, 'register').mockRejectedValueOnce(
        new ApiError({
          type: 'about:blank',
          title: 'Conflict',
          status: 409,
          detail: 'Produtor já cadastrado com este e-mail.',
          instance: '/api/v1/auth/register',
        })
      );

      renderAuthDialog({ initialMode: 'register' });

      fireEvent.change(screen.getByTestId('input-auth-name'), {
        target: { value: 'Produtor Duplo' },
      });
      fireEvent.change(screen.getByTestId('input-auth-email'), {
        target: { value: 'duplo@fazenda.com' },
      });
      fireEvent.change(screen.getByTestId('input-auth-password'), {
        target: { value: 'senha123456' },
      });

      fireEvent.click(screen.getByTestId('button-auth-submit'));

      await waitFor(() => {
        expect(screen.getByTestId('alert-auth-error')).toHaveTextContent(
          'Produtor já cadastrado com este e-mail.'
        );
      });
    });

    it('3.6: Does not render when isOpen is false', () => {
      const { container } = render(
        <AuthProvider>
          <AuthDialog isOpen={false} onClose={vi.fn()} />
        </AuthProvider>
      );
      expect(container.firstChild).toBeNull();
      expect(screen.queryByTestId('auth-dialog')).not.toBeInTheDocument();
    });

    it('3.7: Gracefully handles being rendered outside AuthProvider without throwing', () => {
      expect(() => {
        render(<AuthDialog isOpen={true} onClose={vi.fn()} />);
      }).not.toThrow();
      expect(screen.getByTestId('auth-dialog')).toBeInTheDocument();
    });
  });
});
