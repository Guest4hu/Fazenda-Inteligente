package com.usjt.a3.model.enums;

/**
 * Trigger source for a cleaning command: cron schedule ({@code AUTOMATICA}), operator ({@code MANUAL}),
 * or gas-threshold exceedance ({@code EVENTO}).
 */
public enum CleanOrigin {
    AUTOMATICA,
    MANUAL,
    EVENTO
}
