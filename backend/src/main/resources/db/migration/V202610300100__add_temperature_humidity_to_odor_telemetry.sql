-- Adiciona colunas para telemetria de temperatura e umidade do sensor DHT
ALTER TABLE odor_telemetry ADD COLUMN IF NOT EXISTS temperature DOUBLE PRECISION NULL;
ALTER TABLE odor_telemetry ADD COLUMN IF NOT EXISTS humidity DOUBLE PRECISION NULL;
