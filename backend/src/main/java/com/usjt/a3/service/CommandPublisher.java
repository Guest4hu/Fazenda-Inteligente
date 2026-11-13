package com.usjt.a3.service;

import java.util.UUID;

/**
 * Outbound device control port for dispatching pump start and stop commands.
 */
public interface CommandPublisher {
    void pumpAction(String macAdress, UUID commandId, Integer durationSeconds);
    void stopPump(String macAddress, UUID commandId);
}
