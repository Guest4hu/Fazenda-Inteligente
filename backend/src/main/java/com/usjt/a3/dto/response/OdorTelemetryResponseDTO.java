package com.usjt.a3.dto.response;

import java.time.LocalDateTime;

/**
 * Gas and environmental telemetry reading returned to API and SSE clients.
 *
 * @param id          telemetry record identifier
 * @param corralId    corral identifier owning the reading
 * @param value       measured MQ-135 gas sensor value
 * @param instant     timestamp when the reading was recorded
 * @param temperature ambient temperature in Celsius, or {@code null} if unavailable
 * @param humidity    relative humidity percentage, or {@code null} if unavailable
 */
public record OdorTelemetryResponseDTO(
        Long id,
        Long corralId,
        Integer value,
        LocalDateTime instant,
        Double temperature,
        Double humidity
) {
    /**
     * Backward-compatible constructor for odor-only samples without DHT temperature or humidity data.
     *
     * @param id       telemetry record identifier
     * @param corralId corral identifier owning the reading
     * @param value    measured MQ-135 gas sensor value
     * @param instant  timestamp when the reading was recorded
     */
    public OdorTelemetryResponseDTO(Long id, Long corralId, Integer value, LocalDateTime instant) {
        this(id, corralId, value, instant, null, null);
    }
}
