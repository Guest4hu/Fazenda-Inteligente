package com.usjt.a3.repository;

import com.usjt.a3.model.entity.Corral;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CorralRepository extends JpaRepository<Corral, Long> {

    @EntityGraph(attributePaths = {"farm.user"})
    Optional<Corral> findByMacAddress(String macAddress);

    List<Corral> findByFarmId(Long farmid);



    boolean existsByIdAndFarmUserId(Long corralId, Long userId);

    boolean existsByMacAddress(String macAddress);

    boolean existsByMacAddressAndIdNot(String macAddress, Long id);

    List<Corral> findByCleanTimeIsNotNull();
}
