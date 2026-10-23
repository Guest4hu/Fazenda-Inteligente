package com.usjt.a3.mapper;

import com.usjt.a3.dto.response.AnimalEventResponseDTO;
import com.usjt.a3.model.entity.Animal;
import com.usjt.a3.model.entity.AnimalEvent;
import com.usjt.a3.model.entity.Corral;
import com.usjt.a3.model.enums.AnimalEventType;
import com.usjt.a3.model.enums.EventOrigin;
import org.springframework.stereotype.Component;

@Component
public class AnimalEventMapper {

    public AnimalEvent toEntity(Corral corral, Animal animal, AnimalEventType typeEvent, EventOrigin origin) {
        return AnimalEvent.builder()
                .corral(corral)
                .animal(animal)
                .typeEvent(typeEvent)
                .eventOrigin(origin != null ? origin : EventOrigin.TAG)
                .build();
    }

    public AnimalEventResponseDTO toDTO(AnimalEvent event) {
        if (event == null) {
            return null;
        }

        return new AnimalEventResponseDTO(
                event.getId(),
                event.getCorral().getId(),
                event.getCorral().getName(),
                event.getAnimal().getId(),
                event.getAnimal().getName(),
                event.getAnimal().getTagUid(),
                event.getTypeEvent(),
                event.getEventOrigin(),
                event.getInstant()
        );
    }
}
