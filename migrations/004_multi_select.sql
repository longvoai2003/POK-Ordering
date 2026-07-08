-- 004_multi_select.sql
-- Support multiple ingredients per category in order_items

-- Drop existing primary key on (order_id, category)
ALTER TABLE order_items
    DROP CONSTRAINT IF EXISTS order_items_pkey;

-- Add new composite primary key on (order_id, category, component_id)
ALTER TABLE order_items
    ADD PRIMARY KEY (order_id, category, component_id);
