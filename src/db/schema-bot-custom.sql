-- ═══════════════════════════════════════════════════════════════
--  VÉRSOVA · esquema v6 — personalización de menú por bot
--  · menu_style por sub-bot
--  · custom_config JSON con aliases, comandos deshabilitados,
--    categorías y comandos custom
-- ═══════════════════════════════════════════════════════════════

-- Columnas nuevas en bot_instances (idempotentes: se ignoran si ya existen)
-- Se crean vía ALTER en la migración; este archivo es referencia.

-- Tabla alternativa para auditoría de configs (opcional, no crítica)
CREATE TABLE IF NOT EXISTS bot_customizations (
  instance_id TEXT PRIMARY KEY REFERENCES bot_instances(id) ON DELETE CASCADE,
  menu_style  TEXT NOT NULL DEFAULT 'versova',
  config      TEXT NOT NULL DEFAULT '{}',
  updated_at  INTEGER NOT NULL
);
