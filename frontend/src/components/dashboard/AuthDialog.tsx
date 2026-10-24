import React, { useState, useEffect } from 'react';
import { X, Lock, Mail, User, AlertCircle, Loader2, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../services/apiClient';

export interface AuthDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register';
  onSuccess?: () => void;
  isBackendOnline?: boolean | null;
}

export const AuthDialog: React.FC<AuthDialogProps> = ({
  isOpen,
  onClose,
  initialMode = 'login',
  onSuccess,
  isBackendOnline,
}) => {
  let auth: ReturnType<typeof useAuth> | null = null;
  try {
    auth = useAuth();
  } catch {
    // rendered outside provider
  }
  const login = auth?.login || (async () => ({} as any));
  const register = auth?.register || (async () => ({} as any));
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setMode(initialMode);
    setFieldErrors({});
    setGeneralError(null);
  }, [initialMode, isOpen]);

  if (!isOpen) return null;

  const handleTabSwitch = (newMode: 'login' | 'register') => {
    setMode(newMode);
    setFieldErrors({});
    setGeneralError(null);
  };

  const handleInputChange = (
    setter: React.Dispatch<React.SetStateAction<string>>,
    field: string
  ) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(e.target.value);
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
    if (generalError) setGeneralError(null);
  };

  const validateClientSide = (): boolean => {
    const errors: Record<string, string> = {};

    if (!email.trim()) {
      errors.email = 'O e-mail é obrigatório.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Informe um endereço de e-mail válido.';
    }

    if (!password) {
      errors.password = 'A senha é obrigatória.';
    } else if (password.length < 6) {
      errors.password = 'A senha deve conter no mínimo 6 caracteres.';
    }

    if (mode === 'register') {
      if (!name.trim()) {
        errors.name = 'O nome do produtor é obrigatório.';
      } else if (name.trim().length < 3) {
        errors.name = 'O nome deve conter pelo menos 3 caracteres.';
      } else if (name.trim().length > 100) {
        errors.name = 'O nome não pode exceder 100 caracteres.';
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);

    if (!validateClientSide()) {
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === 'login') {
        await login({ email: email.trim(), password });
      } else {
        await register({ name: name.trim(), email: email.trim(), password });
      }

      onSuccess?.();
      onClose();
    } catch (err: any) {
      if (err instanceof ApiError) {
        if (err.invalidParams && Object.keys(err.invalidParams).length > 0) {
          setFieldErrors(err.invalidParams);
        } else if (err.status === 401) {
          setGeneralError(err.detail || 'E-mail ou senha incorretos.');
        } else if (err.status === 409) {
          setGeneralError(err.detail || 'Este e-mail já está em uso.');
        } else {
          setGeneralError(err.detail || err.title || 'Falha ao autenticar.');
        }
      } else {
        setGeneralError(err?.message || 'Erro inesperado na conexão.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-dialog-title"
      data-testid="auth-dialog"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/40 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-card-border bg-card p-6 sm:p-8 shadow-xl text-foreground">
        {/* Botão de Fechar */}
        <button
          onClick={onClose}
          data-testid="button-auth-close"
          aria-label="Fechar janela"
          className="absolute right-4 top-4 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition focus-visible:outline-2 focus-visible:outline-ring"
        >
          <X className="size-5" />
        </button>

        <h2 id="auth-dialog-title" className="text-2xl font-extrabold tracking-tight text-primary">
          {mode === 'login' ? 'Acessar Conta' : 'Cadastro de Produtor'}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === 'login'
            ? 'Entre com suas credenciais para gerenciar suas fazendas e currais.'
            : 'Cadastre sua conta para monitoramento em tempo real.'}
        </p>

        {/* Alerta Contextual quando o Backend Spring Boot está Offline */}
        {isBackendOnline === false && (
          <div
            role="note"
            data-testid="alert-backend-offline"
            className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-950 font-medium flex items-start gap-2.5"
          >
            <AlertCircle className="size-4 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <p className="font-bold">Servidor Backend Offline (porta 8080)</p>
              <p className="text-[11px] text-amber-900 mt-0.5">
                O backend Spring Boot não está respondendo. Para sincronizar dados reais e operar o ESP32, inicie a aplicação na porta 8080.
              </p>
            </div>
          </div>
        )}

        {/* Abas de Navegação */}
        <div
          role="tablist"
          className="mt-5 grid grid-cols-2 gap-1 p-1 rounded-xl bg-muted text-sm font-semibold"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'login'}
            data-testid="button-auth-tab-login"
            onClick={() => handleTabSwitch('login')}
            className={`rounded-lg py-2 transition focus-visible:outline-2 focus-visible:outline-ring ${
              mode === 'login'
                ? 'bg-primary text-primary-foreground shadow'
                : 'text-muted-foreground hover:bg-card'
            }`}
          >
            Entrar
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'register'}
            data-testid="button-auth-tab-register"
            onClick={() => handleTabSwitch('register')}
            className={`rounded-lg py-2 transition focus-visible:outline-2 focus-visible:outline-ring ${
              mode === 'register'
                ? 'bg-primary text-primary-foreground shadow'
                : 'text-muted-foreground hover:bg-card'
            }`}
          >
            Cadastrar
          </button>
        </div>

        {/* Banner de Erro Geral */}
        {generalError && (
          <div
            role="alert"
            data-testid="alert-auth-error"
            className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive font-medium flex items-start gap-2.5"
          >
            <AlertCircle className="size-5 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span>{generalError}</span>
              {mode === 'login' && email.trim() === 'produtor@fazenda.com' && (
                <div className="mt-2 pt-2 border-t border-destructive/20 text-xs">
                  <p className="text-destructive/90">
                    Se este usuário ainda não foi cadastrado no seu banco local:
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      handleTabSwitch('register');
                      setName('Produtor Fazenda');
                      setEmail('produtor@fazenda.com');
                      setPassword('senhaSegura123');
                    }}
                    className="mt-1 font-bold underline hover:no-underline text-destructive inline-block"
                  >
                    Cadastrar conta de teste agora &rarr;
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
          {/* Campo Nome (Apenas Cadastro) */}
          {mode === 'register' && (
            <div>
              <label
                htmlFor="auth-name"
                className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1"
              >
                Nome Completo
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-3 size-4 text-muted-foreground" />
                <input
                  id="auth-name"
                  type="text"
                  value={name}
                  onChange={handleInputChange(setName, 'name')}
                  data-testid="input-auth-name"
                  placeholder="Ex: João Produtor"
                  disabled={isSubmitting}
                  className={`w-full rounded-xl border-2 bg-background pl-10 pr-4 py-2.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring ${
                    fieldErrors.name
                      ? 'border-destructive text-destructive'
                      : 'border-input text-foreground'
                  }`}
                />
              </div>
              {fieldErrors.name && (
                <p
                  data-testid="error-auth-name"
                  className="mt-1 text-xs font-semibold text-destructive flex items-center gap-1"
                >
                  <AlertCircle className="size-3.5 shrink-0" />
                  {fieldErrors.name}
                </p>
              )}
            </div>
          )}

          {/* Campo E-mail */}
          <div>
            <label
              htmlFor="auth-email"
              className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1"
            >
              E-mail
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3 size-4 text-muted-foreground" />
              <input
                id="auth-email"
                type="email"
                value={email}
                onChange={handleInputChange(setEmail, 'email')}
                data-testid="input-auth-email"
                placeholder="produtor@fazenda.com"
                disabled={isSubmitting}
                className={`w-full rounded-xl border-2 bg-background pl-10 pr-4 py-2.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring ${
                  fieldErrors.email
                    ? 'border-destructive text-destructive'
                    : 'border-input text-foreground'
                }`}
              />
            </div>
            {fieldErrors.email && (
              <p
                data-testid="error-auth-email"
                className="mt-1 text-xs font-semibold text-destructive flex items-center gap-1"
              >
                <AlertCircle className="size-3.5 shrink-0" />
                {fieldErrors.email}
              </p>
            )}
          </div>

          {/* Campo Senha */}
          <div>
            <label
              htmlFor="auth-password"
              className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1"
            >
              Senha
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 size-4 text-muted-foreground" />
              <input
                id="auth-password"
                type="password"
                value={password}
                onChange={handleInputChange(setPassword, 'password')}
                data-testid="input-auth-password"
                placeholder="••••••••"
                disabled={isSubmitting}
                className={`w-full rounded-xl border-2 bg-background pl-10 pr-4 py-2.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring ${
                  fieldErrors.password
                    ? 'border-destructive text-destructive'
                    : 'border-input text-foreground'
                }`}
              />
            </div>
            {fieldErrors.password && (
              <p
                data-testid="error-auth-password"
                className="mt-1 text-xs font-semibold text-destructive flex items-center gap-1"
              >
                <AlertCircle className="size-3.5 shrink-0" />
                {fieldErrors.password}
              </p>
            )}
          </div>

          {/* Botão de Submissão */}
          <button
            type="submit"
            disabled={isSubmitting}
            data-testid="button-auth-submit"
            className="w-full mt-2 rounded-xl bg-primary text-primary-foreground font-bold py-3 px-5 transition active:scale-95 hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-ring"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>Processando...</span>
              </>
            ) : mode === 'login' ? (
              'Entrar na Plataforma'
            ) : (
              'Cadastrar Produtor'
            )}
          </button>
        </form>

        {/* Cartão de Ajuda para Demonstração / Teste Rápido */}
        <div className="mt-4 p-3 rounded-xl bg-muted/60 border border-border/80 text-xs text-muted-foreground flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-foreground flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-primary shrink-0" />
              <span>Conta de Teste / Dev:</span>
            </p>
            <p className="font-mono text-[11px] text-muted-foreground mt-0.5 truncate">
              produtor@fazenda.com • senhaSegura123
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (mode === 'register') {
                setName('Produtor Fazenda');
              }
              setEmail('produtor@fazenda.com');
              setPassword('senhaSegura123');
              setFieldErrors({});
              setGeneralError(null);
            }}
            data-testid="button-quick-demo-login"
            className="shrink-0 px-2.5 py-1.5 rounded-lg bg-card border border-input text-foreground font-semibold hover:bg-background text-xs transition active:scale-95 shadow-xs"
          >
            Preencher
          </button>
        </div>
      </div>
    </div>
  );
};
