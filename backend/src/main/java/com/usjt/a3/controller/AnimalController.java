package com.usjt.a3.controller;

import com.usjt.a3.config.security.UserPrincipal;
import com.usjt.a3.dto.request.AnimalPresenceRequestDTO;
import com.usjt.a3.dto.request.AnimalRequestDTO;
import com.usjt.a3.dto.response.AnimalEventResponseDTO;
import com.usjt.a3.dto.response.AnimalResponseDTO;
import com.usjt.a3.service.AnimalService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST endpoints for farm herd CRUD, manual/RFID corral presence registration, and presence event timelines,
 * exposing both flat ({@code /currais/{corralId}/...}, {@code /animais/{animalId}}) and farm-nested aliases.
 */
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class AnimalController {

    private final AnimalService animalService;

    @PostMapping("/farms/{farmId}/animais")
    public ResponseEntity<AnimalResponseDTO> createAnimal(
            @PathVariable Long farmId,
            @RequestBody @Valid AnimalRequestDTO request,
            @AuthenticationPrincipal UserPrincipal user
    ) {
        AnimalResponseDTO response = animalService.createAnimal(farmId, user.id(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/farms/{farmId}/animais")
    public ResponseEntity<List<AnimalResponseDTO>> listAnimals(
            @PathVariable Long farmId,
            @AuthenticationPrincipal UserPrincipal user
    ) {
        List<AnimalResponseDTO> list = animalService.getAnimals(farmId, user.id());
        return ResponseEntity.ok(list);
    }

    /**
     * Records a manual or simulated RFID presence event ({@code ENTROU}/{@code SAIU}) for a corral.
     *
     * @param corralId target corral identifier
     * @param farmId   optional farm identifier for containment validation when called via nested farm route
     * @param request  presence event payload containing RFID tag UID, movement direction, and origin
     * @param user     authenticated user principal
     * @return HTTP {@code 201 Created} containing the persisted animal movement event
     */
    @PostMapping({"/currais/{corralId}/presenca", "/farms/{farmId}/currais/{corralId}/presenca"})
    public ResponseEntity<AnimalEventResponseDTO> registerPresence(
            @PathVariable Long corralId,
            @PathVariable(required = false) Long farmId,
            @RequestBody @Valid AnimalPresenceRequestDTO request,
            @AuthenticationPrincipal UserPrincipal user
    ) {
        AnimalEventResponseDTO response = animalService.registerPresence(corralId, farmId, user.id(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping({"/currais/{corralId}/eventos", "/farms/{farmId}/currais/{corralId}/eventos"})
    public ResponseEntity<List<AnimalEventResponseDTO>> listEvents(
            @PathVariable Long corralId,
            @PathVariable(required = false) Long farmId,
            @AuthenticationPrincipal UserPrincipal user
    ) {
        List<AnimalEventResponseDTO> list = animalService.listEventsByCorral(corralId, farmId, user.id());
        return ResponseEntity.ok(list);
    }

    @PutMapping({"/animais/{animalId}", "/farms/{farmId}/animais/{animalId}"})
    public ResponseEntity<AnimalResponseDTO> updateAnimal(
            @PathVariable Long animalId,
            @PathVariable(required = false) Long farmId,
            @RequestBody @Valid AnimalRequestDTO request,
            @AuthenticationPrincipal UserPrincipal user
    ) {
        AnimalResponseDTO response = animalService.updateAnimal(animalId, farmId, user.id(), request);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping({"/animais/{animalId}", "/farms/{farmId}/animais/{animalId}"})
    public ResponseEntity<Void> deleteAnimal(
            @PathVariable Long animalId,
            @PathVariable(required = false) Long farmId,
            @AuthenticationPrincipal UserPrincipal user
    ) {
        animalService.deleteAnimal(animalId, farmId, user.id());
        return ResponseEntity.noContent().build();
    }

    @GetMapping({"/animais/{animalId}", "/farms/{farmId}/animais/{animalId}"})
    public ResponseEntity<AnimalResponseDTO> getAnimal(
            @PathVariable Long animalId,
            @PathVariable(required = false) Long farmId,
            @AuthenticationPrincipal UserPrincipal user
    ) {
        AnimalResponseDTO response = animalService.getAnimalById(animalId, farmId, user.id());
        return ResponseEntity.ok(response);
    }
}
