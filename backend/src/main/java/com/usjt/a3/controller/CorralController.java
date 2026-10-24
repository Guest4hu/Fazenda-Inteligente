package com.usjt.a3.controller;

import com.usjt.a3.config.security.UserPrincipal;
import com.usjt.a3.dto.request.CorralParametersRequestDTO;
import com.usjt.a3.dto.request.CorralRequestDTO;
import com.usjt.a3.dto.response.CorralMetricsResponseDTO;
import com.usjt.a3.dto.response.CorralResponseDTO;
import com.usjt.a3.service.CorralService;
import com.usjt.a3.service.CorralSseService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;

@RestController
@RequestMapping("/api/v1")
public class CorralController {
    private final CorralService corralService;
    private final CorralSseService corralSseService;

    public CorralController(CorralService corralService) {
        this(corralService, null);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public CorralController(CorralService corralService, CorralSseService corralSseService) {
        this.corralService = corralService;
        this.corralSseService = corralSseService;
    }

    @PostMapping("/farms/{farmId}/currais")
    public ResponseEntity<CorralResponseDTO> create(
        @PathVariable Long farmId,
        @RequestBody @Valid CorralRequestDTO corralRequestDTO,
        @AuthenticationPrincipal UserPrincipal user
    ){
        return ResponseEntity.status(HttpStatus.CREATED).body(corralService.createCorral(corralRequestDTO, user.id(), farmId));
    }

    @GetMapping("/farms/{farmId}/currais")
    public ResponseEntity<List<CorralResponseDTO>> list(
            @PathVariable Long farmId,
            @AuthenticationPrincipal UserPrincipal user
    ){
        return ResponseEntity.ok(corralService.listCorrals(user.id(), farmId));
    }

    @GetMapping({"/currais/{corralId}", "/farms/{farmId}/currais/{corralId}"})
    public ResponseEntity<CorralResponseDTO> getById(
            @PathVariable Long corralId,
            @PathVariable(required = false) Long farmId,
            @AuthenticationPrincipal UserPrincipal user
    ) {
        return ResponseEntity.ok(corralService.getCorralById(corralId, farmId, user.id()));
    }

    @PutMapping({"/currais/{corralId}", "/farms/{farmId}/currais/{corralId}"})
    public ResponseEntity<CorralResponseDTO> update(
            @PathVariable Long corralId,
            @PathVariable(required = false) Long farmId,
            @RequestBody @Valid CorralRequestDTO corralRequestDTO,
            @AuthenticationPrincipal UserPrincipal user
    ) {
        return ResponseEntity.ok(corralService.updateCorral(corralId, farmId, user.id(), corralRequestDTO));
    }

    @DeleteMapping({"/currais/{corralId}", "/farms/{farmId}/currais/{corralId}"})
    public ResponseEntity<Void> delete(
            @PathVariable Long corralId,
            @PathVariable(required = false) Long farmId,
            @AuthenticationPrincipal UserPrincipal user
    ) {
        corralService.deleteCorral(corralId, farmId, user.id());
        return ResponseEntity.noContent().build();
    }

    @PutMapping({"/currais/{corralId}/parametros", "/farms/{farmId}/currais/{corralId}/parametros"})
    public ResponseEntity<CorralResponseDTO> updateParameters(
            @PathVariable Long corralId,
            @PathVariable(required = false) Long farmId,
            @RequestBody @Valid CorralParametersRequestDTO dto,
            @AuthenticationPrincipal UserPrincipal user
    ) {
        return ResponseEntity.ok(corralService.updateParameters(corralId, farmId, user.id(), dto));
    }

    @GetMapping({"/currais/{corralId}/metricas", "/farms/{farmId}/currais/{corralId}/metricas"})
    public ResponseEntity<CorralMetricsResponseDTO> getMetrics(
            @PathVariable Long corralId,
            @PathVariable(required = false) Long farmId,
            @AuthenticationPrincipal UserPrincipal user
    ) {
        return ResponseEntity.ok(corralService.getCorralMetrics(corralId, farmId, user.id()));
    }

    @GetMapping(
            value = {"/currais/{corralId}/stream", "/farms/{farmId}/currais/{corralId}/stream"},
            produces = MediaType.TEXT_EVENT_STREAM_VALUE
    )
    public SseEmitter stream(
            @PathVariable Long corralId,
            @PathVariable(required = false) Long farmId,
            @AuthenticationPrincipal UserPrincipal user
    ) {
        return corralSseService.subscribe(corralId, farmId, user.id());
    }
}
