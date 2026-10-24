package com.usjt.a3.adversarial;

import com.usjt.a3.config.security.UserPrincipal;
import com.usjt.a3.controller.CorralController;
import com.usjt.a3.controller.PendencyController;
import com.usjt.a3.dto.request.AnimalPresenceRequestDTO;
import com.usjt.a3.dto.response.CorralMetricsResponseDTO;
import com.usjt.a3.dto.response.IdentifyPendencyResponseDTO;
import com.usjt.a3.mapper.CorralMapper;
import com.usjt.a3.mapper.IdentifyPendencyMapper;
import com.usjt.a3.model.entity.Animal;
import com.usjt.a3.model.entity.Corral;
import com.usjt.a3.model.entity.Farm;
import com.usjt.a3.model.entity.IdentifyPendency;
import com.usjt.a3.model.entity.User;
import com.usjt.a3.model.enums.AnimalEventType;
import com.usjt.a3.mqtt.entry.CommandRfidLeitura;
import com.usjt.a3.repository.AnimalEventRepository;
import com.usjt.a3.repository.AnimalRepository;
import com.usjt.a3.repository.CleanCmdRepository;
import com.usjt.a3.repository.CorralRepository;
import com.usjt.a3.repository.FarmRepository;
import com.usjt.a3.repository.IdentifyPendencyRepository;
import com.usjt.a3.service.AnimalService;
import com.usjt.a3.service.CorralService;
import com.usjt.a3.service.IdentifyPendencyService;
import com.usjt.a3.test.MockMvcTestHelper;
import com.usjt.a3.test.TestFixtures;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("Empirical Challenge Suite - Milestone M3 Ingestion, Error Handling, Dual Routing & Metrics")
public class M3IngestionAndMetricsChallengeTest {

    // Repositories
    @Mock private CorralRepository corralRepository;
    @Mock private FarmRepository farmRepository;
    @Mock private AnimalRepository animalRepository;
    @Mock private AnimalEventRepository animalEventRepository;
    @Mock private IdentifyPendencyRepository identifyPendencyRepository;
    @Mock private CleanCmdRepository cleanCmdRepository;

    // Services
    @Mock private AnimalService animalService;
    @Spy private IdentifyPendencyMapper identifyPendencyMapper = new IdentifyPendencyMapper();
    @Spy private CorralMapper corralMapper = new CorralMapper();

    @InjectMocks private IdentifyPendencyService identifyPendencyService;
    private CorralService corralService;

    private CommandRfidLeitura commandRfidLeitura;
    private final ObjectMapper objectMapper = new ObjectMapper();

    // Test domain fixtures
    private User owner;
    private User otherUser;
    private Farm farm1;
    private Farm farm2;
    private Corral corral1;
    private Corral corral2;
    private Animal animal1;

    private MockMvc mockMvcOwner;
    private MockMvc mockMvcCorralOwner;

    @BeforeEach
    void setUp() {
        owner = TestFixtures.createUser(1L);
        otherUser = TestFixtures.createUser(2L);

        farm1 = TestFixtures.createFarm(10L, owner);
        farm2 = TestFixtures.createFarm(20L, otherUser);

        corral1 = TestFixtures.createCorral(100L, farm1, "240AC4000100");
        corral2 = TestFixtures.createCorral(200L, farm2, "240AC4000200");

        animal1 = TestFixtures.createAnimal(50L, farm1, "TAG-CONHECIDA-01");

        // Wire CommandRfidLeitura with mock dependencies
        commandRfidLeitura = new CommandRfidLeitura(corralRepository, animalService, identifyPendencyService, objectMapper);

        // Wire CorralService
        corralService = new CorralService(
                corralRepository,
                corralMapper,
                farmRepository,
                cleanCmdRepository,
                animalRepository,
                identifyPendencyRepository
        );

        // Build MockMvc for controllers
        UserPrincipal ownerPrincipal = TestFixtures.createPrincipal(1L);
        PendencyController pendencyController = new PendencyController(identifyPendencyService);
        mockMvcOwner = MockMvcTestHelper.buildMockMvc(pendencyController, ownerPrincipal);

        CorralController corralController = new CorralController(corralService);
        mockMvcCorralOwner = MockMvcTestHelper.buildMockMvc(corralController, ownerPrincipal);
    }

