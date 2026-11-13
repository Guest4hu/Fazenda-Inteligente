package com.usjt.a3.mqtt.entry;

import com.usjt.a3.config.mqtt.EntryTopics;
import com.usjt.a3.service.OdorService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Inbound MQTT handler for {@link EntryTopics#ODOR_NIVEL} gas and environmental telemetry payloads.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class CommandOdorReceive implements CommandReceiveMqtt {
    private final OdorService odorService;
    private final ObjectMapper objectMapper;
    @Override
    public EntryTopics topico() {
        return EntryTopics.ODOR_NIVEL;
    }

    /**
     * Parses JSON telemetry containing mandatory {@code valor} (ADC odor reading) and optional
     * {@code temperatura} and {@code umidade} fields, forwarding them to {@link OdorService#processTelemetry}.
     *
     * @param macAddress normalized controller MAC address extracted from the topic
     * @param payload raw JSON telemetry payload
     */
    @Override
    public void tratar(String macAddress, String payload) {
        try {
            JsonNode root = objectMapper.readTree(payload);
            JsonNode valorNode = root.path("valor");
            if (valorNode.isMissingNode() || valorNode.isNull()) {
                log.warn("Payload de odor ignorado valor ausente para o curral");
                return;
            }

            int valor = valorNode.asInt();
            Double temperatura = root.hasNonNull("temperatura") ? root.get("temperatura").asDouble() : null;
            Double umidade = root.hasNonNull("umidade") ? root.get("umidade").asDouble() : null;

            odorService.processTelemetry(macAddress, valor, temperatura, umidade);
        } catch (Exception e) {
            log.error("Erro ao processar o payload de odor {}: {}", macAddress,  payload,e);
        }

    }
}
