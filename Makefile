.PHONY: dev test test-unit build up down db-migrate db-init

dev:
	uv run uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload

test:
	uv run pytest tests/ -v

test-unit:
	uv run pytest tests/unit/ -v

lint:
	uv run ruff check src/ tests/

build:
	docker compose build

up:
	docker compose up -d

down:
	docker compose down

db-init:
	psql "postgresql://pureorganic:pureorganic@localhost:5432/pureorganic" -f migrations/001_sessions.sql
	psql "postgresql://pureorganic:pureorganic@localhost:5432/pureorganic" -f migrations/002_optional_menu.sql
	psql "postgresql://pureorganic:pureorganic@localhost:5432/pureorganic" -f migrations/002_sessions_index.sql
	psql "postgresql://pureorganic:pureorganic@localhost:5432/pureorganic" -f migrations/003_website_orders.sql

db-migrate:
	psql "postgresql://pureorganic:pureorganic@localhost:5432/pureorganic" -f migrations/003_website_orders.sql
