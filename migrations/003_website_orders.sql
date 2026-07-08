CREATE TABLE IF NOT EXISTS orders (
    order_id        TEXT PRIMARY KEY,
    channel         TEXT NOT NULL DEFAULT 'website',
    status          TEXT NOT NULL DEFAULT 'pending',
    payment_method  TEXT NOT NULL DEFAULT 'vietqr',
    total_price     NUMERIC(12,0) NOT NULL DEFAULT 0,

    full_name       TEXT NOT NULL DEFAULT '',
    phone           TEXT NOT NULL DEFAULT '',
    address         TEXT NOT NULL DEFAULT '',
    notes           TEXT NOT NULL DEFAULT '',

    total_calories  NUMERIC(8,1) NOT NULL DEFAULT 0,
    total_protein   NUMERIC(8,1) NOT NULL DEFAULT 0,
    total_carbs     NUMERIC(8,1) NOT NULL DEFAULT 0,
    total_fat       NUMERIC(8,1) NOT NULL DEFAULT 0,

    qr_url          TEXT,
    paid_at         TIMESTAMPTZ,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_items (
    order_id        TEXT NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    category        TEXT NOT NULL,
    component_id    TEXT NOT NULL,
    component_name  TEXT NOT NULL DEFAULT '',
    portion         NUMERIC(6,1) NOT NULL DEFAULT 0,
    unit            TEXT NOT NULL DEFAULT 'g',
    cost            NUMERIC(12,0) NOT NULL DEFAULT 0,
    PRIMARY KEY (order_id, category)
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
