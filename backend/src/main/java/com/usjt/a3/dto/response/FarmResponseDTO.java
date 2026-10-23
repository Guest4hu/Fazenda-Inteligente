package com.usjt.a3.dto.response;

import java.time.LocalDateTime;

public record FarmResponseDTO (
        Long id,
        String name,
        LocalDateTime createdAt
){
}
