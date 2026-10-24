package com.usjt.a3.controller;

import com.usjt.a3.config.security.UserPrincipal;
import com.usjt.a3.dto.request.AnimalRequestDTO;
import com.usjt.a3.dto.request.CorralRequestDTO;
import com.usjt.a3.dto.request.FarmRequestDTO;
import com.usjt.a3.dto.response.AnimalResponseDTO;
import com.usjt.a3.dto.response.CorralResponseDTO;
import com.usjt.a3.dto.response.FarmResponseDTO;
import com.usjt.a3.model.enums.DeviceStatus;
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
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(MockitoExtension.class)
class LifecycleBoundaryAndRoutingEmpiricalTest {

    @Mock
    private FarmService farmService;
    @InjectMocks
    private FarmController farmController;

    @Mock
    private CorralService corralService;
    @InjectMocks
    private CorralController corralController;

    @Mock
    private AnimalService animalService;
    @InjectMocks
    private AnimalController animalController;

    private MockMvc farmMockMvc;
    private MockMvc corralMockMvc;
    private MockMvc animalMockMvc;

    private final UserPrincipal principal = TestFixtures.createPrincipal(1L);

    @BeforeEach
    void setUp() {
        farmMockMvc = MockMvcTestHelper.buildMockMvc(farmController, principal);
        corralMockMvc = MockMvcTestHelper.buildMockMvc(corralController, principal);
        animalMockMvc = MockMvcTestHelper.buildMockMvc(animalController, principal);
    }

    @Nested
    @DisplayName("1. Malformed Inputs: Blank Names & Length Constraints")
    class BlankNamesAndLengthTests {

