package com.usjt.a3.adversarial;

import com.usjt.a3.config.security.UserPrincipal;
import com.usjt.a3.controller.CorralController;
import com.usjt.a3.dto.request.CorralParametersRequestDTO;
import com.usjt.a3.dto.response.CorralMetricsResponseDTO;
import com.usjt.a3.dto.response.CorralResponseDTO;
import com.usjt.a3.mapper.CorralMapper;
import com.usjt.a3.model.entity.Corral;
import com.usjt.a3.model.entity.Farm;
import com.usjt.a3.model.entity.User;
import com.usjt.a3.model.enums.CleanOrigin;
import com.usjt.a3.model.enums.DeviceStatus;
import com.usjt.a3.repository.AnimalRepository;
import com.usjt.a3.repository.CleanCmdRepository;
import com.usjt.a3.repository.CorralRepository;
import com.usjt.a3.repository.FarmRepository;
import com.usjt.a3.repository.IdentifyPendencyRepository;
import com.usjt.a3.service.CorralService;
import com.usjt.a3.test.MockMvcTestHelper;
import com.usjt.a3.test.TestFixtures;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.Optional;

import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("Empirical Challenge Suite - Milestone M2 Operational Parameters & Metrics")
class M2AdversarialChallengeTest {

    @Mock private CorralRepository corralRepository;
    @Mock private FarmRepository farmRepository;
    @Mock private CleanCmdRepository cleanCmdRepository;
    @Mock private AnimalRepository animalRepository;
    @Mock private IdentifyPendencyRepository identifyPendencyRepository;
    @Spy private CorralMapper corralMapper = new CorralMapper();

    @InjectMocks private CorralService corralService;

    private User userA;
    private User userB;
    private Farm farmUserA;
    private Farm farmUserB;
    private Corral corralUserA;
    private Corral corralUserB;

    private MockMvc mockMvcUserA;

    @BeforeEach
    void setUp() {
        userA = TestFixtures.createUser(1L);
        userB = TestFixtures.createUser(2L);

        farmUserA = TestFixtures.createFarm(10L, userA);
        farmUserB = TestFixtures.createFarm(20L, userB);

        corralUserA = TestFixtures.createCorral(100L, farmUserA, "240AC4000100");
        corralUserA.setCleanTime(LocalTime.of(8, 0));
        corralUserA.setLimitOdor(400);
        corralUserA.setPumpDurationSeconds(30);

        corralUserB = TestFixtures.createCorral(200L, farmUserB, "240AC4000200");
        corralUserB.setCleanTime(LocalTime.of(9, 0));
        corralUserB.setLimitOdor(350);
        corralUserB.setPumpDurationSeconds(25);

        CorralController corralController = new CorralController(corralService);
        UserPrincipal principalA = TestFixtures.createPrincipal(1L);
        mockMvcUserA = MockMvcTestHelper.buildMockMvc(corralController, principalA);
    }

    // =========================================================================
    // 1. BOUNDARY VALIDATION: pumpDurationSeconds
    // =========================================================================
    @Nested
    @DisplayName("1. Boundary Validation: pumpDurationSeconds (0, -1, 61 -> 400 | 1, 60 -> 200)")
    class PumpDurationSecondsBoundaries {

