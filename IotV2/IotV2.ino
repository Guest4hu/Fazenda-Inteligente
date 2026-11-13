#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <vector>

/**
 * Smart Corral ESP32 firmware (IotV2) using PIR motion detection instead of
 * MFRC522 RFID, pairing each passage with a configurable default tag UID
 * ({@code tagRfidFixa}) while driving an Active-LOW pump relay and publishing
 * MQ-135/DHT11 telemetry over MQTT.
 */

// Network and MQTT broker configuration (must match backend application.yaml)
const char* WIFI_SSID     = "POCOF5";
const char* WIFI_PASSWORD = "35361086";

const char* MQTT_BROKER   = "broker.hivemq.com";
const int   MQTT_PORT     = 1883;
const char* TOPIC_PREFIX  = "a3-usjt-fazenda-inteligente/curral";

// ESP32 hardware pin mapping
#define PIN_RELE      26   // Water pump relay (Active-LOW module)
#define PIN_PIR       27   // PIR animal movement sensor
#define PIN_DHT       32   // DHT temperature/humidity sensor
#define PIN_MQ135     34   // MQ-135 ammonia/odor gas sensor (12-bit analog ADC)

// Active-LOW relay polarity: LOW energizes pump relay, HIGH opens circuit
#define RELE_LIGADO     LOW
#define RELE_DESLIGADO  HIGH

#define TIPO_DHT DHT11
DHT dht(PIN_DHT, TIPO_DHT);

WiFiClient espClient;
PubSubClient mqttClient(espClient);

String macAddress   = "";
String topicComando = "";
String topicAck     = "";
String topicOdor    = "";
String topicStatus  = "";
String topicRfid    = "";

// PIR presence state bound to a fixed/mocked RFID UID for backend compatibility
String tagRfidFixa = "E2801160";

bool animalNoCurral = false;
std::vector<String> tagsNoCurral;

int pirEstadoAnterior = LOW;
unsigned long ultimoPirTrigger = 0;
const unsigned long PIR_DEBOUNCE_MS = 3000;

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
  Serial.printf("[PIR/RFID -> BACKEND] Publicando Evento: %s | Tag: %s\n", evento, tagUid.c_str());
  Serial.printf("[PIR/RFID -> BACKEND] Tópico: %s\n", topicRfid.c_str());
  Serial.printf("[PIR/RFID -> BACKEND] Payload: %s\n", buffer);
  Serial.println("=======================================================");

  mqttClient.publish(topicRfid.c_str(), buffer, false);
}

/**
 * De-energizes the pump relay immediately and switches {@code PIN_RELE} to
 * high-impedance {@code INPUT} mode.
 */
void desligarBomba() {
  digitalWrite(PIN_RELE, RELE_DESLIGADO);
  pinMode(PIN_RELE, INPUT);
  bombaAtiva = false;
  tempoInicioBomba = 0;
  duracaoBombaMs = 0;
  Serial.println("[HARDWARE] Bomba d'água DESLIGADA!");
}

/**
 * Toggles corral animal presence upon PIR passage detection and publishes the
 * resulting event to MQTT. Strictly follows the backend Single Source of Truth
 * contract and never stops the pump autonomously.
 */
void alternarPresencaPorPir() {
  const char* evento;

  if (!animalNoCurral) {
    animalNoCurral = true;
    tagsNoCurral.clear();
    tagsNoCurral.push_back(tagRfidFixa);
    evento = "ENTROU";
  } else {
    animalNoCurral = false;
    tagsNoCurral.clear();
    evento = "SAIU";
  }

  publicarPresencaRfid(tagRfidFixa, evento);
  Serial.printf("[CURRAL - PIR] Movimento processado: Animal '%s' %s! | Animais presentes: %d\n",
                tagRfidFixa.c_str(), evento, (int)tagsNoCurral.size());
}

/**
 * Energizes the pump relay (Active-LOW) and arms the non-blocking shutoff timer.
 *
 * @param duracaoSegundos wash duration in seconds
 */
void ligarBomba(int duracaoSegundos) {
  pinMode(PIN_RELE, OUTPUT);
  digitalWrite(PIN_RELE, RELE_LIGADO);
  bombaAtiva = true;
  tempoInicioBomba = millis();
  duracaoBombaMs = (unsigned long)duracaoSegundos * 1000;
  Serial.printf("[HARDWARE] Bomba d'água LIGADA por %d segundos!\n", duracaoSegundos);
}

