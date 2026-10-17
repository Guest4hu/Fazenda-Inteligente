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
    @Max(50)
    private Integer secondsDuration;

    @Column(name = "created_at")
    private LocalDateTime createdAt;



    @PrePersist
    public void prePersist() {
        this.createdAt = LocalDateTime.now();
    }
}
