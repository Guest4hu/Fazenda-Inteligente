package com.usjt.a3.controller;

import com.usjt.a3.config.security.UserPrincipal;
import com.usjt.a3.dto.request.CorralRequestDTO;
import com.usjt.a3.dto.response.CorralResponseDTO;
import com.usjt.a3.service.CorralService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/farms/{farmId}/currais")
@RequiredArgsConstructor
public class CorralController {
    private final CorralService corralService;

    @PostMapping
    public ResponseEntity<CorralResponseDTO> create(
        @PathVariable Long farmId,
        @RequestBody @Valid CorralRequestDTO corralRequestDTO,
        @AuthenticationPrincipal UserPrincipal user
    ){
        return ResponseEntity.status(HttpStatus.CREATED).body(corralService.createCorral(corralRequestDTO, user.id(),farmId));
    }

    @GetMapping
    public ResponseEntity<List<CorralResponseDTO>> list(
            @PathVariable Long farmId,
            @AuthenticationPrincipal UserPrincipal user
    ){
        return ResponseEntity.ok(corralService.listCorrals(user.id(), farmId ));
    }


}
