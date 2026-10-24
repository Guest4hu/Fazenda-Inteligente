package com.usjt.a3.controller;

import com.usjt.a3.config.security.UserPrincipal;
import com.usjt.a3.dto.request.FarmRequestDTO;
import com.usjt.a3.dto.response.FarmResponseDTO;
import com.usjt.a3.service.FarmService;
import com.usjt.a3.test.MockMvcTestHelper;
import com.usjt.a3.test.TestFixtures;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
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
class FarmControllerTest {

    @Mock
    private FarmService farmService;

    @InjectMocks
    private FarmController farmController;

    private MockMvc mockMvc;
    private final UserPrincipal principal = TestFixtures.createPrincipal(1L);

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcTestHelper.buildMockMvc(farmController, principal);
    }

    @Test
    @DisplayName("PUT /api/v1/farms/{id} retorna 200 OK ao atualizar nome com sucesso")
    void updateFarm_200() throws Exception {
        FarmResponseDTO responseDTO = new FarmResponseDTO(1L, "Fazenda Bela Vista", LocalDateTime.now());
        when(farmService.updateFarm(eq(1L), any(FarmRequestDTO.class), eq(1L))).thenReturn(responseDTO);

        mockMvc.perform(put("/api/v1/farms/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "name": "Fazenda Bela Vista"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1L))
                .andExpect(jsonPath("$.name").value("Fazenda Bela Vista"));
    }

    @Test
    @DisplayName("PUT /api/v1/farms/{id} retorna 400 Bad Request quando nome está em branco")
    void updateFarm_400_Validation() throws Exception {
        mockMvc.perform(put("/api/v1/farms/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "name": ""
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Erro de Validação"))
                .andExpect(jsonPath("$.invalidParams.name").exists());
    }

    @Test
    @DisplayName("PUT /api/v1/farms/{id} retorna 403 Forbidden quando usuário não é o dono")
    void updateFarm_403() throws Exception {
        when(farmService.updateFarm(eq(1L), any(FarmRequestDTO.class), eq(1L)))
                .thenThrow(new SecurityException("Você não tem permissão para editar esta fazenda"));

        mockMvc.perform(put("/api/v1/farms/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "name": "Fazenda Invasora"
                                }
                                """))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.title").value("Acesso Negado"));
    }

    @Test
    @DisplayName("PUT /api/v1/farms/{id} retorna 404 Not Found quando fazenda não existe")
    void updateFarm_404() throws Exception {
        when(farmService.updateFarm(eq(999L), any(FarmRequestDTO.class), eq(1L)))
                .thenThrow(new EntityNotFoundException("Fazenda não encontrada"));

        mockMvc.perform(put("/api/v1/farms/999")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "name": "Fazenda Fantasma"
                                }
                                """))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.title").value("Recurso Não Encontrado"));
    }

    @Test
    @DisplayName("PUT /api/v1/farms/{id} retorna 409 Conflict quando nome já existe para o usuário")
    void updateFarm_409() throws Exception {
        when(farmService.updateFarm(eq(1L), any(FarmRequestDTO.class), eq(1L)))
                .thenThrow(new IllegalStateException("Você já possui uma fazenda cadastrada com este nome"));

        mockMvc.perform(put("/api/v1/farms/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "name": "Fazenda Duplicada"
                                }
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.title").value("Conflito de Regra de Negócio"));
    }

    @Test
    @DisplayName("DELETE /api/v1/farms/{id} retorna 204 No Content ao excluir com sucesso")
    void deleteFarm_204() throws Exception {
        doNothing().when(farmService).deleteFarm(1L, 1L);

        mockMvc.perform(delete("/api/v1/farms/1"))
                .andExpect(status().isNoContent());
    }

    @Test
    @DisplayName("DELETE /api/v1/farms/{id} retorna 403 Forbidden quando usuário não é o dono")
    void deleteFarm_403() throws Exception {
        doThrow(new SecurityException("Acesso negado")).when(farmService).deleteFarm(1L, 1L);

        mockMvc.perform(delete("/api/v1/farms/1"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("DELETE /api/v1/farms/{id} retorna 404 Not Found quando fazenda não existe")
    void deleteFarm_404() throws Exception {
        doThrow(new EntityNotFoundException("Não encontrada")).when(farmService).deleteFarm(999L, 1L);

        mockMvc.perform(delete("/api/v1/farms/999"))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("DELETE /api/v1/farms/{id} retorna 409 Conflict quando há limpeza em andamento")
    void deleteFarm_409() throws Exception {
        doThrow(new IllegalStateException("Limpeza em andamento")).when(farmService).deleteFarm(1L, 1L);

        mockMvc.perform(delete("/api/v1/farms/1"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.title").value("Conflito de Regra de Negócio"));
    }
}
