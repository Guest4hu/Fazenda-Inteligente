package com.usjt.a3.config.security;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.exceptions.JWTCreationException;
import com.auth0.jwt.exceptions.JWTVerificationException;
import com.usjt.a3.model.entity.User;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;

@Service
public class TokenService {

    @Value("${api.security.token.secret}")
    private String secret;

    @Value("${api.security.token.issuer}")
    private String issuer;

    public String generateToken(User user) {
        try {
            Algorithm algorithm = Algorithm.HMAC256(secret);
            return JWT.create()
                    .withIssuer(issuer)
                    .withSubject(user.getEmail())
                    .withClaim("userId", user.getId())
                    .withClaim("userName", user.getName())
                    .withExpiresAt(generateExpirationDate())
                    .sign(algorithm);
        } catch (JWTCreationException e) {
            throw new RuntimeException("Erro ao criar o JWT", e);
        }
    }

    public String validateToken(String token) {
        try {
            Algorithm algorithm = Algorithm.HMAC256(secret);
            return JWT.require(algorithm)
                    .withIssuer(issuer)
                    .build()
                    .verify(token)
                    .getSubject();
        } catch (JWTVerificationException e) {
            return null;
        }
    }

    public UserPrincipal getUserByToken(String token) {
        try {
            Algorithm algorithm = Algorithm.HMAC256(secret);
            var decodedToken = JWT.require(algorithm)
                    .withIssuer(issuer)
                    .build()
                    .verify(token);

            Long userId = decodedToken.getClaim("userId").asLong();
            String userName = decodedToken.getClaim("userName").asString();
            String userEmail = decodedToken.getSubject();

            return new UserPrincipal(userId, userName, userEmail);
        } catch (JWTVerificationException e) {
            return null;
        }
    }

    private Instant generateExpirationDate() {
        return LocalDateTime.now().plusHours(24).atZone(ZoneId.systemDefault()).toInstant();
    }
}
