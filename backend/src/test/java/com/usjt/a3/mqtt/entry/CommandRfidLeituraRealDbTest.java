package com.usjt.a3.mqtt.entry;

import com.usjt.a3.model.entity.Animal;
import com.usjt.a3.model.entity.AnimalEvent;
import com.usjt.a3.model.enums.AnimalEventType;
import com.usjt.a3.model.enums.EventOrigin;
import com.usjt.a3.repository.AnimalEventRepository;
import com.usjt.a3.repository.AnimalRepository;
import com.usjt.a3.service.CleanService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.junit.jupiter.api.MethodOrderer;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class CommandRfidLeituraRealDbTest {

    @Autowired
    private CommandRfidLeitura commandRfidLeitura;

    @Autowired
    private AnimalRepository animalRepository;

    @Autowired
    private AnimalEventRepository animalEventRepository;

    @Autowired
    private CleanService cleanService;

    private static final String MAC_CURRAL_1 = "240AC4000220";
    private static final String TAG_VACA_MIMOSA = "E2801160";

    @Test
    @Order(1)
    @DisplayName("Processa saída de vaca via RFID, limpando current_corral_id no PostgreSQL e gravando AnimalEvent")
    void testarRfidLeituraSaiuAtualizaBancoEDestravaLimpeza() {
        String payloadSaiu = """
                {
                    "tagUid": "%s",
                    "typeEvent": "SAIU"
                }
                """.formatted(TAG_VACA_MIMOSA);

        assertDoesNotThrow(() -> commandRfidLeitura.tratar(MAC_CURRAL_1, payloadSaiu));

        Animal animal = animalRepository.findByTagUid(TAG_VACA_MIMOSA).orElseThrow();
        assertNull(animal.getCurrentCorral(), "O animal deve estar fora do curral (currentCorral == null)");

        List<AnimalEvent> eventos = animalEventRepository.findByCorralIdOrderByInstantDesc(1L);
        assertFalse(eventos.isEmpty(), "Deve existir registro na tabela animal_event");
        AnimalEvent ultimoEvento = eventos.get(0);
        assertEquals(AnimalEventType.SAIU, ultimoEvento.getTypeEvent());
        assertEquals(EventOrigin.TAG, ultimoEvento.getEventOrigin());
        assertEquals(TAG_VACA_MIMOSA, ultimoEvento.getAnimal().getTagUid());

        assertFalse(animalRepository.existsByCurrentCorralId(1L), "A trava biológica deve estar liberada!");
    }

    @Test
    @Order(2)
    @DisplayName("Processa entrada de vaca com MAC delimitado por dois-pontos, atualizando curral e acionando trava biológica")
    void testarRfidLeituraEntrouAtualizaBancoETravaLimpeza() {
        String payloadEntrou = """
                {
                    "tag": "%s",
                    "evento": "ENTROU"
                }
                """.formatted(TAG_VACA_MIMOSA);

        String macComDoisPontos = "24:0A:C4:00:02:20";
        assertDoesNotThrow(() -> commandRfidLeitura.tratar(macComDoisPontos, payloadEntrou));

        Animal animal = animalRepository.findByTagUid(TAG_VACA_MIMOSA).orElseThrow();
        assertNotNull(animal.getCurrentCorral(), "O animal deve estar dentro do curral");
        assertEquals(1L, animal.getCurrentCorral().getId());

        assertTrue(animalRepository.existsByCurrentCorralId(1L), "A trava biológica deve estar ativada!");

        IllegalStateException ex = assertThrows(IllegalStateException.class, () ->
                cleanService.triggerManualClean(1L, 1L, null)
        );
        assertTrue(ex.getMessage().contains("Tem uma vaca no curral"), "Limpeza deve ser terminantemente bloqueada");
    }

    @Test
    @Order(3)
    @DisplayName("Garante resiliência ao receber leitura de tag não cadastrada sem derrubar a aplicação")
    void testarRfidLeituraTagDesconhecidaNaoQuebraSistema() {
        String payload = """
                {
                    "tagUid": "TAG_INEXISTENTE_9999",
                    "typeEvent": "ENTROU"
                }
                """;

        assertDoesNotThrow(() -> commandRfidLeitura.tratar(MAC_CURRAL_1, payload));
    }

    @Test
    @Order(4)
    @DisplayName("Garante resiliência ao receber leitura de curral não cadastrado sem lançar exceção")
    void testarRfidLeituraMacInexistenteNaoQuebraSistema() {
        String payload = """
                {
                    "tagUid": "%s",
                    "typeEvent": "ENTROU"
                }
                """.formatted(TAG_VACA_MIMOSA);

        assertDoesNotThrow(() -> commandRfidLeitura.tratar("FFFFFFFFFFFF", payload));
    }

    @AfterEach
    void tearDown() {
        animalRepository.findByTagUid(TAG_VACA_MIMOSA).ifPresent(animal -> {
            animal.setCurrentCorral(null);
            animalRepository.save(animal);
        });
    }
}
