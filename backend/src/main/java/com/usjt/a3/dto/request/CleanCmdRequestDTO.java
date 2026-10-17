package com.usjt.a3.dto.request;

import com.usjt.a3.model.enums.CleanOrigin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Positive;

public record CleanCmdRequestDTO(
        CleanOrigin origin,

        @Positive(message = "A duração da limpeza deve ser maior que zero")
        @Max(value = 60, message = "A duração máxima de segurança é 60 segundos")
        Integer secondsDuration
) {
    public CleanCmdRequestDTO {
        if (origin == null) {
            origin = CleanOrigin.MANUAL;
        }
    }
}
