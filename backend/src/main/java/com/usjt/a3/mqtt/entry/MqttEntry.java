package com.usjt.a3.mqtt.entry;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.integration.annotation.ServiceActivator;
import org.springframework.integration.mqtt.support.MqttHeaders;
import org.springframework.stereotype.Component;
import org.springframework.messaging.Message;


@Slf4j
@Component
@RequiredArgsConstructor
public class MqttEntry {
    private final MqttTopics topics;

    @ServiceActivator(inputChannel = "mqttInputChannel")
    public void receber(Message<String> mensagem) {
        String topico = (String) mensagem.getHeaders().get(MqttHeaders.RECEIVED_TOPIC);

        topics.interpretar(topico).ifPresentOrElse(
                t -> log.info("MQTT recebido | mac={} | tipo={} | payload={}",
                        t.mac(), t.tipo(), mensagem.getPayload()),
                () -> log.warn("MQTT ignorado (tópico inesperado): {}", topico)
        );
    }
}
