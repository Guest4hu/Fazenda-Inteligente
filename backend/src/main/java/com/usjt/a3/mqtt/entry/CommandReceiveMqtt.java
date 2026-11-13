package com.usjt.a3.mqtt.entry;

import com.usjt.a3.config.mqtt.EntryTopics;

/**
 * Strategy contract for processing inbound MQTT messages belonging to a specific {@link EntryTopics} channel.
 */
public interface CommandReceiveMqtt {
    EntryTopics topico();

    void tratar(String macAddress, String payload);
}
