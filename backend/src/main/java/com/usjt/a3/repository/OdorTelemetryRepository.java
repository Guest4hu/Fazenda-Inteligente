package com.usjt.a3.repository;

import com.usjt.a3.model.entity.OdorTelemetry;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Spring Data repository for MQ-135 gas and DHT environmental telemetry samples.
 */
@Repository
public interface OdorTelemetryRepository extends JpaRepository<OdorTelemetry, Long> {

    Optional<OdorTelemetry> findFirstByCorralIdOrderByInstantDesc(Long corralId);

    /**
     * Returns the latest 30 samples for dashboard charting while eagerly fetching {@code corral} via {@link EntityGraph}.
     *
     * @param corralId corral identifier
     * @return up to 30 most recent gas/environmental telemetry records ordered newest-first
     */
    @EntityGraph(attributePaths = {"corral"})
    List<OdorTelemetry> findTop30ByCorralIdOrderByInstantDesc(Long corralId);

    void deleteByInstantBefore(LocalDateTime threshold);
}
