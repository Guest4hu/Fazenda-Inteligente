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

/**
 * REST endpoints for dispatching manual wash commands, triggering emergency pump stops,
 * and retrieving corral cleaning execution history.
 */
@RestController
@RequestMapping("/api/v1/currais")
@RequiredArgsConstructor
public class CleanController {

    private final CleanService cleanService;

    /**
     * Triggers a wash command on the corral controller and synchronously awaits hardware ACK (up to 10s).
     *
     * <p>Returns {@code 409 Conflict} via {@link com.usjt.a3.exception.GlobalExceptionHandler} if animals are
     * present, another wash is active, or the ESP32 heartbeat is offline/stale.</p>
     *
     * @param corralId target corral identifier
     * @param request  optional wash request specifying origin and duration override ({@code 1..60s})
     * @param user     authenticated user principal
     * @return HTTP {@code 200 OK} with the resulting wash command status
     */
    @PostMapping("/{corralId}/limpeza")
    public ResponseEntity<CleanCmdResponseDTO> dispatchClean(
            @PathVariable Long corralId,
            @RequestBody(required = false) @Valid CleanCmdRequestDTO request,
            @AuthenticationPrincipal UserPrincipal user
    ) {
        CleanCmdResponseDTO responseDTO = cleanService.triggerManualClean(corralId, user.id(), request);
        return ResponseEntity.ok(responseDTO);
    }

    /**
     * Clears active wash locks and dispatches an immediate stop command to the controller pump.
     * Supports both {@code /limpeza/parar} and {@code /parar} route aliases.
     *
     * @param corralId target corral identifier
     * @param user     authenticated user principal
     * @return HTTP {@code 200 OK} with the emergency-stop command record
     */
    @PostMapping({"/{corralId}/limpeza/parar", "/{corralId}/parar"})
    public ResponseEntity<CleanCmdResponseDTO> stopClean(
            @PathVariable Long corralId,
            @AuthenticationPrincipal UserPrincipal user
    ) {
        CleanCmdResponseDTO responseDTO = cleanService.stopClean(corralId, user.id());
        return ResponseEntity.ok(responseDTO);
    }

    /**
     * Lists corral wash commands newest-first; supports both singular and plural path aliases.
     *
     * @param corralId target corral identifier
     * @param user     authenticated user principal
     * @return HTTP {@code 200 OK} containing the corral's wash command history
     */
    @GetMapping({"/{corralId}/limpeza", "/{corralId}/limpezas"})
    public ResponseEntity<List<CleanCmdResponseDTO>> listCleanHistory(
            @PathVariable Long corralId,
            @AuthenticationPrincipal UserPrincipal user
    ) {
        return ResponseEntity.ok(cleanService.listCleanHistory(corralId, user.id()));
    }

}