package com.usjt.a3.repository;

import com.usjt.a3.model.entity.IdentifyPendency;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface IdentifyPendencyRepository extends JpaRepository<IdentifyPendency, Long> {

    // 1. Fila de pendências abertas de um curral específico (aproveita o índice parcial do banco)
    List<IdentifyPendency> findByCorralIdAndResolvedFalseOrderByInstantDesc(Long corralId);

    // 2. Todas as pendências abertas no sistema para a tela do operador
    List<IdentifyPendency> findByResolvedFalseOrderByInstantDesc();

    // 3. Contador de pendências para exibir badge/alerta no painel
    long countByResolvedFalse();
}
