"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  clearStaffToken,
  fetchStaffOrders,
  getStaffToken,
  staffConfirmPayment,
  type StaffOrderSummary,
} from "@/lib/api";
import { ApiError } from "@/lib/api-client";

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "pending", label: "New" },
  { value: "payment_pending", label: "Verifying" },
  { value: "paid", label: "Paid" },
  { value: "cancelled", label: "Cancelled" },
];

function StatusBadge({ status }: { status: string }) {
  const classes: Record<string, string> = {
    pending: "bg-[#fff2c7] text-[#604513] ring-[#d8bd69]",
    payment_pending: "bg-[#ffead0] text-[#824e1a] ring-[#db9d5a]",
    paid: "bg-[#dcefd1] text-[#2f6f2d] ring-[#b9d49f]",
    cancelled: "bg-[#fce0df] text-[#8b3532] ring-[#e3a5a4]",
  };
  const labels: Record<string, string> = {
    pending: "New",
    payment_pending: "Verifying",
    paid: "Paid",
    cancelled: "Cancelled",
  };

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-extrabold ring-1 ${classes[status] ?? classes.pending}`}
    >
      {labels[status] ?? status}
    </span>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function StaffOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<StaffOrderSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const limit = 20;

  const loadOrders = useCallback(async () => {
    if (!getStaffToken()) {
      router.push("/staff/login");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetchStaffOrders({
        status: status || undefined,
        q: query.trim() || undefined,
        limit,
        offset,
      });
      setOrders(res.orders);
      setTotal(res.total);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clearStaffToken();
        router.push("/staff/login");
        return;
      }
      setError(err instanceof ApiError ? err.getMessage() : "Failed to load orders");
    } finally {
      setLoading(false);
    }
  }, [limit, offset, query, router, status]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const handleConfirm = async (orderId: string) => {
    setConfirmingId(orderId);
    try {
      const result = await staffConfirmPayment(orderId);
      setOrders((prev) =>
        prev.map((order) =>
          order.order_id === orderId ? { ...order, status: result.status } : order,
        ),
      );
    } catch (err) {
      alert(err instanceof ApiError ? err.getMessage() : "Confirmation failed");
    } finally {
      setConfirmingId(null);
    }
  };

  const handleLogout = () => {
    clearStaffToken();
    router.push("/staff/login");
  };

  const canGoPrev = offset > 0;
  const canGoNext = offset + limit < total;

  return (
    <main className="min-h-screen px-4 pb-10 pt-5">
      <div className="mx-auto max-w-6xl">
        <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#5e4318]">
              Staff Dashboard
            </p>
            <h1 className="mt-1 text-2xl font-extrabold text-[#1f321b]">
              Orders
            </h1>
            <p className="mt-1 text-sm font-semibold text-[#68775a]">
              {total} total order{total === 1 ? "" : "s"}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="rounded-full border border-[#cfc39f] bg-[#fffdf6] px-4 py-2 text-xs font-extrabold uppercase tracking-[0.08em] text-[#6d5019] transition hover:border-[#8fae6e]"
          >
            Sign out
          </button>
        </header>

        <section className="organic-card mb-4 rounded-3xl border border-[#cfc39f] p-4 shadow-[0_22px_55px_rgba(61,89,50,0.1)]">
          <div className="grid gap-3 md:grid-cols-[12rem_1fr_auto] md:items-end">
            <label className="block">
              <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#6d5019]">
                Status
              </span>
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setOffset(0);
                }}
                className="mt-1 w-full rounded-2xl border border-[#cfc39f] bg-[#fffdf6] px-4 py-3 text-sm font-bold text-[#1f321b] outline-none focus:ring-2 focus:ring-[#2f6f2d]/30"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#6d5019]">
                Search
              </span>
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setOffset(0);
                }}
                placeholder="Order ID or customer name"
                className="mt-1 w-full rounded-2xl border border-[#cfc39f] bg-[#fffdf6] px-4 py-3 text-sm font-bold text-[#1f321b] placeholder-[#b0a87e] outline-none focus:ring-2 focus:ring-[#2f6f2d]/30"
              />
            </label>

            <button
              onClick={loadOrders}
              disabled={loading}
              className="rounded-2xl bg-[#2f6f2d] px-5 py-3 text-sm font-extrabold text-white shadow-[0_12px_25px_rgba(47,111,45,0.24)] transition hover:bg-[#245c24] disabled:cursor-not-allowed disabled:bg-[#b6ad92]"
            >
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>
        </section>

        {error && (
          <div className="mb-4 rounded-2xl border border-[#e3a5a4] bg-[#fce0df] px-4 py-3 text-sm font-bold text-[#8b3532]">
            {error}
          </div>
        )}

        <section className="organic-card overflow-hidden rounded-3xl border border-[#cfc39f] shadow-[0_22px_55px_rgba(61,89,50,0.12)]">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[56rem] text-left text-sm">
              <thead className="bg-[#f5edd5] text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#6d5019]">
                <tr>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Items</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ded3ad] bg-[#fffdf6]/90">
                {orders.map((order) => (
                  <tr key={order.order_id} className="transition hover:bg-[#f8f0dc]">
                    <td className="px-4 py-3 align-top">
                      <div className="font-mono text-xs font-extrabold text-[#1f321b]">
                        {order.order_id}
                      </div>
                      <div className="mt-1 text-xs font-semibold text-[#8f876f]">
                        {formatDate(order.created_at)}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="font-extrabold text-[#1f321b]">{order.full_name}</div>
                      <div className="text-xs font-semibold text-[#68775a]">{order.phone}</div>
                      <div className="mt-1 max-w-[14rem] truncate text-xs font-semibold text-[#8f876f]">
                        {order.address}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="max-w-[18rem] text-xs font-semibold text-[#536342]">
                        {order.items_summary || "No items"}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="text-base font-extrabold text-[#1f321b]">
                        {order.total_price_vnd}
                      </div>
                      <div className="text-xs font-bold uppercase text-[#6d5019]">
                        {order.payment_method}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-4 py-3 text-right align-top">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => router.push(`/staff/orders/${order.order_id}`)}
                          className="rounded-full border border-[#cfc39f] bg-[#fffdf6] px-3 py-2 text-xs font-extrabold text-[#334b28] transition hover:border-[#8fae6e]"
                        >
                          View
                        </button>
                        {order.status !== "paid" && (
                          <button
                            onClick={() => handleConfirm(order.order_id)}
                            disabled={confirmingId === order.order_id}
                            className="rounded-full bg-[#2f6f2d] px-3 py-2 text-xs font-extrabold text-white transition hover:bg-[#245c24] disabled:cursor-not-allowed disabled:bg-[#b6ad92]"
                          >
                            {confirmingId === order.order_id ? "Confirming..." : "Confirm"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="divide-y divide-[#ded3ad] md:hidden">
            {orders.map((order) => (
              <article key={order.order_id} className="bg-[#fffdf6]/90 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-mono text-xs font-extrabold text-[#1f321b]">
                      {order.order_id}
                    </div>
                    <div className="mt-1 text-xs font-semibold text-[#8f876f]">
                      {formatDate(order.created_at)}
                    </div>
                  </div>
                  <StatusBadge status={order.status} />
                </div>

                <div className="mt-3">
                  <div className="font-extrabold text-[#1f321b]">{order.full_name}</div>
                  <div className="text-xs font-semibold text-[#68775a]">{order.phone}</div>
                  <div className="mt-1 text-xs font-semibold text-[#8f876f]">{order.address}</div>
                </div>

                <div className="mt-3 rounded-2xl border border-[#ded3ad] bg-[#fbf7ea] p-3 text-xs font-semibold text-[#536342]">
                  {order.items_summary || "No items"}
                </div>

                <div className="mt-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-lg font-extrabold text-[#1f321b]">
                      {order.total_price_vnd}
                    </div>
                    <div className="text-xs font-bold uppercase text-[#6d5019]">
                      {order.payment_method}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => router.push(`/staff/orders/${order.order_id}`)}
                      className="rounded-full border border-[#cfc39f] bg-[#fffdf6] px-3 py-2 text-xs font-extrabold text-[#334b28]"
                    >
                      View
                    </button>
                    {order.status !== "paid" && (
                      <button
                        onClick={() => handleConfirm(order.order_id)}
                        disabled={confirmingId === order.order_id}
                        className="rounded-full bg-[#2f6f2d] px-3 py-2 text-xs font-extrabold text-white disabled:cursor-not-allowed disabled:bg-[#b6ad92]"
                      >
                        {confirmingId === order.order_id ? "..." : "Confirm"}
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>

          {!loading && orders.length === 0 && (
            <div className="bg-[#fffdf6]/90 px-4 py-12 text-center text-sm font-semibold text-[#8f876f]">
              No orders found.
            </div>
          )}

          {loading && (
            <div className="bg-[#fffdf6]/90 px-4 py-12 text-center text-sm font-semibold text-[#8f876f]">
              Loading orders...
            </div>
          )}
        </section>

        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            onClick={() => setOffset(Math.max(0, offset - limit))}
            disabled={!canGoPrev || loading}
            className="rounded-full border border-[#cfc39f] bg-[#fffdf6] px-4 py-2 text-xs font-extrabold text-[#334b28] transition disabled:cursor-not-allowed disabled:opacity-45"
          >
            ← Previous
          </button>
          <span className="text-xs font-bold text-[#6f654a]">
            Showing {orders.length === 0 ? 0 : offset + 1}-{Math.min(offset + orders.length, total)} of {total}
          </span>
          <button
            onClick={() => setOffset(offset + limit)}
            disabled={!canGoNext || loading}
            className="rounded-full border border-[#cfc39f] bg-[#fffdf6] px-4 py-2 text-xs font-extrabold text-[#334b28] transition disabled:cursor-not-allowed disabled:opacity-45"
          >
            Next →
          </button>
        </div>
      </div>
    </main>
  );
}
