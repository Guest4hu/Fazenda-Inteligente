package com.usjt.a3.mqtt.entry;

import com.usjt.a3.config.mqtt.EntryTopics;
import com.usjt.a3.config.mqtt.MqttProperties;
import com.usjt.a3.repository.CorralRepository;
import com.usjt.a3.service.AnimalService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.integration.mqtt.support.MqttHeaders;
import org.springframework.messaging.support.MessageBuilder;
import tools.jackson.databind.ObjectMapper;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MqttEntryRfidIntegrationTest {

    @Mock
    private CorralRepository corralRepository;

    @Mock
    private AnimalService animalService;

    @Test
    void mqttEntryRoteiaParaCommandRfidLeituraSemDuplicidade() {
        MqttProperties properties = new MqttProperties("tcp://localhost:1883", "a3-usjt-fazenda-inteligente/curral", "teste");
        MqttTopics topics = new MqttTopics(properties);

        ObjectMapper objectMapper = new ObjectMapper();
        CommandRfidLeitura rfidHandler = spy(new CommandRfidLeitura(corralRepository, animalService, objectMapper));

        // Constrói MqttEntry passando a lista com CommandRfidLeitura
        MqttEntry mqttEntry = new MqttEntry(topics, List.of(rfidHandler));

        String topic = "a3-usjt-fazenda-inteligente/curral/240AC4000110/rfid/leitura";
        String payload = "{\"tagUid\":\"E2801160\",\"typeEvent\":\"ENTROU\"}";

        var message = MessageBuilder.withPayload(payload)
                .setHeader(MqttHeaders.RECEIVED_TOPIC, topic)
                .build();

        assertDoesNotThrow(() -> mqttEntry.receber(message));

        verify(rfidHandler).tratar(eq("240AC4000110"), eq(payload));
    }
}
