package com.usjt.a3.model.entity;

import com.usjt.a3.model.enums.AnimalEventType;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Unresolved RFID identification alert generated when an unrecognized or cross-farm tag is read via MQTT.
 *
 * <p>{@link #prePersist()} initializes {@code resolved = false} and stamps the detection {@code instant}.</p>
 */
@Entity
@Table(name = "identify_pendency")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class IdentifyPendency {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "corral_id", nullable = false)
    private Corral corral;

    @Column(name = "tag_uid")
    private String tagUid;

    @Enumerated(EnumType.STRING)
    @Column(name = "type_event")
    private AnimalEventType animalEventType;

    @Column(nullable = false)
    private LocalDateTime instant;

    @Column(nullable = false)
    private Boolean resolved;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "animal_id_resolved")
    private Animal animal;

    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;


    @PrePersist
    public void prePersist() {
        this.instant = LocalDateTime.now();
        this.resolved = false;
    }

}