    // =========================================================================
    // 1. ADVERSARIAL PROBE: Multiple Unknown RFID Scans in Succession
    // =========================================================================
    @Nested
    @DisplayName("1. Probe Multiple Unknown RFID Scans in Succession")
    class MultipleUnknownScansProbes {

        @Test
        @DisplayName("Succession of distinct unknown RFID scans records multiple pendencies with accurate timestamps and event types")
        void multipleDistinctUnknownScans_RecordedAccurately() {
            when(corralRepository.findByMacAddress("240AC4000100")).thenReturn(Optional.of(corral1));
            when(animalService.registerPresence(eq(100L), eq(1L), any(AnimalPresenceRequestDTO.class)))
                    .thenThrow(new EntityNotFoundException("Animal não cadastrado"));

            List<IdentifyPendency> savedPendencies = new ArrayList<>();
            when(identifyPendencyRepository.save(any(IdentifyPendency.class))).thenAnswer(i -> {
                IdentifyPendency p = i.getArgument(0);
                p.setId((long) (savedPendencies.size() + 1));
                savedPendencies.add(p);
                return p;
            });

            // 3 rapid unknown RFID scans
            String payload1 = """
                    {"tagUid": "UNK-TAG-001", "typeEvent": "ENTROU"}
                    """;
            String payload2 = """
                    {"tagUid": "UNK-TAG-002", "typeEvent": "SAIU"}
                    """;
            String payload3 = """
                    {"tagUid": "UNK-TAG-003", "typeEvent": "ENTROU"}
                    """;

            commandRfidLeitura.tratar("240AC4000100", payload1);
            commandRfidLeitura.tratar("240AC4000100", payload2);
            commandRfidLeitura.tratar("240AC4000100", payload3);

            // Verify 3 distinct pendencies persisted
            assertEquals(3, savedPendencies.size());

            IdentifyPendency p1 = savedPendencies.get(0);
            assertEquals("UNK-TAG-001", p1.getTagUid());
            assertEquals(AnimalEventType.ENTROU, p1.getAnimalEventType());
            assertFalse(p1.getResolved());
            assertNotNull(p1.getInstant());
            assertEquals(corral1, p1.getCorral());

            IdentifyPendency p2 = savedPendencies.get(1);
            assertEquals("UNK-TAG-002", p2.getTagUid());
            assertEquals(AnimalEventType.SAIU, p2.getAnimalEventType());
            assertFalse(p2.getResolved());
            assertNotNull(p2.getInstant());

            IdentifyPendency p3 = savedPendencies.get(2);
            assertEquals("UNK-TAG-003", p3.getTagUid());
            assertEquals(AnimalEventType.ENTROU, p3.getAnimalEventType());
            assertFalse(p3.getResolved());
            assertNotNull(p3.getInstant());
        }

