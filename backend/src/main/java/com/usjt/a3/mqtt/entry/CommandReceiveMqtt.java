package com.usjt.a3.mqtt.entry;

import com.usjt.a3.config.mqtt.EntryTopics;

public interface CommandReceiveMqtt {
    EntryTopics topico();

    void tratar(String macAddress, String payload);
}
