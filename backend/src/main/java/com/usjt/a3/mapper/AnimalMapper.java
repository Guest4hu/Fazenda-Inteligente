package com.usjt.a3.mapper;

import com.usjt.a3.dto.request.AnimalRequestDTO;
import com.usjt.a3.dto.response.AnimalResponseDTO;
import com.usjt.a3.model.entity.Animal;
import com.usjt.a3.model.entity.Farm;
import org.springframework.stereotype.Component;

@Component
public class AnimalMapper {
    public AnimalResponseDTO toAnimalResponseDTO(Animal animal) {
        if  (animal == null) {
            return null;
        }

        Long corralId = (animal.getCurrentCorral() != null) ? animal.getCurrentCorral().getId() : null;
        String corralName = (animal.getCurrentCorral() != null) ? animal.getCurrentCorral().getName() : null;

        return new AnimalResponseDTO(
                animal.getId(),
                animal.getFarm().getId(),
                animal.getName(),
                animal.getIdentification(),
                animal.getTagUid(),
                corralId,
                corralName
        );
    }

    public Animal toAnimal(AnimalRequestDTO animalRequestDTO, Farm farm) {
        if (animalRequestDTO == null) {
            return null;
        }

        return Animal.builder()
                .farm(farm)
                .name(animalRequestDTO.name())
                .identification(animalRequestDTO.identification())
                .tagUid(animalRequestDTO.tagUid().toUpperCase())
                .currentCorral(null)
                .build();
    }
}
