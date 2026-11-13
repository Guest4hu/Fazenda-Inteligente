package com.usjt.a3.model.enums;

/**
 * Execution lifecycle state of a cleaning command; {@code EM_ANDAMENTO} acts as a per-corral concurrency lock.
 */
    public enum CleanState {
        EM_ANDAMENTO,
        PENDENTE,
        CONCLUIDO,
        CANCELADO
}