        @Test
        @DisplayName("Succession of repeated unknown RFID scans for the SAME tag records distinct pendencies for each occurrence")
        void repeatedUnknownScansForSameTag_RecordedAsDistinctPendencies() {
            when(corralRepository.findByMacAddress("240AC4000100")).thenReturn(Optional.of(corral1));
            when(animalService.registerPresence(eq(100L), eq(1L), any(AnimalPresenceRequestDTO.class)))
                    .thenThrow(new EntityNotFoundException("Animal não cadastrado"));

            List<IdentifyPendency> savedPendencies = new ArrayList<>();
            when(identifyPendencyRepository.save(any(IdentifyPendency.class))).thenAnswer(i -> {
                IdentifyPendency p = i.getArgument(0);
                p.setId((long) (savedPendencies.size() + 10));
                savedPendencies.add(p);
                return p;
            });

            // Tag "GHOST-TAG-88" read 3 times (ENTROU -> SAIU -> ENTROU)
            commandRfidLeitura.tratar("240AC4000100", "{\"tagUid\": \"GHOST-TAG-88\", \"typeEvent\": \"ENTROU\"}");
            commandRfidLeitura.tratar("240AC4000100", "{\"tagUid\": \"GHOST-TAG-88\", \"typeEvent\": \"SAIU\"}");
            commandRfidLeitura.tratar("240AC4000100", "{\"tagUid\": \"GHOST-TAG-88\", \"typeEvent\": \"ENTROU\"}");

            assertEquals(3, savedPendencies.size());
            assertEquals("GHOST-TAG-88", savedPendencies.get(0).getTagUid());
            assertEquals(AnimalEventType.ENTROU, savedPendencies.get(0).getAnimalEventType());

            assertEquals("GHOST-TAG-88", savedPendencies.get(1).getTagUid());
            assertEquals(AnimalEventType.SAIU, savedPendencies.get(1).getAnimalEventType());

            assertEquals("GHOST-TAG-88", savedPendencies.get(2).getTagUid());
            assertEquals(AnimalEventType.ENTROU, savedPendencies.get(2).getAnimalEventType());

            // All must remain open initially
            assertTrue(savedPendencies.stream().noneMatch(IdentifyPendency::getResolved));
        }

        @Test
        @DisplayName("Resolving one pendency does NOT resolve or mutate other open pendencies in the succession")
        void resolvingOnePendency_LeavesOtherPendenciesOpen() {
            IdentifyPendency p1 = IdentifyPendency.builder()
                    .id(1L).corral(corral1).tagUid("UNK-A").animalEventType(AnimalEventType.ENTROU)
                    .instant(LocalDateTime.now().minusMinutes(20)).resolved(false).build();
            IdentifyPendency p2 = IdentifyPendency.builder()
                    .id(2L).corral(corral1).tagUid("UNK-B").animalEventType(AnimalEventType.SAIU)
                    .instant(LocalDateTime.now().minusMinutes(10)).resolved(false).build();

            when(identifyPendencyRepository.findById(1L)).thenReturn(Optional.of(p1));
            when(animalRepository.findById(50L)).thenReturn(Optional.of(animal1));
            when(identifyPendencyRepository.save(any(IdentifyPendency.class))).thenAnswer(i -> i.getArgument(0));

            // Resolve pendency 1
            IdentifyPendencyResponseDTO resolvedDto = identifyPendencyService.resolvePendency(1L, 50L, 1L);

            assertTrue(resolvedDto.resolved());
            assertEquals(1L, resolvedDto.id());
            assertEquals(50L, resolvedDto.animalIdResolved());

            // Verify pendency 2 was not touched
            assertFalse(p2.getResolved());
            assertNull(p2.getAnimal());
            assertNull(p2.getResolvedAt());
        }
    }

    // =========================================================================
    // 2. ADVERSARIAL PROBE: CommandRfidLeitura Exception & Resilience Handling
    // =========================================================================
    @Nested
    @DisplayName("2. Probe CommandRfidLeitura Exception Handling & Resilience")
    class ExceptionHandlingProbes {

        @Test
        @DisplayName("Unexpected database exception in AnimalService does NOT create pendency and does NOT throw out of tratar")
        void unexpectedDatabaseException_DoesNotCreatePendencyAndDoesNotThrow() {
            when(corralRepository.findByMacAddress("240AC4000100")).thenReturn(Optional.of(corral1));
            when(animalService.registerPresence(anyLong(), anyLong(), any(AnimalPresenceRequestDTO.class)))
                    .thenThrow(new DataIntegrityViolationException("Database constraint violation"));

            // Must NOT throw
            assertDoesNotThrow(() -> commandRfidLeitura.tratar("240AC4000100", "{\"tagUid\": \"TAG-01\", \"typeEvent\": \"ENTROU\"}"));

            // IdentifyPendencyRepository must NEVER be called (system failure is NOT an unknown RFID tag)
            verifyNoInteractions(identifyPendencyRepository);
        }

