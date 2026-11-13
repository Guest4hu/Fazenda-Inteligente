#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <SPI.h>
#include <MFRC522.h>
#include <vector>

/**
 * Smart Corral ESP32 firmware combining MFRC522 RFID card detection, PIR motion
 * sensing, DHT11 climate telemetry, MQ-135 raw ADC odor sensing, and Active-LOW
 * pump relay control over MQTT.
 */

// Network and MQTT broker configuration (must match backend application.yaml)
const char* WIFI_SSID     = "POCOF5";
const char* WIFI_PASSWORD = "35361086";

const char* MQTT_BROKER   = "broker.hivemq.com";
const int   MQTT_PORT     = 1883;
const char* TOPIC_PREFIX  = "a3-usjt-fazenda-inteligente/curral";

// ESP32 hardware pin mapping (SPI defaults: SCK=18, MISO=19, MOSI=23)
#define PIN_RELE      26   // Water pump relay (Active-LOW, normally-open terminal)
#define PIN_PIR       27   // PIR animal movement sensor
#define PIN_DHT       32   // DHT11 temperature/humidity sensor
#define PIN_MQ135     34   // MQ-135 ammonia/odor gas sensor (12-bit analog ADC)
#define PIN_RFID_SS   5    // MFRC522 SDA/SS (SPI)
#define PIN_RFID_RST  21   // MFRC522 RST (SPI)

// Active-LOW relay polarity: LOW energizes pump relay, HIGH opens circuit
#define RELE_LIGADO     LOW
#define RELE_DESLIGADO  HIGH

// Hybrid presence tracking fallback UID for PIR-triggered movement events
String tagRfidPirMock = "E2801160";

int pirEstadoAnterior = LOW;
unsigned long ultimoPirTrigger = 0;
const unsigned long PIR_DEBOUNCE_MS = 3000;

#define TIPO_DHT DHT11
DHT dht(PIN_DHT, TIPO_DHT);
MFRC522 rfid(PIN_RFID_SS, PIN_RFID_RST);

WiFiClient espClient;
PubSubClient mqttClient(espClient);

String macAddress   = "";
String topicComando = "";
String topicAck     = "";
String topicOdor    = "";
String topicStatus  = "";
String topicRfid    = "";

// Per-animal presence state and MFRC522 exit-debounce counters (~2s at 250ms poll)
std::vector<String> tagsNoCurral;
String tagRfidAtivaNoLeitor = "";
int leiturasConsecutivasSemTag = 0;
unsigned long ultimoRfidPoll = 0;
unsigned long ultimoRfidEventoMs = 0;
const int LIMITE_LEITURAS_SAIDA = 8;

/**
 * Checks whether an animal with the given tag UID is currently tracked inside the corral.
 *
 * @param tagUid uppercase hexadecimal RFID UID
 * @return true if present in {@code tagsNoCurral}
 */
bool isAnimalNoCurral(const String& tagUid) {
  for (size_t i = 0; i < tagsNoCurral.size(); i++) {
    if (tagsNoCurral[i].equalsIgnoreCase(tagUid)) {
      return true;
    }
  }
  return false;
}

/**
 * Toggles the tracked presence state of an animal tag inside the corral.
 *
 * @param tagUid RFID UID to insert or remove from {@code tagsNoCurral}
 * @return {@code "SAIU"} if already present, otherwise {@code "ENTROU"}
 */
const char* alternarPresencaAnimal(const String& tagUid) {
  for (size_t i = 0; i < tagsNoCurral.size(); i++) {
    if (tagsNoCurral[i].equalsIgnoreCase(tagUid)) {
      tagsNoCurral.erase(tagsNoCurral.begin() + i);
      return "SAIU";
    }
  }
  tagsNoCurral.push_back(tagUid);
  return "ENTROU";
}

