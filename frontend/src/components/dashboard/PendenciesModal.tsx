import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Radio,
  X,
  CheckCircle,
  Loader2,
  AlertCircle,
  UserCheck,
  Calendar,
  PlusCircle,
  Tag as TagIcon,
} from 'lucide-react';
import { pendencyService } from '../../services/pendencyService';
import { animalService } from '../../services/animalService';
import { ApiError } from '../../services/apiClient';
import type {
  IdentifyPendencyResponseDTO,
  AnimalResponseDTO,
} from '../../types/api';

type LogFn = (msg: string, kind?: 'info' | 'ok' | 'warn' | 'danger') => void;

export interface PendenciesModalProps {
  isOpen: boolean;
  onClose: () => void;
  corralId: number | null;
  /** Parent farm of the selected corral, required to register a new animal from the tag. */
  farmId?: number | null;
  pendencies: IdentifyPendencyResponseDTO[];
  farmAnimals: AnimalResponseDTO[];
  onResolved: () => Promise<void> | void;
  onLogEvent?: LogFn;
  /** When true, opens the modal with the registration form expanded on the newest pendency. */
  openCreateOnFirst?: boolean;
}

interface CreateAnimalFromTagFormProps {
  farmId: number;
  pendency: IdentifyPendencyResponseDTO;
  onCancel: () => void;
  onCreatedAndResolved: (animalName: string) => Promise<void> | void;
  onAnimalCreated: () => Promise<void> | void;
  onLogEvent?: LogFn;
}

/**
 * Inline two-step recovery form: creates a new animal bound to an unrecognized
 * RFID tag and immediately resolves the open identification pendency.
 */
