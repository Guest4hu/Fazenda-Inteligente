package com.usjt.a3.model.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.PositiveOrZero;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "odor_telemetry")
@Getter
@Setter
@NoArgsConstructor
public class OdorTelemetry {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "corral_id",  nullable = false)
    private Corral corral;

    @Column(nullable = false)
    @PositiveOrZero
    @Max(1000)
    private Integer value;

    @Column(nullable = false, updatable = false)
    private LocalDateTime instant;

    @PrePersist
    public void prePersist()
    {
        this.instant = LocalDateTime.now();
    }
}
