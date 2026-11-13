package com.usjt.a3.mqtt.entry;

import com.usjt.a3.repository.CorralRepository;
import com.usjt.a3.service.AnimalService;
import com.usjt.a3.service.IdentifyPendencyService;
import tools.jackson.databind.ObjectMapper;

/**
 * Backward-compatible alias for the legacy RFID handler bean name.
 *
 * @deprecated Use {@link CommandRfidLeitura} instead.
 */
@Deprecated
public class CommandAnimalRFIDTag extends CommandRfidLeitura {

    public CommandAnimalRFIDTag(CorralRepository corralRepository, AnimalService animalService, ObjectMapper objectMapper) {
        super(corralRepository, animalService, objectMapper);
    }

    public CommandAnimalRFIDTag(CorralRepository corralRepository,
                                AnimalService animalService,
                                IdentifyPendencyService identifyPendencyService,
                                ObjectMapper objectMapper) {
        super(corralRepository, animalService, identifyPendencyService, objectMapper);
    }
}
