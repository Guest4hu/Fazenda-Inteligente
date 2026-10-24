package com.usjt.a3.dto.request;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.time.LocalTime;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("Testes Unitários de Bean Validation - CorralParametersRequestDTO")
class CorralParametersValidationTest {

    private static Validator validator;

    @BeforeAll
    static void setUpValidator() {
        ValidatorFactory factory = Validation.buildDefaultValidatorFactory();
        validator = factory.getValidator();
    }

    @Test
    @DisplayName("DTO com parâmetros válidos não gera violações")
    void validParameters_noViolations() {
        CorralParametersRequestDTO dto = new CorralParametersRequestDTO(
                LocalTime.of(7, 30),
                350,
                25
        );
        Set<ConstraintViolation<CorralParametersRequestDTO>> violations = validator.validate(dto);
        assertTrue(violations.isEmpty(), "Não deve haver violações de validação");
    }

    @Test
    @DisplayName("DTO com cleanTime nulo é válido (desativação de limpeza automática)")
    void nullCleanTime_isValid() {
        CorralParametersRequestDTO dto = new CorralParametersRequestDTO(
                null,
                400,
                30
        );
        Set<ConstraintViolation<CorralParametersRequestDTO>> violations = validator.validate(dto);
        assertTrue(violations.isEmpty(), "cleanTime nulo deve ser permitido para desabilitar o agendamento");
    }

    @ParameterizedTest(name = "pumpDurationSeconds <= 0 ({0}) deve falhar com violação @Positive")
    @ValueSource(ints = {0, -1, -5, -60})
    void pumpDurationSeconds_lessThanOrEqualToZero_fails(int duration) {
        CorralParametersRequestDTO dto = new CorralParametersRequestDTO(
                LocalTime.of(8, 0),
                400,
                duration
        );
        Set<ConstraintViolation<CorralParametersRequestDTO>> violations = validator.validate(dto);
        assertFalse(violations.isEmpty());
        assertTrue(violations.stream().anyMatch(v -> 
                v.getPropertyPath().toString().equals("pumpDurationSeconds") &&
                v.getMessage().contains("maior que zero")));
    }

    @ParameterizedTest(name = "pumpDurationSeconds > 60 ({0}) deve falhar com violação @Max(60)")
    @ValueSource(ints = {61, 75, 120, 500})
    void pumpDurationSeconds_greaterThan60_fails(int duration) {
        CorralParametersRequestDTO dto = new CorralParametersRequestDTO(
                LocalTime.of(8, 0),
                400,
                duration
        );
        Set<ConstraintViolation<CorralParametersRequestDTO>> violations = validator.validate(dto);
        assertFalse(violations.isEmpty());
        assertTrue(violations.stream().anyMatch(v -> 
                v.getPropertyPath().toString().equals("pumpDurationSeconds") &&
                v.getMessage().contains("60 segundos")));
    }

    @ParameterizedTest(name = "pumpDurationSeconds nas fronteiras válidas ({0}) não gera violações")
    @ValueSource(ints = {1, 30, 60})
    void pumpDurationSeconds_validBoundaries_success(int duration) {
        CorralParametersRequestDTO dto = new CorralParametersRequestDTO(
                LocalTime.of(8, 0),
                400,
                duration
        );
        Set<ConstraintViolation<CorralParametersRequestDTO>> violations = validator.validate(dto);
        assertTrue(violations.isEmpty());
    }

    @ParameterizedTest(name = "limitOdor < 0 ({0}) deve falhar com violação @PositiveOrZero")
    @ValueSource(ints = {-1, -10, -400})
    void limitOdor_negative_fails(int limitOdor) {
        CorralParametersRequestDTO dto = new CorralParametersRequestDTO(
                LocalTime.of(8, 0),
                limitOdor,
                30
        );
        Set<ConstraintViolation<CorralParametersRequestDTO>> violations = validator.validate(dto);
        assertFalse(violations.isEmpty());
        assertTrue(violations.stream().anyMatch(v -> 
                v.getPropertyPath().toString().equals("limitOdor") &&
                v.getMessage().contains("maior ou igual a zero")));
    }

    @ParameterizedTest(name = "limitOdor nas fronteiras válidas ({0}) não gera violações")
    @ValueSource(ints = {0, 1, 400, 1000})
    void limitOdor_validBoundaries_success(int limitOdor) {
        CorralParametersRequestDTO dto = new CorralParametersRequestDTO(
                LocalTime.of(8, 0),
                limitOdor,
                30
        );
        Set<ConstraintViolation<CorralParametersRequestDTO>> violations = validator.validate(dto);
        assertTrue(violations.isEmpty());
    }
}