/**
 * Handles JSON wash or stop commands received from the backend. Flushes the MQTT
 * ACK packet ({@code mqttClient.loop()} + 50ms settle) before switching the
 * inductive relay load so EMI or voltage sag does not drop the ACK.
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

  // Energize physical Active-LOW relay coil
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
  Serial.printf(">>> MAC REGISTRADO NO CURRAL : %s <<<\n", macAddress.c_str());
  Serial.printf(">>> ASSINANDO COMANDOS EM     : %s <<<\n", topicComando.c_str());
  Serial.printf(">>> PUBLICANDO EVENTOS EM     : %s <<<\n", topicRfid.c_str());
  Serial.printf(">>> TAG RFID FIXA (MOCK PIR)  : %s <<<\n", tagRfidFixa.c_str());
  Serial.println("-------------------------------------------------------");
}

unsigned long ultimaTentativaMqtt = 0;

/**
 * Non-blocking MQTT reconnection routine (3s backoff) configured with a
 * retained Last Will and Testament ({@code OFFLINE}), publishing {@code ONLINE}
 * and subscribing to pump commands at QoS 1 upon connection.
 */
void reconectarMqtt() {
  unsigned long agora = millis();
  if (agora - ultimaTentativaMqtt < 3000) {
    return; // Retry every 3s without blocking the main loop
  }
  ultimaTentativaMqtt = agora;

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[Wi-Fi] Conexão perdida. Tentando reconectar Wi-Fi...");
    WiFi.reconnect();
    return;
  }

  Serial.print("[MQTT] Tentando conectar ao Broker HiveMQ...");

  // Randomize suffix to prevent client ID collisions on the public HiveMQ broker
  String clientId = "ESP32-PIR-" + macAddress + "-" + String(random(1000, 9999));

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
  // Report raw ADC values (0..4095) expected by dashboard metrics and corral limitOdor thresholds
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
 * Initializes high-impedance de-energized pump pin state, PIR/sensor GPIO,
 * Wi-Fi station connection, and MQTT client settings.
 */
void setup() {
  Serial.begin(115200);

  // Initialize relay de-energized in high-impedance INPUT mode
  digitalWrite(PIN_RELE, RELE_DESLIGADO);
  pinMode(PIN_RELE, INPUT);

  pinMode(PIN_PIR, INPUT_PULLDOWN);
  pinMode(PIN_MQ135, INPUT);
  pinMode(PIN_DHT, INPUT_PULLUP);

  dht.begin();
  Serial.println("\n[HARDWARE] Sensor PIR de Movimento (GPIO 27) inicializado com sucesso!");
  Serial.println("[HARDWARE] Relé da Bomba (GPIO 26) configurado (HIGH=ON, LOW=OFF).");

  // Connect to Wi-Fi and configure MQTT broker callbacks
  conectarWifi();
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);
  mqttClient.setBufferSize(512);

  Serial.println("[SISTEMA] Firmware IotV2 pronto! Operando detecção por PIR.");
  Serial.println("=======================================================");
  Serial.println("[INSTRUÇÕES DO CONSOLE SERIAL]:");
  Serial.println("  - Digite 'pir', 'passou' ou 'movimento' para simular passagem no PIR");
  Serial.println("  - Digite 'entrou' para forçar entrada do animal");
  Serial.println("  - Digite 'saiu' para forçar saída do animal");
  Serial.println("  - Digite 'bomba <segundos>' para acionar o relé da bomba manualmente");
  Serial.println("  - Digite 'tag <NOVA_TAG>' para alterar a tag mockada");
  Serial.println("  - Digite 'status' para inspecionar curral, relé e sensores");
  Serial.println("  - Ou acione fisicamente o sensor PIR no pino 27!");
  Serial.println("=======================================================");
}

/**
 * Main non-blocking firmware loop executing the millis-based pump shutoff
 * timer (highest priority), MQTT keep-alive/reconnect, 15s odor telemetry,
 * rising-edge debounced PIR movement reporting, and Serial console shortcuts.
 */
