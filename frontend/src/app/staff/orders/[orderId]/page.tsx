"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import {
  type StaffOrderDetail,
  fetchStaffOrderDetail,
  staffConfirmPayment,
  getStaffToken,
} from "@/lib/api";
import { ApiError, apiUrl } from "@/lib/api-client";

const CATEGORY_LABELS: Record<string, string> = {
  base: "Base",
  protein: "Protein",
  cook_veg: "Cooked Vegetables",
  raw_veg: "Raw Vegetables",
  sauce: "Sauce",
  topping: "Toppings",
  egg: "Eggs",
  cooking_oil: "Cooking Oils",
};

const CATEGORY_ORDER = [
  "base",
  "protein",
  "cook_veg",
  "sauce",
  "raw_veg",
  "topping",
  "egg",
  "cooking_oil",
];

function StatusBadge({ status }: { status: string }) {
  const c: Record<string, string> = {
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
      className={`rounded-full px-3 py-1 text-xs font-extrabold ring-1 ${c[status] ?? c.pending}`}
    >
      {labels[status] ?? status}
    </span>
  );
}

function formatVnd(amount: number): string {
  if (amount < 0) return "";
  if (amount === 0) return "0₫";
  if (amount < 1000) return `${amount}₫`;
  const k = (amount / 1000).toFixed(amount % 1000 === 0 ? 0 : 1);
  return `${k}k ₫`;
}

