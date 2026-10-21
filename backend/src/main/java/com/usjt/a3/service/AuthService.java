package com.usjt.a3.service;

import com.usjt.a3.config.security.TokenService;
import com.usjt.a3.dto.request.LoginRequestDTO;
import com.usjt.a3.dto.request.RegisterRequestDTO;
import com.usjt.a3.dto.response.AuthResponseDTO;
import com.usjt.a3.mapper.UserMapper;
import com.usjt.a3.model.entity.User;
import com.usjt.a3.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthService {
    private final UserMapper userMapper;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final TokenService tokenService;

    public AuthResponseDTO login (LoginRequestDTO requestDTO){
        User user = userRepository.findByEmail(requestDTO.email())
                .orElseThrow(() -> new BadCredentialsException("Email ou senha invalidos"));
        if (!passwordEncoder.matches(requestDTO.password(), user.getPasswordHash())) throw new BadCredentialsException("Email ou senha invalidos");

        String token = tokenService.generateToken(user);
        return userMapper.toAuthResponseDTO(user,token);
    }

    public AuthResponseDTO register (RegisterRequestDTO requestDTO){
        if (userRepository.existsByEmail(requestDTO.email())) {
            throw new IllegalStateException("Email ja cadastado");
        }

        String hashSenha = passwordEncoder.encode(requestDTO.password());

        User savedUser = userRepository.save(userMapper.toEntity(requestDTO,hashSenha));
        String token = tokenService.generateToken(savedUser);
        return userMapper.toAuthResponseDTO(savedUser,token);
    }
}
