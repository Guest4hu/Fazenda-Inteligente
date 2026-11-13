import React, { useState } from 'react';
import {
  PawPrint,
  ShieldAlert,
  Plus,
  LogOut,
  LogIn,
  Tag as TagIcon,
  X,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Pencil,
  Trash2,
  Radio,
} from 'lucide-react';
import { animalService } from '../../services/animalService';
import { ApiError } from '../../services/apiClient';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';
import type { AnimalResponseDTO, AnimalEventType } from '../../types/api';

export interface AnimalPresenceListProps {
  corralId?: number | null;
  farmId?: number | null;
  corralName?: string;
  isLive?: boolean;
  presenceSimulated?: boolean;
  onTogglePresenceSimulated?: () => void;
  animals?: AnimalResponseDTO[];
  onRefresh?: () => Promise<void> | void;
  onLogEvent?: (msg: string, kind?: 'info' | 'ok' | 'warn' | 'danger') => void;
  washing?: boolean;
  onStopWash?: (msg: string, kind: 'info' | 'ok' | 'warn' | 'danger') => void;
}

/**
 * Herd occupancy and animal registry card displaying animals inside the active
 * corral, manual {@code ENTROU}/{@code SAIU} presence controls with safety lock
 * feedback, smart toggle fallback, and animal create/edit dialogs.
 */
