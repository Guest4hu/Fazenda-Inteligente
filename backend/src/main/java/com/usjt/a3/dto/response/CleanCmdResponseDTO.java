package com.usjt.a3.dto.response;

import com.usjt.a3.model.enums.CleanOrigin;
import com.usjt.a3.model.enums.CleanState;

import java.time.LocalDateTime;
import java.util.UUID;

public record CleanCmdResponseDTO(
        UUID id,
        Long corralId,
        CleanOrigin origin,
        CleanState state,
        Integer secondsDuration,
        LocalDateTime createdAt,
        String mensagem
) {
}
