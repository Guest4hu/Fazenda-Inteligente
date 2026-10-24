package com.usjt.a3.controller;

import com.usjt.a3.config.security.UserPrincipal;
import com.usjt.a3.dto.request.ResolvePendencyRequestDTO;
import com.usjt.a3.dto.response.IdentifyPendencyResponseDTO;
import com.usjt.a3.service.IdentifyPendencyService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class PendencyController {

    private final IdentifyPendencyService identifyPendencyService;

    @GetMapping({"/currais/{corralId}/pendencias", "/farms/{farmId}/currais/{corralId}/pendencias"})
    public ResponseEntity<List<IdentifyPendencyResponseDTO>> listOpenPendencies(
            @PathVariable Long corralId,
            @PathVariable(required = false) Long farmId,
            @AuthenticationPrincipal UserPrincipal user
    ) {
        List<IdentifyPendencyResponseDTO> list = identifyPendencyService.listOpenPendencies(corralId, farmId, user.id());
        return ResponseEntity.ok(list);
    }

    @PostMapping("/pendencias/{pendencyId}/resolver")
    public ResponseEntity<IdentifyPendencyResponseDTO> resolvePendencyPost(
            @PathVariable Long pendencyId,
            @RequestBody @Valid ResolvePendencyRequestDTO request,
            @AuthenticationPrincipal UserPrincipal user
    ) {
        IdentifyPendencyResponseDTO response = identifyPendencyService.resolvePendency(
                pendencyId,
                request.animalId(),
                user.id()
        );
        return ResponseEntity.ok(response);
    }

    @PutMapping("/pendencias/{pendencyId}/resolver")
    public ResponseEntity<IdentifyPendencyResponseDTO> resolvePendencyPut(
            @PathVariable Long pendencyId,
            @RequestBody @Valid ResolvePendencyRequestDTO request,
            @AuthenticationPrincipal UserPrincipal user
    ) {
        IdentifyPendencyResponseDTO response = identifyPendencyService.resolvePendency(
                pendencyId,
                request.animalId(),
                user.id()
        );
        return ResponseEntity.ok(response);
    }
}
