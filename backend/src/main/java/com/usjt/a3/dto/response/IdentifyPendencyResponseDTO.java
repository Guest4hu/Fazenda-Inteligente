package com.usjt.a3.dto.response;

import com.usjt.a3.model.enums.AnimalEventType;

import java.time.LocalDateTime;

public record IdentifyPendencyResponseDTO(
        Long id,
        Long corralId,
        String tagUid,
        AnimalEventType typeEvent,
        LocalDateTime instant,
        Boolean resolved,
        Long animalIdResolved,
        String animalNameResolved,
        LocalDateTime resolvedAt
) {}
