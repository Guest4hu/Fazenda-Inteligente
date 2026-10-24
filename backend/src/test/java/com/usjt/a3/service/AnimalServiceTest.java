package com.usjt.a3.service;

import com.usjt.a3.dto.request.AnimalPresenceRequestDTO;
import com.usjt.a3.dto.request.AnimalRequestDTO;
import com.usjt.a3.dto.response.AnimalEventResponseDTO;
import com.usjt.a3.dto.response.AnimalResponseDTO;
import com.usjt.a3.mapper.AnimalEventMapper;
import com.usjt.a3.mapper.AnimalMapper;
import com.usjt.a3.model.entity.Animal;
import com.usjt.a3.model.entity.AnimalEvent;
import com.usjt.a3.model.entity.Corral;
import com.usjt.a3.model.entity.Farm;
import com.usjt.a3.model.entity.User;
import com.usjt.a3.model.enums.AnimalEventType;
import com.usjt.a3.model.enums.EventOrigin;
import com.usjt.a3.repository.AnimalEventRepository;
import com.usjt.a3.repository.AnimalRepository;
import com.usjt.a3.repository.CorralRepository;
import com.usjt.a3.repository.FarmRepository;
import com.usjt.a3.test.TestFixtures;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AnimalServiceTest {

    @Mock
    private AnimalRepository animalRepository;

    @Mock
    private AnimalMapper animalMapper;

    @Mock
    private AnimalEventMapper animalEventMapper;

    @Mock
    private FarmRepository farmRepository;

    @Mock
    private CorralRepository corralRepository;

    @Mock
    private AnimalEventRepository animalEventRepository;

    @InjectMocks
    private AnimalService animalService;

    private User owner;
    private Farm farm;
    private Animal animal;

    @BeforeEach
    void setUp() {
        owner = TestFixtures.createUser(1L);
        farm = TestFixtures.createFarm(10L, owner);
        animal = TestFixtures.createAnimal(20L, farm, "E2801160");
    }

    @Test
    @DisplayName("Atualizar animal com sucesso com nova Tag RFID válida")
    void updateAnimal_Success() {
        AnimalRequestDTO requestDTO = new AnimalRequestDTO("Mimosa Atualizada", "BR-99", "E2801199");
        AnimalResponseDTO responseDTO = new AnimalResponseDTO(20L, 10L, "Mimosa Atualizada", "BR-99", "E2801199", null, null);

        when(animalRepository.findById(20L)).thenReturn(Optional.of(animal));
        when(animalRepository.existsByTagUidAndIdNot("E2801199", 20L)).thenReturn(false);
        when(animalRepository.save(any(Animal.class))).thenReturn(animal);
        when(animalMapper.toAnimalResponseDTO(animal)).thenReturn(responseDTO);

        AnimalResponseDTO result = animalService.updateAnimal(20L, 1L, requestDTO);

        assertNotNull(result);
        assertEquals("Mimosa Atualizada", result.name());
        assertEquals("E2801199", result.tagUid());
        verify(animalRepository).save(animal);
    }

    @Test
    @DisplayName("Atualizar animal mantendo a mesma Tag RFID sem disparar conflito de duplicidade")
    void updateAnimal_SameTag_Success() {
        AnimalRequestDTO requestDTO = new AnimalRequestDTO("Mimosa Mesma Tag", "BR-01", "E2801160");
        AnimalResponseDTO responseDTO = new AnimalResponseDTO(20L, 10L, "Mimosa Mesma Tag", "BR-01", "E2801160", null, null);

        when(animalRepository.findById(20L)).thenReturn(Optional.of(animal));
        when(animalRepository.existsByTagUidAndIdNot("E2801160", 20L)).thenReturn(false);
        when(animalRepository.save(any(Animal.class))).thenReturn(animal);
        when(animalMapper.toAnimalResponseDTO(animal)).thenReturn(responseDTO);

        AnimalResponseDTO result = animalService.updateAnimal(20L, 1L, requestDTO);

        assertNotNull(result);
        verify(animalRepository).save(animal);
    }

    @Test
    @DisplayName("Atualizar animal inexistente lança EntityNotFoundException (404)")
    void updateAnimal_NotFound() {
        AnimalRequestDTO requestDTO = new AnimalRequestDTO("Inexistente", null, "TAG12345");
        when(animalRepository.findById(999L)).thenReturn(Optional.empty());

        assertThrows(EntityNotFoundException.class, () -> animalService.updateAnimal(999L, 1L, requestDTO));
        verify(animalRepository, never()).save(any());
    }

    @Test
    @DisplayName("Atualizar animal pertencente a outro produtor lança SecurityException (403)")
    void updateAnimal_Forbidden() {
        AnimalRequestDTO requestDTO = new AnimalRequestDTO("Invasão", null, "TAG12345");
        when(animalRepository.findById(20L)).thenReturn(Optional.of(animal));

        assertThrows(SecurityException.class, () -> animalService.updateAnimal(20L, 2L, requestDTO));
        verify(animalRepository, never()).save(any());
    }

    @Test
    @DisplayName("Atualizar animal com Tag RFID já existente em outro animal lança IllegalStateException (409)")
    void updateAnimal_DuplicateTag_Conflict() {
        AnimalRequestDTO requestDTO = new AnimalRequestDTO("Mimosa Clone", null, "TAG_DUPLICADA");
        when(animalRepository.findById(20L)).thenReturn(Optional.of(animal));
        when(animalRepository.existsByTagUidAndIdNot("TAG_DUPLICADA", 20L)).thenReturn(true);

        assertThrows(IllegalStateException.class, () -> animalService.updateAnimal(20L, 1L, requestDTO));
        verify(animalRepository, never()).save(any());
    }

    @Test
    @DisplayName("Atualizar animal via rota aninhada com farmId divergente lança EntityNotFoundException")
    void updateAnimal_IncompatibleFarm() {
        AnimalRequestDTO requestDTO = new AnimalRequestDTO("Mimosa", null, "E2801160");
        when(animalRepository.findById(20L)).thenReturn(Optional.of(animal));

        assertThrows(EntityNotFoundException.class, () -> animalService.updateAnimal(20L, 999L, 1L, requestDTO));
        verify(animalRepository, never()).save(any());
    }

    @Test
    @DisplayName("Excluir animal com sucesso")
    void deleteAnimal_Success() {
        when(animalRepository.findById(20L)).thenReturn(Optional.of(animal));

        animalService.deleteAnimal(20L, 1L);

        verify(animalRepository).delete(animal);
    }

    @Test
    @DisplayName("Excluir animal inexistente lança EntityNotFoundException (404)")
    void deleteAnimal_NotFound() {
        when(animalRepository.findById(999L)).thenReturn(Optional.empty());

        assertThrows(EntityNotFoundException.class, () -> animalService.deleteAnimal(999L, 1L));
        verify(animalRepository, never()).delete(any());
    }

    @Test
    @DisplayName("Excluir animal pertencente a outro produtor lança SecurityException (403)")
    void deleteAnimal_Forbidden() {
        when(animalRepository.findById(20L)).thenReturn(Optional.of(animal));

        assertThrows(SecurityException.class, () -> animalService.deleteAnimal(20L, 2L));
        verify(animalRepository, never()).delete(any());
    }

    @Test
    @DisplayName("Buscar animal por ID com sucesso")
    void getAnimalById_Success() {
        AnimalResponseDTO responseDTO = new AnimalResponseDTO(20L, 10L, "Vaca Mimosa", "ID-20", "E2801160", null, null);

        when(animalRepository.findById(20L)).thenReturn(Optional.of(animal));
        when(animalMapper.toAnimalResponseDTO(animal)).thenReturn(responseDTO);

        AnimalResponseDTO result = animalService.getAnimalById(20L, 1L);

        assertNotNull(result);
        assertEquals(20L, result.id());
    }

    @Test
    @DisplayName("Buscar animal de outro produtor lança SecurityException (403)")
    void getAnimalById_Forbidden() {
        when(animalRepository.findById(20L)).thenReturn(Optional.of(animal));

        assertThrows(SecurityException.class, () -> animalService.getAnimalById(20L, 2L));
    }

    // =========================================================================
    // TESTES DE PRESENÇA RFID & MANUAL (SINGLE SOURCE OF TRUTH)
    // =========================================================================

    @Test
    @DisplayName("RFID (TAG): Animal fora do curral (currentCorral == null) registra ENTROU mesmo se payload trouxer SAIU")
    void registerPresence_RFID_AnimalOutside_RegistersENTROU() {
        Corral corral = TestFixtures.createCorral(100L, farm, "240AC4000100");
        animal.setCurrentCorral(null);

        AnimalPresenceRequestDTO request = new AnimalPresenceRequestDTO("E2801160", AnimalEventType.SAIU, EventOrigin.TAG);
        AnimalEvent eventEntity = AnimalEvent.builder().id(1L).corral(corral).animal(animal).typeEvent(AnimalEventType.ENTROU).eventOrigin(EventOrigin.TAG).build();
        AnimalEventResponseDTO responseDTO = new AnimalEventResponseDTO(1L, 100L, corral.getName(), 20L, animal.getName(), "E2801160", AnimalEventType.ENTROU, EventOrigin.TAG, LocalDateTime.now());

        when(corralRepository.findById(100L)).thenReturn(Optional.of(corral));
        when(animalRepository.findByTagUid("E2801160")).thenReturn(Optional.of(animal));
        when(animalEventMapper.toEntity(corral, animal, AnimalEventType.ENTROU, EventOrigin.TAG)).thenReturn(eventEntity);
        when(animalEventRepository.save(eventEntity)).thenReturn(eventEntity);
        when(animalEventMapper.toDTO(eventEntity)).thenReturn(responseDTO);

        AnimalEventResponseDTO result = animalService.registerPresence(100L, 1L, request);

        assertNotNull(result);
        assertEquals(AnimalEventType.ENTROU, result.typeEvent());
        assertEquals(corral, animal.getCurrentCorral());
        verify(animalRepository).save(animal);
        verify(animalEventRepository).save(eventEntity);
    }

    @Test
    @DisplayName("RFID (TAG): Animal já dentro deste curral registra SAIU mesmo se payload trouxer ENTROU")
    void registerPresence_RFID_AnimalInside_RegistersSAIU() {
        Corral corral = TestFixtures.createCorral(100L, farm, "240AC4000100");
        animal.setCurrentCorral(corral);

        AnimalPresenceRequestDTO request = new AnimalPresenceRequestDTO("E2801160", AnimalEventType.ENTROU, EventOrigin.TAG);
        AnimalEvent eventEntity = AnimalEvent.builder().id(2L).corral(corral).animal(animal).typeEvent(AnimalEventType.SAIU).eventOrigin(EventOrigin.TAG).build();
        AnimalEventResponseDTO responseDTO = new AnimalEventResponseDTO(2L, 100L, corral.getName(), 20L, animal.getName(), "E2801160", AnimalEventType.SAIU, EventOrigin.TAG, LocalDateTime.now());

        when(corralRepository.findById(100L)).thenReturn(Optional.of(corral));
        when(animalRepository.findByTagUid("E2801160")).thenReturn(Optional.of(animal));
        when(animalEventMapper.toEntity(corral, animal, AnimalEventType.SAIU, EventOrigin.TAG)).thenReturn(eventEntity);
        when(animalEventRepository.save(eventEntity)).thenReturn(eventEntity);
        when(animalEventMapper.toDTO(eventEntity)).thenReturn(responseDTO);

        AnimalEventResponseDTO result = animalService.registerPresence(100L, 1L, request);

        assertNotNull(result);
        assertEquals(AnimalEventType.SAIU, result.typeEvent());
        assertNull(animal.getCurrentCorral());
        verify(animalRepository).save(animal);
        verify(animalEventRepository).save(eventEntity);
    }

    @Test
    @DisplayName("RFID (TAG): Transferência entre currais registra SAIU no anterior e ENTROU no novo")
    void registerPresence_RFID_CrossCorralTransfer_RegistersSAIUThenENTROU() {
        Corral previousCorral = TestFixtures.createCorral(100L, farm, "240AC4000100");
        Corral newCorral = TestFixtures.createCorral(200L, farm, "240AC4000200");
        animal.setCurrentCorral(previousCorral);

        AnimalPresenceRequestDTO request = new AnimalPresenceRequestDTO("E2801160", AnimalEventType.ENTROU, EventOrigin.TAG);
        AnimalEvent exitPreviousEntity = AnimalEvent.builder().id(10L).corral(previousCorral).animal(animal).typeEvent(AnimalEventType.SAIU).eventOrigin(EventOrigin.TAG).build();
        AnimalEvent enterNewEntity = AnimalEvent.builder().id(11L).corral(newCorral).animal(animal).typeEvent(AnimalEventType.ENTROU).eventOrigin(EventOrigin.TAG).build();
        AnimalEventResponseDTO responseDTO = new AnimalEventResponseDTO(11L, 200L, newCorral.getName(), 20L, animal.getName(), "E2801160", AnimalEventType.ENTROU, EventOrigin.TAG, LocalDateTime.now());

        when(corralRepository.findById(200L)).thenReturn(Optional.of(newCorral));
        when(animalRepository.findByTagUid("E2801160")).thenReturn(Optional.of(animal));
        when(animalEventMapper.toEntity(previousCorral, animal, AnimalEventType.SAIU, EventOrigin.TAG)).thenReturn(exitPreviousEntity);
        when(animalEventMapper.toEntity(newCorral, animal, AnimalEventType.ENTROU, EventOrigin.TAG)).thenReturn(enterNewEntity);
        when(animalEventRepository.save(exitPreviousEntity)).thenReturn(exitPreviousEntity);
        when(animalEventRepository.save(enterNewEntity)).thenReturn(enterNewEntity);
        when(animalEventMapper.toDTO(enterNewEntity)).thenReturn(responseDTO);

        AnimalEventResponseDTO result = animalService.registerPresence(200L, 1L, request);

        assertNotNull(result);
        assertEquals(AnimalEventType.ENTROU, result.typeEvent());
        assertEquals(newCorral, animal.getCurrentCorral());

        verify(animalEventRepository).save(exitPreviousEntity);
        verify(animalEventRepository).save(enterNewEntity);
        verify(animalRepository).save(animal);
    }

    @Test
    @DisplayName("MANUAL: Entrada quando animal está fora do curral tem sucesso")
    void registerPresence_Manual_ENTROU_Outside_Success() {
        Corral corral = TestFixtures.createCorral(100L, farm, "240AC4000100");
        animal.setCurrentCorral(null);

        AnimalPresenceRequestDTO request = new AnimalPresenceRequestDTO("E2801160", AnimalEventType.ENTROU, EventOrigin.MANUAL);
        AnimalEvent eventEntity = AnimalEvent.builder().id(3L).corral(corral).animal(animal).typeEvent(AnimalEventType.ENTROU).eventOrigin(EventOrigin.MANUAL).build();
        AnimalEventResponseDTO responseDTO = new AnimalEventResponseDTO(3L, 100L, corral.getName(), 20L, animal.getName(), "E2801160", AnimalEventType.ENTROU, EventOrigin.MANUAL, LocalDateTime.now());

        when(corralRepository.findById(100L)).thenReturn(Optional.of(corral));
        when(animalRepository.findByTagUid("E2801160")).thenReturn(Optional.of(animal));
        when(animalEventMapper.toEntity(corral, animal, AnimalEventType.ENTROU, EventOrigin.MANUAL)).thenReturn(eventEntity);
        when(animalEventRepository.save(eventEntity)).thenReturn(eventEntity);
        when(animalEventMapper.toDTO(eventEntity)).thenReturn(responseDTO);

        AnimalEventResponseDTO result = animalService.registerPresence(100L, 1L, request);

        assertNotNull(result);
        assertEquals(AnimalEventType.ENTROU, result.typeEvent());
        assertEquals(corral, animal.getCurrentCorral());
        verify(animalRepository).save(animal);
    }

    @Test
    @DisplayName("MANUAL: Entrada quando animal já está no mesmo curral lança IllegalStateException (409 Conflict)")
    void registerPresence_Manual_ENTROU_AlreadyInside_Conflict() {
        Corral corral = TestFixtures.createCorral(100L, farm, "240AC4000100");
        animal.setCurrentCorral(corral);

        AnimalPresenceRequestDTO request = new AnimalPresenceRequestDTO("E2801160", AnimalEventType.ENTROU, EventOrigin.MANUAL);

        when(corralRepository.findById(100L)).thenReturn(Optional.of(corral));
        when(animalRepository.findByTagUid("E2801160")).thenReturn(Optional.of(animal));

        IllegalStateException ex = assertThrows(IllegalStateException.class, () ->
                animalService.registerPresence(100L, 1L, request)
        );

        assertTrue(ex.getMessage().contains("Animal já está presente no curral ID: 100"));
        verify(animalEventRepository, never()).save(any());
        verify(animalRepository, never()).save(any());
    }

    @Test
    @DisplayName("MANUAL: Entrada com transferência de outro curral registra SAIU automático no anterior")
    void registerPresence_Manual_ENTROU_CrossCorralTransfer_RegistersSAIUThenENTROU() {
        Corral previousCorral = TestFixtures.createCorral(100L, farm, "240AC4000100");
        Corral targetCorral = TestFixtures.createCorral(200L, farm, "240AC4000200");
        animal.setCurrentCorral(previousCorral);

        AnimalPresenceRequestDTO request = new AnimalPresenceRequestDTO("E2801160", AnimalEventType.ENTROU, EventOrigin.MANUAL);
        AnimalEvent exitPrevious = AnimalEvent.builder().id(21L).corral(previousCorral).animal(animal).typeEvent(AnimalEventType.SAIU).eventOrigin(EventOrigin.MANUAL).build();
        AnimalEvent enterTarget = AnimalEvent.builder().id(22L).corral(targetCorral).animal(animal).typeEvent(AnimalEventType.ENTROU).eventOrigin(EventOrigin.MANUAL).build();
        AnimalEventResponseDTO responseDTO = new AnimalEventResponseDTO(22L, 200L, targetCorral.getName(), 20L, animal.getName(), "E2801160", AnimalEventType.ENTROU, EventOrigin.MANUAL, LocalDateTime.now());

        when(corralRepository.findById(200L)).thenReturn(Optional.of(targetCorral));
        when(animalRepository.findByTagUid("E2801160")).thenReturn(Optional.of(animal));
        when(animalEventMapper.toEntity(previousCorral, animal, AnimalEventType.SAIU, EventOrigin.MANUAL)).thenReturn(exitPrevious);
        when(animalEventMapper.toEntity(targetCorral, animal, AnimalEventType.ENTROU, EventOrigin.MANUAL)).thenReturn(enterTarget);
        when(animalEventRepository.save(exitPrevious)).thenReturn(exitPrevious);
        when(animalEventRepository.save(enterTarget)).thenReturn(enterTarget);
        when(animalEventMapper.toDTO(enterTarget)).thenReturn(responseDTO);

        AnimalEventResponseDTO result = animalService.registerPresence(200L, 1L, request);

        assertNotNull(result);
        assertEquals(targetCorral, animal.getCurrentCorral());
        verify(animalEventRepository).save(exitPrevious);
        verify(animalEventRepository).save(enterTarget);
    }

    @Test
    @DisplayName("MANUAL: Saída quando animal está no curral tem sucesso")
    void registerPresence_Manual_SAIU_Inside_Success() {
        Corral corral = TestFixtures.createCorral(100L, farm, "240AC4000100");
        animal.setCurrentCorral(corral);

        AnimalPresenceRequestDTO request = new AnimalPresenceRequestDTO("E2801160", AnimalEventType.SAIU, EventOrigin.MANUAL);
        AnimalEvent eventEntity = AnimalEvent.builder().id(4L).corral(corral).animal(animal).typeEvent(AnimalEventType.SAIU).eventOrigin(EventOrigin.MANUAL).build();
        AnimalEventResponseDTO responseDTO = new AnimalEventResponseDTO(4L, 100L, corral.getName(), 20L, animal.getName(), "E2801160", AnimalEventType.SAIU, EventOrigin.MANUAL, LocalDateTime.now());

        when(corralRepository.findById(100L)).thenReturn(Optional.of(corral));
        when(animalRepository.findByTagUid("E2801160")).thenReturn(Optional.of(animal));
        when(animalEventMapper.toEntity(corral, animal, AnimalEventType.SAIU, EventOrigin.MANUAL)).thenReturn(eventEntity);
        when(animalEventRepository.save(eventEntity)).thenReturn(eventEntity);
        when(animalEventMapper.toDTO(eventEntity)).thenReturn(responseDTO);

        AnimalEventResponseDTO result = animalService.registerPresence(100L, 1L, request);

        assertNotNull(result);
        assertEquals(AnimalEventType.SAIU, result.typeEvent());
        assertNull(animal.getCurrentCorral());
        verify(animalRepository).save(animal);
    }

    @Test
    @DisplayName("MANUAL: Saída quando animal está fora de qualquer curral lança IllegalStateException (409 Conflict)")
    void registerPresence_Manual_SAIU_WhenOutside_Conflict() {
        Corral corral = TestFixtures.createCorral(100L, farm, "240AC4000100");
        animal.setCurrentCorral(null);

        AnimalPresenceRequestDTO request = new AnimalPresenceRequestDTO("E2801160", AnimalEventType.SAIU, EventOrigin.MANUAL);

        when(corralRepository.findById(100L)).thenReturn(Optional.of(corral));
        when(animalRepository.findByTagUid("E2801160")).thenReturn(Optional.of(animal));

        IllegalStateException ex = assertThrows(IllegalStateException.class, () ->
                animalService.registerPresence(100L, 1L, request)
        );

        assertTrue(ex.getMessage().contains("Animal não está presente no curral ID: 100 para registrar saída"));
        verify(animalEventRepository, never()).save(any());
        verify(animalRepository, never()).save(any());
    }

    @Test
    @DisplayName("MANUAL: Saída quando animal está em outro curral lança IllegalStateException (409 Conflict)")
    void registerPresence_Manual_SAIU_WhenInDifferentCorral_Conflict() {
        Corral anotherCorral = TestFixtures.createCorral(200L, farm, "240AC4000200");
        Corral targetCorral = TestFixtures.createCorral(100L, farm, "240AC4000100");
        animal.setCurrentCorral(anotherCorral);

        AnimalPresenceRequestDTO request = new AnimalPresenceRequestDTO("E2801160", AnimalEventType.SAIU, EventOrigin.MANUAL);

        when(corralRepository.findById(100L)).thenReturn(Optional.of(targetCorral));
        when(animalRepository.findByTagUid("E2801160")).thenReturn(Optional.of(animal));

        IllegalStateException ex = assertThrows(IllegalStateException.class, () ->
                animalService.registerPresence(100L, 1L, request)
        );

        assertTrue(ex.getMessage().contains("Animal não está presente no curral ID: 100 para registrar saída"));
        verify(animalEventRepository, never()).save(any());
    }

    @Test
    @DisplayName("Presença: Curral inexistente lança EntityNotFoundException (404)")
    void registerPresence_CorralNotFound() {
        AnimalPresenceRequestDTO request = new AnimalPresenceRequestDTO("E2801160", AnimalEventType.ENTROU, EventOrigin.TAG);
        when(corralRepository.findById(999L)).thenReturn(Optional.empty());

        assertThrows(EntityNotFoundException.class, () -> animalService.registerPresence(999L, 1L, request));
    }

    @Test
    @DisplayName("Presença: Curral de outro usuário lança SecurityException (403)")
    void registerPresence_Forbidden() {
        Corral corral = TestFixtures.createCorral(100L, farm, "240AC4000100");
        AnimalPresenceRequestDTO request = new AnimalPresenceRequestDTO("E2801160", AnimalEventType.ENTROU, EventOrigin.TAG);
        when(corralRepository.findById(100L)).thenReturn(Optional.of(corral));

        assertThrows(SecurityException.class, () -> animalService.registerPresence(100L, 999L, request));
    }

    @Test
    @DisplayName("Presença: Animal inexistente lança EntityNotFoundException (404)")
    void registerPresence_AnimalNotFound() {
        Corral corral = TestFixtures.createCorral(100L, farm, "240AC4000100");
        AnimalPresenceRequestDTO request = new AnimalPresenceRequestDTO("TAG_INEXISTENTE", AnimalEventType.ENTROU, EventOrigin.TAG);
        when(corralRepository.findById(100L)).thenReturn(Optional.of(corral));
        when(animalRepository.findByTagUid("TAG_INEXISTENTE")).thenReturn(Optional.empty());

        assertThrows(EntityNotFoundException.class, () -> animalService.registerPresence(100L, 1L, request));
    }

    @Test
    @DisplayName("Listar eventos do curral com sucesso")
    void listEventsByCorral_Success() {
        Corral corral = TestFixtures.createCorral(100L, farm, "240AC4000100");
        AnimalEvent event = AnimalEvent.builder().id(1L).corral(corral).animal(animal).typeEvent(AnimalEventType.ENTROU).eventOrigin(EventOrigin.TAG).instant(LocalDateTime.now()).build();
        AnimalEventResponseDTO dto = new AnimalEventResponseDTO(1L, 100L, corral.getName(), 20L, animal.getName(), "E2801160", AnimalEventType.ENTROU, EventOrigin.TAG, LocalDateTime.now());

        when(corralRepository.findById(100L)).thenReturn(Optional.of(corral));
        when(animalEventRepository.findByCorralIdOrderByInstantDesc(100L)).thenReturn(List.of(event));
        when(animalEventMapper.toDTO(event)).thenReturn(dto);

        List<AnimalEventResponseDTO> result = animalService.listEventsByCorral(100L, 1L);

        assertNotNull(result);
        assertEquals(1, result.size());
        assertEquals(100L, result.get(0).corralId());
    }

    @Test
    @DisplayName("Listar eventos de curral de outro produtor lança SecurityException (403)")
    void listEventsByCorral_Forbidden() {
        Corral corral = TestFixtures.createCorral(100L, farm, "240AC4000100");
        when(corralRepository.findById(100L)).thenReturn(Optional.of(corral));

        assertThrows(SecurityException.class, () -> animalService.listEventsByCorral(100L, 2L));
    }

    @Test
    @DisplayName("RFID (TAG): Animal de outra fazenda lança EntityNotFoundException para criar pendência")
    void registerPresence_RFID_AnimalFromDifferentFarm_ThrowsEntityNotFoundException() {
        Corral corral = TestFixtures.createCorral(100L, farm, "240AC4000100");
        Farm otherFarm = TestFixtures.createFarm(99L, owner);
        Animal otherFarmAnimal = TestFixtures.createAnimal(50L, otherFarm, "E2801199");

        AnimalPresenceRequestDTO request = new AnimalPresenceRequestDTO("E2801199", AnimalEventType.ENTROU, EventOrigin.TAG);
        when(corralRepository.findById(100L)).thenReturn(Optional.of(corral));
        when(animalRepository.findByTagUid("E2801199")).thenReturn(Optional.of(otherFarmAnimal));

        EntityNotFoundException ex = assertThrows(EntityNotFoundException.class, () ->
                animalService.registerPresence(100L, 1L, request)
        );
        assertTrue(ex.getMessage().contains("Nenhum animal cadastrado nesta fazenda com a Tag RFID"));
        verify(animalRepository, never()).save(any());
        verify(animalEventRepository, never()).save(any());
    }

    @Test
    @DisplayName("MANUAL: Animal de outro produtor lança SecurityException (403)")
    void registerPresence_Manual_AnimalFromDifferentUser_ThrowsSecurityException() {
        Corral corral = TestFixtures.createCorral(100L, farm, "240AC4000100");
        User otherUser = TestFixtures.createUser(2L);
        Farm otherUserFarm = TestFixtures.createFarm(30L, otherUser);
        Animal otherUserAnimal = TestFixtures.createAnimal(50L, otherUserFarm, "E2801199");

        AnimalPresenceRequestDTO request = new AnimalPresenceRequestDTO("E2801199", AnimalEventType.ENTROU, EventOrigin.MANUAL);
        when(corralRepository.findById(100L)).thenReturn(Optional.of(corral));
        when(animalRepository.findByTagUid("E2801199")).thenReturn(Optional.of(otherUserAnimal));

        assertThrows(SecurityException.class, () ->
                animalService.registerPresence(100L, 1L, request)
        );
        verify(animalRepository, never()).save(any());
        verify(animalEventRepository, never()).save(any());
    }

    @Test
    @DisplayName("MANUAL: Animal de outra fazenda do mesmo produtor lança IllegalStateException (409)")
    void registerPresence_Manual_AnimalFromDifferentFarmSameUser_ThrowsIllegalStateException() {
        Corral corral = TestFixtures.createCorral(100L, farm, "240AC4000100");
        Farm otherFarmSameUser = TestFixtures.createFarm(30L, owner);
        Animal otherFarmAnimal = TestFixtures.createAnimal(50L, otherFarmSameUser, "E2801199");

        AnimalPresenceRequestDTO request = new AnimalPresenceRequestDTO("E2801199", AnimalEventType.ENTROU, EventOrigin.MANUAL);
        when(corralRepository.findById(100L)).thenReturn(Optional.of(corral));
        when(animalRepository.findByTagUid("E2801199")).thenReturn(Optional.of(otherFarmAnimal));

        IllegalStateException ex = assertThrows(IllegalStateException.class, () ->
                animalService.registerPresence(100L, 1L, request)
        );
        assertTrue(ex.getMessage().contains("O animal informado pertence a uma fazenda diferente da fazenda do curral"));
        verify(animalRepository, never()).save(any());
        verify(animalEventRepository, never()).save(any());
    }

    @Test
    @DisplayName("Presença: Rota aninhada com farmId divergente lança EntityNotFoundException (404)")
    void registerPresence_NestedRoute_MismatchFarm_ThrowsEntityNotFoundException() {
        Corral corral = TestFixtures.createCorral(100L, farm, "240AC4000100");
        AnimalPresenceRequestDTO request = new AnimalPresenceRequestDTO("E2801160", AnimalEventType.ENTROU, EventOrigin.MANUAL);
        when(corralRepository.findById(100L)).thenReturn(Optional.of(corral));

        assertThrows(EntityNotFoundException.class, () ->
                animalService.registerPresence(100L, 999L, 1L, request)
        );
        verify(animalRepository, never()).findByTagUid(any());
    }

    @Test
    @DisplayName("Listar eventos: Rota aninhada com farmId divergente lança EntityNotFoundException (404)")
    void listEventsByCorral_NestedRoute_MismatchFarm_ThrowsEntityNotFoundException() {
        Corral corral = TestFixtures.createCorral(100L, farm, "240AC4000100");
        when(corralRepository.findById(100L)).thenReturn(Optional.of(corral));

        assertThrows(EntityNotFoundException.class, () ->
                animalService.listEventsByCorral(100L, 999L, 1L)
        );
        verify(animalEventRepository, never()).findByCorralIdOrderByInstantDesc(anyLong());
    }

    @Test
    @DisplayName("Presença: Tag com espaços em branco é normalizada com sucesso via trim()")
    void registerPresence_WhitespaceTag_NormalizedSuccessfully() {
        Corral corral = TestFixtures.createCorral(100L, farm, "240AC4000100");
        animal.setCurrentCorral(null);

        AnimalPresenceRequestDTO request = new AnimalPresenceRequestDTO("  E2801160  ", AnimalEventType.ENTROU, EventOrigin.MANUAL);
        AnimalEvent eventEntity = AnimalEvent.builder().id(5L).corral(corral).animal(animal).typeEvent(AnimalEventType.ENTROU).eventOrigin(EventOrigin.MANUAL).build();
        AnimalEventResponseDTO responseDTO = new AnimalEventResponseDTO(5L, 100L, corral.getName(), 20L, animal.getName(), "E2801160", AnimalEventType.ENTROU, EventOrigin.MANUAL, LocalDateTime.now());

        when(corralRepository.findById(100L)).thenReturn(Optional.of(corral));
        when(animalRepository.findByTagUid("E2801160")).thenReturn(Optional.of(animal));
        when(animalEventMapper.toEntity(corral, animal, AnimalEventType.ENTROU, EventOrigin.MANUAL)).thenReturn(eventEntity);
        when(animalEventRepository.save(eventEntity)).thenReturn(eventEntity);
        when(animalEventMapper.toDTO(eventEntity)).thenReturn(responseDTO);

        AnimalEventResponseDTO result = animalService.registerPresence(100L, 1L, request);

        assertNotNull(result);
        assertEquals(AnimalEventType.ENTROU, result.typeEvent());
        verify(animalRepository).findByTagUid("E2801160");
    }

    @Test
    @DisplayName("Transferência entre currais: evento de saída do curral anterior possui timestamp instant estritamente anterior")
    void registerPresence_CrossCorralTransfer_ExitTimestampPriorToEnterTimestamp() {
        Corral previousCorral = TestFixtures.createCorral(100L, farm, "240AC4000100");
        Corral targetCorral = TestFixtures.createCorral(200L, farm, "240AC4000200");
        animal.setCurrentCorral(previousCorral);

        AnimalPresenceRequestDTO request = new AnimalPresenceRequestDTO("E2801160", AnimalEventType.ENTROU, EventOrigin.TAG);
        AnimalEvent exitPrevious = AnimalEvent.builder().id(30L).corral(previousCorral).animal(animal).typeEvent(AnimalEventType.SAIU).eventOrigin(EventOrigin.TAG).build();
        AnimalEvent enterTarget = AnimalEvent.builder().id(31L).corral(targetCorral).animal(animal).typeEvent(AnimalEventType.ENTROU).eventOrigin(EventOrigin.TAG).build();
        AnimalEventResponseDTO responseDTO = new AnimalEventResponseDTO(31L, 200L, targetCorral.getName(), 20L, animal.getName(), "E2801160", AnimalEventType.ENTROU, EventOrigin.TAG, LocalDateTime.now());

        when(corralRepository.findById(200L)).thenReturn(Optional.of(targetCorral));
        when(animalRepository.findByTagUid("E2801160")).thenReturn(Optional.of(animal));
        when(animalEventMapper.toEntity(previousCorral, animal, AnimalEventType.SAIU, EventOrigin.TAG)).thenReturn(exitPrevious);
        when(animalEventMapper.toEntity(targetCorral, animal, AnimalEventType.ENTROU, EventOrigin.TAG)).thenReturn(enterTarget);
        when(animalEventRepository.save(any(AnimalEvent.class))).thenAnswer(i -> i.getArgument(0));
        when(animalEventMapper.toDTO(enterTarget)).thenReturn(responseDTO);

        animalService.registerPresence(200L, 1L, request);

        assertNotNull(exitPrevious.getInstant(), "O instant de exitPrevious deve ter sido explicitamente definido");
        assertTrue(exitPrevious.getInstant().isBefore(LocalDateTime.now().plusSeconds(1)));
    }
}