        @ParameterizedTest(name = "pumpDurationSeconds={0} deve retornar HTTP 400 ProblemDetail")
        @ValueSource(ints = {0, -1, 61})
        void invalidPumpDurationSeconds_returns400(int duration) throws Exception {
            mockMvcUserA.perform(put("/api/v1/currais/100/parametros")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {
                                        "limitOdor": 300,
                                        "pumpDurationSeconds": %d
                                    }
                                    """.formatted(duration)))
                    .andExpect(status().isBadRequest())
                    .andExpect(header().string("Content-Type", "application/problem+json"))
                    .andExpect(jsonPath("$.title").value("Erro de Validação"))
                    .andExpect(jsonPath("$.status").value(400))
                    .andExpect(jsonPath("$.invalidParams.pumpDurationSeconds").exists());

            verify(corralRepository, never()).save(any());
        }

        @ParameterizedTest(name = "pumpDurationSeconds={0} deve retornar HTTP 200 com valor aceito")
        @ValueSource(ints = {1, 60})
        void validPumpDurationSeconds_returns200(int duration) throws Exception {
            when(corralRepository.findById(100L)).thenReturn(Optional.of(corralUserA));
            when(corralRepository.save(any(Corral.class))).thenAnswer(invocation -> invocation.getArgument(0));

            mockMvcUserA.perform(put("/api/v1/currais/100/parametros")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {
                                        "limitOdor": 300,
                                        "pumpDurationSeconds": %d
                                    }
                                    """.formatted(duration)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.id").value(100L))
                    .andExpect(jsonPath("$.pumpDurationSeconds").value(duration))
                    .andExpect(jsonPath("$.limitOdor").value(300));

            verify(corralRepository).save(argThat(c -> c.getPumpDurationSeconds().equals(duration)));
        }
    }

    // =========================================================================
    // 2. BOUNDARY VALIDATION: limitOdor
    // =========================================================================
    @Nested
    @DisplayName("2. Boundary Validation: limitOdor (-1 -> 400 | 0, 400 -> 200)")
    class LimitOdorBoundaries {

        @Test
        @DisplayName("limitOdor=-1 deve retornar HTTP 400 ProblemDetail")
        void negativeLimitOdor_returns400() throws Exception {
            mockMvcUserA.perform(put("/api/v1/currais/100/parametros")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {
                                        "limitOdor": -1,
                                        "pumpDurationSeconds": 30
                                    }
                                    """))
                    .andExpect(status().isBadRequest())
                    .andExpect(header().string("Content-Type", "application/problem+json"))
                    .andExpect(jsonPath("$.title").value("Erro de Validação"))
                    .andExpect(jsonPath("$.status").value(400))
                    .andExpect(jsonPath("$.invalidParams.limitOdor").exists());

            verify(corralRepository, never()).save(any());
        }

        @ParameterizedTest(name = "limitOdor={0} deve retornar HTTP 200 com valor aceito")
        @ValueSource(ints = {0, 400})
        void validLimitOdor_returns200(int odor) throws Exception {
            when(corralRepository.findById(100L)).thenReturn(Optional.of(corralUserA));
            when(corralRepository.save(any(Corral.class))).thenAnswer(invocation -> invocation.getArgument(0));

            mockMvcUserA.perform(put("/api/v1/currais/100/parametros")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {
                                        "limitOdor": %d,
                                        "pumpDurationSeconds": 30
                                    }
                                    """.formatted(odor)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.id").value(100L))
                    .andExpect(jsonPath("$.limitOdor").value(odor));

            verify(corralRepository).save(argThat(c -> c.getLimitOdor().equals(odor)));
        }
    }

    // =========================================================================
    // 3. NULL cleanTime: Desativação do Agendamento sem Erros
    // =========================================================================
    @Nested
    @DisplayName("3. Null cleanTime Probes (Desativação de Horário Agendado)")
    class NullCleanTimeProbes {

