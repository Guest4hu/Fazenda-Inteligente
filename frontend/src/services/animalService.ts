/**
 * src/services/animalService.ts
 * Gestão de Animais da Fazenda, Identificação RFID e Eventos de Presença (ENTROU/SAIU).
 */

import { apiClient } from './apiClient';
import type {
  AnimalRequestDTO,
  AnimalResponseDTO,
  AnimalPresenceRequestDTO,
  AnimalEventResponseDTO,
} from '../types/api';

/**
 * Lista todos os animais de uma fazenda com indicação do curral atual.
 * Endpoint: GET /api/v1/farms/{farmId}/animais
 */
export async function listAnimals(farmId: number): Promise<AnimalResponseDTO[]> {
  const safeFarmId = encodeURIComponent(String(farmId));
  return apiClient<AnimalResponseDTO[]>(`/farms/${safeFarmId}/animais`, {
    method: 'GET',
  });
}

/**
 * Busca detalhes de um animal por ID (rota direta ou aninhada).
 * Endpoint: GET /api/v1/animais/{animalId} ou GET /api/v1/farms/{farmId}/animais/{animalId}
 */
export async function getAnimal(animalId: number, farmId?: number): Promise<AnimalResponseDTO> {
  const safeAnimalId = encodeURIComponent(String(animalId));
  const endpoint = farmId !== undefined
    ? `/farms/${encodeURIComponent(String(farmId))}/animais/${safeAnimalId}`
    : `/animais/${safeAnimalId}`;

  return apiClient<AnimalResponseDTO>(endpoint, {
    method: 'GET',
  });
}

/**
 * Cadastra um novo animal vinculado a uma fazenda com sua Tag RFID.
 * Endpoint: POST /api/v1/farms/{farmId}/animais
 */
export async function createAnimal(
  farmId: number,
  data: AnimalRequestDTO
): Promise<AnimalResponseDTO> {
  const safeFarmId = encodeURIComponent(String(farmId));
  const payload: AnimalRequestDTO = {
    ...data,
    tagUid: data.tagUid ? data.tagUid.trim().toUpperCase() : data.tagUid,
  };

  return apiClient<AnimalResponseDTO>(`/farms/${safeFarmId}/animais`, {
    method: 'POST',
    body: payload,
  });
}

/**
 * Atualiza os dados de um animal cadastrado.
 * Endpoint: PUT /api/v1/animais/{animalId} ou PUT /api/v1/farms/{farmId}/animais/{animalId}
 */
export async function updateAnimal(
  animalId: number,
  data: AnimalRequestDTO,
  farmId?: number
): Promise<AnimalResponseDTO> {
  const safeAnimalId = encodeURIComponent(String(animalId));
  const endpoint = farmId !== undefined
    ? `/farms/${encodeURIComponent(String(farmId))}/animais/${safeAnimalId}`
    : `/animais/${safeAnimalId}`;

  const payload: AnimalRequestDTO = {
    ...data,
    tagUid: data.tagUid ? data.tagUid.trim().toUpperCase() : data.tagUid,
  };

  return apiClient<AnimalResponseDTO>(endpoint, {
    method: 'PUT',
    body: payload,
  });
}

/**
 * Exclui um animal cadastrado da fazenda.
 * Endpoint: DELETE /api/v1/animais/{animalId}
 */
export async function deleteAnimal(animalId: number, farmId?: number): Promise<void> {
  const safeAnimalId = encodeURIComponent(String(animalId));
  const endpoint = farmId !== undefined
    ? `/farms/${encodeURIComponent(String(farmId))}/animais/${safeAnimalId}`
    : `/animais/${safeAnimalId}`;

  await apiClient<void>(endpoint, {
    method: 'DELETE',
  });
}

/**
 * Registra manualmente ou via RFID a presença de um animal no curral (ENTROU ou SAIU).
 * Endpoint: POST /api/v1/currais/{corralId}/presenca
 */
export async function sendPresence(
  corralId: number,
  data: AnimalPresenceRequestDTO
): Promise<AnimalEventResponseDTO> {
  const safeCorralId = encodeURIComponent(String(corralId));
  const payload: AnimalPresenceRequestDTO = {
    ...data,
    origin: data.origin || 'MANUAL',
    tagUid: data.tagUid ? data.tagUid.trim().toUpperCase() : data.tagUid,
  };

  return apiClient<AnimalEventResponseDTO>(`/currais/${safeCorralId}/presenca`, {
    method: 'POST',
    body: payload,
  });
}

/**
 * Lista a timeline de eventos de movimentação no curral (ordenados por instant DESC).
 * Endpoint: GET /api/v1/currais/{corralId}/eventos
 */
export async function listEvents(corralId: number): Promise<AnimalEventResponseDTO[]> {
  const safeCorralId = encodeURIComponent(String(corralId));
  return apiClient<AnimalEventResponseDTO[]>(`/currais/${safeCorralId}/eventos`, {
    method: 'GET',
  });
}

export const animalService = {
  listAnimals,
  getAnimal,
  createAnimal,
  updateAnimal,
  deleteAnimal,
  sendPresence,
  listEvents,
};

export default animalService;
