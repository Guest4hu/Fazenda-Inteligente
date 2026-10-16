package com.usjt.a3.repository;

import com.usjt.a3.model.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    // 1. Busca por e-mail para autenticação e login
    Optional<User> findByEmail(String email);

    // 2. Validação para impedir e-mails duplicados
    boolean existsByEmail(String email);
}
