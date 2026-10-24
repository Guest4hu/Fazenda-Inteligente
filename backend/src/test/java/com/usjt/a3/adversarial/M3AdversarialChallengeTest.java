package com.usjt.a3.adversarial;

import com.usjt.a3.config.security.UserPrincipal;
import com.usjt.a3.controller.PendencyController;
import com.usjt.a3.mapper.IdentifyPendencyMapper;
import com.usjt.a3.model.entity.Animal;
import com.usjt.a3.model.entity.AnimalEvent;
import com.usjt.a3.model.entity.Corral;
import com.usjt.a3.model.entity.Farm;
import com.usjt.a3.model.entity.IdentifyPendency;
import com.usjt.a3.model.entity.User;
import com.usjt.a3.model.enums.AnimalEventType;
import com.usjt.a3.model.enums.EventOrigin;
import com.usjt.a3.repository.AnimalEventRepository;
import com.usjt.a3.repository.AnimalRepository;
import com.usjt.a3.repository.CorralRepository;
import com.usjt.a3.repository.IdentifyPendencyRepository;
import com.usjt.a3.service.IdentifyPendencyService;
import com.usjt.a3.test.MockMvcTestHelper;
import com.usjt.a3.test.TestFixtures;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("Empirical Challenge Suite - Milestone M3 Pendency Resolution (R3)")
public class M3AdversarialChallengeTest {

    @Mock
    private IdentifyPendencyRepository identifyPendencyRepository;

    @Mock
    private CorralRepository corralRepository;

    @Mock
    private AnimalRepository animalRepository;

    @Mock
    private AnimalEventRepository animalEventRepository;

    @Spy
    private IdentifyPendencyMapper identifyPendencyMapper = new IdentifyPendencyMapper();

    @InjectMocks
    private IdentifyPendencyService identifyPendencyService;

    private User userA;
    private User userB;
    private Farm farmA;
    private Farm farmB;
    private Corral corralFarmA;
    private Corral corralFarmB;
    private Animal animalFarmA;
    private Animal animalFarmB;
    private IdentifyPendency pendencyFarmA;
    private IdentifyPendency pendencyFarmB;

    private MockMvc mockMvcUserA;

    @BeforeEach
    void setUp() {
        userA = TestFixtures.createUser(1L);
        userB = TestFixtures.createUser(2L);

        farmA = TestFixtures.createFarm(10L, userA);
        farmB = TestFixtures.createFarm(20L, userB);

        corralFarmA = TestFixtures.createCorral(100L, farmA, "240AC4000100");
        corralFarmB = TestFixtures.createCorral(200L, farmB, "240AC4000200");

        animalFarmA = TestFixtures.createAnimal(500L, farmA, "TAG-FARMA-01");
        animalFarmB = TestFixtures.createAnimal(600L, farmB, "TAG-FARMB-01");

        pendencyFarmA = IdentifyPendency.builder()
                .id(1000L)
                .corral(corralFarmA)
                .tagUid("E2801160")
                .animalEventType(AnimalEventType.ENTROU)
                .instant(LocalDateTime.now().minusMinutes(15))
                .resolved(false)
                .build();

        pendencyFarmB = IdentifyPendency.builder()
                .id(2000L)
                .corral(corralFarmB)
                .tagUid("A1B2C3D4")
                .animalEventType(AnimalEventType.SAIU)
                .instant(LocalDateTime.now().minusMinutes(10))
                .resolved(false)
                .build();

        PendencyController pendencyController = new PendencyController(identifyPendencyService);
        UserPrincipal principalUserA = TestFixtures.createPrincipal(1L);
        mockMvcUserA = MockMvcTestHelper.buildMockMvc(pendencyController, principalUserA);
    }

    // =========================================================================
    // 1. ADVERSARIAL PROBE: Resolving an Already-Resolved Pendency -> 409 Conflict
    // =========================================================================
    @Nested
    @DisplayName("1. Probe Already-Resolved Pendency (409 Conflict)")
    class AlreadyResolvedPendencyProbes {

