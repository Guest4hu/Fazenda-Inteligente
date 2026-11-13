package com.usjt.a3.mqtt.dto;

import com.usjt.a3.config.mqtt.EntryTopics;

/**
 * Parsed inbound MQTT topic metadata containing the uppercased device MAC address and topic type.
 *
 * @param mac  normalized uppercased device MAC address extracted from the topic
 * @param tipo resolved inbound topic classification
 */
public record ParsedRequestDTO(String mac, EntryTopics tipo) {}
