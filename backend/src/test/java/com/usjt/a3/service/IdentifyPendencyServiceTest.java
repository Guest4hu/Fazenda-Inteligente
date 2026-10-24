package com.usjt.a3.service;

import com.usjt.a3.dto.response.IdentifyPendencyResponseDTO;
import com.usjt.a3.mapper.IdentifyPendencyMapper;
import com.usjt.a3.model.entity.Animal;
import com.usjt.a3.model.entity.AnimalEvent;
import com.usjt.a3.model.entity.Corral;
import com.usjt.a3.model.entity.Farm;
import com.usjt.a3.model.entity.IdentifyPendency;
import com.usjt.a3.model.entity.User;
import com.usjt.a3.model.enums.AnimalEventType;
import com.usjt.a3.model.enums.EventOrigin;
import com.usjt.a3.repository.AnimalEventRepository;
import com.usjt.a3.repository.AnimalRepository;
import com.usjt.a3.repository.CorralRepository;
import com.usjt.a3.repository.IdentifyPendencyRepository;
import com.usjt.a3.test.TestFixtures;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("Testes Unitários - IdentifyPendencyService")
class IdentifyPendencyServiceTest {

    @Mock
    private IdentifyPendencyRepository identifyPendencyRepository;

    @Mock
    private CorralRepository corralRepository;

    @Mock
    private AnimalRepository animalRepository;

    @Mock
    private AnimalEventRepository animalEventRepository;

    @Spy
    private IdentifyPendencyMapper identifyPendencyMapper = new IdentifyPendencyMapper();

    @InjectMocks
    private IdentifyPendencyService identifyPendencyService;

    private User owner;
    private User otherUser;
    private Farm farm;
    private Farm otherFarm;
    private Corral corral;
    private Animal animal;
    private IdentifyPendency openPendencyEntrou;
    private IdentifyPendency openPendencySaiu;

    @BeforeEach
    void setUp() {
        owner = TestFixtures.createUser(1L);
        otherUser = TestFixtures.createUser(2L);

        farm = TestFixtures.createFarm(10L, owner);
        otherFarm = TestFixtures.createFarm(20L, owner);

        corral = TestFixtures.createCorral(100L, farm, "240AC4000100");

        animal = TestFixtures.createAnimal(50L, farm, "TAG-CONHECIDA-01");

        openPendencyEntrou = IdentifyPendency.builder()
                .id(1L)
                .corral(corral)
                .tagUid("E2801160")
                .animalEventType(AnimalEventType.ENTROU)
                .instant(LocalDateTime.now().minusMinutes(10))
                .resolved(false)
                .build();

        openPendencySaiu = IdentifyPendency.builder()
                .id(2L)
                .corral(corral)
                .tagUid("A1B2C3D4")
                .animalEventType(AnimalEventType.SAIU)
                .instant(LocalDateTime.now().minusMinutes(5))
                .resolved(false)
                .build();
    }

    // =========================================================================
    // 1. LISTAGEM DE PENDÊNCIAS ABERTAS (listOpenPendencies)
    // =========================================================================
    @Nested
    @DisplayName("1. Listagem de Pendências Abertas")
    class ListOpenPendenciesTests {

        @Test
        @DisplayName("Deve listar pendências abertas do curral com sucesso (200 OK)")
        void listOpenPendencies_Success() {
            when(corralRepository.findById(100L)).thenReturn(Optional.of(corral));
            when(identifyPendencyRepository.findByCorralIdAndResolvedFalseOrderByInstantDesc(100L))
                    .thenReturn(List.of(openPendencySaiu, openPendencyEntrou));

            List<IdentifyPendencyResponseDTO> result = identifyPendencyService.listOpenPendencies(100L, 1L);

            assertNotNull(result);
            assertEquals(2, result.size());
            assertEquals(2L, result.get(0).id());
            assertEquals("A1B2C3D4", result.get(0).tagUid());
            assertEquals(AnimalEventType.SAIU, result.get(0).typeEvent());
            assertFalse(result.get(0).resolved());

            assertEquals(1L, result.get(1).id());
            assertEquals("E2801160", result.get(1).tagUid());
            assertEquals(AnimalEventType.ENTROU, result.get(1).typeEvent());
            assertFalse(result.get(1).resolved());

            verify(corralRepository).findById(100L);
            verify(identifyPendencyRepository).findByCorralIdAndResolvedFalseOrderByInstantDesc(100L);
        }

