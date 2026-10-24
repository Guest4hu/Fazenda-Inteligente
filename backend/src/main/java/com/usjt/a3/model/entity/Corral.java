package com.usjt.a3.model.entity;

import com.usjt.a3.model.enums.DeviceStatus;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import lombok.*;

import java.time.LocalDateTime;
import java.time.LocalTime;

@Entity
@Table(name = "corral")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
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
    @Max(60)
    private Integer pumpDurationSeconds;

    @Enumerated(EnumType.STRING)
    @Column(name = "device_status", nullable = false)
    @Builder.Default
    private DeviceStatus deviceStatus = DeviceStatus.OFFLINE;

    @Column(name = "last_seen_at")
    private LocalDateTime lastSeenAt;

    @PrePersist
    public void prePersist() {
        if (this.deviceStatus == null) {
            this.deviceStatus = DeviceStatus.OFFLINE;
        }
    }




}
