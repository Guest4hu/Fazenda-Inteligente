# Fazenda Inteligente — Sistema de Curral Inteligente (USJT_A3)

Sistema completo de monitoramento ambiental, rastreamento de animais e automação de lavagem com travas de segurança biológica para currais pecuários. O projeto integra dispositivos IoT baseados no microcontrolador ESP32, um backend robusto em Java 25 com Spring Boot 4, e um painel de controle interativo em tempo real para o produtor rural desenvolvido em React 19 e Vite 7.

---

## Sumário

1. [Visão Geral do Sistema](#1-visão-geral-do-sistema)
2. [Constatação de Divergência Arquitetural: React SPA vs Next.js](#2-constatação-de-divergência-arquitetural-react-spa-vs-nextjs)
3. [Pré-requisitos de Sistema e Versões Verificadas](#3-pré-requisitos-de-sistema-e-versões-verificadas)
4. [Instruções Passo a Passo de Instalação](#4-instruções-passo-a-passo-de-instalação)
5. [Configurações, Propriedades e Variáveis de Ambiente](#5-configurações-propriedades-e-variáveis-de-ambiente)
6. [Instruções Detalhadas de Execução](#6-instruções-detalhadas-de-execução)
7. [Comunicação Cross-Stack e Proxy de Desenvolvimento](#7-comunicação-cross-stack-e-proxy-de-desenvolvimento)
8. [Hardware IoT, Mensageria MQTT e Simulação Wokwi](#8-hardware-iot-mensageria-mqtt-e-simulação-wokwi)
9. [Estrutura Completa de Diretórios do Projeto](#9-estrutura-completa-de-diretórios-do-projeto)
10. [Documentação Técnica Detalhada do Backend](#10-documentação-técnica-detalhada-do-backend)
11. [Documentação Técnica Detalhada do Frontend](#11-documentação-técnica-detalhada-do-frontend)
12. [Suítes de Testes Automatizados e Comandos de Verificação](#12-suítes-de-testes-automatizados-e-comandos-de-verificação)
13. [Exemplos Práticos de Uso e Fluxos Operacionais](#13-exemplos-práticos-de-uso-e-fluxos-operacionais)

---

## 1. Visão Geral do Sistema

O **Sistema de Curral Inteligente** foi concebido para modernizar a gestão do bem-estar animal e a higienização de currais na pecuária de precisão. O sistema resolve o desafio crítico de manter instalações limpas sem colocar em risco a integridade física dos animais e sem desperdício de recursos hídricos.

### Principais Pilares da Solução:
- **Telemetria Ambiental em Tempo Real:** Coleta contínua de concentrações de gás amônia/odores (sensor MQ-135/MQ-137), temperatura e umidade relativa do ar (sensor DHT22) através de nós ESP32 instalados nos currais.
- **Rastreamento de Presença e Identificação Animal:** Registro automático da movimentação de animais no curral via RFID (sensor RC522) ou sensor infravermelho passivo (PIR), com triagem inteligente de tags desconhecidas e fila de resolução de pendências.
- **Higienização Automatizada e Segura com Trava Biológica (Fail-Fast):** Acionamento da bomba d'água de forma manual, agendada (horário diário programado via cron) ou autônoma (por disparo de limiar crítico de odor), protegido por **três travas de segurança rigorosas** que impedem o bombeamento se houver qualquer animal presente no curral, se já existir lavagem ativa ou se o dispositivo estiver desconectado.
- **Streaming Reativo Unidirecional (Server-Sent Events - SSE):** Atualização instantânea da interface do produtor sem sobrecarga de rede ou necessidade de recarregar a página.
- **Arquitetura Multi-Tenant:** Isolamento rigoroso de produtores, fazendas, currais e animais autenticados via tokens JWT assinados via HMAC256.

---

## 2. Constatação de Divergência Arquitetural: React SPA vs Next.js

> **⚠️ Constatação Crítica de Fidelidade ao Código:**
> A especificação preliminar do projeto previa uma interface baseada em *React/Next.js*. Contudo, a inspeção minuciosa dos arquivos-fonte do repositório (`frontend/package.json`, `frontend/vite.config.ts`, `frontend/index.html` e `frontend/src/main.tsx`) confirma de forma cabal que **o frontend NÃO utiliza o framework Next.js**.
>
> Trata-se de uma **Single-Page Application (SPA) construída com React 19.1.0 e Vite 7.3.2**:
> - **Inexistência de dependências Next.js:** O arquivo `package.json` não contém o pacote `next` em suas dependências de produção ou de desenvolvimento.
> - **Inexistência de configurações Next.js:** Não há arquivos como `next.config.js`, `next.config.mjs` ou `next.config.ts`.
> - **Ausência de Renderização no Servidor (SSR) ou Roteamento App Router/Pages Router:** A aplicação é totalmente renderizada no navegador cliente (`Client-Side Rendering - CSR`), inicializada a partir de `index.html` via `createRoot(document.getElementById('root')!)`. O arquivo `src/pages/dashboard.tsx` é um componente React comum importado diretamente pela árvore principal em `src/main.tsx`.
> - **Estilização e Ferramentas:** Utiliza **Tailwind CSS v4** integrado nativamente ao Vite através do plugin oficial `@tailwindcss/vite`, ícones vetoriais da biblioteca **Lucide React** e suíte de testes com **Vitest** e **Testing Library**.

---

## 3. Pré-requisitos de Sistema e Versões Verificadas

Para compilar, testar e executar todos os subprojetos da solução, o ambiente hospedeiro deve atender aos seguintes requisitos com versões exatas, deduzidas dos arquivos de configuração do repositório:

| Componente | Requisito / Versão Verificada | Fonte de Dedução no Repositório |
|---|---|---|
| **Runtime Node.js** | `Node.js 20.19+` ou `22.12+` | Exigência explícita de engine do runtime **Vite 7** e documentado em `frontend/README.md`. |
| **Gerenciador de Pacotes Frontend** | **`npm`** (versão 10+) | Confirmado pela presença exclusiva do lockfile `frontend/package-lock.json` (124 KB). Não utilizar Yarn nem PNPM. |
| **Java Development Kit (JDK)** | **`Java 25`** (OpenJDK 25.0.4.1+) | Declarado explicitamente em `backend/pom.xml` via propriedade `<java.version>25</java.version>`. |
| **Ferramenta de Build do Backend** | **`Apache Maven 3.10.0`** (via Maven Wrapper) | Declarado em `backend/.mvn/wrapper/maven-wrapper.properties` (`distributionUrl` apontando para Maven 3.10.0). Execução via `./mvnw`. |
| **Banco de Dados Relacional** | **`PostgreSQL 17`** (Estritamente Obrigatório) | Definido no container `postgres:17` em `backend/compose.yaml` e pela dependência `org.postgresql:postgresql` no `pom.xml`. |
| **Broker MQTT** | **`Eclipse Mosquitto 2`** ou **`HiveMQ Cloud`** | Container `eclipse-mosquitto:2` definido em `backend/compose.yaml` e broker público padrão `tcp://broker.hivemq.com:1883` em `application.yaml`. |
| **Virtualização / Containers** | **`Docker` e `Docker Compose`** | Necessário para instanciar o banco PostgreSQL 17 e o broker Mosquitto via `compose.yaml`. |

---

## 4. Instruções Passo a Passo de Instalação

### Passo 1: Clonar o Repositório
```bash
git clone <URL_DO_REPOSITORIO>
cd USJT_A3
```

### Passo 2: Instalação das Dependências do Frontend
Acesse o diretório do frontend e instale os pacotes npm:
```bash
cd frontend
npm install
cd ..
```

### Passo 3: Resolução e Pré-download de Dependências do Backend
O backend utiliza o utilitário Maven Wrapper embutido (`./mvnw`). Não é necessário instalar o Maven no sistema operacional:
```bash
cd backend
./mvnw dependency:go-offline
cd ..
```

---

## 5. Configurações, Propriedades e Variáveis de Ambiente

### 5.1 Backend (`backend/src/main/resources/application.yaml`)

O arquivo `application.yaml` centraliza as configurações da aplicação Spring Boot:

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

#### Variáveis de Ambiente e Sobrescritas Suportadas pelo Backend:
- `JWT_TOKEN`: Chave secreta de criptografia para assinatura dos tokens JWT pelo algoritmo HMAC256. Caso não informada, assume a chave de fallback de desenvolvimento.
- `JWT_ISSUER`: Identificador do emissor do token JWT (padrão: `a3-fazenda`).
- `SPRING_DATASOURCE_URL`: Permite sobrescrever a URL JDBC do PostgreSQL (ex.: `jdbc:postgresql://postgres-host:5432/fazenda`).
- `SPRING_DATASOURCE_USERNAME`: Usuário do banco (padrão: `root`).
- `SPRING_DATASOURCE_PASSWORD`: Senha do banco (padrão: `root`).
- `MQTT_BROKER_URL`: Permite alternar entre o HiveMQ público padrão (`tcp://broker.hivemq.com:1883`) e um broker Mosquitto local (`tcp://localhost:1883`).

#### ⚠️ Informações Indedutíveis no Arquivo de Propriedades (Sinalização Explícita):
1. **Porta HTTP do Backend (`server.port`):** **Não declarada** no `application.yaml`. Assume o valor padrão do Spring Boot: **`8080`**.
2. **Context Path (`server.servlet.context-path`):** **Não declarado**. Assume o padrão raiz **`/`**. Todas as rotas de negócio mapeiam o prefixo `/api/v1` diretamente nos controladores.
3. **Driver JDBC (`driver-class-name`) e Dialeto Hibernate:** Omitidos intencionalmente do YAML, sendo configurados automaticamente pelo Spring Boot como `org.postgresql.Driver` e `PostgreSQLDialect`.
4. **Tempo de Expiração do JWT:** **Indedutível via arquivo de configuração**. O tempo de vida do token é fixado em **24 horas** diretamente no código Java (`TokenService.java:71`).
5. **CORS:** O backend não possui classe de configuração de CORS nem anotações `@CrossOrigin`. O tráfego local depende exclusivamente do proxy reverso do Vite.

### 5.2 Frontend

- **`VITE_API_BASE_URL` (Opcional):** Lida em tempo de execução pelo cliente HTTP (`frontend/src/services/apiClient.ts`). Se não for definida, assume o valor padrão:
  ```typescript
  const DEFAULT_BASE_URL = '/api/v1';
  ```
- **Comportamento em Desenvolvimento:** O frontend utiliza requisições relativas para `/api/v1/...`, que são interceptadas pelo servidor de desenvolvimento do Vite e encaminhadas ao backend.

---

## 6. Instruções Detalhadas de Execução

### Passo 1: Inicializar o Banco de Dados PostgreSQL 17
O PostgreSQL 17 é **estritamente obrigatório** para o backend. O Hibernate opera com `ddl-auto: validate` e o Flyway aplica as migrações na inicialização.

Inicie o container oficial a partir da pasta raiz:
```bash
docker compose -f backend/compose.yaml up -d postgres
```
Para verificar se o banco de dados está pronto para aceitar conexões:
```bash
docker ps --filter "name=fazendaDb-postgres"
```

### Passo 2: Executar o Backend (Spring Boot 4 / Java 25)
Em um terminal dedicado, execute:
```bash
cd backend
./mvnw spring-boot:run
```
*O backend estará acessível em `http://localhost:8080`.*

Como alternativa para ambientes de produção, é possível compilar o arquivo executável `.jar`:
```bash
cd backend
./mvnw clean package -DskipTests
java -jar target/a3-0.0.1-SNAPSHOT.jar
```

### Passo 3: Executar o Frontend (React 19 / Vite 7)
Em outro terminal dedicado, execute:
```bash
cd frontend
npm run dev
```
*O servidor de desenvolvimento do Vite iniciará em `http://localhost:5173` (ou em todas as interfaces com a flag `--host 0.0.0.0`).*

Abra o navegador em **`http://localhost:5173`** para acessar o painel de controle do produtor.

---

## 7. Comunicação Cross-Stack e Proxy de Desenvolvimento

### Diagnóstico de CORS e Como a Integração Funciona
No backend Spring Boot, o filtro de segurança `SecurityConfig` não habilita `.cors()` e nenhum controlador REST possui anotações `@CrossOrigin`. Se o navegador emitisse chamadas diretas de `http://localhost:5173` para `http://localhost:8080`, essas requisições seriam bloqueadas pela política de mesma origem (Same-Origin Policy).

Para resolver isso de forma elegante em desenvolvimento, o arquivo `frontend/vite.config.ts` estabelece um **proxy reverso embutido**:

```typescript
// frontend/vite.config.ts
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  // ...
})
```

### Mecânica do Fluxo de Requisições:
1. O frontend executa chamadas HTTP para caminhos relativos como `/api/v1/farms` ou `/api/v1/currais`.
2. O servidor Node.js do Vite (na porta `5173`) intercepta o prefixo `/api` e retransmite a chamada via HTTP de servidor para o Spring Boot (na porta `8080`).
3. O Spring Boot recebe a requisição com o cabeçalho `Host: localhost:8080` e responde com os dados JSON.
4. Para o navegador, a requisição manteve a mesma origem (`http://localhost:5173`), dispensando headers CORS.

### Streaming Reativo via Server-Sent Events (SSE):
O endpoint `GET /api/v1/currais/{corralId}/stream` mantém uma conexão HTTP persistente aberta (`text/event-stream`). Como a interface `EventSource` nativa dos navegadores não permite anexar headers customizados (`Authorization: Bearer <token>`), o backend disponibiliza autenticação via parâmetro de busca na URL:
```
http://localhost:5173/api/v1/currais/1/stream?token=<JWT_TOKEN>
```
O componente `SecurityFilter` do Spring Boot extrai o token do query parameter `token` e valida o usuário normalmente, assegurando o streaming em tempo real sem expor dados entre diferentes produtores.

---

## 8. Hardware IoT, Mensageria MQTT e Simulação Wokwi

O ecossistema dispõe de suporte completo a nós sensores baseados no microcontrolador ESP32, incluindo firmware físico e esquemas elétricos prontos para o simulador online [Wokwi](https://wokwi.com).

### 8.1 Versões de Firmware Disponíveis:
- **`Iot/` (Versão 1 - RFID RC522 SPI):** Firmware clássico que utiliza o leitor RFID MFRC522 conectado via barramento SPI (SDA 21, SCK 18, MOSI 23, MISO 19, RST 22), sensor de gás MQ-135 (GPIO 34), sensor DHT22 (GPIO 32) e relé para bomba d'água (GPIO 26).
- **`IotV2/` (Versão 2 - Sensor PIR e Relé Active-LOW):** Firmware modernizado com sensor de presença/movimento infravermelho PIR (GPIO 27), lógica de relé Active-LOW corrigida (GPIO 26), telemetria ambiental e simulação de passagem animal com a tag RFID cadastrada `E2801160`.

### 8.2 Topologia de Tópicos MQTT
Todas as mensagens trafegam sob o prefixo configurável `a3-usjt-fazenda-inteligente/curral/{MAC_ADDRESS}/...`, onde `{MAC_ADDRESS}` é uma cadeia de 12 dígitos hexadecimais em maiúsculas correspondente ao MAC do ESP32 (exemplo: `240AC4000110`):

| Direção | Sufixo do Tópico | Payload JSON de Exemplo | Descrição |
|---|---|---|---|
| **ESP32 ➔ Backend** | `rfid/leitura` | `{"tagUid": "E2801191", "typeEvent": "ENTROU"}` | Registro de leitura do sensor RFID na entrada/saída do curral. |
| **ESP32 ➔ Backend** | `odor/nivel` | `{"valor": 450, "temperatura": 28.5, "umidade": 60.0}` | Telemetria contínua de concentração de gases e clima ambiente. |
| **ESP32 ➔ Backend** | `bomba/ack` | `{"comandoId": "uuid-...", "status": "OK"}` | Confirmação de recebimento e execução do comando de lavagem. |
| **ESP32 ➔ Backend** | `status` | `{"status": "ONLINE"}` | Mensagem periódica de batimento cardíaco (Heartbeat) do curral. |
| **Backend ➔ ESP32** | `bomba/comando` | `{"comandoId": "uuid-...", "duracao": 30}` | Ordem enviada pelo backend para ligar a bomba d'água por N segundos. |
| **Backend ➔ ESP32** | `bomba/comando` | `{"comandoId": "uuid-...", "acao": "PARAR", "duracao": 0}` | Ordem de interrupção imediata de emergência da bomba d'água. |

---

## 9. Estrutura Completa de Diretórios do Projeto

```
USJT_A3/
├── README.md                          # Documentação técnica consolidada da raiz (este documento)
├── RELATORIO_TECNICO_ABNT.pdf         # Relatório técnico acadêmico do projeto em formato ABNT (8 páginas)
│
├── backend/                           # Subprojeto Backend (Java 25 + Spring Boot 4)
│   ├── README.md                      # Documentação técnica detalhada do backend
│   ├── compose.yaml                   # Definição oficial de containers (PostgreSQL 17 e Mosquitto 2)
│   ├── pom.xml                        # Descritor Maven do projeto (Spring Boot 4.2.0-M2, Java 25)
│   ├── mvnw / mvnw.cmd                # Utilitário Maven Wrapper (Apache Maven 3.10.0 embutido)
│   ├── .mvn/wrapper/                  # Configurações de download e versão do Maven Wrapper
│   ├── IaContext/                     # Especificações da API, queries SQL de desenvolvimento e testes .http
│   └── src/
│       ├── main/
│       │   ├── java/com/usjt/a3/
│       │   │   ├── A3Application.java # Classe principal (@SpringBootApplication e @EnableScheduling)
│       │   │   ├── config/            # Configurações de Segurança JWT e Mensageria MQTT
│       │   │   ├── controller/        # Controladores REST da API
│       │   │   ├── dto/               # Records e Classes de Transferência de Dados (DTOs)
│       │   │   ├── exception/         # Tratamento global de exceções RFC 7807 (ProblemDetail)
│       │   │   ├── model/             # Entidades JPA (User, Farm, Corral, Animal, CleanCmd, etc.)
│       │   │   ├── mqtt/              # Handlers de tópicos de entrada e publicadores MQTT
│       │   │   ├── repository/        # Interfaces Spring Data JPA para persistência
│       │   │   └── service/           # Camada de serviços e regras de negócio
│       │   └── resources/
│       │       ├── application.yaml   # Configuração de banco, MQTT e tokens
│       │       └── db/migration/      # Migrações versionadas do banco gerenciadas pelo Flyway
│       └── test/java/com/usjt/a3/     # Suíte com 25 arquivos de testes automatizados e 345 testes
│
├── frontend/                          # Subprojeto Frontend (React 19 + Vite 7 SPA)
│   ├── README.md                      # Documentação técnica detalhada do frontend
│   ├── index.html                     # Ponto de montagem HTML da Single Page Application
│   ├── package.json                   # Dependências e scripts npm (React 19, Tailwind v4, Vitest)
│   ├── package-lock.json              # Trava estrita de versões de dependências npm
│   ├── tsconfig.json                  # Configurações de compilação TypeScript (strict: true)
│   ├── vite.config.ts                 # Configuração do Vite (plugins React/Tailwind, proxy /api e Vitest)
│   ├── src/
│   │   ├── main.tsx                   # Ponto de entrada React (createRoot, StrictMode e Providers)
│   │   ├── index.css                  # Folha de estilos global Tailwind CSS v4 e animações
│   │   ├── components/dashboard/      # Componentes modulares da interface do usuário
│   │   ├── context/                   # Contextos de estado global (AuthContext e FarmCorralContext)
│   │   ├── pages/                     # Componente mestre da tela do Dashboard
│   │   ├── services/                  # Clientes HTTP (apiClient), SSE e funções de API
│   │   └── types/                     # Interfaces TypeScript, contratos de API e DTOs
│   └── tests/                         # Suíte com 27 arquivos de testes e 328 casos de teste (Vitest)
│
├── Iot/                               # Firmware ESP32 V1 (Leitor RFID RC522 SPI)
│   ├── Iot.ino                        # Código-fonte Arduino/C++ para ESP32
│   ├── diagram.json                   # Esquema de fiação e pinagem do circuito Wokwi
│   └── libraries.txt                  # Dependências de bibliotecas Arduino (PubSubClient, ArduinoJson, etc.)
│
└── IotV2/                             # Firmware ESP32 V2 (Sensor PIR de Presença + Relé Active-LOW)
    ├── IotV2.ino                      # Código-fonte Arduino/C++ atualizado
    ├── README.md                      # Documentação técnica do firmware V2 e comandos seriais
    ├── diagram.json                   # Esquema elétrico do circuito no simulador Wokwi
    └── libraries.txt                  # Lista de bibliotecas para simulação
```

---

## 10. Documentação Técnica Detalhada do Backend

### 10.1 Padrão de Erros RFC 7807 (`GlobalExceptionHandler`)
A API adota o padrão formal **RFC 7807 (Problem Details for HTTP APIs)** utilizando a classe nativa `ProblemDetail` do Spring Boot para todas as respostas com código HTTP de erro (4xx e 5xx):

| Exceção Interceptada | HTTP Status | Título do Problema (`title`) | Detalhe Retornado (`detail` / campos extras) |
|---|---|---|---|
| `BadCredentialsException` | `401 UNAUTHORIZED` | `"Credenciais Inválidas"` | Mensagem de falha de autenticação do usuário. |
| `EntityNotFoundException` | `404 NOT_FOUND` | `"Recurso Não Encontrado"` | Identificação da entidade inexistente solicitada. |
| `SecurityException` | `403 FORBIDDEN` | `"Acesso Negado"` | Disparada quando um usuário tenta acessar recursos de outra fazenda/curral. |
| `IllegalStateException` | `409 CONFLICT` | `"Conflito de Regra de Negócio"` | Violações de travas biológicas, concorrência de bombas ou nomes duplicados. |
| `MethodArgumentNotValidException` | `400 BAD_REQUEST` | `"Erro de Validação"` | Mensagem genérica + dicionário `invalidParams: {campo: mensagem_de_erro}`. |
| `HttpMessageNotReadableException` | `400 BAD_REQUEST` | `"Corpo da Requisição Inválido"` | Notificação de JSON malformado ou campos com tipos incompatíveis. |
| `Exception` (Genérica) | `500 INTERNAL_SERVER_ERROR` | `"Erro Interno do Servidor"` | Mensagem padronizada protegendo detalhes de stack trace interna. |

---

### 10.2 Catálogo de Controladores e Endpoints REST

O sistema oferece **suporte a rotas duplas** para flexibilidade de consumo pelo frontend: rotas aninhadas pelo recurso pai (`/api/v1/farms/{farmId}/currais/{corralId}/...`) e rotas diretas (`/api/v1/currais/{corralId}/...` e `/api/v1/animais/{animalId}`). Ambas realizam validação multi-tenant estrita contra o `UserPrincipal` extraído do JWT.

#### A. `AuthController` (`/api/v1/auth`)
- **`POST /api/v1/auth/login` (Público):**
  - **Body (`LoginRequestDTO`):** `email` (String, NotBlank, Email), `password` (String, NotBlank).
  - **Retorno (`AuthResponseDTO` - 200 OK):** `token` (String JWT), `userId` (Long), `name` (String), `email` (String).
  - **Exceções:** `401 Unauthorized` se a senha ou e-mail forem inválidos.
- **`POST /api/v1/auth/register` (Público):**
  - **Body (`RegisterRequestDTO`):** `name` (String, 3-100 carac.), `email` (String, NotBlank, Email), `password` (String, mín. 6 carac.).
  - **Retorno (`AuthResponseDTO` - 201 Created):** Gera o cadastro do produtor rural e já emite o primeiro token JWT de 24 horas.
  - **Exceções:** `409 Conflict` caso o e-mail já esteja registrado.

#### B. `FarmController` (`/api/v1/farms`)
- **`POST /api/v1/farms` (`ROLE_USER`):**
  - **Body (`FarmRequestDTO`):** `name` (String, 2 a 100 caracteres).
  - **Retorno (`FarmResponseDTO` - 201 Created):** `id` (Long), `name` (String), `createdAt` (LocalDateTime).
  - **Exceções:** `409 Conflict` se já existir fazenda com o mesmo nome para o usuário logado.
- **`GET /api/v1/farms` (`ROLE_USER`):**
  - **Retorno (200 OK):** `List<FarmResponseDTO>` contendo todas as fazendas do usuário autenticado.
- **`PUT /api/v1/farms/{farmId}` (`ROLE_USER`):**
  - **Parâmetros:** `farmId` (Long no caminho), Body: `FarmRequestDTO`.
  - **Retorno (200 OK):** `FarmResponseDTO` com o nome atualizado.
  - **Exceções:** `404 Not Found`, `403 Forbidden` (se a fazenda pertencer a outro produtor) e `409 Conflict` (se o novo nome colidir).
- **`DELETE /api/v1/farms/{farmId}` (`ROLE_USER`):**
  - **Retorno (204 No Content):** Remove a fazenda e seus currais/animais em cascata.
  - **Exceções:** `409 Conflict` caso algum curral da fazenda esteja com lavagem ativa (`EM_ANDAMENTO`).

#### C. `CorralController` (`/api/v1`)
- **`POST /api/v1/farms/{farmId}/currais` (`ROLE_USER`):**
  - **Body (`CorralRequestDTO`):** `name` (String, 2-100 carac.), `macAddress` (String de 12 hexadecimais), `cleanTime` (LocalTime opcional), `limitOdor` (Integer opcional, def: 400), `pumpDurationSeconds` (Integer opcional, 1 a 60, def: 30).
  - **Retorno (`CorralResponseDTO` - 201 Created):** `id`, `farmId`, `name`, `macAddress` normalizado, `cleanTime`, `limitOdor`, `pumpDurationSeconds`, `deviceStatus` (ONLINE/OFFLINE), `lastSeenAt`.
  - **Exceções:** `409 Conflict` se o MAC Address já estiver cadastrado em qualquer curral do sistema.
- **`GET /api/v1/farms/{farmId}/currais` (`ROLE_USER`):**
  - **Retorno (200 OK):** `List<CorralResponseDTO>` dos currais da fazenda.
- **`GET /api/v1/currais/{corralId}` ou `/api/v1/farms/{farmId}/currais/{corralId}` (`ROLE_USER`):**
  - **Retorno (200 OK):** `CorralResponseDTO` com os dados completos do curral.
- **`PUT /api/v1/currais/{corralId}/parametros` (`ROLE_USER`):**
  - **Body (`CorralParametersRequestDTO`):** `cleanTime` (LocalTime ou null para desativar), `limitOdor` (Integer >= 0), `pumpDurationSeconds` (Integer de 1 a 60).
  - **Retorno (200 OK):** `CorralResponseDTO` atualizado.
- **`GET /api/v1/currais/{corralId}/metricas` (`ROLE_USER`):**
  - **Retorno (`CorralMetricsResponseDTO` - 200 OK):** `totalAnimaisNoCurral`, `totalAnimaisNaFazenda`, `limpezasHojeTotal`, `limpezasHojeManual`, `limpezasHojeOdor`, `limpezasHojeAutomatica`, `deviceStatus`, `lastSeenAt`, `pendenciasAbertas`.
- **`GET /api/v1/currais/{corralId}/stream` (`ROLE_USER`):**
  - **Formato:** `text/event-stream` (`SseEmitter`).
  - **Canais transmitidos:** `connected`, `status`, `presenca`, `limpeza`, `odor`, `pendencia`. Suporta token via query param `?token=...`.
- **`DELETE /api/v1/currais/{corralId}` (`ROLE_USER`):**
  - **Retorno (204 No Content):** Remove o curral. Bloqueia com `409 Conflict` se houver lavagem ativa ou pendente.

#### D. `AnimalController` (`/api/v1`)
- **`POST /api/v1/farms/{farmId}/animais` (`ROLE_USER`):**
  - **Body (`AnimalRequestDTO`):** `name` (String, 2-50 carac.), `identification` (String opcional, ex.: número de brinco), `tagUid` (String NotBlank correspondente ao RFID).
  - **Retorno (`AnimalResponseDTO` - 201 Created):** `id`, `farmId`, `name`, `identification`, `tagUid` (normalizado em maiúsculas), `currentCorralId`, `currentCorralName`.
  - **Exceções:** `409 Conflict` se a Tag UID já estiver associada a outro animal.
- **`GET /api/v1/farms/{farmId}/animais` (`ROLE_USER`):**
  - **Retorno (200 OK):** Lista de todos os animais da fazenda com indicação do curral atual.
- **`POST /api/v1/currais/{corralId}/presenca` (`ROLE_USER`):**
  - **Body (`AnimalPresenceRequestDTO`):** `tagUid` (String), `typeEvent` (`ENTROU` ou `SAIU`), `origin` (`MANUAL` ou `TAG`).
  - **Retorno (`AnimalEventResponseDTO` - 201 Created):** `id`, `corralId`, `animalId`, `animalName`, `tagUid`, `typeEvent`, `eventOrigin`, `instant`.
  - **Regra de Consistência:** Para eventos manuais, valida se o animal já está ou não no curral para impedir estados incoerentes (lançando `409 Conflict`). Dispara evento SSE `presenca`.
- **`GET /api/v1/currais/{corralId}/eventos` (`ROLE_USER`):**
  - **Retorno (200 OK):** Histórico de movimentações de presença no curral em ordem cronológica decrescente.
- **`PUT /api/v1/animais/{animalId}` e `DELETE /api/v1/animais/{animalId}`:**
  - Edição e remoção de registros de animais.

#### E. `CleanController` (`/api/v1/currais`)
- **`POST /api/v1/currais/{corralId}/limpeza` (`ROLE_USER`):**
  - **Body Opcional (`CleanCmdRequestDTO`):** `origin` (`MANUAL`, default), `secondsDuration` (Integer de 1 a 60).
  - **Retorno (`CleanCmdResponseDTO` - 200 OK):** `id` (UUID), `corralId`, `origin`, `state` (`CONCLUIDO` ou `CANCELADO`), `secondsDuration`, `createdAt`, `mensagem`.
  - **Regra:** Valida as **3 Travas de Segurança**. Se aprovado, publica ordem MQTT, aguarda confirmação síncrona de ACK de hardware (até 10 segundos) e emite evento SSE `limpeza`.
- **`POST /api/v1/currais/{corralId}/limpeza/parar` ou `/api/v1/currais/{corralId}/parar` (`ROLE_USER`):**
  - **Retorno (`CleanCmdResponseDTO` - 200 OK):** Interrompe a bomba d'água via MQTT com `duracao: 0` e `acao: "PARAR"`. Atualiza o comando ativo para `CANCELADO`.
- **`GET /api/v1/currais/{corralId}/limpezas` (`ROLE_USER`):**
  - **Retorno (200 OK):** Histórico de ciclos de lavagem realizados no curral.

#### F. `OdorController` (`/api/v1/currais`)
- **`GET /api/v1/currais/{corralId}/odor` (`ROLE_USER`):**
  - **Retorno (200 OK):** Lista das últimas 30 leituras de telemetria ambiental do curral (`OdorTelemetryResponseDTO`: `value`, `instant`, `temperature`, `humidity`) para plotagem do gráfico temporal.

#### G. `PendencyController` (`/api/v1`)
- **`GET /api/v1/currais/{corralId}/pendencias` (`ROLE_USER`):**
  - **Retorno (200 OK):** Lista de tags RFID lidas pelo ESP32 que não possuem cadastro na fazenda (`IdentifyPendencyResponseDTO`).
- **`POST /api/v1/pendencias/{pendencyId}/resolver` ou `PUT ...` (`ROLE_USER`):**
  - **Body (`ResolvePendencyRequestDTO`):** `animalId` (Long NotNull).
  - **Retorno (200 OK):** Vincula a tag ao animal selecionado, atualiza sua localização atual, gera `AnimalEvent` de auditoria e fecha a pendência (`resolved = true`).

---

### 10.3 Serviços de Negócio e Travas Fail-Fast

#### 🛡️ As Três Travas de Segurança Fail-Fast (`CleanService.java`):
Antes de disparar qualquer ciclo de lavagem (seja manual via API, agendado por cron ou autônomo por sensor de odor), o método `CleanService.executeCleanProcess` executa verificações defensivas rigorosas:

1. **Trava Biológica (Presença Animal):**
   - Consulta `animalRepository.existsByCurrentCorralId(corralId)`.
   - Se houver qualquer animal no curral, a operação é rejeitada imediatamente com `IllegalStateException`:
     > `"Tem uma vaca no curral neste momento, não tem como acionar a bomba de limpeza"` (retorna HTTP 409 Conflict).
2. **Trava de Concorrência Física:**
   - Consulta `cleanCmdRepository.existsByCorralIdAndCleanState(corralId, CleanState.EM_ANDAMENTO)`.
   - Impede acionamentos simultâneos ou duplicados com a mensagem:
     > `"A bomba já está em andamento para este curral"` (retorna HTTP 409 Conflict).
3. **Trava de Conectividade do Hardware:**
   - Verifica se o curral possui status `DeviceStatus.OFFLINE` ou se o último sinal de comunicação (`lastSeenAt`) ocorreu há mais de 60 segundos.
   - Bloqueia com a mensagem:
     > `"O dispositovo deste curral esta offline, não é possivel acionar a limpeza"` (retorna HTTP 409 Conflict).

*Nota Arquitetural Crítica:* O método `executeCleanProcess` **não é anotado com `@Transactional`**. Essa escolha de design impede que conexões JDBC do pool HikariCP fiquem retidas desnecessariamente durante os até 10 segundos de espera síncrona pelo ACK do hardware MQTT (`ackService.awaitAck`).

#### Outros Serviços Centrais:
- **`CleanSchedulerService`:** Executa rotina minuto a minuto (`@Scheduled(cron = "0 * * * * *")`). Varre currais com horário de lavagem configurado (`findByCleanTimeIsNotNull()`). Se o horário atual casar com o programado, tenta disparar a lavagem automática. Caso a trava biológica impeça a execução, captura o erro e loga aviso em WARN sem quebrar o agendamento dos demais currais.
- **`AckService`:** Coordena o ciclo de confirmação entre o backend e o microcontrolador ESP32 através de promessas assíncronas `CompletableFuture<ComandResult>` em memória (`ConcurrentHashMap`), correlacionando o UUID do comando e o endereço MAC esperado com timeout de 10.000 ms.
- **`CorralSseService`:** Gerencia as conexões abertas de Server-Sent Events via `SseEmitter(0L)`. Utiliza estruturas thread-safe `CopyOnWriteArrayList` e remove emissores automaticamente ao disparar eventos de timeout ou desconexão.

---

## 11. Documentação Técnica Detalhada do Frontend

### 11.1 Provedores de Contexto Global (`src/context/`)

1. **`AuthContext` (`AuthContext.tsx`):**
   - **Propósito:** Gerencia a autenticação do produtor rural, persistência do token JWT no `localStorage` (chave `curral_auth_token`), decodificação de claims do usuário e renovação.
   - **Resiliência:** Registra interceptor global via `setOnUnauthorized(() => logout())`, deslogando a aplicação automaticamente caso o backend retorne HTTP 401. Sincroniza login e logout entre múltiplas abas abertas pelo evento de janela `'storage'`.
2. **`FarmCorralContext` (`FarmCorralContext.tsx`):**
   - **Propósito:** Controla a seleção ativa da Fazenda e do Curral no modelo multi-tenant.
   - **Persistência Local:** Salva os IDs selecionados em `curral_selected_farm_id` e `curral_selected_corral_id`. Ao selecionar uma nova fazenda, recarrega os currais associados e seleciona automaticamente o primeiro curral disponível caso a seleção anterior fique órfã.

---

### 11.2 Catálogo Completo dos Componentes da Aplicação

#### 1. `Dashboard` (`src/pages/dashboard.tsx`)
- **Papel:** Componente mestre da página única. Orquestra a subscrição SSE, polling de reconciliação a cada 15 segundos (ou 3 segundos em caso de fallback quando o SSE está desconectado), checagem periódica da saúde do backend a cada 12 segundos e acionamento de modais.
- **Trava Biológica Ativa no Cliente:** Possui um efeito reativo que, ao receber um evento SSE de entrada de animal (`presenca`) enquanto a bomba está ligada localmente (`washingRef.current = true`), executa imediatamente a chamada `cleanService.stopCleaning` e desliga a interface com o alerta visual `'PARADA DE SEGURANÇA'`.

#### 2. `ConnectivityBanner` (`src/components/dashboard/ConnectivityBanner.tsx`)
- **Propósito:** Barra visual no topo exibindo o status de conexão com o ESP32 (`ONLINE` com último batimento ou `OFFLINE` em vermelho), identificador do MAC Address e badge de status do streaming SSE em tempo real.
- **Test IDs:** `banner-esp32`, `badge-sse-live`.

#### 3. `Header` (`src/components/dashboard/Header.tsx`)
- **Propósito:** Barra de navegação superior contendo identidade visual, nome do produtor logado, botão de login/logout, menus suspensos para alternar Fazenda e Curral ativos, e botões para cadastrar, editar ou excluir fazendas e currais.
- **Test IDs:** `select-farm`, `select-corral`, `button-logout`, `button-open-login`, `button-nova-fazenda`, `button-novo-corral`.

#### 4. `CleaningControl` (`src/components/dashboard/CleaningControl.tsx`)
- **Propósito:** Estação de comando e controle da bomba de lavagem. Exibe status da bomba, contagem regressiva em segundos, barra animada de progresso, botões de atalho rápido de duração (10s, 15s, 20s, 30s, 45s, 60s), botões "Lavar agora" e "Parar", badge visual da trava biológica e tabela expansível de histórico de lavagens.
- **Test IDs:** `status-pump`, `badge-biological-lock`, `input-wash-duration`, `btn-duration-*`, `button-lavar`, `button-parar`.

#### 5. `AnimalPresenceList` (`src/components/dashboard/AnimalPresenceList.tsx`)
- **Propósito:** Painel de detecção e rastreamento de rebanho. Mostra o status do sensor de presença ("Animal detectado" / "Curral livre"), botão para alternância manual/simulada (`switch-presence`), abas de filtro "No Curral" e "Todos", botões de entrada e saída rápida ("Entrou" e "Saiu"), e diálogo completo para cadastrar, editar e excluir animais com suas tags RFID.
- **Test IDs:** `status-presence`, `switch-presence`, `dialog-delete-animal`.

#### 6. `ParametersPanel` (`src/components/dashboard/ParametersPanel.tsx`)
- **Propósito:** Configuração operacional do curral. Permite alternar entre os modos "Manual" e "Automático", configurar o horário diário programado de lavagem (campo `input-time` no formato HH:mm), ajustar o limiar numérico de odor de amônia e estipular a duração da bomba.
- **Test IDs:** `mode-manual`, `mode-automatico`, `input-time`, `button-salvar-horario`.

#### 7. `MetricsKpiCards` (`src/components/dashboard/MetricsKpiCards.tsx`)
- **Propósito:** Grade com 3 cartões de telemetria dos sensores físicos: Temperatura (°C - DHT22), Umidade (% - DHT22) e Amônia bruta (MQ-135). Destaca o cartão em vermelho caso a concentração de amônia supere o limiar de alerta configurado. Exibe contadores de animais e limpezas realizadas no dia.
- **Test IDs:** `value-temp`, `value-hum`, `value-mq`, `button-atualizar`.

#### 8. `OdorChart` (`src/components/dashboard/OdorChart.tsx`)
- **Propósito:** Gráfico vetorial SVG responsivo que plota o histórico cronológico das últimas 30 leituras do sensor MQ-135 em relação à linha tracejada de limite crítico de odor. Exibe tooltips interativos ao passar o mouse sobre os pontos de dados.
- **Test IDs:** `chart-odor-svg`.

#### 9. `EventsTimeline` (`src/components/dashboard/EventsTimeline.tsx`)
- **Propósito:** Linha do tempo cronológica que unifica as leituras de presença dos animais (entradas e saídas registradas) e os logs operacionais do sistema com indicadores coloridos de severidade (`info`, `ok`, `warn`, `danger`).
- **Test IDs:** `list-events`.

#### 10. `PendenciesModal` e `PendenciesAlertBanner` (`src/components/dashboard/PendenciesModal.tsx`)
- **Propósito:** O banner alerta visualmente quando uma tag RFID desconhecida foi detectada no curral. O modal associado permite vincular a tag a um animal existente da fazenda ou abrir um formulário inline para cadastrar um novo animal imediatamente, encerrando a pendência.
- **Test IDs:** `button-banner-add-animal`, `form-create-animal-*`, `button-save-new-animal-*`.

#### 11. `AuthDialog` (`src/components/dashboard/AuthDialog.tsx`)
- **Propósito:** Modal de acesso para login e cadastro de novos produtores rurais com abas alternáveis, validações de campos e botão de demonstração rápida (`button-quick-demo-login`) que preenche a conta de teste padrão.
- **Test IDs:** `auth-dialog`, `button-auth-tab-login`, `button-auth-tab-register`, `button-auth-submit`.

#### 12. `FarmModal` e `CorralModal` (`FarmModal.tsx` e `CorralModal.tsx`)
- **Propósito:** Modais para criação e edição de Fazendas e Currais. O `CorralModal` possui máscara e validação rigorosa de 12 caracteres hexadecimais para o MAC Address do ESP32 com atalho de preenchimento para simulação no Wokwi (`240AC4000110`).
- **Test IDs:** `input-farm-name`, `button-farm-submit`, `input-corral-name`, `input-corral-mac`, `button-corral-submit`.

#### 13. `ConfirmDeleteDialog` (`ConfirmDeleteDialog.tsx`)
- **Propósito:** Diálogo modal genérico reutilizável para confirmação segura de operações de exclusão de fazendas, currais e animais.
- **Test IDs:** `dialog-confirm-delete`, `button-cancel-delete`, `button-confirm-delete`.

---

## 12. Suítes de Testes Automatizados e Comandos de Verificação

Ambos os subprojetos possuem amplas suítes de testes automatizados com cobertura de casos positivos, casos de borda e cenários adversariais.

### 12.1 Testes do Backend (Java / Spring Boot)
O backend dispõe de **25 arquivos de teste e suporte**, totalizando **345 casos de teste automatizados**:
- **340 testes unitários e de fatiamento WebMvc:** Utilizam JUnit 5, Mockito e MockMvc. Executam de forma totalmente isolada em menos de 10 segundos, sem requerer o banco de dados ativo.
- **5 testes de integração real:** (`CommandRfidLeituraRealDbTest` e `A3ApplicationTests`) requerem o container do PostgreSQL em execução para conexão JDBC na porta 5432.

#### Comandos de Execução do Backend:
```bash
# 1. Compilação e verificação estática de tipos
cd backend && ./mvnw test-compile

# 2. Execução de toda a suíte de testes (com o banco PostgreSQL ativo)
docker compose -f backend/compose.yaml up -d postgres
cd backend && ./mvnw test
```

### 12.2 Testes do Frontend (React / Vitest)
O frontend conta com **27 arquivos de teste**, com **328 testes unitários e de integração aprovados** executados sob o ambiente `jsdom`:

```bash
# 1. Executar a suíte de testes unitários e de componentes
cd frontend && npm test

# 2. Executar checagem estática estrita de tipos TypeScript (tsc --noEmit)
cd frontend && npm run typecheck

# 3. Compilar o build de produção (gera pasta dist/)
cd frontend && npm run build
```

---

## 13. Exemplos Práticos de Uso e Fluxos Operacionais

### Fluxo 1: Onboarding e Configuração Inicial
1. Acesse `http://localhost:5173`. O modal de login será aberto se não houver sessão ativa.
2. Crie uma conta na aba "Cadastrar" ou clique no atalho "Preencher" e faça login.
3. No cabeçalho, clique em `+ Nova Fazenda`, informe o nome (ex.: `"Fazenda Modelo"`) e salve.
4. Clique em `+ Novo Curral`. Defina o nome (ex.: `"Curral 01"`), insira o MAC do ESP32 (`240AC4000110`), limite de odor (`400`) e duração da bomba (`30s`). Salve.

### Fluxo 2: Cadastro de Animais e Movimentação
1. No painel **Presença no Curral**, clique no botão `+ Novo Animal`.
2. Insira o nome (ex.: `"Mimosa"`), número do brinco (`"BR-101"`) e o UID da tag RFID (`"E2801160"`).
3. Na lista, clique em **Entrou**. O status do curral mudará para `"Animal detectado"` e o badge visual da Trava Biológica ficará ativo.

### Fluxo 3: Testando a Trava Biológica de Segurança
1. Com a vaca `"Mimosa"` no curral, tente clicar em **Lavar agora** na estação de limpeza.
2. A interface bloqueará imediatamente o acionamento exibindo a mensagem: `"Não é possível lavar: existe um animal no curral"`.
3. Mesmo se uma requisição direta for disparada para a API backend via `curl` ou Postman, o Spring Boot rejeitará a operação com código HTTP `409 Conflict` e a mensagem:
   ```json
   {
     "type": "about:blank",
     "title": "Conflito de Regra de Negócio",
     "status": 409,
     "detail": "Tem uma vaca no curral neste momento, não tem como acionar a bomba de limpeza",
     "instance": "/api/v1/currais/1/limpeza"
   }
   ```
4. Na lista de animais, clique em **Saiu**. O curral volta ao status `"Curral livre"`.
5. Agora clique em **Lavar agora**: a bomba será acionada com contagem regressiva em tempo real e barra de progresso.
