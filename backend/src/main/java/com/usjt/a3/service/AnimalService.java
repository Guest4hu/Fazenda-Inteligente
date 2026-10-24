package com.usjt.a3.service;

import com.usjt.a3.dto.request.AnimalPresenceRequestDTO;
import com.usjt.a3.dto.request.AnimalRequestDTO;
import com.usjt.a3.dto.response.AnimalEventResponseDTO;
import com.usjt.a3.dto.response.AnimalResponseDTO;
import com.usjt.a3.mapper.AnimalEventMapper;
import com.usjt.a3.mapper.AnimalMapper;
import com.usjt.a3.model.entity.Animal;
import com.usjt.a3.model.entity.AnimalEvent;
import com.usjt.a3.model.entity.Corral;
import com.usjt.a3.model.entity.Farm;
import com.usjt.a3.model.enums.AnimalEventType;
import com.usjt.a3.model.enums.EventOrigin;
import com.usjt.a3.repository.AnimalEventRepository;
import com.usjt.a3.repository.AnimalRepository;
import com.usjt.a3.repository.CorralRepository;
import com.usjt.a3.repository.FarmRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class AnimalService {

    private final AnimalRepository animalRepository;
    private final AnimalMapper animalMapper;
    private final AnimalEventMapper animalEventMapper;
    private final FarmRepository farmRepository;
    private final CorralRepository corralRepository;
    private final AnimalEventRepository animalEventRepository;

    @Autowired(required = false)
    private CorralSseService corralSseService;

    public AnimalResponseDTO createAnimal(Long farmId, Long userId, AnimalRequestDTO requestDTO) {
        Farm farm = farmRepository.findById(farmId)
                .orElseThrow(() -> new EntityNotFoundException("Fazenda não encontrada com ID: " + farmId));

        if (!farm.getUser().getId().equals(userId)) {
            throw new SecurityException("Você não tem permissão para cadastrar animais nesta fazenda");
        }

        String tag = requestDTO.tagUid().toUpperCase();
        if (animalRepository.existsByTagUid(tag)) {
            throw new IllegalStateException("Já existe um animal cadastrado com esta Tag RFID: " + tag);
        }

        Animal animal = animalMapper.toAnimal(requestDTO, farm);
        Animal saved = animalRepository.save(animal);
        log.info("Animal '{}' (Tag: {}) cadastrado na Fazenda ID {}", saved.getName(), saved.getTagUid(), farmId);

        return animalMapper.toAnimalResponseDTO(saved);
    }

    public List<AnimalResponseDTO> getAnimals(Long farmId, Long userId) {
        Farm farm = farmRepository.findById(farmId)
                .orElseThrow(() -> new EntityNotFoundException("Fazenda não encontrada com ID: " + farmId));

        if (!farm.getUser().getId().equals(userId)) {
            throw new SecurityException("Você não tem permissão para visualizar animais desta fazenda");
        }

        return animalRepository.findByFarmId(farmId)
                .stream()
                .map(animalMapper::toAnimalResponseDTO)
                .toList();
    }

    @Transactional
    public AnimalEventResponseDTO registerPresence(Long corralId, Long farmId, Long userId, AnimalPresenceRequestDTO request) {
        Corral corral = corralRepository.findById(corralId)
                .orElseThrow(() -> new EntityNotFoundException("Curral não encontrado com ID: " + corralId));

        if (farmId != null && !corral.getFarm().getId().equals(farmId)) {
            throw new EntityNotFoundException("Curral não pertence à fazenda informada");
        }

        if (!corral.getFarm().getUser().getId().equals(userId)) {
            throw new SecurityException("Você não tem permissão para registrar presenças neste curral");
        }

        String normalizedTag = request.tagUid() != null ? request.tagUid().trim().toUpperCase() : "";
        Animal animal = animalRepository.findByTagUid(normalizedTag)
                .orElseThrow(() -> new EntityNotFoundException("Nenhum animal cadastrado com a Tag RFID: " + normalizedTag));

        EventOrigin origin = request.origin() != null ? request.origin() : EventOrigin.MANUAL;

        if (origin == EventOrigin.TAG) {
            // Se a tag lida pelo leitor RFID não pertencer à mesma fazenda deste curral, deve disparar
            // EntityNotFoundException para que o CommandRfidLeitura crie uma IdentifyPendency.
            if (animal.getFarm() == null || !animal.getFarm().getId().equals(corral.getFarm().getId())) {
                throw new EntityNotFoundException("Nenhum animal cadastrado nesta fazenda com a Tag RFID: " + normalizedTag);
            }
        } else {
            // Regra MANUAL: Validação estrita de propriedade do produtor e vinculação com a fazenda.
            if (animal.getFarm() == null || !animal.getFarm().getUser().getId().equals(userId)) {
                throw new SecurityException("Você não tem permissão para registrar presenças para este animal");
            }
            if (!animal.getFarm().getId().equals(corral.getFarm().getId())) {
                throw new IllegalStateException("O animal informado pertence a uma fazenda diferente da fazenda do curral");
            }
        }

        Corral currentCorral = animal.getCurrentCorral();
        AnimalEventType effectiveType;

        if (origin == EventOrigin.TAG) {
            // Regra RFID (TAG): Base de dados como fonte única da verdade (Single Source of Truth).
            // O estado real do animal no banco determina o evento, prevenindo duplicidades consecutivas do hardware/ESP32.
            if (currentCorral != null && currentCorral.getId().equals(corralId)) {
                effectiveType = AnimalEventType.SAIU;
            } else {
                effectiveType = AnimalEventType.ENTROU;
            }
        } else {
            // Regra MANUAL: Validação estrita para evitar estados duplicados consecutivos.
            effectiveType = request.typeEvent();
            if (effectiveType == null) {
                throw new IllegalArgumentException("O tipo do evento (ENTROU ou SAIU) é obrigatório");
            }
            if (effectiveType == AnimalEventType.ENTROU) {
                if (currentCorral != null && currentCorral.getId().equals(corralId)) {
                    throw new IllegalStateException("Animal já está presente no curral ID: " + corralId);
                }
            } else if (effectiveType == AnimalEventType.SAIU) {
                if (currentCorral == null || !currentCorral.getId().equals(corralId)) {
                    throw new IllegalStateException("Animal não está presente no curral ID: " + corralId + " para registrar saída");
                }
            }
        }

        if (effectiveType == AnimalEventType.ENTROU) {
            // Consistência de transferência entre currais: se o animal estava em outro curral,
            // registra automaticamente o evento de SAIU no curral anterior antes da nova entrada.
            if (currentCorral != null && !currentCorral.getId().equals(corralId)) {
                AnimalEvent exitPrevious = animalEventMapper.toEntity(currentCorral, animal, AnimalEventType.SAIU, origin);
                exitPrevious.setInstant(LocalDateTime.now().minusNanos(1_000_000));
                AnimalEvent savedExitPrevious = animalEventRepository.save(exitPrevious);
                log.info("Animal '{}' (ID: {}) transferido: SAIU automaticamente do curral ID {} ({})",
                        animal.getName(), animal.getId(), currentCorral.getId(), origin);
                if (corralSseService != null) {
                    corralSseService.sendEvent(currentCorral.getId(), "presenca", animalEventMapper.toDTO(savedExitPrevious));
                }
            }

            animal.setCurrentCorral(corral);
            animalRepository.save(animal);
            log.info("Animal '{}' (ID: {}) ENTROU no curral ID {} ({})",
                    animal.getName(), animal.getId(), corralId, origin);

            AnimalEvent enterEvent = animalEventMapper.toEntity(corral, animal, AnimalEventType.ENTROU, origin);
            AnimalEvent savedEvent = animalEventRepository.save(enterEvent);
            AnimalEventResponseDTO dto = animalEventMapper.toDTO(savedEvent);
            if (corralSseService != null) {
                corralSseService.sendEvent(corralId, "presenca", dto);
            }
            return dto;
        } else {
            animal.setCurrentCorral(null);
            animalRepository.save(animal);
            log.info("Animal '{}' (ID: {}) SAIU do curral ID {} ({})",
                    animal.getName(), animal.getId(), corralId, origin);

            AnimalEvent exitEvent = animalEventMapper.toEntity(corral, animal, AnimalEventType.SAIU, origin);
            AnimalEvent savedEvent = animalEventRepository.save(exitEvent);
            AnimalEventResponseDTO dto = animalEventMapper.toDTO(savedEvent);
            if (corralSseService != null) {
                corralSseService.sendEvent(corralId, "presenca", dto);
            }
            return dto;
        }
    }

    @Transactional
    public AnimalEventResponseDTO registerPresence(Long corralId, Long userId, AnimalPresenceRequestDTO request) {
        return registerPresence(corralId, null, userId, request);
    }

    public List<AnimalEventResponseDTO> listEventsByCorral(Long corralId, Long farmId, Long userId) {
        Corral corral = corralRepository.findById(corralId)
                .orElseThrow(() -> new EntityNotFoundException("Curral não encontrado com ID: " + corralId));

        if (farmId != null && !corral.getFarm().getId().equals(farmId)) {
            throw new EntityNotFoundException("Curral não pertence à fazenda informada");
        }

        if (!corral.getFarm().getUser().getId().equals(userId)) {
            throw new SecurityException("Você não tem permissão para visualizar eventos deste curral");
        }

        return animalEventRepository.findByCorralIdOrderByInstantDesc(corralId)
                .stream()
                .map(animalEventMapper::toDTO)
                .toList();
    }

    public List<AnimalEventResponseDTO> listEventsByCorral(Long corralId, Long userId) {
        return listEventsByCorral(corralId, null, userId);
    }

    @Transactional
    public AnimalResponseDTO updateAnimal(Long animalId, Long farmId, Long userId, AnimalRequestDTO requestDTO) {
        Animal animal = animalRepository.findById(animalId)
                .orElseThrow(() -> new EntityNotFoundException("Animal não encontrado com ID: " + animalId));

        if (!animal.getFarm().getUser().getId().equals(userId)) {
            throw new SecurityException("Você não tem permissão para editar este animal");
        }

        if (farmId != null && !animal.getFarm().getId().equals(farmId)) {
            throw new EntityNotFoundException("Animal ID " + animalId + " não pertence à fazenda ID " + farmId);
        }

        String normalizedTag = requestDTO.tagUid().trim().toUpperCase();

        if (animalRepository.existsByTagUidAndIdNot(normalizedTag, animalId)) {
            throw new IllegalStateException("Já existe outro animal cadastrado com esta Tag RFID: " + normalizedTag);
        }

        animal.setName(requestDTO.name().trim());
        animal.setIdentification(requestDTO.identification() != null ? requestDTO.identification().trim() : null);
        animal.setTagUid(normalizedTag);

        Animal saved = animalRepository.save(animal);
        log.info("Animal ID {} ('{}', Tag: {}) atualizado com sucesso pelo usuário ID {}",
                saved.getId(), saved.getName(), saved.getTagUid(), userId);

        return animalMapper.toAnimalResponseDTO(saved);
    }

    @Transactional
    public AnimalResponseDTO updateAnimal(Long animalId, Long userId, AnimalRequestDTO requestDTO) {
        return updateAnimal(animalId, null, userId, requestDTO);
    }

    @Transactional
    public void deleteAnimal(Long animalId, Long farmId, Long userId) {
        Animal animal = animalRepository.findById(animalId)
                .orElseThrow(() -> new EntityNotFoundException("Animal não encontrado com ID: " + animalId));

        if (!animal.getFarm().getUser().getId().equals(userId)) {
            throw new SecurityException("Você não tem permissão para excluir este animal");
        }

        if (farmId != null && !animal.getFarm().getId().equals(farmId)) {
            throw new EntityNotFoundException("Animal ID " + animalId + " não pertence à fazenda ID " + farmId);
        }

        animalRepository.delete(animal);
        log.info("Animal ID {} ('{}', Tag: {}) excluído com sucesso pelo usuário ID {}",
                animalId, animal.getName(), animal.getTagUid(), userId);
    }

    @Transactional
    public void deleteAnimal(Long animalId, Long userId) {
        deleteAnimal(animalId, null, userId);
    }

    public AnimalResponseDTO getAnimalById(Long animalId, Long farmId, Long userId) {
        Animal animal = animalRepository.findById(animalId)
                .orElseThrow(() -> new EntityNotFoundException("Animal não encontrado com ID: " + animalId));

        if (!animal.getFarm().getUser().getId().equals(userId)) {
            throw new SecurityException("Você não tem permissão para visualizar este animal");
        }

        if (farmId != null && !animal.getFarm().getId().equals(farmId)) {
            throw new EntityNotFoundException("Animal ID " + animalId + " não pertence à fazenda ID " + farmId);
        }

        return animalMapper.toAnimalResponseDTO(animal);
    }

    public AnimalResponseDTO getAnimalById(Long animalId, Long userId) {
        return getAnimalById(animalId, null, userId);
    }
}