// Non-blocking millis-based pump timer and periodic odor telemetry state
bool bombaAtiva = false;
unsigned long tempoInicioBomba = 0;
unsigned long duracaoBombaMs = 0;

unsigned long ultimoEnvioTelemetria = 0;
const unsigned long INTERVALO_TELEMETRIA = 15000;

/**
 * Formats the ESP32 Wi-Fi MAC address as 12 uppercase hexadecimal characters
 * matching backend corral identification (e.g. {@code 240AC4000110}).
 *
 * @return sanitized MAC string without separators
 */
String obterMacLimpo() {
  String mac = WiFi.macAddress();
  mac.replace(":", "");
  mac.replace("-", "");
  mac.toUpperCase();
  return mac;
}

/**
 * Publishes an execution acknowledgment to {@code bomba/ack} so the backend's
 * synchronous wait releases immediately.
 *
 * @param comandoId correlation identifier sent by the backend
 * @param status    execution status string (typically {@code "OK"})
 */
void enviarAck(const char* comandoId, const char* status) {
  StaticJsonDocument<128> doc;
  doc["comandoId"] = comandoId;
  doc["status"] = status;

  char buffer[128];
  serializeJson(doc, buffer);

  Serial.printf("\n[MQTT -> BACKEND] Enviando ACK para o tópico: %s\n", topicAck.c_str());
  Serial.printf("[MQTT -> BACKEND] Payload: %s\n", buffer);

  mqttClient.publish(topicAck.c_str(), buffer, false);
}

/**
 * Publishes a corral animal presence event to {@code rfid/leitura} for backend processing.
 *
 * @param tagUid animal RFID tag UID
 * @param evento {@code "ENTROU"} or {@code "SAIU"}
 */
void publicarPresencaRfid(const String& tagUid, const char* evento) {
  StaticJsonDocument<128> doc;
  doc["tagUid"] = tagUid;
  doc["typeEvent"] = evento;

  char buffer[128];
  serializeJson(doc, buffer);

  Serial.println("\n=======================================================");
  Serial.printf("[RFID/PIR -> BACKEND] Publicando Evento: %s | Tag: %s\n", evento, tagUid.c_str());
  Serial.printf("[RFID/PIR -> BACKEND] Tópico: %s\n", topicRfid.c_str());
  Serial.printf("[RFID/PIR -> BACKEND] Payload: %s\n", buffer);
  Serial.println("=======================================================");

  mqttClient.publish(topicRfid.c_str(), buffer, false);
}

/**
 * Energizes the pump relay (Active-LOW) and arms the non-blocking shutoff timer.
 *
 * @param duracaoSegundos wash duration in seconds
 */
void ligarBomba(int duracaoSegundos) {
  pinMode(PIN_RELE, OUTPUT);
  digitalWrite(PIN_RELE, RELE_LIGADO); // Drive pin LOW to close Active-LOW relay coil
  bombaAtiva = true;
  tempoInicioBomba = millis();
  duracaoBombaMs = (unsigned long)duracaoSegundos * 1000;
  Serial.printf("[HARDWARE] Bomba d'água LIGADA (Relé Active-LOW em LOW) por %d segundos!\n", duracaoSegundos);
}

/**
 * De-energizes the pump relay immediately and switches the pin to {@code INPUT_PULLUP}
 * so ambient 60Hz AC mains noise cannot spuriously float or trigger the relay input.
 */
void desligarBomba() {
  digitalWrite(PIN_RELE, RELE_DESLIGADO);
  pinMode(PIN_RELE, INPUT_PULLUP);
  bombaAtiva = false;
  tempoInicioBomba = 0;
  duracaoBombaMs = 0;
  Serial.println("[HARDWARE] Bomba d'água DESLIGADA!");
}

/**
 * Handles JSON wash or stop commands received from the backend. Flushes the MQTT
 * ACK packet ({@code mqttClient.loop()} + 50ms settle) before switching the pump
 * relay coil so inductive EMI or brownout does not drop the ACK packet.
 *
 * @param payload raw JSON command payload
 */
