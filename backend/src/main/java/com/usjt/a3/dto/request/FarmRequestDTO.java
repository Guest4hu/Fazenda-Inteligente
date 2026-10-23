package com.usjt.a3.dto.request;

import com.usjt.a3.model.entity.User;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record FarmRequestDTO(
        @NotBlank(message = "O nome da fazenda e obrigratorio")
        @Size(min = 2, max = 100, message = "O nome deve ter entre 2 e 100 caracteres")
        String name
) {

}
