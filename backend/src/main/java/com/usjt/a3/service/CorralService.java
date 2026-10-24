package com.usjt.a3.service;

import com.usjt.a3.dto.request.CorralParametersRequestDTO;
import com.usjt.a3.dto.request.CorralRequestDTO;
import com.usjt.a3.dto.response.CorralMetricsResponseDTO;
import com.usjt.a3.dto.response.CorralResponseDTO;
import com.usjt.a3.mapper.CorralMapper;
import com.usjt.a3.model.entity.Corral;
import com.usjt.a3.model.entity.Farm;
import com.usjt.a3.model.enums.CleanOrigin;
import com.usjt.a3.model.enums.CleanState;
import com.usjt.a3.model.enums.DeviceStatus;
import com.usjt.a3.repository.AnimalRepository;
import com.usjt.a3.repository.CleanCmdRepository;
import com.usjt.a3.repository.CorralRepository;
import com.usjt.a3.repository.FarmRepository;
import com.usjt.a3.repository.IdentifyPendencyRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class CorralService {
    private final CorralRepository corralRepository;
    private final CorralMapper corralMapper;
    private final FarmRepository farmRepository;
    private final CleanCmdRepository cleanCmdRepository;
    private final AnimalRepository animalRepository;
    private final IdentifyPendencyRepository identifyPendencyRepository;

    @Autowired(required = false)
    private CorralSseService corralSseService;

    public CorralResponseDTO createCorral(CorralRequestDTO corralRequestDTO, Long userId, Long farmId) {
        Farm farm = farmRepository.findById(farmId).orElseThrow(() -> new EntityNotFoundException("Farm não encontrada"));

        if (!farm.getUser().getId().equals(userId)) {
            throw new SecurityException("Voce não tem permissao para cadastrar currais nesta fazenda");
        }

        String mac = corralRequestDTO.macAddress().replace(":", "").replace("-", "").trim().toUpperCase();
        if (corralRepository.existsByMacAddress(mac)) {
            throw new IllegalStateException("Ja existe um curral cadastrado com este MAC Address");
        }
        Corral corral = corralMapper.toEntity(corralRequestDTO, farm);
        corral.setMacAddress(mac);

        return corralMapper.toCorralResponseDTO(corralRepository.save(corral));
    }

    public List<CorralResponseDTO> listCorrals(Long userId, Long farmId) {
        Farm farm = farmRepository.findById(farmId).orElseThrow(() -> new EntityNotFoundException("Nenhuma fazenda com este id encontrada"));

        if (!farm.getUser().getId().equals(userId)) {
            throw new SecurityException("Voce não tem permissão para visualizar currais desta fazenda");
        }

        return corralRepository.findByFarmId(farmId)
                .stream()
                .map(corralMapper::toCorralResponseDTO)
                .toList();
    }

    public CorralResponseDTO getCorralById(Long corralId, Long userId) {
        Corral corral = corralRepository.findById(corralId)
                .orElseThrow(() -> new EntityNotFoundException("Curral não encontrado com ID: " + corralId));

        if (!corral.getFarm().getUser().getId().equals(userId)) {
            throw new SecurityException("Você não tem permissão para visualizar este curral");
        }

        return corralMapper.toCorralResponseDTO(corral);
    }

    public CorralResponseDTO getCorralById(Long corralId, Long farmId, Long userId) {
        Corral corral = corralRepository.findById(corralId)
                .orElseThrow(() -> new EntityNotFoundException("Curral não encontrado com ID: " + corralId));

        if (!corral.getFarm().getUser().getId().equals(userId)) {
            throw new SecurityException("Você não tem permissão para visualizar este curral");
        }

        if (farmId != null && !corral.getFarm().getId().equals(farmId)) {
            throw new EntityNotFoundException("Curral não pertence à fazenda informada");
        }

        return corralMapper.toCorralResponseDTO(corral);
    }

    public CorralResponseDTO findCorralById(Long corralId, Long userId) {
        return getCorralById(corralId, userId);
    }

    @Transactional
    public CorralResponseDTO updateCorral(Long corralId, CorralRequestDTO dto, Long userId) {
        return updateCorral(corralId, null, userId, dto);
    }

    @Transactional
    public CorralResponseDTO updateCorral(Long corralId, Long farmId, Long userId, CorralRequestDTO dto) {
        Corral corral = corralRepository.findById(corralId)
                .orElseThrow(() -> new EntityNotFoundException("Curral não encontrado com ID: " + corralId));

        if (!corral.getFarm().getUser().getId().equals(userId)) {
            throw new SecurityException("Você não tem permissão para editar este curral");
        }

        if (farmId != null && !corral.getFarm().getId().equals(farmId)) {
            throw new EntityNotFoundException("Curral não pertence à fazenda informada");
        }

        String normalizedMac = dto.macAddress().replace(":", "").replace("-", "").trim().toUpperCase();
        if (corralRepository.existsByMacAddressAndIdNot(normalizedMac, corralId)) {
            throw new IllegalStateException("Já existe um curral cadastrado com este MAC Address: " + normalizedMac);
        }

        corral.setName(dto.name().trim());
        corral.setMacAddress(normalizedMac);
        corral.setCleanTime(dto.cleanTime());
        corral.setLimitOdor(dto.limitOdor() != null ? dto.limitOdor() : 400);
        corral.setPumpDurationSeconds(dto.pumpDurationSeconds() != null ? dto.pumpDurationSeconds() : 30);

        Corral saved = corralRepository.save(corral);
        log.info("Curral ID {} atualizado com sucesso pelo usuário ID {}", corralId, userId);
        return corralMapper.toCorralResponseDTO(saved);
    }

    @Transactional
    public void deleteCorral(Long corralId, Long userId) {
        deleteCorral(corralId, null, userId);
    }

    @Transactional
    public void deleteCorral(Long corralId, Long farmId, Long userId) {
        Corral corral = corralRepository.findById(corralId)
                .orElseThrow(() -> new EntityNotFoundException("Curral não encontrado com ID: " + corralId));

        if (!corral.getFarm().getUser().getId().equals(userId)) {
            throw new SecurityException("Você não tem permissão para excluir este curral");
        }

        if (farmId != null && !corral.getFarm().getId().equals(farmId)) {
            throw new EntityNotFoundException("Curral não pertence à fazenda informada");
        }

        boolean hasActiveCleaning = cleanCmdRepository.existsByCorralIdAndCleanState(corralId, CleanState.EM_ANDAMENTO)
                || cleanCmdRepository.existsByCorralIdAndCleanState(corralId, CleanState.PENDENTE);

        if (hasActiveCleaning) {
            throw new IllegalStateException("Não é possível excluir o curral pois há uma limpeza em andamento");
        }

        corralRepository.delete(corral);
        log.info("Curral ID {} excluído com sucesso pelo usuário ID {}", corralId, userId);
    }

    @Transactional
    public CorralResponseDTO updateParameters(Long corralId, CorralParametersRequestDTO dto, Long userId) {
        return updateParameters(corralId, null, userId, dto);
    }

    @Transactional
    public CorralResponseDTO updateParameters(Long corralId, Long userId, CorralParametersRequestDTO dto) {
        return updateParameters(corralId, null, userId, dto);
    }

    @Transactional
    public CorralResponseDTO updateParameters(Long corralId, Long farmId, Long userId, CorralParametersRequestDTO dto) {
        Corral corral = corralRepository.findById(corralId)
                .orElseThrow(() -> new EntityNotFoundException("Curral não encontrado com ID: " + corralId));

        if (!corral.getFarm().getUser().getId().equals(userId)) {
            throw new SecurityException("Você não tem permissão para editar os parâmetros deste curral");
        }

        if (farmId != null && !corral.getFarm().getId().equals(farmId)) {
            throw new EntityNotFoundException("Curral não pertence à fazenda informada");
        }

        corral.setCleanTime(dto.cleanTime());

        if (dto.limitOdor() != null) {
            corral.setLimitOdor(dto.limitOdor());
        } else if (corral.getLimitOdor() == null) {
            corral.setLimitOdor(400);
        }

        if (dto.pumpDurationSeconds() != null) {
            corral.setPumpDurationSeconds(dto.pumpDurationSeconds());
        } else if (corral.getPumpDurationSeconds() == null) {
            corral.setPumpDurationSeconds(30);
        }

        Corral saved = corralRepository.save(corral);
        log.info("Parâmetros operacionais do curral ID {} atualizados pelo usuário ID {}", corralId, userId);
        return corralMapper.toCorralResponseDTO(saved);
    }

    @Transactional(readOnly = true)
    public CorralMetricsResponseDTO getCorralMetrics(Long corralId, Long userId) {
        return getCorralMetrics(corralId, null, userId);
    }

    @Transactional(readOnly = true)
    public CorralMetricsResponseDTO getCorralMetrics(Long corralId, Long farmId, Long userId) {
        Corral corral = corralRepository.findById(corralId)
                .orElseThrow(() -> new EntityNotFoundException("Curral não encontrado com ID: " + corralId));

        if (!corral.getFarm().getUser().getId().equals(userId)) {
            throw new SecurityException("Você não tem permissão para visualizar as métricas deste curral");
        }

        if (farmId != null && !corral.getFarm().getId().equals(farmId)) {
            throw new EntityNotFoundException("Curral não pertence à fazenda informada");
        }

        long totalAnimaisNoCurral = animalRepository != null ? animalRepository.countByCurrentCorralId(corralId) : 0L;
        long totalAnimaisNaFazenda = animalRepository != null ? animalRepository.countByFarmId(corral.getFarm().getId()) : 0L;

        LocalDateTime startOfDay = LocalDate.now().atStartOfDay();

        long limpezasHojeManual = cleanCmdRepository != null ? cleanCmdRepository.countByCorralIdAndCleanOriginAndCreatedAtGreaterThanEqual(
                corralId, CleanOrigin.MANUAL, startOfDay
        ) : 0L;
        long limpezasHojeOdor = cleanCmdRepository != null ? cleanCmdRepository.countByCorralIdAndCleanOriginAndCreatedAtGreaterThanEqual(
                corralId, CleanOrigin.EVENTO, startOfDay
        ) : 0L;
        long limpezasHojeAutomatica = cleanCmdRepository != null ? cleanCmdRepository.countByCorralIdAndCleanOriginAndCreatedAtGreaterThanEqual(
                corralId, CleanOrigin.AUTOMATICA, startOfDay
        ) : 0L;
        long limpezasHojeTotal = limpezasHojeManual + limpezasHojeOdor + limpezasHojeAutomatica;

        long pendenciasAbertas = identifyPendencyRepository != null ? identifyPendencyRepository.countByCorralIdAndResolvedFalse(corralId) : 0L;

        CorralMetricsResponseDTO dto = (corralMapper != null) ? corralMapper.toCorralMetricsResponseDTO(
                corral,
                totalAnimaisNoCurral,
                totalAnimaisNaFazenda,
                limpezasHojeTotal,
                limpezasHojeManual,
                limpezasHojeOdor,
                limpezasHojeAutomatica,
                pendenciasAbertas
        ) : null;

        if (dto != null) {
            return dto;
        }

        return new CorralMetricsResponseDTO(
                corral.getId(),
                corral.getName(),
                corral.getFarm().getId(),
                corral.getFarm().getName(),
                totalAnimaisNoCurral,
                totalAnimaisNaFazenda,
                limpezasHojeTotal,
                limpezasHojeManual,
                limpezasHojeOdor,
                limpezasHojeAutomatica,
                resolveEffectiveStatus(corral),
                corral.getLastSeenAt(),
                pendenciasAbertas
        );
    }

    private DeviceStatus resolveEffectiveStatus(Corral corral) {
        if (corralMapper != null) {
            DeviceStatus s = corralMapper.resolveEffectiveStatus(corral);
            if (s != null) {
                return s;
            }
        }
        if (corral == null || corral.getDeviceStatus() == null || corral.getDeviceStatus() == DeviceStatus.OFFLINE) {
            return DeviceStatus.OFFLINE;
        }
        if (corral.getLastSeenAt() == null) {
            return DeviceStatus.OFFLINE;
        }
        if (corral.getLastSeenAt().isBefore(LocalDateTime.now().minusSeconds(60L))) {
            return DeviceStatus.OFFLINE;
        }
        return DeviceStatus.ONLINE;
    }

    public void updateDeviceStatus(String macAddress, DeviceStatus status) {
        String normalizedMac = macAddress.replace(":", "").replace("-", "").trim().toUpperCase();
        corralRepository.findByMacAddress(normalizedMac).ifPresentOrElse(corral -> {
            corral.setDeviceStatus(status);
            if (status == DeviceStatus.ONLINE) {
                corral.setLastSeenAt(LocalDateTime.now());
            }
            Corral saved = corralRepository.save(corral);
            log.info("Status do curral MAC {} atualizado para {}", normalizedMac, status);
            if (corralSseService != null && corralMapper != null) {
                corralSseService.sendEvent(saved.getId(), "status", corralMapper.toCorralResponseDTO(saved));
            }
        }, () -> log.warn("Status recebido de curral não cadastrado: MAC {}", normalizedMac));
    }
}