void processarComandoBomba(String payload) {
  StaticJsonDocument<256> doc;
  DeserializationError erro = deserializeJson(doc, payload);

  if (erro) {
    Serial.printf("[ERRO] Falha ao interpretar JSON: %s\n", erro.c_str());
    return;
  }

  const char* comandoId = doc["comandoId"];
  if (!comandoId) {
    Serial.println("[ERRO] JSON recebido sem 'comandoId'!");
    return;
  }

  // Treat explicit PARAR/STOP commands or non-positive durations as immediate stop requests
  const char* acao = doc["acao"] | doc["action"] | doc["comando"] | doc["tipo"] | "";
  int duracaoVal = doc.containsKey("duracao") ? doc["duracao"].as<int>() : 30;
  bool ehParada = (strcasecmp(acao, "PARAR") == 0 ||
                   strcasecmp(acao, "STOP") == 0 ||
                   duracaoVal <= 0);

  if (ehParada) {
    Serial.println("\n=======================================================");
    Serial.printf("[COMANDO RECEBIDO] PARAR BOMBA | ID: %s\n", comandoId);
    Serial.println("=======================================================");

    enviarAck(comandoId, "OK");
    mqttClient.loop();
    delay(50);
    desligarBomba();
    return;
  }

  int duracaoSegundos = duracaoVal > 0 ? duracaoVal : 30;

  Serial.println("\n=======================================================");
  Serial.printf("[COMANDO RECEBIDO] Acionar Bomba | ID: %s | Duração: %d s\n", comandoId, duracaoSegundos);
  Serial.println("=======================================================");

  // Strictly follow backend commands (Single Source of Truth): flush ACK before energizing inductive pump load
  enviarAck(comandoId, "OK");
  mqttClient.loop();
  delay(50);

  // Energize physical relay coil
  ligarBomba(duracaoSegundos);
}

/**
 * MQTT subscription callback routing incoming command messages by topic.
 *
 * @param topic   topic name the message arrived on
 * @param payload raw message bytes
 * @param length  payload byte length
 */
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String mensagem = "";
  for (unsigned int i = 0; i < length; i++) {
    mensagem += (char)payload[i];
  }

  Serial.printf("\n[MQTT RECEBIDO] Tópico: %s\n", topic);
  Serial.printf("[MQTT RECEBIDO] Conteúdo: %s\n", mensagem.c_str());

  if (String(topic) == topicComando) {
    processarComandoBomba(mensagem);
  }
}

/**
 * Connects to Wi-Fi and derives device-specific MQTT topics dynamically from
 * the sanitized hardware MAC address.
 */
void conectarWifi() {
  Serial.print("Conectando ao Wi-Fi: ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  if (String(WIFI_SSID) == "Wokwi-GUEST") {
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD, 6);
  } else {
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  }

  while (WiFi.status() != WL_CONNECTED) {
    delay(250);
    Serial.print(".");
  }

  Serial.println("\n[Wi-Fi] Conectado com sucesso!");
  Serial.print("[Wi-Fi] Endereço IP: ");
  Serial.println(WiFi.localIP());

  // Derive MAC-scoped MQTT topics once the station interface is online
  macAddress   = obterMacLimpo();
  topicComando = String(TOPIC_PREFIX) + "/" + macAddress + "/bomba/comando";
  topicAck     = String(TOPIC_PREFIX) + "/" + macAddress + "/bomba/ack";
  topicOdor    = String(TOPIC_PREFIX) + "/" + macAddress + "/odor/nivel";
  topicStatus  = String(TOPIC_PREFIX) + "/" + macAddress + "/status";
  topicRfid    = String(TOPIC_PREFIX) + "/" + macAddress + "/rfid/leitura";

  Serial.println("-------------------------------------------------------");
  Serial.printf(">>> MAC CADASTRADO NO CURRAL  : %s <<<\n", macAddress.c_str());
  Serial.printf(">>> ASSINANDO COMANDOS EM     : %s <<<\n", topicComando.c_str());
  Serial.printf(">>> PUBLICANDO RFID/PIR EM    : %s <<<\n", topicRfid.c_str());
  Serial.printf(">>> TAG PADRÃO (MOCK PIR)     : %s <<<\n", tagRfidPirMock.c_str());
  Serial.println("-------------------------------------------------------");
}

