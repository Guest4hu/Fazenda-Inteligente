package com.usjt.a3.controller;

import com.usjt.a3.config.security.UserPrincipal;
import com.usjt.a3.dto.request.FarmRequestDTO;
import com.usjt.a3.dto.response.FarmResponseDTO;
import com.usjt.a3.service.FarmService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST endpoints for creating, listing, renaming, and deleting farms owned by the authenticated user.
 */
@RestController
@RequestMapping("/api/v1/farms")
@RequiredArgsConstructor
public class FarmController {
    private final FarmService farmService;
    @PostMapping
    public ResponseEntity<FarmResponseDTO> create(
            @RequestBody @Valid FarmRequestDTO farmRequestDTO,
            @AuthenticationPrincipal UserPrincipal user
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(farmService.createFarm(farmRequestDTO, user.id()));
    }

    @GetMapping
    public ResponseEntity<List<FarmResponseDTO>>getFarm(
            @AuthenticationPrincipal UserPrincipal user
    ){
        return ResponseEntity.ok(farmService.findAllFarm(user.id()));
    }

    @PutMapping("/{farmId}")
    public ResponseEntity<FarmResponseDTO> update(
            @PathVariable Long farmId,
            @RequestBody @Valid FarmRequestDTO farmRequestDTO,
            @AuthenticationPrincipal UserPrincipal user
    ) {
        return ResponseEntity.ok(farmService.updateFarm(farmId, farmRequestDTO, user.id()));
    }

    @DeleteMapping("/{farmId}")
    public ResponseEntity<Void> delete(
            @PathVariable Long farmId,
            @AuthenticationPrincipal UserPrincipal user
    ) {
        farmService.deleteFarm(farmId, user.id());
        return ResponseEntity.noContent().build();
    }
}
