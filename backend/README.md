# API REST e Núcleo IoT — Backend Spring Boot (USJT_A3)

Servidor de aplicação em **Java 25** e **Spring Boot 4**, responsável pelas regras de negócio, persistência relacional, autenticação segura, orquestração de mensageria MQTT com microcontroladores ESP32 e streaming reativo Server-Sent Events (SSE) para o **Sistema de Curral Inteligente**.

---

## Sumário

1. [Visão Geral e Arquitetura do Backend](#1-visão-geral-e-arquitetura-do-backend)
2. [Pré-requisitos e Versões Verificadas](#2-pré-requisitos-e-versões-verificadas)
3. [Infraestrutura Docker Compose](#3-infraestrutura-docker-compose)
4. [Configurações da Aplicação e Variáveis de Ambiente](#4-configurações-da-aplicação-e-variáveis-de-ambiente)
5. [Banco de Dados Relacional e Migrações Flyway](#5-banco-de-dados-relacional-e-migrações-flyway)
6. [Segurança, Autenticação JWT e Diagnóstico de CORS](#6-segurança-autenticação-jwt-e-diagnóstico-de-cors)
7. [Tratamento Global de Erros RFC 7807 (ProblemDetail)](#7-tratamento-global-de-erros-rfc-7807-problemdetail)
8. [Catálogo de Controladores e Endpoints REST](#8-catálogo-de-controladores-e-endpoints-rest)
9. [Lógica de Negócios e as Três Travas Fail-Fast](#9-lógica-de-negócios-e-as-três-travas-fail-fast)
10. [Topologia de Mensageria MQTT e Hardware ESP32](#10-topologia-de-mensageria-mqtt-e-hardware-esp32)
11. [Modelagem de Dados (Entidades JPA e Repositórios)](#11-modelagem-de-dados-entidades-jpa-e-repositórios)
12. [Suíte de Testes Automatizados (JUnit 5 / Mockito)](#12-suíte-de-testes-automatizados-junit-5--mockito)

---

## 1. Visão Geral e Arquitetura do Backend

O backend atua como o cérebro central da solução agropecuária, gerenciando o ciclo de vida dos currais, a integridade dos rebanhos e a segurança das rotinas de limpeza automatizada.

### Stack Tecnológico:
- **Linguagem & Runtime:** Java 25 (validado com OpenJDK 25.0.4.1)
- **Framework Principal:** Spring Boot 4.2.0-M2 (`spring-boot-starter-webmvc`, `spring-boot-starter-data-jpa`, `spring-boot-starter-security`, `spring-boot-starter-validation`, `spring-boot-starter-actuator`)
- **Build Tool:** Apache Maven 3.10.0 gerenciado via **Maven Wrapper** (`./mvnw`)
- **Persistência Relacional:** PostgreSQL 17 com controle de versão de esquema via **Flyway** (`flyway-database-postgresql`) e validação estrita do Hibernate (`ddl-auto: validate`)
- **Mensageria IoT:** Spring Integration MQTT com cliente Eclipse Paho MQTTv3 (`org.eclipse.paho.client.mqttv3:1.2.5`)
- **Autenticação:** Stateless JWT assinado via HMAC256 através da biblioteca Auth0 (`com.auth0:java-jwt:4.5.0`)
- **Streaming em Tempo Real:** Server-Sent Events nativo do Spring MVC (`SseEmitter`)

---

## 2. Pré-requisitos e Versões Verificadas

- **Java Development Kit (JDK):** **`Java 25`** (especificado em `<java.version>25</java.version>` no `pom.xml`).
- **Apache Maven:** Versão **`3.10.0`** embutida através do Maven Wrapper (`./mvnw`).
- **PostgreSQL 17:** **Estritamente obrigatório** para execução do backend. A aplicação não utiliza banco em memória (H2/HSQLDB) e aborta a inicialização caso o PostgreSQL não esteja acessível.
- **Broker MQTT:** Suporte padrão a HiveMQ público (`tcp://broker.hivemq.com:1883`) ou Mosquitto local na porta `1883`.

---

## 3. Infraestrutura Docker Compose

O arquivo `backend/compose.yaml` define os serviços de infraestrutura recomendados para o ambiente de desenvolvimento e produção local:

```yaml
services:
  postgres:
    image: postgres:17
    container_name: fazendaDb-postgres
    environment:
      POSTGRES_DB: fazenda
      POSTGRES_USER: root
      POSTGRES_PASSWORD: root
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U curral -d curral"]
      interval: 5s
      timeout: 5s
      retries: 10

  mosquitto:
    image: eclipse-mosquitto:2
    container_name: fazenda-inteligente-mosquitto
    ports:
      - "1883:1883"
    volumes:
      - ./mosquitto/config:/mosquitto/config
      - mosquitto-data:/mosquitto/data

volumes:
  postgres-data:
  mosquitto-data:
```

### Inicialização Rápida:
```bash
# Iniciar o banco de dados PostgreSQL 17
docker compose -f compose.yaml up -d postgres
```

---

## 4. Configurações da Aplicação e Variáveis de Ambiente

O arquivo de propriedades ativo é `backend/src/main/resources/application.yaml`:

```yaml
spring:
  application:
    name: curral-inteligente
  datasource:
    url: jdbc:postgresql://localhost:5432/fazenda
    username: root
    password: root
  jpa:
    hibernate:
      ddl-auto: validate
  flyway:
    enabled: true

mqtt:
  broker-url: tcp://broker.hivemq.com:1883
  topic-prefix: a3-usjt-fazenda-inteligente/curral
  client-id-prefix: fazenda-inteligente-backend

api:
  security:
    token:
      secret: ${JWT_TOKEN:chave-secreta-padrao-desenvolvimento-a3-usjt-1234567890}
      issuer: ${JWT_ISSUER:a3-fazenda}
```

### Parâmetros e Sobrescritas Suportadas:
- `JWT_TOKEN`: Chave secreta para assinatura dos tokens JWT.
- `JWT_ISSUER`: Nome do emissor registrado no token JWT (padrão: `a3-fazenda`).
- `SPRING_DATASOURCE_URL`: URL JDBC do PostgreSQL.
- `SPRING_DATASOURCE_USERNAME` e `SPRING_DATASOURCE_PASSWORD`: Credenciais do banco.
- `MQTT_BROKER_URL`: Endereço do broker MQTT (padrão: HiveMQ público).

### ⚠️ Informações Indedutíveis no Arquivo de Configuração (Sinalização Explícita):
1. **Porta HTTP (`server.port`):** Não configurada no YAML. Assume a porta padrão do ecossistema Spring Boot: **`8080`**.
2. **Context Path (`server.servlet.context-path`):** Não configurado no YAML. Assume a raiz **`/`**.
3. **Driver JDBC e Dialeto Hibernate:** Omitidos intencionalmente do YAML, aproveitando o recurso de auto-configuração do Spring Boot com base no driver PostgreSQL presente no classpath.
4. **Tempo de Expiração do JWT:** Não é parametrizável via YAML. Está fixado no código Java (`TokenService.java`) em **24 horas**.

---

## 5. Banco de Dados Relacional e Migrações Flyway

O banco de dados relacional é governado pelo **Flyway**, garantindo versionamento rigoroso e aplicação automática do esquema na inicialização do backend.

### Scripts de Migração (`src/main/resources/db/migration/`):

1. **`V202610152058__create_initial_schema.sql`:**
   - Cria as tabelas centrais: `users`, `farms`, `corral`, `animals`, `animal_event`, `odor_telemetry`, `clean_cmd`, `identify_pendency`.
   - Cria índices essenciais de performance multi-tenant: `idx_farms_user_id`, `idx_corral_farm_id`, `idx_animals_farm_id`, `idx_animals_current_corral`, `idx_animal_event_corral`, `idx_odor_telemetry_corral_instant`.
   - **Índice parcial único anti-concorrência:**
     ```sql
     CREATE UNIQUE INDEX uq_clean_cmd_active_per_corral
       ON clean_cmd(corral_id)
       WHERE state IN ('PENDENTE', 'EM_ANDAMENTO');
     ```
     Garante no nível do motor relacional que nunca existam dois comandos de lavagem ativos simultâneos para o mesmo curral.
   - **Índice parcial de pendências abertas:**
     ```sql
     CREATE INDEX idx_identify_pendency_open_corral
       ON identify_pendency(corral_id, instant DESC)
       WHERE resolved = FALSE;
     ```

2. **`V202610300100__add_temperature_humidity_to_odor_telemetry.sql`:**
   - Adiciona colunas `temperature DOUBLE PRECISION NULL` e `humidity DOUBLE PRECISION NULL` à tabela `odor_telemetry` para acomodar medições do sensor DHT22.

3. **`V202610300101__allow_zero_duration_for_stop_clean_cmd.sql`:**
   - Atualiza a restrição de integridade `chk_clean_cmd_duration` de `> 0` para `>= 0`, viabilizando o registro de comandos de parada imediata (`seconds_duration = 0`) para auditoria da ação de parada da bomba.

---

## 6. Segurança, Autenticação JWT e Diagnóstico de CORS

### 6.1 Arquitetura de Segurança (`com.usjt.a3.config.security`)
- **`SecurityConfig`:** Configurado como 100% **Stateless** (`SessionCreationPolicy.STATELESS`) e CSRF desativado.
  - Endpoints públicos liberados: `POST /api/v1/auth/**` e `/actuator/**`.
  - Todas as demais rotas exigem autenticação (`anyRequest().authenticated()`).
  - Criptografia: `BCryptPasswordEncoder` para geração de hash de senhas de produtores rurais.
- **`SecurityFilter`:** Filtro `OncePerRequestFilter` que valida o token JWT e extrai o `UserPrincipal` (Record com `id`, `name`, `email`), associando a autoridade `ROLE_USER`.
- **Suporte Duplo de Extração do Token:**
  1. Cabeçalho HTTP padrão: `Authorization: Bearer <token>`
  2. Parâmetro de busca na URL: `?token=<token>` (implementado para contornar a limitação nativa do `EventSource` no navegador, viabilizando o streaming SSE autenticado).

### 6.2 Diagnóstico de CORS
> **Constatação Estrita de Código:**
> **Não há nenhuma configuração de CORS implementada no backend.** O `SecurityConfig` não invoca `.cors()`, não existem filtros de CORS (`CorsFilter` / `WebMvcConfigurer`) e nenhum controller utiliza a anotação `@CrossOrigin`.
> No ambiente de desenvolvimento, a comunicação é intermediada pelo proxy reverso do Vite em `frontend/vite.config.ts`, que retransmite chamadas `/api` de forma server-to-server.

---

## 7. Tratamento Global de Erros RFC 7807 (`ProblemDetail`)

A classe `GlobalExceptionHandler` padroniza todas as falhas de API no formato formal **RFC 7807**:

| Exceção Interceptada | HTTP Status Code | Problem Title | Problem Detail / Propriedades |
|---|---|---|---|
| `BadCredentialsException` | `401 UNAUTHORIZED` | `"Credenciais Inválidas"` | Mensagem de erro de login |
| `EntityNotFoundException` | `404 NOT_FOUND` | `"Recurso Não Encontrado"` | Descrição do recurso que não existe |
| `SecurityException` | `403 FORBIDDEN` | `"Acesso Negado"` | Tentativa de acesso a recurso de outro usuário |
| `IllegalStateException` | `409 CONFLICT` | `"Conflito de Regra de Negócio"` | Violação de travas de segurança ou unicidade |
| `MethodArgumentNotValidException` | `400 BAD_REQUEST` | `"Erro de Validação"` | Dicionário `invalidParams: {campo: erro}` |
| `HttpMessageNotReadableException` | `400 BAD_REQUEST` | `"Corpo da Requisição Inválido"` | Notificação de JSON inválido |
| `Exception` (Genérica) | `500 INTERNAL_SERVER_ERROR` | `"Erro Interno do Servidor"` | Mensagem genérica segura |

---

## 8. Catálogo de Controladores e Endpoints REST

O backend disponibiliza **rotas aninhadas e rotas diretas** para conveniência dos clientes HTTP:

### 8.1 `AuthController` (`/api/v1/auth`)
- `POST /api/v1/auth/login` (Público):
  - Request: `LoginRequestDTO(email, password)`.
  - Response: `AuthResponseDTO(token, userId, name, email)`. Status: `200 OK`.
- `POST /api/v1/auth/register` (Público):
  - Request: `RegisterRequestDTO(name, email, password)`.
  - Response: `AuthResponseDTO`. Status: `201 CREATED`. Lança `409 Conflict` se e-mail já existir.

### 8.2 `FarmController` (`/api/v1/farms`)
- `POST /api/v1/farms` (`ROLE_USER`): Cria fazenda associada ao usuário (`201 CREATED`).
- `GET /api/v1/farms` (`ROLE_USER`): Lista fazendas do produtor logado (`200 OK`).
- `PUT /api/v1/farms/{farmId}` (`ROLE_USER`): Renomeia fazenda (`200 OK`).
- `DELETE /api/v1/farms/{farmId}` (`ROLE_USER`): Exclui fazenda (`204 NO_CONTENT`). Bloqueia com `409 Conflict` se houver lavagem em andamento.

### 8.3 `CorralController` (`/api/v1`)
- `POST /api/v1/farms/{farmId}/currais`: Cria curral com validação de MAC de 12 hexadecimais (`201 CREATED`).
- `GET /api/v1/farms/{farmId}/currais`: Lista currais da fazenda (`200 OK`).
- `GET /api/v1/currais/{corralId}` (e rota aninhada `/farms/{farmId}/currais/{corralId}`): Detalhes do curral (`200 OK`).
- `PUT /api/v1/currais/{corralId}/parametros`: Ajusta `cleanTime`, `limitOdor` e `pumpDurationSeconds` (`200 OK`).
- `GET /api/v1/currais/{corralId}/metricas`: Total de animais, contadores de limpeza e pendências (`200 OK`).
- `GET /api/v1/currais/{corralId}/stream`: Conexão Server-Sent Events (`text/event-stream`).
- `DELETE /api/v1/currais/{corralId}`: Remove curral se não houver lavagem ativa (`204 NO_CONTENT`).

### 8.4 `AnimalController` (`/api/v1`)
- `POST /api/v1/farms/{farmId}/animais`: Cadastra animal com RFID único (`201 CREATED`).
- `GET /api/v1/farms/{farmId}/animais`: Lista animais da fazenda com localização atual (`200 OK`).
- `POST /api/v1/currais/{corralId}/presenca`: Registra movimentação `ENTROU`/`SAIU` (`201 CREATED`).
- `GET /api/v1/currais/{corralId}/eventos`: Histórico de movimentações no curral (`200 OK`).
- `PUT /api/v1/animais/{animalId}` e `DELETE /api/v1/animais/{animalId}`: Atualização e exclusão de animais.

### 8.5 `CleanController` (`/api/v1/currais`)
- `POST /api/v1/currais/{corralId}/limpeza`: Aciona lavagem manual com validação das 3 travas de segurança (`200 OK`).
- `POST /api/v1/currais/{corralId}/limpeza/parar` (ou `.../parar`): Interrompe a bomba d'água via MQTT (`200 OK`).
- `GET /api/v1/currais/{corralId}/limpezas`: Histórico de ordens de limpeza do curral (`200 OK`).

### 8.6 `OdorController` e `PendencyController`
- `GET /api/v1/currais/{corralId}/odor`: Retorna as últimas 30 telemetrias do sensor MQ-135 (`200 OK`).
- `GET /api/v1/currais/{corralId}/pendencias`: Lista tags RFID lidas não cadastradas (`200 OK`).
- `POST /api/v1/pendencias/{pendencyId}/resolver` (e `PUT ...`): Vincula tag desconhecida a animal existente (`200 OK`).

---

## 9. Lógica de Negócios e as Três Travas Fail-Fast

### 9.1 As Três Travas de Segurança da Limpeza (`CleanService.java`)
Antes de autorizar o envio do comando de ativação da bomba d'água ao ESP32 via MQTT, o método `CleanService.executeCleanProcess` impõe verificações defensivas rigorosas:

1. **Trava Biológica (Presença Animal no Curral):**
   - Invoca `animalRepository.existsByCurrentCorralId(corralId)`.
   - Se houver qualquer animal no curral, lança `IllegalStateException`:
     > `"Tem uma vaca no curral neste momento, não tem como acionar a bomba de limpeza"` (HTTP 409 Conflict).
2. **Trava de Concorrência Física:**
   - Invoca `cleanCmdRepository.existsByCorralIdAndCleanState(corralId, CleanState.EM_ANDAMENTO)`.
   - Impede ordens concorrentes com a mensagem:
     > `"A bomba já está em andamento para este curral"` (HTTP 409 Conflict).
3. **Trava de Conectividade do Dispositivo (Heartbeat):**
   - Verifica se o curral possui status `OFFLINE` ou se o último batimento cardíaco (`lastSeenAt`) é anterior a 60 segundos no passado.
   - Rejeita com a mensagem:
     > `"O dispositovo deste curral esta offline, não é possivel acionar a limpeza"` (HTTP 409 Conflict).

#### ⚠️ Decisão Crítica de Arquitetura Transacional:
O método `executeCleanProcess` **NÃO possui anotação `@Transactional`**. Essa decisão técnica foi adotada intencionalmente para evitar que conexões do pool JDBC HikariCP fiquem presas e ociosas enquanto o serviço aguarda de forma síncrona a resposta do microcontrolador na rede MQTT (`ackService.awaitAck`, com timeout de até 10 segundos). As operações de banco são persistidas em transações curtas e isoladas nos momentos de início e conclusão do ciclo.

### 9.2 Agendamento Periódico Automático (`CleanSchedulerService.java`)
A classe executa uma rotina automática minute-by-minute via `@Scheduled(cron = "0 * * * * *")`.
- Filtra todos os currais com `cleanTime` programado.
- Se o horário atual casar com o horário agendado, dispara a limpeza automática.
- Trata `IllegalStateException` de forma defensiva: se a trava biológica barrar a limpeza agendada por haver animais no curral, loga um aviso (`WARN`) e prossegue com a avaliação dos currais restantes.

---

## 10. Topologia de Mensageria MQTT e Hardware ESP32

O backend se conecta ao broker MQTT utilizando a biblioteca Spring Integration MQTT e Eclipse Paho v3. Para evitar colisões de conexão caso múltiplas instâncias sejam iniciadas, o sistema gera dinamicamente Client IDs únicos adicionando um fragmento de UUID:
- Receptor (RX): `fazenda-inteligente-backend-rx-<uuid8>`
- Transmissor (TX): `fazenda-inteligente-backend-tx-<uuid8>`

### Topologia de Tópicos (Prefixo `a3-usjt-fazenda-inteligente/curral/{MAC}/`):
- `rfid/leitura` (Inbound): Ingestão de tags RFID lidas pelo ESP32. Se a tag for desconhecida, abre um registro na fila `identify_pendency` e notifica clientes via SSE (`pendencia`).
- `odor/nivel` (Inbound): Ingestão contínua de telemetria (amônia, temperatura, umidade). Se o valor ultrapassar `limitOdor`, tenta disparar limpeza autônoma por evento (`CleanOrigin.EVENTO`).
- `bomba/ack` (Inbound): Resposta do ESP32 confirmando o acionamento do relé físico da bomba.
- `status` (Inbound): Heartbeat periódico renovando o status `ONLINE` e o timestamp `lastSeenAt`.
- `bomba/comando` (Outbound): Publicação de comandos pelo backend (`{"comandoId": "...", "duracao": 30}` ou parada com `duracao: 0` e `acao: "PARAR"`).

---

## 11. Modelagem de Dados (Entidades JPA e Repositórios)

### Entidades JPA Centrais:
- **`User` (`users`):** `id`, `name`, `email` (unique), `password_hash`, `created_at`.
- **`Farm` (`farms`):** `id`, `user_id` (FK User), `name`, `created_at`.
- **`Corral` (`corral`):** `id`, `farm_id` (FK Farm), `name`, `mac_address` (unique, 12 hex chars), `clean_time`, `limit_odor` (def: 400), `pump_duration_seconds` (def: 30), `device_status`, `last_seen_at`.
- **`Animal` (`animals`):** `id`, `farm_id` (FK Farm), `name`, `identification`, `tag_uid` (unique, hex), `current_corral_id` (FK Corral).
- **`AnimalEvent` (`animal_event`):** `id`, `corral_id`, `animal_id`, `type_event` (`ENTROU`/`SAIU`), `origin` (`TAG`/`MANUAL`), `instant`.
- **`CleanCmd` (`clean_cmd`):** `id` (UUID), `corral_id`, `origin` (`MANUAL`/`AUTOMATICA`/`EVENTO`), `state` (`PENDENTE`/`EM_ANDAMENTO`/`CONCLUIDO`/`CANCELADO`), `seconds_duration`, `created_at`.
- **`IdentifyPendency` (`identify_pendency`):** `id`, `corral_id`, `tag_uid`, `type_event`, `instant`, `resolved` (boolean), `animal_id_resolved`, `resolved_at`.
- **`OdorTelemetry` (`odor_telemetry`):** `id`, `corral_id`, `value`, `temperature`, `humidity`, `instant`.

---

## 12. Suíte de Testes Automatizados (JUnit 5 / Mockito)

A suíte de testes do backend é composta por **25 arquivos de teste e utilitários**, totalizando **345 casos de teste automatizados**:
- **340 Testes Isolados (Unitários, Mockito, MockMvc e Desafios Adversariais):** Executam sem necessidade de infraestrutura de banco de dados e cobrem exaustivamente validações de DTOs, fatiamento de controllers, regras de transição de estado e ataques de concorrência.
- **5 Testes de Integração Real:** (`CommandRfidLeituraRealDbTest` e `A3ApplicationTests`) validam o contexto completo do Spring Boot e a integridade do esquema contra o banco de dados PostgreSQL 17 real na porta 5432.

### Comandos de Teste e Compilação:
```bash
# Compilar e validar a integridade sintática
./mvnw test-compile

# Rodar todos os testes automatizados (requer PostgreSQL ativo via Docker Compose)
docker compose -f compose.yaml up -d postgres
./mvnw test
```