        @Test
        @DisplayName("Deve retornar lista vazia quando o curral não possuir pendências abertas")
        void listOpenPendencies_EmptyList() {
            when(corralRepository.findById(100L)).thenReturn(Optional.of(corral));
            when(identifyPendencyRepository.findByCorralIdAndResolvedFalseOrderByInstantDesc(100L))
                    .thenReturn(List.of());

            List<IdentifyPendencyResponseDTO> result = identifyPendencyService.listOpenPendencies(100L, 1L);

            assertNotNull(result);
            assertTrue(result.isEmpty());
            verify(identifyPendencyRepository).findByCorralIdAndResolvedFalseOrderByInstantDesc(100L);
        }

        @Test
        @DisplayName("Deve lançar SecurityException (403) quando usuário não for dono do curral")
        void listOpenPendencies_Forbidden() {
            when(corralRepository.findById(100L)).thenReturn(Optional.of(corral));

            SecurityException ex = assertThrows(SecurityException.class, () ->
                    identifyPendencyService.listOpenPendencies(100L, 2L)
            );

            assertTrue(ex.getMessage().contains("permissão"));
            verify(identifyPendencyRepository, never()).findByCorralIdAndResolvedFalseOrderByInstantDesc(anyLong());
        }

        @Test
        @DisplayName("Deve lançar EntityNotFoundException (404) quando curral não existir")
        void listOpenPendencies_CorralNotFound() {
            when(corralRepository.findById(999L)).thenReturn(Optional.empty());

            EntityNotFoundException ex = assertThrows(EntityNotFoundException.class, () ->
                    identifyPendencyService.listOpenPendencies(999L, 1L)
            );

            assertTrue(ex.getMessage().contains("Curral não encontrado"));
            verify(identifyPendencyRepository, never()).findByCorralIdAndResolvedFalseOrderByInstantDesc(anyLong());
        }

        @Test
        @DisplayName("Deve lançar EntityNotFoundException (404) em rota aninhada com farmId divergente")
        void listOpenPendencies_NestedFarmMismatch() {
            when(corralRepository.findById(100L)).thenReturn(Optional.of(corral));

            EntityNotFoundException ex = assertThrows(EntityNotFoundException.class, () ->
                    identifyPendencyService.listOpenPendencies(100L, 999L, 1L)
            );

            assertTrue(ex.getMessage().contains("não pertence à fazenda"));
            verify(identifyPendencyRepository, never()).findByCorralIdAndResolvedFalseOrderByInstantDesc(anyLong());
        }
    }

    // =========================================================================
    // 2. RESOLUÇÃO DE PENDÊNCIA (resolvePendency)
    // =========================================================================
    @Nested
    @DisplayName("2. Resolução de Pendências de Identificação")
    class ResolvePendencyTests {

