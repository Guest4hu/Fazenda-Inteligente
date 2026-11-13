package com.usjt.a3.mqtt.entry;

import java.util.Optional;

import com.usjt.a3.config.mqtt.MqttProperties;
import com.usjt.a3.config.mqtt.EntryTopics;
import com.usjt.a3.mqtt.dto.ParsedRequestDTO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Parses incoming MQTT topic paths structured as {@code <prefix>/<mac>/<suffix>} into {@link ParsedRequestDTO}.
 */
@Component
@RequiredArgsConstructor
public class MqttTopics {

    private final MqttProperties properties;

    /**
     * Extracts and uppercases the device MAC segment and matches the trailing suffix against {@link EntryTopics}.
     *
     * @param topico full MQTT topic received from the broker
     * @return parsed device MAC and topic enum, or empty if malformed or unrecognized
     */
    public Optional<ParsedRequestDTO> interpretar(String topico) {
        String inicio = properties.topicPrefix() + "/";
        if (topico == null || !topico.startsWith(inicio)) {
            return Optional.empty();
        }

        String resto = topico.substring(inicio.length());
        int barra = resto.indexOf('/');
        if (barra <= 0) {
            return Optional.empty();
        }

        String mac = resto.substring(0, barra).toUpperCase();
        String sufixo = resto.substring(barra + 1);

        return EntryTopics.deSufixo(sufixo)
                .map(type -> new ParsedRequestDTO(mac, type));
    }
}