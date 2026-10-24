import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PendenciesModal, PendenciesAlertBanner } from '../../src/components/dashboard/PendenciesModal';
import { pendencyService } from '../../src/services/pendencyService';
import { animalService } from '../../src/services/animalService';
import { ApiError } from '../../src/services/apiClient';
import type { IdentifyPendencyResponseDTO, AnimalResponseDTO } from '../../src/types/api';

const pendency: IdentifyPendencyResponseDTO = {
  id: 201,
  corralId: 1,
  tagUid: 'CAFEBABE',
  typeEvent: 'ENTROU',
  instant: '2026-10-23T21:00:00',
  resolved: false,
  animalIdResolved: null,
  animalNameResolved: null,
  resolvedAt: null,
};

const createdAnimal: AnimalResponseDTO = {
  id: 77,
  farmId: 5,
  name: 'Boi Trovão',
  identification: 'BR-77',
  tagUid: 'CAFEBABE',
  currentCorralId: null,
  currentCorralName: null,
};

function renderModal(props: Partial<React.ComponentProps<typeof PendenciesModal>> = {}) {
  const onResolved = vi.fn();
  const onLogEvent = vi.fn();
  render(
    <PendenciesModal
      isOpen={true}
      onClose={vi.fn()}
      corralId={1}
      farmId={5}
      pendencies={[pendency]}
      farmAnimals={[]}
      onResolved={onResolved}
      onLogEvent={onLogEvent}
      {...props}
    />
  );
  return { onResolved, onLogEvent };
}

describe('Cadastro de animal a partir de RFID não identificado', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('exibe o botão "Cadastrar novo animal" para cada pendência quando há fazenda selecionada', () => {
    renderModal();
    expect(screen.getByTestId('button-add-animal-from-tag-201')).toBeInTheDocument();
  });

  it('não exibe o botão quando não há fazenda selecionada', () => {
    renderModal({ farmId: null });
    expect(screen.queryByTestId('button-add-animal-from-tag-201')).not.toBeInTheDocument();
  });

  it('cadastra o animal com a tag lida e resolve a pendência com o novo ID', async () => {
    const createSpy = vi.spyOn(animalService, 'createAnimal').mockResolvedValueOnce(createdAnimal);
    const resolveSpy = vi.spyOn(pendencyService, 'resolvePendency').mockResolvedValueOnce({
      ...pendency,
      resolved: true,
      animalIdResolved: 77,
      animalNameResolved: 'Boi Trovão',
      resolvedAt: '2026-10-23T21:05:00',
    });

    const { onResolved, onLogEvent } = renderModal();

    fireEvent.click(screen.getByTestId('button-add-animal-from-tag-201'));
    expect(screen.getByTestId('form-create-animal-201')).toHaveTextContent('CAFEBABE');

    fireEvent.change(screen.getByLabelText('Nome *'), { target: { value: 'Boi Trovão' } });
    fireEvent.change(screen.getByLabelText('Brinco / Identificação'), { target: { value: 'BR-77' } });
    fireEvent.click(screen.getByTestId('button-save-new-animal-201'));

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith(5, {
        name: 'Boi Trovão',
        identification: 'BR-77',
        tagUid: 'CAFEBABE',
      });
      expect(resolveSpy).toHaveBeenCalledWith(201, { animalId: 77 });
      expect(onResolved).toHaveBeenCalled();
      expect(onLogEvent).toHaveBeenCalledWith(
        'Pendência #201 resolvida: Tag CAFEBABE cadastrada como "Boi Trovão".',
        'ok'
      );
    });
    expect(screen.getByText('Resolvido')).toBeInTheDocument();
  });

  it('mostra o erro do backend e não resolve a pendência se o cadastro falhar', async () => {
    vi.spyOn(animalService, 'createAnimal').mockRejectedValueOnce(
      new ApiError({
        type: 'about:blank',
        title: 'Conflito de Regra de Negócio',
        status: 409,
        detail: 'Já existe um animal cadastrado com esta Tag RFID: CAFEBABE',
        instance: '/api/v1/farms/5/animais',
      })
    );
    const resolveSpy = vi.spyOn(pendencyService, 'resolvePendency');

    renderModal();
    fireEvent.click(screen.getByTestId('button-add-animal-from-tag-201'));
    fireEvent.change(screen.getByLabelText('Nome *'), { target: { value: 'Boi Trovão' } });
    fireEvent.click(screen.getByTestId('button-save-new-animal-201'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Já existe um animal cadastrado com esta Tag RFID');
    });
    expect(resolveSpy).not.toHaveBeenCalled();
  });

  it('avisa quando o animal foi criado mas a resolução falhou, e recarrega os dados', async () => {
    vi.spyOn(animalService, 'createAnimal').mockResolvedValueOnce(createdAnimal);
    vi.spyOn(pendencyService, 'resolvePendency').mockRejectedValueOnce(
      new ApiError({
        type: 'about:blank',
        title: 'Conflito de Regra de Negócio',
        status: 409,
        detail: 'Esta pendência de identificação já foi resolvida anteriormente',
        instance: '/api/v1/pendencias/201/resolver',
      })
    );

    const { onResolved } = renderModal();
    fireEvent.click(screen.getByTestId('button-add-animal-from-tag-201'));
    fireEvent.change(screen.getByLabelText('Nome *'), { target: { value: 'Boi Trovão' } });
    fireEvent.click(screen.getByTestId('button-save-new-animal-201'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('foi cadastrado, mas a pendência não foi resolvida');
      expect(onResolved).toHaveBeenCalled();
    });
  });

  it('abre direto com o formulário expandido quando openCreateOnFirst é true', () => {
    renderModal({ openCreateOnFirst: true });
    expect(screen.getByTestId('form-create-animal-201')).toBeInTheDocument();
  });

  it('o banner exibe o atalho "Cadastrar animal" e dispara onAddAnimal', () => {
    const onAddAnimal = vi.fn();
    render(<PendenciesAlertBanner pendenciesCount={1} onOpenModal={vi.fn()} onAddAnimal={onAddAnimal} />);
    fireEvent.click(screen.getByTestId('button-banner-add-animal'));
    expect(onAddAnimal).toHaveBeenCalledTimes(1);
  });
});