unsigned long ultimaTentativaMqtt = 0;

/**
 * Non-blocking MQTT reconnection routine (10s backoff, 2s socket timeout)
 * configured with a retained Last Will and Testament ({@code OFFLINE}), publishing
 * {@code ONLINE} and subscribing to pump commands at QoS 1 upon connection.
 */
void reconectarMqtt() {
  unsigned long agora = millis();
  if (agora - ultimaTentativaMqtt < 10000) {
    return; // Retry every 10s so RFID/PIR polling remains non-blocking
  }
  ultimaTentativaMqtt = agora;

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[Wi-Fi] Conexão perdida. Tentando reconectar Wi-Fi...");
    WiFi.reconnect();
    return;
  }

  Serial.print("[MQTT] Tentando conectar ao Broker HiveMQ...");
  espClient.setTimeout(2); // Keep TCP connect timeout short (2s) so RFID reads do not stall offline

  // Randomize suffix to prevent client ID collisions on the public HiveMQ broker
  String clientId = "ESP32-Curral-" + macAddress + "-" + String(random(1000, 9999));

  // Connect with retained Last Will so abrupt drops mark the corral OFFLINE
  if (mqttClient.connect(clientId.c_str(), topicStatus.c_str(), 1, true, "{\"status\":\"OFFLINE\"}")) {
    Serial.println(" Conectado!");

    mqttClient.publish(topicStatus.c_str(), "{\"status\":\"ONLINE\"}", true);

    mqttClient.subscribe(topicComando.c_str(), 1);
    Serial.printf("[MQTT] Inscrito no tópico de comando: %s\n", topicComando.c_str());

  } else {
    Serial.print(" Falhou. Código de erro: ");
    Serial.print(mqttClient.state());
    Serial.println(" Nova tentativa em 3 segundos...");
  }
}

/**
 * Reads the raw 12-bit MQ-135 ADC odor level and DHT11 temperature/humidity
 * and publishes a JSON telemetry sample to {@code odor/nivel}.
 */
void enviarTelemetria() {
  int leituraBruta = analogRead(PIN_MQ135);
  // Report raw ADC values (0..4095) expected by dashboard metrics and odor thresholds
  int leituraOdor = constrain(leituraBruta, 0, 10000);

  float temperatura = dht.readTemperature();
  float umidade = dht.readHumidity();

  StaticJsonDocument<192> doc;
  doc["valor"] = leituraOdor;
  doc["temperatura"] = isnan(temperatura) ? 0.0 : (round(temperatura * 10.0) / 10.0);
  doc["umidade"] = isnan(umidade) ? 0.0 : (round(umidade * 10.0) / 10.0);

  char buffer[192];
  serializeJson(doc, buffer);

  Serial.printf("[TELEMETRIA] Odor Bruto: %d | Temp: %.1f C | Umid: %.1f %% -> Publicando...\n",
                leituraOdor, isnan(temperatura) ? 0.0 : temperatura, isnan(umidade) ? 0.0 : umidade);

  mqttClient.publish(topicOdor.c_str(), buffer, false);
}

/**
 * Initializes safe pump pin state ({@code INPUT_PULLUP} with {@code RELE_DESLIGADO}),
 * climate/gas GPIO, SPI MFRC522 RFID reader with max antenna gain (48 dB),
 * Wi-Fi station connection, and MQTT client buffers.
 */
