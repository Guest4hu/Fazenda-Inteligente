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

@Repository
public interface CleanCmdRepository extends JpaRepository<CleanCmd, UUID> {

    boolean existsByCorralIdAndCleanState(Long corralId, CleanState cleanState);

    boolean existsByCorralFarmIdAndCleanState(Long farmId, CleanState cleanState);

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
