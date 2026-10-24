import React, { useState } from 'react';
import {
  Tractor,
  Fence,
  Plus,
  LogIn,
  LogOut,
  User as UserIcon,
  Wifi,
  WifiOff,
  Pencil,
  Trash2,
  Info,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useFarmCorral } from '../../context/FarmCorralContext';
import { AuthDialog } from './AuthDialog';
import { FarmModal } from './FarmModal';
import { CorralModal } from './CorralModal';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';
import { farmService } from '../../services/farmService';
import { corralService } from '../../services/corralService';
import { ApiError } from '../../services/apiClient';
import type { FarmResponseDTO, CorralResponseDTO, AuthUser } from '../../types/api';

export interface HeaderProps {
  user?: AuthUser | null;
  isAuthenticated?: boolean;
  farms?: FarmResponseDTO[];
  selectedFarmId?: number | null;
  onSelectFarm?: (id: number | null) => void;
  corrais?: CorralResponseDTO[];
  selectedCorralId?: number | null;
  onSelectCorral?: (id: number | null) => void;
  onOpenAuthModal?: () => void;
  onLogout?: () => void;
  onRefreshAll?: () => void;
  isBackendOnline?: boolean | null;
  isSseConnected?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  user: propUser,
  isAuthenticated: propIsAuthenticated,
  farms: propFarms,
  selectedFarmId: propSelectedFarmId,
  onSelectFarm: propOnSelectFarm,
  corrais: propCorrais,
  selectedCorralId: propSelectedCorralId,
  onSelectCorral: propOnSelectCorral,
  onOpenAuthModal: propOnOpenAuthModal,
  onLogout: propOnLogout,
  onRefreshAll,
  isBackendOnline,
  isSseConnected,
}) => {
  // Context fallbacks
  let authContext: ReturnType<typeof useAuth> | null = null;
  let farmCorralContext: ReturnType<typeof useFarmCorral> | null = null;

  try {
    authContext = useAuth();
  } catch {
    // Rendered outside AuthProvider (e.g. in standalone test)
  }

  try {
    farmCorralContext = useFarmCorral();
  } catch {
    // Rendered outside FarmCorralProvider
  }

  const user = propUser !== undefined ? propUser : authContext?.user || null;
  const isAuthenticated = propIsAuthenticated !== undefined ? propIsAuthenticated : (authContext?.isAuthenticated ?? false);
  const logout = propOnLogout || authContext?.logout || (() => {});

  const farms = propFarms !== undefined ? propFarms : farmCorralContext?.farms || [];
  const currais = propCorrais !== undefined ? propCorrais : farmCorralContext?.currais || [];
  const selectedFarmId = propSelectedFarmId !== undefined ? propSelectedFarmId : farmCorralContext?.selectedFarmId || null;
  const selectedCorralId = propSelectedCorralId !== undefined ? propSelectedCorralId : farmCorralContext?.selectedCorralId || null;

  const selectFarm = propOnSelectFarm || farmCorralContext?.selectFarm || (() => {});
  const selectCorral = propOnSelectCorral || farmCorralContext?.selectCorral || (() => {});
  const isLoadingFarms = farmCorralContext?.isLoadingFarms ?? false;
  const isLoadingCurrais = farmCorralContext?.isLoadingCurrais ?? false;

  const selectedFarm = farms.find((f) => f.id === selectedFarmId) || null;
  const selectedCorral = currais.find((c) => c.id === selectedCorralId) || null;

  // Modais de Criação
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isFarmModalOpen, setIsFarmModalOpen] = useState(false);
  const [isCorralModalOpen, setIsCorralModalOpen] = useState(false);

  // Modais de Edição
  const [isEditFarmOpen, setIsEditFarmOpen] = useState(false);
  const [isEditCorralOpen, setIsEditCorralOpen] = useState(false);

  // Modais de Exclusão
  const [isDeleteFarmOpen, setIsDeleteFarmOpen] = useState(false);
  const [isDeletingFarm, setIsDeletingFarm] = useState(false);
  const [deleteFarmError, setDeleteFarmError] = useState<string | null>(null);

  const [isDeleteCorralOpen, setIsDeleteCorralOpen] = useState(false);
  const [isDeletingCorral, setIsDeletingCorral] = useState(false);
  const [deleteCorralError, setDeleteCorralError] = useState<string | null>(null);

  const handleOpenAuth = () => {
    if (propOnOpenAuthModal) {
      propOnOpenAuthModal();
    } else {
      setIsAuthOpen(true);
    }
  };

  const handleConfirmDeleteFarm = async () => {
    if (!selectedFarmId) return;
    setIsDeletingFarm(true);
    setDeleteFarmError(null);
    try {
      if (farmCorralContext?.deleteFarmFromContext) {
        await farmCorralContext.deleteFarmFromContext(selectedFarmId);
      } else {
        await farmService.deleteFarm(selectedFarmId);
      }
      setIsDeleteFarmOpen(false);
      onRefreshAll?.();
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.detail : 'Erro ao excluir fazenda.';
      setDeleteFarmError(msg);
    } finally {
      setIsDeletingFarm(false);
    }
  };

  const handleConfirmDeleteCorral = async () => {
    if (!selectedCorralId) return;
    setIsDeletingCorral(true);
    setDeleteCorralError(null);
    try {
      if (farmCorralContext?.deleteCorralFromContext) {
        await farmCorralContext.deleteCorralFromContext(selectedCorralId);
      } else {
        await corralService.deleteCorral(selectedCorralId);
      }
      setIsDeleteCorralOpen(false);
      onRefreshAll?.();
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.detail : 'Erro ao excluir curral.';
      setDeleteCorralError(msg);
    } finally {
      setIsDeletingCorral(false);
    }
  };

  return (
    <>
      <header className="max-w-5xl mx-auto px-4 pt-8 pb-6">
        {/* Linha Superior: Tagline, Status do Backend e Ações de Usuário */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 flex-wrap">
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              {isAuthenticated ? (
                <>
                  <span className="relative flex size-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex rounded-full size-2 bg-primary" />
                  </span>
                  <span>Painel Conectado — Modo Operacional</span>
                </>
              ) : (
                <>
                  <span className="size-2 rounded-full bg-amber-500 inline-block" />
                  <span>Demonstração acadêmica</span>
                </>
              )}
            </p>

            {isBackendOnline !== undefined && isBackendOnline !== null && (
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold border ${
                  isBackendOnline
                    ? 'bg-primary/10 text-primary border-primary/30'
                    : 'bg-amber-500/10 text-amber-800 border-amber-500/30'
                }`}
                title={
                  isBackendOnline
                    ? 'Servidor Spring Boot ativo e respondendo na porta 8080'
                    : 'Servidor Spring Boot offline ou inacessível na porta 8080'
                }
              >
                <span className={`size-1.5 rounded-full ${isBackendOnline ? 'bg-primary animate-pulse' : 'bg-amber-600'}`} />
                API: {isBackendOnline ? 'Online' : 'Offline'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isAuthenticated && user ? (
              <div className="flex items-center gap-2">
                <div
                  data-testid="user-profile-badge"
                  className="flex items-center gap-2 rounded-full border border-border bg-muted/70 px-3 py-1 text-xs font-semibold text-foreground"
                >
                  <UserIcon className="size-3.5 text-primary" />
                  <span className="truncate max-w-[140px] sm:max-w-[200px]" title={user.email}>
                    {user.name}
                  </span>
                </div>
                <button
                  onClick={logout}
                  data-testid="button-logout"
                  title="Sair da conta"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-input bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:border-destructive/40 hover:text-destructive active:scale-95 focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <LogOut className="size-3.5" />
                  <span>Sair</span>
                </button>
              </div>
            ) : (
              <button
                onClick={handleOpenAuth}
                data-testid="button-open-login"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-sm transition hover:brightness-110 active:scale-95 focus-visible:outline-2 focus-visible:outline-ring"
              >
                <LogIn className="size-4" />
                <span>Entrar / Cadastrar</span>
              </button>
            )}
          </div>
        </div>

        {/* Título Principal */}
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-primary mt-2">
          Limpeza Inteligente do Curral
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground text-sm sm:text-base">
          Sistema de telemetria e lavagem automatizada com fail-fast biológico contra acionamento indevido na presença de animais.
        </p>

        {/* Barra Seletora Multi-Fazenda e Multi-Curral */}
        <div className="mt-6 rounded-2xl border border-card-border bg-card p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4 flex-1">
            {/* Seletor de Fazenda */}
            <div className="flex items-center gap-2 min-w-[220px]">
              <Tractor className="size-4 text-primary shrink-0" />
              <div className="flex-1">
                <label htmlFor="select-farm" className="sr-only">
                  Selecionar Fazenda
                </label>
                <select
                  id="select-farm"
                  data-testid="select-farm"
                  disabled={!isAuthenticated || isLoadingFarms || farms.length === 0}
                  value={selectedFarmId ?? ''}
                  onChange={(e) => selectFarm(e.target.value ? Number(e.target.value) : null)}
                  className="w-full rounded-xl border-2 border-input bg-background px-3 py-1.5 text-xs font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60"
                >
                  {!isAuthenticated ? (
                    <option value="">Fazenda Demonstrativa (Simulado)</option>
                  ) : farms.length === 0 ? (
                    <option value="">Nenhuma fazenda cadastrada</option>
                  ) : (
                    farms.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))
                  )}
                </select>
              </div>
              {isAuthenticated && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setIsFarmModalOpen(true)}
                    data-testid="button-nova-fazenda"
                    title="Cadastrar Nova Fazenda"
                    className="rounded-xl border-2 border-input bg-card p-1.5 text-foreground hover:bg-muted active:scale-95 transition focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <Plus className="size-4" />
                  </button>
                  {selectedFarm && (
                    <>
                      <button
                        type="button"
                        onClick={() => setIsEditFarmOpen(true)}
                        data-testid="button-editar-fazenda"
                        title="Editar Nome da Fazenda"
                        className="rounded-xl border-2 border-input bg-card p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95 transition focus-visible:outline-2 focus-visible:outline-ring"
                      >
                        <Pencil className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteFarmError(null);
                          setIsDeleteFarmOpen(true);
                        }}
                        data-testid="button-excluir-fazenda"
                        title="Excluir Fazenda"
                        className="rounded-xl border-2 border-input bg-card p-1.5 text-muted-foreground hover:text-destructive hover:border-destructive/40 hover:bg-destructive/10 active:scale-95 transition focus-visible:outline-2 focus-visible:outline-ring"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Seletor de Curral */}
            <div className="flex items-center gap-2 min-w-[220px]">
              <Fence className="size-4 text-primary shrink-0" />
              <div className="flex-1">
                <label htmlFor="select-corral" className="sr-only">
                  Selecionar Curral
                </label>
                <select
                  id="select-corral"
                  data-testid="select-corral"
                  disabled={!isAuthenticated || !selectedFarmId || isLoadingCurrais || currais.length === 0}
                  value={selectedCorralId ?? ''}
                  onChange={(e) => selectCorral(e.target.value ? Number(e.target.value) : null)}
                  className="w-full rounded-xl border-2 border-input bg-background px-3 py-1.5 text-xs font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60"
                >
                  {!isAuthenticated ? (
                    <option value="">Curral Demonstrativo (Simulado)</option>
                  ) : currais.length === 0 ? (
                    <option value="">Nenhum curral nesta fazenda</option>
                  ) : (
                    currais.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.deviceStatus})
                      </option>
                    ))
                  )}
                </select>
              </div>
              {isAuthenticated && selectedFarmId && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setIsCorralModalOpen(true)}
                    data-testid="button-novo-corral"
                    title="Cadastrar Novo Curral"
                    className="rounded-xl border-2 border-input bg-card p-1.5 text-foreground hover:bg-muted active:scale-95 transition focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <Plus className="size-4" />
                  </button>
                  {selectedCorral && (
                    <>
                      <button
                        type="button"
                        onClick={() => setIsEditCorralOpen(true)}
                        data-testid="button-editar-corral"
                        title="Editar Curral"
                        className="rounded-xl border-2 border-input bg-card p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95 transition focus-visible:outline-2 focus-visible:outline-ring"
                      >
                        <Pencil className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteCorralError(null);
                          setIsDeleteCorralOpen(true);
                        }}
                        data-testid="button-excluir-corral"
                        title="Excluir Curral"
                        className="rounded-xl border-2 border-input bg-card p-1.5 text-muted-foreground hover:text-destructive hover:border-destructive/40 hover:bg-destructive/10 active:scale-95 transition focus-visible:outline-2 focus-visible:outline-ring"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Badge de Conectividade do Curral Selecionado */}
          {selectedCorral && (
            <div className="flex items-center gap-2">
              <span
                data-testid="badge-corral-status"
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-mono uppercase tracking-wider font-bold ${
                  selectedCorral.deviceStatus === 'ONLINE'
                    ? 'bg-primary/15 text-primary border border-primary/30'
                    : 'bg-destructive/15 text-destructive border border-destructive/30'
                }`}
              >
                {selectedCorral.deviceStatus === 'ONLINE' ? (
                  <Wifi className="size-3.5" />
                ) : (
                  <WifiOff className="size-3.5" />
                )}
                <span>{selectedCorral.deviceStatus}</span>
              </span>
              {isSseConnected && (
                <span
                  data-testid="badge-sse-header"
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                  title="Conexão Server-Sent Events (SSE) ativa em tempo real"
                >
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  SSE
                </span>
              )}
            </div>
          )}
        </div>

        {/* Guias de Onboarding Contextuais */}
        {isAuthenticated && farms.length === 0 && !isLoadingFarms && (
          <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-foreground flex items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-2">
              <Tractor className="size-4 text-primary shrink-0" />
              <span>
                <strong>Primeiro Passo:</strong> Você ainda não possui fazendas cadastradas. Clique em <strong>"+"</strong> para cadastrar sua primeira fazenda.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsFarmModalOpen(true)}
              className="shrink-0 px-2.5 py-1 rounded-lg bg-primary text-primary-foreground font-semibold hover:brightness-110 transition active:scale-95"
            >
              Criar Fazenda
            </button>
          </div>
        )}

        {isAuthenticated && farms.length > 0 && selectedFarmId && currais.length === 0 && !isLoadingCurrais && (
          <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-foreground flex items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-2">
              <Fence className="size-4 text-primary shrink-0" />
              <span>
                <strong>Adicione um Curral:</strong> Esta fazenda ainda não possui currais. Clique em <strong>"+"</strong> para vincular o MAC do ESP32 e monitorar a telemetria ao vivo.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsCorralModalOpen(true)}
              className="shrink-0 px-2.5 py-1 rounded-lg bg-primary text-primary-foreground font-semibold hover:brightness-110 transition active:scale-95"
            >
              Criar Curral
            </button>
          </div>
        )}
      </header>

      {/* Diálogos Modais Internos se disparados internamente */}
      <AuthDialog
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        initialMode="login"
        onSuccess={onRefreshAll}
        isBackendOnline={isBackendOnline}
      />

      {/* Criação de Fazenda */}
      <FarmModal
        isOpen={isFarmModalOpen}
        mode="create"
        onClose={() => setIsFarmModalOpen(false)}
        onSuccess={onRefreshAll}
      />

      {/* Edição de Fazenda */}
      {selectedFarm && (
        <FarmModal
          isOpen={isEditFarmOpen}
          mode="edit"
          farmToEdit={selectedFarm}
          onClose={() => setIsEditFarmOpen(false)}
          onSuccess={onRefreshAll}
        />
      )}

      {/* Exclusão de Fazenda */}
      {selectedFarm && (
        <ConfirmDeleteDialog
          isOpen={isDeleteFarmOpen}
          title={`Excluir Fazenda "${selectedFarm.name}"`}
          description="Tem certeza que deseja excluir esta fazenda? Todos os currais, animais e registros vinculados serão excluídos permanentemente. Certifique-se de que nenhum curral esteja com ciclo de lavagem ativo."
          confirmLabel="Excluir Fazenda"
          isDeleting={isDeletingFarm}
          errorMessage={deleteFarmError}
          onConfirm={handleConfirmDeleteFarm}
          onClose={() => {
            setIsDeleteFarmOpen(false);
            setDeleteFarmError(null);
          }}
          testId="dialog-delete-farm"
        />
      )}

      {/* Criação de Curral */}
      {selectedFarmId && (
        <CorralModal
          isOpen={isCorralModalOpen}
          farmId={selectedFarmId}
          mode="create"
          onClose={() => setIsCorralModalOpen(false)}
          onSuccess={onRefreshAll}
        />
      )}

      {/* Edição de Curral */}
      {selectedFarmId && selectedCorral && (
        <CorralModal
          isOpen={isEditCorralOpen}
          farmId={selectedFarmId}
          mode="edit"
          corralToEdit={selectedCorral}
          onClose={() => setIsEditCorralOpen(false)}
          onSuccess={onRefreshAll}
        />
      )}

      {/* Exclusão de Curral */}
      {selectedCorral && (
        <ConfirmDeleteDialog
          isOpen={isDeleteCorralOpen}
          title={`Excluir Curral "${selectedCorral.name}"`}
          description="Tem certeza que deseja excluir este curral? Os animais atualmente no curral serão movidos para fora do curral (pasto). Não é possível excluir currais durante ciclos de lavagem ativos."
          confirmLabel="Excluir Curral"
          isDeleting={isDeletingCorral}
          errorMessage={deleteCorralError}
          onConfirm={handleConfirmDeleteCorral}
          onClose={() => {
            setIsDeleteCorralOpen(false);
            setDeleteCorralError(null);
          }}
          testId="dialog-delete-corral"
        />
      )}
    </>
  );
};
