package com.usjt.a3.dto.request;

import jakarta.validation.constraints.NotNull;

public record ResolvePendencyRequestDTO(
        @NotNull(message = "O ID do animal é obrigatório")
        Long animalId
) {}
