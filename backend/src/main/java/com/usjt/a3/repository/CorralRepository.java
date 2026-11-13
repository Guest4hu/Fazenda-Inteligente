package com.usjt.a3.repository;

import com.usjt.a3.model.entity.Corral;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Spring Data repository for {@link Corral} lookup by MAC address, farm ownership, and scheduled cleans.
 */
@Repository
public interface CorralRepository extends JpaRepository<Corral, Long> {

    /**
     * Looks up a corral by normalized MAC while eagerly fetching {@code farm.user} for MQTT ingestion
     * outside an active HTTP persistence session.
     *
     * @param macAddress normalized uppercased 12-hex-character MAC address
     * @return matching corral with its owning farm and user loaded, if present
     */
    @EntityGraph(attributePaths = {"farm.user"})
    Optional<Corral> findByMacAddress(String macAddress);

    List<Corral> findByFarmId(Long farmid);



    boolean existsByIdAndFarmUserId(Long corralId, Long userId);

    boolean existsByMacAddress(String macAddress);

    boolean existsByMacAddressAndIdNot(String macAddress, Long id);

    List<Corral> findByCleanTimeIsNotNull();
}
