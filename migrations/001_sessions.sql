CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS sessions (
    session_id       TEXT PRIMARY KEY,
    customer_id      TEXT NOT NULL,
    sender_id        TEXT NOT NULL,
    channel          TEXT NOT NULL DEFAULT 'manychat',
    session_status   TEXT NOT NULL DEFAULT 'active',
    intake_status    TEXT NOT NULL DEFAULT 'in_progress',
    customer_type    TEXT NOT NULL DEFAULT 'unknown',
    intent           TEXT NOT NULL DEFAULT '',

    collected_fields        JSONB NOT NULL DEFAULT '{}',
    missing_fields          JSONB NOT NULL DEFAULT '[]',
    selected_meal           JSONB NOT NULL DEFAULT '{}',
    recommended_ingredients JSONB NOT NULL DEFAULT '{}',
    total_macros            JSONB NOT NULL DEFAULT '{}',

    current_category     TEXT,
    next_category        TEXT,
    category_position    INTEGER,
    handled_categories   JSONB NOT NULL DEFAULT '[]',
    category_browse_mode TEXT,

    customize_position INTEGER,
    customize_current  TEXT,

    last_message_text      TEXT,
    last_reply_text        TEXT,
    last_message_timestamp TIMESTAMPTZ,
    last_message_id        TEXT, 

    next_action            TEXT,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_customer ON sessions(customer_id);
CREATE INDEX IF NOT EXISTS idx_sessions_sender   ON sessions(sender_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status   ON sessions(session_status);
CREATE INDEX IF NOT EXISTS idx_sessions_ttl      ON sessions(last_message_timestamp)
    WHERE session_status NOT IN ('expired', 'done');

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS awaiting_portion BOOLEAN NOT NULL DEFAULT false;