        @Test
        @DisplayName("SecurityException in AnimalService does NOT create pendency and is logged as warning")
        void securityException_DoesNotCreatePendency() {
            when(corralRepository.findByMacAddress("240AC4000100")).thenReturn(Optional.of(corral1));
            when(animalService.registerPresence(anyLong(), anyLong(), any(AnimalPresenceRequestDTO.class)))
                    .thenThrow(new SecurityException("Acesso negado ao curral"));

            assertDoesNotThrow(() -> commandRfidLeitura.tratar("240AC4000100", "{\"tagUid\": \"TAG-01\", \"typeEvent\": \"ENTROU\"}"));
            verifyNoInteractions(identifyPendencyRepository);
        }

        @Test
        @DisplayName("IllegalStateException in AnimalService does NOT create pendency")
        void illegalStateException_DoesNotCreatePendency() {
            when(corralRepository.findByMacAddress("240AC4000100")).thenReturn(Optional.of(corral1));
            when(animalService.registerPresence(anyLong(), anyLong(), any(AnimalPresenceRequestDTO.class)))
                    .thenThrow(new IllegalStateException("Animal em estado inválido"));

            assertDoesNotThrow(() -> commandRfidLeitura.tratar("240AC4000100", "{\"tagUid\": \"TAG-01\", \"typeEvent\": \"ENTROU\"}"));
            verifyNoInteractions(identifyPendencyRepository);
        }

        @Test
        @DisplayName("Failure inside IdentifyPendencyService.createPendency is caught gracefully without breaking MQTT thread")
        void failureInsideCreatePendency_IsCaughtGracefully() {
            when(corralRepository.findByMacAddress("240AC4000100")).thenReturn(Optional.of(corral1));
            when(animalService.registerPresence(anyLong(), anyLong(), any(AnimalPresenceRequestDTO.class)))
                    .thenThrow(new EntityNotFoundException("Animal não cadastrado"));
            when(identifyPendencyRepository.save(any(IdentifyPendency.class)))
                    .thenThrow(new RuntimeException("PostgreSQL connection severed"));

            // Must NOT throw, thread survives
            assertDoesNotThrow(() -> commandRfidLeitura.tratar("240AC4000100", "{\"tagUid\": \"UNK-99\", \"typeEvent\": \"ENTROU\"}"));
        }

        @Test
        @DisplayName("Corral repository throwing unexpected exception is handled gracefully")
        void corralRepositoryException_HandledGracefully() {
            when(corralRepository.findByMacAddress("240AC4000100"))
                    .thenThrow(new RuntimeException("JPA EntityManager closed"));

            assertDoesNotThrow(() -> commandRfidLeitura.tratar("240AC4000100", "{\"tagUid\": \"TAG-01\", \"typeEvent\": \"ENTROU\"}"));
            verifyNoInteractions(animalService);
            verifyNoInteractions(identifyPendencyRepository);
        }

        @Test
        @DisplayName("Corral without farm or farm without user is rejected gracefully")
        void corralWithoutFarmOrUser_RejectedGracefully() {
            Corral orphanCorral = Corral.builder().id(999L).macAddress("240AC4000999").farm(null).build();
            when(corralRepository.findByMacAddress("240AC4000999")).thenReturn(Optional.of(orphanCorral));

            assertDoesNotThrow(() -> commandRfidLeitura.tratar("240AC4000999", "{\"tagUid\": \"TAG-01\", \"typeEvent\": \"ENTROU\"}"));
            verifyNoInteractions(animalService);
        }

