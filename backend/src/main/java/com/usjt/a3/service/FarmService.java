package com.usjt.a3.service;

import com.usjt.a3.dto.request.FarmRequestDTO;
import com.usjt.a3.dto.response.FarmResponseDTO;
import com.usjt.a3.mapper.FarmMapper;
import com.usjt.a3.model.entity.Farm;
import com.usjt.a3.model.entity.User;
import com.usjt.a3.repository.FarmRepository;
import com.usjt.a3.repository.UserRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class FarmService {
    private final FarmRepository farmRepository;
    private final UserRepository userRepository;
    private final FarmMapper farmMapper;

    public FarmResponseDTO createFarm(FarmRequestDTO farmRequestDTO, Long userID) {
        User user = userRepository.findById(userID).orElseThrow(() -> new EntityNotFoundException("Não existe tal usuario cadastrado")
        );

        if (farmRepository.existsByNameAndUserId(farmRequestDTO.name(), userID)) {
            throw new IllegalStateException("Voce ja possui uma fazenda cadastrada com este nome: " + farmRequestDTO.name());
        }

        Farm farm = farmRepository.save(farmMapper.toEntity(farmRequestDTO, user));
        return farmMapper.toDTO(farm);
    }

    public List<FarmResponseDTO> findAllFarm(Long userID) {
        return farmRepository.findByUserId(userID)
                .stream()
                .map(farmMapper::toDTO)
                .toList();
    }

}
