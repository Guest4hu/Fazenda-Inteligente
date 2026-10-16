package com.usjt.a3.mqtt.entry;

import static org.junit.jupiter.api.Assertions.*;

import com.usjt.a3.config.mqtt.EntryTopics;
import com.usjt.a3.config.mqtt.MqttProperties;
import org.junit.jupiter.api.Test;

class MqttTopicsTest {

    private final MqttTopics topics = new MqttTopics(
            new MqttProperties("tcp://localhost:1883", "meuprojeto-k7x2/curral", "teste"));

    @Test
    void interpretaMacETipoNormalizandoMaiusculas() {
        var resultado = topics.interpretar("meuprojeto-k7x2/curral/aabbccddeeff/odor/nivel");

        assertTrue(resultado.isPresent());
        assertEquals("AABBCCDDEEFF", resultado.get().mac());
        assertEquals(EntryTopics.ODOR_NIVEL, resultado.get().tipo());
    }

    @Test
    void ignoraPrefixoDiferente() {
        assertTrue(topics.interpretar("outro/curral/AABB/odor/nivel").isEmpty());
    }

    @Test
    void ignoraSufixoDesconhecido() {
        assertTrue(topics.interpretar("meuprojeto-k7x2/curral/AABB/teste").isEmpty());
    }

    @Test
    void ignoraTopicoSemMac() {
        assertTrue(topics.interpretar("meuprojeto-k7x2/curral//odor/nivel").isEmpty());
    }
}