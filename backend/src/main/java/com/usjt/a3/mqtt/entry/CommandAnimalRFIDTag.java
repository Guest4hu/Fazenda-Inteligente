package com.usjt.a3.mqtt.entry;

import com.usjt.a3.repository.CorralRepository;
import com.usjt.a3.service.AnimalService;
import tools.jackson.databind.ObjectMapper;

/**
 * @deprecated Use {@link CommandRfidLeitura} em vez desta classe.
 */
@Deprecated
public class CommandAnimalRFIDTag extends CommandRfidLeitura {

    public CommandAnimalRFIDTag(CorralRepository corralRepository, AnimalService animalService, ObjectMapper objectMapper) {
        super(corralRepository, animalService, objectMapper);
    }
}
