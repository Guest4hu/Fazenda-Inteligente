package com.usjt.a3.exception;

import jakarta.persistence.EntityNotFoundException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;
import java.util.stream.Collectors;

@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {
    // 1. Falha de autenticação (Login/Senha)
    @ExceptionHandler(BadCredentialsException.class)
    public ProblemDetail handleBadCredentials(BadCredentialsException ex) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.
                UNAUTHORIZED, ex.getMessage());
        problem.setTitle("Credenciais Inválidas");
        return problem;
    }

    // 2. Recurso não encontrado
    @ExceptionHandler(EntityNotFoundException.class)
    public ProblemDetail handleEntityNotFound(EntityNotFoundException ex) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.
                NOT_FOUND, ex.getMessage());
        problem.setTitle("Recurso Não Encontrado");
        return problem;
    }

    // 3. Permissão negada (Segurança de propriedade do curral)
    @ExceptionHandler(SecurityException.class)
    public ProblemDetail handleSecurity(SecurityException ex) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.
                FORBIDDEN, ex.getMessage());
        problem.setTitle("Acesso Negado");
        return problem;
    }

    // 4 - Regras de negocio
    @ExceptionHandler(IllegalStateException.class)
    public ProblemDetail handleIllegalState(IllegalStateException ex) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.
                CONFLICT, ex.getMessage());
        problem.setTitle("Conflito de Regra de Negócio");
        return problem;
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ProblemDetail handleValidation(MethodArgumentNotValidException ex) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.BAD_REQUEST,
                "Um ou mais campos são inválidos. Faça o preenchimento correto e tente novamente."
        );
        problem.setTitle("Erro de Validação");

        Map<String, String> invalidFields = ex.getBindingResult()
                .getFieldErrors()
                .stream()
                .collect(Collectors.toMap(
                        FieldError::getField,
                        FieldError::getDefaultMessage,
                        (mensagemExistente, novaMensagem) -> mensagemExistente
                ));

        problem.setProperty("invalidParams", invalidFields);
        return problem;
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ProblemDetail handleNotReadable(HttpMessageNotReadableException ex) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.BAD_REQUEST,
                "O corpo da requisição é inválido ou contém formato incorreto."
        );
        problem.setTitle("Corpo da Requisição Inválido");
        return problem;
    }

    // 7. Erros inesperados / Erro interno do servidor (500)
    @ExceptionHandler(Exception.class)
    public ProblemDetail handleGeneralException(Exception ex) {
        log.error("Erro inesperado capturado pelo GlobalExceptionHandler: ", ex);

        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "Ocorreu um erro interno inesperado no servidor. Tente novamente mais tarde."
        );
        problem.setTitle("Erro Interno do Servidor");
        return problem;
    }

}
