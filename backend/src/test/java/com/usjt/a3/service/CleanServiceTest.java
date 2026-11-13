package com.usjt.a3.service;

import com.usjt.a3.dto.request.CleanCmdRequestDTO;
import com.usjt.a3.dto.response.CleanCmdResponseDTO;
import com.usjt.a3.mapper.CleanCmdMapper;
import com.usjt.a3.model.entity.CleanCmd;
import com.usjt.a3.model.entity.Corral;
import com.usjt.a3.model.entity.Farm;
import com.usjt.a3.model.entity.User;
import com.usjt.a3.model.enums.CleanOrigin;
import com.usjt.a3.model.enums.CleanState;
import com.usjt.a3.model.enums.ComandResult;
import com.usjt.a3.model.enums.DeviceStatus;
import com.usjt.a3.repository.AnimalRepository;
import com.usjt.a3.repository.CleanCmdRepository;
import com.usjt.a3.repository.CorralRepository;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CleanServiceTest {

    @Mock
    private CorralRepository corralRepository;

    @Mock
    private AnimalRepository animalRepository;

    @Mock
    private CleanCmdRepository cleanCmdRepository;

    @Spy
    private CleanCmdMapper cleanCmdMapper = new CleanCmdMapper();

    @Mock
    private AckService ackService;

    @Mock
    private CommandPublisher commandPublisher;

    @Mock
    private CorralSseService corralSseService;

    @InjectMocks
    private CleanService cleanService;

    private Corral corral;
    private User user;
    private Farm farm;

    @BeforeEach
    void setUp() {
        org.springframework.test.util.ReflectionTestUtils.setField(cleanService, "corralSseService", corralSseService);

        user = new User();
        user.setId(1L);

        farm = new Farm();
        farm.setId(10L);
        farm.setUser(user);

        corral = new Corral();
        corral.setId(100L);
        corral.setName("Curral Alpha");
        corral.setMacAddress("240AC4000110");
        corral.setPumpDurationSeconds(20);
        corral.setDeviceStatus(DeviceStatus.ONLINE);
        corral.setLastSeenAt(LocalDateTime.now());
        corral.setFarm(farm);
    }

    @Test
    @DisplayName("triggerManualClean dispara bomba com sucesso quando regras são satisfeitas")
    void triggerManualClean_Success() {
        when(corralRepository.findById(100L)).thenReturn(Optional.of(corral));
        when(corralRepository.existsByIdAndFarmUserId(100L, 1L)).thenReturn(true);
        when(animalRepository.existsByCurrentCorralId(100L)).thenReturn(false);
        when(cleanCmdRepository.existsByCorralIdAndCleanState(100L, CleanState.EM_ANDAMENTO)).thenReturn(false);

        CleanCmd savedCmd = CleanCmd.builder()
                .id(UUID.randomUUID())
                .corral(corral)
                .cleanOrigin(CleanOrigin.MANUAL)
                .cleanState(CleanState.EM_ANDAMENTO)
                .secondsDuration(20)
                .createdAt(LocalDateTime.now())
                .build();

        when(cleanCmdRepository.save(any(CleanCmd.class))).thenReturn(savedCmd);
        when(ackService.awaitAck(any(UUID.class))).thenReturn(ComandResult.SUCCESS);

        CleanCmdResponseDTO result = cleanService.triggerManualClean(100L, 1L, new CleanCmdRequestDTO(CleanOrigin.MANUAL, 20));

        assertNotNull(result);
        assertEquals(CleanState.CONCLUIDO, result.state());
        verify(commandPublisher).pumpAction(eq("240AC4000110"), eq(savedCmd.getId()), eq(20));
        verify(ackService).registerAck(eq(savedCmd.getId()), eq("240AC4000110"));
    }

    @Test
    @DisplayName("triggerManualClean repassa duração customizada para o publicador MQTT da bomba")
    void triggerManualClean_CustomDuration() {
        when(corralRepository.findById(100L)).thenReturn(Optional.of(corral));
        when(corralRepository.existsByIdAndFarmUserId(100L, 1L)).thenReturn(true);
        when(animalRepository.existsByCurrentCorralId(100L)).thenReturn(false);
        when(cleanCmdRepository.existsByCorralIdAndCleanState(100L, CleanState.EM_ANDAMENTO)).thenReturn(false);

        CleanCmd savedCmd = CleanCmd.builder()
                .id(UUID.randomUUID())
                .corral(corral)
                .cleanOrigin(CleanOrigin.MANUAL)
                .cleanState(CleanState.EM_ANDAMENTO)
                .secondsDuration(50)
                .createdAt(LocalDateTime.now())
                .build();

        when(cleanCmdRepository.save(any(CleanCmd.class))).thenReturn(savedCmd);
        when(ackService.awaitAck(any(UUID.class))).thenReturn(ComandResult.SUCCESS);

        CleanCmdResponseDTO result = cleanService.triggerManualClean(100L, 1L, new CleanCmdRequestDTO(CleanOrigin.MANUAL, 50));

        assertNotNull(result);
        assertEquals(CleanState.CONCLUIDO, result.state());
        verify(commandPublisher).pumpAction(eq("240AC4000110"), eq(savedCmd.getId()), eq(50));
    }

    @Test
    @DisplayName("triggerManualClean recusa acionamento quando há animal no curral (Trava Biológica)")
    void triggerManualClean_BiologicalLock() {
        when(corralRepository.findById(100L)).thenReturn(Optional.of(corral));
        when(corralRepository.existsByIdAndFarmUserId(100L, 1L)).thenReturn(true);
        when(animalRepository.existsByCurrentCorralId(100L)).thenReturn(true);

        IllegalStateException ex = assertThrows(IllegalStateException.class, () ->
                cleanService.triggerManualClean(100L, 1L, null)
        );

        assertTrue(ex.getMessage().contains("Tem uma vaca no curral"));
        verifyNoInteractions(commandPublisher);
    }

    @Test
    @DisplayName("stopClean cancela comandos em andamento, publica comando de parada MQTT e aguarda ACK")
    void stopClean_Success() {
        when(corralRepository.findById(100L)).thenReturn(Optional.of(corral));
        when(corralRepository.existsByIdAndFarmUserId(100L, 1L)).thenReturn(true);

        CleanCmd emAndamento = CleanCmd.builder()
                .id(UUID.randomUUID())
                .corral(corral)
                .cleanOrigin(CleanOrigin.MANUAL)
                .cleanState(CleanState.EM_ANDAMENTO)
                .secondsDuration(20)
                .build();
        when(cleanCmdRepository.findByCorralIdOrderByCreatedAtDesc(100L)).thenReturn(List.of(emAndamento));

        CleanCmd stopSaved = CleanCmd.builder()
                .id(UUID.randomUUID())
                .corral(corral)
                .cleanOrigin(CleanOrigin.MANUAL)
                .cleanState(CleanState.CANCELADO)
                .secondsDuration(0)
                .createdAt(LocalDateTime.now())
                .build();
        when(cleanCmdRepository.save(any(CleanCmd.class))).thenReturn(stopSaved);
        when(ackService.awaitAck(any(UUID.class))).thenReturn(ComandResult.SUCCESS);

        CleanCmdResponseDTO result = cleanService.stopClean(100L, 1L);

        assertNotNull(result);
        assertEquals(CleanState.CANCELADO, result.state());
        assertEquals("Bomba parada e confirmada com sucesso!", result.mensagem());

        // Garante que o comando EM_ANDAMENTO foi cancelado no banco
        assertEquals(CleanState.CANCELADO, emAndamento.getCleanState());
        // Garante que a parada MQTT foi enviada
        verify(commandPublisher).stopPump(eq("240AC4000110"), any(UUID.class));
        verify(ackService).registerAck(any(UUID.class), eq("240AC4000110"));
        verify(corralSseService).sendEvent(eq(100L), eq("limpeza"), any());
    }

    @Test
    @DisplayName("stopClean recusa e lança IllegalStateException quando ESP32 está OFFLINE")
    void stopClean_DeviceOffline() {
        corral.setDeviceStatus(DeviceStatus.OFFLINE);
        when(corralRepository.findById(100L)).thenReturn(Optional.of(corral));
        when(corralRepository.existsByIdAndFarmUserId(100L, 1L)).thenReturn(true);
        when(cleanCmdRepository.findByCorralIdOrderByCreatedAtDesc(100L)).thenReturn(List.of());

        IllegalStateException ex = assertThrows(IllegalStateException.class, () ->
                cleanService.stopClean(100L, 1L)
        );

        assertTrue(ex.getMessage().contains("offline"));
        verifyNoInteractions(commandPublisher);
    }

    @Test
    @DisplayName("stopClean recusa acesso de usuário não proprietário (SecurityException)")
    void stopClean_ForbiddenUser() {
        when(corralRepository.findById(100L)).thenReturn(Optional.of(corral));
        when(corralRepository.existsByIdAndFarmUserId(100L, 2L)).thenReturn(false);

        assertThrows(SecurityException.class, () ->
                cleanService.stopClean(100L, 2L)
        );

        verifyNoInteractions(commandPublisher);
    }
}
