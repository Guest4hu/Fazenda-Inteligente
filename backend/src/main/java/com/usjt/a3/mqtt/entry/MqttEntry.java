package com.usjt.a3.mqtt.entry;

import com.usjt.a3.config.mqtt.EntryTopics;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.integration.annotation.ServiceActivator;
import org.springframework.integration.mqtt.support.MqttHeaders;
import org.springframework.stereotype.Component;
import org.springframework.messaging.Message;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;


/**
 * Central inbound MQTT message router listening on {@code mqttInputChannel}.
 *
 * <p>Discovers all {@link CommandReceiveMqtt} beans at startup, indexes them by {@link EntryTopics},
 * parses incoming topic paths via {@link MqttTopics}, and dispatches payloads to the matching handler.</p>
 */
@Slf4j
@Component
public class MqttEntry {

    private final MqttTopics topics;
    private final Map<EntryTopics, CommandReceiveMqtt> handlers;

    /**
     * Builds the topic-to-handler dispatch map from all registered {@link CommandReceiveMqtt} strategy beans.
     *
     * @param topics MQTT topic parser
     * @param handlerList Spring-injected inbound MQTT topic handlers
     */
    public MqttEntry(MqttTopics topics, List<CommandReceiveMqtt> handlerList) {
        this.topics = topics;
        this.handlers = handlerList.stream()
                .collect(Collectors.toMap(CommandReceiveMqtt::topico, Function.
                        identity()));
    }

    /**
     * Routes an incoming Spring Integration MQTT message to its matching {@link CommandReceiveMqtt} handler.
     *
     * @param mensagem inbound Spring message carrying payload and {@link MqttHeaders#RECEIVED_TOPIC} header
     */
    @ServiceActivator(inputChannel = "mqttInputChannel")
    public void receber(Message<String> mensagem) {
        String topico = (String) mensagem.getHeaders().get(MqttHeaders.
                RECEIVED_TOPIC);

        topics.interpretar(topico).ifPresentOrElse(req -> {
            log.info("MQTT recebido | mac={} | tipo={} | payload={}",
                    req.mac(), req.tipo(), mensagem.getPayload());

            CommandReceiveMqtt handler = handlers.get(req.tipo());
            if (handler != null) {
                handler.tratar(req.mac(), mensagem.getPayload());
            } else {
                log.warn("Nenhum tratador registrado para o tipo {}", req.tipo());
            }
        }, () -> log.warn("MQTT ignorado (tópico inesperado): {}", topico));
    }
}
