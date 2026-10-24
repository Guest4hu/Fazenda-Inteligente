import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnimalPresenceList } from '../../src/components/dashboard/AnimalPresenceList';
import { animalService } from '../../src/services/animalService';
import { ApiError } from '../../src/services/apiClient';
import type { AnimalResponseDTO } from '../../src/types/api';

describe('AnimalPresenceList Component - RFID & Biological Safety', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const sampleAnimals: AnimalResponseDTO[] = [
    {
      id: 1,
      farmId: 10,
      name: 'Vaca Mimosa',
      identification: 'BR-01',
      tagUid: '01020304',
      currentCorralId: 5,
      currentCorralName: 'Curral 1',
    },
    {
      id: 2,
      farmId: 10,
      name: 'Touro Bandido',
      identification: 'BR-02',
      tagUid: '05060708',
      currentCorralId: null,
      currentCorralName: null,
    },
  ];

  it('renders initial presence status as Curral livre when empty', () => {
    render(<AnimalPresenceList isLive={false} presenceSimulated={false} />);

    expect(screen.getByTestId('status-presence')).toHaveTextContent('Curral livre');
    expect(screen.getByTestId('switch-presence')).toHaveAttribute('aria-checked', 'false');
  });

  it('toggles presence switch and updates to Animal detectado', () => {
    const handleToggle = vi.fn();

    render(
      <AnimalPresenceList
        isLive={false}
        presenceSimulated={false}
        onTogglePresenceSimulated={handleToggle}
      />
    );

    fireEvent.click(screen.getByTestId('switch-presence'));
    expect(handleToggle).toHaveBeenCalledTimes(1);
  });

  it('displays animals currently in corral and triggers manual exit (SAIU)', async () => {
    const presenceSpy = vi.spyOn(animalService, 'sendPresence').mockResolvedValueOnce({
      id: 99,
      corralId: 5,
      corralName: 'Curral 1',
      animalId: 1,
      animalName: 'Vaca Mimosa',
      tagUid: '01020304',
      typeEvent: 'SAIU',
      eventOrigin: 'MANUAL',
      instant: new Date().toISOString(),
    });

    const handleRefresh = vi.fn();
    const handleLog = vi.fn();

    render(
      <AnimalPresenceList
        isLive={true}
        corralId={5}
        farmId={10}
        animals={sampleAnimals}
        onRefresh={handleRefresh}
        onLogEvent={handleLog}
      />
    );

    // Vaca Mimosa está no curral 5
    expect(screen.getByTestId('status-presence')).toHaveTextContent('Animal detectado');
    expect(screen.getByText('Vaca Mimosa')).toBeInTheDocument();
    expect(screen.getByText(/01020304/)).toBeInTheDocument();

    const exitBtn = screen.getByTitle('Registrar saída manual deste animal');
    fireEvent.click(exitBtn);

    await waitFor(() => {
      expect(presenceSpy).toHaveBeenCalledWith(5, {
        tagUid: '01020304',
        typeEvent: 'SAIU',
        origin: 'MANUAL',
      });
      expect(handleLog).toHaveBeenCalledWith(
        'Saída manual registrada: Vaca Mimosa (Tag: 01020304).',
        'info'
      );
      expect(handleRefresh).toHaveBeenCalled();
    });
  });

  it('opens dialog and registers new animal via animalService.createAnimal', async () => {
    const createSpy = vi.spyOn(animalService, 'createAnimal').mockResolvedValueOnce({
      id: 3,
      farmId: 10,
      name: 'Bezerro Estrela',
      identification: 'BR-03',
      tagUid: 'AABBCCDD',
      currentCorralId: null,
      currentCorralName: null,
    });

    const handleRefresh = vi.fn();
    const handleLog = vi.fn();

    render(
      <AnimalPresenceList
        isLive={true}
        corralId={5}
        farmId={10}
        animals={sampleAnimals}
        onRefresh={handleRefresh}
        onLogEvent={handleLog}
      />
    );

    // Abre diálogo de novo animal
    fireEvent.click(screen.getByTitle('Cadastrar novo animal na fazenda'));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Cadastrar Novo Animal')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Nome do Animal/i), {
      target: { value: 'Bezerro Estrela' },
    });
    fireEvent.change(screen.getByLabelText(/Identificação/i), {
      target: { value: 'BR-03' },
    });
    fireEvent.change(screen.getByLabelText(/Tag RFID UID/i), {
      target: { value: 'aabbccdd' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Salvar Animal' }));

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith(10, {
        name: 'Bezerro Estrela',
        identification: 'BR-03',
        tagUid: 'AABBCCDD',
      });
      expect(screen.getByRole('status')).toHaveTextContent(
        'Animal "Bezerro Estrela" cadastrado com sucesso!'
      );
      expect(handleRefresh).toHaveBeenCalled();
    });
  });

  it('displays RFC 7807 validation error when animal registration fails', async () => {
    vi.spyOn(animalService, 'createAnimal').mockRejectedValueOnce(
      new ApiError({
        type: 'about:blank',
        title: 'Conflict',
        status: 409,
        detail: 'Já existe um animal cadastrado com esta Tag RFID.',
        instance: '/api/v1/farms/10/animais',
      })
    );

    render(
      <AnimalPresenceList
        isLive={true}
        corralId={5}
        farmId={10}
        animals={sampleAnimals}
      />
    );

    fireEvent.click(screen.getByTitle('Cadastrar novo animal na fazenda'));

    fireEvent.change(screen.getByLabelText(/Nome do Animal/i), {
      target: { value: 'Animal Duplicado' },
    });
    fireEvent.change(screen.getByLabelText(/Tag RFID UID/i), {
      target: { value: '01020304' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Salvar Animal' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Já existe um animal cadastrado com esta Tag RFID.'
      );
    });
  });
});
