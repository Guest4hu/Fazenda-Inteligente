package com.usjt.a3.service;

import com.usjt.a3.model.entity.Corral;
import com.usjt.a3.model.entity.Farm;
import com.usjt.a3.model.entity.User;
import com.usjt.a3.repository.CorralRepository;
import com.usjt.a3.test.TestFixtures;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CorralSseServiceTest {

    @Mock
    private CorralRepository corralRepository;

    @InjectMocks
    private CorralSseService corralSseService;

    private User owner;
    private Farm farm;
    private Corral corral;

    @BeforeEach
    void setUp() {
        owner = TestFixtures.createUser(1L);
        farm = TestFixtures.createFarm(10L, owner);
        corral = TestFixtures.createCorral(100L, farm, "240AC4000100");
    }

    @Test
    @DisplayName("Deve inscrever cliente SSE com sucesso quando curral pertence ao produtor")
    void subscribe_Success() {
        when(corralRepository.findById(100L)).thenReturn(Optional.of(corral));

        SseEmitter emitter = corralSseService.subscribe(100L, 10L, 1L);

        assertNotNull(emitter);
        assertDoesNotThrow(() -> corralSseService.sendEvent(100L, "odor", Map.of("value", 420)));
    }

    @Test
    @DisplayName("Deve lançar SecurityException (403) ao tentar assinar stream de curral de outro produtor")
    void subscribe_Forbidden() {
        when(corralRepository.findById(100L)).thenReturn(Optional.of(corral));

        assertThrows(SecurityException.class, () -> corralSseService.subscribe(100L, 10L, 999L));
    }

    @Test
    @DisplayName("Deve lançar EntityNotFoundException (404) quando farmId aninhado não corresponde ao curral")
    void subscribe_FarmMismatch_NotFound() {
        when(corralRepository.findById(100L)).thenReturn(Optional.of(corral));

        assertThrows(EntityNotFoundException.class, () -> corralSseService.subscribe(100L, 999L, 1L));
    }
}
