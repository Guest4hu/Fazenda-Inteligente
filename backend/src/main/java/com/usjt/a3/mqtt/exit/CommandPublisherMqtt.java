package com.usjt.a3.mqtt.exit;

import com.usjt.a3.config.mqtt.MqttGateway;
import com.usjt.a3.config.mqtt.MqttProperties;
import com.usjt.a3.service.CommandPublisher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

import java.util.Map;
import java.util.UUID;

@Component
@RequiredArgsConstructor
@Slf4j
public class CommandPublisherMqtt implements CommandPublisher {

    private final MqttGateway mqttGateway;
    private final MqttProperties  mqttProperties;
    private final ObjectMapper objectMapper;


    @Override
    public void pumpAction(String macAddress, UUID commandId, Integer
            durationSeconds) {
        // 1. Monta o tópico dinâmico: {prefixo}/{MAC}/bomba/comando
        String topic = String.format("%s/%s/bomba/comando",
                mqttProperties.topicPrefix(),
                macAddress.toUpperCase()
        );

        // 2. Prepara os dados do payload
        Map<String, Object> payload = Map.of(
                "comandoId", commandId.toString(),
                "duracao", durationSeconds
        );

        try {
            // 3. Serializa para JSON
            String jsonPayload = objectMapper.writeValueAsString(payload);

            log.info("Publicando comando MQTT | Tópico: {} | Payload: {}", topic,
                    jsonPayload);

            // 4. Envia para o Gateway do Spring Integration
            mqttGateway.sendToMqtt(jsonPayload, topic);

        } catch (Exception e) {
            log.error("Erro ao converter comando MQTT em JSON para o curral {}",
                    macAddress, e);
            throw new IllegalStateException("Falha ao serializar mensagem MQTT",
                    e);
        }
    }
}
