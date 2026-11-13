package com.usjt.a3.controller;

import com.usjt.a3.config.security.UserPrincipal;
import com.usjt.a3.dto.request.CleanCmdRequestDTO;
import com.usjt.a3.dto.response.CleanCmdResponseDTO;
import com.usjt.a3.model.enums.CleanOrigin;
import com.usjt.a3.model.enums.CleanState;
import com.usjt.a3.service.CleanService;
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
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(MockitoExtension.class)
class CleanControllerTest {

    @Mock
    private CleanService cleanService;

    @InjectMocks
    private CleanController cleanController;

    private MockMvc mockMvc;
    private final UserPrincipal principal = TestFixtures.createPrincipal(1L);

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcTestHelper.buildMockMvc(cleanController, principal);
    }

    @Test
    @DisplayName("POST /api/v1/currais/{id}/limpeza retorna 200 OK com comando criado")
    void dispatchClean_Success_200() throws Exception {
        UUID cmdId = UUID.randomUUID();
        CleanCmdResponseDTO responseDTO = new CleanCmdResponseDTO(
                cmdId, 1L, CleanOrigin.MANUAL, CleanState.CONCLUIDO, 20, LocalDateTime.now(), "Bomba acionada"
        );
        when(cleanService.triggerManualClean(eq(1L), eq(1L), any())).thenReturn(responseDTO);

        mockMvc.perform(post("/api/v1/currais/1/limpeza")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"origin\":\"MANUAL\",\"secondsDuration\":20}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(cmdId.toString()))
                .andExpect(jsonPath("$.state").value("CONCLUIDO"));
    }

    @Test
    @DisplayName("POST /api/v1/currais/{id}/limpeza aceita duração personalizada (ex: 45s)")
    void dispatchClean_CustomDuration_200() throws Exception {
        UUID cmdId = UUID.randomUUID();
        CleanCmdResponseDTO responseDTO = new CleanCmdResponseDTO(
                cmdId, 1L, CleanOrigin.MANUAL, CleanState.CONCLUIDO, 45, LocalDateTime.now(), "Bomba acionada por 45s"
        );
        when(cleanService.triggerManualClean(eq(1L), eq(1L), any())).thenReturn(responseDTO);

        mockMvc.perform(post("/api/v1/currais/1/limpeza")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"origin\":\"MANUAL\",\"secondsDuration\":45}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(cmdId.toString()))
                .andExpect(jsonPath("$.secondsDuration").value(45));
    }

    @Test
    @DisplayName("POST /api/v1/currais/{id}/limpeza retorna 400 quando secondsDuration > 60")
    void dispatchClean_DurationOver60_400() throws Exception {
        mockMvc.perform(post("/api/v1/currais/1/limpeza")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"origin\":\"MANUAL\",\"secondsDuration\":75}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.invalidParams.secondsDuration").exists());
    }

    @Test
    @DisplayName("POST /api/v1/currais/{id}/limpeza/parar retorna 200 OK com parada confirmada")
    void stopClean_ViaLimpezaParar_200() throws Exception {
        UUID cmdId = UUID.randomUUID();
        CleanCmdResponseDTO responseDTO = new CleanCmdResponseDTO(
                cmdId, 1L, CleanOrigin.MANUAL, CleanState.CANCELADO, 0, LocalDateTime.now(), "Bomba parada e confirmada com sucesso!"
        );
        when(cleanService.stopClean(eq(1L), eq(1L))).thenReturn(responseDTO);

        mockMvc.perform(post("/api/v1/currais/1/limpeza/parar")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(cmdId.toString()))
                .andExpect(jsonPath("$.state").value("CANCELADO"))
                .andExpect(jsonPath("$.mensagem").value("Bomba parada e confirmada com sucesso!"));
    }

    @Test
    @DisplayName("POST /api/v1/currais/{id}/parar rota alternativa retorna 200 OK")
    void stopClean_ViaParar_200() throws Exception {
        UUID cmdId = UUID.randomUUID();
        CleanCmdResponseDTO responseDTO = new CleanCmdResponseDTO(
                cmdId, 1L, CleanOrigin.MANUAL, CleanState.CANCELADO, 0, LocalDateTime.now(), "Bomba parada e confirmada com sucesso!"
        );
        when(cleanService.stopClean(eq(1L), eq(1L))).thenReturn(responseDTO);

        mockMvc.perform(post("/api/v1/currais/1/parar")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(cmdId.toString()))
                .andExpect(jsonPath("$.state").value("CANCELADO"));
    }

    @Test
    @DisplayName("POST /api/v1/currais/{id}/limpeza/parar retorna 404 quando curral não existe")
    void stopClean_NotFound_404() throws Exception {
        when(cleanService.stopClean(eq(999L), eq(1L)))
                .thenThrow(new EntityNotFoundException("Não foi encontrado este curral com ID: 999"));

        mockMvc.perform(post("/api/v1/currais/999/limpeza/parar"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.title").value("Recurso Não Encontrado"));
    }

    @Test
    @DisplayName("POST /api/v1/currais/{id}/limpeza/parar retorna 403 quando usuário não é proprietário")
    void stopClean_Forbidden_403() throws Exception {
        when(cleanService.stopClean(eq(1L), eq(1L)))
                .thenThrow(new SecurityException("Você não tem permissão para enviar comandos para esta fazenda"));

        mockMvc.perform(post("/api/v1/currais/1/limpeza/parar"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.title").value("Acesso Negado"));
    }

    @Test
    @DisplayName("POST /api/v1/currais/{id}/limpeza/parar retorna 409 quando dispositivo está offline")
    void stopClean_Conflict_409() throws Exception {
        when(cleanService.stopClean(eq(1L), eq(1L)))
                .thenThrow(new IllegalStateException("O dispositivo deste curral está offline ou sem comunicação recente, verifique a conexão antes de acionar a bomba"));

        mockMvc.perform(post("/api/v1/currais/1/limpeza/parar"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.title").value("Conflito de Regra de Negócio"));
    }

    @Test
    @DisplayName("GET /api/v1/currais/{id}/limpezas retorna 200 OK com histórico de acionamentos")
    void listCleanHistory_200() throws Exception {
        CleanCmdResponseDTO dto = new CleanCmdResponseDTO(
                UUID.randomUUID(), 1L, CleanOrigin.MANUAL, CleanState.CONCLUIDO, 15, LocalDateTime.now(), "OK"
        );
        when(cleanService.listCleanHistory(eq(1L), eq(1L))).thenReturn(List.of(dto));

        mockMvc.perform(get("/api/v1/currais/1/limpezas"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].secondsDuration").value(15));
    }
}
