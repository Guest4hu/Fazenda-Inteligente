package com.usjt.a3.model.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.time.LocalTime;

@Entity
@Table(name = "corral")
@Getter
@Setter
@NoArgsConstructor
public class Corral {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "farm_id", nullable = false)
    private Farm farm;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false, length = 12, unique = true)
    @Size(min = 12, max = 12)
    @Pattern(regexp = "^[0-9A-F]{12}$")
    private String macAddress;

    @Column(name = "clean_time" , nullable = true)
    private LocalTime cleanTime;

    @Column(name = "limit_odor", nullable = true)
    @PositiveOrZero
    private Integer limitOdor;

    @Column(name = "pump_duration_seconds" , nullable = true)
    @Positive
    @Max(30)
    private Integer pumpDurationSeconds;


}
