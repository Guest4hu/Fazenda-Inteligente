/**
 * Service for herd registry CRUD, RFID tag normalization, and corral presence registration.
 */

import { apiClient } from './apiClient';
import type {
  AnimalRequestDTO,
  AnimalResponseDTO,
  AnimalPresenceRequestDTO,
  AnimalEventResponseDTO,
} from '../types/api';

/**
 * Lists all cattle registered in a farm along with their current corral occupancy.
 *
 * @endpoint GET /api/v1/farms/{farmId}/animais
 */
export async function listAnimals(farmId: number): Promise<AnimalResponseDTO[]> {
  const safeFarmId = encodeURIComponent(String(farmId));
  return apiClient<AnimalResponseDTO[]>(`/farms/${safeFarmId}/animais`, {
    method: 'GET',
  });
}

/**
 * Retrieves an animal by ID via direct or farm-nested API path.
 *
 * @endpoint GET /api/v1/animais/{animalId}
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
 * Registers a new animal in a farm, trimming and uppercasing its RFID {@code tagUid}.
 *
 * @endpoint POST /api/v1/farms/{farmId}/animais
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
 * Updates an animal's details and normalized RFID {@code tagUid} via direct or nested path.
 *
 * @endpoint PUT /api/v1/animais/{animalId}
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
 * Deletes an animal from a farm.
 *
 * @endpoint DELETE /api/v1/animais/{animalId}
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
 * Records a corral entry or exit event ({@code ENTROU}/{@code SAIU}), normalizing {@code tagUid}
 * and defaulting {@code origin} to {@code MANUAL}.
 *
 * @endpoint POST /api/v1/currais/{corralId}/presenca
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
 * Fetches a corral's presence movement timeline ordered newest-first.
 *
 * @endpoint GET /api/v1/currais/{corralId}/eventos
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