        @Test
        @DisplayName("Empty, blank, null, or invalid MAC and payload rejected without silent crash")
        void invalidInputs_RejectedGracefully() {
            // Null & blank MAC
            assertDoesNotThrow(() -> commandRfidLeitura.tratar(null, "{\"tagUid\": \"TAG-01\", \"typeEvent\": \"ENTROU\"}"));
            assertDoesNotThrow(() -> commandRfidLeitura.tratar("   ", "{\"tagUid\": \"TAG-01\", \"typeEvent\": \"ENTROU\"}"));
            assertDoesNotThrow(() -> commandRfidLeitura.tratar("---:::---", "{\"tagUid\": \"TAG-01\", \"typeEvent\": \"ENTROU\"}"));

            // Null & blank payload
            assertDoesNotThrow(() -> commandRfidLeitura.tratar("240AC4000100", null));
            assertDoesNotThrow(() -> commandRfidLeitura.tratar("240AC4000100", "   "));

            // Malformed JSON
            assertDoesNotThrow(() -> commandRfidLeitura.tratar("240AC4000100", "{ broken json"));

            // Non-object JSON
            assertDoesNotThrow(() -> commandRfidLeitura.tratar("240AC4000100", "[\"item1\", \"item2\"]"));
            assertDoesNotThrow(() -> commandRfidLeitura.tratar("240AC4000100", "\"plain string\""));
            assertDoesNotThrow(() -> commandRfidLeitura.tratar("240AC4000100", "42"));

            // Missing required fields
            assertDoesNotThrow(() -> commandRfidLeitura.tratar("240AC4000100", "{\"typeEvent\": \"ENTROU\"}"));
            assertDoesNotThrow(() -> commandRfidLeitura.tratar("240AC4000100", "{\"tagUid\": \"TAG-01\"}"));
            assertDoesNotThrow(() -> commandRfidLeitura.tratar("240AC4000100", "{\"tagUid\": \"TAG-01\", \"typeEvent\": \"INVALID_ACTION\"}"));

            verifyNoInteractions(corralRepository);
            verifyNoInteractions(animalService);
        }
    }

    // =========================================================================
    // 3. ADVERSARIAL PROBE: Dual Routing for Listing Open Pendencies
    // =========================================================================
    @Nested
    @DisplayName("3. Probe Dual Routing for Listing Open Pendencies")
    class DualRoutingProbes {

