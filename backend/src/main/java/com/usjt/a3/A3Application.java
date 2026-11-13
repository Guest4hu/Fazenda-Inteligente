package com.usjt.a3;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Application entry point for the Smart Corral Automation backend.
 *
 * <p>Enables Spring's task scheduling alongside Spring Boot auto-configuration
 * to support periodic automatic cleaning checks via {@code @Scheduled} workers.</p>
 */
@SpringBootApplication
@EnableScheduling
public class A3Application {

	public static void main(String[] args) {
		SpringApplication.run(A3Application.class, args);
	}

}
