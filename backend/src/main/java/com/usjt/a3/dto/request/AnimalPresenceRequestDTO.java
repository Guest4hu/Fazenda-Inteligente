package com.usjt.a3.dto.request;

import com.usjt.a3.model.enums.AnimalEventType;
import com.usjt.a3.model.enums.EventOrigin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record AnimalPresenceRequestDTO(
        @NotBlank(message = "A Tag RFID é obrigatória")
        String tagUid,

        @NotNull(message = "O tipo do evento (ENTROU ou SAIU) é obrigatório")
        AnimalEventType typeEvent,

        EventOrigin origin
) {
    public AnimalPresenceRequestDTO {
        if (origin == null) {
            origin = EventOrigin.MANUAL;
        }
    }
}
