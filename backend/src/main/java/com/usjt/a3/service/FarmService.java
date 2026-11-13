package com.usjt.a3.service;

import com.usjt.a3.dto.request.FarmRequestDTO;
import com.usjt.a3.dto.response.FarmResponseDTO;
import com.usjt.a3.mapper.FarmMapper;
import com.usjt.a3.model.entity.Farm;
import com.usjt.a3.model.entity.User;
import com.usjt.a3.model.enums.CleanState;
import com.usjt.a3.repository.CleanCmdRepository;
import com.usjt.a3.repository.FarmRepository;
import com.usjt.a3.repository.UserRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Manages farm lifecycle operations while enforcing owner isolation, per-user name uniqueness,
 * and active-cleaning deletion locks.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FarmService {
    private final FarmRepository farmRepository;
    private final UserRepository userRepository;
    private final FarmMapper farmMapper;
    private final CleanCmdRepository cleanCmdRepository;

    /**
     * Creates a farm for the authenticated user, rejecting duplicate farm names within the same account.
     *
     * @param farmRequestDTO farm creation payload
     * @param userID authenticated owner identifier
     * @return persisted farm DTO
     */
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

    /**
     * Renames a farm after validating user ownership and per-user name uniqueness.
     *
     * @param farmId farm identifier
     * @param farmRequestDTO updated farm fields
     * @param userId authenticated owner identifier
     * @return updated farm DTO
     */
    @Transactional
    public FarmResponseDTO updateFarm(Long farmId, FarmRequestDTO farmRequestDTO, Long userId) {
        Farm farm = farmRepository.findById(farmId)
                .orElseThrow(() -> new EntityNotFoundException("Fazenda não encontrada com ID: " + farmId));

        if (!farm.getUser().getId().equals(userId)) {
            throw new SecurityException("Você não tem permissão para editar esta fazenda");
        }

        String trimmedName = farmRequestDTO.name().trim();
        if (farmRepository.existsByNameAndUserIdAndIdNot(trimmedName, userId, farmId)) {
            throw new IllegalStateException("Você já possui uma fazenda cadastrada com este nome: " + trimmedName);
        }

        farm.setName(trimmedName);
        Farm updatedFarm = farmRepository.save(farm);
        log.info("Fazenda ID {} atualizada com sucesso pelo usuário ID {}. Novo nome: '{}'", farmId, userId, trimmedName);

        return farmMapper.toDTO(updatedFarm);
    }

    /**
     * Deletes a farm owned by the user, blocking removal if any child corral currently has an active wash
     * ({@link CleanState#EM_ANDAMENTO}).
     *
     * @param farmId farm identifier
     * @param userId authenticated owner identifier
     */
    @Transactional
    public void deleteFarm(Long farmId, Long userId) {
        Farm farm = farmRepository.findById(farmId)
                .orElseThrow(() -> new EntityNotFoundException("Fazenda não encontrada com ID: " + farmId));

        if (!farm.getUser().getId().equals(userId)) {
            throw new SecurityException("Você não tem permissão para excluir esta fazenda");
        }

        if (cleanCmdRepository.existsByCorralFarmIdAndCleanState(farmId, CleanState.EM_ANDAMENTO)) {
            throw new IllegalStateException("Não é possível excluir a fazenda pois existe um curral com limpeza em andamento");
        }

        farmRepository.delete(farm);
        log.info("Fazenda '{}' (ID: {}) excluída com sucesso pelo usuário ID {}", farm.getName(), farmId, userId);
    }
}