        @Test
        @DisplayName("Direct route /api/v1/currais/{id}/pendencias returns 200 OK with pendencies list")
        void directRoute_Success_Returns200() throws Exception {
            IdentifyPendency p1 = IdentifyPendency.builder()
                    .id(101L).corral(corral1).tagUid("TAG-A").animalEventType(AnimalEventType.ENTROU)
                    .instant(LocalDateTime.now().minusMinutes(5)).resolved(false).build();

            when(corralRepository.findById(100L)).thenReturn(Optional.of(corral1));
            when(identifyPendencyRepository.findByCorralIdAndResolvedFalseOrderByInstantDesc(100L))
                    .thenReturn(List.of(p1));

            mockMvcOwner.perform(get("/api/v1/currais/100/pendencias"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.length()").value(1))
                    .andExpect(jsonPath("$[0].id").value(101L))
                    .andExpect(jsonPath("$[0].tagUid").value("TAG-A"))
                    .andExpect(jsonPath("$[0].typeEvent").value("ENTROU"))
                    .andExpect(jsonPath("$[0].resolved").value(false));
        }

        @Test
        @DisplayName("Nested route /api/v1/farms/{farmId}/currais/{id}/pendencias returns 200 OK when farmId matches")
        void nestedRoute_MatchingFarm_Returns200() throws Exception {
            IdentifyPendency p1 = IdentifyPendency.builder()
                    .id(102L).corral(corral1).tagUid("TAG-B").animalEventType(AnimalEventType.SAIU)
                    .instant(LocalDateTime.now().minusMinutes(3)).resolved(false).build();

            when(corralRepository.findById(100L)).thenReturn(Optional.of(corral1));
            when(identifyPendencyRepository.findByCorralIdAndResolvedFalseOrderByInstantDesc(100L))
                    .thenReturn(List.of(p1));

            mockMvcOwner.perform(get("/api/v1/farms/10/currais/100/pendencias"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.length()").value(1))
                    .andExpect(jsonPath("$[0].id").value(102L))
                    .andExpect(jsonPath("$[0].tagUid").value("TAG-B"))
                    .andExpect(jsonPath("$[0].typeEvent").value("SAIU"));
        }

        @Test
        @DisplayName("Nested route /api/v1/farms/{farmId}/currais/{id}/pendencias returns 404 when farmId does NOT match corral's farm")
        void nestedRoute_MismatchedFarm_Returns404NotFound() throws Exception {
            when(corralRepository.findById(100L)).thenReturn(Optional.of(corral1)); // corral1 belongs to Farm 10

            mockMvcOwner.perform(get("/api/v1/farms/999/currais/100/pendencias"))
                    .andExpect(status().isNotFound())
                    .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                    .andExpect(jsonPath("$.status").value(404))
                    .andExpect(jsonPath("$.title").value("Recurso Não Encontrado"))
                    .andExpect(jsonPath("$.detail", containsString("Curral não pertence à fazenda informada")));

            verify(identifyPendencyRepository, never()).findByCorralIdAndResolvedFalseOrderByInstantDesc(anyLong());
        }

        @Test
        @DisplayName("Direct route returns 403 Forbidden when user is not the owner of the corral")
        void directRoute_UnauthorizedUser_Returns403Forbidden() throws Exception {
            // corral2 belongs to userB (id=2L), caller is owner (id=1L)
            when(corralRepository.findById(200L)).thenReturn(Optional.of(corral2));

            mockMvcOwner.perform(get("/api/v1/currais/200/pendencias"))
                    .andExpect(status().isForbidden())
                    .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                    .andExpect(jsonPath("$.status").value(403))
                    .andExpect(jsonPath("$.title").value("Acesso Negado"))
                    .andExpect(jsonPath("$.detail", containsString("permissão")));

            verify(identifyPendencyRepository, never()).findByCorralIdAndResolvedFalseOrderByInstantDesc(anyLong());
        }

        @Test
        @DisplayName("Nested route returns 403 Forbidden when user is not the owner of the corral")
        void nestedRoute_UnauthorizedUser_Returns403Forbidden() throws Exception {
            when(corralRepository.findById(200L)).thenReturn(Optional.of(corral2));

            mockMvcOwner.perform(get("/api/v1/farms/20/currais/200/pendencias"))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.status").value(403))
                    .andExpect(jsonPath("$.title").value("Acesso Negado"));

            verify(identifyPendencyRepository, never()).findByCorralIdAndResolvedFalseOrderByInstantDesc(anyLong());
        }

        @Test
        @DisplayName("Both direct and nested routes return identical DTO results for the same resource")
        void dualRouting_EquivalenceVerified() throws Exception {
            IdentifyPendency p1 = IdentifyPendency.builder()
                    .id(201L).corral(corral1).tagUid("TAG-EQ").animalEventType(AnimalEventType.ENTROU)
                    .instant(LocalDateTime.now()).resolved(false).build();

            when(corralRepository.findById(100L)).thenReturn(Optional.of(corral1));
            when(identifyPendencyRepository.findByCorralIdAndResolvedFalseOrderByInstantDesc(100L))
                    .thenReturn(List.of(p1));

            // Direct route call
            mockMvcOwner.perform(get("/api/v1/currais/100/pendencias"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$[0].tagUid").value("TAG-EQ"));

            // Nested route call
            mockMvcOwner.perform(get("/api/v1/farms/10/currais/100/pendencias"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$[0].tagUid").value("TAG-EQ"));
        }
    }

    // =========================================================================
    // 4. ADVERSARIAL PROBE: Open Pendency Counts Reflected Accurately in Metrics
    // =========================================================================
    @Nested
    @DisplayName("4. Probe Open Pendency Counts Reflected Accurately in Metrics")
    class MetricsOpenPendencyProbes {

        @Test
        @DisplayName("CorralService.getCorralMetrics queries identifyPendencyRepository and accurately sets pendenciasAbertas")
        void corralMetrics_ReflectsOpenPendenciesAccurately() {
            when(corralRepository.findById(100L)).thenReturn(Optional.of(corral1));
            when(identifyPendencyRepository.countByCorralIdAndResolvedFalse(100L)).thenReturn(7L);

            CorralMetricsResponseDTO metrics = corralService.getCorralMetrics(100L, 1L);

            assertNotNull(metrics);
            assertEquals(100L, metrics.corralId());
            assertEquals("Curral Principal 100", metrics.corralName());
            assertEquals(7L, metrics.pendenciasAbertas(), "O contador de pendências abertas deve refletir o valor 7");

            verify(identifyPendencyRepository).countByCorralIdAndResolvedFalse(100L);
        }

        @Test
        @DisplayName("GET /api/v1/currais/{id}/metricas returns pendenciasAbertas accurately in HTTP response")
        void getMetrics_DirectRoute_ReturnsAccurateCount() throws Exception {
            when(corralRepository.findById(100L)).thenReturn(Optional.of(corral1));
            when(identifyPendencyRepository.countByCorralIdAndResolvedFalse(100L)).thenReturn(4L);

            mockMvcCorralOwner.perform(get("/api/v1/currais/100/metricas"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.corralId").value(100L))
                    .andExpect(jsonPath("$.pendenciasAbertas").value(4));
        }

        @Test
        @DisplayName("GET /api/v1/farms/{farmId}/currais/{id}/metricas returns pendenciasAbertas in nested route")
        void getMetrics_NestedRoute_ReturnsAccurateCount() throws Exception {
            when(corralRepository.findById(100L)).thenReturn(Optional.of(corral1));
            when(identifyPendencyRepository.countByCorralIdAndResolvedFalse(100L)).thenReturn(12L);

            mockMvcCorralOwner.perform(get("/api/v1/farms/10/currais/100/metricas"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.corralId").value(100L))
                    .andExpect(jsonPath("$.pendenciasAbertas").value(12));
        }

        @Test
        @DisplayName("Zero open pendencies returns pendenciasAbertas = 0")
        void getMetrics_ZeroOpenPendencies_ReturnsZero() throws Exception {
            when(corralRepository.findById(100L)).thenReturn(Optional.of(corral1));
            when(identifyPendencyRepository.countByCorralIdAndResolvedFalse(100L)).thenReturn(0L);

            mockMvcCorralOwner.perform(get("/api/v1/currais/100/metricas"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.pendenciasAbertas").value(0));
        }

        @Test
        @DisplayName("Cross-corral isolation: pendencies on Corral A do not increment Corral B's metrics count")
        void getMetrics_IsolationBetweenCorrals() {
            Corral corralA = corral1; // ID 100L
            Corral corralB = TestFixtures.createCorral(101L, farm1, "240AC4000101");

            when(corralRepository.findById(100L)).thenReturn(Optional.of(corralA));
            when(corralRepository.findById(101L)).thenReturn(Optional.of(corralB));

            when(identifyPendencyRepository.countByCorralIdAndResolvedFalse(100L)).thenReturn(5L);
            when(identifyPendencyRepository.countByCorralIdAndResolvedFalse(101L)).thenReturn(0L);

            CorralMetricsResponseDTO metricsA = corralService.getCorralMetrics(100L, 1L);
            CorralMetricsResponseDTO metricsB = corralService.getCorralMetrics(101L, 1L);

            assertEquals(5L, metricsA.pendenciasAbertas());
            assertEquals(0L, metricsB.pendenciasAbertas());
        }
    }
}
