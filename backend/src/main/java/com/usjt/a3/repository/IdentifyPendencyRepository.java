package com.usjt.a3.repository;

import com.usjt.a3.model.entity.IdentifyPendency;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Spring Data repository for unresolved RFID identification alerts.
 */
@Repository
public interface IdentifyPendencyRepository extends JpaRepository<IdentifyPendency, Long> {

    /**
     * Lists unresolved pendencies for a corral newest-first, backed by the partial DB index on {@code resolved = false}.
     *
     * @param corralId corral identifier
     * @return open identification pendencies ordered from newest to oldest
     */
    List<IdentifyPendency> findByCorralIdAndResolvedFalseOrderByInstantDesc(Long corralId);

    List<IdentifyPendency> findByResolvedFalseOrderByInstantDesc();

    long countByResolvedFalse();

    long countByCorralIdAndResolvedFalse(Long corralId);
}
