package com.usjt.a3.repository;

import com.usjt.a3.model.entity.CleanCmd;
import com.usjt.a3.model.enums.CleanOrigin;
import com.usjt.a3.model.enums.CleanState;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Spring Data repository for {@link CleanCmd} wash command records and active-state lock checks.
 */
@Repository
public interface CleanCmdRepository extends JpaRepository<CleanCmd, UUID> {

    boolean existsByCorralIdAndCleanState(Long corralId, CleanState cleanState);

    boolean existsByCorralFarmIdAndCleanState(Long farmId, CleanState cleanState);

    /**
     * Retrieves wash command history newest-first while eagerly fetching {@code corral} to avoid N+1 loads.
     *
     * @param corralId corral identifier
     * @return wash command records ordered from newest to oldest
     */
    @EntityGraph(attributePaths = {"corral"})
    List<CleanCmd> findByCorralIdOrderByCreatedAtDesc(Long corralId);

    long countByCorralIdAndCleanOriginAndCreatedAtGreaterThanEqual(
            Long corralId,
            CleanOrigin cleanOrigin,
            LocalDateTime startOfDay
    );

    long countByCorralIdAndCreatedAtGreaterThanEqual(
            Long corralId,
            LocalDateTime startOfDay
    );
}
