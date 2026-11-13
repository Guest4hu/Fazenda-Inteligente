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

/**
 * MQTT implementation of {@link CommandPublisher} dispatching pump activation and emergency-stop JSON
 * commands to {@code <prefix>/<MAC>/bomba/comando}.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class CommandPublisherMqtt implements CommandPublisher {

    private final MqttGateway mqttGateway;
    private final MqttProperties  mqttProperties;
    private final ObjectMapper objectMapper;


    /**
     * Serializes and publishes a pump start payload ({@code comandoId}, {@code duracao}, defaulting to 30s)
     * to the controller's {@code bomba/comando} topic.
     *
     * @param macAddress target controller MAC address (normalized without {@code :} or {@code -})
     * @param commandId correlation UUID later echoed in {@code bomba/ack}
     * @param durationSeconds activation window in seconds
     */
    @Override
    public void pumpAction(String macAddress, UUID commandId, Integer
            durationSeconds) {
        String cleanMac = macAddress != null ? macAddress.replace(":", "").replace("-", "").trim().toUpperCase() : "";
        String topic = String.format("%s/%s/bomba/comando",
                mqttProperties.topicPrefix(),
                cleanMac
        );

        int safeDuration = durationSeconds != null ? durationSeconds : 30;

        Map<String, Object> payload = Map.of(
                "comandoId", commandId.toString(),
                "duracao", safeDuration
        );

        try {
            String jsonPayload = objectMapper.writeValueAsString(payload);

            log.info("Publicando comando MQTT | Tópico: {} | Payload: {}", topic,
                    jsonPayload);

            mqttGateway.sendToMqtt(jsonPayload, topic);

        } catch (Exception e) {
            log.error("Erro ao converter comando MQTT em JSON para o curral {}",
                    macAddress, e);
            throw new IllegalStateException("Falha ao serializar mensagem MQTT",
                    e);
        }
    }

    /**
     * Publishes an immediate pump shutoff payload ({@code comandoId}, {@code acao: "PARAR"}, {@code duracao: 0})
     * to the controller's {@code bomba/comando} topic.
     *
     * @param macAddress target controller MAC address
     * @param commandId correlation UUID for stop acknowledgment tracking
     */
    @Override
    public void stopPump(String macAddress, UUID commandId) {
        String cleanMac = macAddress != null ? macAddress.replace(":", "").replace("-", "").trim().toUpperCase() : "";
        String topic = String.format("%s/%s/bomba/comando",
                mqttProperties.topicPrefix(),
                cleanMac
        );

        Map<String, Object> payload = Map.of(
                "comandoId", commandId.toString(),
                "acao", "PARAR",
                "duracao", 0
        );

        try {
            String jsonPayload = objectMapper.writeValueAsString(payload);
            log.info("Publicando comando MQTT de parada | Tópico: {} | Payload: {}", topic, jsonPayload);
            mqttGateway.sendToMqtt(jsonPayload, topic);
        } catch (Exception e) {
            log.error("Erro ao converter comando MQTT de parada em JSON para o curral {}", macAddress, e);
            throw new IllegalStateException("Falha ao serializar mensagem MQTT de parada", e);
        }
    }
}
