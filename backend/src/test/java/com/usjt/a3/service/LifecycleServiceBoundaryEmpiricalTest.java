package com.usjt.a3.service;

import com.usjt.a3.dto.request.AnimalRequestDTO;
import com.usjt.a3.dto.request.CorralRequestDTO;
import com.usjt.a3.dto.request.FarmRequestDTO;
import com.usjt.a3.dto.response.AnimalResponseDTO;
import com.usjt.a3.dto.response.CorralResponseDTO;
import com.usjt.a3.mapper.AnimalMapper;
import com.usjt.a3.mapper.CorralMapper;
import com.usjt.a3.mapper.FarmMapper;
import com.usjt.a3.model.entity.Animal;
import com.usjt.a3.model.entity.Corral;
import com.usjt.a3.model.entity.Farm;
import com.usjt.a3.model.entity.User;
import com.usjt.a3.repository.AnimalRepository;
import com.usjt.a3.repository.CleanCmdRepository;
import com.usjt.a3.repository.CorralRepository;
import com.usjt.a3.repository.FarmRepository;
import com.usjt.a3.test.TestFixtures;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class LifecycleServiceBoundaryEmpiricalTest {

    @Mock
    private FarmRepository farmRepository;
    @Mock
    private CleanCmdRepository cleanCmdRepository;
    @Mock
    private FarmMapper farmMapper;

    @InjectMocks
    private FarmService farmService;

    @Mock
    private CorralRepository corralRepository;
    @Mock
    private CorralMapper corralMapper;

    @InjectMocks
    private CorralService corralService;

    @Mock
    private AnimalRepository animalRepository;
    @Mock
    private AnimalMapper animalMapper;

    @InjectMocks
    private AnimalService animalService;

    private User user;
    private Farm farm;
    private Corral corral;
    private Animal animal;

    @BeforeEach
    void setUp() {
        user = TestFixtures.createUser(1L);
        farm = TestFixtures.createFarm(10L, user);
        corral = TestFixtures.createCorral(5L, farm, "240AC4000110");
        animal = TestFixtures.createAnimal(20L, farm, "E2801160");
    }

    @Nested
    @DisplayName("Negative IDs Boundary Challenges")
    class NegativeIdsTests {

        @Test
        @DisplayName("FarmService lança EntityNotFoundException para farmId negativo (-1)")
        void farmService_negativeId() {
            when(farmRepository.findById(-1L)).thenReturn(Optional.empty());

            FarmRequestDTO dto = new FarmRequestDTO("Fazenda Valida");
            assertThatThrownBy(() -> farmService.updateFarm(-1L, dto, 1L))
                    .isInstanceOf(EntityNotFoundException.class)
                    .hasMessageContaining("-1");

            assertThatThrownBy(() -> farmService.deleteFarm(-1L, 1L))
                    .isInstanceOf(EntityNotFoundException.class)
                    .hasMessageContaining("-1");
        }

        @Test
        @DisplayName("CorralService lança EntityNotFoundException para corralId negativo (-5)")
        void corralService_negativeId() {
            when(corralRepository.findById(-5L)).thenReturn(Optional.empty());

            CorralRequestDTO dto = new CorralRequestDTO("Curral Valido", "240AC4000110", null, 400, 30);
            assertThatThrownBy(() -> corralService.updateCorral(-5L, null, 1L, dto))
                    .isInstanceOf(EntityNotFoundException.class)
                    .hasMessageContaining("-5");

            assertThatThrownBy(() -> corralService.deleteCorral(-5L, null, 1L))
                    .isInstanceOf(EntityNotFoundException.class)
                    .hasMessageContaining("-5");

            assertThatThrownBy(() -> corralService.getCorralById(-5L, null, 1L))
                    .isInstanceOf(EntityNotFoundException.class)
                    .hasMessageContaining("-5");
        }

        @Test
        @DisplayName("AnimalService lança EntityNotFoundException para animalId negativo (-20)")
        void animalService_negativeId() {
            when(animalRepository.findById(-20L)).thenReturn(Optional.empty());

            AnimalRequestDTO dto = new AnimalRequestDTO("Animal Valido", "BR-01", "E2801160");
            assertThatThrownBy(() -> animalService.updateAnimal(-20L, null, 1L, dto))
                    .isInstanceOf(EntityNotFoundException.class)
                    .hasMessageContaining("-20");

            assertThatThrownBy(() -> animalService.deleteAnimal(-20L, null, 1L))
                    .isInstanceOf(EntityNotFoundException.class)
                    .hasMessageContaining("-20");

            assertThatThrownBy(() -> animalService.getAnimalById(-20L, null, 1L))
                    .isInstanceOf(EntityNotFoundException.class)
                    .hasMessageContaining("-20");
        }
    }

    @Nested
    @DisplayName("Dual-Path Routing Consistency & Farm Mismatch Challenges")
    class DualPathRoutingTests {

        @Test
        @DisplayName("CorralService lança EntityNotFoundException quando farmId fornecido não corresponde ao farmId do curral")
        void corralService_farmIdMismatch() {
            when(corralRepository.findById(5L)).thenReturn(Optional.of(corral));

            CorralRequestDTO dto = new CorralRequestDTO("Curral Mismatch", "240AC4000110", null, 400, 30);

            // corral.getFarm().getId() é 10L, mas a rota informa farmId = 99L
            assertThatThrownBy(() -> corralService.updateCorral(5L, 99L, 1L, dto))
                    .isInstanceOf(EntityNotFoundException.class)
                    .hasMessageContaining("Curral não pertence à fazenda informada");

            assertThatThrownBy(() -> corralService.deleteCorral(5L, 99L, 1L))
                    .isInstanceOf(EntityNotFoundException.class)
                    .hasMessageContaining("Curral não pertence à fazenda informada");

            assertThatThrownBy(() -> corralService.getCorralById(5L, 99L, 1L))
                    .isInstanceOf(EntityNotFoundException.class)
                    .hasMessageContaining("Curral não pertence à fazenda informada");

            verify(corralRepository, never()).delete(any());
        }

        @Test
        @DisplayName("AnimalService lança EntityNotFoundException quando farmId fornecido não corresponde ao farmId do animal")
        void animalService_farmIdMismatch() {
            when(animalRepository.findById(20L)).thenReturn(Optional.of(animal));

            AnimalRequestDTO dto = new AnimalRequestDTO("Animal Mismatch", "BR-01", "E2801160");

            // animal.getFarm().getId() é 10L, mas a rota informa farmId = 99L
            assertThatThrownBy(() -> animalService.updateAnimal(20L, 99L, 1L, dto))
                    .isInstanceOf(EntityNotFoundException.class)
                    .hasMessageContaining("não pertence à fazenda ID 99");

            assertThatThrownBy(() -> animalService.deleteAnimal(20L, 99L, 1L))
                    .isInstanceOf(EntityNotFoundException.class)
                    .hasMessageContaining("não pertence à fazenda ID 99");

            assertThatThrownBy(() -> animalService.getAnimalById(20L, 99L, 1L))
                    .isInstanceOf(EntityNotFoundException.class)
                    .hasMessageContaining("não pertence à fazenda ID 99");

            verify(animalRepository, never()).delete(any());
        }

        @Test
        @DisplayName("CorralService funciona identicamente com farmId correto e farmId null (rota aninhada vs direta)")
        void corralService_directVsNestedConsistency() {
            when(corralRepository.findById(5L)).thenReturn(Optional.of(corral));
            when(corralRepository.existsByMacAddressAndIdNot("240AC4000110", 5L)).thenReturn(false);
            when(corralRepository.save(any(Corral.class))).thenReturn(corral);
            when(corralMapper.toCorralResponseDTO(any(Corral.class)))
                    .thenReturn(new CorralResponseDTO(5L, 10L, "Curral 01", "240AC4000110", null, 400, 30, null, null));

            CorralRequestDTO dto = new CorralRequestDTO("Curral 01", "240AC4000110", null, 400, 30);

            // Rota Direta (farmId = null)
            CorralResponseDTO resDirect = corralService.updateCorral(5L, null, 1L, dto);
            assertThat(resDirect).isNotNull();
            assertThat(resDirect.id()).isEqualTo(5L);

            // Rota Aninhada (farmId = 10L)
            CorralResponseDTO resNested = corralService.updateCorral(5L, 10L, 1L, dto);
            assertThat(resNested).isNotNull();
            assertThat(resNested.id()).isEqualTo(5L);
        }
    }

    @Nested
    @DisplayName("Normalization and Edge-case Data Sanitization")
    class DataSanitizationTests {

        @Test
        @DisplayName("CorralService normaliza MAC minúsculo e com delimitadores para formato padrão em caixa alta")
        void corralService_macNormalization() {
            when(corralRepository.findById(5L)).thenReturn(Optional.of(corral));
            when(corralRepository.existsByMacAddressAndIdNot("240AC4000110", 5L)).thenReturn(false);
            when(corralRepository.save(any(Corral.class))).thenAnswer(invocation -> invocation.getArgument(0));
            when(corralMapper.toCorralResponseDTO(any(Corral.class)))
                    .thenAnswer(invocation -> {
                        Corral c = invocation.getArgument(0);
                        return new CorralResponseDTO(c.getId(), 10L, c.getName(), c.getMacAddress(), null, 400, 30, null, null);
                    });

            CorralRequestDTO dto = new CorralRequestDTO("Curral Normalizado", "24:0a:c4:00:01:10", null, 400, 30);
            CorralResponseDTO response = corralService.updateCorral(5L, null, 1L, dto);

            assertThat(response.macAddress()).isEqualTo("240AC4000110");
            assertThat(corral.getMacAddress()).isEqualTo("240AC4000110");
        }

        @Test
        @DisplayName("AnimalService normaliza Tag RFID minúscula e com espaços para caixa alta trimmed")
        void animalService_tagNormalization() {
            when(animalRepository.findById(20L)).thenReturn(Optional.of(animal));
            when(animalRepository.existsByTagUidAndIdNot("E2801199", 20L)).thenReturn(false);
            when(animalRepository.save(any(Animal.class))).thenAnswer(invocation -> invocation.getArgument(0));
            when(animalMapper.toAnimalResponseDTO(any(Animal.class)))
                    .thenAnswer(invocation -> {
                        Animal a = invocation.getArgument(0);
                        return new AnimalResponseDTO(a.getId(), 10L, a.getName(), a.getIdentification(), a.getTagUid(), null, null);
                    });

            AnimalRequestDTO dto = new AnimalRequestDTO("  Mimosa Normalizada  ", "  BR-99  ", "  e2801199  ");
            AnimalResponseDTO response = animalService.updateAnimal(20L, null, 1L, dto);

            assertThat(response.name()).isEqualTo("Mimosa Normalizada");
            assertThat(response.identification()).isEqualTo("BR-99");
            assertThat(response.tagUid()).isEqualTo("E2801199");
            assertThat(animal.getTagUid()).isEqualTo("E2801199");
        }
    }
}
