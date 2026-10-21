package com.usjt.a3.mapper;

import com.usjt.a3.dto.response.CleanCmdResponseDTO;
import com.usjt.a3.model.entity.CleanCmd;
import com.usjt.a3.model.entity.Corral;
import com.usjt.a3.model.enums.CleanOrigin;
import com.usjt.a3.model.enums.CleanState;
import org.springframework.stereotype.Component;

@Component
public class CleanCmdMapper {


    public CleanCmdResponseDTO toDto(CleanCmd cleanCmd, String mensagem) {
        if (cleanCmd == null) {
            return null;
        }

        return new CleanCmdResponseDTO(
                cleanCmd.getId(),
                cleanCmd.getCorral().getId(),
                cleanCmd.getCleanOrigin(),
                cleanCmd.getCleanState(),
                cleanCmd.getSecondsDuration(),
                cleanCmd.getCreatedAt(),
                mensagem
        );
    }
    public CleanCmdResponseDTO toDTO(CleanCmd cmd) {
        return toDto(cmd, null);
    }

    public CleanCmd toEntity(Corral corral, CleanOrigin origin, Integer duration) {
        return CleanCmd.builder()
                .corral(corral)
                .cleanOrigin(origin)
                .cleanState(CleanState.EM_ANDAMENTO)
                .secondsDuration(duration)
                .build();
    }
}