const CreateAnimalFromTagForm: React.FC<CreateAnimalFromTagFormProps> = ({
  farmId,
  pendency,
  onCancel,
  onCreatedAndResolved,
  onAnimalCreated,
  onLogEvent,
}) => {
  const [name, setName] = useState('');
  const [identification, setIdentification] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);
    setFieldErrors({});

    // Step 1: create the animal bound to the tag read by the ESP32
    let created: AnimalResponseDTO;
    try {
      created = await animalService.createAnimal(farmId, {
        name: name.trim(),
        identification: identification.trim() || null,
        tagUid: pendency.tagUid,
      });
      onLogEvent?.(`Novo animal cadastrado a partir da tag ${pendency.tagUid}: ${created.name}.`, 'ok');
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.invalidParams) setFieldErrors(err.invalidParams);
        setFormError(err.detail || err.title || 'Erro ao cadastrar o animal.');
      } else {
        setFormError('Ocorreu um erro inesperado ao cadastrar o animal.');
      }
      setIsSubmitting(false);
      return;
    }

    // Step 2: resolve the identification pendency linking the newly created animal
    try {
      await pendencyService.resolvePendency(pendency.id, { animalId: created.id });
      await onCreatedAndResolved(created.name);
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.detail : 'Erro ao resolver a pendência.';
      setFormError(
        `Animal "${created.name}" foi cadastrado, mas a pendência não foi resolvida: ${msg} ` +
          'Selecione o animal na lista acima para vincular manualmente.'
      );
      onLogEvent?.(`Falha ao resolver pendência #${pendency.id}: ${msg}`, 'danger');
      await onAnimalCreated();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      data-testid={`form-create-animal-${pendency.id}`}
      className="mt-3 p-3 rounded-xl border border-primary/30 bg-card space-y-2.5"
    >
      <p className="text-xs font-bold flex items-center gap-1.5">
        <PlusCircle className="size-3.5 text-primary" /> Cadastrar novo animal com esta tag
      </p>

      {formError && (
        <div
          role="alert"
          className="text-xs font-semibold text-destructive flex items-start gap-1 bg-destructive/10 p-2 rounded-lg"
        >
          <AlertCircle className="size-3.5 shrink-0 mt-0.5" /> {formError}
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-3">
        <div>
          <label htmlFor={`new-animal-tag-${pendency.id}`} className="block text-[11px] font-bold mb-0.5">
            Tag RFID
          </label>
          <div
            id={`new-animal-tag-${pendency.id}`}
            className="w-full rounded-lg border border-input bg-muted px-2.5 py-1.5 text-xs font-mono flex items-center gap-1"
          >
            <TagIcon className="size-3" /> {pendency.tagUid}
          </div>
        </div>

        <div>
          <label htmlFor={`new-animal-name-${pendency.id}`} className="block text-[11px] font-bold mb-0.5">
            Nome *
          </label>
          <input
            id={`new-animal-name-${pendency.id}`}
            type="text"
            required
            minLength={2}
            maxLength={50}
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Vaca Mimosa"
            disabled={isSubmitting}
            className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs focus-visible:outline-2 focus-visible:outline-ring"
          />
          {fieldErrors.name && <p className="text-destructive text-[11px] mt-0.5">{fieldErrors.name}</p>}
        </div>

        <div>
          <label htmlFor={`new-animal-ident-${pendency.id}`} className="block text-[11px] font-bold mb-0.5">
            Brinco / Identificação
          </label>
          <input
            id={`new-animal-ident-${pendency.id}`}
            type="text"
            maxLength={30}
            value={identification}
            onChange={(e) => setIdentification(e.target.value)}
            placeholder="Opcional"
            disabled={isSubmitting}
            className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs focus-visible:outline-2 focus-visible:outline-ring"
          />
          {fieldErrors.identification && (
            <p className="text-destructive text-[11px] mt-0.5">{fieldErrors.identification}</p>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="px-3 py-1.5 rounded-lg border border-input text-xs font-semibold hover:bg-muted transition disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          data-testid={`button-save-new-animal-${pendency.id}`}
          className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold flex items-center gap-1.5 hover:brightness-110 disabled:opacity-50 transition"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="size-3.5 animate-spin" /> Salvando...
            </>
          ) : (
            <>
              <CheckCircle className="size-3.5" /> Cadastrar e Resolver
            </>
          )}
        </button>
      </div>
    </form>
  );
};

/**
 * Modal for resolving unknown RFID tag pendencies either by linking an
 * existing animal or by running the inline create-and-resolve workflow.
 */
export const PendenciesModal: React.FC<PendenciesModalProps> = ({
  isOpen,
  onClose,
  corralId,
  farmId = null,
  pendencies,
  farmAnimals,
  onResolved,
  onLogEvent,
  openCreateOnFirst = false,
}) => {
  // Selection map: pendencyId -> animalId
  const [selectedAnimals, setSelectedAnimals] = useState<Record<number, number>>({});
  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const [errorMap, setErrorMap] = useState<Record<number, string>>({});
  const [successId, setSuccessId] = useState<number | null>(null);
  // Pendency ID whose inline "create new animal" form is expanded
  const [creatingForId, setCreatingForId] = useState<number | null>(null);

  // When opened via the banner's "Cadastrar animal" shortcut, expand the first pendency's creation form
  useEffect(() => {
    if (!isOpen) {
      setCreatingForId(null);
      return;
    }
    if (openCreateOnFirst && farmId && pendencies.length > 0) {
      setCreatingForId(pendencies[0].id);
    }
    // Run only when the modal opens or closes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCreatedAndResolved = async (pendency: IdentifyPendencyResponseDTO, animalName: string) => {
    setCreatingForId(null);
    setSuccessId(pendency.id);
    onLogEvent?.(
      `Pendência #${pendency.id} resolvida: Tag ${pendency.tagUid} cadastrada como "${animalName}".`,
      'ok'
    );
    await onResolved();
  };

  const handleSelectAnimal = (pendencyId: number, animalId: number) => {
    setSelectedAnimals((prev) => ({ ...prev, [pendencyId]: animalId }));
    setErrorMap((prev) => ({ ...prev, [pendencyId]: '' }));
  };

  const handleResolve = async (pendency: IdentifyPendencyResponseDTO) => {
    const chosenAnimalId = selectedAnimals[pendency.id];
    if (!chosenAnimalId) {
      setErrorMap((prev) => ({
        ...prev,
        [pendency.id]: 'Selecione um animal para associar a esta Tag RFID.',
      }));
      return;
    }

    setResolvingId(pendency.id);
    setErrorMap((prev) => ({ ...prev, [pendency.id]: '' }));

    try {
      const resolved = await pendencyService.resolvePendency(pendency.id, {
        animalId: chosenAnimalId,
      });

      setSuccessId(pendency.id);
      const animalName = resolved.animalNameResolved || 'Animal';
      onLogEvent?.(
        `Pendência #${pendency.id} resolvida: Tag ${pendency.tagUid} associada a "${animalName}".`,
        'ok'
      );

      await onResolved();
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.detail : 'Erro ao resolver pendência.';
      setErrorMap((prev) => ({ ...prev, [pendency.id]: msg }));
      onLogEvent?.(`Falha ao resolver pendência: ${msg}`, 'danger');
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
    >
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-card border border-border p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground p-1 rounded-lg"
          aria-label="Fechar"
        >
          <X className="size-5" />
        </button>

        <div className="flex items-center gap-2.5 pb-2">
          <div className="p-2 rounded-xl bg-amber-500/15 text-amber-600">
            <Radio className="size-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold">Pendências de Identificação RFID</h3>
            <p className="text-xs text-muted-foreground">
              Tags lidas pelo ESP32 que ainda não estavam associadas a nenhum animal.
            </p>
          </div>
        </div>

        {/* Open pendency list */}
        <div className="mt-4 flex-1 overflow-y-auto space-y-3 pr-1">
          {pendencies.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              <CheckCircle className="size-8 mx-auto text-primary mb-2" />
              Nenhuma pendência aberta no momento. Todas as leituras RFID estão identificadas!
            </div>
          ) : (
            pendencies.map((p) => {
              const isResolving = resolvingId === p.id;
              const error = errorMap[p.id];
              const isDone = successId === p.id;

              return (
                <div
                  key={p.id}
                  className={`p-4 rounded-xl border transition-all ${
                    isDone
                      ? 'bg-primary/10 border-primary/40'
                      : 'bg-muted/40 border-border hover:border-accent'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm bg-card px-2 py-0.5 rounded border border-border">
                          Tag UID: {p.tagUid}
                        </span>
                        <span
                          className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            p.typeEvent === 'ENTROU'
                              ? 'bg-primary/20 text-primary'
                              : 'bg-accent/40 text-accent-foreground'
                          }`}
                        >
                          {p.typeEvent === 'ENTROU' ? 'Entrada Detectada' : 'Saída Detectada'}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <Calendar className="size-3" />
                        Detectado em: {new Date(p.instant).toLocaleString('pt-BR')}
                      </p>
                    </div>

                    {isDone && (
                      <span className="text-xs font-bold text-primary flex items-center gap-1">
                        <CheckCircle className="size-4" /> Resolvido
                      </span>
                    )}
                  </div>

                  {error && (
                    <div
                      role="alert"
                      className="mt-2 text-xs font-semibold text-destructive flex items-center gap-1 bg-destructive/10 p-2 rounded-lg"
                    >
                      <AlertCircle className="size-3.5 shrink-0" /> {error}
                    </div>
                  )}

                  {!isDone && (
                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      <label htmlFor={`select-animal-${p.id}`} className="sr-only">
                        Selecione o animal para vincular à Tag {p.tagUid}
                      </label>
                      <select
                        id={`select-animal-${p.id}`}
                        value={selectedAnimals[p.id] || ''}
                        onChange={(e) => handleSelectAnimal(p.id, Number(e.target.value))}
                        disabled={isResolving}
                        className="flex-1 min-w-[200px] rounded-xl border border-input bg-background px-3 py-2 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-ring"
                      >
                        <option value="">Selecione o animal da fazenda...</option>
                        {farmAnimals.map((animal) => (
                          <option key={animal.id} value={animal.id}>
                            {animal.name} ({animal.identification || 'Sem brinco'}) — Tag atual: {animal.tagUid}
                          </option>
                        ))}
                      </select>

                      <button
                        onClick={() => handleResolve(p)}
                        disabled={isResolving}
                        className="rounded-xl bg-primary text-primary-foreground text-xs font-bold px-3.5 py-2 flex items-center gap-1.5 hover:brightness-110 disabled:opacity-50 transition"
                      >
                        {isResolving ? (
                          <>
                            <Loader2 className="size-3.5 animate-spin" /> Vinculando...
                          </>
                        ) : (
                          <>
                            <UserCheck className="size-3.5" /> Vincular e Resolver
                          </>
                        )}
                      </button>

                      {farmId && creatingForId !== p.id && (
                        <button
                          type="button"
                          onClick={() => setCreatingForId(p.id)}
                          disabled={isResolving}
                          data-testid={`button-add-animal-from-tag-${p.id}`}
                          title="Cadastrar um novo animal usando esta Tag RFID"
                          className="rounded-xl border border-primary/40 bg-primary/10 text-primary text-xs font-bold px-3.5 py-2 flex items-center gap-1.5 hover:bg-primary/20 disabled:opacity-50 transition"
                        >
                          <PlusCircle className="size-3.5" /> Cadastrar novo animal
                        </button>
                      )}
                    </div>
                  )}

                  {!isDone && farmId && creatingForId === p.id && (
                    <CreateAnimalFromTagForm
                      farmId={farmId}
                      pendency={p}
                      onCancel={() => setCreatingForId(null)}
                      onCreatedAndResolved={(animalName) => handleCreatedAndResolved(p, animalName)}
                      onAnimalCreated={onResolved}
                      onLogEvent={onLogEvent}
                    />
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="mt-4 pt-3 border-t border-border flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-muted text-foreground text-sm font-semibold hover:bg-muted/80 transition"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Dashboard alert banner displayed when unresolved unknown RFID tag pendencies
 * exist, providing direct access to modal resolution or quick animal creation.
 */
export function PendenciesAlertBanner({
  pendenciesCount,
  onOpenModal,
  onAddAnimal,
}: {
  pendenciesCount: number;
  onOpenModal: () => void;
  /** Shortcut that opens the modal directly on the animal registration form for the unknown tag. */
  onAddAnimal?: () => void;
}) {
  if (pendenciesCount <= 0) return null;

  return (
    <div
      role="alert"
      className="rounded-xl border border-amber-400 bg-amber-500/15 p-3 text-foreground flex items-center justify-between gap-3 shadow-xs flex-wrap"
    >
      <div className="flex items-center gap-2.5">
        <AlertTriangle className="size-5 text-amber-600 shrink-0" />
        <div>
          <p className="font-bold text-sm">
            {pendenciesCount === 1
              ? '1 Leitura RFID desconhecida pendente de identificação'
              : `${pendenciesCount} Leituras RFID desconhecidas pendentes de identificação`}
          </p>
          <p className="text-xs text-muted-foreground">
            O leitor do ESP32 detectou tags não cadastradas. Cadastre um novo animal ou associe a um existente.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {onAddAnimal && (
          <button
            onClick={onAddAnimal}
            data-testid="button-banner-add-animal"
            className="rounded-lg border border-amber-600 bg-card text-amber-700 px-3 py-1.5 text-xs font-bold hover:bg-amber-50 transition flex items-center gap-1"
          >
            <PlusCircle className="size-3.5" /> Cadastrar animal
          </button>
        )}
        <button
          onClick={onOpenModal}
          className="rounded-lg bg-amber-600 text-white px-3 py-1.5 text-xs font-bold hover:bg-amber-700 transition"
        >
          Resolver ({pendenciesCount})
        </button>
      </div>
    </div>
  );
}
