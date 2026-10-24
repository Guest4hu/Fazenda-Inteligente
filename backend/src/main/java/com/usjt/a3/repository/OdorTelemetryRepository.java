package com.usjt.a3.repository;

import com.usjt.a3.model.entity.OdorTelemetry;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface OdorTelemetryRepository extends JpaRepository<OdorTelemetry, Long> {

    // 1. Busca a leitura mais recente de um curral para o avaliador de odor (MQTT)
    Optional<OdorTelemetry> findFirstByCorralIdOrderByInstantDesc(Long corralId);

    // 2. Busca as últimas 30 leituras para plotar o gráfico no dashboard
    @EntityGraph(attributePaths = {"corral"})
    List<OdorTelemetry> findTop30ByCorralIdOrderByInstantDesc(Long corralId);

    // 3. Expurgo de histórico antigo (manutenção)
    void deleteByInstantBefore(LocalDateTime threshold);
}
