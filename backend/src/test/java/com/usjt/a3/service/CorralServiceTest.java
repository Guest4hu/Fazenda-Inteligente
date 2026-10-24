package com.usjt.a3.service;

import com.usjt.a3.dto.request.CorralParametersRequestDTO;
import com.usjt.a3.dto.request.CorralRequestDTO;
import com.usjt.a3.dto.response.CorralMetricsResponseDTO;
import com.usjt.a3.dto.response.CorralResponseDTO;
import com.usjt.a3.mapper.CorralMapper;
import com.usjt.a3.model.entity.Corral;
import com.usjt.a3.model.entity.Farm;
import com.usjt.a3.model.entity.User;
import com.usjt.a3.model.enums.CleanOrigin;
import com.usjt.a3.model.enums.CleanState;
import com.usjt.a3.model.enums.DeviceStatus;
import com.usjt.a3.repository.AnimalRepository;
import com.usjt.a3.repository.CleanCmdRepository;
import com.usjt.a3.repository.CorralRepository;
import com.usjt.a3.repository.FarmRepository;
import com.usjt.a3.repository.IdentifyPendencyRepository;
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
import java.time.LocalTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CorralServiceTest {

    @Mock
    private CorralRepository corralRepository;

    @Mock
    private CorralMapper corralMapper;

    @Mock
    private FarmRepository farmRepository;

    @Mock
    private CleanCmdRepository cleanCmdRepository;

    @Mock
    private AnimalRepository animalRepository;

    @Mock
    private IdentifyPendencyRepository identifyPendencyRepository;

    @InjectMocks
    private CorralService corralService;

    private User owner;
    private Farm farm;
    private Corral corral;

    @BeforeEach
    void setUp() {
        owner = TestFixtures.createUser(1L);
        farm = TestFixtures.createFarm(10L, owner);
        corral = TestFixtures.createCorral(5L, farm, "240AC4000110");
    }

    @Test
    @DisplayName("Atualizar curral com sucesso pelo proprietário")
    void updateCorral_Success() {
        CorralRequestDTO requestDTO = new CorralRequestDTO(
                "Curral Atualizado",
                "24:0A:C4:00:03:30",
                LocalTime.of(8, 0),
                350,
                25
        );
        CorralResponseDTO responseDTO = new CorralResponseDTO(
                5L, 10L, "Curral Atualizado", "240AC4000330", LocalTime.of(8, 0),
                350, 25, DeviceStatus.ONLINE, LocalDateTime.now()
        );

        when(corralRepository.findById(5L)).thenReturn(Optional.of(corral));
        when(corralRepository.existsByMacAddressAndIdNot("240AC4000330", 5L)).thenReturn(false);
        when(corralRepository.save(any(Corral.class))).thenReturn(corral);
        when(corralMapper.toCorralResponseDTO(corral)).thenReturn(responseDTO);

        CorralResponseDTO result = corralService.updateCorral(5L, requestDTO, 1L);

        assertNotNull(result);
        assertEquals("Curral Atualizado", result.name());
        assertEquals("240AC4000330", result.macAddress());
        verify(corralRepository).save(corral);
    }

    @Test
    @DisplayName("Atualizar curral inexistente lança EntityNotFoundException (404)")
    void updateCorral_NotFound() {
        CorralRequestDTO requestDTO = new CorralRequestDTO("Curral", "240AC4000110", null, 400, 30);
        when(corralRepository.findById(999L)).thenReturn(Optional.empty());

        assertThrows(EntityNotFoundException.class, () -> corralService.updateCorral(999L, requestDTO, 1L));
        verify(corralRepository, never()).save(any());
    }

    @Test
    @DisplayName("Atualizar curral de outro produtor lança SecurityException (403)")
    void updateCorral_Forbidden() {
        CorralRequestDTO requestDTO = new CorralRequestDTO("Curral", "240AC4000110", null, 400, 30);
        when(corralRepository.findById(5L)).thenReturn(Optional.of(corral));

        assertThrows(SecurityException.class, () -> corralService.updateCorral(5L, requestDTO, 2L));
        verify(corralRepository, never()).save(any());
    }

    @Test
    @DisplayName("Atualizar curral com MAC Address pertencente a outro curral lança IllegalStateException (409)")
    void updateCorral_DuplicateMac_Conflict() {
        CorralRequestDTO requestDTO = new CorralRequestDTO("Curral", "24:0A:C4:00:09:99", null, 400, 30);
        when(corralRepository.findById(5L)).thenReturn(Optional.of(corral));
        when(corralRepository.existsByMacAddressAndIdNot("240AC4000999", 5L)).thenReturn(true);

        assertThrows(IllegalStateException.class, () -> corralService.updateCorral(5L, requestDTO, 1L));
        verify(corralRepository, never()).save(any());
    }

    @Test
    @DisplayName("Excluir curral com sucesso sem limpezas ativas")
    void deleteCorral_Success() {
        when(corralRepository.findById(5L)).thenReturn(Optional.of(corral));
        when(cleanCmdRepository.existsByCorralIdAndCleanState(5L, CleanState.EM_ANDAMENTO)).thenReturn(false);
        when(cleanCmdRepository.existsByCorralIdAndCleanState(5L, CleanState.PENDENTE)).thenReturn(false);

        corralService.deleteCorral(5L, 1L);

        verify(corralRepository).delete(corral);
    }

    @Test
    @DisplayName("Excluir curral inexistente lança EntityNotFoundException (404)")
    void deleteCorral_NotFound() {
        when(corralRepository.findById(999L)).thenReturn(Optional.empty());

        assertThrows(EntityNotFoundException.class, () -> corralService.deleteCorral(999L, 1L));
        verify(corralRepository, never()).delete(any());
    }

    @Test
    @DisplayName("Excluir curral de outro produtor lança SecurityException (403)")
    void deleteCorral_Forbidden() {
        when(corralRepository.findById(5L)).thenReturn(Optional.of(corral));

        assertThrows(SecurityException.class, () -> corralService.deleteCorral(5L, 2L));
        verify(corralRepository, never()).delete(any());
    }

    @Test
    @DisplayName("Excluir curral com limpeza em andamento lança IllegalStateException (409)")
    void deleteCorral_ActiveCleaning_Conflict() {
        when(corralRepository.findById(5L)).thenReturn(Optional.of(corral));
        when(cleanCmdRepository.existsByCorralIdAndCleanState(5L, CleanState.EM_ANDAMENTO)).thenReturn(true);

        assertThrows(IllegalStateException.class, () -> corralService.deleteCorral(5L, 1L));
        verify(corralRepository, never()).delete(any());
    }

    @Test
    @DisplayName("Buscar curral por ID com sucesso pelo proprietário")
    void getCorralById_Success() {
        CorralResponseDTO responseDTO = new CorralResponseDTO(
                5L, 10L, "Curral Principal", "240AC4000110", null,
                400, 30, DeviceStatus.ONLINE, LocalDateTime.now()
        );

        when(corralRepository.findById(5L)).thenReturn(Optional.of(corral));
        when(corralMapper.toCorralResponseDTO(corral)).thenReturn(responseDTO);

        CorralResponseDTO result = corralService.getCorralById(5L, 1L);

        assertNotNull(result);
        assertEquals(5L, result.id());
    }

    @Test
    @DisplayName("Buscar curral de outro produtor lança SecurityException (403)")
    void getCorralById_Forbidden() {
        when(corralRepository.findById(5L)).thenReturn(Optional.of(corral));

        assertThrows(SecurityException.class, () -> corralService.getCorralById(5L, 2L));
    }

    @Test
    @DisplayName("Atualizar parâmetros operacionais com sucesso pelo proprietário")
    void updateParameters_Success_AllParameters() {
        CorralParametersRequestDTO requestDTO = new CorralParametersRequestDTO(
                LocalTime.of(8, 30),
                450,
                20
        );
        CorralResponseDTO responseDTO = new CorralResponseDTO(
                5L, 10L, "Curral 01", "240AC4000110", LocalTime.of(8, 30),
                450, 20, DeviceStatus.ONLINE, LocalDateTime.now()
        );

        when(corralRepository.findById(5L)).thenReturn(Optional.of(corral));
        when(corralRepository.save(any(Corral.class))).thenReturn(corral);
        when(corralMapper.toCorralResponseDTO(corral)).thenReturn(responseDTO);

        CorralResponseDTO result = corralService.updateParameters(5L, requestDTO, 1L);

        assertNotNull(result);
        assertEquals(LocalTime.of(8, 30), result.cleanTime());
        assertEquals(450, result.limitOdor());
        assertEquals(20, result.pumpDurationSeconds());
        verify(corralRepository).save(corral);
    }

    @Test
    @DisplayName("Atualizar parâmetros com cleanTime nulo desativa agendamento com sucesso")
    void updateParameters_Success_DisableSchedule() {
        corral.setCleanTime(LocalTime.of(6, 0));
        CorralParametersRequestDTO requestDTO = new CorralParametersRequestDTO(
                null,
                400,
                30
        );
        CorralResponseDTO responseDTO = new CorralResponseDTO(
                5L, 10L, "Curral 01", "240AC4000110", null,
                400, 30, DeviceStatus.ONLINE, LocalDateTime.now()
        );

        when(corralRepository.findById(5L)).thenReturn(Optional.of(corral));
        when(corralRepository.save(any(Corral.class))).thenReturn(corral);
        when(corralMapper.toCorralResponseDTO(corral)).thenReturn(responseDTO);

        CorralResponseDTO result = corralService.updateParameters(5L, requestDTO, 1L);

        assertNotNull(result);
        assertNull(result.cleanTime());
        assertNull(corral.getCleanTime());
        verify(corralRepository).save(corral);
    }

    @Test
    @DisplayName("Atualizar parâmetros de curral inexistente lança EntityNotFoundException (404)")
    void updateParameters_NotFound() {
        CorralParametersRequestDTO requestDTO = new CorralParametersRequestDTO(null, 400, 30);
        when(corralRepository.findById(999L)).thenReturn(Optional.empty());

        assertThrows(EntityNotFoundException.class, () -> corralService.updateParameters(999L, requestDTO, 1L));
        verify(corralRepository, never()).save(any());
    }

    @Test
    @DisplayName("Atualizar parâmetros de curral de outro produtor lança SecurityException (403)")
    void updateParameters_Forbidden() {
        CorralParametersRequestDTO requestDTO = new CorralParametersRequestDTO(null, 400, 30);
        when(corralRepository.findById(5L)).thenReturn(Optional.of(corral));

        assertThrows(SecurityException.class, () -> corralService.updateParameters(5L, requestDTO, 2L));
        verify(corralRepository, never()).save(any());
    }

    @Test
    @DisplayName("Atualizar parâmetros via rota aninhada com farmId incorreto lança EntityNotFoundException (404)")
    void updateParameters_FarmMismatch() {
        CorralParametersRequestDTO requestDTO = new CorralParametersRequestDTO(null, 400, 30);
        when(corralRepository.findById(5L)).thenReturn(Optional.of(corral));

        assertThrows(EntityNotFoundException.class, () -> corralService.updateParameters(5L, 99L, 1L, requestDTO));
        verify(corralRepository, never()).save(any());
    }

    @Test
    @DisplayName("getCorralMetrics calcula corretamente contadores ativos, limpezas por origem e pendências")
    void getCorralMetrics_Success_ActiveCounts() {
        LocalDateTime recentSeen = LocalDateTime.now().minusSeconds(15);
        corral.setName("Curral de Engorda");
        corral.setDeviceStatus(DeviceStatus.ONLINE);
        corral.setLastSeenAt(recentSeen);

        when(corralRepository.findById(5L)).thenReturn(Optional.of(corral));
        when(animalRepository.countByCurrentCorralId(5L)).thenReturn(8L);
        when(animalRepository.countByFarmId(10L)).thenReturn(35L);

        when(cleanCmdRepository.countByCorralIdAndCleanOriginAndCreatedAtGreaterThanEqual(eq(5L), eq(CleanOrigin.MANUAL), any(LocalDateTime.class))).thenReturn(3L);
        when(cleanCmdRepository.countByCorralIdAndCleanOriginAndCreatedAtGreaterThanEqual(eq(5L), eq(CleanOrigin.EVENTO), any(LocalDateTime.class))).thenReturn(5L);
        when(cleanCmdRepository.countByCorralIdAndCleanOriginAndCreatedAtGreaterThanEqual(eq(5L), eq(CleanOrigin.AUTOMATICA), any(LocalDateTime.class))).thenReturn(2L);

        when(identifyPendencyRepository.countByCorralIdAndResolvedFalse(5L)).thenReturn(4L);

        CorralMetricsResponseDTO metrics = corralService.getCorralMetrics(5L, null, 1L);

        assertNotNull(metrics);
        assertEquals(5L, metrics.corralId());
        assertEquals("Curral de Engorda", metrics.corralName());
        assertEquals(10L, metrics.farmId());
        assertEquals("Fazenda Esperança 10", metrics.farmName());
        assertEquals(8L, metrics.totalAnimaisNoCurral());
        assertEquals(35L, metrics.totalAnimaisNaFazenda());

        // Limpezas de hoje
        assertEquals(10L, metrics.limpezasHojeTotal());
        assertEquals(3L, metrics.limpezasHojeManual());
        assertEquals(5L, metrics.limpezasHojeOdor());
        assertEquals(2L, metrics.limpezasHojeAutomatica());

        // Hardware e Pendências
        assertEquals(DeviceStatus.ONLINE, metrics.deviceStatus());
        assertEquals(recentSeen, metrics.lastSeenAt());
        assertEquals(4L, metrics.pendenciasAbertas());
    }

    @Test
    @DisplayName("getCorralMetrics com curral zerado retorna contadores zerados sem erros")
    void getCorralMetrics_Success_ZeroCounts() {
        corral.setDeviceStatus(DeviceStatus.OFFLINE);
        corral.setLastSeenAt(null);

        when(corralRepository.findById(5L)).thenReturn(Optional.of(corral));
        when(animalRepository.countByCurrentCorralId(5L)).thenReturn(0L);
        when(animalRepository.countByFarmId(10L)).thenReturn(0L);
        when(cleanCmdRepository.countByCorralIdAndCleanOriginAndCreatedAtGreaterThanEqual(eq(5L), any(CleanOrigin.class), any(LocalDateTime.class))).thenReturn(0L);
        when(identifyPendencyRepository.countByCorralIdAndResolvedFalse(5L)).thenReturn(0L);

        CorralMetricsResponseDTO metrics = corralService.getCorralMetrics(5L, 1L);

        assertNotNull(metrics);
        assertEquals(0L, metrics.totalAnimaisNoCurral());
        assertEquals(0L, metrics.totalAnimaisNaFazenda());
        assertEquals(0L, metrics.limpezasHojeTotal());
        assertEquals(0L, metrics.limpezasHojeManual());
        assertEquals(0L, metrics.limpezasHojeOdor());
        assertEquals(0L, metrics.limpezasHojeAutomatica());
        assertEquals(0L, metrics.pendenciasAbertas());
        assertEquals(DeviceStatus.OFFLINE, metrics.deviceStatus());
        assertNull(metrics.lastSeenAt());
    }

    @Test
    @DisplayName("getCorralMetrics determina status OFFLINE quando heartbeat exceder 60 segundos (timeout)")
    void getCorralMetrics_EffectiveStatus_OfflineOnTimeout() {
        corral.setDeviceStatus(DeviceStatus.ONLINE);
        corral.setLastSeenAt(LocalDateTime.now().minusSeconds(90));

        when(corralRepository.findById(5L)).thenReturn(Optional.of(corral));
        when(animalRepository.countByCurrentCorralId(5L)).thenReturn(0L);
        when(animalRepository.countByFarmId(10L)).thenReturn(0L);
        when(cleanCmdRepository.countByCorralIdAndCleanOriginAndCreatedAtGreaterThanEqual(anyLong(), any(), any())).thenReturn(0L);
        when(identifyPendencyRepository.countByCorralIdAndResolvedFalse(5L)).thenReturn(0L);

        CorralMetricsResponseDTO metrics = corralService.getCorralMetrics(5L, 1L);

        assertEquals(DeviceStatus.OFFLINE, metrics.deviceStatus());
    }

    @Test
    @DisplayName("getCorralMetrics determina status OFFLINE quando lastSeenAt for nulo mesmo com ONLINE no banco")
    void getCorralMetrics_EffectiveStatus_OfflineOnNullLastSeen() {
        corral.setDeviceStatus(DeviceStatus.ONLINE);
        corral.setLastSeenAt(null);

        when(corralRepository.findById(5L)).thenReturn(Optional.of(corral));
        when(animalRepository.countByCurrentCorralId(5L)).thenReturn(0L);
        when(animalRepository.countByFarmId(10L)).thenReturn(0L);
        when(cleanCmdRepository.countByCorralIdAndCleanOriginAndCreatedAtGreaterThanEqual(anyLong(), any(), any())).thenReturn(0L);
        when(identifyPendencyRepository.countByCorralIdAndResolvedFalse(5L)).thenReturn(0L);

        CorralMetricsResponseDTO metrics = corralService.getCorralMetrics(5L, 1L);

        assertEquals(DeviceStatus.OFFLINE, metrics.deviceStatus());
    }

    @Test
    @DisplayName("getCorralMetrics lança SecurityException (403) quando solicitado por usuário não proprietário")
    void getCorralMetrics_Forbidden() {
        when(corralRepository.findById(5L)).thenReturn(Optional.of(corral));

        assertThrows(SecurityException.class, () -> corralService.getCorralMetrics(5L, 2L));
    }

    @Test
    @DisplayName("getCorralMetrics lança EntityNotFoundException (404) quando curral não existir")
    void getCorralMetrics_NotFound() {
        when(corralRepository.findById(999L)).thenReturn(Optional.empty());

        assertThrows(EntityNotFoundException.class, () -> corralService.getCorralMetrics(999L, 1L));
    }

    @Test
    @DisplayName("getCorralMetrics lança EntityNotFoundException (404) quando farmId informado não corresponder ao curral")
    void getCorralMetrics_NestedFarmMismatch() {
        when(corralRepository.findById(5L)).thenReturn(Optional.of(corral));

        assertThrows(EntityNotFoundException.class, () -> corralService.getCorralMetrics(5L, 999L, 1L));
    }
}