        @Test
        @DisplayName("PUT com cleanTime nulo limpa o cleanTime no banco e retorna 200 OK")
        void putWithNullCleanTime_clearsField_andReturns200() throws Exception {
            assertNotNull(corralUserA.getCleanTime(), "Pré-condição: curral deve possuir cleanTime configurado inicialmente");

            when(corralRepository.findById(100L)).thenReturn(Optional.of(corralUserA));
            when(corralRepository.save(any(Corral.class))).thenAnswer(invocation -> invocation.getArgument(0));

            mockMvcUserA.perform(put("/api/v1/currais/100/parametros")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {
                                        "cleanTime": null,
                                        "limitOdor": 400,
                                        "pumpDurationSeconds": 30
                                    }
                                    """))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.id").value(100L))
                    .andExpect(jsonPath("$.cleanTime").isEmpty());

            assertNull(corralUserA.getCleanTime(), "O cleanTime deve ter sido anulado na entidade");
            verify(corralRepository).save(argThat(c -> c.getCleanTime() == null));
        }

        @Test
        @DisplayName("Service direto: updateParameters com cleanTime nulo persiste null no repositório")
        void serviceUpdateParameters_withNullCleanTime_persistsNull() {
            corralUserA.setCleanTime(LocalTime.of(12, 0));
            when(corralRepository.findById(100L)).thenReturn(Optional.of(corralUserA));
            when(corralRepository.save(any(Corral.class))).thenAnswer(invocation -> invocation.getArgument(0));

            CorralParametersRequestDTO dto = new CorralParametersRequestDTO(null, 450, 45);
            CorralResponseDTO response = corralService.updateParameters(100L, dto, 1L);

            assertNotNull(response);
            assertNull(response.cleanTime(), "O DTO retornado deve ter cleanTime nulo");
            assertNull(corralUserA.getCleanTime(), "A entidade deve ter cleanTime nulo após salvamento");
            verify(corralRepository).save(corralUserA);
        }
    }

    // =========================================================================
    // 4. MULTI-TENANT BOUNDARY: User A não pode alterar curral de User B (403)
    // =========================================================================
    @Nested
    @DisplayName("4. Multi-Tenant Boundary Probes (User A vs User B -> 403 Forbidden)")
    class MultiTenantBoundaryProbes {

        @Test
        @DisplayName("PUT /api/v1/currais/{id}/parametros de outro usuário retorna 403 Forbidden")
        void putParameters_otherUserCorral_returns403() throws Exception {
            when(corralRepository.findById(200L)).thenReturn(Optional.of(corralUserB));

            mockMvcUserA.perform(put("/api/v1/currais/200/parametros")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {
                                        "cleanTime": "10:00:00",
                                        "limitOdor": 300,
                                        "pumpDurationSeconds": 20
                                    }
                                    """))
                    .andExpect(status().isForbidden())
                    .andExpect(header().string("Content-Type", "application/problem+json"))
                    .andExpect(jsonPath("$.title").value("Acesso Negado"))
                    .andExpect(jsonPath("$.status").value(403))
                    .andExpect(jsonPath("$.detail").value(containsString("não tem permissão para editar os parâmetros")));

            verify(corralRepository, never()).save(any());
        }

        @Test
        @DisplayName("GET /api/v1/currais/{id}/metricas de outro usuário retorna 403 Forbidden")
        void getMetrics_otherUserCorral_returns403() throws Exception {
            when(corralRepository.findById(200L)).thenReturn(Optional.of(corralUserB));

            mockMvcUserA.perform(get("/api/v1/currais/200/metricas"))
                    .andExpect(status().isForbidden())
                    .andExpect(header().string("Content-Type", "application/problem+json"))
                    .andExpect(jsonPath("$.title").value("Acesso Negado"))
                    .andExpect(jsonPath("$.status").value(403))
                    .andExpect(jsonPath("$.detail").value(containsString("não tem permissão para visualizar as métricas")));
        }

