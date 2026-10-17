package com.usjt.a3.service;

import java.util.UUID;

public interface ComandPublisher {
    void pumpAction(String macAdress, UUID commandId, Integer durationSeconds);
}
