package com.usjt.a3.dto.response;

import com.usjt.a3.model.enums.AnimalEventType;
import com.usjt.a3.model.enums.EventOrigin;

import java.time.LocalDateTime;

public record AnimalEventResponseDTO(
        Long id,
        Long corralId,
        String corralName,
        Long animalId,
        String animalName,
        String tagUid,
        AnimalEventType typeEvent,
        EventOrigin eventOrigin,
        LocalDateTime instant
) {}