        @Test
        @DisplayName("Deve resolver pendência do tipo ENTROU: vincula animal, atualiza currentCorral e cria AnimalEvent")
        void resolvePendency_Success_Entrou() {
            when(identifyPendencyRepository.findById(1L)).thenReturn(Optional.of(openPendencyEntrou));
            when(animalRepository.findById(50L)).thenReturn(Optional.of(animal));
            when(identifyPendencyRepository.save(any(IdentifyPendency.class))).thenAnswer(i -> i.getArgument(0));

            IdentifyPendencyResponseDTO response = identifyPendencyService.resolvePendency(1L, 50L, 1L);

            assertNotNull(response);
            assertEquals(1L, response.id());
            assertTrue(response.resolved());
            assertEquals(50L, response.animalIdResolved());
            assertEquals(animal.getName(), response.animalNameResolved());
            assertNotNull(response.resolvedAt());

            // Verifica mutação do animal
            assertEquals(corral, animal.getCurrentCorral());
            verify(animalRepository).save(animal);

            // Verifica criação de evento manual
            ArgumentCaptor<AnimalEvent> eventCaptor = ArgumentCaptor.forClass(AnimalEvent.class);
            verify(animalEventRepository).save(eventCaptor.capture());
            AnimalEvent event = eventCaptor.getValue();
            assertEquals(AnimalEventType.ENTROU, event.getTypeEvent());
            assertEquals(EventOrigin.MANUAL, event.getEventOrigin());
            assertEquals(animal, event.getAnimal());
            assertEquals(corral, event.getCorral());

            // Verifica salvamento da pendência
            verify(identifyPendencyRepository).save(openPendencyEntrou);
            assertTrue(openPendencyEntrou.getResolved());
            assertEquals(animal, openPendencyEntrou.getAnimal());
            assertNotNull(openPendencyEntrou.getResolvedAt());
        }

        @Test
        @DisplayName("Deve resolver pendência do tipo SAIU: vincula animal, limpa currentCorral e cria AnimalEvent")
        void resolvePendency_Success_Saiu() {
            animal.setCurrentCorral(corral); // Animal previamente dentro do curral

            when(identifyPendencyRepository.findById(2L)).thenReturn(Optional.of(openPendencySaiu));
            when(animalRepository.findById(50L)).thenReturn(Optional.of(animal));
            when(identifyPendencyRepository.save(any(IdentifyPendency.class))).thenAnswer(i -> i.getArgument(0));

            IdentifyPendencyResponseDTO response = identifyPendencyService.resolvePendency(2L, 50L, 1L);

            assertNotNull(response);
            assertTrue(response.resolved());
            assertEquals(50L, response.animalIdResolved());
            assertNotNull(response.resolvedAt());

            // Verifica remoção do animal do curral
            assertNull(animal.getCurrentCorral());
            verify(animalRepository).save(animal);

            // Verifica criação de evento de saída
            ArgumentCaptor<AnimalEvent> eventCaptor = ArgumentCaptor.forClass(AnimalEvent.class);
            verify(animalEventRepository).save(eventCaptor.capture());
            AnimalEvent event = eventCaptor.getValue();
            assertEquals(AnimalEventType.SAIU, event.getTypeEvent());
            assertEquals(EventOrigin.MANUAL, event.getEventOrigin());
        }

        @Test
        @DisplayName("Deve lançar SecurityException (403) quando usuário não for dono do curral da pendência")
        void resolvePendency_Forbidden() {
            when(identifyPendencyRepository.findById(1L)).thenReturn(Optional.of(openPendencyEntrou));

            SecurityException ex = assertThrows(SecurityException.class, () ->
                    identifyPendencyService.resolvePendency(1L, 50L, 2L) // userId = 2L
            );

            assertTrue(ex.getMessage().contains("permissão"));
            verify(animalRepository, never()).findById(anyLong());
            verify(animalRepository, never()).save(any());
            verify(identifyPendencyRepository, never()).save(any());
        }

        @Test
        @DisplayName("Deve lançar EntityNotFoundException (404) quando a pendência não existir")
        void resolvePendency_PendencyNotFound() {
            when(identifyPendencyRepository.findById(999L)).thenReturn(Optional.empty());

            EntityNotFoundException ex = assertThrows(EntityNotFoundException.class, () ->
                    identifyPendencyService.resolvePendency(999L, 50L, 1L)
            );

            assertTrue(ex.getMessage().contains("Pendência de identificação não encontrada"));
            verify(animalRepository, never()).findById(anyLong());
        }

