package com.usjt.a3.model.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.PositiveOrZero;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Time-series gas sensor reading from a corral's MQ-135 ADC channel with optional DHT temperature and humidity.
 */
@Entity
@Table(name = "odor_telemetry")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OdorTelemetry {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "corral_id",  nullable = false)
    private Corral corral;

    @Column(nullable = false)
    @PositiveOrZero
    @Max(10000)
    private Integer value;

    @Column(name = "temperature", nullable = true)
    private Double temperature;

    @Column(name = "humidity", nullable = true)
    private Double humidity;

    @Column(nullable = false, updatable = false)
    private LocalDateTime instant;

    @PrePersist
    public void prePersist()
    {
        this.instant = LocalDateTime.now();
    }
}
