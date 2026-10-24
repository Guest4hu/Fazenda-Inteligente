#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <SPI.h>
#include <MFRC522.h>
#include <vector>

// ============================================================================
// CONFIGURAÇÕES DE REDE E BROKER MQTT
// ============================================================================
// Troque pelo seu Wi-Fi (ou "Wokwi-GUEST" se estiver simulando no Wokwi)
const char* WIFI_SSID     = "Wokwi-GUEST";
const char* WIFI_PASSWORD = "";

// Mesmas configurações do application.yaml do Backend
const char* MQTT_BROKER   = "broker.hivemq.com";
const int   MQTT_PORT     = 1883;
const char* TOPIC_PREFIX  = "a3-usjt-fazenda-inteligente/curral";

// ============================================================================
// PINOS DO HARDWARE (ESP32)
// ============================================================================
#define PIN_RELE      26   // Relé da Bomba d'água
#define PIN_PIR       27   // Sensor de Presença de Animais (PIR)
#define PIN_DHT       32   // Sensor DHT22 (Temperatura e Umidade)
#define PIN_MQ135     34   // Sensor de Odor/Gás (Amônia/Fezes)
#define PIN_RFID_SS   5    // MFRC522 SDA/SS (SPI)
#define PIN_RFID_RST  21   // MFRC522 RST (SPI)
// Pinos SPI padrão ESP32: SCK = 18, MISO = 19, MOSI = 23

#define TIPO_DHT DHT22
DHT dht(PIN_DHT, TIPO_DHT);
MFRC522 rfid(PIN_RFID_SS, PIN_RFID_RST);

WiFiClient espClient;
PubSubClient mqttClient(espClient);

// Identificação e Tópicos Dinâmicos
String macAddress = "";
String topicComando = "";
String topicAck = "";
String topicOdor = "";
String topicStatus = "";
String topicRfid = "";

// Rastreamento Individual de Animais Presentes no Curral
std::vector<String> tagsNoCurral;
unsigned long ultimoRfidLeitura = 0;

// Verifica se um animal específico está dentro do curral
bool isAnimalNoCurral(const String& tagUid) {
  for (size_t i = 0; i < tagsNoCurral.size(); i++) {
    if (tagsNoCurral[i].equalsIgnoreCase(tagUid)) {
      return true;
    }
  }
  return false;
}

// Alterna a presença de um animal específico:
// Se já estava dentro -> SAIU (remove da lista)
// Se não estava dentro -> ENTROU (adiciona na lista)
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

// Controle Não-Bloqueante da Bomba (millis)
bool bombaAtiva = false;
unsigned long tempoInicioBomba = 0;
unsigned long duracaoBombaMs = 0;

// Controle de Envio de Telemetria Periódica
unsigned long ultimoEnvioTelemetria = 0;
const unsigned long INTERVALO_TELEMETRIA = 15000; // Envia odor a cada 15s

// ============================================================================
// FUNÇÕES AUXILIARES
// ============================================================================

// Formata o MAC em 12 caracteres hexadecimais maiúsculos (ex: AABBCCDDEEFF)
String obterMacLimpo() {
  String mac = WiFi.macAddress();
  mac.replace(":", "");
  mac.toUpperCase();
  return mac;
}

// Publica a confirmação (ACK) para destravar o backend imediatamente
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

// Publica evento de leitura RFID para o backend (presença de animal)
void publicarPresencaRfid(String tagUid, const char* evento) {
  StaticJsonDocument<128> doc;
  doc["tagUid"] = tagUid;
  doc["typeEvent"] = evento;

  char buffer[128];
  serializeJson(doc, buffer);

  Serial.println("\n=======================================================");
  Serial.printf("[RFID -> BACKEND] Publicando Evento: %s | Tag: %s\n", evento, tagUid.c_str());
  Serial.printf("[RFID -> BACKEND] Tópico: %s\n", topicRfid.c_str());
  Serial.printf("[RFID -> BACKEND] Payload: %s\n", buffer);
  Serial.println("=======================================================");

  mqttClient.publish(topicRfid.c_str(), buffer, false);
}

// Processa o comando recebido do CleanService do Backend
void processarComandoBomba(String payload) {
  StaticJsonDocument<256> doc;
  DeserializationError erro = deserializeJson(doc, payload);

  if (erro) {
    Serial.printf("[ERRO] Falha ao interpretar JSON: %s\n", erro.c_str());
    return;
  }

  const char* comandoId = doc["comandoId"];
  int duracaoSegundos = doc["duracao"] | 10; // Se vier nulo, assume 10s

  if (!comandoId) {
    Serial.println("[ERRO] JSON recebido sem 'comandoId'!");
    return;
  }

  Serial.println("\n=======================================================");
  Serial.printf("[COMANDO RECEBIDO] Acionar Bomba | ID: %s | Duração: %d s\n", comandoId, duracaoSegundos);
  Serial.println("=======================================================");

  // 1. Liga o relé físico
  digitalWrite(PIN_RELE, HIGH);
  bombaAtiva = true;
  tempoInicioBomba = millis();
  duracaoBombaMs = (unsigned long)duracaoSegundos * 1000;
  Serial.println("[HARDWARE] Bomba d'água LIGADA!");

  // 2. Envia o ACK de volta para o backend destravar o CleanService
  enviarAck(comandoId, "OK");
}

