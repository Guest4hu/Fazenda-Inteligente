package com.usjt.a3.repository;

import com.usjt.a3.model.entity.Animal;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AnimalRepository extends JpaRepository<Animal, Long> {

    Optional<Animal> findByTagUid(String tagUid);

    List<Animal> findByCurrentCorralId(Long currentCorralId);

    boolean existsByCurrentCorralId(Long currentCorralId);

    List<Animal> findByFarmId(Long farmId);

    boolean existsByTagUid(String tagUid);

}
