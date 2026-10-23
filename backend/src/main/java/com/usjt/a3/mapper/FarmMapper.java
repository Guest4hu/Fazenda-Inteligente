package com.usjt.a3.mapper;

import com.usjt.a3.dto.request.FarmRequestDTO;
import com.usjt.a3.dto.response.FarmResponseDTO;
import com.usjt.a3.model.entity.Farm;
import com.usjt.a3.model.entity.User;
import org.springframework.stereotype.Component;

@Component
public class FarmMapper {

    public FarmResponseDTO toDTO(Farm farm)
    {
        if (farm == null)
        {
            return null;
        }

        return new FarmResponseDTO(
                farm.getId(),
                farm.getName(),
                farm.getCreatedAt()
        );
    }

    public Farm toEntity(FarmRequestDTO farmRequestDTO, User user){
        if (farmRequestDTO == null)
        {
            return null;
        }

        return Farm.builder()
                .name(farmRequestDTO.name().trim())
                .user(user)
                .build();


    }


}
