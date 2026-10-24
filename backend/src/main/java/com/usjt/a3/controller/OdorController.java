package com.usjt.a3.controller;

import com.usjt.a3.config.security.UserPrincipal;
import com.usjt.a3.dto.response.OdorTelemetryResponseDTO;
import com.usjt.a3.service.OdorService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/currais")
@RequiredArgsConstructor
public class OdorController {

    private final OdorService odorService;

    @GetMapping("/{corralId}/odor")
    public ResponseEntity<List<OdorTelemetryResponseDTO>> listTelemetry(
            @PathVariable Long corralId,
            @AuthenticationPrincipal UserPrincipal user
    ) {
        return ResponseEntity.ok(odorService.listLatestTelemetries(corralId, user.id()));
    }
}
