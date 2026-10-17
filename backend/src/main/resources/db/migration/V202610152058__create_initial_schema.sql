-- ============================================================================
-- V1__create_initial_schema.sql
-- Esquema inicial: Fazenda Inteligente (PostgreSQL)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. CADASTROS E ESTADO ATUAL (USERS -> FARMS -> CORRALS -> ANIMALS)
-- ----------------------------------------------------------------------------

CREATE TABLE users (
                       id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                       name VARCHAR(100) NOT NULL,
                       email VARCHAR(150) NOT NULL UNIQUE,
                       password_hash VARCHAR(255) NOT NULL,
                       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE farms (
                       id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                       user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                       name VARCHAR(100) NOT NULL,
                       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_farms_user_id ON farms(user_id);

CREATE TABLE corral (
                        id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                        farm_id BIGINT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
                        name VARCHAR(100) NOT NULL,
                        mac_address VARCHAR(12) NOT NULL UNIQUE,
                        clean_time TIME NULL,
                        limit_odor INTEGER NOT NULL DEFAULT 400,
                        pump_duration_seconds INTEGER NOT NULL DEFAULT 30,
                        CONSTRAINT chk_corral_mac_address CHECK (mac_address ~ '^[0-9A-F]{12}$'),
                        CONSTRAINT chk_corral_pump_duration CHECK (pump_duration_seconds > 0)
);

CREATE INDEX idx_corral_farm_id ON corral(farm_id);

CREATE TABLE animals (
                         id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                         farm_id BIGINT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
                         name VARCHAR(50) NOT NULL,
                         identification VARCHAR(30) NULL,
                         tag_uid VARCHAR(32) NOT NULL UNIQUE,
                         current_corral_id BIGINT NULL REFERENCES corral(id) ON DELETE SET NULL
);

CREATE INDEX idx_animals_farm_id ON animals(farm_id);
CREATE INDEX idx_animals_current_corral ON animals(current_corral_id);

-- ----------------------------------------------------------------------------
-- 2. OPERAÇÕES, TELEMETRIA E CICLO DE VIDA (IoT)
-- ----------------------------------------------------------------------------

CREATE TABLE animal_event (
                              id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                              corral_id BIGINT NOT NULL REFERENCES corral(id) ON DELETE CASCADE,
                              animal_id BIGINT NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
                              type_event VARCHAR(10) NOT NULL,
                              origin VARCHAR(10) NOT NULL DEFAULT 'TAG',
                              instant TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                              CONSTRAINT chk_animal_event_type CHECK (type_event IN ('ENTROU', 'SAIU')),
                              CONSTRAINT chk_animal_event_origin CHECK (origin IN ('TAG', 'MANUAL'))
);

CREATE INDEX idx_animal_event_corral ON animal_event(corral_id, instant DESC);
CREATE INDEX idx_animal_event_animal ON animal_event(animal_id, instant DESC);

CREATE TABLE odor_telemetry (
                                id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                                corral_id BIGINT NOT NULL REFERENCES corral(id) ON DELETE CASCADE,
                                value INTEGER NOT NULL,
                                instant TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_odor_telemetry_corral_instant ON odor_telemetry(corral_id, instant DESC);

CREATE TABLE clean_cmd (
                           id UUID PRIMARY KEY,
                           corral_id BIGINT NOT NULL REFERENCES corral(id) ON DELETE CASCADE,
                           origin VARCHAR(20) NOT NULL,
                           state VARCHAR(25) NOT NULL,
                           seconds_duration INTEGER NOT NULL,
                           created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                           sent_at TIMESTAMPTZ NULL,
                           confirmed_at TIMESTAMPTZ NULL,
                           CONSTRAINT chk_clean_cmd_origin CHECK (origin IN ('AUTOMATICA', 'MANUAL', 'EVENTO')),
                           CONSTRAINT chk_clean_cmd_state CHECK (state IN (
                                                                           'PENDENTE',
                                                                           'EM_ANDAMENTO',
                                                                           'CONCLUIDO',
                                                                           'CANCELADO'
                               )),
                           CONSTRAINT chk_clean_cmd_duration CHECK (seconds_duration > 0)
);

CREATE INDEX idx_clean_cmd_corral_state ON clean_cmd(corral_id, state);

-- Garante que não existe mais do que um comando ativo em simultâneo no mesmo curral
CREATE UNIQUE INDEX uq_clean_cmd_active_per_corral
    ON clean_cmd(corral_id)
    WHERE state IN ('PENDENTE', 'EM_ANDAMENTO');

CREATE TABLE identify_pendency (
                                   id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                                   corral_id BIGINT NOT NULL REFERENCES corral(id) ON DELETE CASCADE,
                                   tag_uid VARCHAR(32) NULL,
                                   type_event VARCHAR(10) NOT NULL DEFAULT 'SAIU',
                                   instant TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                                   resolved BOOLEAN NOT NULL DEFAULT FALSE,
                                   animal_id_resolved BIGINT NULL REFERENCES animals(id) ON DELETE SET NULL,
                                   resolved_at TIMESTAMPTZ NULL,
                                   CONSTRAINT chk_identify_pendency_type_event CHECK (type_event IN ('ENTROU', 'SAIU'))
);

CREATE INDEX idx_identify_pendency_open_corral
    ON identify_pendency(corral_id, instant DESC)
    WHERE resolved = FALSE;