        @Test
        @DisplayName("PUT aninhado /api/v1/farms/{farmId}/currais/{id}/parametros de outro usuário retorna 403 Forbidden")
        void putParameters_nestedRoute_otherUser_returns403() throws Exception {
            when(corralRepository.findById(200L)).thenReturn(Optional.of(corralUserB));

            mockMvcUserA.perform(put("/api/v1/farms/20/currais/200/parametros")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {
                                        "limitOdor": 300,
                                        "pumpDurationSeconds": 20
                                    }
                                    """))
                    .andExpect(status().isForbidden())
                    .andExpect(header().string("Content-Type", "application/problem+json"))
                    .andExpect(jsonPath("$.title").value("Acesso Negado"))
                    .andExpect(jsonPath("$.status").value(403));

            verify(corralRepository, never()).save(any());
        }

        @Test
        @DisplayName("GET aninhado /api/v1/farms/{farmId}/currais/{id}/metricas de outro usuário retorna 403 Forbidden")
        void getMetrics_nestedRoute_otherUser_returns403() throws Exception {
            when(corralRepository.findById(200L)).thenReturn(Optional.of(corralUserB));

            mockMvcUserA.perform(get("/api/v1/farms/20/currais/200/metricas"))
                    .andExpect(status().isForbidden())
                    .andExpect(header().string("Content-Type", "application/problem+json"))
                    .andExpect(jsonPath("$.title").value("Acesso Negado"))
                    .andExpect(jsonPath("$.status").value(403));
        }
    }

    // =========================================================================
    // 5. NON-EXISTENT CORRAL (ID 999999): Retorna 404 RFC 7807 ProblemDetail
    // =========================================================================
    @Nested
    @DisplayName("5. Non-existent Corral Probes (ID 999999 -> 404 ProblemDetail)")
    class NonExistentCorralProbes {

        @Test
        @DisplayName("PUT /api/v1/currais/999999/parametros retorna 404 RFC 7807 ProblemDetail")
        void putParameters_nonExistentCorral_returns404() throws Exception {
            when(corralRepository.findById(999999L)).thenReturn(Optional.empty());

            mockMvcUserA.perform(put("/api/v1/currais/999999/parametros")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {
                                        "limitOdor": 400,
                                        "pumpDurationSeconds": 30
                                    }
                                    """))
                    .andExpect(status().isNotFound())
                    .andExpect(header().string("Content-Type", "application/problem+json"))
                    .andExpect(jsonPath("$.title").value("Recurso Não Encontrado"))
                    .andExpect(jsonPath("$.status").value(404))
                    .andExpect(jsonPath("$.detail").value("Curral não encontrado com ID: 999999"));

            verify(corralRepository, never()).save(any());
        }

        @Test
        @DisplayName("GET /api/v1/currais/999999/metricas retorna 404 RFC 7807 ProblemDetail")
        void getMetrics_nonExistentCorral_returns404() throws Exception {
            when(corralRepository.findById(999999L)).thenReturn(Optional.empty());

            mockMvcUserA.perform(get("/api/v1/currais/999999/metricas"))
                    .andExpect(status().isNotFound())
                    .andExpect(header().string("Content-Type", "application/problem+json"))
                    .andExpect(jsonPath("$.title").value("Recurso Não Encontrado"))
                    .andExpect(jsonPath("$.status").value(404))
                    .andExpect(jsonPath("$.detail").value("Curral não encontrado com ID: 999999"));
        }

