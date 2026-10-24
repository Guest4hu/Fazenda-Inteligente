package com.usjt.a3.mapper;

import com.usjt.a3.dto.response.IdentifyPendencyResponseDTO;
import com.usjt.a3.model.entity.IdentifyPendency;
import org.springframework.stereotype.Component;

@Component
public class IdentifyPendencyMapper {

    public IdentifyPendencyResponseDTO toDTO(IdentifyPendency entity) {
        if (entity == null) {
            return null;
        }

        Long corralId = entity.getCorral() != null ? entity.getCorral().getId() : null;
        Long animalIdResolved = entity.getAnimal() != null ? entity.getAnimal().getId() : null;
        String animalNameResolved = entity.getAnimal() != null ? entity.getAnimal().getName() : null;

        return new IdentifyPendencyResponseDTO(
                entity.getId(),
                corralId,
                entity.getTagUid(),
                entity.getAnimalEventType(),
                entity.getInstant(),
                entity.getResolved(),
                animalIdResolved,
                animalNameResolved,
                entity.getResolvedAt()
        );
    }
}
