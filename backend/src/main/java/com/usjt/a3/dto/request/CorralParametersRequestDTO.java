package com.usjt.a3.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;

import java.time.LocalTime;

public record CorralParametersRequestDTO(

        LocalTime cleanTime,

        @PositiveOrZero(message = "O limite de odor deve ser maior ou igual a zero")
        Integer limitOdor,

        @Positive(message = "A duração da bomba deve ser maior que zero")
        @Max(value = 60, message = "A duração máxima da bomba é de 60 segundos")
        Integer pumpDurationSeconds
) {}
