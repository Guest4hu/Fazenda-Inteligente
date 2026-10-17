#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <DHT.h>

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
#define PIN_RELE   26   // Relé da Bomba d'água
#define PIN_PIR    27   // Sensor de Presença de Animais (PIR)
#define PIN_DHT    32   // Sensor DHT22 (Temperatura e Umidade)
#define PIN_MQ135  34   // Sensor de Odor/Gás (Amônia/Fezes)

#define TIPO_DHT DHT22
DHT dht(PIN_DHT, TIPO_DHT);

WiFiClient espClient;
PubSubClient mqttClient(espClient);

// Identificação e Tópicos Dinâmicos
String macAddress = "";
String topicComando = "";
String topicAck = "";
String topicOdor = "";
String topicStatus = "";

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
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
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

  Serial.println("-------------------------------------------------------");
  Serial.printf(">>> MAC CADASTRADO NO CURRAL: %s <<<\n", macAddress.c_str());
  Serial.printf(">>> ASSINANDO COMANDOS EM: %s <<<\n", topicComando.c_str());
  Serial.println("-------------------------------------------------------");
}

// Reconexão ao Broker MQTT
void reconectarMqtt() {
  while (!mqttClient.connected()) {
    Serial.print("[MQTT] Tentando conectar ao Broker HiveMQ...");

    String clientId = "ESP32-Curral-" + macAddress;

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
      Serial.println(" Tentando novamente em 5 segundos...");
      delay(5000);
    }
  }
}

// Envia telemetria do MQ-135 e DHT22
void enviarTelemetria() {
  int leituraOdor = analogRead(PIN_MQ135);
  float temperatura = dht.readTemperature();
  float umidade = dht.readHumidity();

  StaticJsonDocument<128> doc;
  doc["valor"] = leituraOdor;

  char buffer[128];
  serializeJson(doc, buffer);

  Serial.printf("[TELEMETRIA] Odor: %d | Temp: %.1f C | Umid: %.1f %% -> Publicando...\n",
                leituraOdor, isnan(temperatura) ? 0.0 : temperatura, isnan(umidade) ? 0.0 : umidade);

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

  // Conecta Wi-Fi e configura MQTT
  conectarWifi();
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);

  Serial.println("[SISTEMA] Curral Inteligente pronto para receber comandos!");
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
}
