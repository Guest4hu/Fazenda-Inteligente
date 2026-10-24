package com.usjt.a3.adversarial;

import com.usjt.a3.config.security.UserPrincipal;
import com.usjt.a3.controller.AnimalController;
import com.usjt.a3.controller.CorralController;
import com.usjt.a3.controller.FarmController;
import com.usjt.a3.dto.request.AnimalRequestDTO;
import com.usjt.a3.dto.request.CorralRequestDTO;
import com.usjt.a3.dto.request.FarmRequestDTO;
import com.usjt.a3.dto.response.AnimalResponseDTO;
import com.usjt.a3.dto.response.CorralResponseDTO;
import com.usjt.a3.dto.response.FarmResponseDTO;
import com.usjt.a3.mapper.AnimalMapper;
import com.usjt.a3.mapper.CorralMapper;
import com.usjt.a3.mapper.FarmMapper;
import com.usjt.a3.model.entity.Animal;
import com.usjt.a3.model.entity.Corral;
import com.usjt.a3.model.entity.Farm;
import com.usjt.a3.model.entity.User;
import com.usjt.a3.model.enums.CleanState;
import com.usjt.a3.model.enums.DeviceStatus;
import com.usjt.a3.repository.CleanCmdRepository;
import com.usjt.a3.repository.CorralRepository;
import com.usjt.a3.repository.FarmRepository;
import com.usjt.a3.repository.AnimalRepository;
import com.usjt.a3.service.AnimalService;
import com.usjt.a3.service.CorralService;
import com.usjt.a3.service.FarmService;
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
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("Empirical Challenge Suite - Milestone M1 Lifecycle PUT & DELETE")
class M1AdversarialChallengeTest {

    // Service Mocks
    @Mock private FarmRepository farmRepository;
    @Mock private CorralRepository corralRepository;
    @Mock private AnimalRepository animalRepository;
    @Mock private CleanCmdRepository cleanCmdRepository;
    @Mock private FarmMapper farmMapper;
    @Mock private CorralMapper corralMapper;
    @Mock private AnimalMapper animalMapper;

    @InjectMocks private FarmService farmService;
    @InjectMocks private CorralService corralService;
    @InjectMocks private AnimalService animalService;

    // Test Users and Entities
    private User userA;
    private User userB;
    private Farm farmUserA;
    private Farm farmUserB;
    private Corral corralUserA;
    private Corral corralUserB;
    private Animal animalUserA;
    private Animal animalUserB;

    @BeforeEach
    void setUp() {
        userA = TestFixtures.createUser(1L);
        userB = TestFixtures.createUser(2L);

        farmUserA = TestFixtures.createFarm(10L, userA);
        farmUserB = TestFixtures.createFarm(20L, userB);

        corralUserA = TestFixtures.createCorral(100L, farmUserA, "240AC4000100");
        corralUserB = TestFixtures.createCorral(200L, farmUserB, "240AC4000200");

        animalUserA = TestFixtures.createAnimal(1000L, farmUserA, "E2801111");
        animalUserB = TestFixtures.createAnimal(2000L, farmUserB, "E2802222");
    }

    // =========================================================================
    // 1. ADVERSARIAL PROBE: Multi-tenant boundary
    // =========================================================================
    @Nested
    @DisplayName("1. Multi-Tenant Isolation Probes")
    class MultiTenantBoundaryProbes {

        @Test
        @DisplayName("User A cannot edit User B's Farm (throws SecurityException)")
        void userA_cannot_edit_userB_farm() {
            when(farmRepository.findById(20L)).thenReturn(Optional.of(farmUserB));

            FarmRequestDTO request = new FarmRequestDTO("Tentativa Hack Nome");
            SecurityException ex = assertThrows(SecurityException.class,
                    () -> farmService.updateFarm(20L, request, userA.getId()));

            assertTrue(ex.getMessage().contains("permissão para editar"));
            verify(farmRepository, never()).save(any());
        }

