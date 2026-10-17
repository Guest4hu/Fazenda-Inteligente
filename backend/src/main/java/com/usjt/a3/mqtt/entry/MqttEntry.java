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


@Slf4j
@Component
public class MqttEntry {

    private final MqttTopics topics;
    private final Map<EntryTopics, CommandReceiveMqtt> handlers;

    // O Spring injeta automaticamente todos os beans que implementam CommandReceiveMqtt!
    public MqttEntry(MqttTopics topics, List<CommandReceiveMqtt> handlerList) {
        this.topics = topics;
        this.handlers = handlerList.stream()
                .collect(Collectors.toMap(CommandReceiveMqtt::topico, Function.
                        identity()));
    }

    @ServiceActivator(inputChannel = "mqttInputChannel")
    public void receber(Message<String> mensagem) {
        String topico = (String) mensagem.getHeaders().get(MqttHeaders.
                RECEIVED_TOPIC);

        topics.interpretar(topico).ifPresentOrElse(req -> {
            log.info("MQTT recebido | mac={} | tipo={} | payload={}",
                    req.mac(), req.tipo(), mensagem.getPayload());

            // Procura o tratador do tipo (ex: CommandPumpAck para BOMBA_ACK)
            CommandReceiveMqtt handler = handlers.get(req.tipo());
            if (handler != null) {
                handler.tratar(req.mac(), mensagem.getPayload());
            } else {
                log.warn("Nenhum tratador registrado para o tipo {}", req.tipo());
            }
        }, () -> log.warn("MQTT ignorado (tópico inesperado): {}", topico));
    }
}