export default function StaffOrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = use(params);
  const router = useRouter();
  const [order, setOrder] = useState<StaffOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!getStaffToken()) {
      router.push("/staff/login");
      return;
    }
    fetchStaffOrderDetail(orderId)
      .then(setOrder)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          router.push("/staff/login");
          return;
        }
        setError(
          err instanceof ApiError ? err.getMessage() : "Failed to load order",
        );
      })
      .finally(() => setLoading(false));
  }, [orderId, router]);

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      const result = await staffConfirmPayment(orderId);
      setOrder((prev) =>
        prev ? { ...prev, status: result.status } : prev,
      );
    } catch (err) {
      alert(
        err instanceof ApiError ? err.getMessage() : "Confirmation failed",
      );
    }
    setConfirming(false);
  };

  if (loading) {
    return (
      <main className="min-h-screen px-4 py-8">
        <div className="organic-card mx-auto max-w-2xl rounded-3xl border border-[#cfc39f] p-10 text-center shadow-[0_22px_55px_rgba(61,89,50,0.12)]">
          <p className="text-sm font-semibold text-[#68775a]">
            Loading order...
          </p>
        </div>
      </main>
    );
  }

  if (error || !order) {
    return (
      <main className="min-h-screen px-4 py-8">
        <div className="organic-card mx-auto max-w-2xl rounded-3xl border border-[#cfc39f] p-10 text-center shadow-[0_22px_55px_rgba(61,89,50,0.12)]">
          <p className="text-sm font-semibold text-[#a84828]">
            {error ?? "Order not found"}
          </p>
          <button
            onClick={() => router.push("/staff/orders")}
            className="mt-4 rounded-2xl border border-[#cfc39f] bg-[#fffdf6] px-4 py-2 text-xs font-bold text-[#334b28]"
          >
            ← Back to orders
          </button>
        </div>
      </main>
    );
  }

  const itemsByCategory = new Map(
    order.items.map((i) => [i.category, i]),
  );

  return (
    <main className="min-h-screen px-4 pb-10 pt-5">
      <div className="mx-auto max-w-2xl">
        <button
          onClick={() => router.push("/staff/orders")}
          className="mb-4 inline-flex items-center gap-1 rounded-full border border-[#cfc39f] bg-[#fffdf6] px-4 py-2 text-xs font-bold text-[#334b28] transition hover:border-[#8fae6e]"
        >
          ← Back to orders
        </button>

        <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#5e4318]">
              Order Detail
            </p>
            <h1 className="font-mono text-xl font-extrabold text-[#1f321b]">
              {order.order_id}
            </h1>
          </div>
          <StatusBadge status={order.status} />
        </header>

        <div className="space-y-4">
          {/* Bowl breakdown */}
          <div className="organic-card rounded-3xl border border-[#cfc39f] p-5 shadow-[0_22px_55px_rgba(61,89,50,0.12)]">
            <h2 className="mb-3 text-lg font-extrabold text-[#1f321b]">
              Bowl
            </h2>
            <div className="divide-y divide-[#ded3ad] overflow-hidden rounded-2xl border border-[#ded3ad] bg-[#fffdf6]/80">
              {CATEGORY_ORDER.map((cat) => {
                const item = itemsByCategory.get(cat);
                return (
                  <div
                    key={cat}
                    className="grid gap-2 p-3 sm:grid-cols-[8rem_1fr_auto] sm:items-center"
                  >
                    <div className="text-xs font-extrabold uppercase tracking-[0.12em] text-[#6d5019]">
                      {CATEGORY_LABELS[cat] ?? cat}
                    </div>
                    {item ? (
                      <>
                        <div>
                          <div className="text-sm font-extrabold text-[#1f321b]">
                            {item.component_name}
                          </div>
                          <div className="text-xs font-semibold text-[#68775a]">
                            {item.portion}
                            {item.unit}
                          </div>
                        </div>
                        <div className="text-sm font-extrabold text-[#1f321b]">
                          {formatVnd(item.cost)}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-sm font-semibold italic text-[#b0a87e]">
                          Not selected
                        </div>
                        <div />
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-4 rounded-2xl border border-[#d8c98f] bg-[#fff8da] p-4">
              <div className="text-2xl font-extrabold text-[#1f321b]">
                {order.total_price_vnd}
              </div>
              <div className="mt-1 text-xs font-semibold text-[#6f654a]">
                Total
              </div>
            </div>
          </div>

          {/* Macros */}
          <div className="organic-card rounded-3xl border border-[#cfc39f] p-5 shadow-[0_22px_55px_rgba(61,89,50,0.1)]">
            <h2 className="mb-3 text-lg font-extrabold text-[#1f321b]">
              Macros
            </h2>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="rounded-2xl border border-[#ded3ad] bg-[#fffdf6]/80 p-3">
                <div className="text-xl font-extrabold text-[#1f321b]">
                  {order.total_calories}
                </div>
                <div className="text-[11px] font-semibold text-[#6f654a]">
                  calories
                </div>
              </div>
              <div className="rounded-2xl border border-[#ded3ad] bg-[#fffdf6]/80 p-3">
                <div className="text-xl font-extrabold text-[#1f321b]">
                  {order.total_protein}g
                </div>
                <div className="text-[11px] font-semibold text-[#6f654a]">
                  protein
                </div>
              </div>
              <div className="rounded-2xl border border-[#ded3ad] bg-[#fffdf6]/80 p-3">
                <div className="text-xl font-extrabold text-[#1f321b]">
                  {order.total_carbs}g
                </div>
                <div className="text-[11px] font-semibold text-[#6f654a]">
                  carbs
                </div>
              </div>
              <div className="rounded-2xl border border-[#ded3ad] bg-[#fffdf6]/80 p-3">
                <div className="text-xl font-extrabold text-[#1f321b]">
                  {order.total_fat}g
                </div>
                <div className="text-[11px] font-semibold text-[#6f654a]">
                  fat
                </div>
              </div>
            </div>
          </div>

          {/* Delivery + QR side by side */}
          <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
            {/* Delivery */}
            <div className="organic-card rounded-3xl border border-[#cfc39f] p-5 shadow-[0_22px_55px_rgba(61,89,50,0.1)]">
              <h2 className="mb-3 text-lg font-extrabold text-[#1f321b]">
                Delivery
              </h2>
              <div className="space-y-2">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6d5019]">
                    Customer
                  </div>
                  <div className="text-sm font-extrabold text-[#1f321b]">
                    {order.full_name}
                  </div>
                  <div className="text-xs font-semibold text-[#68775a]">
                    {order.phone}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6d5019]">
                    Address
                  </div>
                  <div className="text-sm font-bold leading-relaxed text-[#1f321b]">
                    {order.address}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6d5019]">
                    Payment
                  </div>
                  <div className="text-sm font-extrabold text-[#1f321b]">
                    {order.payment_method === "vietqr"
                      ? "VietQR transfer"
                      : "Cash on delivery"}
                  </div>
                </div>
                {order.notes && (
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6d5019]">
                      Notes
                    </div>
                    <div className="text-sm font-semibold leading-relaxed text-[#536342]">
                      {order.notes}
                    </div>
                  </div>
                )}
                {order.paid_at && (
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6d5019]">
                      Paid at
                    </div>
                    <div className="text-sm font-semibold text-[#536342]">
                      {new Date(order.paid_at).toLocaleString("vi-VN", {
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                )}
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6d5019]">
                    Created
                  </div>
                  <div className="text-sm font-semibold text-[#536342]">
                    {new Date(order.created_at).toLocaleString("vi-VN", {
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* QR */}
            {order.qr_url && (
              <div className="organic-card flex flex-col items-center rounded-3xl border border-[#cfc39f] p-4 shadow-[0_22px_55px_rgba(61,89,50,0.1)]">
                <h2 className="mb-2 text-xs font-extrabold uppercase tracking-[0.14em] text-[#6d5019]">
                  VietQR
                </h2>
                <img
                  src={apiUrl(order.qr_url)}
                  alt="VietQR"
                  className="aspect-square w-full rounded-xl border border-[#d8c98f] bg-white shadow-sm"
                />
              </div>
            )}
          </div>

          {/* Action buttons */}
          {order.status === "payment_pending" && (
            <div className="organic-card rounded-3xl border border-[#ffead0] bg-[#fffdf6] p-5 shadow-[0_22px_55px_rgba(61,89,50,0.1)]">
              <h2 className="mb-3 text-lg font-extrabold text-[#1f321b]">
                Verify Payment
              </h2>
              <p className="mb-4 text-sm font-medium text-[#68775a]">
                Check your bank account for a transfer matching this order ID
                as the note. Then confirm to mark it paid.
              </p>
              <button
                onClick={handleConfirm}
                disabled={confirming}
                className="w-full rounded-2xl bg-[#2f6f2d] px-5 py-3.5 text-sm font-extrabold text-white shadow-[0_14px_30px_rgba(47,111,45,0.28)] transition hover:bg-[#245c24] active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-[#b6ad92] disabled:text-[#f7f0dc]"
              >
                {confirming
                  ? "Confirming..."
                  : "Confirm payment →"}
              </button>
            </div>
          )}

          {order.status === "paid" && (
            <div className="organic-card rounded-3xl border border-[#dcefd1] bg-[#fffdf6] p-5 text-center shadow-[0_22px_55px_rgba(61,89,50,0.1)]">
              <div className="text-sm font-extrabold text-[#2f6f2d]">
                ✓ Payment confirmed
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
