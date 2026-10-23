package com.usjt.a3.dto.request;

import jakarta.validation.constraints.*;

import java.time.LocalTime;

public record CorralRequestDTO (
        @NotBlank(message = "O nome do curral é obrigatorio")
        @Size(min = 2, max = 100, message = "O nome deve ter entre 2 e 100 caracteres")
        String name,

        @NotBlank(message = "O MAC ADdress do dispositivo é obrigatorio")
        @Pattern(regexp = "^[0-9A-Fa-f]{12}$", message = "O MAC Address deve conter exatamente 12 caracteres hexadecimais (ex: 240AC4000110)")
        String macAddress,

        LocalTime cleanTime,

        @PositiveOrZero(message = "O limite de odor deve ser maior ou igual a zero")
        Integer limitOdor,

        @Positive(message = "A duração da bomba deve ser maior que zero")
        @Max(value = 60, message = "A duração maxima da bomba e de 60 segundos")
        Integer pumpDurationSeconds

) {}
