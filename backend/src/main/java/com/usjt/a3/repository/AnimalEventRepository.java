package com.usjt.a3.repository;

import com.usjt.a3.model.entity.AnimalEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Spring Data repository for animal presence audit events.
 */
@Repository
public interface AnimalEventRepository extends JpaRepository<AnimalEvent, Long> {

    /**
     * Fetches the corral's movement timeline newest-first, eagerly loading {@code corral} and {@code animal}
     * via {@link org.springframework.data.jpa.repository.EntityGraph} to prevent N+1 queries during DTO mapping.
     *
     * @param corralId corral identifier
     * @return animal movement events ordered from newest to oldest
     */
    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"corral", "animal"})
    List<AnimalEvent> findByCorralIdOrderByInstantDesc(Long corralId);

    List<AnimalEvent> findByAnimalIdOrderByInstantDesc(Long animalId);

    Optional<AnimalEvent> findFirstByAnimalIdOrderByInstantDesc(Long animalId);
}
