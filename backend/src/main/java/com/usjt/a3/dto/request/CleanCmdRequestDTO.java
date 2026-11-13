package com.usjt.a3.dto.request;

import com.usjt.a3.model.enums.CleanOrigin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Positive;

/**
 * Request payload for triggering a corral wash command, enforcing a 1-60s safety cap and defaulting {@code origin} to {@link CleanOrigin#MANUAL}.
 *
 * @param origin          wash initiation source (defaults to {@link CleanOrigin#MANUAL} when omitted)
 * @param secondsDuration requested wash duration in seconds ({@code 1..60}), or {@code null} to use the corral's configured duration
 */
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