        @ParameterizedTest(name = "Farm PUT rejeita nome inválido: ''{0}''")
        @ValueSource(strings = {"", "   ", "A"})
        void farm_rejectInvalidNames(String invalidName) throws Exception {
            farmMockMvc.perform(put("/api/v1/farms/1")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(String.format("{\"name\": \"%s\"}", invalidName)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.title").value("Erro de Validação"))
                    .andExpect(jsonPath("$.invalidParams.name").exists());
        }

        @Test
        @DisplayName("Farm PUT rejeita nome excedendo 100 caracteres")
        void farm_rejectNameExceeding100Chars() throws Exception {
            String longName = "A".repeat(101);
            farmMockMvc.perform(put("/api/v1/farms/1")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(String.format("{\"name\": \"%s\"}", longName)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.title").value("Erro de Validação"))
                    .andExpect(jsonPath("$.invalidParams.name").exists());
        }

        @ParameterizedTest(name = "Corral PUT rejeita nome inválido: ''{0}''")
        @ValueSource(strings = {"", "   ", "C"})
        void corral_rejectInvalidNames(String invalidName) throws Exception {
            corralMockMvc.perform(put("/api/v1/currais/5")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(String.format("{\"name\": \"%s\", \"macAddress\": \"240AC4000110\"}", invalidName)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.title").value("Erro de Validação"))
                    .andExpect(jsonPath("$.invalidParams.name").exists());
        }

        @ParameterizedTest(name = "Animal PUT rejeita nome inválido: ''{0}''")
        @ValueSource(strings = {"", "   ", "X"})
        void animal_rejectInvalidNames(String invalidName) throws Exception {
            animalMockMvc.perform(put("/api/v1/animais/10")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(String.format("{\"name\": \"%s\", \"tagUid\": \"E2801160\"}", invalidName)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.title").value("Erro de Validação"))
                    .andExpect(jsonPath("$.invalidParams.name").exists());
        }

        @Test
        @DisplayName("Animal PUT rejeita nome excedendo 50 caracteres")
        void animal_rejectNameExceeding50Chars() throws Exception {
            String longName = "A".repeat(51);
            animalMockMvc.perform(put("/api/v1/animais/10")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(String.format("{\"name\": \"%s\", \"tagUid\": \"E2801160\"}", longName)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.title").value("Erro de Validação"))
                    .andExpect(jsonPath("$.invalidParams.name").exists());
        }
    }

    @Nested
    @DisplayName("2. Malformed Inputs: Invalid MAC Addresses")
    class InvalidMacAddressTests {

        @ParameterizedTest(name = "Corral PUT rejeita MAC com formato inválido: ''{0}''")
        @ValueSource(strings = {
                "24:0A:C4:00:01:10",  // 17 chars com dois pontos
                "24-0A-C4-00-01-10",  // 17 chars com hífens
                "240AC400011",        // 11 chars (muito curto)
                "240AC40001100",      // 13 chars (muito longo)
                "240AC400011G",       // caractere 'G' não-hex
                "240AC4 00011",       // espaço no meio
                "",                   // vazio
                "            "        // em branco
        })
        void corral_rejectInvalidMacAddress(String invalidMac) throws Exception {
            corralMockMvc.perform(put("/api/v1/currais/5")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(String.format("{\"name\": \"Curral Valido\", \"macAddress\": \"%s\"}", invalidMac)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.title").value("Erro de Validação"))
                    .andExpect(jsonPath("$.invalidParams.macAddress").exists());
        }

        @Test
        @DisplayName("Corral PUT aceita MAC válido de 12 hexadecimais maiúsculos ou minúsculos")
        void corral_acceptValidMac() throws Exception {
            CorralResponseDTO responseDTO = new CorralResponseDTO(
                    5L, 10L, "Curral Valido", "240AC4000110", null, 400, 30, DeviceStatus.ONLINE, LocalDateTime.now()
            );
            when(corralService.updateCorral(eq(5L), isNull(), eq(1L), any(CorralRequestDTO.class))).thenReturn(responseDTO);

            corralMockMvc.perform(put("/api/v1/currais/5")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"name\": \"Curral Valido\", \"macAddress\": \"240ac4000110\"}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.id").value(5L));
        }
    }

    @Nested
    @DisplayName("3. Malformed Inputs: Empty Tags & Animal Identification")
    class EmptyTagsTests {

        @ParameterizedTest(name = "Animal PUT rejeita tagUid em branco: ''{0}''")
        @ValueSource(strings = {"", "   "})
        void animal_rejectEmptyTag(String invalidTag) throws Exception {
            animalMockMvc.perform(put("/api/v1/animais/10")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(String.format("{\"name\": \"Mimosa\", \"tagUid\": \"%s\"}", invalidTag)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.title").value("Erro de Validação"))
                    .andExpect(jsonPath("$.invalidParams.tagUid").exists());
        }

        @Test
        @DisplayName("Animal PUT rejeita identificação excedendo 30 caracteres")
        void animal_rejectIdentificationExceeding30Chars() throws Exception {
            String longId = "ID".repeat(16); // 32 chars
            animalMockMvc.perform(put("/api/v1/animais/10")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(String.format("{\"name\": \"Mimosa\", \"identification\": \"%s\", \"tagUid\": \"E2801160\"}", longId)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.title").value("Erro de Validação"))
                    .andExpect(jsonPath("$.invalidParams.identification").exists());
        }
    }

    @Nested
    @DisplayName("4. Boundary Negative IDs Handling")
    class NegativeIdsControllerTests {

        @Test
        @DisplayName("PUT e DELETE /api/v1/farms/-1 retornam 404 ProblemDetail")
        void farm_negativeId() throws Exception {
            when(farmService.updateFarm(eq(-1L), any(FarmRequestDTO.class), eq(1L)))
                    .thenThrow(new EntityNotFoundException("Fazenda não encontrada com ID: -1"));
            doThrow(new EntityNotFoundException("Fazenda não encontrada com ID: -1"))
                    .when(farmService).deleteFarm(-1L, 1L);

            farmMockMvc.perform(put("/api/v1/farms/-1")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"name\": \"Fazenda Inexistente\"}"))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.title").value("Recurso Não Encontrado"))
                    .andExpect(jsonPath("$.detail").value("Fazenda não encontrada com ID: -1"));

            farmMockMvc.perform(delete("/api/v1/farms/-1"))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.title").value("Recurso Não Encontrado"));
        }

        @Test
        @DisplayName("PUT, DELETE e GET /api/v1/currais/-5 retornam 404 ProblemDetail")
        void corral_negativeId() throws Exception {
            when(corralService.updateCorral(eq(-5L), isNull(), eq(1L), any(CorralRequestDTO.class)))
                    .thenThrow(new EntityNotFoundException("Curral não encontrado com ID: -5"));
            doThrow(new EntityNotFoundException("Curral não encontrado com ID: -5"))
                    .when(corralService).deleteCorral(-5L, null, 1L);
            when(corralService.getCorralById(-5L, null, 1L))
                    .thenThrow(new EntityNotFoundException("Curral não encontrado com ID: -5"));

            corralMockMvc.perform(put("/api/v1/currais/-5")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"name\": \"Curral Inexistente\", \"macAddress\": \"240AC4000110\"}"))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.title").value("Recurso Não Encontrado"));

            corralMockMvc.perform(delete("/api/v1/currais/-5"))
                    .andExpect(status().isNotFound());

            corralMockMvc.perform(get("/api/v1/currais/-5"))
                    .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("PUT, DELETE e GET /api/v1/animais/-10 retornam 404 ProblemDetail")
        void animal_negativeId() throws Exception {
            when(animalService.updateAnimal(eq(-10L), isNull(), eq(1L), any(AnimalRequestDTO.class)))
                    .thenThrow(new EntityNotFoundException("Animal não encontrado com ID: -10"));
            doThrow(new EntityNotFoundException("Animal não encontrado com ID: -10"))
                    .when(animalService).deleteAnimal(-10L, null, 1L);
            when(animalService.getAnimalById(-10L, null, 1L))
                    .thenThrow(new EntityNotFoundException("Animal não encontrado com ID: -10"));

            animalMockMvc.perform(put("/api/v1/animais/-10")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"name\": \"Animal Inexistente\", \"tagUid\": \"E2801160\"}"))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.title").value("Recurso Não Encontrado"));

            animalMockMvc.perform(delete("/api/v1/animais/-10"))
                    .andExpect(status().isNotFound());

            animalMockMvc.perform(get("/api/v1/animais/-10"))
                    .andExpect(status().isNotFound());
        }
    }

    @Nested
    @DisplayName("5. Dual-Path Routing Consistency & Controller Dispatch")
    class DualPathRoutingControllerTests {

        @Test
        @DisplayName("Corral rotas direta e aninhada invocam o serviço com parâmetros consistentes")
        void corral_dualPathDispatch() throws Exception {
            CorralResponseDTO responseDTO = new CorralResponseDTO(
                    5L, 10L, "Curral 01", "240AC4000110", null, 400, 30, DeviceStatus.ONLINE, LocalDateTime.now()
            );

            when(corralService.updateCorral(eq(5L), isNull(), eq(1L), any(CorralRequestDTO.class))).thenReturn(responseDTO);
            when(corralService.updateCorral(eq(5L), eq(10L), eq(1L), any(CorralRequestDTO.class))).thenReturn(responseDTO);
            when(corralService.getCorralById(5L, null, 1L)).thenReturn(responseDTO);
            when(corralService.getCorralById(5L, 10L, 1L)).thenReturn(responseDTO);

            // PUT direto
            corralMockMvc.perform(put("/api/v1/currais/5")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"name\": \"Curral 01\", \"macAddress\": \"240AC4000110\"}"))
                    .andExpect(status().isOk());
            verify(corralService).updateCorral(eq(5L), isNull(), eq(1L), any(CorralRequestDTO.class));

            // PUT aninhado
            corralMockMvc.perform(put("/api/v1/farms/10/currais/5")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"name\": \"Curral 01\", \"macAddress\": \"240AC4000110\"}"))
                    .andExpect(status().isOk());
            verify(corralService).updateCorral(eq(5L), eq(10L), eq(1L), any(CorralRequestDTO.class));

            // DELETE direto
            corralMockMvc.perform(delete("/api/v1/currais/5")).andExpect(status().isNoContent());
            verify(corralService).deleteCorral(5L, null, 1L);

            // DELETE aninhado
            corralMockMvc.perform(delete("/api/v1/farms/10/currais/5")).andExpect(status().isNoContent());
            verify(corralService).deleteCorral(5L, 10L, 1L);

            // GET direto
            corralMockMvc.perform(get("/api/v1/currais/5")).andExpect(status().isOk());
            verify(corralService).getCorralById(5L, null, 1L);

            // GET aninhado
            corralMockMvc.perform(get("/api/v1/farms/10/currais/5")).andExpect(status().isOk());
            verify(corralService).getCorralById(5L, 10L, 1L);
        }

        @Test
        @DisplayName("Animal rotas direta e aninhada invocam o serviço com parâmetros consistentes")
        void animal_dualPathDispatch() throws Exception {
            AnimalResponseDTO responseDTO = new AnimalResponseDTO(
                    20L, 10L, "Mimosa", "BR-01", "E2801160", null, null
            );

            when(animalService.updateAnimal(eq(20L), isNull(), eq(1L), any(AnimalRequestDTO.class))).thenReturn(responseDTO);
            when(animalService.updateAnimal(eq(20L), eq(10L), eq(1L), any(AnimalRequestDTO.class))).thenReturn(responseDTO);
            when(animalService.getAnimalById(20L, null, 1L)).thenReturn(responseDTO);
            when(animalService.getAnimalById(20L, 10L, 1L)).thenReturn(responseDTO);

            // PUT direto
            animalMockMvc.perform(put("/api/v1/animais/20")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"name\": \"Mimosa\", \"tagUid\": \"E2801160\"}"))
                    .andExpect(status().isOk());
            verify(animalService).updateAnimal(eq(20L), isNull(), eq(1L), any(AnimalRequestDTO.class));

            // PUT aninhado
            animalMockMvc.perform(put("/api/v1/farms/10/animais/20")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"name\": \"Mimosa\", \"tagUid\": \"E2801160\"}"))
                    .andExpect(status().isOk());
            verify(animalService).updateAnimal(eq(20L), eq(10L), eq(1L), any(AnimalRequestDTO.class));

            // DELETE direto
            animalMockMvc.perform(delete("/api/v1/animais/20")).andExpect(status().isNoContent());
            verify(animalService).deleteAnimal(20L, null, 1L);

            // DELETE aninhado
            animalMockMvc.perform(delete("/api/v1/farms/10/animais/20")).andExpect(status().isNoContent());
            verify(animalService).deleteAnimal(20L, 10L, 1L);

            // GET direto
            animalMockMvc.perform(get("/api/v1/animais/20")).andExpect(status().isOk());
            verify(animalService).getAnimalById(20L, null, 1L);

            // GET aninhado
            animalMockMvc.perform(get("/api/v1/farms/10/animais/20")).andExpect(status().isOk());
            verify(animalService).getAnimalById(20L, 10L, 1L);
        }
    }
}
