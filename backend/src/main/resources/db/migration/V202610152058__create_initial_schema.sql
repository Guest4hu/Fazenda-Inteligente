-- ============================================================================
-- V1__create_initial_schema.sql
-- Esquema inicial: Fazenda Inteligente (PostgreSQL)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. CADASTROS E ESTADO ATUAL (USERS -> FAZENDAS -> CURRAIS -> ANIMAIS)
-- ----------------------------------------------------------------------------

CREATE TABLE users (
                       id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                       nome VARCHAR(100) NOT NULL,
                       email VARCHAR(150) NOT NULL UNIQUE,
                       senha_hash VARCHAR(255) NOT NULL,
                       criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE fazendas (
                          id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                          usuario_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                          nome VARCHAR(100) NOT NULL,
                          criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fazendas_usuario_id ON fazendas(usuario_id);

CREATE TABLE currais (
                         id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                         fazenda_id BIGINT NOT NULL REFERENCES fazendas(id) ON DELETE CASCADE,
                         nome VARCHAR(100) NOT NULL,
                         mac_address VARCHAR(12) NOT NULL UNIQUE,
                         horario_limpeza TIME NULL,
                         limiar_odor INTEGER NOT NULL DEFAULT 400,
                         duracao_bomba_segundos INTEGER NOT NULL DEFAULT 30,
                         CONSTRAINT chk_currais_mac_address CHECK (mac_address ~ '^[0-9A-F]{12}$'),
    CONSTRAINT chk_currais_duracao_bomba CHECK (duracao_bomba_segundos > 0)
);

CREATE INDEX idx_currais_fazenda_id ON currais(fazenda_id);

CREATE TABLE animais (
                         id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                         fazenda_id BIGINT NOT NULL REFERENCES fazendas(id) ON DELETE CASCADE,
                         nome VARCHAR(50) NOT NULL,
                         identificacao VARCHAR(30) NULL,
                         tag_uid VARCHAR(32) NOT NULL UNIQUE,
                         curral_atual_id BIGINT NULL REFERENCES currais(id) ON DELETE SET NULL
);

CREATE INDEX idx_animais_fazenda_id ON animais(fazenda_id);
CREATE INDEX idx_animais_curral_atual ON animais(curral_atual_id);

-- ----------------------------------------------------------------------------
-- 2. OPERAÇÕES, TELEMETRIA E CICLO DE VIDA (IoT)
-- ----------------------------------------------------------------------------

CREATE TABLE eventos_presenca (
                                  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                                  curral_id BIGINT NOT NULL REFERENCES currais(id) ON DELETE CASCADE,
                                  animal_id BIGINT NOT NULL REFERENCES animais(id) ON DELETE CASCADE,
                                  tipo_evento VARCHAR(10) NOT NULL,
                                  origem VARCHAR(10) NOT NULL DEFAULT 'TAG',
                                  instante TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                                  CONSTRAINT chk_eventos_presenca_tipo CHECK (tipo_evento IN ('ENTROU', 'SAIU')),
                                  CONSTRAINT chk_eventos_presenca_origem CHECK (origem IN ('TAG', 'MANUAL'))
);

CREATE INDEX idx_eventos_presenca_curral ON eventos_presenca(curral_id, instante DESC);
CREATE INDEX idx_eventos_presenca_animal ON eventos_presenca(animal_id, instante DESC);

CREATE TABLE leituras_odor (
                               id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                               curral_id BIGINT NOT NULL REFERENCES currais(id) ON DELETE CASCADE,
                               valor INTEGER NOT NULL,
                               instante TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_leituras_odor_curral_instante ON leituras_odor(curral_id, instante DESC);

CREATE TABLE comandos_limpeza (
                                  id UUID PRIMARY KEY,
                                  curral_id BIGINT NOT NULL REFERENCES currais(id) ON DELETE CASCADE,
                                  origem VARCHAR(20) NOT NULL,
                                  estado VARCHAR(25) NOT NULL,
                                  duracao_segundos INTEGER NOT NULL,
                                  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                                  enviado_em TIMESTAMPTZ NULL,
                                  confirmado_em TIMESTAMPTZ NULL,
                                  CONSTRAINT chk_comandos_limpeza_origem CHECK (origem IN ('AUTOMATICA', 'MANUAL', 'EVENTO')),
                                  CONSTRAINT chk_comandos_limpeza_estado CHECK (estado IN (
                                                                                           'AGUARDANDO_CONFIRMACAO',
                                                                                           'PENDENTE_ENVIO',
                                                                                           'ENVIADO',
                                                                                           'CONFIRMADO',
                                                                                           'TIMEOUT',
                                                                                           'CANCELADO'
                                      )),
                                  CONSTRAINT chk_comandos_limpeza_duracao CHECK (duracao_segundos > 0)
);

CREATE INDEX idx_comandos_limpeza_curral_estado ON comandos_limpeza(curral_id, estado);

-- Garante que não existe mais do que um comando ativo em simultâneo no mesmo curral
CREATE UNIQUE INDEX uq_comandos_limpeza_ativo_por_curral
    ON comandos_limpeza(curral_id)
    WHERE estado IN ('AGUARDANDO_CONFIRMACAO', 'PENDENTE_ENVIO', 'ENVIADO');

CREATE TABLE pendencias_identificacao (
                                          id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                                          curral_id BIGINT NOT NULL REFERENCES currais(id) ON DELETE CASCADE,
                                          tag_uid VARCHAR(32) NULL,
                                          tipo_evento VARCHAR(10) NOT NULL DEFAULT 'SAIU',
                                          instante TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                                          resolvida BOOLEAN NOT NULL DEFAULT FALSE,
                                          animal_id_resolvido BIGINT NULL REFERENCES animais(id) ON DELETE SET NULL,
                                          resolvido_em TIMESTAMPTZ NULL,
                                          CONSTRAINT chk_pendencias_tipo_evento CHECK (tipo_evento IN ('ENTROU', 'SAIU'))
);

CREATE INDEX idx_pendencias_abertas_curral
    ON pendencias_identificacao(curral_id, instante DESC)
    WHERE resolvida = FALSE;