package com.usjt.a3.service;

import com.usjt.a3.dto.request.CorralRequestDTO;
import com.usjt.a3.dto.response.CorralResponseDTO;
import com.usjt.a3.mapper.CorralMapper;
import com.usjt.a3.model.entity.Corral;
import com.usjt.a3.model.entity.Farm;
import com.usjt.a3.repository.CorralRepository;
import com.usjt.a3.repository.FarmRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class CorralService {
    private final CorralRepository corralRepository;
    private final CorralMapper corralMapper;
    private final FarmRepository farmRepository;

    public CorralResponseDTO createCorral(CorralRequestDTO corralRequestDTO, Long userId, Long farmId) {
        Farm farm = farmRepository.findById(farmId).orElseThrow(() -> new EntityNotFoundException("Farm não encontrada"));

        if (!farm.getUser().getId().equals(userId)) {
            throw new SecurityException("Voce não tem permissao para cadastrar currais nesta fazenda");
        }

        String mac = corralRequestDTO.macAddress().toUpperCase();
        if (corralRepository.existsByMacAddress(mac)) {
            throw new IllegalStateException("Ja existe um curral cadastrado com este MAC Address");
        }
        Corral corral = corralMapper.toEntity(corralRequestDTO, farm);
        corral.setMacAddress(mac);

        return corralMapper.toCorralResponseDTO(corralRepository.save(corral));
    }
    public List<CorralResponseDTO> listCorrals(Long userId, Long farmId) {
        Farm farm = farmRepository.findById(farmId).orElseThrow(() -> new EntityNotFoundException("Nenhuma fazenda com este id encontrada"));

        if (!farm.getUser().getId().equals(userId)) {
            throw new SecurityException("Voce não tem permissão para visualizar currais desta fazenda");
        }

        return corralRepository.findByFarmId(farmId)
                .stream()
                .map(corralMapper::toCorralResponseDTO)
                .toList();
    }
}

