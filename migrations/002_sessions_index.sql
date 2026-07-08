-- Replace full customer_id index with partial index that skips expired rows.
-- Active queries (get_by_customer_id) only need non-expired sessions.
-- Expired rows remain for audit but are excluded from active lookups.

DROP INDEX IF EXISTS idx_sessions_customer;
CREATE INDEX IF NOT EXISTS idx_sessions_active_customer
    ON sessions (customer_id, updated_at DESC)
    WHERE session_status NOT IN ('expired', 'done');
