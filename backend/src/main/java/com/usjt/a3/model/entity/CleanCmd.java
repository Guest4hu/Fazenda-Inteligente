package com.usjt.a3.model.entity;

import com.usjt.a3.model.enums.CleanOrigin;
import com.usjt.a3.model.enums.CleanState;
import jakarta.persistence.*;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Persistent audit record and concurrency-lock entity for corral wash and emergency-stop commands.
 *
 * <p>{@code secondsDuration} allows {@code 0} (used by immediate pump-stop records) up to the
 * 60-second safety cap, while database partial unique indexing ({@code uq_clean_cmd_active_per_corral})
 * restricts active states ({@code PENDENTE} and {@code EM_ANDAMENTO}) to at most one per corral.</p>
 */
@Entity
@Table(name = "clean_cmd")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CleanCmd {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY,  optional = false)
    @JoinColumn(name = "corral_id",  nullable = false)
    private Corral corral;

    @Enumerated(EnumType.STRING)
    @Column(name = "origin" , nullable = false)
    private CleanOrigin cleanOrigin;

    @Enumerated(EnumType.STRING)
    @Column(name = "state", nullable = false)
    private CleanState  cleanState;

    @Column(name = "seconds_duration" ,  nullable = false)
    @Min(0)
    @Max(60)
    private Integer secondsDuration;

    @Column(name = "created_at")
    private LocalDateTime createdAt;



    @PrePersist
    public void prePersist() {
        this.createdAt = LocalDateTime.now();
    }
}
