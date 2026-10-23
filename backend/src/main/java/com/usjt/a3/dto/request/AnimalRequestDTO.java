package com.usjt.a3.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AnimalRequestDTO(
        @NotBlank(message = "O nome do animal e obrigatorio")
        @Size(min = 2,max = 50, message = "O nome deve ter entre 2 a 50 caracteres")
        String name,
        @Size(max = 30, message = "A identificação deve ter no maximo 30 caracteres")
        String identification,

        @NotBlank(message = "A Tag RFID é obrigatoria")
        String tagUid
) {
}
