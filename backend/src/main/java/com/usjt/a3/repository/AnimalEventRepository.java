package com.usjt.a3.repository;

import com.usjt.a3.model.entity.AnimalEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AnimalEventRepository extends JpaRepository<AnimalEvent, Long> {

    // 1. Linha do tempo de presenças do curral (Dashboard)
    List<AnimalEvent> findByCorralIdOrderByInstantDesc(Long corralId);

    // 2. Histórico de movimentações de um animal específico
    List<AnimalEvent> findByAnimalIdOrderByInstantDesc(Long animalId);

    // 3. Última movimentação do animal (para conferência de estado)
    Optional<AnimalEvent> findFirstByAnimalIdOrderByInstantDesc(Long animalId);
}