void setup() {
  Serial.begin(115200);

  // Initialize relay de-energized with pull-up stabilization against mains noise
  digitalWrite(PIN_RELE, RELE_DESLIGADO);
  pinMode(PIN_RELE, INPUT_PULLUP);

  pinMode(PIN_PIR, INPUT_PULLDOWN);
  pinMode(PIN_MQ135, INPUT);
  pinMode(PIN_DHT, INPUT_PULLUP);

  dht.begin();

  // Initialize SPI bus and MFRC522 reader with max RF antenna gain (48 dB)
  SPI.begin();
  rfid.PCD_Init();
  rfid.PCD_SetAntennaGain(rfid.RxGain_max);
  byte versaoRfid = rfid.PCD_ReadRegister(rfid.VersionReg);
  if (versaoRfid == 0x00 || versaoRfid == 0xFF) {
    Serial.println("\n[AVISO HARDWARE] Leitor RFID MFRC522 não detectado nos pinos SPI (verifique encaixe/3.3V). Operando via PIR!");
  } else {
    Serial.printf("\n[HARDWARE] Sensor RFID MFRC522 detectado com sucesso (Versão: 0x%02X)!\n", versaoRfid);
  }
  Serial.println("[HARDWARE] Sensor PIR de Movimento ativo no pino GPIO 27!");
  Serial.println("[HARDWARE] Relé da Bomba no pino GPIO 26 (Active-LOW: LOW=ON, HIGH=OFF).");

  // Connect to Wi-Fi and configure MQTT broker callbacks
  conectarWifi();
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);
  mqttClient.setBufferSize(512);

  Serial.println("[SISTEMA] Curral Inteligente pronto (RFID + PIR ativos)!");
  Serial.println("=======================================================");
  Serial.println("[INSTRUÇÕES DO CONSOLE SERIAL]:");
  Serial.println("  - Aproxime cartões/tags no leitor RFID MFRC522 físico");
  Serial.println("  - Dispare o sensor PIR no pino 27 ou digite 'pir'/'passou' para alternar ENTROU/SAIU");
  Serial.println("  - Digite 'entrou [UID]' ou 'saiu [UID]' para registrar presença manualmente");
  Serial.println("  - Digite 'bomba <segundos>' para acionar o relé da bomba manualmente");
  Serial.println("  - Digite 'parar' ou 'stop' para desligar a bomba manualmente");
  Serial.println("  - Digite 'tag <NOVA_TAG>' para alterar a tag associada ao PIR (atual: " + tagRfidPirMock + ")");
  Serial.println("  - Digite 'status' para inspecionar curral, RFID, relé e sensores");
  Serial.println("=======================================================");
}

/**
 * Main non-blocking firmware control loop executed in strict priority order:
 * (1) millis-based pump shutoff safety timer independent of network health,
 * (2) MQTT keep-alive and reconnection, (3) 15s odor/climate telemetry,
 * (4) PIR passage detection guarded by a 5s post-RFID cooldown,
 * (5) MFRC522 antenna self-recovery and 250ms REQA/WUPA presence polling with
 *     8-miss exit debounce (~2s), and (6) serial console diagnostic commands.
 */
