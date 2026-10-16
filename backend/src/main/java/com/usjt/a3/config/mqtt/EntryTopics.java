package com.usjt.a3.config.mqtt;

import java.util.Arrays;
import java.util.Optional;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public enum EntryTopics {

    RFID_LEITURA("rfid/leitura"),
    VACA_SAIDA("vaca"),
    ODOR_NIVEL("odor/nivel"),
    BOMBA_ACK("bomba/ack"),
    STATUS("status");

    private final String sufixo;

    /** Padrão de assinatura: o "+" ocupa o lugar do MAC. */
    public String padrao(String prefixo) {
        return prefixo + "/+/" + sufixo;
    }

    /** Descobre o tipo a partir do final do tópico recebido. */
    public static Optional<EntryTopics> deSufixo(String sufixo) {
        return Arrays.stream(values())
                .filter(t -> t.sufixo.equals(sufixo))
                .findFirst();
    }
}