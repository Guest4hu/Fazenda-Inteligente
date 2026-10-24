package com.usjt.a3.service;

import com.usjt.a3.dto.response.IdentifyPendencyResponseDTO;
import com.usjt.a3.mapper.IdentifyPendencyMapper;
import com.usjt.a3.model.entity.Animal;
import com.usjt.a3.model.entity.AnimalEvent;
import com.usjt.a3.model.entity.Corral;
import com.usjt.a3.model.entity.IdentifyPendency;
import com.usjt.a3.model.enums.AnimalEventType;
import com.usjt.a3.model.enums.EventOrigin;
import com.usjt.a3.repository.AnimalEventRepository;
import com.usjt.a3.repository.AnimalRepository;
import com.usjt.a3.repository.CorralRepository;
import com.usjt.a3.repository.IdentifyPendencyRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class IdentifyPendencyService {

    private final IdentifyPendencyRepository identifyPendencyRepository;
    private final CorralRepository corralRepository;
    private final AnimalRepository animalRepository;
    private final AnimalEventRepository animalEventRepository;
    private final IdentifyPendencyMapper identifyPendencyMapper;

    @Autowired(required = false)
    private CorralSseService corralSseService;

    /**
     * Lists open (unresolved) RFID identification pendencies for a given corral.
     * Enforces tenant ownership verification.
     */
    @Transactional(readOnly = true)
    public List<IdentifyPendencyResponseDTO> listOpenPendencies(Long corralId, Long userId) {
        return listOpenPendencies(corralId, null, userId);
    }

    /**
     * Lists open pendencies with optional farmId consistency check for nested routes.
     */
    @Transactional(readOnly = true)
    public List<IdentifyPendencyResponseDTO> listOpenPendencies(Long corralId, Long farmId, Long userId) {
        Corral corral = corralRepository.findById(corralId)
                .orElseThrow(() -> new EntityNotFoundException("Curral não encontrado com ID: " + corralId));

        if (corral.getFarm() == null || corral.getFarm().getUser() == null
                || !corral.getFarm().getUser().getId().equals(userId)) {
            throw new SecurityException("Você não tem permissão para visualizar pendências deste curral");
        }

        if (farmId != null && !corral.getFarm().getId().equals(farmId)) {
            throw new EntityNotFoundException("Curral não pertence à fazenda informada");
        }

        return identifyPendencyRepository.findByCorralIdAndResolvedFalseOrderByInstantDesc(corralId)
                .stream()
                .map(identifyPendencyMapper::toDTO)
                .toList();
    }

    /**
     * Resolves an open identification pendency by binding it to a registered animal.
     * Updates animal presence and creates an audit AnimalEvent (EventOrigin.MANUAL).
     */
    @Transactional
    public IdentifyPendencyResponseDTO resolvePendency(Long pendencyId, Long animalId, Long userId) {
        // 1. Verifica existência da pendência
        IdentifyPendency pendency = identifyPendencyRepository.findById(pendencyId)
                .orElseThrow(() -> new EntityNotFoundException("Pendência de identificação não encontrada com ID: " + pendencyId));

        // 2. Valida ownership do curral e da fazenda
        Corral corral = pendency.getCorral();
        if (corral == null || corral.getFarm() == null || corral.getFarm().getUser() == null
                || !corral.getFarm().getUser().getId().equals(userId)) {
            throw new SecurityException("Você não tem permissão para resolver pendências deste curral");
        }

        // 3. Verifica se a pendência já foi resolvida
        if (Boolean.TRUE.equals(pendency.getResolved())) {
            throw new IllegalStateException("Esta pendência de identificação já foi resolvida anteriormente");
        }

        // 4. Verifica existência do animal
        Animal animal = animalRepository.findById(animalId)
                .orElseThrow(() -> new EntityNotFoundException("Animal não encontrado com ID: " + animalId));

        // 5. Verifica se o animal pertence à mesma fazenda do curral
        if (animal.getFarm() == null || !animal.getFarm().getId().equals(corral.getFarm().getId())) {
            throw new IllegalStateException("O animal selecionado pertence a uma fazenda diferente da fazenda do curral");
        }

        // 6. Atualiza a pendência
        pendency.setAnimal(animal);
        pendency.setResolved(true);
        pendency.setResolvedAt(LocalDateTime.now());
        IdentifyPendency savedPendency = identifyPendencyRepository.save(pendency);

        // 7. Atualiza localização do animal conforme o evento da pendência
        if (pendency.getAnimalEventType() == AnimalEventType.ENTROU) {
            animal.setCurrentCorral(corral);
            log.info("Animal ID {} ('{}') alocado no curral ID {} após resolução da pendência ID {}",
                    animal.getId(), animal.getName(), corral.getId(), pendencyId);
        } else if (pendency.getAnimalEventType() == AnimalEventType.SAIU) {
            animal.setCurrentCorral(null);
            log.info("Animal ID {} ('{}') desvinculado do curral após resolução da pendência ID {}",
                    animal.getId(), animal.getName(), pendencyId);
        }
        animalRepository.save(animal);

        // 8. Registra evento de histórico com origem MANUAL
        AnimalEvent event = AnimalEvent.builder()
                .corral(corral)
                .animal(animal)
                .typeEvent(pendency.getAnimalEventType())
                .eventOrigin(EventOrigin.MANUAL)
                .instant(LocalDateTime.now())
                .build();
        animalEventRepository.save(event);

        log.info("Pendência ID {} resolvida com sucesso para o animal ID {} ('{}') pelo usuário ID {}",
                pendencyId, animal.getId(), animal.getName(), userId);

        IdentifyPendencyResponseDTO dto = identifyPendencyMapper.toDTO(savedPendency);
        if (corralSseService != null) {
            corralSseService.sendEvent(corral.getId(), "pendencia", dto);
        }
        return dto;
    }

    /**
     * Creates an open IdentifyPendency when an unknown RFID tag is detected during MQTT ingestion.
     */
    @Transactional
    public IdentifyPendency createPendency(Corral corral, String tagUid, AnimalEventType typeEvent) {
        if (corral == null) {
            throw new IllegalArgumentException("Curral não pode ser nulo para geração de pendência");
        }
        String normalizedTag = tagUid != null ? tagUid.trim().toUpperCase() : "";

        IdentifyPendency pendency = IdentifyPendency.builder()
                .corral(corral)
                .tagUid(normalizedTag)
                .animalEventType(typeEvent)
                .resolved(false)
                .instant(LocalDateTime.now())
                .build();

        IdentifyPendency saved = identifyPendencyRepository.save(pendency);
        log.warn("Tag desconhecida '{}' detectada no curral ID {}. Pendência gerada (ID: {}).",
                normalizedTag, corral.getId(), saved.getId());
        if (corralSseService != null && identifyPendencyMapper != null) {
            corralSseService.sendEvent(corral.getId(), "pendencia", identifyPendencyMapper.toDTO(saved));
        }
        return saved;
    }
}
