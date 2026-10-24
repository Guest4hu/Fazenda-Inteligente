package com.usjt.a3.mqtt.entry;

import com.usjt.a3.config.mqtt.EntryTopics;
import com.usjt.a3.dto.request.AnimalPresenceRequestDTO;
import com.usjt.a3.dto.response.AnimalEventResponseDTO;
import com.usjt.a3.model.entity.Corral;
import com.usjt.a3.model.entity.Farm;
import com.usjt.a3.model.entity.User;
import com.usjt.a3.model.enums.AnimalEventType;
import com.usjt.a3.model.enums.EventOrigin;
import com.usjt.a3.repository.CorralRepository;
import com.usjt.a3.service.AnimalService;
import com.usjt.a3.service.IdentifyPendencyService;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import tools.jackson.databind.ObjectMapper;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CommandRfidLeituraTest {

    @Mock
    private CorralRepository corralRepository;

    @Mock
    private AnimalService animalService;

    @Mock
    private IdentifyPendencyService identifyPendencyService;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private CommandRfidLeitura commandRfidLeitura;

    private Corral corral;
    private Farm farm;
    private User user;

    @BeforeEach
    void setUp() {
        commandRfidLeitura = new CommandRfidLeitura(corralRepository, animalService, identifyPendencyService, objectMapper);

        user = User.builder().id(1L).email("user@test.com").name("Produtor").build();
        farm = Farm.builder().id(2L).name("Fazenda Boa Esperança").user(user).build();
        corral = Corral.builder().id(3L).name("Curral Principal").macAddress("240AC4000110").farm(farm).build();
    }

    @Test
    void topicoDeveRetornarRfidLeitura() {
        assertEquals(EntryTopics.RFID_LEITURA, commandRfidLeitura.topico());
    }

    @Test
    void tratarSucessoEntrou() {
        when(corralRepository.findByMacAddress("240AC4000110")).thenReturn(Optional.of(corral));

        String payload = """
                {
                    "tagUid": "E2801160",
                    "typeEvent": "ENTROU"
                }
                """;

        commandRfidLeitura.tratar("240ac4000110", payload);

        ArgumentCaptor<AnimalPresenceRequestDTO> captor = ArgumentCaptor.forClass(AnimalPresenceRequestDTO.class);
        verify(animalService).registerPresence(eq(3L), eq(1L), captor.capture());

        AnimalPresenceRequestDTO dto = captor.getValue();
        assertEquals("E2801160", dto.tagUid());
        assertEquals(AnimalEventType.ENTROU, dto.typeEvent());
        assertEquals(EventOrigin.TAG, dto.origin());
    }

    @Test
    void tratarSucessoSaiu() {
        when(corralRepository.findByMacAddress("240AC4000110")).thenReturn(Optional.of(corral));

        String payload = """
                {
                    "tagUid": "A1B2C3D4",
                    "typeEvent": "SAIU"
                }
                """;

        commandRfidLeitura.tratar("240AC4000110", payload);

        ArgumentCaptor<AnimalPresenceRequestDTO> captor = ArgumentCaptor.forClass(AnimalPresenceRequestDTO.class);
        verify(animalService).registerPresence(eq(3L), eq(1L), captor.capture());

        AnimalPresenceRequestDTO dto = captor.getValue();
        assertEquals("A1B2C3D4", dto.tagUid());
        assertEquals(AnimalEventType.SAIU, dto.typeEvent());
        assertEquals(EventOrigin.TAG, dto.origin());
    }

    @Test
    void tratarSucessoComCamposAlternativosTagEEventoEntrada() {
        when(corralRepository.findByMacAddress("240AC4000110")).thenReturn(Optional.of(corral));

        String payload = """
                {
                    "tag": "E2801160",
                    "evento": "ENTRADA"
                }
                """;

        commandRfidLeitura.tratar("240AC4000110", payload);

        ArgumentCaptor<AnimalPresenceRequestDTO> captor = ArgumentCaptor.forClass(AnimalPresenceRequestDTO.class);
        verify(animalService).registerPresence(eq(3L), eq(1L), captor.capture());

        AnimalPresenceRequestDTO dto = captor.getValue();
        assertEquals("E2801160", dto.tagUid());
        assertEquals(AnimalEventType.ENTROU, dto.typeEvent());
        assertEquals(EventOrigin.TAG, dto.origin());
    }

    @Test
    void tratarSucessoComCamposAlternativosTagUidEEventSaida() {
        when(corralRepository.findByMacAddress("240AC4000110")).thenReturn(Optional.of(corral));

        String payload = """
                {
                    "tag_uid": "E2801160",
                    "event": "SAIDA"
                }
                """;

        commandRfidLeitura.tratar("240AC4000110", payload);

        ArgumentCaptor<AnimalPresenceRequestDTO> captor = ArgumentCaptor.forClass(AnimalPresenceRequestDTO.class);
        verify(animalService).registerPresence(eq(3L), eq(1L), captor.capture());

        AnimalPresenceRequestDTO dto = captor.getValue();
        assertEquals("E2801160", dto.tagUid());
        assertEquals(AnimalEventType.SAIU, dto.typeEvent());
        assertEquals(EventOrigin.TAG, dto.origin());
    }

    @Test
    void tratarMacNuloOuVazio() {
        commandRfidLeitura.tratar(null, "{\"tagUid\":\"E2801160\",\"typeEvent\":\"ENTROU\"}");
        commandRfidLeitura.tratar("", "{\"tagUid\":\"E2801160\",\"typeEvent\":\"ENTROU\"}");
        commandRfidLeitura.tratar("   ", "{\"tagUid\":\"E2801160\",\"typeEvent\":\"ENTROU\"}");

        verifyNoInteractions(corralRepository);
        verifyNoInteractions(animalService);
    }

    @Test
    void tratarPayloadNuloOuVazio() {
        commandRfidLeitura.tratar("240AC4000110", null);
        commandRfidLeitura.tratar("240AC4000110", "");
        commandRfidLeitura.tratar("240AC4000110", "   ");

        verifyNoInteractions(corralRepository);
        verifyNoInteractions(animalService);
    }

    @Test
    void tratarJsonInvalido() {
        assertDoesNotThrow(() -> commandRfidLeitura.tratar("240AC4000110", "{ invalid-json: "));

        verifyNoInteractions(corralRepository);
        verifyNoInteractions(animalService);
    }

    @Test
    void tratarTagUidAusente() {
        String payload = """
                {
                    "typeEvent": "ENTROU"
                }
                """;

        commandRfidLeitura.tratar("240AC4000110", payload);

        verifyNoInteractions(corralRepository);
        verifyNoInteractions(animalService);
    }

    @Test
    void tratarTypeEventAusente() {
        String payload = """
                {
                    "tagUid": "E2801160"
                }
                """;

        commandRfidLeitura.tratar("240AC4000110", payload);

        verifyNoInteractions(corralRepository);
        verifyNoInteractions(animalService);
    }

    @Test
    void tratarTypeEventInvalido() {
        String payload = """
                {
                    "tagUid": "E2801160",
                    "typeEvent": "VOOU_PELO_CURRAL"
                }
                """;

        commandRfidLeitura.tratar("240AC4000110", payload);

        verifyNoInteractions(corralRepository);
        verifyNoInteractions(animalService);
    }

    @Test
    void tratarCurralNaoEncontrado() {
        when(corralRepository.findByMacAddress("240AC4000110")).thenReturn(Optional.empty());

        String payload = """
                {
                    "tagUid": "E2801160",
                    "typeEvent": "ENTROU"
                }
                """;

        assertDoesNotThrow(() -> commandRfidLeitura.tratar("240AC4000110", payload));

        verify(corralRepository).findByMacAddress("240AC4000110");
        verifyNoInteractions(animalService);
    }

    @Test
    void tratarCurralSemFazenda() {
        Corral curralSemFazenda = Corral.builder().id(99L).macAddress("240AC4000110").farm(null).build();
        when(corralRepository.findByMacAddress("240AC4000110")).thenReturn(Optional.of(curralSemFazenda));

        String payload = """
                {
                    "tagUid": "E2801160",
                    "typeEvent": "ENTROU"
                }
                """;

        assertDoesNotThrow(() -> commandRfidLeitura.tratar("240AC4000110", payload));

        verifyNoInteractions(animalService);
    }

    @Test
    void tratarCurralSemUsuarioNaFazenda() {
        Farm fazendaSemUser = Farm.builder().id(12L).name("Sem Dono").user(null).build();
        Corral curralComFazendaSemUser = Corral.builder().id(99L).macAddress("240AC4000110").farm(fazendaSemUser).build();
        when(corralRepository.findByMacAddress("240AC4000110")).thenReturn(Optional.of(curralComFazendaSemUser));

        String payload = """
                {
                    "tagUid": "E2801160",
                    "typeEvent": "ENTROU"
                }
                """;

        assertDoesNotThrow(() -> commandRfidLeitura.tratar("240AC4000110", payload));

        verifyNoInteractions(animalService);
    }

    @Test
    void tratarEntityNotFoundExceptionNoAnimalService() {
        when(corralRepository.findByMacAddress("240AC4000110")).thenReturn(Optional.of(corral));
        when(animalService.registerPresence(anyLong(), anyLong(), any(AnimalPresenceRequestDTO.class)))
                .thenThrow(new EntityNotFoundException("Nenhum animal cadastrado com a Tag RFID: E2801160"));

        String payload = """
                {
                    "tagUid": "E2801160",
                    "typeEvent": "ENTROU"
                }
                """;

        assertDoesNotThrow(() -> commandRfidLeitura.tratar("240AC4000110", payload));

        verify(animalService).registerPresence(eq(3L), eq(1L), any(AnimalPresenceRequestDTO.class));
        verify(identifyPendencyService).createPendency(eq(corral), eq("E2801160"), eq(AnimalEventType.ENTROU));
    }

    @Test
    void tratarTagDesconhecidaComEventoSaiuCriaPendenciaComTipoSaiu() {
        when(corralRepository.findByMacAddress("240AC4000110")).thenReturn(Optional.of(corral));
        when(animalService.registerPresence(anyLong(), anyLong(), any(AnimalPresenceRequestDTO.class)))
                .thenThrow(new EntityNotFoundException("Nenhum animal cadastrado"));

        String payload = """
                {
                    "tagUid": "UNKNOWN_TAG_99",
                    "typeEvent": "SAIU"
                }
                """;

        commandRfidLeitura.tratar("240AC4000110", payload);

        verify(identifyPendencyService).createPendency(eq(corral), eq("UNKNOWN_TAG_99"), eq(AnimalEventType.SAIU));
    }

    @Test
    void tratarTagDesconhecidaEmMinusculasNormalizaParaMaiusculasNaPendencia() {
        when(corralRepository.findByMacAddress("240AC4000110")).thenReturn(Optional.of(corral));
        when(animalService.registerPresence(anyLong(), anyLong(), any(AnimalPresenceRequestDTO.class)))
                .thenThrow(new EntityNotFoundException("Nenhum animal cadastrado"));

        String payload = """
                {
                    "tagUid": "e2801160ab",
                    "typeEvent": "ENTROU"
                }
                """;

        commandRfidLeitura.tratar("240AC4000110", payload);

        verify(identifyPendencyService).createPendency(eq(corral), eq("E2801160AB"), eq(AnimalEventType.ENTROU));
    }

    @Test
    void tratarTagConhecidaComSucessoNaoCriaPendencia() {
        when(corralRepository.findByMacAddress("240AC4000110")).thenReturn(Optional.of(corral));

        String payload = """
                {
                    "tagUid": "E2801160",
                    "typeEvent": "ENTROU"
                }
                """;

        commandRfidLeitura.tratar("240AC4000110", payload);

        verify(animalService).registerPresence(eq(3L), eq(1L), any(AnimalPresenceRequestDTO.class));
        verifyNoInteractions(identifyPendencyService);
    }

    @Test
    void tratarFalhaAoCriarPendenciaNaoDerrubaThreadMqtt() {
        when(corralRepository.findByMacAddress("240AC4000110")).thenReturn(Optional.of(corral));
        when(animalService.registerPresence(anyLong(), anyLong(), any(AnimalPresenceRequestDTO.class)))
                .thenThrow(new EntityNotFoundException("Nenhum animal"));
        when(identifyPendencyService.createPendency(any(), any(), any()))
                .thenThrow(new RuntimeException("Falha de IO no banco"));

        String payload = """
                {
                    "tagUid": "E2801160",
                    "typeEvent": "ENTROU"
                }
                """;

        assertDoesNotThrow(() -> commandRfidLeitura.tratar("240AC4000110", payload));
        verify(identifyPendencyService).createPendency(eq(corral), eq("E2801160"), eq(AnimalEventType.ENTROU));
    }

    @Test
    void tratarSecurityExceptionNoAnimalService() {
        when(corralRepository.findByMacAddress("240AC4000110")).thenReturn(Optional.of(corral));
        when(animalService.registerPresence(anyLong(), anyLong(), any(AnimalPresenceRequestDTO.class)))
                .thenThrow(new SecurityException("Você não tem permissão"));

        String payload = """
                {
                    "tagUid": "E2801160",
                    "typeEvent": "ENTROU"
                }
                """;

        assertDoesNotThrow(() -> commandRfidLeitura.tratar("240AC4000110", payload));

        verify(animalService).registerPresence(eq(3L), eq(1L), any(AnimalPresenceRequestDTO.class));
    }

    @Test
    void tratarGenericExceptionNoAnimalService() {
        when(corralRepository.findByMacAddress("240AC4000110")).thenReturn(Optional.of(corral));
        when(animalService.registerPresence(anyLong(), anyLong(), any(AnimalPresenceRequestDTO.class)))
                .thenThrow(new RuntimeException("Falha inesperada no banco"));

        String payload = """
                {
                    "tagUid": "E2801160",
                    "typeEvent": "ENTROU"
                }
                """;

        assertDoesNotThrow(() -> commandRfidLeitura.tratar("240AC4000110", payload));

        verify(animalService).registerPresence(eq(3L), eq(1L), any(AnimalPresenceRequestDTO.class));
    }

    @Test
    void testCommandAnimalRFIDTagCompatibility() {
        CommandAnimalRFIDTag legacyHandler = new CommandAnimalRFIDTag(corralRepository, animalService, objectMapper);
        assertEquals(EntryTopics.RFID_LEITURA, legacyHandler.topico());

        when(corralRepository.findByMacAddress("240AC4000110")).thenReturn(Optional.of(corral));
        String payload = "{\"tagUid\":\"E2801160\",\"typeEvent\":\"ENTROU\"}";
        legacyHandler.tratar("240AC4000110", payload);

        verify(animalService).registerPresence(eq(3L), eq(1L), any(AnimalPresenceRequestDTO.class));
    }

    @Test
    void tratarMacComDoisPontosEHifens() {
        when(corralRepository.findByMacAddress("240AC4000110")).thenReturn(Optional.of(corral));

        String payload = "{\"tagUid\":\"E2801160\",\"typeEvent\":\"ENTROU\"}";
        commandRfidLeitura.tratar("24:0a:c4:00:01:10", payload);
        commandRfidLeitura.tratar("24-0A-C4-00-01-10", payload);

        verify(corralRepository, times(2)).findByMacAddress("240AC4000110");
        verify(animalService, times(2)).registerPresence(eq(3L), eq(1L), any(AnimalPresenceRequestDTO.class));
    }

    @Test
    void tratarMacApenasDelimitadores() {
        commandRfidLeitura.tratar("::--::", "{\"tagUid\":\"E2801160\",\"typeEvent\":\"ENTROU\"}");

        verifyNoInteractions(corralRepository);
        verifyNoInteractions(animalService);
    }

    @Test
    void tratarPayloadJsonArrayOuScalarNaoObjeto() {
        commandRfidLeitura.tratar("240AC4000110", "[1, 2, 3]");
        commandRfidLeitura.tratar("240AC4000110", "\"apenas um texto\"");
        commandRfidLeitura.tratar("240AC4000110", "12345");

        verifyNoInteractions(corralRepository);
        verifyNoInteractions(animalService);
    }

    @Test
    void tratarTagUidComValorJsonNull() {
        commandRfidLeitura.tratar("240AC4000110", "{\"tagUid\": null, \"typeEvent\": \"ENTROU\"}");

        verifyNoInteractions(corralRepository);
        verifyNoInteractions(animalService);
    }

    @Test
    void tratarTagUidMinusculaNormalizadaParaMaiuscula() {
        when(corralRepository.findByMacAddress("240AC4000110")).thenReturn(Optional.of(corral));

        commandRfidLeitura.tratar("240AC4000110", "{\"tagUid\": \"e2801160\", \"typeEvent\": \"ENTROU\"}");

        ArgumentCaptor<AnimalPresenceRequestDTO> captor = ArgumentCaptor.forClass(AnimalPresenceRequestDTO.class);
        verify(animalService).registerPresence(eq(3L), eq(1L), captor.capture());
        assertEquals("E2801160", captor.getValue().tagUid());
    }

    @Test
    void tratarEventosNumericosEBooleanos() {
        when(corralRepository.findByMacAddress("240AC4000110")).thenReturn(Optional.of(corral));

        // 1 -> ENTROU
        commandRfidLeitura.tratar("240AC4000110", "{\"tagUid\": \"E2801160\", \"typeEvent\": 1}");
        // 0 -> SAIU
        commandRfidLeitura.tratar("240AC4000110", "{\"tagUid\": \"E2801160\", \"typeEvent\": 0}");
        // true -> ENTROU
        commandRfidLeitura.tratar("240AC4000110", "{\"tagUid\": \"E2801160\", \"typeEvent\": true}");
        // false -> SAIU
        commandRfidLeitura.tratar("240AC4000110", "{\"tagUid\": \"E2801160\", \"typeEvent\": false}");

        ArgumentCaptor<AnimalPresenceRequestDTO> captor = ArgumentCaptor.forClass(AnimalPresenceRequestDTO.class);
        verify(animalService, times(4)).registerPresence(eq(3L), eq(1L), captor.capture());

        var dtos = captor.getAllValues();
        assertEquals(AnimalEventType.ENTROU, dtos.get(0).typeEvent());
        assertEquals(AnimalEventType.SAIU, dtos.get(1).typeEvent());
        assertEquals(AnimalEventType.ENTROU, dtos.get(2).typeEvent());
        assertEquals(AnimalEventType.SAIU, dtos.get(3).typeEvent());
    }

    @Test
    void tratarEventosAlternativosInglesEnterEExit() {
        when(corralRepository.findByMacAddress("240AC4000110")).thenReturn(Optional.of(corral));

        commandRfidLeitura.tratar("240AC4000110", "{\"tag\": \"E2801160\", \"event\": \"ENTER\"}");
        commandRfidLeitura.tratar("240AC4000110", "{\"uid\": \"E2801160\", \"event\": \"EXIT\"}");
        commandRfidLeitura.tratar("240AC4000110", "{\"rfid\": \"E2801160\", \"event\": \"LEAVE\"}");

        ArgumentCaptor<AnimalPresenceRequestDTO> captor = ArgumentCaptor.forClass(AnimalPresenceRequestDTO.class);
        verify(animalService, times(3)).registerPresence(eq(3L), eq(1L), captor.capture());

        var dtos = captor.getAllValues();
        assertEquals(AnimalEventType.ENTROU, dtos.get(0).typeEvent());
        assertEquals(AnimalEventType.SAIU, dtos.get(1).typeEvent());
        assertEquals(AnimalEventType.SAIU, dtos.get(2).typeEvent());
    }

    @Test
    void tratarIllegalStateExceptionNoAnimalService() {
        when(corralRepository.findByMacAddress("240AC4000110")).thenReturn(Optional.of(corral));
        doThrow(new IllegalStateException("Conflito de estado de animal"))
                .when(animalService).registerPresence(anyLong(), anyLong(), any(AnimalPresenceRequestDTO.class));

        assertDoesNotThrow(() -> commandRfidLeitura.tratar("240AC4000110", "{\"tagUid\":\"E2801160\",\"typeEvent\":\"ENTROU\"}"));

        verify(animalService).registerPresence(eq(3L), eq(1L), any(AnimalPresenceRequestDTO.class));
    }
}