export const AnimalPresenceList: React.FC<AnimalPresenceListProps> = ({
  corralId,
  farmId,
  corralName,
  isLive = false,
  presenceSimulated = false,
  onTogglePresenceSimulated,
  animals = [],
  onRefresh,
  onLogEvent,
  washing = false,
  onStopWash,
}) => {
  const [internalSimulated, setInternalSimulated] = useState(presenceSimulated);
  const [activeTab, setActiveTab] = useState<'corral' | 'all'>('corral');

  // Animals currently inside this corral
  const animalsInCorral = isLive && corralId
    ? animals.filter((a) => a.currentCorralId === corralId)
    : [];

  const animalsOutside = isLive && corralId
    ? animals.filter((a) => a.currentCorralId !== corralId)
    : [];

  const effectiveSimulated = onTogglePresenceSimulated ? presenceSimulated : internalSimulated;

  // Effective presence: real animals inside the corral or simulated detection active
  const hasPresence = isLive ? (animalsInCorral.length > 0 || effectiveSimulated) : effectiveSimulated;

  // Animal create/edit dialog state
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingAnimal, setEditingAnimal] = useState<AnimalResponseDTO | null>(null);
  const [name, setName] = useState('');
  const [identification, setIdentification] = useState('');
  const [tagUid, setTagUid] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Animal delete confirmation state
  const [deletingAnimal, setDeletingAnimal] = useState<AnimalResponseDTO | null>(null);
  const [isDeletingAnimal, setIsDeletingAnimal] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleOpenCreate = () => {
    setEditingAnimal(null);
    setName('');
    setIdentification('');
    setTagUid('');
    setFieldErrors({});
    setFormError(null);
    setSuccessMsg(null);
    setShowAddDialog(true);
  };

  const handleOpenEdit = (animal: AnimalResponseDTO) => {
    setEditingAnimal(animal);
    setName(animal.name);
    setIdentification(animal.identification || '');
    setTagUid(animal.tagUid);
    setFieldErrors({});
    setFormError(null);
    setSuccessMsg(null);
    setShowAddDialog(true);
  };

  /**
   * Toggles corral occupancy safely via the top-level switch: prefers moving an
   * inside animal out first, otherwise moves an outside animal in (firing
   * biological shutoff if washing), or toggles simulated PIR state offline.
   */
  const handleToggleSwitch = async () => {
    if (!isLive || !corralId) {
      if (onTogglePresenceSimulated) {
        onTogglePresenceSimulated();
      } else {
        const next = !internalSimulated;
        setInternalSimulated(next);
        if (next) {
          onLogEvent?.('Presença de animal simulada: PIR detectou movimento.', 'warn');
          if (washing) {
            onStopWash?.(
              'PARADA DE SEGURANÇA: animal detectado durante a lavagem. Bomba simulada desligada.',
              'danger'
            );
          }
        } else {
          onLogEvent?.('Presença removida. A lavagem NÃO reinicia sozinha.', 'info');
        }
      }
      return;
    }

    // Online mode with a selected corral: exit first occupied animal, enter first outside animal,
    // or fall back to simulated presence when no animals are registered.
    if (animalsInCorral.length > 0) {
      const animalToExit = animalsInCorral[0];
      await handlePresenceAction(animalToExit.tagUid, 'SAIU', animalToExit.name);
    } else if (animalsOutside.length > 0) {
      const animalToEnter = animalsOutside[0];
      await handlePresenceAction(animalToEnter.tagUid, 'ENTROU', animalToEnter.name);
    } else {
      if (onTogglePresenceSimulated) {
        onTogglePresenceSimulated();
      } else {
        setInternalSimulated(!internalSimulated);
      }
      if (!hasPresence) {
        onLogEvent?.('Presença de animal detectada.', 'warn');
        if (washing) {
          onStopWash?.(
            'PARADA DE SEGURANÇA: animal detectado durante a lavagem. Bomba desligada.',
            'danger'
          );
        }
      } else {
        onLogEvent?.('Presença removida.', 'info');
      }
    }
  };

  /** Dispatches a manual {@code ENTROU} or {@code SAIU} event via {@code POST /presenca}. */
  const handlePresenceAction = async (
    targetTagUid: string,
    typeEvent: AnimalEventType,
    animalName: string
  ) => {
    if (!corralId) return;
    try {
      setActionLoadingId(-1);
      await animalService.sendPresence(corralId, {
        tagUid: targetTagUid,
        typeEvent,
        origin: 'MANUAL',
      });

      if (typeEvent === 'ENTROU') {
        onLogEvent?.(
          `Entrada manual registrada: ${animalName} (Tag: ${targetTagUid}).`,
          'warn'
        );
        if (washing) {
          onStopWash?.(
            'PARADA DE SEGURANÇA: animal detectado durante a lavagem. Bomba desligada.',
            'danger'
          );
        }
      } else {
        onLogEvent?.(
          `Saída manual registrada: ${animalName} (Tag: ${targetTagUid}).`,
          'info'
        );
      }

      if (onRefresh) await onRefresh();
    } catch (err: unknown) {
      const message = err instanceof ApiError ? err.detail : 'Erro ao registrar presença.';
      onLogEvent?.(`Falha na presença: ${message}`, 'danger');
    } finally {
      setActionLoadingId(null);
    }
  };

  /** Creates or updates an animal record with optional immediate tag linking. */
  const handleSaveAnimal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!farmId) {
      setFormError('Selecione uma fazenda antes de cadastrar animais.');
      return;
    }

    setFormError(null);
    setFieldErrors({});
    setIsSubmitting(true);

    try {
      if (editingAnimal) {
        const updated = await animalService.updateAnimal(
          editingAnimal.id,
          {
            name: name.trim(),
            identification: identification.trim() || null,
            tagUid: tagUid.trim().toUpperCase(),
          },
          farmId
        );

        setSuccessMsg(`Animal "${updated.name}" atualizado com sucesso!`);
        onLogEvent?.(`Animal atualizado: ${updated.name} (Tag: ${updated.tagUid}).`, 'ok');
      } else {
        const created = await animalService.createAnimal(farmId, {
          name: name.trim(),
          identification: identification.trim() || null,
          tagUid: tagUid.trim().toUpperCase(),
        });

        setSuccessMsg(`Animal "${created.name}" cadastrado com sucesso!`);
        onLogEvent?.(`Novo animal cadastrado: ${created.name} (Tag: ${created.tagUid}).`, 'ok');
      }

      setName('');
      setIdentification('');
      setTagUid('');

      if (onRefresh) await onRefresh();
      setTimeout(() => {
        setSuccessMsg(null);
        setShowAddDialog(false);
        setEditingAnimal(null);
      }, 1200);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.invalidParams) setFieldErrors(err.invalidParams);
        setFormError(err.detail || err.title || 'Erro de validação dos dados.');
      } else {
        setFormError('Ocorreu um erro inesperado ao salvar o animal.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingAnimal) return;
    setIsDeletingAnimal(true);
    setDeleteError(null);
    try {
      await animalService.deleteAnimal(deletingAnimal.id, farmId || undefined);
      onLogEvent?.(`Animal "${deletingAnimal.name}" excluído do sistema.`, 'info');
      setDeletingAnimal(null);
      if (onRefresh) await onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.detail : 'Erro ao excluir animal.';
      setDeleteError(msg);
    } finally {
      setIsDeletingAnimal(false);
    }
  };

  const displayedAnimals = activeTab === 'corral' ? animalsInCorral : animals;

  return (
    <section
      aria-labelledby="h-animal"
      className={`rounded-2xl border border-card-border bg-card p-5 shadow-sm md:col-span-2 transition-all ${
        hasPresence ? 'ring-2 ring-destructive' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 id="h-animal" className="text-lg font-bold flex items-center gap-2">
          <PawPrint className="size-5" aria-hidden /> Presença (PIR)
        </h2>
        <div className="flex items-center gap-2">
          <span
            data-tone={isLive ? 'online' : 'sim'}
            className="font-mono text-[10px] uppercase tracking-wider rounded-full px-2 py-0.5 bg-accent/40 text-foreground border border-accent"
          >
            {isLive ? (corralName || 'Conectado') : 'Simulado'}
          </span>
          {isLive && farmId && (
            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition"
              title="Cadastrar novo animal na fazenda"
            >
              <Plus className="size-3.5" /> Novo
            </button>
          )}
        </div>
      </div>

      <p
        className={`mt-3 text-2xl font-extrabold pop ${
          hasPresence ? 'text-destructive' : 'text-primary'
        }`}
        key={String(hasPresence)}
        data-testid="status-presence"
        aria-live="polite"
      >
        {hasPresence ? 'Animal detectado' : 'Curral livre'}
      </p>

      {/* Continuous automatic RFID/MQTT detection indicator */}
      {isLive && (
        <div className="flex items-center gap-1.5 text-xs text-primary font-semibold mt-1">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
          </span>
          <span className="flex items-center gap-1">
            <Radio className="size-3" /> Detecção automática via RFID/MQTT ativa
          </span>
        </div>
      )}

      {isLive && (
        <p className="text-xs text-muted-foreground mt-0.5">
          {animalsInCorral.length === 1
            ? '1 animal atualmente no curral'
            : `${animalsInCorral.length} animais atualmente no curral`}
        </p>
      )}

      <button
        type="button"
        role="switch"
        aria-checked={hasPresence}
        onClick={handleToggleSwitch}
        data-testid="switch-presence"
        className="mt-4 w-full flex items-center justify-between gap-3 rounded-xl border-2 border-input px-4 py-3 text-left font-semibold transition active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <span>
          {isLive && animals.length > 0 ? 'Alternar presença manual' : 'Simular animal / movimento'}
        </span>
        <span
          className={`relative h-6 w-11 rounded-full transition-colors ${
            hasPresence ? 'bg-destructive' : 'bg-muted-foreground/40'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-card transition-transform ${
              hasPresence ? 'translate-x-5' : ''
            }`}
          />
        </span>
      </button>

      {/* Filterable farm/corral animal list */}
      {isLive && animals.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-1 bg-muted p-0.5 rounded-lg text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setActiveTab('corral')}
                className={`px-2 py-0.5 rounded-md transition ${
                  activeTab === 'corral'
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                No Curral ({animalsInCorral.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`px-2 py-0.5 rounded-md transition ${
                  activeTab === 'all'
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Todos ({animals.length})
              </button>
            </div>
            <span className="text-[10px] text-muted-foreground font-mono">
              Total: {animals.length}
            </span>
          </div>

          <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
            {displayedAnimals.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                {activeTab === 'corral'
                  ? 'Nenhum animal neste curral no momento.'
                  : 'Nenhum animal cadastrado nesta fazenda.'}
              </p>
            ) : (
              displayedAnimals.map((animal) => {
                const isInThisCorral = animal.currentCorralId === corralId;
                return (
                  <div
                    key={animal.id}
                    className="flex items-center justify-between gap-2 p-2 rounded-xl bg-muted/60 text-xs hover:bg-muted/90 transition"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-bold truncate">{animal.name}</p>
                        {isInThisCorral ? (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-primary/20 text-primary">
                            No Curral
                          </span>
                        ) : animal.currentCorralId ? (
                          <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-600">
                            {animal.currentCorralName || `Curral #${animal.currentCorralId}`}
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-muted text-muted-foreground">
                            Pasto
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground font-mono flex items-center gap-1 mt-0.5">
                        <TagIcon className="size-3" /> {animal.tagUid}
                        {animal.identification && ` • ${animal.identification}`}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {corralId && (
                        isInThisCorral ? (
                          <button
                            onClick={() => handlePresenceAction(animal.tagUid, 'SAIU', animal.name)}
                            disabled={actionLoadingId === -1}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-destructive/15 text-destructive font-semibold hover:bg-destructive/25 transition disabled:opacity-50"
                            title="Registrar saída manual deste animal"
                          >
                            <LogOut className="size-3" /> Saiu
                          </button>
                        ) : (
                          <button
                            onClick={() => handlePresenceAction(animal.tagUid, 'ENTROU', animal.name)}
                            disabled={actionLoadingId === -1}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/15 text-primary font-semibold hover:bg-primary/25 transition disabled:opacity-50"
                            title="Registrar entrada manual deste animal"
                          >
                            <LogIn className="size-3" /> Entrou
                          </button>
                        )
                      )}

                      <button
                        onClick={() => handleOpenEdit(animal)}
                        className="p-1 rounded-lg border border-input bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition"
                        title="Editar animal"
                      >
                        <Pencil className="size-3.5" />
                      </button>

                      <button
                        onClick={() => {
                          setDeleteError(null);
                          setDeletingAnimal(animal);
                        }}
                        className="p-1 rounded-lg border border-input bg-card text-muted-foreground hover:text-destructive hover:border-destructive/40 hover:bg-destructive/10 transition"
                        title="Excluir animal"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Biological safety lock notice */}
      <p className="mt-3 text-xs text-muted-foreground flex gap-1.5">
        <ShieldAlert className="size-4 shrink-0 text-destructive" aria-hidden />
        Com animal presente, toda lavagem é recusada e a bomba para na hora.
      </p>

      {/* Create/edit animal modal */}
      {showAddDialog && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
        >
          <div className="w-full max-w-md rounded-2xl bg-card border border-border p-6 shadow-xl relative">
            <button
              onClick={() => {
                setShowAddDialog(false);
                setEditingAnimal(null);
              }}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground p-1 rounded-lg"
              aria-label="Fechar"
            >
              <X className="size-5" />
            </button>

            <h3 className="text-xl font-bold flex items-center gap-2">
              <PawPrint className="size-5 text-primary" />
              {editingAnimal ? 'Editar Animal' : 'Cadastrar Novo Animal'}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {editingAnimal
                ? 'Atualize o nome, identificação de campo ou Tag RFID do animal.'
                : 'Vincule o nome, identificação de campo e Tag RFID do leitor ESP32.'}
            </p>

            {formError && (
              <div
                role="alert"
                className="mt-3 p-3 rounded-xl bg-destructive/15 border border-destructive/30 text-destructive text-xs flex items-center gap-2 font-medium"
              >
                <AlertCircle className="size-4 shrink-0" /> {formError}
              </div>
            )}

            {successMsg && (
              <div
                role="status"
                className="mt-3 p-3 rounded-xl bg-primary/15 border border-primary/30 text-primary text-xs flex items-center gap-2 font-semibold"
              >
                <CheckCircle2 className="size-4 shrink-0" /> {successMsg}
              </div>
            )}

            <form onSubmit={handleSaveAnimal} className="mt-4 space-y-3">
              <div>
                <label htmlFor="animal-name" className="block text-xs font-bold mb-1">
                  Nome do Animal *
                </label>
                <input
                  id="animal-name"
                  type="text"
                  required
                  minLength={2}
                  maxLength={50}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex.: Vaca Mimosa"
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-ring"
                />
                {fieldErrors.name && (
                  <p className="text-destructive text-xs mt-1">{fieldErrors.name}</p>
                )}
              </div>

              <div>
                <label htmlFor="animal-id" className="block text-xs font-bold mb-1">
                  Identificação / Brinco / Raça (Opcional)
                </label>
                <input
                  id="animal-id"
                  type="text"
                  maxLength={30}
                  value={identification}
                  onChange={(e) => setIdentification(e.target.value)}
                  placeholder="Ex.: BR-2026-01 ou Nelore"
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-ring"
                />
                {fieldErrors.identification && (
                  <p className="text-destructive text-xs mt-1">{fieldErrors.identification}</p>
                )}
              </div>

              <div>
                <label htmlFor="animal-tag" className="block text-xs font-bold mb-1">
                  Tag RFID UID *
                </label>
                <input
                  id="animal-tag"
                  type="text"
                  required
                  value={tagUid}
                  onChange={(e) => setTagUid(e.target.value.toUpperCase())}
                  placeholder="Ex.: 01020304"
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm font-mono focus-visible:outline-2 focus-visible:outline-ring uppercase"
                />
                {fieldErrors.tagUid && (
                  <p className="text-destructive text-xs mt-1">{fieldErrors.tagUid}</p>
                )}
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddDialog(false);
                    setEditingAnimal(null);
                  }}
                  className="px-4 py-2 rounded-xl border border-input text-sm font-semibold hover:bg-muted transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-bold flex items-center gap-1.5 hover:brightness-110 disabled:opacity-50 transition"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Salvando...
                    </>
                  ) : (
                    'Salvar Animal'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deletingAnimal && (
        <ConfirmDeleteDialog
          isOpen={Boolean(deletingAnimal)}
          title={`Excluir Animal "${deletingAnimal.name}"`}
          description={`Tem certeza que deseja excluir o cadastro do animal "${deletingAnimal.name}" (Tag: ${deletingAnimal.tagUid})?`}
          confirmLabel="Excluir Animal"
          isDeleting={isDeletingAnimal}
          errorMessage={deleteError}
          onConfirm={handleConfirmDelete}
          onClose={() => {
            setDeletingAnimal(null);
            setDeleteError(null);
          }}
          testId="dialog-delete-animal"
        />
      )}
    </section>
  );
};
