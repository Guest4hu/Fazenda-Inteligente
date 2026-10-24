import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Dashboard from '../../src/pages/dashboard';
import { Header } from '../../src/components/dashboard/Header';
import { FarmModal } from '../../src/components/dashboard/FarmModal';
import { CorralModal } from '../../src/components/dashboard/CorralModal';
import { AnimalPresenceList } from '../../src/components/dashboard/AnimalPresenceList';
import { FarmCorralProvider } from '../../src/context/FarmCorralContext';
import { AuthProvider } from '../../src/context/AuthContext';
import { farmService } from '../../src/services/farmService';
import { corralService } from '../../src/services/corralService';
import { animalService } from '../../src/services/animalService';
import type { FarmResponseDTO, CorralResponseDTO, AnimalResponseDTO } from '../../src/types/api';

describe('Auto-Detection & Record Editing / Deletion Feature Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  const sampleFarm: FarmResponseDTO = {
    id: 1,
    name: 'Fazenda Santa Luzia',
    createdAt: '2026-10-23T10:00:00',
  };

  const sampleCorral: CorralResponseDTO = {
    id: 10,
    farmId: 1,
    name: 'Curral Principal',
    macAddress: '240AC4000110',
    cleanTime: '06:30:00',
    limitOdor: 400,
    pumpDurationSeconds: 30,
    deviceStatus: 'ONLINE',
    lastSeenAt: '2026-10-23T12:00:00',
  };

  const sampleAnimal1: AnimalResponseDTO = {
    id: 101,
    farmId: 1,
    name: 'Mimosa',
    identification: 'BR-101',
    tagUid: 'RFID-101',
    currentCorralId: 10,
    currentCorralName: 'Curral Principal',
  };

  const sampleAnimal2: AnimalResponseDTO = {
    id: 102,
    farmId: 1,
    name: 'Bandido',
    identification: 'BR-102',
    tagUid: 'RFID-102',
    currentCorralId: null,
    currentCorralName: null,
  };

  // ==========================================================================
  // 1. Detecção Automática de Presença sem precisar clicar no switch
  // ==========================================================================
  describe('1. Detecção Automática de Presença RFID/MQTT', () => {
    it('1.1: Animal detectado automaticamente na tela via lista de animais do servidor sem clique manual', () => {
      render(
        <AnimalPresenceList
          isLive={true}
          corralId={10}
          farmId={1}
          corralName="Curral Principal"
          animals={[sampleAnimal1, sampleAnimal2]}
        />
      );

      // Status automaticamente passa para "Animal detectado" porque sampleAnimal1 está no curral 10
      expect(screen.getByTestId('status-presence')).toHaveTextContent('Animal detectado');
      expect(screen.getByText('Detecção automática via RFID/MQTT ativa')).toBeInTheDocument();
      expect(screen.getByText('1 animal atualmente no curral')).toBeInTheDocument();
      expect(screen.getByText('Mimosa')).toBeInTheDocument();
    });

    it('1.2: Curral livre é exibido automaticamente quando nenhum animal está no curral', () => {
      render(
        <AnimalPresenceList
          isLive={true}
          corralId={10}
          farmId={1}
          corralName="Curral Principal"
          animals={[sampleAnimal2]} // sampleAnimal2 has currentCorralId: null
        />
      );

      expect(screen.getByTestId('status-presence')).toHaveTextContent('Curral livre');
      expect(screen.getByText('0 animais atualmente no curral')).toBeInTheDocument();
    });

    it('1.3: Permite visualizar todos os animais da fazenda e filtrar por "No Curral" vs "Todos"', () => {
      render(
        <AnimalPresenceList
          isLive={true}
          corralId={10}
          farmId={1}
          animals={[sampleAnimal1, sampleAnimal2]}
        />
      );

      // Inicialmente na aba "No Curral"
      expect(screen.getByText('Mimosa')).toBeInTheDocument();
      expect(screen.queryByText('Bandido')).not.toBeInTheDocument();

      // Clica em "Todos"
      const todosBtn = screen.getByRole('button', { name: /Todos \(2\)/i });
      fireEvent.click(todosBtn);

      // Agora ambos os animais aparecem
      expect(screen.getByText('Mimosa')).toBeInTheDocument();
      expect(screen.getByText('Bandido')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // 2. Edição e Exclusão de Animais
  // ==========================================================================
  describe('2. Gestão Completa de Animais (Editar e Excluir)', () => {
    it('2.1: Permite editar um animal existente (PUT /api/v1/animais/{id})', async () => {
      const updateSpy = vi.spyOn(animalService, 'updateAnimal').mockResolvedValueOnce({
        ...sampleAnimal1,
        name: 'Mimosa Atualizada',
        identification: 'BR-101-NEW',
      });
      const handleRefresh = vi.fn();

      render(
        <AnimalPresenceList
          isLive={true}
          corralId={10}
          farmId={1}
          animals={[sampleAnimal1]}
          onRefresh={handleRefresh}
        />
      );

      // Clica no botão de editar animal (pencil)
      const editBtn = screen.getByTitle('Editar animal');
      fireEvent.click(editBtn);

      // Diálogo de edição é aberto com dados preenchidos
      expect(screen.getByText('Editar Animal')).toBeInTheDocument();
      const nameInput = screen.getByLabelText(/Nome do Animal/i);
      expect(nameInput).toHaveValue('Mimosa');

      // Altera o nome
      fireEvent.change(nameInput, { target: { value: 'Mimosa Atualizada' } });
      const submitBtn = screen.getByRole('button', { name: /Salvar/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(updateSpy).toHaveBeenCalledWith(
          101,
          {
            name: 'Mimosa Atualizada',
            identification: 'BR-101',
            tagUid: 'RFID-101',
          },
          1
        );
        expect(handleRefresh).toHaveBeenCalled();
      });
    });

    it('2.2: Permite excluir um animal existente (DELETE /api/v1/animais/{id})', async () => {
      const deleteSpy = vi.spyOn(animalService, 'deleteAnimal').mockResolvedValueOnce();
      const handleRefresh = vi.fn();

      render(
        <AnimalPresenceList
          isLive={true}
          corralId={10}
          farmId={1}
          animals={[sampleAnimal1]}
          onRefresh={handleRefresh}
        />
      );

      // Clica no botão de excluir animal (trash)
      const trashBtn = screen.getByTitle('Excluir animal');
      fireEvent.click(trashBtn);

      // Abre diálogo de confirmação
      expect(screen.getByTestId('dialog-delete-animal')).toBeInTheDocument();
      expect(screen.getByText(/Excluir Animal "Mimosa"/i)).toBeInTheDocument();

      // Confirma exclusão
      const confirmBtn = screen.getByRole('button', { name: 'Excluir Animal' });
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(deleteSpy).toHaveBeenCalledWith(101, 1);
        expect(handleRefresh).toHaveBeenCalled();
      });
    });

    it('2.3: Permite registrar entrada manual de animal que estava fora do curral', async () => {
      const presenceSpy = vi.spyOn(animalService, 'sendPresence').mockResolvedValueOnce({
        id: 200,
        corralId: 10,
        corralName: 'Curral Principal',
        animalId: 102,
        animalName: 'Bandido',
        tagUid: 'RFID-102',
        typeEvent: 'ENTROU',
        eventOrigin: 'MANUAL',
        instant: new Date().toISOString(),
      });
      const handleRefresh = vi.fn();

      render(
        <AnimalPresenceList
          isLive={true}
          corralId={10}
          farmId={1}
          animals={[sampleAnimal1, sampleAnimal2]}
          onRefresh={handleRefresh}
        />
      );

      // Muda para aba "Todos" para ver o animal que está fora
      fireEvent.click(screen.getByRole('button', { name: /Todos/i }));

      // Clica no botão "Entrou" do Bandido
      const enterBtn = screen.getByTitle('Registrar entrada manual deste animal');
      fireEvent.click(enterBtn);

      await waitFor(() => {
        expect(presenceSpy).toHaveBeenCalledWith(10, {
          tagUid: 'RFID-102',
          typeEvent: 'ENTROU',
          origin: 'MANUAL',
        });
        expect(handleRefresh).toHaveBeenCalled();
      });
    });
  });

  // ==========================================================================
  // 3. Edição e Exclusão de Fazendas e Currais no Header
  // ==========================================================================
  describe('3. Edição e Exclusão de Fazendas e Currais no Header', () => {
    it('3.1: Exibe botões de editar e excluir fazenda quando fazenda está selecionada', () => {
      render(
        <Header
          isAuthenticated={true}
          user={{ id: 1, name: 'Admin', email: 'admin@fazenda.com' }}
          farms={[sampleFarm]}
          selectedFarmId={1}
          corrais={[sampleCorral]}
          selectedCorralId={10}
        />
      );

      expect(screen.getByTestId('button-editar-fazenda')).toBeInTheDocument();
      expect(screen.getByTestId('button-excluir-fazenda')).toBeInTheDocument();
      expect(screen.getByTestId('button-editar-corral')).toBeInTheDocument();
      expect(screen.getByTestId('button-excluir-corral')).toBeInTheDocument();
    });

    it('3.2: Abre FarmModal em modo edição e atualiza nome da fazenda (PUT /api/v1/farms/{id})', async () => {
      const updateFarmSpy = vi.spyOn(farmService, 'updateFarm').mockResolvedValueOnce({
        ...sampleFarm,
        name: 'Fazenda Santa Luzia Nova',
      });
      const handleRefreshAll = vi.fn();

      render(
        <Header
          isAuthenticated={true}
          user={{ id: 1, name: 'Admin', email: 'admin@fazenda.com' }}
          farms={[sampleFarm]}
          selectedFarmId={1}
          corrais={[]}
          selectedCorralId={null}
          onRefreshAll={handleRefreshAll}
        />
      );

      // Clica para editar fazenda
      fireEvent.click(screen.getByTestId('button-editar-fazenda'));

      expect(screen.getByTestId('modal-farm')).toBeInTheDocument();
      expect(screen.getByText('Editar Fazenda')).toBeInTheDocument();

      const nameInput = screen.getByTestId('input-farm-name');
      expect(nameInput).toHaveValue('Fazenda Santa Luzia');

      fireEvent.change(nameInput, { target: { value: 'Fazenda Santa Luzia Nova' } });
      fireEvent.click(screen.getByTestId('button-farm-submit'));

      await waitFor(() => {
        expect(updateFarmSpy).toHaveBeenCalledWith(1, { name: 'Fazenda Santa Luzia Nova' });
        expect(handleRefreshAll).toHaveBeenCalled();
      });
    });

    it('3.3: Abre diálogo de confirmação e exclui fazenda (DELETE /api/v1/farms/{id})', async () => {
      const deleteFarmSpy = vi.spyOn(farmService, 'deleteFarm').mockResolvedValueOnce();
      const handleRefreshAll = vi.fn();

      render(
        <Header
          isAuthenticated={true}
          user={{ id: 1, name: 'Admin', email: 'admin@fazenda.com' }}
          farms={[sampleFarm]}
          selectedFarmId={1}
          corrais={[]}
          selectedCorralId={null}
          onRefreshAll={handleRefreshAll}
        />
      );

      fireEvent.click(screen.getByTestId('button-excluir-fazenda'));

      expect(screen.getByTestId('dialog-delete-farm')).toBeInTheDocument();
      expect(screen.getByText(/Excluir Fazenda "Fazenda Santa Luzia"/i)).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('button-confirm-delete'));

      await waitFor(() => {
        expect(deleteFarmSpy).toHaveBeenCalledWith(1);
        expect(handleRefreshAll).toHaveBeenCalled();
      });
    });

    it('3.4: Abre CorralModal em modo edição e atualiza curral (PUT /api/v1/currais/{id})', async () => {
      const updateCorralSpy = vi.spyOn(corralService, 'updateCorral').mockResolvedValueOnce({
        ...sampleCorral,
        name: 'Curral Principal Atualizado',
      });
      const handleRefreshAll = vi.fn();

      render(
        <Header
          isAuthenticated={true}
          user={{ id: 1, name: 'Admin', email: 'admin@fazenda.com' }}
          farms={[sampleFarm]}
          selectedFarmId={1}
          corrais={[sampleCorral]}
          selectedCorralId={10}
          onRefreshAll={handleRefreshAll}
        />
      );

      fireEvent.click(screen.getByTestId('button-editar-corral'));

      expect(screen.getByTestId('modal-corral')).toBeInTheDocument();
      expect(screen.getByText('Editar Curral')).toBeInTheDocument();

      const nameInput = screen.getByTestId('input-corral-name');
      expect(nameInput).toHaveValue('Curral Principal');

      fireEvent.change(nameInput, { target: { value: 'Curral Principal Atualizado' } });
      fireEvent.click(screen.getByTestId('button-corral-submit'));

      await waitFor(() => {
        expect(updateCorralSpy).toHaveBeenCalledWith(
          10,
          expect.objectContaining({ name: 'Curral Principal Atualizado' }),
          1
        );
        expect(handleRefreshAll).toHaveBeenCalled();
      });
    });

    it('3.5: Abre diálogo de confirmação e exclui curral (DELETE /api/v1/currais/{id})', async () => {
      const deleteCorralSpy = vi.spyOn(corralService, 'deleteCorral').mockResolvedValueOnce();
      const handleRefreshAll = vi.fn();

      render(
        <Header
          isAuthenticated={true}
          user={{ id: 1, name: 'Admin', email: 'admin@fazenda.com' }}
          farms={[sampleFarm]}
          selectedFarmId={1}
          corrais={[sampleCorral]}
          selectedCorralId={10}
          onRefreshAll={handleRefreshAll}
        />
      );

      fireEvent.click(screen.getByTestId('button-excluir-corral'));

      expect(screen.getByTestId('dialog-delete-corral')).toBeInTheDocument();
      expect(screen.getByText(/Excluir Curral "Curral Principal"/i)).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('button-confirm-delete'));

      await waitFor(() => {
        expect(deleteCorralSpy).toHaveBeenCalledWith(10);
        expect(handleRefreshAll).toHaveBeenCalled();
      });
    });
  });
});