// Callback chamado sempre que chega uma mensagem MQTT assinada
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

// Conexão Wi-Fi
void conectarWifi() {
  Serial.print("Conectando ao Wi-Fi: ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD, 6);

  while (WiFi.status() != WL_CONNECTED) {
    delay(250);
    Serial.print(".");
  }

  Serial.println("\n[Wi-Fi] Conectado com sucesso!");
  Serial.print("[Wi-Fi] Endereço IP: ");
  Serial.println(WiFi.localIP());

  // Define os tópicos agora que o MAC está disponível
  macAddress = obterMacLimpo();
  topicComando = String(TOPIC_PREFIX) + "/" + macAddress + "/bomba/comando";
  topicAck     = String(TOPIC_PREFIX) + "/" + macAddress + "/bomba/ack";
  topicOdor    = String(TOPIC_PREFIX) + "/" + macAddress + "/odor/nivel";
  topicStatus  = String(TOPIC_PREFIX) + "/" + macAddress + "/status";
  topicRfid    = String(TOPIC_PREFIX) + "/" + macAddress + "/rfid/leitura";

  Serial.println("-------------------------------------------------------");
  Serial.printf(">>> MAC CADASTRADO NO CURRAL: %s <<<\n", macAddress.c_str());
  Serial.printf(">>> ASSINANDO COMANDOS EM: %s <<<\n", topicComando.c_str());
  Serial.printf(">>> PUBLICANDO RFID EM: %s <<<\n", topicRfid.c_str());
  Serial.println("-------------------------------------------------------");
}

// Reconexão ao Broker MQTT
void reconectarMqtt() {
  while (!mqttClient.connected()) {
    Serial.print("[MQTT] Tentando conectar ao Broker HiveMQ...");

    // Adiciona sufixo aleatório para evitar conflito de ClientID com outras instâncias no broker público
    String clientId = "ESP32-Curral-" + macAddress + "-" + String(random(1000, 9999));

    // Conecta com Last Will (envia OFFLINE se perder sinal)
    if (mqttClient.connect(clientId.c_str(), topicStatus.c_str(), 1, true, "{\"status\":\"OFFLINE\"}")) {
      Serial.println(" Conectado!");

      // Publica status ONLINE
      mqttClient.publish(topicStatus.c_str(), "{\"status\":\"ONLINE\"}", true);

      // Assina o tópico de comando da bomba deste curral
      mqttClient.subscribe(topicComando.c_str(), 1);
      Serial.printf("[MQTT] Inscrito no tópico: %s\n", topicComando.c_str());

    } else {
      Serial.print(" Falhou. Código de erro: ");
      Serial.print(mqttClient.state());
      Serial.println(" Tentando novamente em 3 segundos...");
      delay(3000);
    }
  }
}

// Envia telemetria do MQ-135 e DHT22
void enviarTelemetria() {
  int leituraBruta = analogRead(PIN_MQ135);
  // O slider do sensor MQ no Wokwi vai de 0 a 10.000 ppm.
  // Alimentado em 5V, a saída analógica do sensor no ADC de 12 bits do ESP32 varia de ~350 (ar limpo) a ~3950 (10k ppm).
  int leituraOdor = map(leituraBruta, 350, 3950, 0, 10000);
  leituraOdor = constrain(leituraOdor, 0, 10000);

  float temperatura = dht.readTemperature();
  float umidade = dht.readHumidity();

  StaticJsonDocument<128> doc;
  doc["valor"] = leituraOdor;

  char buffer[128];
  serializeJson(doc, buffer);

  Serial.printf("[TELEMETRIA] Odor: %d ppm (ADC Bruto: %d) | Temp: %.1f C | Umid: %.1f %% -> Publicando...\n",
                leituraOdor, leituraBruta, isnan(temperatura) ? 0.0 : temperatura, isnan(umidade) ? 0.0 : umidade);

  mqttClient.publish(topicOdor.c_str(), buffer, false);
}

// ============================================================================
// SETUP E LOOP
// ============================================================================

void setup() {
  Serial.begin(115200);

  pinMode(PIN_RELE, OUTPUT);
  pinMode(PIN_PIR, INPUT);
  pinMode(PIN_MQ135, INPUT);

  // Inicia com a bomba desligada
  digitalWrite(PIN_RELE, LOW);

  dht.begin();

  // Inicializa o sensor RFID MFRC522 (SPI)
  SPI.begin();
  rfid.PCD_Init();
  Serial.println("[HARDWARE] Sensor RFID MFRC522 inicializado!");

  // Conecta Wi-Fi e configura MQTT
  conectarWifi();
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);
  mqttClient.setBufferSize(512);

  Serial.println("[SISTEMA] Curral Inteligente pronto para receber comandos!");
  Serial.println("[DICA DE TESTE] Teste com múltiplos bois:");
  Serial.println("  - Digite 'entrou E2801160' ou 'entrou A1B2C3D4'");
  Serial.println("  - Digite 'saiu E2801160' ou 'saiu A1B2C3D4'");
  Serial.println("  - Digite 'status' para ver quem está dentro do curral");
  Serial.println("  - Ou simplesmente aproxime diferentes cartões no sensor RFID!");
}

