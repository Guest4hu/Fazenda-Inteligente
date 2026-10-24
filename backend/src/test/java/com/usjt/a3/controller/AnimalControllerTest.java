package com.usjt.a3.controller;

import com.usjt.a3.config.security.UserPrincipal;
import com.usjt.a3.dto.request.AnimalPresenceRequestDTO;
import com.usjt.a3.dto.request.AnimalRequestDTO;
import com.usjt.a3.dto.response.AnimalEventResponseDTO;
import com.usjt.a3.dto.response.AnimalResponseDTO;
import com.usjt.a3.model.enums.AnimalEventType;
import com.usjt.a3.model.enums.EventOrigin;
import com.usjt.a3.service.AnimalService;
import com.usjt.a3.test.MockMvcTestHelper;
import com.usjt.a3.test.TestFixtures;
import jakarta.persistence.EntityNotFoundException;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(MockitoExtension.class)
class AnimalControllerTest {

    @Mock
    private AnimalService animalService;

    @InjectMocks
    private AnimalController animalController;

    private MockMvc mockMvc;
    private final UserPrincipal principal = TestFixtures.createPrincipal(1L);

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcTestHelper.buildMockMvc(animalController, principal);
    }

    @Test
    @DisplayName("PUT /api/v1/animais/{id} retorna 200 OK ao atualizar animal")
    void updateAnimal_DirectRoute_200() throws Exception {
        AnimalResponseDTO responseDTO = new AnimalResponseDTO(
                10L, 1L, "Mimosa Atualizada", "BR-99", "E2801199", null, null
        );
        when(animalService.updateAnimal(eq(10L), isNull(), eq(1L), any(AnimalRequestDTO.class))).thenReturn(responseDTO);

        mockMvc.perform(put("/api/v1/animais/10")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "name": "Mimosa Atualizada",
                                    "identification": "BR-99",
                                    "tagUid": "E2801199"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(10L))
                .andExpect(jsonPath("$.name").value("Mimosa Atualizada"))
                .andExpect(jsonPath("$.tagUid").value("E2801199"));
    }

    @Test
    @DisplayName("PUT /api/v1/farms/{farmId}/animais/{id} retorna 200 OK (rota aninhada)")
    void updateAnimal_NestedRoute_200() throws Exception {
        AnimalResponseDTO responseDTO = new AnimalResponseDTO(
                10L, 1L, "Mimosa", "BR-01", "E2801160", null, null
        );
        when(animalService.updateAnimal(eq(10L), eq(1L), eq(1L), any(AnimalRequestDTO.class))).thenReturn(responseDTO);

        mockMvc.perform(put("/api/v1/farms/1/animais/10")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "name": "Mimosa",
                                    "identification": "BR-01",
                                    "tagUid": "E2801160"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(10L));
    }

    @Test
    @DisplayName("PUT /api/v1/animais/{id} retorna 400 Bad Request quando nome ou tag estão em branco")
    void updateAnimal_400_Validation() throws Exception {
        mockMvc.perform(put("/api/v1/animais/10")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "name": "",
                                    "tagUid": ""
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Erro de Validação"))
                .andExpect(jsonPath("$.invalidParams.name").exists())
                .andExpect(jsonPath("$.invalidParams.tagUid").exists());
    }

    @Test
    @DisplayName("PUT /api/v1/animais/{id} retorna 403 Forbidden")
    void updateAnimal_403() throws Exception {
        when(animalService.updateAnimal(eq(10L), isNull(), eq(1L), any(AnimalRequestDTO.class)))
                .thenThrow(new SecurityException("Você não tem permissão para editar este animal"));

        mockMvc.perform(put("/api/v1/animais/10")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "name": "Mimosa",
                                    "tagUid": "E2801160"
                                }
                                """))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.title").value("Acesso Negado"));
    }

    @Test
    @DisplayName("PUT /api/v1/animais/{id} retorna 404 Not Found")
    void updateAnimal_404() throws Exception {
        when(animalService.updateAnimal(eq(999L), isNull(), eq(1L), any(AnimalRequestDTO.class)))
                .thenThrow(new EntityNotFoundException("Animal não encontrado"));

        mockMvc.perform(put("/api/v1/animais/999")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "name": "Fantasma",
                                    "tagUid": "DEADBEEF"
                                }
                                """))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.title").value("Recurso Não Encontrado"));
    }

    @Test
    @DisplayName("PUT /api/v1/animais/{id} retorna 409 Conflict quando Tag RFID já existe em outro animal")
    void updateAnimal_409() throws Exception {
        when(animalService.updateAnimal(eq(10L), isNull(), eq(1L), any(AnimalRequestDTO.class)))
                .thenThrow(new IllegalStateException("Já existe outro animal cadastrado com esta Tag RFID"));

        mockMvc.perform(put("/api/v1/animais/10")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "name": "Mimosa",
                                    "tagUid": "TAG_DUPLICADA"
                                }
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.title").value("Conflito de Regra de Negócio"));
    }

    @Test
    @DisplayName("DELETE /api/v1/animais/{id} retorna 204 No Content")
    void deleteAnimal_204() throws Exception {
        doNothing().when(animalService).deleteAnimal(10L, null, 1L);

        mockMvc.perform(delete("/api/v1/animais/10"))
                .andExpect(status().isNoContent());
    }

    @Test
    @DisplayName("DELETE /api/v1/farms/{farmId}/animais/{id} retorna 204 No Content (rota aninhada)")
    void deleteAnimal_NestedRoute_204() throws Exception {
        doNothing().when(animalService).deleteAnimal(10L, 1L, 1L);

        mockMvc.perform(delete("/api/v1/farms/1/animais/10"))
                .andExpect(status().isNoContent());
    }

    @Test
    @DisplayName("DELETE /api/v1/animais/{id} retorna 403 Forbidden")
    void deleteAnimal_403() throws Exception {
        doThrow(new SecurityException("Acesso negado")).when(animalService).deleteAnimal(10L, null, 1L);

        mockMvc.perform(delete("/api/v1/animais/10"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("DELETE /api/v1/animais/{id} retorna 404 Not Found")
    void deleteAnimal_404() throws Exception {
        doThrow(new EntityNotFoundException("Animal não encontrado")).when(animalService).deleteAnimal(999L, null, 1L);

        mockMvc.perform(delete("/api/v1/animais/999"))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("GET /api/v1/animais/{id} retorna 200 OK")
    void getAnimalById_200() throws Exception {
        AnimalResponseDTO responseDTO = new AnimalResponseDTO(
                10L, 1L, "Mimosa", "BR-01", "E2801160", null, null
        );
        when(animalService.getAnimalById(eq(10L), isNull(), eq(1L))).thenReturn(responseDTO);

        mockMvc.perform(get("/api/v1/animais/10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(10L))
                .andExpect(jsonPath("$.name").value("Mimosa"));
    }

    @Test
    @DisplayName("POST /api/v1/currais/{corralId}/presenca retorna 201 Created ao registrar presença")
    void registerPresence_201() throws Exception {
        AnimalEventResponseDTO responseDTO = new AnimalEventResponseDTO(
                1L, 5L, "Curral Modelo", 10L, "Mimosa", "E2801160", AnimalEventType.ENTROU, EventOrigin.MANUAL, LocalDateTime.now()
        );
        when(animalService.registerPresence(eq(5L), isNull(), eq(1L), any(AnimalPresenceRequestDTO.class))).thenReturn(responseDTO);

        mockMvc.perform(post("/api/v1/currais/5/presenca")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "tagUid": "E2801160",
                                    "typeEvent": "ENTROU",
                                    "origin": "MANUAL"
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(1L))
                .andExpect(jsonPath("$.corralId").value(5L))
                .andExpect(jsonPath("$.typeEvent").value("ENTROU"))
                .andExpect(jsonPath("$.eventOrigin").value("MANUAL"));
    }

    @Test
    @DisplayName("POST /api/v1/currais/{corralId}/presenca retorna 409 Conflict quando regra de presença for violada")
    void registerPresence_409_Conflict() throws Exception {
        when(animalService.registerPresence(eq(5L), isNull(), eq(1L), any(AnimalPresenceRequestDTO.class)))
                .thenThrow(new IllegalStateException("Animal já está presente no curral ID: 5"));

        mockMvc.perform(post("/api/v1/currais/5/presenca")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "tagUid": "E2801160",
                                    "typeEvent": "ENTROU",
                                    "origin": "MANUAL"
                                }
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.title").value("Conflito de Regra de Negócio"))
                .andExpect(jsonPath("$.detail").value("Animal já está presente no curral ID: 5"));
    }

    @Test
    @DisplayName("POST /api/v1/currais/{corralId}/presenca retorna 400 Bad Request quando payload for inválido")
    void registerPresence_400_Validation() throws Exception {
        mockMvc.perform(post("/api/v1/currais/5/presenca")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "tagUid": "",
                                    "typeEvent": null
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Erro de Validação"));
    }

    @Test
    @DisplayName("GET /api/v1/currais/{corralId}/eventos retorna 200 OK com lista de eventos")
    void listEvents_200() throws Exception {
        AnimalEventResponseDTO eventDTO = new AnimalEventResponseDTO(
                1L, 5L, "Curral Modelo", 10L, "Mimosa", "E2801160", AnimalEventType.ENTROU, EventOrigin.TAG, LocalDateTime.now()
        );
        when(animalService.listEventsByCorral(eq(5L), isNull(), eq(1L))).thenReturn(List.of(eventDTO));

        mockMvc.perform(get("/api/v1/currais/5/eventos"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(1L))
                .andExpect(jsonPath("$[0].corralId").value(5L))
                .andExpect(jsonPath("$[0].typeEvent").value("ENTROU"));
    }

    @Test
    @DisplayName("GET /api/v1/currais/{corralId}/eventos retorna 403 Forbidden para curral de outro usuário")
    void listEvents_403() throws Exception {
        when(animalService.listEventsByCorral(eq(5L), isNull(), eq(1L)))
                .thenThrow(new SecurityException("Você não tem permissão para visualizar eventos deste curral"));

        mockMvc.perform(get("/api/v1/currais/5/eventos"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.title").value("Acesso Negado"));
    }

    @Test
    @DisplayName("POST /api/v1/farms/{farmId}/currais/{corralId}/presenca retorna 201 Created (rota aninhada)")
    void registerPresence_NestedRoute_201() throws Exception {
        AnimalEventResponseDTO responseDTO = new AnimalEventResponseDTO(
                1L, 5L, "Curral Modelo", 10L, "Mimosa", "E2801160", AnimalEventType.ENTROU, EventOrigin.MANUAL, LocalDateTime.now()
        );
        when(animalService.registerPresence(eq(5L), eq(2L), eq(1L), any(AnimalPresenceRequestDTO.class))).thenReturn(responseDTO);

        mockMvc.perform(post("/api/v1/farms/2/currais/5/presenca")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "tagUid": "E2801160",
                                    "typeEvent": "ENTROU",
                                    "origin": "MANUAL"
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(1L))
                .andExpect(jsonPath("$.corralId").value(5L));
    }

    @Test
    @DisplayName("POST /api/v1/farms/{farmId}/currais/{corralId}/presenca retorna 404 Not Found quando curral não pertence à fazenda")
    void registerPresence_NestedRoute_MismatchFarm_404() throws Exception {
        when(animalService.registerPresence(eq(5L), eq(99L), eq(1L), any(AnimalPresenceRequestDTO.class)))
                .thenThrow(new EntityNotFoundException("Curral não pertence à fazenda informada"));

        mockMvc.perform(post("/api/v1/farms/99/currais/5/presenca")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "tagUid": "E2801160",
                                    "typeEvent": "ENTROU",
                                    "origin": "MANUAL"
                                }
                                """))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.title").value("Recurso Não Encontrado"));
    }

    @Test
    @DisplayName("GET /api/v1/farms/{farmId}/currais/{corralId}/eventos retorna 200 OK (rota aninhada)")
    void listEvents_NestedRoute_200() throws Exception {
        AnimalEventResponseDTO eventDTO = new AnimalEventResponseDTO(
                1L, 5L, "Curral Modelo", 10L, "Mimosa", "E2801160", AnimalEventType.ENTROU, EventOrigin.TAG, LocalDateTime.now()
        );
        when(animalService.listEventsByCorral(eq(5L), eq(2L), eq(1L))).thenReturn(List.of(eventDTO));

        mockMvc.perform(get("/api/v1/farms/2/currais/5/eventos"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(1L))
                .andExpect(jsonPath("$[0].corralId").value(5L));
    }

    @Test
    @DisplayName("GET /api/v1/farms/{farmId}/currais/{corralId}/eventos retorna 404 Not Found quando curral não pertence à fazenda")
    void listEvents_NestedRoute_MismatchFarm_404() throws Exception {
        when(animalService.listEventsByCorral(eq(5L), eq(99L), eq(1L)))
                .thenThrow(new EntityNotFoundException("Curral não pertence à fazenda informada"));

        mockMvc.perform(get("/api/v1/farms/99/currais/5/eventos"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.title").value("Recurso Não Encontrado"));
    }
}
