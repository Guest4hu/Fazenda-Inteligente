package com.usjt.a3.mapper;

import com.usjt.a3.dto.request.CorralRequestDTO;
import com.usjt.a3.dto.response.CorralResponseDTO;
import com.usjt.a3.model.entity.Corral;
import com.usjt.a3.model.entity.Farm;
import org.springframework.stereotype.Component;

@Component
public class CorralMapper {

    public CorralResponseDTO toCorralResponseDTO(Corral corral) {
        if (corral == null) {
            return null;
        }

        return new CorralResponseDTO(
                corral.getId(),
                corral.getFarm().getId(),
                corral.getName(),
                corral.getMacAddress(),
                corral.getCleanTime(),
                corral.getLimitOdor(),
                corral.getPumpDurationSeconds()
        );
    }
    public Corral toEntity(CorralRequestDTO requestDTO, Farm farm) {
        if (requestDTO == null ) {
            return null;
        }

        Integer odor = (requestDTO.limitOdor() != null) ? requestDTO.limitOdor() : 400;
        Integer duration = (requestDTO.pumpDurationSeconds() != null) ? requestDTO.pumpDurationSeconds() : 30;

        return Corral.builder()
                .farm(farm)
                .name(requestDTO.name())
                .cleanTime(requestDTO.cleanTime())
                .macAddress(requestDTO.macAddress())
                .limitOdor(odor)
                .pumpDurationSeconds(duration)
                .build();
    }
}
