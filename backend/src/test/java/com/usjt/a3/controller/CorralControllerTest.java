package com.usjt.a3.controller;

import com.usjt.a3.config.security.UserPrincipal;
import com.usjt.a3.dto.request.CorralParametersRequestDTO;
import com.usjt.a3.dto.request.CorralRequestDTO;
import com.usjt.a3.dto.response.CorralMetricsResponseDTO;
import com.usjt.a3.dto.response.CorralResponseDTO;
import com.usjt.a3.model.enums.DeviceStatus;
import com.usjt.a3.service.CorralService;
import com.usjt.a3.service.CorralSseService;
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
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.time.LocalDateTime;
import java.time.LocalTime;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(MockitoExtension.class)
class CorralControllerTest {

    @Mock
    private CorralService corralService;

    @Mock
    private CorralSseService corralSseService;

    @InjectMocks
    private CorralController corralController;

    private MockMvc mockMvc;
    private final UserPrincipal principal = TestFixtures.createPrincipal(1L);

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcTestHelper.buildMockMvc(corralController, principal);
    }

    @Test
    @DisplayName("PUT /api/v1/currais/{id} retorna 200 OK com curral atualizado")
    void updateCorral_DirectRoute_200() throws Exception {
        CorralResponseDTO responseDTO = new CorralResponseDTO(
                5L, 10L, "Curral 01", "240AC4000110", LocalTime.of(7, 30),
                350, 20, DeviceStatus.ONLINE, LocalDateTime.now()
        );
        when(corralService.updateCorral(eq(5L), isNull(), eq(1L), any(CorralRequestDTO.class))).thenReturn(responseDTO);

        mockMvc.perform(put("/api/v1/currais/5")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "name": "Curral 01",
                                    "macAddress": "240AC4000110",
                                    "cleanTime": "07:30:00",
                                    "limitOdor": 350,
                                    "pumpDurationSeconds": 20
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(5L))
                .andExpect(jsonPath("$.name").value("Curral 01"))
                .andExpect(jsonPath("$.macAddress").value("240AC4000110"));
    }

    @Test
    @DisplayName("PUT /api/v1/farms/{farmId}/currais/{id} retorna 200 OK (rota aninhada)")
    void updateCorral_NestedRoute_200() throws Exception {
        CorralResponseDTO responseDTO = new CorralResponseDTO(
                5L, 10L, "Curral 01", "240AC4000110", null,
                400, 30, DeviceStatus.ONLINE, LocalDateTime.now()
        );
        when(corralService.updateCorral(eq(5L), eq(10L), eq(1L), any(CorralRequestDTO.class))).thenReturn(responseDTO);

        mockMvc.perform(put("/api/v1/farms/10/currais/5")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "name": "Curral 01",
                                    "macAddress": "240AC4000110"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(5L));
    }

    @Test
    @DisplayName("PUT /api/v1/currais/{id} retorna 400 Bad Request com MAC fora do padrão")
    void updateCorral_400_InvalidMac() throws Exception {
        mockMvc.perform(put("/api/v1/currais/5")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "name": "Curral 01",
                                    "macAddress": "MAC_INVALIDO"
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Erro de Validação"))
                .andExpect(jsonPath("$.invalidParams.macAddress").exists());
    }

    @Test
    @DisplayName("PUT /api/v1/currais/{id} retorna 400 Bad Request quando pumpDurationSeconds > 60")
    void updateCorral_400_PumpDurationTooLong() throws Exception {
        mockMvc.perform(put("/api/v1/currais/5")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "name": "Curral 01",
                                    "macAddress": "240AC4000110",
                                    "pumpDurationSeconds": 120
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Erro de Validação"))
                .andExpect(jsonPath("$.invalidParams.pumpDurationSeconds").exists());
    }

    @Test
    @DisplayName("PUT /api/v1/currais/{id} retorna 403 Forbidden")
    void updateCorral_403() throws Exception {
        when(corralService.updateCorral(eq(5L), isNull(), eq(1L), any(CorralRequestDTO.class)))
                .thenThrow(new SecurityException("Você não tem permissão para editar este curral"));

        mockMvc.perform(put("/api/v1/currais/5")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "name": "Curral 01",
                                    "macAddress": "240AC4000110"
                                }
                                """))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.title").value("Acesso Negado"));
    }

    @Test
    @DisplayName("PUT /api/v1/currais/{id} retorna 404 Not Found")
    void updateCorral_404() throws Exception {
        when(corralService.updateCorral(eq(999L), isNull(), eq(1L), any(CorralRequestDTO.class)))
                .thenThrow(new EntityNotFoundException("Curral não encontrado"));

        mockMvc.perform(put("/api/v1/currais/999")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "name": "Curral 01",
                                    "macAddress": "240AC4000110"
                                }
                                """))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.title").value("Recurso Não Encontrado"));
    }

    @Test
    @DisplayName("PUT /api/v1/currais/{id} retorna 409 Conflict quando MAC já existe")
    void updateCorral_409() throws Exception {
        when(corralService.updateCorral(eq(5L), isNull(), eq(1L), any(CorralRequestDTO.class)))
                .thenThrow(new IllegalStateException("Já existe um curral cadastrado com este MAC"));

        mockMvc.perform(put("/api/v1/currais/5")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "name": "Curral 01",
                                    "macAddress": "240AC4000110"
                                }
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.title").value("Conflito de Regra de Negócio"));
    }

    @Test
    @DisplayName("DELETE /api/v1/currais/{id} retorna 204 No Content")
    void deleteCorral_204() throws Exception {
        doNothing().when(corralService).deleteCorral(5L, null, 1L);

        mockMvc.perform(delete("/api/v1/currais/5"))
                .andExpect(status().isNoContent());
    }

    @Test
    @DisplayName("DELETE /api/v1/farms/{farmId}/currais/{id} retorna 204 No Content (rota aninhada)")
    void deleteCorral_NestedRoute_204() throws Exception {
        doNothing().when(corralService).deleteCorral(5L, 10L, 1L);

        mockMvc.perform(delete("/api/v1/farms/10/currais/5"))
                .andExpect(status().isNoContent());
    }

    @Test
    @DisplayName("DELETE /api/v1/currais/{id} retorna 409 Conflict se há limpeza em andamento")
    void deleteCorral_409() throws Exception {
        doThrow(new IllegalStateException("Não é possível excluir o curral pois há uma limpeza em andamento"))
                .when(corralService).deleteCorral(5L, null, 1L);

        mockMvc.perform(delete("/api/v1/currais/5"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.title").value("Conflito de Regra de Negócio"));
    }

    @Test
    @DisplayName("GET /api/v1/currais/{id} retorna 200 OK")
    void getCorralById_200() throws Exception {
        CorralResponseDTO responseDTO = new CorralResponseDTO(
                5L, 10L, "Curral 01", "240AC4000110", null,
                400, 30, DeviceStatus.ONLINE, LocalDateTime.now()
        );
        when(corralService.getCorralById(eq(5L), isNull(), eq(1L))).thenReturn(responseDTO);

        mockMvc.perform(get("/api/v1/currais/5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(5L))
                .andExpect(jsonPath("$.name").value("Curral 01"));
    }

    @Test
    @DisplayName("PUT /api/v1/currais/{id}/parametros retorna 200 OK com parâmetros atualizados")
    void updateParameters_DirectRoute_200() throws Exception {
        CorralResponseDTO responseDTO = new CorralResponseDTO(
                5L, 10L, "Curral 01", "240AC4000110", LocalTime.of(8, 0),
                350, 25, DeviceStatus.ONLINE, LocalDateTime.now()
        );
        when(corralService.updateParameters(eq(5L), isNull(), eq(1L), any(CorralParametersRequestDTO.class)))
                .thenReturn(responseDTO);

        mockMvc.perform(put("/api/v1/currais/5/parametros")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "cleanTime": "08:00:00",
                                    "limitOdor": 350,
                                    "pumpDurationSeconds": 25
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(5L))
                .andExpect(jsonPath("$.cleanTime").value("08:00:00"))
                .andExpect(jsonPath("$.limitOdor").value(350))
                .andExpect(jsonPath("$.pumpDurationSeconds").value(25));
    }

    @Test
    @DisplayName("PUT /api/v1/farms/{farmId}/currais/{id}/parametros retorna 200 OK (rota aninhada)")
    void updateParameters_NestedRoute_200() throws Exception {
        CorralResponseDTO responseDTO = new CorralResponseDTO(
                5L, 10L, "Curral 01", "240AC4000110", null,
                400, 30, DeviceStatus.ONLINE, LocalDateTime.now()
        );
        when(corralService.updateParameters(eq(5L), eq(10L), eq(1L), any(CorralParametersRequestDTO.class)))
                .thenReturn(responseDTO);

        mockMvc.perform(put("/api/v1/farms/10/currais/5/parametros")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "cleanTime": null,
                                    "limitOdor": 400,
                                    "pumpDurationSeconds": 30
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(5L))
                .andExpect(jsonPath("$.cleanTime").isEmpty());
    }

    @Test
    @DisplayName("PUT /api/v1/currais/{id}/parametros retorna 400 quando pumpDurationSeconds > 60")
    void updateParameters_400_PumpDurationTooLong() throws Exception {
        mockMvc.perform(put("/api/v1/currais/5/parametros")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "limitOdor": 400,
                                    "pumpDurationSeconds": 61
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Erro de Validação"))
                .andExpect(jsonPath("$.invalidParams.pumpDurationSeconds").exists());
    }

    @Test
    @DisplayName("PUT /api/v1/currais/{id}/parametros retorna 400 quando pumpDurationSeconds <= 0")
    void updateParameters_400_PumpDurationZeroOrNegative() throws Exception {
        mockMvc.perform(put("/api/v1/currais/5/parametros")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "pumpDurationSeconds": 0
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Erro de Validação"))
                .andExpect(jsonPath("$.invalidParams.pumpDurationSeconds").exists());
    }

    @Test
    @DisplayName("PUT /api/v1/currais/{id}/parametros retorna 400 quando limitOdor é negativo")
    void updateParameters_400_NegativeLimitOdor() throws Exception {
        mockMvc.perform(put("/api/v1/currais/5/parametros")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "limitOdor": -5,
                                    "pumpDurationSeconds": 30
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Erro de Validação"))
                .andExpect(jsonPath("$.invalidParams.limitOdor").exists());
    }

    @Test
    @DisplayName("PUT /api/v1/currais/{id}/parametros retorna 403 Forbidden para usuário não proprietário")
    void updateParameters_403() throws Exception {
        when(corralService.updateParameters(eq(5L), isNull(), eq(1L), any(CorralParametersRequestDTO.class)))
                .thenThrow(new SecurityException("Você não tem permissão para editar os parâmetros deste curral"));

        mockMvc.perform(put("/api/v1/currais/5/parametros")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "limitOdor": 400,
                                    "pumpDurationSeconds": 30
                                }
                                """))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.title").value("Acesso Negado"));
    }

    @Test
    @DisplayName("PUT /api/v1/currais/{id}/parametros retorna 404 Not Found para curral inexistente")
    void updateParameters_404() throws Exception {
        when(corralService.updateParameters(eq(999L), isNull(), eq(1L), any(CorralParametersRequestDTO.class)))
                .thenThrow(new EntityNotFoundException("Curral não encontrado"));

        mockMvc.perform(put("/api/v1/currais/999/parametros")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "limitOdor": 400,
                                    "pumpDurationSeconds": 30
                                }
                                """))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.title").value("Recurso Não Encontrado"));
    }

    @Test
    @DisplayName("GET /api/v1/currais/{id}/metricas retorna 200 OK com todas as métricas agregadas")
    void getMetrics_DirectRoute_200() throws Exception {
        LocalDateTime lastSeen = LocalDateTime.of(2026, 10, 23, 15, 30, 0);
        CorralMetricsResponseDTO responseDTO = new CorralMetricsResponseDTO(
                5L,
                "Curral Principal",
                10L,
                "Fazenda Esperança",
                12L,
                45L,
                9L,
                3L,
                4L,
                2L,
                DeviceStatus.ONLINE,
                lastSeen,
                2L
        );

        when(corralService.getCorralMetrics(eq(5L), isNull(), eq(1L))).thenReturn(responseDTO);

        mockMvc.perform(get("/api/v1/currais/5/metricas"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.corralId").value(5L))
                .andExpect(jsonPath("$.corralName").value("Curral Principal"))
                .andExpect(jsonPath("$.farmId").value(10L))
                .andExpect(jsonPath("$.farmName").value("Fazenda Esperança"))
                .andExpect(jsonPath("$.totalAnimaisNoCurral").value(12))
                .andExpect(jsonPath("$.totalAnimaisNaFazenda").value(45))
                .andExpect(jsonPath("$.limpezasHojeTotal").value(9))
                .andExpect(jsonPath("$.limpezasHojeManual").value(3))
                .andExpect(jsonPath("$.limpezasHojeOdor").value(4))
                .andExpect(jsonPath("$.limpezasHojeAutomatica").value(2))
                .andExpect(jsonPath("$.deviceStatus").value("ONLINE"))
                .andExpect(jsonPath("$.pendenciasAbertas").value(2));
    }

    @Test
    @DisplayName("GET /api/v1/farms/{farmId}/currais/{id}/metricas (rota aninhada) retorna 200 OK")
    void getMetrics_NestedRoute_200() throws Exception {
        CorralMetricsResponseDTO responseDTO = new CorralMetricsResponseDTO(
                5L, "Curral 01", 10L, "Fazenda Esperança",
                0L, 0L, 0L, 0L, 0L, 0L, DeviceStatus.OFFLINE, null, 0L
        );
        when(corralService.getCorralMetrics(eq(5L), eq(10L), eq(1L))).thenReturn(responseDTO);

        mockMvc.perform(get("/api/v1/farms/10/currais/5/metricas"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.corralId").value(5L))
                .andExpect(jsonPath("$.deviceStatus").value("OFFLINE"));
    }

    @Test
    @DisplayName("GET /api/v1/currais/{id}/metricas de outro produtor retorna 403 Forbidden")
    void getMetrics_403_Forbidden() throws Exception {
        when(corralService.getCorralMetrics(eq(5L), isNull(), eq(1L)))
                .thenThrow(new SecurityException("Você não tem permissão para visualizar este curral"));

        mockMvc.perform(get("/api/v1/currais/5/metricas"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.title").value("Acesso Negado"));
    }

    @Test
    @DisplayName("GET /api/v1/currais/{id}/metricas para curral inexistente retorna 404 Not Found")
    void getMetrics_404_NotFound() throws Exception {
        when(corralService.getCorralMetrics(eq(999L), isNull(), eq(1L)))
                .thenThrow(new EntityNotFoundException("Curral não encontrado"));

        mockMvc.perform(get("/api/v1/currais/999/metricas"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.title").value("Recurso Não Encontrado"));
    }

    @Test
    @DisplayName("GET /api/v1/currais/{id}/stream retorna 200 OK com SseEmitter")
    void stream_DirectRoute_200() throws Exception {
        SseEmitter emitter = new SseEmitter(0L);
        when(corralSseService.subscribe(eq(5L), isNull(), eq(1L))).thenReturn(emitter);

        mockMvc.perform(get("/api/v1/currais/5/stream"))
                .andExpect(status().isOk());

        verify(corralSseService).subscribe(eq(5L), isNull(), eq(1L));
    }

    @Test
    @DisplayName("GET /api/v1/farms/{farmId}/currais/{id}/stream retorna 200 OK com SseEmitter")
    void stream_NestedRoute_200() throws Exception {
        SseEmitter emitter = new SseEmitter(0L);
        when(corralSseService.subscribe(eq(5L), eq(10L), eq(1L))).thenReturn(emitter);

        mockMvc.perform(get("/api/v1/farms/10/currais/5/stream"))
                .andExpect(status().isOk());

        verify(corralSseService).subscribe(eq(5L), eq(10L), eq(1L));
    }
}
