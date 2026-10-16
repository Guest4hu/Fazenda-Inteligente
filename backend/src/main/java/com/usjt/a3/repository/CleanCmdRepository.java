package com.usjt.a3.repository;

import com.usjt.a3.model.entity.CleanCmd;
import com.usjt.a3.model.enums.CleanState;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface CleanCmdRepository extends JpaRepository<CleanCmd, UUID> {

    boolean existsByCorralIdAndCleanStateIn(Long corralId, Collection<CleanState> cleanStates);

    List<CleanCmd> findByCorralIdOrderByCreatedAtDesc(Long corralId);

    List<CleanCmd> findByCleanStateAndSentAtBefore(CleanState state, LocalDateTime threshold);

}
