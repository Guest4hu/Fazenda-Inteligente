package com.usjt.a3.model.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.awt.*;

@Entity
@Table(name = "animals")
@Getter
@Setter
@NoArgsConstructor
public class Animal {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY , optional = false)
    @JoinColumn(name = "farm_id")
    private Farm farm;

    @Column(nullable = false, length = 50)
    @Size(min = 1, max = 50)
    private String name;

    @Column( unique = true)
    @Size(min = 1, max = 30)
    private String identification;

    @Column(name = "tag_uid", nullable = false, length = 30, unique = true)
    private String tagUid;


    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "current_corral_id")
    private Corral currentCorral;



}
