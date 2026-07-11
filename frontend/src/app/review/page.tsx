"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CATEGORY_LABELS, FIXED_PRICE_CATEGORIES, CATEGORY_DISPLAY_ORDER } from "@/lib/constants";
import type { CategorySlug, Meal } from "@/lib/types";
import { type CheckoutOrder, loadCreateCheckoutOrder, loadEditCheckoutOrder, saveCheckoutOrder, saveRecentOrder } from "@/lib/order-storage";
import { calculateIngredientPrice, formatVnd } from "@/lib/pricing";
import { createOrder, fetchMenu, getOrder, updateOrder, type CreateOrderPayload } from "@/lib/api";
import { ApiError } from "@/lib/api-client";

function formatPortion(portion: number, unit: string): string {
  if (unit === "count") return `${portion} egg${portion > 1 ? "s" : ""}`;
  return `${portion}${unit}`;
}

export default function ReviewPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen px-4 py-8">
          <div className="organic-card mx-auto max-w-md rounded-3xl border border-[#cfc39f] p-7 text-center">
            <p className="text-sm font-semibold text-[#68775a]">Loading...</p>
          </div>
        </main>
      }
    >
      <ReviewPageContent />
    </Suspense>
  );
}

function ReviewPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editOrderId = searchParams.get("order_id");
  const [order, setOrder] = useState<CheckoutOrder | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [apiLoading, setApiLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (editOrderId) {
      const saved = loadEditCheckoutOrder(editOrderId);
      if (saved) {
        setOrder(saved);
        setApiLoading(false);
        return;
      }

      setApiLoading(true);
      Promise.all([getOrder(editOrderId), fetchMenu()])
        .then(([orderData, menuData]) => {
          if (cancelled) return;

          const mealFromOrder: Meal = {};
          let calories = 0;
          let protein = 0;
          let carbs = 0;
          let fat = 0;

          for (const cat of CATEGORY_DISPLAY_ORDER) {
            const items = orderData.meal[cat] ?? [];
            const components = menuData.categories[cat] ?? [];
            mealFromOrder[cat] = [];

            for (const item of items) {
              const component = components.find((c) => c.component_id === item.component_id);
              if (!component) continue;

              mealFromOrder[cat].push({ component, portion: item.portion });

              const ratio = item.portion / component.default_portion;
              calories += component.calories * ratio;
              protein += component.protein * ratio;
              carbs += component.carbs * ratio;
              fat += component.fat * ratio;
            }
          }

            const hydratedOrder: CheckoutOrder = {
              meal: mealFromOrder,
            macros: {
              calories: Math.round(calories),
              protein: Math.round(protein * 10) / 10,
              carbs: Math.round(carbs * 10) / 10,
              fat: Math.round(fat * 10) / 10,
            },
            totalPrice: orderData.total_price,
            details: {
              fullName: orderData.delivery.full_name,
              phone: orderData.delivery.phone,
              address: orderData.delivery.address,
              notes: orderData.delivery.notes,
              paymentMethod: orderData.delivery.payment_method,
            },
              createdAt: new Date().toISOString(),
              orderId: editOrderId,
              source: "server",
            };

          saveCheckoutOrder(hydratedOrder);
          setOrder(hydratedOrder);
          setApiLoading(false);
        })
        .catch(() => {
          if (!cancelled) setApiLoading(false);
        });

      return () => {
        cancelled = true;
      };
    }

    setOrder(loadCreateCheckoutOrder());
    setApiLoading(false);
  }, [editOrderId]);

    const orderId = editOrderId ?? undefined;
  const isEdit = orderId != null;

  const handleConfirm = async () => {
    if (!order || !order.details) return;
    setSubmitting(true);
    setSubmitError(null);

    const mealPayload: Record<string, { component_id: string; portion: number }[] | null> = {};
    for (const cat of CATEGORY_DISPLAY_ORDER) {
      const items = (order.meal[cat] ?? []) as { component: { component_id: string }; portion: number }[];
      if (items.length === 0) {
        mealPayload[cat] = null;
      } else {
        mealPayload[cat] = items.map((sel) => ({
          component_id: sel.component.component_id,
          portion: sel.portion,
        }));
      }
    }

    const payload: CreateOrderPayload = {
      meal: mealPayload,
      delivery: {
        full_name: order.details.fullName,
        phone: order.details.phone,
        address: order.details.address,
        notes: order.details.notes,
        payment_method: order.details.paymentMethod,
      },
    };

    if (isEdit) {
      try {
        const response = await updateOrder(orderId!, payload);
        router.push(`/payment?order_id=${response.order_id}`);
      } catch (err) {
        setSubmitError(
          err instanceof ApiError
            ? err.getMessage()
            : "Could not update order. Please try again.",
        );
        setSubmitting(false);
      }
      return;
    }

    try {
      const response = await createOrder(payload);
      saveRecentOrder({
        orderId: response.order_id,
        date: new Date().toISOString(),
        amount: response.total_price,
        paymentMethod: order.details.paymentMethod,
      });
      const { clearCheckoutOrder } = await import("@/lib/order-storage");
      clearCheckoutOrder();
      router.push(`/payment?order_id=${response.order_id}`);
    } catch (err) {
      setSubmitError(
        err instanceof ApiError
          ? err.getMessage()
          : "Could not create order. Please try again.",
      );
      setSubmitting(false);
    }
  };

  const entries = order
    ? CATEGORY_DISPLAY_ORDER.flatMap((cat) =>
        (order.meal[cat] ?? []).map((sel) => ({ cat: cat as CategorySlug, sel })),
      )
    : [];

  if (apiLoading) {
    return (
      <main className="min-h-screen px-4 py-8">
        <div className="organic-card mx-auto max-w-md rounded-3xl border border-[#cfc39f] p-7 text-center shadow-[0_22px_55px_rgba(61,89,50,0.12)]">
          <p className="text-sm font-semibold text-[#68775a]">Loading order...</p>
        </div>
      </main>
    );
  }

  if (!order || entries.length === 0) {
    return (
      <main className="min-h-screen px-4 py-8">
        <div className="organic-card mx-auto max-w-md rounded-3xl border border-[#cfc39f] p-7 text-center shadow-[0_22px_55px_rgba(61,89,50,0.12)]">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#5e4318]">PureOrganic</p>
          <h1 className="mt-2 text-2xl font-extrabold text-[#1f321b]">Nothing to review</h1>
          <p className="mt-2 text-sm font-medium text-[#68775a]">Build your bowl first so we can prepare the review.</p>
          <button
            onClick={() => router.push("/build")}
            className="mt-6 rounded-2xl bg-[#2f6f2d] px-5 py-3 text-sm font-bold text-white shadow-[0_12px_25px_rgba(47,111,45,0.28)]"
          >
            Build a bowl →
          </button>
        </div>
      </main>
    );
  }

  if (!order.details) {
    return (
      <main className="min-h-screen px-4 py-8">
        <div className="organic-card mx-auto max-w-md rounded-3xl border border-[#cfc39f] p-7 text-center shadow-[0_22px_55px_rgba(61,89,50,0.12)]">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#5e4318]">Checkout</p>
          <h1 className="mt-2 text-2xl font-extrabold text-[#1f321b]">Delivery details needed</h1>
          <p className="mt-2 text-sm font-medium text-[#68775a]">Add your address and payment preference before review.</p>
          <button
            onClick={() => router.push("/details")}
            className="mt-6 rounded-2xl bg-[#2f6f2d] px-5 py-3 text-sm font-bold text-white shadow-[0_12px_25px_rgba(47,111,45,0.28)]"
          >
            Add details →
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 pb-10 pt-5">
      <div className="mx-auto max-w-5xl">
        <header className="mb-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#5e4318]">Review</p>
            <h1 className="text-2xl font-extrabold text-[#1f321b]">
              {isEdit ? "Edit Your Order" : "Confirm Your Order"}
            </h1>
            <p className="text-sm font-medium text-[#536342]">
              {isEdit ? "Review your changes before saving." : "Check your bowl and delivery details before payment."}
            </p>
          </div>
        </header>

        <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
          <section className="space-y-5">
            <div className="organic-card rounded-3xl border border-[#cfc39f] p-4 shadow-[0_22px_55px_rgba(61,89,50,0.12)] lg:p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-extrabold text-[#1f321b]">Your Bowl</h2>
                  <p className="text-xs font-semibold text-[#68775a]">Every selected ingredient and portion.</p>
                </div>
                <button
                  onClick={() => router.push(isEdit ? `/build?order_id=${orderId}` : "/build")}
                  className="rounded-full border border-[#cfc39f] bg-[#fffdf6] px-3 py-2 text-xs font-bold text-[#334b28]"
                >
                  Edit
                </button>
              </div>

              <div className="divide-y divide-[#ded3ad] overflow-hidden rounded-2xl border border-[#ded3ad] bg-[#fffdf6]/80">
                {entries.map(({ cat, sel }) => (
                  <div key={`${cat}-${sel.component.component_id}`} className="grid gap-2 p-3 sm:grid-cols-[7rem_1fr_auto] sm:items-center">
                    <div className="text-xs font-extrabold uppercase tracking-[0.12em] text-[#6d5019]">
                      {CATEGORY_LABELS[cat]}
                    </div>
                    <div>
                      <div className="text-sm font-extrabold text-[#1f321b]">{sel.component.component_name}</div>
                      <div className="text-xs font-semibold text-[#68775a]">
                        {FIXED_PRICE_CATEGORIES.includes(cat)
                          ? "Fixed add-on"
                          : formatPortion(sel.portion, sel.component.unit)}
                      </div>
                    </div>
                    <div className="text-sm font-extrabold text-[#1f321b]">
                      {formatVnd(calculateIngredientPrice(sel))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="organic-card rounded-3xl border border-[#cfc39f] p-4 shadow-[0_22px_55px_rgba(61,89,50,0.1)] lg:p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-extrabold text-[#1f321b]">Delivery</h2>
                  <p className="text-xs font-semibold text-[#68775a]">Where we will send it.</p>
                </div>
                <button
                  onClick={() => router.push(isEdit ? `/details?order_id=${orderId}` : "/details")}
                  className="rounded-full border border-[#cfc39f] bg-[#fffdf6] px-3 py-2 text-xs font-bold text-[#334b28]"
                >
                  Edit
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-[#ded3ad] bg-[#fffdf6]/80 p-3">
                  <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6d5019]">Customer</div>
                  <div className="mt-1 text-sm font-extrabold text-[#1f321b]">{order.details.fullName}</div>
                  <div className="text-xs font-semibold text-[#68775a]">{order.details.phone}</div>
                </div>
                <div className="rounded-2xl border border-[#ded3ad] bg-[#fffdf6]/80 p-3">
                  <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6d5019]">Payment</div>
                  <div className="mt-1 text-sm font-extrabold text-[#1f321b]">
                    {order.details.paymentMethod === "vietqr" ? "VietQR transfer" : "Cash on delivery"}
                  </div>
                  <div className="text-xs font-semibold text-[#68775a]">Selected for this order</div>
                </div>
                <div className="rounded-2xl border border-[#ded3ad] bg-[#fffdf6]/80 p-3 sm:col-span-2">
                  <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6d5019]">Address</div>
                  <div className="mt-1 text-sm font-bold leading-relaxed text-[#1f321b]">{order.details.address}</div>
                  {order.details.notes && (
                    <div className="mt-2 text-xs font-semibold leading-relaxed text-[#68775a]">Note: {order.details.notes}</div>
                  )}
                </div>
              </div>
            </div>
          </section>

          <aside className="organic-card h-fit rounded-3xl border border-[#cfc39f] p-5 shadow-[0_22px_55px_rgba(61,89,50,0.1)] lg:sticky lg:top-5">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#5e4318]">Total</p>
            <div className="mt-3 rounded-2xl border border-[#d8c98f] bg-[#fff8da] p-4">
              <div className="text-3xl font-extrabold text-[#1f321b]">{formatVnd(order.totalPrice)}</div>
              <div className="mt-1 text-xs font-semibold text-[#6f654a]">Mock total before delivery fee</div>
            </div>
            <div className="mt-4 grid grid-cols-4 gap-1 text-center text-xs">
              <div><div className="font-extrabold text-[#1f321b]">{order.macros.calories}</div><div className="font-semibold text-[#6f654a]">cal</div></div>
              <div><div className="font-extrabold text-[#1f321b]">{order.macros.protein}g</div><div className="font-semibold text-[#6f654a]">protein</div></div>
              <div><div className="font-extrabold text-[#1f321b]">{order.macros.carbs}g</div><div className="font-semibold text-[#6f654a]">carbs</div></div>
              <div><div className="font-extrabold text-[#1f321b]">{order.macros.fat}g</div><div className="font-semibold text-[#6f654a]">fat</div></div>
            </div>
            <button
              onClick={handleConfirm}
              disabled={submitting}
              className="mt-5 w-full rounded-2xl bg-[#2f6f2d] px-5 py-3.5 text-sm font-extrabold text-white shadow-[0_14px_30px_rgba(47,111,45,0.28)] transition hover:bg-[#245c24] active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-[#b6ad92] disabled:text-[#f7f0dc] disabled:shadow-none"
            >
              {submitting
                ? isEdit ? "Saving..." : "Creating order..."
                : isEdit ? "Save changes →" : "Confirm order →"}
            </button>
            {submitError && (
              <p className="mt-3 text-center text-xs font-semibold text-[#a84828]">{submitError}</p>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
