-- Permite duracao zero (seconds_duration >= 0) para registrar comandos de parada imediata (STOP)
ALTER TABLE clean_cmd DROP CONSTRAINT IF EXISTS chk_clean_cmd_duration;
ALTER TABLE clean_cmd ADD CONSTRAINT chk_clean_cmd_duration CHECK (seconds_duration >= 0);