void loop() {
  // Mantém a conexão MQTT ativa
  if (!mqttClient.connected()) {
    reconectarMqtt();
  }
  mqttClient.loop();

  // 1. Temporizador Não-Bloqueante da Bomba d'água
  // Desliga a bomba após esgotar o tempo determinado pelo backend sem travar a placa
  if (bombaAtiva && (millis() - tempoInicioBomba >= duracaoBombaMs)) {
    digitalWrite(PIN_RELE, LOW);
    bombaAtiva = false;
    Serial.println("\n[HARDWARE] Duração da lavagem finalizada. Bomba d'água DESLIGADA!");
  }

  // 2. Telemetria Periódica do Odor (a cada 15 segundos)
  if (millis() - ultimoEnvioTelemetria >= INTERVALO_TELEMETRIA) {
    ultimoEnvioTelemetria = millis();
    enviarTelemetria();
  }

  // 3. Leitura do Sensor RFID MFRC522 (Passagem de Animal no Wokwi ou Placa Física)
  if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
    if (millis() - ultimoRfidLeitura >= 2000) { // Debounce de 2s para evitar repetições
      ultimoRfidLeitura = millis();

      String tagUid = "";
      for (byte i = 0; i < rfid.uid.size; i++) {
        if (rfid.uid.uidByte[i] < 0x10) tagUid += "0";
        tagUid += String(rfid.uid.uidByte[i], HEX);
      }
      tagUid.toUpperCase();

      // Alterna a presença ESPECÍFICA DESTE ANIMAL:
      // Se este animal já estava dentro -> SAIU
      // Se este animal estava fora -> ENTROU
      const char* evento = alternarPresencaAnimal(tagUid);

      publicarPresencaRfid(tagUid, evento);
      Serial.printf("[CURRAL] Boi '%s' %s | Total de animais no curral agora: %d\n",
                    tagUid.c_str(), evento, tagsNoCurral.size());
    }
    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
  }

  // 4. Atalho Interativo no Serial Monitor (suporta diferentes animais)
  if (Serial.available() > 0) {
    String input = Serial.readStringUntil('\n');
    input.trim();

    if (input.length() > 0) {
      int spaceIndex = input.indexOf(' ');
      String cmd = (spaceIndex > 0) ? input.substring(0, spaceIndex) : input;
      String tagArg = (spaceIndex > 0) ? input.substring(spaceIndex + 1) : "";
      cmd.toLowerCase();
      tagArg.trim();
      tagArg.toUpperCase();

      // Se a tag não for especificada, usa a Vaca Mimosa como padrão
      if (tagArg.length() == 0 && (cmd == "in" || cmd == "entrou" || cmd == "out" || cmd == "saiu")) {
        tagArg = "E2801160";
      }

      if (cmd == "in" || cmd == "entrou") {
        if (!isAnimalNoCurral(tagArg)) {
          tagsNoCurral.push_back(tagArg);
        }
        publicarPresencaRfid(tagArg, "ENTROU");
        Serial.printf("[CURRAL] Boi '%s' ENTROU | Total no curral: %d\n", tagArg.c_str(), tagsNoCurral.size());
      } else if (cmd == "out" || cmd == "saiu") {
        for (size_t i = 0; i < tagsNoCurral.size(); i++) {
          if (tagsNoCurral[i].equalsIgnoreCase(tagArg)) {
            tagsNoCurral.erase(tagsNoCurral.begin() + i);
            break;
          }
        }
        publicarPresencaRfid(tagArg, "SAIU");
        Serial.printf("[CURRAL] Boi '%s' SAIU | Total no curral: %d\n", tagArg.c_str(), tagsNoCurral.size());
      } else if (cmd == "status") {
        Serial.println("\n-------------------------------------------------------");
        Serial.printf("[STATUS CURRAL] Total de animais presentes: %d\n", tagsNoCurral.size());
        for (size_t i = 0; i < tagsNoCurral.size(); i++) {
          Serial.printf("  -> Boi Tag: %s\n", tagsNoCurral[i].c_str());
        }
        Serial.println("-------------------------------------------------------");
      } else {
        // Se digitou apenas uma Tag RFID (ex: E2801160 ou A1B2C3D4)
        String tagDireta = input;
        tagDireta.toUpperCase();
        const char* evento = alternarPresencaAnimal(tagDireta);
        publicarPresencaRfid(tagDireta, evento);
        Serial.printf("[CURRAL] Boi '%s' %s | Total no curral: %d\n", tagDireta.c_str(), evento, tagsNoCurral.size());
      }
    }
  }
}
