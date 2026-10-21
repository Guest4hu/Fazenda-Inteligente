package com.usjt.a3.dto.response;

public record AuthResponseDTO(
        String token,
        Long userId,
        String name,
        String email
) {
}
