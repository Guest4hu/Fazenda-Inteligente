package com.usjt.a3.controller;

import com.usjt.a3.config.security.UserPrincipal;
import com.usjt.a3.dto.request.CleanCmdRequestDTO;
import com.usjt.a3.dto.response.CleanCmdResponseDTO;
import com.usjt.a3.service.CleanService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/currais")
@RequiredArgsConstructor
public class CleanController {

    private final CleanService cleanService;

    @PostMapping("/{corralId}/limpeza")
    public ResponseEntity<CleanCmdResponseDTO> dispatchClean(
            @PathVariable Long corralId,
            @RequestBody(required = false) @Valid CleanCmdRequestDTO request,
            @AuthenticationPrincipal UserPrincipal user
    ) {
        CleanCmdResponseDTO responseDTO = cleanService.triggerManualClean(corralId, user.id(), request);
        return ResponseEntity.ok(responseDTO);
    }

    @GetMapping({"/{corralId}/limpeza", "/{corralId}/limpezas"})
    public ResponseEntity<List<CleanCmdResponseDTO>> listCleanHistory(
            @PathVariable Long corralId,
            @AuthenticationPrincipal UserPrincipal user
    ) {
        return ResponseEntity.ok(cleanService.listCleanHistory(corralId, user.id()));
    }

}