        @Test
        @DisplayName("User A cannot delete User B's Farm (throws SecurityException)")
        void userA_cannot_delete_userB_farm() {
            when(farmRepository.findById(20L)).thenReturn(Optional.of(farmUserB));

            SecurityException ex = assertThrows(SecurityException.class,
                    () -> farmService.deleteFarm(20L, userA.getId()));

            assertTrue(ex.getMessage().contains("permissão para excluir"));
            verify(farmRepository, never()).delete(any());
        }

        @Test
        @DisplayName("User A cannot edit User B's Corral via direct route")
        void userA_cannot_edit_userB_corral_direct() {
            when(corralRepository.findById(200L)).thenReturn(Optional.of(corralUserB));

            CorralRequestDTO request = new CorralRequestDTO("Curral Hack", "240AC4000200", null, 400, 30);
            SecurityException ex = assertThrows(SecurityException.class,
                    () -> corralService.updateCorral(200L, null, userA.getId(), request));

            assertTrue(ex.getMessage().contains("permissão para editar"));
            verify(corralRepository, never()).save(any());
        }

        @Test
        @DisplayName("User A cannot delete User B's Corral via direct route")
        void userA_cannot_delete_userB_corral_direct() {
            when(corralRepository.findById(200L)).thenReturn(Optional.of(corralUserB));

            SecurityException ex = assertThrows(SecurityException.class,
                    () -> corralService.deleteCorral(200L, null, userA.getId()));

            assertTrue(ex.getMessage().contains("permissão para excluir"));
            verify(corralRepository, never()).delete(any());
        }

        @Test
        @DisplayName("User A cannot edit User B's Animal via direct route")
        void userA_cannot_edit_userB_animal_direct() {
            when(animalRepository.findById(2000L)).thenReturn(Optional.of(animalUserB));

            AnimalRequestDTO request = new AnimalRequestDTO("Boi Hack", null, "E2802222");
            SecurityException ex = assertThrows(SecurityException.class,
                    () -> animalService.updateAnimal(2000L, null, userA.getId(), request));

            assertTrue(ex.getMessage().contains("permissão para editar"));
            verify(animalRepository, never()).save(any());
        }

        @Test
        @DisplayName("User A cannot delete User B's Animal via direct route")
        void userA_cannot_delete_userB_animal_direct() {
            when(animalRepository.findById(2000L)).thenReturn(Optional.of(animalUserB));

            SecurityException ex = assertThrows(SecurityException.class,
                    () -> animalService.deleteAnimal(2000L, null, userA.getId()));

            assertTrue(ex.getMessage().contains("permissão para excluir"));
            verify(animalRepository, never()).delete(any());
        }

        @Test
        @DisplayName("Cross-tenant injection: User A tries to target Corral A under User B's farmId in path (throws EntityNotFoundException)")
        void cross_tenant_corral_path_injection() {
            when(corralRepository.findById(100L)).thenReturn(Optional.of(corralUserA));

            CorralRequestDTO request = new CorralRequestDTO("Tentativa", "240AC4000100", null, 400, 30);
            EntityNotFoundException ex = assertThrows(EntityNotFoundException.class,
                    () -> corralService.updateCorral(100L, farmUserB.getId(), userA.getId(), request));

            assertEquals("Curral não pertence à fazenda informada", ex.getMessage());
        }

        @Test
        @DisplayName("Cross-tenant injection: User A tries to target Animal A under User B's farmId in path (throws EntityNotFoundException)")
        void cross_tenant_animal_path_injection() {
            when(animalRepository.findById(1000L)).thenReturn(Optional.of(animalUserA));

            AnimalRequestDTO request = new AnimalRequestDTO("Tentativa", null, "E2801111");
            EntityNotFoundException ex = assertThrows(EntityNotFoundException.class,
                    () -> animalService.updateAnimal(1000L, farmUserB.getId(), userA.getId(), request));

            assertTrue(ex.getMessage().contains("não pertence à fazenda ID"));
        }
    }

    // =========================================================================
    // 2. ADVERSARIAL PROBE: Non-existent resource (ID 999999) returns 404 ProblemDetail
    // =========================================================================
    @Nested
    @DisplayName("2. Non-existent Resource (ID 999999) RFC 7807 Probes")
    class NonExistentResourceProbes {

