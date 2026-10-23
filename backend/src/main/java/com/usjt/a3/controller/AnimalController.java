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
    @PostMapping("/currais/{corralId}/presenca")
    public ResponseEntity<AnimalEventResponseDTO> registerPresence(
            @PathVariable Long corralId,
            @RequestBody @Valid AnimalPresenceRequestDTO request,
            @AuthenticationPrincipal UserPrincipal user
    ) {
        AnimalEventResponseDTO response = animalService.registerPresence(corralId, user.id(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    // 4. Linha do tempo de presenças do curral
    @GetMapping("/currais/{corralId}/eventos")
    public ResponseEntity<List<AnimalEventResponseDTO>> listEvents(
            @PathVariable Long corralId,
            @AuthenticationPrincipal UserPrincipal user
    ) {
        List<AnimalEventResponseDTO> list = animalService.listEventsByCorral(corralId, user.id());
        return ResponseEntity.ok(list);
    }
}