void loop() {
  // 1. Highest-priority non-blocking pump shutoff timer (network-independent safety guarantee)
  if (bombaAtiva && (millis() - tempoInicioBomba >= duracaoBombaMs)) {
    desligarBomba();
    Serial.println("\n[HARDWARE] Duração da lavagem finalizada. Bomba d'água DESLIGADA!");
  }

  // 2. Non-blocking MQTT connection maintenance
  if (!mqttClient.connected()) {
    reconectarMqtt();
  } else {
    mqttClient.loop();
  }

  // 3. Periodic odor/climate telemetry every 15s
  if (millis() - ultimoEnvioTelemetria >= INTERVALO_TELEMETRIA) {
    ultimoEnvioTelemetria = millis();
    enviarTelemetria();
  }

  // 4. PIR passage detection (suppressed for 5s after RFID events to avoid hand interference)
  int pirEstadoAtual = digitalRead(PIN_PIR);
  if (tagRfidAtivaNoLeitor.length() == 0 && (millis() - ultimoRfidEventoMs >= 5000)) {
    if (pirEstadoAtual == HIGH && pirEstadoAnterior == LOW && (millis() - ultimoPirTrigger >= PIR_DEBOUNCE_MS)) {
      ultimoPirTrigger = millis();
      const char* evento = alternarPresencaAnimal(tagRfidPirMock);
      publicarPresencaRfid(tagRfidPirMock, evento);
      Serial.printf("[CURRAL - PIR] Passagem detectada! Animal '%s' %s | Total no curral: %d\n",
                    tagRfidPirMock.c_str(), evento, (int)tagsNoCurral.size());
    }
  }
  pirEstadoAnterior = pirEstadoAtual;

  // 5. Continuous MFRC522 polling with periodic TxControlReg antenna self-recovery
  static unsigned long ultimoCheckAntena = 0;
  if (millis() - ultimoCheckAntena >= 2000) {
    ultimoCheckAntena = millis();
    byte txControl = rfid.PCD_ReadRegister(rfid.TxControlReg);
    if ((txControl & 0x03) != 0x03) {
      rfid.PCD_Init();
      rfid.PCD_SetAntennaGain(rfid.RxGain_max);
    }
  }

  if (millis() - ultimoRfidPoll >= 250) {
    ultimoRfidPoll = millis();

    // Probe tag presence using both REQA (new card) and WUPA (wakeup halted card)
    byte bufferATQA[2];
    byte bufferSize = sizeof(bufferATQA);
    bool presencaDetectada = rfid.PICC_IsNewCardPresent();
    if (!presencaDetectada) {
      bufferSize = sizeof(bufferATQA);
      MFRC522::StatusCode st = rfid.PICC_WakeupA(bufferATQA, &bufferSize);
      presencaDetectada = (st == MFRC522::STATUS_OK || st == MFRC522::STATUS_COLLISION);
    }

    if (presencaDetectada && rfid.PICC_ReadCardSerial()) {
      leiturasConsecutivasSemTag = 0;
      ultimoRfidEventoMs = millis();

      String tagUid = "";
      for (byte i = 0; i < rfid.uid.size; i++) {
        if (rfid.uid.uidByte[i] < 0x10) tagUid += "0";
        tagUid += String(rfid.uid.uidByte[i], HEX);
      }
      tagUid.toUpperCase();

      // When a different tag immediately replaces the active tag, emit SAIU for the previous tag first
      if (tagRfidAtivaNoLeitor.length() > 0 && !tagRfidAtivaNoLeitor.equalsIgnoreCase(tagUid)) {
        for (size_t i = 0; i < tagsNoCurral.size(); i++) {
          if (tagsNoCurral[i].equalsIgnoreCase(tagRfidAtivaNoLeitor)) {
            tagsNoCurral.erase(tagsNoCurral.begin() + i);
            break;
          }
        }
        publicarPresencaRfid(tagRfidAtivaNoLeitor, "SAIU");
        Serial.printf("[CURRAL - RFID] Boi '%s' SAIU | Total de animais no curral agora: %d\n",
                      tagRfidAtivaNoLeitor.c_str(), (int)tagsNoCurral.size());
      }

      // Emit ENTROU only once while the tag remains present on the reader
      if (!isAnimalNoCurral(tagUid)) {
        tagsNoCurral.push_back(tagUid);
        publicarPresencaRfid(tagUid, "ENTROU");
        Serial.printf("[CURRAL - RFID] Boi '%s' ENTROU (Tag presente no leitor) | Total de animais no curral agora: %d\n",
                      tagUid.c_str(), (int)tagsNoCurral.size());
      }

      tagRfidAtivaNoLeitor = tagUid;
      rfid.PICC_HaltA();
      rfid.PCD_StopCrypto1();
    } else if (tagRfidAtivaNoLeitor.length() > 0) {
      // Count actual missed RFID polls rather than wall time so Wi-Fi/MQTT latency never triggers false exits
      leiturasConsecutivasSemTag++;
      if (leiturasConsecutivasSemTag >= LIMITE_LEITURAS_SAIDA) {
        for (size_t i = 0; i < tagsNoCurral.size(); i++) {
          if (tagsNoCurral[i].equalsIgnoreCase(tagRfidAtivaNoLeitor)) {
            tagsNoCurral.erase(tagsNoCurral.begin() + i);
            break;
          }
        }
        publicarPresencaRfid(tagRfidAtivaNoLeitor, "SAIU");
        Serial.printf("[CURRAL - RFID] Boi '%s' SAIU (Tag afastada do leitor) | Total de animais no curral agora: %d\n",
                      tagRfidAtivaNoLeitor.c_str(), (int)tagsNoCurral.size());
        tagRfidAtivaNoLeitor = "";
        leiturasConsecutivasSemTag = 0;
        ultimoRfidEventoMs = millis();
      }
    }
  }

  // 6. Interactive Serial Monitor diagnostic shortcuts (with hex UID noise filter)
  if (Serial.available() > 0) {
    String input = Serial.readStringUntil('\n');
    input.trim();

    if (input.length() > 0) {
      int spaceIndex = input.indexOf(' ');
      String cmd = (spaceIndex > 0) ? input.substring(0, spaceIndex) : input;
      String arg = (spaceIndex > 0) ? input.substring(spaceIndex + 1) : "";
      cmd.toLowerCase();
      arg.trim();

      if (cmd == "pir" || cmd == "movimento" || cmd == "passou") {
        const char* evento = alternarPresencaAnimal(tagRfidPirMock);
        publicarPresencaRfid(tagRfidPirMock, evento);
        Serial.printf("[CURRAL - PIR SERIAL] Passagem simulada! Animal '%s' %s | Total no curral: %d\n",
                      tagRfidPirMock.c_str(), evento, (int)tagsNoCurral.size());

      } else if (cmd == "parar" || cmd == "stop" || cmd == "desligar") {
        Serial.println("\n[CONSOLE SERIAL] Parada manual da bomba solicitada.");
        desligarBomba();

      } else if (cmd == "bomba" || cmd == "limpar" || cmd == "clean") {
        int duracao = (arg.length() > 0) ? arg.toInt() : 5;
        if (duracao <= 0) duracao = 5;
        Serial.printf("\n[CONSOLE SERIAL] Teste manual: acionando bomba por %d segundos...\n", duracao);
        ligarBomba(duracao);

      } else if (cmd == "tag") {
        if (arg.length() > 0) {
          arg.toUpperCase();
          tagRfidPirMock = arg;
          Serial.printf("[CONFIG] Tag RFID associada ao PIR redefinida para: %s\n", tagRfidPirMock.c_str());
        } else {
          Serial.printf("[CONFIG] Tag RFID associada ao PIR atual: %s\n", tagRfidPirMock.c_str());
        }

      } else if (cmd == "in" || cmd == "entrou") {
        String tagAlvo = (arg.length() > 0) ? arg : tagRfidPirMock;
        tagAlvo.toUpperCase();
        if (!isAnimalNoCurral(tagAlvo)) {
          tagsNoCurral.push_back(tagAlvo);
        }
        publicarPresencaRfid(tagAlvo, "ENTROU");
        Serial.printf("[CURRAL] Boi '%s' ENTROU | Total no curral: %d\n", tagAlvo.c_str(), (int)tagsNoCurral.size());

      } else if (cmd == "out" || cmd == "saiu") {
        String tagAlvo = (arg.length() > 0) ? arg : tagRfidPirMock;
        tagAlvo.toUpperCase();
        for (size_t i = 0; i < tagsNoCurral.size(); i++) {
          if (tagsNoCurral[i].equalsIgnoreCase(tagAlvo)) {
            tagsNoCurral.erase(tagsNoCurral.begin() + i);
            break;
          }
        }
        publicarPresencaRfid(tagAlvo, "SAIU");
        Serial.printf("[CURRAL] Boi '%s' SAIU | Total no curral: %d\n", tagAlvo.c_str(), (int)tagsNoCurral.size());

      } else if (cmd == "status") {
        byte versaoRfid = rfid.PCD_ReadRegister(rfid.VersionReg);
        bool rfidConectado = (versaoRfid != 0x00 && versaoRfid != 0xFF);
        byte txControl = rfid.PCD_ReadRegister(rfid.TxControlReg);
        if (rfidConectado && (txControl & 0x03) != 0x03) {
          rfid.PCD_Init();
          rfid.PCD_SetAntennaGain(rfid.RxGain_max);
          txControl = rfid.PCD_ReadRegister(rfid.TxControlReg);
        }
        bool antenaLigada = ((txControl & 0x03) == 0x03);
        Serial.println("\n-------------------- STATUS DO CURRAL --------------------");
        Serial.printf("  • Conexão MQTT   : %s\n", mqttClient.connected() ? "CONECTADO" : "DESCONECTADO");
        Serial.printf("  • MAC do Curral  : %s\n", macAddress.c_str());
        Serial.printf("  • Leitor RFID    : %s (Versão: 0x%02X | Antena: %s [0x%02X])\n",
                      rfidConectado ? "CONECTADO" : "NÃO DETECTADO",
                      versaoRfid,
                      antenaLigada ? "ATIVA" : "INATIVA",
                      txControl);
        Serial.printf("  • Animais no Curral (%d):\n", (int)tagsNoCurral.size());
        for (size_t i = 0; i < tagsNoCurral.size(); i++) {
          Serial.printf("      [%d] Tag UID: %s\n", (int)(i + 1), tagsNoCurral[i].c_str());
        }
        Serial.printf("  • Tag Mock PIR   : %s\n", tagRfidPirMock.c_str());
        Serial.printf("  • Relé da Bomba  : %s\n",
                      bombaAtiva ? "LIGADO (Pino 26=LOW)" : "DESLIGADO (Pino 26=HIGH)");
        float tempStatus = dht.readTemperature();
        float umidStatus = dht.readHumidity();
        Serial.printf("  • Sensor PIR (27): %s\n", digitalRead(PIN_PIR) == HIGH ? "MOVIMENTO DETECTADO" : "SEM MOVIMENTO");
        Serial.printf("  • Sensor MQ-135  : ADC %d\n", analogRead(PIN_MQ135));
        if (isnan(tempStatus) || isnan(umidStatus)) {
          Serial.println("  • Sensor DHT (32): FALHA NA LEITURA (verifique pino 32 / VCC / GND)");
        } else {
          Serial.printf("  • Sensor DHT (32): %.1f C | %.1f %%\n", tempStatus, umidStatus);
        }
        Serial.println("----------------------------------------------------------");

      } else if (input.length() >= 4 && input.length() <= 14) {
        // Accept raw input as a tag toggle only when all characters are valid hex digits
        bool valido = true;
        for (unsigned int i = 0; i < input.length(); i++) {
          char c = input[i];
          if (!isxdigit(c)) { valido = false; break; }
        }
        if (valido) {
          String tagDireta = input;
          tagDireta.toUpperCase();
          const char* evento = alternarPresencaAnimal(tagDireta);
          publicarPresencaRfid(tagDireta, evento);
          Serial.printf("[CURRAL] Boi '%s' %s | Total no curral: %d\n", tagDireta.c_str(), evento, (int)tagsNoCurral.size());
        }
      }
    }
  }
}