        private MockMvc mockMvcFarm;
        private MockMvc mockMvcCorral;
        private MockMvc mockMvcAnimal;

        @BeforeEach
        void setupMockMvc() {
            FarmController farmController = new FarmController(farmService);
            CorralController corralController = new CorralController(corralService);
            AnimalController animalController = new AnimalController(animalService);

            UserPrincipal principalA = TestFixtures.createPrincipal(1L);
            mockMvcFarm = MockMvcTestHelper.buildMockMvc(farmController, principalA);
            mockMvcCorral = MockMvcTestHelper.buildMockMvc(corralController, principalA);
            mockMvcAnimal = MockMvcTestHelper.buildMockMvc(animalController, principalA);
        }

        @Test
        @DisplayName("PUT /api/v1/farms/999999 returns 404 RFC 7807 ProblemDetail")
        void put_farm_999999_returns_404_problem_detail() throws Exception {
            when(farmRepository.findById(999999L)).thenReturn(Optional.empty());

            mockMvcFarm.perform(put("/api/v1/farms/999999")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"name\": \"Nome Valido\"}"))
                    .andExpect(status().isNotFound())
                    .andExpect(header().string("Content-Type", "application/problem+json"))
                    .andExpect(jsonPath("$.title").value("Recurso Não Encontrado"))
                    .andExpect(jsonPath("$.status").value(404))
                    .andExpect(jsonPath("$.detail").value("Fazenda não encontrada com ID: 999999"));
        }

        @Test
        @DisplayName("DELETE /api/v1/farms/999999 returns 404 RFC 7807 ProblemDetail")
        void delete_farm_999999_returns_404_problem_detail() throws Exception {
            when(farmRepository.findById(999999L)).thenReturn(Optional.empty());

            mockMvcFarm.perform(delete("/api/v1/farms/999999"))
                    .andExpect(status().isNotFound())
                    .andExpect(header().string("Content-Type", "application/problem+json"))
                    .andExpect(jsonPath("$.title").value("Recurso Não Encontrado"))
                    .andExpect(jsonPath("$.status").value(404));
        }

