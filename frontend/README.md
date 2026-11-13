# Dashboard do Produtor Rural — Frontend SPA (USJT_A3)

Interface web moderna, responsiva e em tempo real para monitoramento, controle de higienização e gestão pecuária do **Sistema de Curral Inteligente**.

---

## Sumário

1. [Visão Geral e Arquitetura](#1-visão-geral-e-arquitetura)
2. [Esclarecimento Arquitetural: React SPA vs Next.js](#2-esclarecimento-arquitetural-react-spa-vs-nextjs)
3. [Pré-requisitos e Versões Suportadas](#3-pré-requisitos-e-versões-suportadas)
4. [Instalação e Scripts Disponíveis](#4-instalação-e-scripts-disponíveis)
5. [Configurações, Variáveis de Ambiente e Proxy](#5-configurações-variáveis-de-ambiente-e-proxy)
6. [Estrutura Interna de Diretórios](#6-estrutura-interna-de-diretórios)
7. [Gerenciamento de Estado Global (Contextos)](#7-gerenciamento-de-estado-global-contextos)
8. [Catálogo Completo dos Componentes da Interface](#8-catálogo-completo-dos-componentes-da-interface)
9. [Cliente HTTP, Streaming SSE e Serviços de Domínio](#9-cliente-http-streaming-sse-e-serviços-de-domínio)
10. [Suíte de Testes Automatizados (Vitest)](#10-suíte-de-testes-automatizados-vitest)

---

## 1. Visão Geral e Arquitetura

O frontend do **Curral Inteligente** foi projetado para oferecer ao produtor rural uma experiência operacional ágil e com baixa latência, permitindo:
- Visualização instantânea de indicadores climáticos e gases tóxicos (amônia via sensor MQ-135, temperatura e umidade via DHT22).
- Supervisão e acionamento manual ou agendado da bomba d'água com travas biológicas client-side e feedback visual em contagem regressiva.
- Gestão de rebanho com rastreamento de animais em currais através de RFID e alertas em tempo real para tags desconhecidas.
- Streaming reativo contínuo via Server-Sent Events (SSE) com reconexão automática resiliente e mecanismo de reconciliação periódica.

### Stack Tecnológico:
- **Framework Base:** React 19.1.0
- **Ferramenta de Build & Dev Server:** Vite 7.3.2
- **Linguagem e Tipagem:** TypeScript 5.9.3 (configurado com `strict: true`)
- **Estilização e Design System:** Tailwind CSS v4 (`@tailwindcss/vite` e `@import 'tailwindcss'`)
- **Ícones Vetoriais:** Lucide React (`lucide-react: ^0.545.0`)
- **Framework de Testes:** Vitest 3.2.7 com Testing Library (`@testing-library/react` e `@testing-library/jest-dom`)

---

## 2. Esclarecimento Arquitetural: React SPA vs Next.js

> **⚠️ Constatação Crítica de Fidelidade ao Código:**
> Embora o briefing preliminar mencionasse *React/Next.js*, o código-fonte deste subprojeto confirma que **a aplicação NÃO utiliza Next.js**.
>
> Trata-se de uma **Single-Page Application (SPA)** clássica, executada integralmente no cliente (`Client-Side Rendering - CSR`):
> - Não há dependência do pacote `next` no `package.json`.
> - Não existem arquivos de configuração `next.config.js` ou diretórios `app/` / `pages/` com convenções do Next.js Router.
> - O arquivo `src/pages/dashboard.tsx` é um componente React padrão montado diretamente no DOM via `createRoot` em `src/main.tsx`.
> - A comunicação com o backend em desenvolvimento é viabilizada pelo proxy embutido do Vite, eliminando complexidades de SSR ou headers CORS no servidor.

---

## 3. Pré-requisitos e Versões Suportadas

- **Node.js:** Versão **`20.19+`** ou **`22.12+`** (exigência formal de engine do Vite 7).
- **Gerenciador de Pacotes:** **`npm`** (confirmado pelo arquivo de trava `package-lock.json`).

---

## 4. Instalação e Scripts Disponíveis

### Instalação das Dependências:
```bash
cd frontend
npm install
```

### Scripts do `package.json`:

| Comando | Descrição Operacional |
|---|---|
| `npm run dev` | Inicia o servidor Vite na porta `5173` em `0.0.0.0` com Fast Refresh e proxy `/api` ativo. |
| `npm run build` | Executa a compilação de produção e gera o bundle otimizado na pasta `dist/`. |
| `npm run preview` | Executa servidor local para inspecionar os arquivos gerados em `dist/`. |
| `npm test` | Roda a suíte completa de testes unitários e de componentes uma única vez via **Vitest**. |
| `npm run test:watch` | Executa os testes no modo interativo de observação contínua de alterações de código. |
| `npm run typecheck` | Executa a verificação estática estrita de tipos TypeScript via `tsc --noEmit`. |

---

## 5. Configurações, Variáveis de Ambiente e Proxy

### 5.1 Proxy Reverso de Desenvolvimento (`vite.config.ts`)
Para permitir que o frontend em `http://localhost:5173` se comunique perfeitamente com o backend em `http://localhost:8080` sem exigir cabeçalhos CORS no Spring Boot, o Vite atua como proxy reverso:

```typescript
// vite.config.ts
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
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/setup.ts',
  },
})
```

### 5.2 Variáveis de Ambiente Suportadas:
- **`VITE_API_BASE_URL` (Opcional):**
  - Lida por `import.meta.env.VITE_API_BASE_URL` no serviço `src/services/apiClient.ts`.
  - Caso omitida, o cliente utiliza automaticamente o caminho relativo padrão **`'/api/v1'`**, garantindo que todas as requisições passem pelo proxy do Vite.

---

## 6. Estrutura Interna de Diretórios

```
frontend/
├── index.html                     # Arquivo HTML principal contendo <div id="root">
├── package.json                   # Dependências e scripts npm
├── package-lock.json              # Lockfile com hashes e versões fixadas das dependências
├── tsconfig.json                  # Configurações do TypeScript (target: ES2022, strict: true)
├── vite.config.ts                 # Configuração do Vite, Tailwind v4, proxy e Vitest
│
├── src/
│   ├── main.tsx                   # Ponto de entrada React (createRoot, AuthProvider, FarmCorralProvider)
│   ├── index.css                  # Estilos globais Tailwind v4, paleta HSL e animações (@theme inline)
│   ├── pages/
│   │   └── dashboard.tsx          # Componente mestre da tela do Dashboard
│   ├── components/dashboard/      # Componentes modulares de interface
│   │   ├── AnimalPresenceList.tsx # Painel de presença e cadastro de animais com RFID
│   │   ├── AuthDialog.tsx         # Modal de autenticação (Login / Registro / Demonstração)
│   │   ├── CleaningControl.tsx    # Estação de comando da bomba d'água e contagem regressiva
│   │   ├── ConfirmDeleteDialog.tsx# Modal genérico de confirmação para exclusões
│   │   ├── ConnectivityBanner.tsx # Barra de status do ESP32 e badge de streaming SSE
│   │   ├── CorralModal.tsx        # Modal para criação e edição de currais (com máscara de MAC)
│   │   ├── EventsTimeline.tsx     # Linha do tempo de movimentações animais e logs de sistema
│   │   ├── FarmModal.tsx          # Modal para criação e renomeação de fazendas
│   │   ├── Header.tsx             # Barra superior com seleção multi-tenant de fazenda/curral
│   │   ├── MetricsKpiCards.tsx    # Cartões de telemetria dos sensores físicos (DHT22 e MQ-135)
│   │   ├── OdorChart.tsx          # Gráfico vetorial SVG das últimas 30 leituras de odor
│   │   ├── ParametersPanel.tsx    # Painel de modos (Manual/Auto), horários e limiares
│   │   └── PendenciesModal.tsx    # Banner e modal de resolução de tags RFID desconhecidas
│   ├── context/
│   │   ├── AuthContext.tsx        # Contexto de autenticação, JWT e interceptor 401
│   │   └── FarmCorralContext.tsx  # Contexto de seleção hierárquica (Fazendas e Currais)
│   ├── services/
│   │   ├── apiClient.ts           # Cliente HTTP sobre fetch nativo com suporte a RFC 7807
│   │   ├── sseService.ts          # Gerenciamento de conexões EventSource e eventos SSE
│   │   ├── macUtils.ts            # Sanitização e validação de endereços MAC (12 hex chars)
│   │   ├── authService.ts         # Login, registro e decodificação do usuário
│   │   ├── farmService.ts         # CRUD de propriedades rurais
│   │   ├── corralService.ts       # CRUD de currais, parâmetros e métricas
│   │   ├── animalService.ts       # CRUD de animais e registro de presença
│   │   ├── cleanService.ts        # Disparo e cancelamento de ordens de lavagem
│   │   ├── odorService.ts         # Consulta de telemetria de gases
│   │   └── pendencyService.ts     # Consulta e resolução de pendências de RFID
│   └── types/
│       └── api.ts                 # Interfaces TypeScript estritas espelhando a API do backend
│
└── tests/                         # Suíte completa de testes automatizados com Vitest
    ├── setup.ts                   # Mocks globais de ResizeObserver, matchMedia e MockEventSource
    ├── components/                # 15 arquivos de testes de renderização e comportamento de UI
    ├── services/                  # 12 arquivos de testes unitários de clientes HTTP, SSE e DTOs
    └── e2e/                       # Testes de integração ponta a ponta contra backend real
```

---

## 7. Gerenciamento de Estado Global (Contextos)

### 7.1 `AuthContext` (`src/context/AuthContext.tsx`)
- **Responsabilidades:**
  - Armazena e persiste o token JWT no `localStorage` (chaves primárias `curral_auth_token` e `curral_auth_user`).
  - Decodifica dados do usuário autenticado (`id`, `name`, `email`).
  - Registra um interceptor global para respostas `HTTP 401 Unauthorized` através de `setOnUnauthorized(() => logout())`, deslogando a sessão automaticamente caso o token expire no servidor.
  - Sincroniza o estado de login e logout entre abas distintas do navegador via escuta do evento `'storage'`.

### 7.2 `FarmCorralContext` (`src/context/FarmCorralContext.tsx`)
- **Responsabilidades:**
  - Gerencia o estado de navegação multi-tenant do produtor (Fazendas e Currais).
  - Mantém a última fazenda selecionada (`curral_selected_farm_id`) e curral selecionado (`curral_selected_corral_id`) no `localStorage`.
  - Ao alternar a fazenda no seletor, dispara a carga dos currais daquela propriedade e, caso o curral previamente ativo não pertença à nova fazenda, seleciona automaticamente o primeiro curral disponível.

---

## 8. Catálogo Completo dos Componentes da Interface

### 8.1 `Dashboard` (`src/pages/dashboard.tsx`)
- **Propósito:** Componente mestre integrador da Single Page Application.
- **Orquestração e Efeitos:**
  - Conecta-se ao stream SSE via `subscribeToCorralStream` ao selecionar um curral ativo.
  - Executa polling de sincronização a cada 15 segundos quando o SSE está conectado (ou polling acelerado de 3 segundos em caso de fallback/desconexão).
  - Executa verificação periódica de saúde da API a cada 12 segundos via `checkBackendHealth()`.
  - **Trava Biológica Ativa em Tempo Real:** Se o stream SSE emitir um evento `presenca` informando que um animal entrou no curral enquanto a bomba d'água está ligada, o Dashboard desliga a bomba imediatamente chamando `cleanService.stopCleaning` e exibindo o alerta `'PARADA DE SEGURANÇA'`.

### 8.2 `ConnectivityBanner` (`src/components/dashboard/ConnectivityBanner.tsx`)
- **Props:** `deviceStatus?: DeviceStatus | null`, `lastSeenAt?: string | null`, `macAddress?: string | null`, `corralName?: string | null`, `isSimulated?: boolean`, `isLive?: boolean`, `isSseConnected?: boolean`.
- **Propósito:** Apresenta o status operacional do hardware ESP32 do curral (`ONLINE` em verde ou `OFFLINE` em vermelho), data do último batimento e badge pulsante indicando recepção ativa de eventos SSE.
- **Test IDs:** `banner-esp32`, `badge-sse-live`.

### 8.3 `Header` (`src/components/dashboard/Header.tsx`)
- **Props:** Recebe estados de usuário, fazendas, currais, conexões e callbacks de seleção e abertura de modais.
- **Propósito:** Barra superior de navegação com perfil do usuário logado, botão de logout, menus seletores suspensos com atalhos de criação, edição e exclusão de fazendas e currais.
- **Test IDs:** `select-farm`, `select-corral`, `button-logout`, `button-open-login`, `button-nova-fazenda`, `button-editar-fazenda`, `button-excluir-fazenda`, `button-novo-corral`, `button-editar-corral`, `button-excluir-corral`.

### 8.4 `CleaningControl` (`src/components/dashboard/CleaningControl.tsx`)
- **Props:** `corralId?: number | null`, `pumpDurationSeconds?: number`, `hasAnimalInCorral?: boolean`, `deviceStatus?: DeviceStatus | null`, `cleanHistory?: CleanCmdResponseDTO[]`, etc.
- **Propósito:** Estação de controle da bomba d'água. Oferece contagem regressiva animada, barra de progresso visual, atalhos de tempo configuráveis (10s a 60s), botões de acionamento ("Lavar agora") e cancelamento ("Parar"), badge visual da trava biológica e histórico detalhado das últimas ordens de lavagem.
- **Test IDs:** `status-pump`, `badge-biological-lock`, `input-wash-duration`, `btn-duration-*`, `button-lavar`, `button-parar`.

### 8.5 `AnimalPresenceList` (`src/components/dashboard/AnimalPresenceList.tsx`)
- **Props:** `animals?: AnimalResponseDTO[]`, `corralId?: number | null`, `washing?: boolean`, etc.
- **Propósito:** Monitoramento e triagem de animais. Apresenta o indicador do sensor de presença ("Animal detectado" / "Curral livre"), abas para filtrar animais no curral ou em toda a fazenda, botões rápidos para registrar movimentação manual ("Entrou" e "Saiu"), e interface para cadastrar, editar ou excluir animais e tags RFID.
- **Test IDs:** `status-presence`, `switch-presence`, `dialog-delete-animal`.

### 8.6 `ParametersPanel` (`src/components/dashboard/ParametersPanel.tsx`)
- **Props:** `corralId?: number | null`, `corral?: CorralResponseDTO | null`, `mode?: Mode`, etc.
- **Propósito:** Painel de parâmetros do curral. Permite alternar entre os modos "Manual" e "Automático", configurar o horário diário de lavagem (formato HH:mm), definir o limiar crítico de odor (MQ-135) e ajustar a duração padrão da bomba.
- **Test IDs:** `mode-manual`, `mode-automatico`, `input-time`, `button-salvar-horario`.

### 8.7 `MetricsKpiCards` (`src/components/dashboard/MetricsKpiCards.tsx`)
- **Props:** `sensors?: { temp: number; hum: number; mq: number }`, `metrics?: CorralMetricsResponseDTO | null`, `limitOdor?: number`, etc.
- **Propósito:** Exibe cartões de telemetria climática (Temperatura em °C, Umidade em %, Amônia bruta em ppm com destaque em vermelho ao exceder o limite) e estatísticas consolidadas (animais no curral e limpezas realizadas hoje).
- **Test IDs:** `value-temp`, `value-hum`, `value-mq`, `button-atualizar`.

### 8.8 `OdorChart` (`src/components/dashboard/OdorChart.tsx`)
- **Props:** `readings?: OdorTelemetryResponseDTO[]`, `limitOdor?: number`, `isLoading?: boolean`.
- **Propósito:** Renderiza gráfico vetorial SVG interativo com as últimas 30 medições cronológicas do sensor MQ-135, plotando a linha tracejada do limite de segurança e tooltips flutuantes com horário e valor ao passar o mouse.
- **Test IDs:** `chart-odor-svg`.

### 8.9 `EventsTimeline` (`src/components/dashboard/EventsTimeline.tsx`)
- **Props:** `liveEvents?: AnimalEventResponseDTO[]`, `systemLogs?: SystemLog[]`.
- **Propósito:** Linha do tempo unificada com ícones coloridos exibindo movimentações físicas de animais e logs de sistema em ordem cronológica decrescente.
- **Test IDs:** `list-events`.

### 8.10 `PendenciesModal` e `PendenciesAlertBanner` (`src/components/dashboard/PendenciesModal.tsx`)
- **Props:** `isOpen: boolean`, `pendencies: IdentifyPendencyResponseDTO[]`, `farmAnimals: AnimalResponseDTO[]`, etc.
- **Propósito:** O banner alerta visualmente quando o leitor RFID detecta uma tag não cadastrada. O modal permite associar a tag a um animal existente da fazenda ou abrir formulário inline para cadastrar um novo animal imediatamente.
- **Test IDs:** `button-banner-add-animal`, `form-create-animal-*`, `button-save-new-animal-*`.

### 8.11 `AuthDialog` (`src/components/dashboard/AuthDialog.tsx`)
- **Props:** `isOpen: boolean`, `initialMode?: 'login' | 'register'`, `onClose: () => void`, etc.
- **Propósito:** Janela modal para login e cadastro de novos produtores rurais, validação de campos em tempo real e botão de atalho para preenchimento de teste rápido (`produtor@fazenda.com`).
- **Test IDs:** `auth-dialog`, `button-auth-tab-login`, `button-auth-tab-register`, `button-auth-submit`, `button-quick-demo-login`.

### 8.12 `FarmModal`, `CorralModal` e `ConfirmDeleteDialog`
- **`FarmModal`:** Cadastro e edição de fazendas (`input-farm-name`, `button-farm-submit`).
- **`CorralModal`:** Cadastro e edição de currais com máscara estrita de 12 dígitos hexadecimais para o MAC Address (`input-corral-mac`) e botão de atalho para simulação no Wokwi (`240AC4000110`).
- **`ConfirmDeleteDialog`:** Diálogo de confirmação de exclusão irreversível com proteção contra ações acidentais e mensagens de erro RFC 7807 (`dialog-confirm-delete`).

---

## 9. Cliente HTTP, Streaming SSE e Serviços de Domínio

### 9.1 `apiClient.ts`
- Implementa chamadas HTTP tipadas sobre o `fetch` nativo.
- Injeta automaticamente o token JWT no cabeçalho `Authorization: Bearer <token>` em todas as requisições autenticadas.
- Trata respostas com código de erro transformando-as em instâncias da classe `ApiError`, extraindo campos do padrão **RFC 7807** (`status`, `title`, `detail`, `invalidParams`).
- Fornece função utilitária `checkBackendHealth()` que valida a conectividade da API.

### 9.2 `sseService.ts`
- Implementa a subscrição reativa aos canais de Server-Sent Events através de `subscribeToCorralStream`.
- Monta a URL incluindo o token JWT no query parameter (`?token=...`) para viabilizar autenticação no `EventSource` nativo do navegador.
- Suporta múltiplos canais: `connected`, `odor`, `presenca`, `pendencia`, `limpeza` e `status`.
- Implementa **reconexão automática com backoff exponencial** (até 10 tentativas com retardo progressivo de 1s a 30s).

### 9.3 `macUtils.ts`
- Função `sanitizeMacAddress(mac: string): string`: remove caracteres não-hexadecimais (dois-pontos, hífens, espaços), converte para maiúsculas e valida se o resultado possui exatamente 12 caracteres (`^[0-9A-F]{12}$`).

---

## 10. Suíte de Testes Automatizados (Vitest)

O subprojeto conta com uma ampla suíte de testes com **27 arquivos de teste**, totalizando **328 testes unitários e de componentes aprovados**, executados em aproximadamente 5 segundos.

### Execução dos Testes:
```bash
# Executa todos os testes unitários e de componentes
npm test

# Executa checagem de tipos estritos sem emitir arquivos
npm run typecheck
```

### Principais Áreas Cobertas pelos Testes:
1. **Serviços (`tests/services/`):** Testes unitários do cliente HTTP, injeção de Bearer tokens, interceptor 401, tratamento de erros RFC 7807, sanitização de MAC Address, subscrição SSE e reconexão exponencial.
2. **Componentes (`tests/components/`):** Testes de renderização e interação do Dashboard, trava biológica na bomba d'água (`CleaningControl`), resolução de pendências com cadastro de novo animal (`PendencyCreateAnimal`), validações de formulário no `AuthDialog`, alternância de modos no `ParametersPanel` e gráfico SVG de odor.
3. **Desafios Adversariais:** Cenários de estresse simulando cliques ultrarrápidos, respostas anômalas da rede e violações de contratos de dados (`m3Challenger2StressHarness.test.tsx`, `cleaningTelemetryChallenge.test.tsx`).
