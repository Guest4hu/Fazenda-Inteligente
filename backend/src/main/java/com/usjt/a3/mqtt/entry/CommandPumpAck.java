package com.usjt.a3.mqtt.entry;

import com.usjt.a3.config.mqtt.EntryTopics;
import com.usjt.a3.model.enums.ComandResult;
import com.usjt.a3.service.AckService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.util.UUID;

/**
 * Inbound MQTT handler for {@link EntryTopics#BOMBA_ACK} hardware command execution confirmations.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class CommandPumpAck implements CommandReceiveMqtt {

    private final AckService ackService;
    private final ObjectMapper objectMapper;

    @Override
    public EntryTopics topico() {
        return EntryTopics.BOMBA_ACK;
    }

    /**
     * Parses {@code comandoId} and {@code status} from the ESP32 acknowledgment JSON and wakes the waiting
     * {@link AckService} thread; {@code OK} and {@code SUCCESS} map to {@link ComandResult#SUCCESS}, all other
     * values map to {@link ComandResult#FAILED}.
     *
     * @param macAddress normalized controller MAC address extracted from the topic
     * @param payload raw JSON acknowledgment payload
     */
    @Override
    public void tratar(String macAddress, String payload) {
        try {
            JsonNode root = objectMapper.readTree(payload);
            String comandoIdStr = root.path("comandoId").asText(null);
            String statusStr = root.path("status").asText("");

            if (comandoIdStr == null) {
                log.warn("ACK ignorado: payload sem 'comandoId' para o curral {}", macAddress);
                return;
            }

            UUID comandoId = UUID.fromString(comandoIdStr);
            ComandResult result = ("OK".equalsIgnoreCase(statusStr) || "SUCCESS".
                    equalsIgnoreCase(statusStr))
                    ? ComandResult.SUCCESS
                    : ComandResult.FAILED;

            log.info("Processando ACK da bomba | Curral MAC: {} | Comando: {} | Resultado: {}", macAddress, comandoId, result);

            ackService.resolvedAck(comandoId, macAddress, result);

        } catch (Exception e) {
            log.error("Erro ao processar payload de ACK do curral {}: {}", macAddress, payload, e);
        }
    }
}