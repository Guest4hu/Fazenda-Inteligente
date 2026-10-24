package com.usjt.a3.test;

import com.usjt.a3.config.security.UserPrincipal;
import com.usjt.a3.model.entity.Animal;
import com.usjt.a3.model.entity.Corral;
import com.usjt.a3.model.entity.Farm;
import com.usjt.a3.model.entity.User;
import com.usjt.a3.model.enums.DeviceStatus;

import java.time.LocalDateTime;

public final class TestFixtures {

    private TestFixtures() {}

    public static UserPrincipal createPrincipal(Long id) {
        return new UserPrincipal(id, "Produtor " + id, "produtor" + id + "@fazenda.com");
    }

    public static User createUser(Long id) {
        return User.builder()
                .id(id)
                .name("Produtor " + id)
                .email("produtor" + id + "@fazenda.com")
                .passwordHash("secret-hash")
                .createdAt(LocalDateTime.now())
                .build();
    }

    public static Farm createFarm(Long id, User user) {
        return Farm.builder()
                .id(id)
                .name("Fazenda Esperança " + id)
                .user(user)
                .createdAt(LocalDateTime.now())
                .build();
    }

    public static Corral createCorral(Long id, Farm farm, String mac) {
        return Corral.builder()
                .id(id)
                .name("Curral Principal " + id)
                .farm(farm)
                .macAddress(mac)
                .limitOdor(400)
                .pumpDurationSeconds(30)
                .deviceStatus(DeviceStatus.ONLINE)
                .lastSeenAt(LocalDateTime.now())
                .build();
    }

    public static Animal createAnimal(Long id, Farm farm, String tag) {
        return Animal.builder()
                .id(id)
                .name("Vaca Mimosa " + id)
                .identification("ID-" + id)
                .tagUid(tag)
                .farm(farm)
                .build();
    }
}
