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
import com.usjt.a3.test.TestFixtures;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class FarmServiceTest {

    @Mock
    private FarmRepository farmRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private FarmMapper farmMapper;

    @Mock
    private CleanCmdRepository cleanCmdRepository;

    @InjectMocks
    private FarmService farmService;

    private User owner;
    private Farm farm;

    @BeforeEach
    void setUp() {
        owner = TestFixtures.createUser(1L);
        farm = TestFixtures.createFarm(10L, owner);
    }

    @Test
    @DisplayName("Atualizar fazenda com sucesso pelo proprietário")
    void updateFarm_Success() {
        FarmRequestDTO requestDTO = new FarmRequestDTO("Fazenda Sol Nascente");
        FarmResponseDTO responseDTO = new FarmResponseDTO(10L, "Fazenda Sol Nascente", LocalDateTime.now());

        when(farmRepository.findById(10L)).thenReturn(Optional.of(farm));
        when(farmRepository.existsByNameAndUserIdAndIdNot("Fazenda Sol Nascente", 1L, 10L)).thenReturn(false);
        when(farmRepository.save(any(Farm.class))).thenReturn(farm);
        when(farmMapper.toDTO(farm)).thenReturn(responseDTO);

        FarmResponseDTO result = farmService.updateFarm(10L, requestDTO, 1L);

        assertNotNull(result);
        assertEquals("Fazenda Sol Nascente", result.name());
        verify(farmRepository).save(farm);
    }

    @Test
    @DisplayName("Atualizar fazenda mantendo o mesmo nome com sucesso")
    void updateFarm_SameName_Success() {
        FarmRequestDTO requestDTO = new FarmRequestDTO(farm.getName());
        FarmResponseDTO responseDTO = new FarmResponseDTO(10L, farm.getName(), LocalDateTime.now());

        when(farmRepository.findById(10L)).thenReturn(Optional.of(farm));
        when(farmRepository.existsByNameAndUserIdAndIdNot(farm.getName(), 1L, 10L)).thenReturn(false);
        when(farmRepository.save(any(Farm.class))).thenReturn(farm);
        when(farmMapper.toDTO(farm)).thenReturn(responseDTO);

        FarmResponseDTO result = farmService.updateFarm(10L, requestDTO, 1L);

        assertNotNull(result);
        verify(farmRepository).save(farm);
    }

    @Test
    @DisplayName("Atualizar fazenda inexistente lança EntityNotFoundException (404)")
    void updateFarm_NotFound() {
        FarmRequestDTO requestDTO = new FarmRequestDTO("Nova Fazenda");
        when(farmRepository.findById(999L)).thenReturn(Optional.empty());

        assertThrows(EntityNotFoundException.class, () -> farmService.updateFarm(999L, requestDTO, 1L));
        verify(farmRepository, never()).save(any());
    }

    @Test
    @DisplayName("Atualizar fazenda pertencente a outro usuário lança SecurityException (403)")
    void updateFarm_Forbidden() {
        FarmRequestDTO requestDTO = new FarmRequestDTO("Nova Fazenda");
        when(farmRepository.findById(10L)).thenReturn(Optional.of(farm));

        assertThrows(SecurityException.class, () -> farmService.updateFarm(10L, requestDTO, 2L));
        verify(farmRepository, never()).save(any());
    }

    @Test
    @DisplayName("Atualizar fazenda com nome já utilizado por outra fazenda lança IllegalStateException (409)")
    void updateFarm_DuplicateName_ThrowsConflict() {
        FarmRequestDTO requestDTO = new FarmRequestDTO("Fazenda Duplicada");
        when(farmRepository.findById(10L)).thenReturn(Optional.of(farm));
        when(farmRepository.existsByNameAndUserIdAndIdNot("Fazenda Duplicada", 1L, 10L)).thenReturn(true);

        assertThrows(IllegalStateException.class, () -> farmService.updateFarm(10L, requestDTO, 1L));
        verify(farmRepository, never()).save(any());
    }

    @Test
    @DisplayName("Excluir fazenda com sucesso pelo proprietário sem limpezas ativas")
    void deleteFarm_Success() {
        when(farmRepository.findById(10L)).thenReturn(Optional.of(farm));
        when(cleanCmdRepository.existsByCorralFarmIdAndCleanState(10L, CleanState.EM_ANDAMENTO)).thenReturn(false);

        farmService.deleteFarm(10L, 1L);

        verify(farmRepository).delete(farm);
    }

    @Test
    @DisplayName("Excluir fazenda inexistente lança EntityNotFoundException (404)")
    void deleteFarm_NotFound() {
        when(farmRepository.findById(999L)).thenReturn(Optional.empty());

        assertThrows(EntityNotFoundException.class, () -> farmService.deleteFarm(999L, 1L));
        verify(farmRepository, never()).delete(any());
    }

    @Test
    @DisplayName("Excluir fazenda pertencente a outro usuário lança SecurityException (403)")
    void deleteFarm_Forbidden() {
        when(farmRepository.findById(10L)).thenReturn(Optional.of(farm));

        assertThrows(SecurityException.class, () -> farmService.deleteFarm(10L, 2L));
        verify(farmRepository, never()).delete(any());
    }

    @Test
    @DisplayName("Excluir fazenda com curral em limpeza ativa lança IllegalStateException (409)")
    void deleteFarm_ActiveCleaning_ThrowsConflict() {
        when(farmRepository.findById(10L)).thenReturn(Optional.of(farm));
        when(cleanCmdRepository.existsByCorralFarmIdAndCleanState(10L, CleanState.EM_ANDAMENTO)).thenReturn(true);

        assertThrows(IllegalStateException.class, () -> farmService.deleteFarm(10L, 1L));
        verify(farmRepository, never()).delete(any());
    }
}
