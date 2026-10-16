package com.usjt.a3.mqtt.dto;

import com.usjt.a3.config.mqtt.EntryTopics;

public record ParsedRequestDTO(String mac, EntryTopics tipo) {}
