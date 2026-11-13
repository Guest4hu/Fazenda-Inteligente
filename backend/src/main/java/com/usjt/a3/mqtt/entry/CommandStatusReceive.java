package com.usjt.a3.mqtt.entry;

import com.usjt.a3.config.mqtt.EntryTopics;
import com.usjt.a3.model.enums.DeviceStatus;
import com.usjt.a3.service.CorralService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Inbound MQTT handler for {@link EntryTopics#STATUS} controller connect/disconnect and Last-Will messages.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class CommandStatusReceive implements CommandReceiveMqtt {

    private final CorralService corralService;
    private final ObjectMapper objectMapper;

    @Override
    public EntryTopics topico() {
        return EntryTopics.STATUS;
    }

    /**
     * Reads {@code status} from JSON and delegates to {@link CorralService#updateDeviceStatus};
     * any value other than {@code ONLINE} is treated as {@link DeviceStatus#OFFLINE}.
     *
     * @param macAddress normalized controller MAC address extracted from the topic
     * @param payload raw JSON status payload
     */
    @Override
    public void tratar(String macAddress, String payload) {
        if (macAddress == null || macAddress.isBlank() || payload == null || payload.isBlank()) {
            log.warn("Mensagem de status ignorada: MAC ou payload vazio");
            return;
        }

        try {
            JsonNode root = objectMapper.readTree(payload);
            JsonNode statusNode = root.path("status");

            if (statusNode.isMissingNode() || statusNode.isNull()) {
                log.warn("Payload de status ignorado: campo 'status' ausente para o curral MAC {}", macAddress);
                return;
            }

            String statusStr = statusNode.asText("").trim().toUpperCase();
            DeviceStatus status = "ONLINE".equals(statusStr) ? DeviceStatus.ONLINE : DeviceStatus.OFFLINE;

            corralService.updateDeviceStatus(macAddress, status);
        } catch (Exception e) {
            log.error("Erro ao processar o payload de status do curral MAC {}: {}", macAddress, payload, e);
        }
    }
}
