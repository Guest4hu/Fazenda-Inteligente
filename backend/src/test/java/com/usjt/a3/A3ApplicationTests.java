package com.usjt.a3;

import com.usjt.a3.dto.response.CleanCmdResponseDTO;
import com.usjt.a3.service.CleanService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
class A3ApplicationTests {

    @Autowired
    private CleanService cleanService;

    @Autowired
    private com.usjt.a3.repository.CorralRepository corralRepository;

    @Test
    void testarDisparoLimpezaComWokwi() {
        System.out.println("\n=======================================================");
        System.out.println(">>> 1. DISPARANDO COMANDO DE LIMPEZA PELO BACKEND... <<<");
        System.out.println("=======================================================");

        corralRepository.findById(1L).ifPresent(corral -> {
            corral.setDeviceStatus(com.usjt.a3.model.enums.DeviceStatus.ONLINE);
            corral.setLastSeenAt(java.time.LocalDateTime.now());
            corralRepository.save(corral);
        });

        // Dispara para o Curral 1, Usuário 1 (o que criamos no banco)
        CleanCmdResponseDTO response = cleanService.triggerManualClean(1L, 1L, null);

        System.out.println("\n=======================================================");
        System.out.println(">>> 2. RESPOSTA FINAL DO FLUXO COMPLETO: <<<");
        System.out.println("Estado do Comando: " + response.state());
        System.out.println("Mensagem: " + response.mensagem());
        System.out.println("UUID do Comando: " + response.id());
        System.out.println("=======================================================\n");
    }
}