        @Test
        @DisplayName("PUT /api/v1/currais/999999 returns 404 RFC 7807 ProblemDetail")
        void put_corral_999999_returns_404_problem_detail() throws Exception {
            when(corralRepository.findById(999999L)).thenReturn(Optional.empty());

            mockMvcCorral.perform(put("/api/v1/currais/999999")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {
                                        "name": "Curral Valido",
                                        "macAddress": "240AC4000100"
                                    }
                                    """))
                    .andExpect(status().isNotFound())
                    .andExpect(header().string("Content-Type", "application/problem+json"))
                    .andExpect(jsonPath("$.title").value("Recurso Não Encontrado"))
                    .andExpect(jsonPath("$.status").value(404))
                    .andExpect(jsonPath("$.detail").value("Curral não encontrado com ID: 999999"));
        }

        @Test
        @DisplayName("DELETE /api/v1/currais/999999 returns 404 RFC 7807 ProblemDetail")
        void delete_corral_999999_returns_404_problem_detail() throws Exception {
            when(corralRepository.findById(999999L)).thenReturn(Optional.empty());

            mockMvcCorral.perform(delete("/api/v1/currais/999999"))
                    .andExpect(status().isNotFound())
                    .andExpect(header().string("Content-Type", "application/problem+json"))
                    .andExpect(jsonPath("$.title").value("Recurso Não Encontrado"))
                    .andExpect(jsonPath("$.status").value(404));
        }

        @Test
        @DisplayName("PUT /api/v1/animais/999999 returns 404 RFC 7807 ProblemDetail")
        void put_animal_999999_returns_404_problem_detail() throws Exception {
            when(animalRepository.findById(999999L)).thenReturn(Optional.empty());

            mockMvcAnimal.perform(put("/api/v1/animais/999999")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {
                                        "name": "Boi Valido",
                                        "tagUid": "E2801111"
                                    }
                                    """))
                    .andExpect(status().isNotFound())
                    .andExpect(header().string("Content-Type", "application/problem+json"))
                    .andExpect(jsonPath("$.title").value("Recurso Não Encontrado"))
                    .andExpect(jsonPath("$.status").value(404))
                    .andExpect(jsonPath("$.detail").value("Animal não encontrado com ID: 999999"));
        }

        @Test
        @DisplayName("DELETE /api/v1/animais/999999 returns 404 RFC 7807 ProblemDetail")
        void delete_animal_999999_returns_404_problem_detail() throws Exception {
            when(animalRepository.findById(999999L)).thenReturn(Optional.empty());

            mockMvcAnimal.perform(delete("/api/v1/animais/999999"))
                    .andExpect(status().isNotFound())
                    .andExpect(header().string("Content-Type", "application/problem+json"))
                    .andExpect(jsonPath("$.title").value("Recurso Não Encontrado"))
                    .andExpect(jsonPath("$.status").value(404));
        }
    }

    // =========================================================================
    // 3. ADVERSARIAL PROBE: Duplicate relative keys & idempotency
    // =========================================================================
    @Nested
    @DisplayName("3. Relative Key Uniqueness Probes")
    class RelativeKeyUniquenessProbes {

        @Test
        @DisplayName("Updating farm to collide with another farm of the SAME user throws IllegalStateException (409)")
        void farm_duplicate_name_same_user_conflict() {
            when(farmRepository.findById(10L)).thenReturn(Optional.of(farmUserA));
            when(farmRepository.existsByNameAndUserIdAndIdNot("Outra Fazenda User A", userA.getId(), 10L)).thenReturn(true);

            FarmRequestDTO request = new FarmRequestDTO("Outra Fazenda User A");
            IllegalStateException ex = assertThrows(IllegalStateException.class,
                    () -> farmService.updateFarm(10L, request, userA.getId()));

            assertTrue(ex.getMessage().contains("Você já possui uma fazenda cadastrada com este nome"));
            verify(farmRepository, never()).save(any());
        }

        @Test
        @DisplayName("Updating farm to collide with another farm of the same user with whitespace padding throws IllegalStateException")
        void farm_duplicate_name_with_whitespace_conflict() {
            when(farmRepository.findById(10L)).thenReturn(Optional.of(farmUserA));
            when(farmRepository.existsByNameAndUserIdAndIdNot("Fazenda Existente", userA.getId(), 10L)).thenReturn(true);

            FarmRequestDTO request = new FarmRequestDTO("   Fazenda Existente   ");
            IllegalStateException ex = assertThrows(IllegalStateException.class,
                    () -> farmService.updateFarm(10L, request, userA.getId()));

            assertTrue(ex.getMessage().contains("Você já possui uma fazenda cadastrada com este nome: Fazenda Existente"));
        }

        @Test
        @DisplayName("Updating farm keeping its CURRENT name succeeds without false conflict")
        void farm_same_name_update_succeeds() {
            when(farmRepository.findById(10L)).thenReturn(Optional.of(farmUserA));
            when(farmRepository.existsByNameAndUserIdAndIdNot(farmUserA.getName(), userA.getId(), 10L)).thenReturn(false);
            when(farmRepository.save(any(Farm.class))).thenReturn(farmUserA);
            when(farmMapper.toDTO(farmUserA)).thenReturn(new FarmResponseDTO(10L, farmUserA.getName(), LocalDateTime.now()));

            FarmRequestDTO request = new FarmRequestDTO(farmUserA.getName());
            FarmResponseDTO response = farmService.updateFarm(10L, request, userA.getId());

            assertNotNull(response);
            assertEquals(farmUserA.getName(), response.name());
            verify(farmRepository).save(farmUserA);
        }

        @Test
        @DisplayName("User A can update farm to have the same name as User B's farm (multi-tenant isolated naming)")
        void farm_same_name_different_users_allowed() {
            String sharedName = "Fazenda Paraíso";
            when(farmRepository.findById(10L)).thenReturn(Optional.of(farmUserA));
            // Crucial: existsByNameAndUserIdAndIdNot checks userA.getId(), returning false even if userB has a farm with this name
            when(farmRepository.existsByNameAndUserIdAndIdNot(sharedName, userA.getId(), 10L)).thenReturn(false);
            when(farmRepository.save(any(Farm.class))).thenReturn(farmUserA);
            when(farmMapper.toDTO(farmUserA)).thenReturn(new FarmResponseDTO(10L, sharedName, LocalDateTime.now()));

            FarmRequestDTO request = new FarmRequestDTO(sharedName);
            FarmResponseDTO response = farmService.updateFarm(10L, request, userA.getId());

            assertNotNull(response);
            assertEquals(sharedName, response.name());
        }

        @Test
        @DisplayName("Updating corral to duplicate an existing MAC Address throws IllegalStateException (409)")
        void corral_duplicate_mac_conflict() {
            when(corralRepository.findById(100L)).thenReturn(Optional.of(corralUserA));
            when(corralRepository.existsByMacAddressAndIdNot("240AC4000200", 100L)).thenReturn(true);

            CorralRequestDTO request = new CorralRequestDTO("Curral", "240AC4000200", null, 400, 30);
            IllegalStateException ex = assertThrows(IllegalStateException.class,
                    () -> corralService.updateCorral(100L, null, userA.getId(), request));

            assertTrue(ex.getMessage().contains("Já existe um curral cadastrado com este MAC Address"));
            verify(corralRepository, never()).save(any());
        }

        @Test
        @DisplayName("Updating corral keeping its CURRENT MAC Address succeeds without false conflict")
        void corral_same_mac_update_succeeds() {
            when(corralRepository.findById(100L)).thenReturn(Optional.of(corralUserA));
            when(corralRepository.existsByMacAddressAndIdNot("240AC4000100", 100L)).thenReturn(false);
            when(corralRepository.save(any(Corral.class))).thenReturn(corralUserA);
            when(corralMapper.toCorralResponseDTO(corralUserA)).thenReturn(new CorralResponseDTO(
                    100L, 10L, "Curral Principal 100", "240AC4000100", null, 400, 30, DeviceStatus.ONLINE, LocalDateTime.now()
            ));

            CorralRequestDTO request = new CorralRequestDTO("Curral Principal 100", "240AC4000100", null, 400, 30);
            CorralResponseDTO response = corralService.updateCorral(100L, null, userA.getId(), request);

            assertNotNull(response);
            assertEquals("240AC4000100", response.macAddress());
            verify(corralRepository).save(corralUserA);
        }

        @Test
        @DisplayName("Updating animal to duplicate an existing RFID Tag throws IllegalStateException (409)")
        void animal_duplicate_tag_conflict() {
            when(animalRepository.findById(1000L)).thenReturn(Optional.of(animalUserA));
            when(animalRepository.existsByTagUidAndIdNot("E2802222", 1000L)).thenReturn(true);

            AnimalRequestDTO request = new AnimalRequestDTO("Boi", null, "E2802222");
            IllegalStateException ex = assertThrows(IllegalStateException.class,
                    () -> animalService.updateAnimal(1000L, null, userA.getId(), request));

            assertTrue(ex.getMessage().contains("Já existe outro animal cadastrado com esta Tag RFID"));
            verify(animalRepository, never()).save(any());
        }

        @Test
        @DisplayName("Updating animal keeping same RFID Tag (different casing) succeeds without collision")
        void animal_same_tag_case_insensitive_succeeds() {
            when(animalRepository.findById(1000L)).thenReturn(Optional.of(animalUserA));
            when(animalRepository.existsByTagUidAndIdNot("E2801111", 1000L)).thenReturn(false);
            when(animalRepository.save(any(Animal.class))).thenReturn(animalUserA);
            when(animalMapper.toAnimalResponseDTO(animalUserA)).thenReturn(new AnimalResponseDTO(
                    1000L, 10L, "Vaca Mimosa 1000", "ID-1000", "E2801111", null, null
            ));

            AnimalRequestDTO request = new AnimalRequestDTO("Vaca Mimosa 1000", "ID-1000", "e2801111");
            AnimalResponseDTO response = animalService.updateAnimal(1000L, null, userA.getId(), request);

            assertNotNull(response);
            assertEquals("E2801111", response.tagUid());
            verify(animalRepository).save(animalUserA);
        }
    }

    // =========================================================================
    // 4. ADVERSARIAL PROBE: IoT Active Cleaning Lock (409 Conflict)
    // =========================================================================
    @Nested
    @DisplayName("4. IoT Fail-Fast Active Cleaning Lock Probes")
    class ActiveCleaningLockProbes {

        @Test
        @DisplayName("Deleting Corral with CleanState.EM_ANDAMENTO throws IllegalStateException (409)")
        void delete_corral_with_active_cleaning_em_andamento_conflict() {
            when(corralRepository.findById(100L)).thenReturn(Optional.of(corralUserA));
            when(cleanCmdRepository.existsByCorralIdAndCleanState(100L, CleanState.EM_ANDAMENTO)).thenReturn(true);

            IllegalStateException ex = assertThrows(IllegalStateException.class,
                    () -> corralService.deleteCorral(100L, null, userA.getId()));

            assertEquals("Não é possível excluir o curral pois há uma limpeza em andamento", ex.getMessage());
            verify(corralRepository, never()).delete(any());
        }

        @Test
        @DisplayName("Deleting Corral with CleanState.PENDENTE throws IllegalStateException (409)")
        void delete_corral_with_active_cleaning_pendente_conflict() {
            when(corralRepository.findById(100L)).thenReturn(Optional.of(corralUserA));
            when(cleanCmdRepository.existsByCorralIdAndCleanState(100L, CleanState.EM_ANDAMENTO)).thenReturn(false);
            when(cleanCmdRepository.existsByCorralIdAndCleanState(100L, CleanState.PENDENTE)).thenReturn(true);

            IllegalStateException ex = assertThrows(IllegalStateException.class,
                    () -> corralService.deleteCorral(100L, null, userA.getId()));

            assertEquals("Não é possível excluir o curral pois há uma limpeza em andamento", ex.getMessage());
            verify(corralRepository, never()).delete(any());
        }

        @Test
        @DisplayName("Deleting Farm when child Corral has CleanState.EM_ANDAMENTO throws IllegalStateException (409)")
        void delete_farm_with_active_cleaning_em_andamento_conflict() {
            when(farmRepository.findById(10L)).thenReturn(Optional.of(farmUserA));
            when(cleanCmdRepository.existsByCorralFarmIdAndCleanState(10L, CleanState.EM_ANDAMENTO)).thenReturn(true);

            IllegalStateException ex = assertThrows(IllegalStateException.class,
                    () -> farmService.deleteFarm(10L, userA.getId()));

            assertEquals("Não é possível excluir a fazenda pois existe um curral com limpeza em andamento", ex.getMessage());
            verify(farmRepository, never()).delete(any());
        }

        @Test
        @DisplayName("Deleting Corral when cleanings are CONCLUIDO or CANCELADO succeeds cleanly (204)")
        void delete_corral_with_finished_cleanings_succeeds() {
            when(corralRepository.findById(100L)).thenReturn(Optional.of(corralUserA));
            when(cleanCmdRepository.existsByCorralIdAndCleanState(100L, CleanState.EM_ANDAMENTO)).thenReturn(false);
            when(cleanCmdRepository.existsByCorralIdAndCleanState(100L, CleanState.PENDENTE)).thenReturn(false);

            assertDoesNotThrow(() -> corralService.deleteCorral(100L, null, userA.getId()));
            verify(corralRepository).delete(corralUserA);
        }

        @Test
        @DisplayName("Deleting Farm when cleanings are CONCLUIDO or CANCELADO succeeds cleanly (204)")
        void delete_farm_with_finished_cleanings_succeeds() {
            when(farmRepository.findById(10L)).thenReturn(Optional.of(farmUserA));
            when(cleanCmdRepository.existsByCorralFarmIdAndCleanState(10L, CleanState.EM_ANDAMENTO)).thenReturn(false);

            assertDoesNotThrow(() -> farmService.deleteFarm(10L, userA.getId()));
            verify(farmRepository).delete(farmUserA);
        }
    }
}
