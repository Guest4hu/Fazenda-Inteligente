package com.usjt.a3.dto.response;

public record AnimalResponseDTO(
        Long id,
        Long farmId,
        String name,
        String identification,
        String tagUid,
        Long currentCorralId,
        String currentCorralName
        ) {}
