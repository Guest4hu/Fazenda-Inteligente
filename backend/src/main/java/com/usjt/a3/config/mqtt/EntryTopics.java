package com.usjt.a3.config.mqtt;

import java.util.Arrays;
import java.util.Optional;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * Inbound MQTT topic suffixes emitted by smart corral ESP32 devices.
 */
@Getter
@RequiredArgsConstructor
public enum EntryTopics {

    RFID_LEITURA("rfid/leitura"),
    VACA_SAIDA("vaca"),
    ODOR_NIVEL("odor/nivel"),
    BOMBA_ACK("bomba/ack"),
    STATUS("status");

    private final String sufixo;

    /**
     * Builds the MQTT wildcard subscription pattern where {@code +} matches the device MAC address.
     *
     * @param prefixo configured root MQTT topic prefix
     * @return wildcard topic filter in the form {@code <prefix>/+/<suffix>}
     */
    public String padrao(String prefixo) {
        return prefixo + "/+/" + sufixo;
    }

    /**
     * Resolves an inbound topic enum constant from its trailing topic suffix.
     *
     * @param sufixo trailing path segment(s) after the device MAC address
     * @return matching {@link EntryTopics}, or empty when unrecognized
     */
    public static Optional<EntryTopics> deSufixo(String sufixo) {
        return Arrays.stream(values())
                .filter(t -> t.sufixo.equals(sufixo))
                .findFirst();
    }
}