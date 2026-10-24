package com.usjt.a3.mqtt.entry;

import com.usjt.a3.config.mqtt.EntryTopics;
import com.usjt.a3.dto.request.AnimalPresenceRequestDTO;
import com.usjt.a3.model.entity.Corral;
import com.usjt.a3.model.enums.AnimalEventType;
import com.usjt.a3.model.enums.EventOrigin;
import com.usjt.a3.repository.CorralRepository;
import com.usjt.a3.service.AnimalService;
import com.usjt.a3.service.IdentifyPendencyService;
import jakarta.persistence.EntityNotFoundException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.util.Optional;

@Slf4j
@Component
public class CommandRfidLeitura implements CommandReceiveMqtt {

    private final CorralRepository corralRepository;
    private final AnimalService animalService;
    private final IdentifyPendencyService identifyPendencyService;
    private final ObjectMapper objectMapper;

    @Autowired
    public CommandRfidLeitura(CorralRepository corralRepository,
                              AnimalService animalService,
                              IdentifyPendencyService identifyPendencyService,
                              ObjectMapper objectMapper) {
        this.corralRepository = corralRepository;
        this.animalService = animalService;
        this.identifyPendencyService = identifyPendencyService;
        this.objectMapper = objectMapper;
    }

    @Deprecated
    public CommandRfidLeitura(CorralRepository corralRepository,
                              AnimalService animalService,
                              ObjectMapper objectMapper) {
        this(corralRepository, animalService, null, objectMapper);
    }

    @Override
    public EntryTopics topico() {
        return EntryTopics.RFID_LEITURA;
    }

    @Override
    public void tratar(String macAddress, String payload) {
        if (macAddress == null || macAddress.isBlank()) {
            log.warn("Leitura RFID ignorada: macAddress nulo ou vazio");
            return;
        }

        if (payload == null || payload.isBlank()) {
            log.warn("Leitura RFID ignorada: payload nulo ou vazio para o curral MAC {}", macAddress);
            return;
        }

        String normalizedMac = macAddress.replace(":", "").replace("-", "").trim().toUpperCase();
        if (normalizedMac.isBlank()) {
            log.warn("Leitura RFID ignorada: macAddress inválido '{}'", macAddress);
            return;
        }

        try {
            JsonNode root;
            try {
                root = objectMapper.readTree(payload);
            } catch (Exception e) {
                log.error("JSON malformado recebido no tópico RFID do curral MAC {}: payload='{}'", normalizedMac, payload, e);
                return;
            }

            if (root == null || !root.isObject()) {
                log.warn("Leitura RFID ignorada: payload JSON não é um objeto para o curral MAC {}: payload='{}'", normalizedMac, payload);
                return;
            }

            String tagUid = extractField(root, "tagUid", "tag", "tag_uid", "uid", "rfid");
            if (tagUid == null || tagUid.isBlank()) {
                log.warn("Leitura RFID ignorada: campo 'tagUid' ausente no payload para o curral MAC {}", normalizedMac);
                return;
            }
            String normalizedTagUid = tagUid.trim().toUpperCase();

            String typeEventStr = extractField(root, "typeEvent", "event", "evento", "tipoEvento", "tipo", "status");
            if (typeEventStr == null || typeEventStr.isBlank()) {
                log.warn("Leitura RFID ignorada: campo 'typeEvent' ausente no payload para o curral MAC {}", normalizedMac);
                return;
            }

            AnimalEventType typeEvent = parseEventType(typeEventStr);
            if (typeEvent == null) {
                log.warn("Leitura RFID ignorada: evento '{}' inválido para o curral MAC {}", typeEventStr, normalizedMac);
                return;
            }

            Optional<Corral> corralOpt = corralRepository.findByMacAddress(normalizedMac);
            if (corralOpt.isEmpty()) {
                log.warn("Leitura RFID ignorada: nenhum curral cadastrado com o MAC {}", normalizedMac);
                return;
            }

            Corral corral = corralOpt.get();
            if (corral.getFarm() == null || corral.getFarm().getUser() == null) {
                log.error("Curral MAC {} não possui fazenda ou usuário proprietário associado", normalizedMac);
                return;
            }

            Long userId = corral.getFarm().getUser().getId();
            Long corralId = corral.getId();

            AnimalPresenceRequestDTO requestDTO = new AnimalPresenceRequestDTO(
                    normalizedTagUid,
                    typeEvent,
                    EventOrigin.TAG
            );

            log.info("Processando leitura RFID | Curral MAC: {} (ID: {}) | Usuário ID: {} | Tag: {} | Evento: {}",
                    normalizedMac, corralId, userId, normalizedTagUid, typeEvent);

            try {
                animalService.registerPresence(corralId, userId, requestDTO);
                log.info("Presença RFID registrada com sucesso | Curral ID: {} | Tag: {} | Evento: {}",
                        corralId, normalizedTagUid, typeEvent);
            } catch (EntityNotFoundException e) {
                log.warn("Falha ao registrar presença RFID para o curral MAC {}: {}", normalizedMac, e.getMessage());
                if (identifyPendencyService != null) {
                    try {
                        identifyPendencyService.createPendency(corral, normalizedTagUid, typeEvent);
                    } catch (Exception ex) {
                        log.error("Erro ao registrar pendência para o curral MAC {}: {}", normalizedMac, ex.getMessage(), ex);
                    }
                }
            }

        } catch (SecurityException e) {
            log.warn("Falha de permissão ao registrar presença RFID para o curral MAC {}: {}", normalizedMac, e.getMessage());
        } catch (IllegalStateException e) {
            log.warn("Violação de regra de negócio ao registrar presença RFID para o curral MAC {}: {}", normalizedMac, e.getMessage());
        } catch (Exception e) {
            log.error("Erro inesperado ao processar leitura RFID do curral MAC {}: payload='{}'", normalizedMac, payload, e);
        }
    }

    private String extractField(JsonNode root, String... fieldNames) {
        for (String fieldName : fieldNames) {
            JsonNode node = root.get(fieldName);
            if (node != null && !node.isNull() && node.isValueNode()) {
                String text = node.asText(null);
                if (text != null && !text.isBlank()) {
                    return text.trim();
                }
            }
        }
        return null;
    }

    private AnimalEventType parseEventType(String raw) {
        if (raw == null) {
            return null;
        }
        String norm = raw.trim().toUpperCase();
        return switch (norm) {
            case "ENTROU", "ENTRADA", "IN", "1", "TRUE", "ENTER" -> AnimalEventType.ENTROU;
            case "SAIU", "SAIDA", "SAÍDA", "OUT", "0", "FALSE", "EXIT", "LEAVE" -> AnimalEventType.SAIU;
            default -> {
                try {
                    yield AnimalEventType.valueOf(norm);
                } catch (IllegalArgumentException e) {
                    yield null;
                }
            }
        };
    }
}
