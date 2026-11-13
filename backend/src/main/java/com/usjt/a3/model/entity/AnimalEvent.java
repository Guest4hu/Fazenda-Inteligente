package com.usjt.a3.model.entity;

import com.usjt.a3.model.enums.AnimalEventType;
import com.usjt.a3.model.enums.EventOrigin;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Immutable historical movement log entry recording an animal's entry or exit event at a corral.
 */
@Entity
@Table(name = "animal_event")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AnimalEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "corral_id", nullable = false)
    private Corral corral;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "animal_id", nullable = false)
    private Animal animal;

    @Enumerated(EnumType.STRING)
    @Column(name = "type_event", nullable = false)
    private AnimalEventType typeEvent;

    @Enumerated(EnumType.STRING)
    @Column(name = "origin" , nullable = false)
    private EventOrigin eventOrigin;

    @Column(updatable = false, nullable = false)
    private LocalDateTime instant;

    @PrePersist
    public void prePersist() {
        if (this.instant == null) {
            this.instant = LocalDateTime.now();
        }
    }
}
