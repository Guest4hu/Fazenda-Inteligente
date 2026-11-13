package com.usjt.a3.repository;

import com.usjt.a3.model.entity.Farm;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface FarmRepository extends JpaRepository<Farm, Long> {

    List<Farm> findByUserId(Long userId);

    boolean existsByNameAndUserId(String name, Long userId);

    /**
     * Checks per-user farm name uniqueness excluding the farm currently being renamed.
     *
     * @param name   candidate farm name
     * @param userId owning user identifier
     * @param id     identifier of the farm being updated and excluded from matching
     * @return {@code true} if another farm owned by the same user already uses {@code name}
     */
    boolean existsByNameAndUserIdAndIdNot(String name, Long userId, Long id);
}