        @Test
        @DisplayName("Deve lançar EntityNotFoundException (404) quando o animal selecionado não existir")
        void resolvePendency_AnimalNotFound() {
            when(identifyPendencyRepository.findById(1L)).thenReturn(Optional.of(openPendencyEntrou));
            when(animalRepository.findById(999L)).thenReturn(Optional.empty());

            EntityNotFoundException ex = assertThrows(EntityNotFoundException.class, () ->
                    identifyPendencyService.resolvePendency(1L, 999L, 1L)
            );

            assertTrue(ex.getMessage().contains("Animal não encontrado"));
            verify(identifyPendencyRepository, never()).save(any());
        }

        @Test
        @DisplayName("Deve lançar IllegalStateException (409) quando a pendência já tiver sido resolvida anteriormente")
        void resolvePendency_AlreadyResolved_Conflict() {
            openPendencyEntrou.setResolved(true);
            openPendencyEntrou.setAnimal(animal);
            openPendencyEntrou.setResolvedAt(LocalDateTime.now().minusHours(1));

            when(identifyPendencyRepository.findById(1L)).thenReturn(Optional.of(openPendencyEntrou));

            IllegalStateException ex = assertThrows(IllegalStateException.class, () ->
                    identifyPendencyService.resolvePendency(1L, 50L, 1L)
            );

            assertTrue(ex.getMessage().contains("já foi resolvida"));
            verify(animalRepository, never()).findById(anyLong());
            verify(identifyPendencyRepository, never()).save(any());
        }

        @Test
        @DisplayName("Deve lançar IllegalStateException (409) quando o animal pertencer a uma fazenda diferente do curral")
        void resolvePendency_AnimalDifferentFarm_Conflict() {
            Animal animalOutraFazenda = TestFixtures.createAnimal(99L, otherFarm, "TAG-OUTRA-FAZENDA");

            when(identifyPendencyRepository.findById(1L)).thenReturn(Optional.of(openPendencyEntrou));
            when(animalRepository.findById(99L)).thenReturn(Optional.of(animalOutraFazenda));

            IllegalStateException ex = assertThrows(IllegalStateException.class, () ->
                    identifyPendencyService.resolvePendency(1L, 99L, 1L)
            );

            assertTrue(ex.getMessage().contains("fazenda diferente"));
            verify(animalRepository, never()).save(any());
            verify(identifyPendencyRepository, never()).save(any());
        }
    }

    // =========================================================================
    // 3. CRIAÇÃO DE PENDÊNCIA (createPendency)
    // =========================================================================
    @Nested
    @DisplayName("3. Criação de Pendência (MQTT Unknown Tag)")
    class CreatePendencyTests {

        @Test
        @DisplayName("Deve instanciar e persistir nova IdentifyPendency como não resolvida")
        void createPendency_Success() {
            when(identifyPendencyRepository.save(any(IdentifyPendency.class))).thenAnswer(i -> {
                IdentifyPendency p = i.getArgument(0);
                p.setId(10L);
                return p;
            });

            IdentifyPendency created = identifyPendencyService.createPendency(corral, "E2801160", AnimalEventType.ENTROU);

            assertNotNull(created);
            assertEquals(10L, created.getId());
            assertEquals(corral, created.getCorral());
            assertEquals("E2801160", created.getTagUid());
            assertEquals(AnimalEventType.ENTROU, created.getAnimalEventType());
            assertFalse(created.getResolved());
            assertNotNull(created.getInstant());

            verify(identifyPendencyRepository).save(any(IdentifyPendency.class));
        }

        @Test
        @DisplayName("Deve lançar IllegalArgumentException quando o curral for nulo")
        void createPendency_NullCorral_ThrowsException() {
            IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                    identifyPendencyService.createPendency(null, "E2801160", AnimalEventType.ENTROU)
            );
            assertTrue(ex.getMessage().contains("Curral não pode ser nulo"));
        }
    }
}
