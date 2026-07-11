import asyncpg
import logging
from datetime import datetime, timezone
from src.config import DATABASE_URL
from src.domain.contracts.order_repo import OrderRepo
from src.models.order import Order, OrderItem

logger = logging.getLogger(__name__)


class PostgresOrderRepo(OrderRepo):
    def __init__(self, dsn: str = DATABASE_URL):
        self.dsn = dsn
        self._pool: asyncpg.Pool | None = None

    async def _get_pool(self) -> asyncpg.Pool:
        if self._pool is None:
            self._pool = await asyncpg.create_pool(self.dsn, min_size=2, max_size=10)
        return self._pool

    async def create(self, order: Order) -> Order | None:
        pool = await self._get_pool()
        async with pool.acquire() as conn:
            async with conn.transaction():
                row = await conn.fetchrow(
                    """
                    INSERT INTO orders (
                        order_id, channel, status, payment_method, total_price,
                        full_name, phone, address, notes,
                        total_calories, total_protein, total_carbs, total_fat,
                        qr_url, paid_at, created_at, updated_at
                    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
                    ON CONFLICT (order_id) DO NOTHING
                    RETURNING *
                    """,
                    order.order_id,
                    order.channel,
                    order.status,
                    order.payment_method,
                    order.total_price,
                    order.full_name,
                    order.phone,
                    order.address,
                    order.notes,
                    order.total_calories,
                    order.total_protein,
                    order.total_carbs,
                    order.total_fat,
                    order.qr_url,
                    _to_timestamptz(order.paid_at),
                    _to_timestamptz(order.created_at),
                    _to_timestamptz(order.updated_at),
                )

                if row is None:
                    return None

                for item in order.items:
                    await conn.execute(
                        """
                        INSERT INTO order_items (
                            order_id, category, component_id, component_name,
                            portion, unit, cost
                        ) VALUES ($1,$2,$3,$4,$5,$6,$7)
                        ON CONFLICT (order_id, category, component_id) DO NOTHING
                        """,
                        item.order_id,
                        item.category,
                        item.component_id,
                        item.component_name,
                        item.portion,
                        item.unit,
                        item.cost,
                    )

        return self._row_to_order(row)

    async def update_order(self, order: Order) -> Order | None:
        pool = await self._get_pool()
        now = datetime.now(timezone.utc)
        async with pool.acquire() as conn:
            async with conn.transaction():
                row = await conn.fetchrow(
                    """
                    UPDATE orders SET
                        full_name = $2, phone = $3, address = $4, notes = $5,
                        total_price = $6,
                        total_calories = $7, total_protein = $8,
                        total_carbs = $9, total_fat = $10,
                        updated_at = $11
                    WHERE order_id = $1 AND status = 'pending'
                    RETURNING *
                    """,
                    order.order_id,
                    order.full_name,
                    order.phone,
                    order.address,
                    order.notes,
                    order.total_price,
                    order.total_calories,
                    order.total_protein,
                    order.total_carbs,
                    order.total_fat,
                    now,
                )
                if row is None:
                    return None

                await conn.execute(
                    "DELETE FROM order_items WHERE order_id = $1",
                    order.order_id,
                )
                for item in order.items:
                    await conn.execute(
                        """
                        INSERT INTO order_items (
                            order_id, category, component_id, component_name,
                            portion, unit, cost
                        ) VALUES ($1,$2,$3,$4,$5,$6,$7)
                        """,
                        item.order_id,
                        item.category,
                        item.component_id,
                        item.component_name,
                        item.portion,
                        item.unit,
                        item.cost,
                    )

        return Order(
            order_id=row["order_id"],
            channel=row["channel"],
            status=row["status"],
            payment_method=row["payment_method"],
            total_price=float(row["total_price"]),
            full_name=row["full_name"],
            phone=row["phone"],
            address=row["address"],
            notes=row["notes"] or "",
            total_calories=float(row["total_calories"]),
            total_protein=float(row["total_protein"]),
            total_carbs=float(row["total_carbs"]),
            total_fat=float(row["total_fat"]),
            qr_url=row["qr_url"],
            paid_at=_from_timestamptz(row["paid_at"]),
            created_at=_from_timestamptz(row["created_at"]) or "",
            updated_at=_from_timestamptz(row["updated_at"]) or "",
            items=order.items,
        )

    async def get_by_id(self, order_id: str) -> Order | None:
        pool = await self._get_pool()
        row = await pool.fetchrow(
            "SELECT * FROM orders WHERE order_id = $1", order_id
        )
        if row is None:
            return None

        item_rows = await pool.fetch(
            "SELECT * FROM order_items WHERE order_id = $1 ORDER BY category",
            order_id,
        )
        return self._row_to_order(row, item_rows)

    async def confirm_payment(self, order_id: str) -> Order | None:
        pool = await self._get_pool()
        now = datetime.now(timezone.utc)
        row = await pool.fetchrow(
            """
            UPDATE orders SET
                status = 'paid',
                paid_at = $2,
                updated_at = $3
            WHERE order_id = $1
            RETURNING *
            """,
            order_id,
            now,
            now,
        )
        if row is None:
            return None

        item_rows = await pool.fetch(
            "SELECT * FROM order_items WHERE order_id = $1 ORDER BY category",
            order_id,
        )
        return self._row_to_order(row, item_rows)

    async def update_status(self, order_id: str, status: str) -> Order | None:
        pool = await self._get_pool()
        now = datetime.now(timezone.utc)
        paid_at = now if status == "paid" else None
        row = await pool.fetchrow(
            """
            UPDATE orders SET
                status = $2,
                paid_at = COALESCE($3, paid_at),
                updated_at = $4
            WHERE order_id = $1
            RETURNING *
            """,
            order_id,
            status,
            paid_at,
            now,
        )
        if row is None:
            return None

        item_rows = await pool.fetch(
            "SELECT * FROM order_items WHERE order_id = $1 ORDER BY category",
            order_id,
        )
        return self._row_to_order(row, item_rows)

    async def list_all(
        self,
        filters: dict[str, str],
        search: str | None,
        limit: int,
        offset: int,
    ) -> list[tuple[object, str, str]]:
        pool = await self._get_pool()
        conditions: list[str] = []
        params: list = []
        idx = 1

        for col, val in filters.items():
            conditions.append(f"o.{col} = ${idx}")
            params.append(val)
            idx += 1

        if search:
            conditions.append(
                f"(o.order_id ILIKE ${idx} OR o.full_name ILIKE ${idx})"
            )
            params.append(f"%{search}%")
            idx += 1

        where = ""
        if conditions:
            where = "WHERE " + " AND ".join(conditions)

        query = f"""
            SELECT o.* FROM orders o
            {where}
            ORDER BY o.created_at DESC
            LIMIT ${idx} OFFSET ${idx + 1}
        """
        params.extend([limit, offset])

        rows = await pool.fetch(query, *params)
        results = []
        for row in rows:
            order = self._row_to_order(row)
            items_part = await pool.fetch(
                "SELECT category, component_name FROM order_items WHERE order_id = $1 ORDER BY category",
                order.order_id,
            )
            summary = ", ".join(
                f"{i['category']}: {i['component_name']}" for i in items_part
            )
            from src.domain.core.pricing import fmt_price

            results.append((order, fmt_price(order.total_price), summary))
        return results

    async def count_all(
        self,
        filters: dict[str, str],
        search: str | None,
    ) -> int:
        pool = await self._get_pool()
        conditions: list[str] = []
        params: list = []
        idx = 1

        for col, val in filters.items():
            conditions.append(f"o.{col} = ${idx}")
            params.append(val)
            idx += 1

        if search:
            conditions.append(
                f"(o.order_id ILIKE ${idx} OR o.full_name ILIKE ${idx})"
            )
            params.append(f"%{search}%")
            idx += 1

        where = ""
        if conditions:
            where = "WHERE " + " AND ".join(conditions)

        query = f"SELECT COUNT(*) FROM orders o {where}"
        row = await pool.fetchrow(query, *params)
        return row["count"] if row else 0

    async def close(self) -> None:
        if self._pool:
            await self._pool.close()
            self._pool = None

    @staticmethod
    def _row_to_order(
        row: asyncpg.Record,
        item_rows: list[asyncpg.Record] | None = None,
    ) -> Order:
        items: list[OrderItem] = []
        if item_rows:
            for ir in item_rows:
                items.append(
                    OrderItem(
                        order_id=ir["order_id"],
                        category=ir["category"],
                        component_id=ir["component_id"],
                        component_name=ir["component_name"],
                        portion=float(ir["portion"]),
                        unit=ir["unit"],
                        cost=float(ir["cost"]),
                    )
                )

        return Order(
            order_id=row["order_id"],
            channel=row["channel"],
            status=row["status"],
            payment_method=row["payment_method"],
            total_price=float(row["total_price"]),
            full_name=row["full_name"],
            phone=row["phone"],
            address=row["address"],
            notes=row["notes"] or "",
            total_calories=float(row["total_calories"]),
            total_protein=float(row["total_protein"]),
            total_carbs=float(row["total_carbs"]),
            total_fat=float(row["total_fat"]),
            qr_url=row["qr_url"],
            paid_at=_from_timestamptz(row["paid_at"]),
            created_at=_from_timestamptz(row["created_at"]) or "",
            updated_at=_from_timestamptz(row["updated_at"]) or "",
            items=items,
        )


def _to_timestamptz(value: str | None) -> datetime | None:
    if value is None:
        return None
    return datetime.fromisoformat(value)


def _from_timestamptz(value: datetime | None) -> str | None:
    if value is None:
        return None
    return value.isoformat()
