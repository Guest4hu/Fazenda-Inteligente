package com.usjt.a3.controller;

import com.usjt.a3.config.security.UserPrincipal;
import com.usjt.a3.dto.response.IdentifyPendencyResponseDTO;
import com.usjt.a3.model.enums.AnimalEventType;
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
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.List;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("Testes MockMvc - PendencyController (RFC 7807)")
class PendencyControllerTest {

    @Mock
    private IdentifyPendencyService identifyPendencyService;

    @InjectMocks
    private PendencyController pendencyController;

    private MockMvc mockMvc;
    private final UserPrincipal principal = TestFixtures.createPrincipal(1L);

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcTestHelper.buildMockMvc(pendencyController, principal);
    }

    // =========================================================================
    // 1. GET /api/v1/currais/{corralId}/pendencias (Listar Pendências Abertas)
    // =========================================================================
    @Nested
    @DisplayName("1. GET /api/v1/currais/{corralId}/pendencias")
    class ListOpenPendenciesRoutingTests {

        @Test
        @DisplayName("Rota direta retorna 200 OK com lista de pendências abertas")
        void list_DirectRoute_200() throws Exception {
            IdentifyPendencyResponseDTO dto1 = new IdentifyPendencyResponseDTO(
                    1L, 10L, "E2801160", AnimalEventType.ENTROU,
                    LocalDateTime.now(), false, null, null, null
            );
            IdentifyPendencyResponseDTO dto2 = new IdentifyPendencyResponseDTO(
                    2L, 10L, "A1B2C3D4", AnimalEventType.SAIU,
                    LocalDateTime.now(), false, null, null, null
            );

            when(identifyPendencyService.listOpenPendencies(eq(10L), isNull(), eq(1L)))
                    .thenReturn(List.of(dto1, dto2));

            mockMvc.perform(get("/api/v1/currais/10/pendencias"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.length()").value(2))
                    .andExpect(jsonPath("$[0].id").value(1L))
                    .andExpect(jsonPath("$[0].tagUid").value("E2801160"))
                    .andExpect(jsonPath("$[0].typeEvent").value("ENTROU"))
                    .andExpect(jsonPath("$[0].resolved").value(false))
                    .andExpect(jsonPath("$[1].id").value(2L))
                    .andExpect(jsonPath("$[1].tagUid").value("A1B2C3D4"));
        }

        @Test
        @DisplayName("Rota aninhada /api/v1/farms/{farmId}/currais/{corralId}/pendencias retorna 200 OK")
        void list_NestedRoute_200() throws Exception {
            IdentifyPendencyResponseDTO dto = new IdentifyPendencyResponseDTO(
                    1L, 10L, "E2801160", AnimalEventType.ENTROU,
                    LocalDateTime.now(), false, null, null, null
            );
            when(identifyPendencyService.listOpenPendencies(eq(10L), eq(5L), eq(1L)))
                    .thenReturn(List.of(dto));

            mockMvc.perform(get("/api/v1/farms/5/currais/10/pendencias"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.length()").value(1))
                    .andExpect(jsonPath("$[0].id").value(1L));
        }

        @Test
        @DisplayName("Retorna 403 Forbidden quando usuário não tiver permissão no curral")
        void list_403() throws Exception {
            when(identifyPendencyService.listOpenPendencies(eq(10L), isNull(), eq(1L)))
                    .thenThrow(new SecurityException("Você não tem permissão para visualizar pendências deste curral"));

            mockMvc.perform(get("/api/v1/currais/10/pendencias"))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.title").value("Acesso Negado"))
                    .andExpect(jsonPath("$.detail").value("Você não tem permissão para visualizar pendências deste curral"));
        }

        @Test
        @DisplayName("Retorna 404 Not Found quando curral não existir")
        void list_404() throws Exception {
            when(identifyPendencyService.listOpenPendencies(eq(999L), isNull(), eq(1L)))
                    .thenThrow(new EntityNotFoundException("Curral não encontrado"));

            mockMvc.perform(get("/api/v1/currais/999/pendencias"))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.title").value("Recurso Não Encontrado"))
                    .andExpect(jsonPath("$.detail").value("Curral não encontrado"));
        }
    }

    // =========================================================================
    // 2. POST & PUT /api/v1/pendencias/{pendencyId}/resolver (Resolução de Pendência)
    // =========================================================================
    @Nested
    @DisplayName("2. POST & PUT /api/v1/pendencias/{pendencyId}/resolver")
    class ResolvePendencyRoutingTests {

        @Test
        @DisplayName("POST /api/v1/pendencias/{id}/resolver retorna 200 OK com DTO resolvido")
        void resolve_Post_200() throws Exception {
            IdentifyPendencyResponseDTO responseDTO = new IdentifyPendencyResponseDTO(
                    50L, 10L, "E2801160", AnimalEventType.ENTROU,
                    LocalDateTime.now().minusHours(1), true, 20L, "Vaca Mimosa", LocalDateTime.now()
            );

            when(identifyPendencyService.resolvePendency(eq(50L), eq(20L), eq(1L)))
                    .thenReturn(responseDTO);

            mockMvc.perform(post("/api/v1/pendencias/50/resolver")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {
                                        "animalId": 20
                                    }
                                    """))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.id").value(50L))
                    .andExpect(jsonPath("$.resolved").value(true))
                    .andExpect(jsonPath("$.animalIdResolved").value(20L))
                    .andExpect(jsonPath("$.animalNameResolved").value("Vaca Mimosa"))
                    .andExpect(jsonPath("$.resolvedAt").exists());
        }

        @Test
        @DisplayName("PUT /api/v1/pendencias/{id}/resolver alias retorna 200 OK")
        void resolve_Put_200() throws Exception {
            IdentifyPendencyResponseDTO responseDTO = new IdentifyPendencyResponseDTO(
                    50L, 10L, "E2801160", AnimalEventType.ENTROU,
                    LocalDateTime.now().minusHours(1), true, 20L, "Vaca Mimosa", LocalDateTime.now()
            );

            when(identifyPendencyService.resolvePendency(eq(50L), eq(20L), eq(1L)))
                    .thenReturn(responseDTO);

            mockMvc.perform(put("/api/v1/pendencias/50/resolver")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {
                                        "animalId": 20
                                    }
                                    """))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.id").value(50L))
                    .andExpect(jsonPath("$.resolved").value(true));
        }

        @Test
        @DisplayName("Retorna 400 Bad Request quando animalId estiver ausente ou nulo")
        void resolve_400_MissingAnimalId() throws Exception {
            mockMvc.perform(post("/api/v1/pendencias/50/resolver")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {
                                    }
                                    """))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.title").value("Erro de Validação"))
                    .andExpect(jsonPath("$.invalidParams.animalId").exists());
        }

        @Test
        @DisplayName("Retorna 400 Bad Request quando corpo JSON for malformado")
        void resolve_400_MalformedJson() throws Exception {
            mockMvc.perform(post("/api/v1/pendencias/50/resolver")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {
                                        "animalId": "nao_numerico"
                                    }
                                    """))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.title").value("Corpo da Requisição Inválido"));
        }

        @Test
        @DisplayName("Retorna 403 Forbidden quando usuário não for dono do curral associado à pendência")
        void resolve_403() throws Exception {
            when(identifyPendencyService.resolvePendency(eq(50L), eq(20L), eq(1L)))
                    .thenThrow(new SecurityException("Você não tem permissão para resolver pendências deste curral"));

            mockMvc.perform(post("/api/v1/pendencias/50/resolver")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {
                                        "animalId": 20
                                    }
                                    """))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.title").value("Acesso Negado"));
        }

        @Test
        @DisplayName("Retorna 404 Not Found quando pendência ou animal não forem encontrados")
        void resolve_404() throws Exception {
            when(identifyPendencyService.resolvePendency(eq(999L), eq(20L), eq(1L)))
                    .thenThrow(new EntityNotFoundException("Pendência não encontrada"));

            mockMvc.perform(post("/api/v1/pendencias/999/resolver")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {
                                        "animalId": 20
                                    }
                                    """))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.title").value("Recurso Não Encontrado"));
        }

        @Test
        @DisplayName("Retorna 409 Conflict quando pendência já estiver resolvida ou animal pertencer a outra fazenda")
        void resolve_409() throws Exception {
            when(identifyPendencyService.resolvePendency(eq(50L), eq(20L), eq(1L)))
                    .thenThrow(new IllegalStateException("Esta pendência já foi resolvida anteriormente"));

            mockMvc.perform(post("/api/v1/pendencias/50/resolver")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {
                                        "animalId": 20
                                    }
                                    """))
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.title").value("Conflito de Regra de Negócio"))
                    .andExpect(jsonPath("$.detail").value("Esta pendência já foi resolvida anteriormente"));
        }
    }
}
