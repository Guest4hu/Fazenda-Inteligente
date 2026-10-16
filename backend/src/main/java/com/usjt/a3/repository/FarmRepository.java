package com.usjt.a3.repository;

import com.usjt.a3.model.entity.Farm;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface FarmRepository extends JpaRepository<Farm, Long> {

    // 1. Listar todas as fazendas pertencentes a um determinado usuário
    List<Farm> findByUserId(Long userId);

    // 2. Checar se já existe fazenda com o mesmo nome para aquele usuário
    boolean existsByNameAndUserId(String name, Long userId);
}