        @Test
        @DisplayName("POST /api/v1/pendencias/{id}/resolver returns 409 Conflict when pendency is already resolved")
        void resolve_Post_AlreadyResolved_Returns409Conflict() throws Exception {
            pendencyFarmA.setResolved(true);
            pendencyFarmA.setAnimal(animalFarmA);
            pendencyFarmA.setResolvedAt(LocalDateTime.now().minusHours(1));

            when(identifyPendencyRepository.findById(1000L)).thenReturn(Optional.of(pendencyFarmA));

            mockMvcUserA.perform(post("/api/v1/pendencias/1000/resolver")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {
                                        "animalId": 500
                                    }
                                    """))
                    .andExpect(status().isConflict())
                    .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                    .andExpect(jsonPath("$.status").value(409))
                    .andExpect(jsonPath("$.title").value("Conflito de Regra de Negócio"))
                    .andExpect(jsonPath("$.detail", containsString("já foi resolvida")));

            verify(animalRepository, never()).findById(anyLong());
            verify(animalRepository, never()).save(any());
            verify(animalEventRepository, never()).save(any());
        }

        @Test
        @DisplayName("PUT /api/v1/pendencias/{id}/resolver alias returns 409 Conflict when pendency is already resolved")
        void resolve_Put_AlreadyResolved_Returns409Conflict() throws Exception {
            pendencyFarmA.setResolved(true);
            pendencyFarmA.setAnimal(animalFarmA);
            pendencyFarmA.setResolvedAt(LocalDateTime.now().minusHours(2));

            when(identifyPendencyRepository.findById(1000L)).thenReturn(Optional.of(pendencyFarmA));

            mockMvcUserA.perform(put("/api/v1/pendencias/1000/resolver")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {
                                        "animalId": 500
                                    }
                                    """))
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.status").value(409))
                    .andExpect(jsonPath("$.title").value("Conflito de Regra de Negócio"))
                    .andExpect(jsonPath("$.detail", containsString("já foi resolvida")));

            verify(animalRepository, never()).findById(anyLong());
            verify(animalRepository, never()).save(any());
        }

