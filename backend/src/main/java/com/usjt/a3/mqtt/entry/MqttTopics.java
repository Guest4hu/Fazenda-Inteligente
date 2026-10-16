package com.usjt.a3.mqtt.entry;

import java.util.Optional;

import com.usjt.a3.config.mqtt.MqttProperties;
import com.usjt.a3.config.mqtt.EntryTopics;
import com.usjt.a3.mqtt.dto.ParsedRequestDTO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class MqttTopics {

    private final MqttProperties properties;

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
        String sufixo = resto.substring(barra + 1);          // "odor/nivel"

        return EntryTopics.deSufixo(sufixo)
                .map(type -> new ParsedRequestDTO(mac, type));
    }
}