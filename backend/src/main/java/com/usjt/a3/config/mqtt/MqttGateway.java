package com.usjt.a3.config.mqtt;

import org.springframework.integration.annotation.MessagingGateway;
import org.springframework.integration.mqtt.support.MqttHeaders;
import org.springframework.messaging.handler.annotation.Header;

@MessagingGateway(defaultRequestChannel = "mqttOutboundChannel")
public interface MqttGateway {
    void sendToMqtt(String payload, @Header(MqttHeaders.TOPIC) String topic);

    void sendToMqtt(
            String payload,
            @Header(MqttHeaders.TOPIC) String topic,
            @Header(MqttHeaders.QOS) int qos,
            @Header(MqttHeaders.RETAINED) boolean retained
    );
}