        @Test
        @DisplayName("Direct service call throws IllegalStateException for already resolved pendency")
        void directServiceCall_AlreadyResolved_ThrowsIllegalStateException() {
            pendencyFarmA.setResolved(true);
            when(identifyPendencyRepository.findById(1000L)).thenReturn(Optional.of(pendencyFarmA));

            IllegalStateException ex = assertThrows(IllegalStateException.class, () ->
                    identifyPendencyService.resolvePendency(1000L, 500L, 1L)
            );
            assertTrue(ex.getMessage().contains("já foi resolvida"));
        }
    }

    // =========================================================================
    // 2. ADVERSARIAL PROBE: Cross-Farm Resolution (Animal from Farm B on Farm A) -> 409 Conflict
    // =========================================================================
    @Nested
    @DisplayName("2. Probe Cross-Farm Resolution (409 Conflict)")
    class CrossFarmResolutionProbes {

        @Test
        @DisplayName("POST /api/v1/pendencias/{id}/resolver returns 409 Conflict when animal belongs to Farm B while corral is on Farm A")
        void resolve_Post_CrossFarmAnimal_Returns409Conflict() throws Exception {
            when(identifyPendencyRepository.findById(1000L)).thenReturn(Optional.of(pendencyFarmA));
            when(animalRepository.findById(600L)).thenReturn(Optional.of(animalFarmB));

            mockMvcUserA.perform(post("/api/v1/pendencias/1000/resolver")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {
                                        "animalId": 600
                                    }
                                    """))
                    .andExpect(status().isConflict())
                    .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                    .andExpect(jsonPath("$.status").value(409))
                    .andExpect(jsonPath("$.title").value("Conflito de Regra de Negócio"))
                    .andExpect(jsonPath("$.detail", containsString("fazenda diferente")));

            // Ensure state was NOT modified
            assertFalse(pendencyFarmA.getResolved());
            assertNull(pendencyFarmA.getAnimal());
            verify(animalRepository, never()).save(any());
            verify(animalEventRepository, never()).save(any());
        }

        @Test
        @DisplayName("PUT /api/v1/pendencias/{id}/resolver returns 409 Conflict for animal from different farm")
        void resolve_Put_CrossFarmAnimal_Returns409Conflict() throws Exception {
            when(identifyPendencyRepository.findById(1000L)).thenReturn(Optional.of(pendencyFarmA));
            when(animalRepository.findById(600L)).thenReturn(Optional.of(animalFarmB));

            mockMvcUserA.perform(put("/api/v1/pendencias/1000/resolver")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {
                                        "animalId": 600
                                    }
                                    """))
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.title").value("Conflito de Regra de Negócio"))
                    .andExpect(jsonPath("$.detail", containsString("fazenda diferente")));

            verify(animalRepository, never()).save(any());
        }

        @Test
        @DisplayName("Cross-farm conflict triggers even if both farms belong to the same user")
        void resolve_CrossFarmSameUser_Returns409Conflict() throws Exception {
            // Farm C also owned by userA (ID 1L)
            Farm farmC = TestFixtures.createFarm(30L, userA);
            Animal animalFarmC = TestFixtures.createAnimal(700L, farmC, "TAG-FARMC-01");

            when(identifyPendencyRepository.findById(1000L)).thenReturn(Optional.of(pendencyFarmA));
            when(animalRepository.findById(700L)).thenReturn(Optional.of(animalFarmC));

            mockMvcUserA.perform(post("/api/v1/pendencias/1000/resolver")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {
                                        "animalId": 700
                                    }
                                    """))
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.status").value(409))
                    .andExpect(jsonPath("$.detail", containsString("fazenda diferente")));

            verify(animalRepository, never()).save(any());
        }
    }

    // =========================================================================
    // 3. ADVERSARIAL PROBE: Non-Existent Resources -> 404 Not Found
    // =========================================================================
    @Nested
    @DisplayName("3. Probe Non-Existent Resources (404 Not Found)")
    class NonExistentResourceProbes {

        @Test
        @DisplayName("POST /api/v1/pendencias/999999/resolver with non-existent pendency returns 404")
        void resolve_NonExistentPendency_Returns404NotFound() throws Exception {
            when(identifyPendencyRepository.findById(999999L)).thenReturn(Optional.empty());

            mockMvcUserA.perform(post("/api/v1/pendencias/999999/resolver")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {
                                        "animalId": 500
                                    }
                                    """))
                    .andExpect(status().isNotFound())
                    .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                    .andExpect(jsonPath("$.status").value(404))
                    .andExpect(jsonPath("$.title").value("Recurso Não Encontrado"))
                    .andExpect(jsonPath("$.detail", containsString("Pendência de identificação não encontrada")));

            verify(animalRepository, never()).findById(anyLong());
        }

        @Test
        @DisplayName("POST /api/v1/pendencias/{id}/resolver with non-existent animal returns 404")
        void resolve_NonExistentAnimal_Returns404NotFound() throws Exception {
            when(identifyPendencyRepository.findById(1000L)).thenReturn(Optional.of(pendencyFarmA));
            when(animalRepository.findById(999999L)).thenReturn(Optional.empty());

            mockMvcUserA.perform(post("/api/v1/pendencias/1000/resolver")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {
                                        "animalId": 999999
                                    }
                                    """))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.status").value(404))
                    .andExpect(jsonPath("$.title").value("Recurso Não Encontrado"))
                    .andExpect(jsonPath("$.detail", containsString("Animal não encontrado")));

            verify(animalRepository, never()).save(any());
        }

        @Test
        @DisplayName("GET /api/v1/currais/999999/pendencias with non-existent corral returns 404")
        void list_NonExistentCorral_Returns404NotFound() throws Exception {
            when(corralRepository.findById(999999L)).thenReturn(Optional.empty());

            mockMvcUserA.perform(get("/api/v1/currais/999999/pendencias"))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.status").value(404))
                    .andExpect(jsonPath("$.title").value("Recurso Não Encontrado"))
                    .andExpect(jsonPath("$.detail", containsString("Curral não encontrado")));

            verify(identifyPendencyRepository, never()).findByCorralIdAndResolvedFalseOrderByInstantDesc(anyLong());
        }

        @Test
        @DisplayName("GET /api/v1/farms/99/currais/100/pendencias with farmId mismatch returns 404")
        void list_NestedRouteFarmMismatch_Returns404NotFound() throws Exception {
            when(corralRepository.findById(100L)).thenReturn(Optional.of(corralFarmA));

            mockMvcUserA.perform(get("/api/v1/farms/99/currais/100/pendencias"))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.status").value(404))
                    .andExpect(jsonPath("$.title").value("Recurso Não Encontrado"))
                    .andExpect(jsonPath("$.detail", containsString("não pertence à fazenda")));

            verify(identifyPendencyRepository, never()).findByCorralIdAndResolvedFalseOrderByInstantDesc(anyLong());
        }
    }

    // =========================================================================
    // 4. ADVERSARIAL PROBE: Unauthorized User Attempting Resolution or Listing -> 403 Forbidden
    // =========================================================================
    @Nested
    @DisplayName("4. Probe Multi-Tenant Ownership & Unauthorized Access (403 Forbidden)")
    class UnauthorizedAccessProbes {

        @Test
        @DisplayName("POST /api/v1/pendencias/{id}/resolver on User B's corral returns 403 Forbidden")
        void resolve_Post_UserCannotResolveOtherUsersPendency_Returns403() throws Exception {
            // pendencyFarmB is on corralFarmB (User B, id=2L), caller is userA (id=1L)
            when(identifyPendencyRepository.findById(2000L)).thenReturn(Optional.of(pendencyFarmB));

            mockMvcUserA.perform(post("/api/v1/pendencias/2000/resolver")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {
                                        "animalId": 500
                                    }
                                    """))
                    .andExpect(status().isForbidden())
                    .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                    .andExpect(jsonPath("$.status").value(403))
                    .andExpect(jsonPath("$.title").value("Acesso Negado"))
                    .andExpect(jsonPath("$.detail", containsString("permissão")));

            verify(animalRepository, never()).findById(anyLong());
            verify(animalRepository, never()).save(any());
        }

        @Test
        @DisplayName("PUT /api/v1/pendencias/{id}/resolver alias on User B's corral returns 403 Forbidden")
        void resolve_Put_UserCannotResolveOtherUsersPendency_Returns403() throws Exception {
            when(identifyPendencyRepository.findById(2000L)).thenReturn(Optional.of(pendencyFarmB));

            mockMvcUserA.perform(put("/api/v1/pendencias/2000/resolver")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {
                                        "animalId": 500
                                    }
                                    """))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.status").value(403))
                    .andExpect(jsonPath("$.title").value("Acesso Negado"));

            verify(animalRepository, never()).save(any());
        }

        @Test
        @DisplayName("GET /api/v1/currais/200/pendencias returns 403 Forbidden when corral belongs to another user")
        void list_UserCannotListOtherUsersCorral_Returns403() throws Exception {
            when(corralRepository.findById(200L)).thenReturn(Optional.of(corralFarmB));

            mockMvcUserA.perform(get("/api/v1/currais/200/pendencias"))
                    .andExpect(status().isForbidden())
                    .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                    .andExpect(jsonPath("$.status").value(403))
                    .andExpect(jsonPath("$.title").value("Acesso Negado"))
                    .andExpect(jsonPath("$.detail", containsString("permissão")));

            verify(identifyPendencyRepository, never()).findByCorralIdAndResolvedFalseOrderByInstantDesc(anyLong());
        }

        @Test
        @DisplayName("GET /api/v1/farms/20/currais/200/pendencias nested route returns 403 Forbidden for another user")
        void list_NestedRoute_OtherUser_Returns403() throws Exception {
            when(corralRepository.findById(200L)).thenReturn(Optional.of(corralFarmB));

            mockMvcUserA.perform(get("/api/v1/farms/20/currais/200/pendencias"))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.status").value(403))
                    .andExpect(jsonPath("$.title").value("Acesso Negado"));

            verify(identifyPendencyRepository, never()).findByCorralIdAndResolvedFalseOrderByInstantDesc(anyLong());
        }
    }

    // =========================================================================
    // 5. ADVERSARIAL PROBE: Validation Errors (empty/null animalId) -> 400 Bad Request
    // =========================================================================
    @Nested
    @DisplayName("5. Probe Validation Errors in ResolvePendencyRequestDTO (400 Bad Request)")
    class ValidationErrorsProbes {

        @Test
        @DisplayName("POST /api/v1/pendencias/{id}/resolver with empty JSON body returns 400 with invalidParams")
        void resolve_EmptyJson_Returns400WithInvalidParams() throws Exception {
            mockMvcUserA.perform(post("/api/v1/pendencias/1000/resolver")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{}"))
                    .andExpect(status().isBadRequest())
                    .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                    .andExpect(jsonPath("$.status").value(400))
                    .andExpect(jsonPath("$.title").value("Erro de Validação"))
                    .andExpect(jsonPath("$.invalidParams.animalId").value("O ID do animal é obrigatório"));

            verifyNoInteractions(identifyPendencyRepository);
        }

        @Test
        @DisplayName("POST /api/v1/pendencias/{id}/resolver with explicit null animalId returns 400 with invalidParams")
        void resolve_ExplicitNullAnimalId_Returns400WithInvalidParams() throws Exception {
            mockMvcUserA.perform(post("/api/v1/pendencias/1000/resolver")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {
                                        "animalId": null
                                    }
                                    """))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.status").value(400))
                    .andExpect(jsonPath("$.title").value("Erro de Validação"))
                    .andExpect(jsonPath("$.invalidParams.animalId").value("O ID do animal é obrigatório"));

            verifyNoInteractions(identifyPendencyRepository);
        }

        @Test
        @DisplayName("PUT /api/v1/pendencias/{id}/resolver alias with null animalId returns 400 with invalidParams")
        void resolve_Put_NullAnimalId_Returns400() throws Exception {
            mockMvcUserA.perform(put("/api/v1/pendencias/1000/resolver")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {
                                        "animalId": null
                                    }
                                    """))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.title").value("Erro de Validação"))
                    .andExpect(jsonPath("$.invalidParams.animalId").exists());

            verifyNoInteractions(identifyPendencyRepository);
        }

        @Test
        @DisplayName("POST /api/v1/pendencias/{id}/resolver with malformed string instead of Long returns 400")
        void resolve_MalformedJsonField_Returns400() throws Exception {
            mockMvcUserA.perform(post("/api/v1/pendencias/1000/resolver")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {
                                        "animalId": "abc"
                                    }
                                    """))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.status").value(400))
                    .andExpect(jsonPath("$.title").value("Corpo da Requisição Inválido"));

            verifyNoInteractions(identifyPendencyRepository);
        }
    }

    // =========================================================================
    // 6. ADVERSARIAL PROBE: Successful Resolution State Machine Transitions
    // =========================================================================
    @Nested
    @DisplayName("6. Probe Successful Resolution State Machine Transitions (200 OK)")
    class SuccessfulResolutionStateTransitionsProbes {

        @Test
        @DisplayName("Resolving ENTROU pendency updates animal.currentCorral, creates MANUAL AnimalEvent and marks resolved")
        void resolve_Success_Entrou_StateTransitionsVerified() throws Exception {
            when(identifyPendencyRepository.findById(1000L)).thenReturn(Optional.of(pendencyFarmA));
            when(animalRepository.findById(500L)).thenReturn(Optional.of(animalFarmA));
            when(identifyPendencyRepository.save(any(IdentifyPendency.class))).thenAnswer(i -> i.getArgument(0));

            mockMvcUserA.perform(post("/api/v1/pendencias/1000/resolver")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {
                                        "animalId": 500
                                    }
                                    """))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.id").value(1000L))
                    .andExpect(jsonPath("$.resolved").value(true))
                    .andExpect(jsonPath("$.animalIdResolved").value(500L))
                    .andExpect(jsonPath("$.animalNameResolved").value(animalFarmA.getName()))
                    .andExpect(jsonPath("$.resolvedAt").exists());

            // Check physical lock state
            assertEquals(corralFarmA, animalFarmA.getCurrentCorral());
            verify(animalRepository).save(animalFarmA);

            // Check audit log
            ArgumentCaptor<AnimalEvent> eventCaptor = ArgumentCaptor.forClass(AnimalEvent.class);
            verify(animalEventRepository).save(eventCaptor.capture());
            AnimalEvent savedEvent = eventCaptor.getValue();
            assertEquals(corralFarmA, savedEvent.getCorral());
            assertEquals(animalFarmA, savedEvent.getAnimal());
            assertEquals(AnimalEventType.ENTROU, savedEvent.getTypeEvent());
            assertEquals(EventOrigin.MANUAL, savedEvent.getEventOrigin());
        }

        @Test
        @DisplayName("Resolving SAIU pendency clears animal.currentCorral and creates MANUAL AnimalEvent")
        void resolve_Success_Saiu_StateTransitionsVerified() throws Exception {
            IdentifyPendency pendencySaiu = IdentifyPendency.builder()
                    .id(1001L)
                    .corral(corralFarmA)
                    .tagUid("E2801160")
                    .animalEventType(AnimalEventType.SAIU)
                    .instant(LocalDateTime.now().minusMinutes(5))
                    .resolved(false)
                    .build();

            animalFarmA.setCurrentCorral(corralFarmA); // Animal currently in corral

            when(identifyPendencyRepository.findById(1001L)).thenReturn(Optional.of(pendencySaiu));
            when(animalRepository.findById(500L)).thenReturn(Optional.of(animalFarmA));
            when(identifyPendencyRepository.save(any(IdentifyPendency.class))).thenAnswer(i -> i.getArgument(0));

            mockMvcUserA.perform(put("/api/v1/pendencias/1001/resolver")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {
                                        "animalId": 500
                                    }
                                    """))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.id").value(1001L))
                    .andExpect(jsonPath("$.resolved").value(true));

            // Check physical state cleared
            assertNull(animalFarmA.getCurrentCorral());
            verify(animalRepository).save(animalFarmA);

            // Check audit log
            ArgumentCaptor<AnimalEvent> eventCaptor = ArgumentCaptor.forClass(AnimalEvent.class);
            verify(animalEventRepository).save(eventCaptor.capture());
            AnimalEvent savedEvent = eventCaptor.getValue();
            assertEquals(AnimalEventType.SAIU, savedEvent.getTypeEvent());
            assertEquals(EventOrigin.MANUAL, savedEvent.getEventOrigin());
        }
    }
}
