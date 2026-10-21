package com.usjt.a3.config.security;

public record UserPrincipal(
        Long id,
        String name,
        String email
) {}