        @Test
        @DisplayName("PUT rota aninhada com farmId incorreto retorna 404 ProblemDetail")
        void putParameters_farmMismatch_returns404() throws Exception {
            when(corralRepository.findById(100L)).thenReturn(Optional.of(corralUserA));

            mockMvcUserA.perform(put("/api/v1/farms/99/currais/100/parametros")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {
                                        "limitOdor": 400,
                                        "pumpDurationSeconds": 30
                                    }
                                    """))
                    .andExpect(status().isNotFound())
                    .andExpect(header().string("Content-Type", "application/problem+json"))
                    .andExpect(jsonPath("$.title").value("Recurso Não Encontrado"))
                    .andExpect(jsonPath("$.status").value(404))
                    .andExpect(jsonPath("$.detail").value("Curral não pertence à fazenda informada"));

            verify(corralRepository, never()).save(any());
        }

        @Test
        @DisplayName("GET rota aninhada com farmId incorreto retorna 404 ProblemDetail")
        void getMetrics_farmMismatch_returns404() throws Exception {
            when(corralRepository.findById(100L)).thenReturn(Optional.of(corralUserA));

            mockMvcUserA.perform(get("/api/v1/farms/99/currais/100/metricas"))
                    .andExpect(status().isNotFound())
                    .andExpect(header().string("Content-Type", "application/problem+json"))
                    .andExpect(jsonPath("$.title").value("Recurso Não Encontrado"))
                    .andExpect(jsonPath("$.status").value(404))
                    .andExpect(jsonPath("$.detail").value("Curral não pertence à fazenda informada"));
        }
    }

    // =========================================================================
    // 6. DASHBOARD METRICS: Heartbeat Timeout & Aggregation Accuracy
    // =========================================================================
    @Nested
    @DisplayName("6. Dashboard Metrics Heartbeat Timeout & Aggregation Accuracy")
    class MetricsHeartbeatAndCounters {

        @Test
        @DisplayName("lastSeenAt expirado (>60s) forca status OFFLINE mesmo com entidade marcada ONLINE")
        void staleHeartbeat_resolvesOfflineStatus() throws Exception {
            LocalDateTime staleTimestamp = LocalDateTime.now().minusSeconds(65);
            corralUserA.setDeviceStatus(DeviceStatus.ONLINE);
            corralUserA.setLastSeenAt(staleTimestamp);

            when(corralRepository.findById(100L)).thenReturn(Optional.of(corralUserA));

            mockMvcUserA.perform(get("/api/v1/currais/100/metricas"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.deviceStatus").value("OFFLINE"));
        }

        @Test
        @DisplayName("lastSeenAt recente (<60s) preserva status ONLINE")
        void freshHeartbeat_resolvesOnlineStatus() throws Exception {
            LocalDateTime freshTimestamp = LocalDateTime.now().minusSeconds(20);
            corralUserA.setDeviceStatus(DeviceStatus.ONLINE);
            corralUserA.setLastSeenAt(freshTimestamp);

            when(corralRepository.findById(100L)).thenReturn(Optional.of(corralUserA));

            mockMvcUserA.perform(get("/api/v1/currais/100/metricas"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.deviceStatus").value("ONLINE"));
        }

        @Test
        @DisplayName("lastSeenAt nulo resolve para status OFFLINE")
        void nullHeartbeat_resolvesOfflineStatus() throws Exception {
            corralUserA.setDeviceStatus(DeviceStatus.ONLINE);
            corralUserA.setLastSeenAt(null);

            when(corralRepository.findById(100L)).thenReturn(Optional.of(corralUserA));

            mockMvcUserA.perform(get("/api/v1/currais/100/metricas"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.deviceStatus").value("OFFLINE"));
        }

        @Test
        @DisplayName("Contadores agregados de limpeza, animais e pendências refletem chamadas aos repositórios")
        void aggregatedCounters_reflectRepositoryValues() throws Exception {
            when(corralRepository.findById(100L)).thenReturn(Optional.of(corralUserA));
            when(animalRepository.countByCurrentCorralId(100L)).thenReturn(15L);
            when(animalRepository.countByFarmId(10L)).thenReturn(50L);

            when(cleanCmdRepository.countByCorralIdAndCleanOriginAndCreatedAtGreaterThanEqual(eq(100L), eq(CleanOrigin.MANUAL), any(LocalDateTime.class)))
                    .thenReturn(4L);
            when(cleanCmdRepository.countByCorralIdAndCleanOriginAndCreatedAtGreaterThanEqual(eq(100L), eq(CleanOrigin.EVENTO), any(LocalDateTime.class)))
                    .thenReturn(6L);
            when(cleanCmdRepository.countByCorralIdAndCleanOriginAndCreatedAtGreaterThanEqual(eq(100L), eq(CleanOrigin.AUTOMATICA), any(LocalDateTime.class)))
                    .thenReturn(2L);

            when(identifyPendencyRepository.countByCorralIdAndResolvedFalse(100L)).thenReturn(7L);

            mockMvcUserA.perform(get("/api/v1/currais/100/metricas"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.totalAnimaisNoCurral").value(15))
                    .andExpect(jsonPath("$.totalAnimaisNaFazenda").value(50))
                    .andExpect(jsonPath("$.limpezasHojeManual").value(4))
                    .andExpect(jsonPath("$.limpezasHojeOdor").value(6))
                    .andExpect(jsonPath("$.limpezasHojeAutomatica").value(2))
                    .andExpect(jsonPath("$.limpezasHojeTotal").value(12))
                    .andExpect(jsonPath("$.pendenciasAbertas").value(7));
        }
    }
}
