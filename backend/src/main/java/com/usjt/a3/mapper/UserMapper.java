package com.usjt.a3.mapper;

import com.usjt.a3.dto.request.RegisterRequestDTO;
import com.usjt.a3.dto.response.AuthResponseDTO;
import com.usjt.a3.model.entity.User;
import org.springframework.stereotype.Component;

@Component
public class UserMapper {
    public User toEntity(RegisterRequestDTO requestDTO, String passwordHash){
        return User.builder()
                .name(requestDTO.name().trim())
                .email(requestDTO.email())
                .passwordHash(passwordHash)
                .build();
    }

    public AuthResponseDTO toAuthResponseDTO(User user, String token){
        return new AuthResponseDTO(
                token,
                user.getId(),
                user.getName(),
                user.getEmail()
        );
    }
}
