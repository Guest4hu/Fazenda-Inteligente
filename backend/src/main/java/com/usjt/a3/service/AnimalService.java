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
import com.usjt.a3.repository.AnimalEventRepository;
import com.usjt.a3.repository.AnimalRepository;
import com.usjt.a3.repository.CorralRepository;
import com.usjt.a3.repository.FarmRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
    public AnimalEventResponseDTO registerPresence(Long corralId, Long userId, AnimalPresenceRequestDTO request) {
        Corral corral = corralRepository.findById(corralId)
                .orElseThrow(() -> new EntityNotFoundException("Curral não encontrado com ID: " + corralId));

        if (!corral.getFarm().getUser().getId().equals(userId)) {
            throw new SecurityException("Você não tem permissão para registrar presenças neste curral");
        }

        String normalizedTag = request.tagUid().toUpperCase();
        Animal animal = animalRepository.findByTagUid(normalizedTag)
                .orElseThrow(() -> new EntityNotFoundException("Nenhum animal cadastrado com a Tag RFID: " + normalizedTag));

        if (request.typeEvent() == AnimalEventType.ENTROU) {
            animal.setCurrentCorral(corral);
            log.info("Animal '{}' (ID: {}) ENTROU no curral ID {}", animal.getName(), animal.getId(), corralId);
        } else {
            animal.setCurrentCorral(null);
            log.info("Animal '{}' (ID: {}) SAIU do curral ID {}", animal.getName(), animal.getId(), corralId);
        }
        animalRepository.save(animal);

        AnimalEvent event = animalEventMapper.toEntity(corral, animal, request.typeEvent(), request.origin());
        AnimalEvent savedEvent = animalEventRepository.save(event);

        return animalEventMapper.toDTO(savedEvent);
    }

    public List<AnimalEventResponseDTO> listEventsByCorral(Long corralId, Long userId) {
        Corral corral = corralRepository.findById(corralId)
                .orElseThrow(() -> new EntityNotFoundException("Curral não encontrado com ID: " + corralId));

        if (!corral.getFarm().getUser().getId().equals(userId)) {
            throw new SecurityException("Você não tem permissão para visualizar eventos deste curral");
        }

        return animalEventRepository.findByCorralIdOrderByInstantDesc(corralId)
                .stream()
                .map(animalEventMapper::toDTO)
                .toList();
    }
}
