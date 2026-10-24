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

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class AnimalController {

    private final AnimalService animalService;

    // 1. Cadastrar animal na fazenda
    @PostMapping("/farms/{farmId}/animais")
    public ResponseEntity<AnimalResponseDTO> createAnimal(
            @PathVariable Long farmId,
            @RequestBody @Valid AnimalRequestDTO request,
            @AuthenticationPrincipal UserPrincipal user
    ) {
        AnimalResponseDTO response = animalService.createAnimal(farmId, user.id(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    // 2. Listar animais da fazenda
    @GetMapping("/farms/{farmId}/animais")
    public ResponseEntity<List<AnimalResponseDTO>> listAnimals(
            @PathVariable Long farmId,
            @AuthenticationPrincipal UserPrincipal user
    ) {
        List<AnimalResponseDTO> list = animalService.getAnimals(farmId, user.id());
        return ResponseEntity.ok(list);
    }

    // 3. Registrar movimentação de presença RFID (Entrou / Saiu do curral)
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

    // 4. Linha do tempo de presenças do curral
    @GetMapping({"/currais/{corralId}/eventos", "/farms/{farmId}/currais/{corralId}/eventos"})
    public ResponseEntity<List<AnimalEventResponseDTO>> listEvents(
            @PathVariable Long corralId,
            @PathVariable(required = false) Long farmId,
            @AuthenticationPrincipal UserPrincipal user
    ) {
        List<AnimalEventResponseDTO> list = animalService.listEventsByCorral(corralId, farmId, user.id());
        return ResponseEntity.ok(list);
    }

    // 5. Atualizar animal
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

    // 6. Excluir animal
    @DeleteMapping({"/animais/{animalId}", "/farms/{farmId}/animais/{animalId}"})
    public ResponseEntity<Void> deleteAnimal(
            @PathVariable Long animalId,
            @PathVariable(required = false) Long farmId,
            @AuthenticationPrincipal UserPrincipal user
    ) {
        animalService.deleteAnimal(animalId, farmId, user.id());
        return ResponseEntity.noContent().build();
    }

    // 7. Buscar animal por ID
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
