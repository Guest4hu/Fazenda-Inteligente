# 🌾 Curral Inteligente — Firmware IoT V2 (Sensor PIR & Relé Active-LOW)

Esta versão alternativa do firmware IoT substitui a leitura de brincos RFID (MFRC522) pelo **Sensor PIR de Presença e Movimento** (GPIO 27) e aplica a **correção da lógica elétrica do módulo relé físico (Active-LOW)** no pino GPIO 26.

---

## 1. O que há de novo na V2

| Funcionalidade | Versão Original (`/Iot`) | Versão V2 (`/IotV2`) |
|---|---|---|
| **Sensor de Presença** | Leitor RFID MFRC522 (SPI) | **Sensor de Movimento PIR (GPIO 27)** |
| **Detecção de Passagem** | Aproximação de cartão RFID | **1ª detecção: `ENTROU` / 2ª detecção: `SAIU`** |
| **Payload para o Backend** | UID lido pelo RFID | **Tag RFID mockada/fixa (`E2801160`)** |
| **Lógica do Relé (GPIO 26)** | Incorreta (`HIGH` para ligar) | **Correta Active-LOW (`LOW` liga / `HIGH` desliga)** |
| **Dependências de Bibliotecas** | PubSubClient, ArduinoJson, DHT, MFRC522 | **PubSubClient, ArduinoJson, DHT** (Sem MFRC522) |
| **Simulação Wokwi** | `diagram.json` com RFID | `diagram.json` com `wokwi-pir-motion-sensor` e relé PNP |

---

## 2. Lógica Elétrica do Relé Físico (Active-LOW)

Os módulos de relé comerciais de 1, 2 ou 4 canais acoplados por optoacoplador são **Active-LOW**:
- **Nível Lógico `LOW` (0V):** Ativa o optoacoplador, fecha o contato Normalmente Aberto (NO) $\rightarrow$ **Bomba d'água LIGADA**.
- **Nível Lógico `HIGH` (3.3V/5V):** Desativa o optoacoplador, abre o contato Normalmente Aberto (NO) $\rightarrow$ **Bomba d'água DESLIGADA**.

### Definições no código:
```cpp
#define RELE_LIGADO     LOW   // Active-LOW: LOW aciona o relé
#define RELE_DESLIGADO  HIGH  // Active-LOW: HIGH desliga o relé
```
Na inicialização (`setup`), o nível lógico `HIGH` (`RELE_DESLIGADO`) é gravado no registrador do pino GPIO 26 **antes** de habilitá-lo como `OUTPUT` (`digitalWrite(PIN_RELE, RELE_DESLIGADO); pinMode(PIN_RELE, OUTPUT);`), eliminando qualquer pulso momentâneo em nível `LOW` durante o boot do ESP32.

No simulador Wokwi (`diagram.json`), o relé foi configurado com `"transistor": "pnp"`, reproduzindo fielmente o comportamento Active-LOW da placa física.

---

## 3. Detecção de Passagem via Sensor PIR (Entrou / Saiu)

O sensor PIR detecta calor e radiação infravermelha em movimento:
1. **Passou (1ª vez):** Borda de subida detectada no GPIO 27 $\rightarrow$ Animal `ENTROU` no curral.
2. **Passou (2ª vez):** Borda de subida detectada no GPIO 27 $\rightarrow$ Animal `SAIU` do curral.

### Filtros e Debounce:
- **Detecção por Borda de Subida:** O evento é disparado na transição de `LOW` para `HIGH`, ignorando o tempo em que o sensor permanece em nível alto.
- **Cooldown de Debounce (`PIR_DEBOUNCE_MS = 3000`):** Evita que múltiplos disparos ocorram enquanto o animal ainda está se movimentando sob a lente do sensor.

---

## 4. Integração Transparente com o Backend Spring Boot

O backend (`CommandRfidLeitura.java`) escuta o tópico MQTT:
```
a3-usjt-fazenda-inteligente/curral/{MAC}/rfid/leitura
```
E espera um JSON estruturado como:
```json
{
  "tagUid": "E2801160",
  "typeEvent": "ENTROU"
}
```
ou
```json
{
  "tagUid": "E2801160",
  "typeEvent": "SAIU"
}
```
Como o firmware V2 envia a tag fixa `"E2801160"` (Vaca Mimosa, já pré-cadastrada no banco de dados da fazenda), **o Backend e o Frontend reativo não necessitam de nenhuma alteração!**
- A **trava biológica** do `CleanService` bloqueará a lavagem se o animal tiver entrado.
- A **linha do tempo** e o **dashboard SSE** exibirão a presença do animal em tempo real.

---

## 5. Mapeamento de Pinos (ESP32)

| Componente | Pino ESP32 | Modo | Descrição |
|---|---|---|---|
| **Relé da Bomba** | `GPIO 26` | `OUTPUT` | Módulo Relé Active-LOW (`LOW` = Ligado, `HIGH` = Desligado) |
| **Sensor PIR** | `GPIO 27` | `INPUT_PULLDOWN` | Sinal digital do sensor de movimento com pull-down |
| **Sensor DHT22** | `GPIO 32` | `INPUT` | Telemetria de temperatura e umidade |
| **Sensor MQ-135** | `GPIO 34` | `ANALOG INPUT` | Telemetria de amônia/odores (ADC 12 bits) |

---

## 6. Comandos Interativos no Monitor Serial (115200 bps)

Para facilitar testes práticos em bancada ou durante demonstrações:

- `pir`, `passou` ou `movimento`: Simula a detecção de passagem física pelo PIR.
- `entrou`: Força o evento de entrada do animal no curral.
- `saiu`: Força o evento de saída do animal do curral.
- `tag <NOVA_TAG>`: Altera dinamicamente a tag mockada (ex: `tag A1B2C3D4` para o Boi Bandido).
- `status`: Exibe o relatório operacional completo do curral (presença, relé, sensores, conectividade MQTT).