void loop() {
  // 1. Highest-priority non-blocking pump shutoff timer (network-independent safety guarantee)
  if (bombaAtiva && (millis() - tempoInicioBomba >= duracaoBombaMs)) {
    desligarBomba();
    Serial.println("[HARDWARE] Tempo de lavagem concluído.");
  }

  // 2. Non-blocking MQTT connection maintenance
  if (!mqttClient.connected()) {
    reconectarMqtt();
  } else {
    mqttClient.loop();
  }

  // 3. Periodic odor telemetry every 15s
  if (millis() - ultimoEnvioTelemetria >= INTERVALO_TELEMETRIA) {
    ultimoEnvioTelemetria = millis();
    enviarTelemetria();
  }

  // 4. PIR passage detection (IoT only reports events; pump safety locks belong to backend)
  int pirEstadoAtual = digitalRead(PIN_PIR);
  if (pirEstadoAtual == HIGH && pirEstadoAnterior == LOW && (millis() - ultimoPirTrigger >= PIR_DEBOUNCE_MS)) {
    ultimoPirTrigger = millis();
    alternarPresencaPorPir();
  }
  pirEstadoAnterior = pirEstadoAtual;

  // 5. Interactive Serial Monitor diagnostic shortcuts
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
        Serial.println("\n[CONSOLE SERIAL] Simulando detecção de passagem pelo PIR...");
        alternarPresencaPorPir();

      } else if (cmd == "parar" || cmd == "stop" || cmd == "desligar") {
        Serial.println("\n[CONSOLE SERIAL] Parada manual da bomba solicitada.");
        desligarBomba();

      } else if (cmd == "entrou" || cmd == "in") {
        if (arg.length() > 0) {
          tagRfidFixa = arg;
          tagRfidFixa.toUpperCase();
        }
        animalNoCurral = true;
        tagsNoCurral.clear();
        tagsNoCurral.push_back(tagRfidFixa);
        publicarPresencaRfid(tagRfidFixa, "ENTROU");
        Serial.printf("[CONSOLE SERIAL] Animal '%s' ENTROU forçadamente no curral!\n", tagRfidFixa.c_str());

      } else if (cmd == "saiu" || cmd == "out") {
        if (arg.length() > 0) {
          tagRfidFixa = arg;
          tagRfidFixa.toUpperCase();
        }
        animalNoCurral = false;
        tagsNoCurral.clear();
        publicarPresencaRfid(tagRfidFixa, "SAIU");
        Serial.printf("[CONSOLE SERIAL] Animal '%s' SAIU forçadamente do curral!\n", tagRfidFixa.c_str());

      } else if (cmd == "bomba" || cmd == "limpar" || cmd == "clean") {
        int duracao = (arg.length() > 0) ? arg.toInt() : 5;
        if (duracao <= 0) duracao = 5;
        Serial.printf("\n[CONSOLE SERIAL] Teste manual: acionando bomba por %d segundos...\n", duracao);
        ligarBomba(duracao);

      } else if (cmd == "tag") {
        if (arg.length() > 0) {
          arg.toUpperCase();
          tagRfidFixa = arg;
          Serial.printf("[CONFIG] Tag RFID fixa redefinida para: %s\n", tagRfidFixa.c_str());
        } else {
          Serial.printf("[CONFIG] Tag RFID atual: %s\n", tagRfidFixa.c_str());
        }

      } else if (cmd == "status") {
        Serial.println("\n-------------------- STATUS DO CURRAL --------------------");
        Serial.printf("  • Conexão MQTT   : %s\n", mqttClient.connected() ? "CONECTADO" : "DESCONECTADO");
        Serial.printf("  • MAC do Curral  : %s\n", macAddress.c_str());
        Serial.printf("  • Animal Presente: %s\n", animalNoCurral ? "SIM" : "NÃO");
        Serial.printf("  • Tag Associada  : %s\n", tagRfidFixa.c_str());
        Serial.printf("  • Relé da Bomba  : %s\n",
                      bombaAtiva ? "LIGADO (Pino 26=HIGH)" : "DESLIGADO (Pino 26=LOW)");
        Serial.printf("  • Sensor PIR (27): %s\n", digitalRead(PIN_PIR) == HIGH ? "MOVIMENTO DETECTADO" : "SEM MOVIMENTO");
        Serial.printf("  • Sensor MQ-135  : ADC %d\n", analogRead(PIN_MQ135));
        Serial.println("----------------------------------------------------------");

      } else if (input.length() >= 4 && input.length() <= 14) {
        // Accept raw input as a tag override + presence toggle only when all characters are valid hex digits
        bool valido = true;
        for (unsigned int i = 0; i < input.length(); i++) {
          char c = input[i];
          if (!isxdigit(c)) { valido = false; break; }
        }
        if (valido) {
          tagRfidFixa = input;
          tagRfidFixa.toUpperCase();
          alternarPresencaPorPir();
        }
      }
    }
  }
}
