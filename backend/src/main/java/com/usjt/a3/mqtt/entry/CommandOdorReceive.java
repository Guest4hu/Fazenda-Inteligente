package com.usjt.a3.mqtt.entry;

import com.usjt.a3.config.mqtt.EntryTopics;
import com.usjt.a3.service.OdorService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

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
            odorService.processTelemetry(macAddress, valor);
        } catch (Exception e) {
            log.error("Erro ao processar o payload de odor {}: {}", macAddress,  payload,e);
        }

    }
}
