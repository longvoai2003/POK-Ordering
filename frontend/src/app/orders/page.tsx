"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getOrder, type OrderStatusResponse } from "@/lib/api";
import {
    getRecentOrders,
    type RecentOrder,
} from "@/lib/order-storage";
import { formatVnd } from "@/lib/pricing";
import { CATEGORY_LABELS, CATEGORY_DISPLAY_ORDER } from "@/lib/constants";
import { ApiError } from "@/lib/api-client";

const POLL_INTERVAL_MS = 10_000;

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

function OrderStatusCard({ order, showPoll }: { order: OrderStatusResponse; showPoll: boolean }) {
    const isVerifying = order.status === "payment_pending";
    const isPaid = order.status === "paid";

    const entries = CATEGORY_DISPLAY_ORDER.flatMap((cat) =>
        (order.meal[cat] ?? []).filter((sel) => sel != null).map((sel) => ({ cat, sel })),
    );

    return (
        <div className="organic-card rounded-3xl border border-[#cfc39f] p-5 shadow-[0_22px_55px_rgba(61,89,50,0.12)] lg:p-7">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#5e4318]">
                        Order
                    </p>
                    <h1 className="font-mono text-xl font-extrabold text-[#1f321b]">
                        {order.order_id}
                    </h1>
                </div>
                <StatusBadge status={order.status} />
            </div>

            {isVerifying && showPoll && (
                <div className="mb-4 rounded-2xl border border-[#d8bd69] bg-[#fff2c7] p-4 text-center">
                    <span className="text-lg">⏳</span>
                    <p className="mt-1 text-sm font-extrabold text-[#604513]">
                        Verifying your payment
                    </p>
                    <p className="text-xs font-medium text-[#7a5d2a]">
                        Checking every 10s. This usually takes under 15 minutes.
                    </p>
                </div>
            )}

            {isPaid && (
                <div className="mb-4 rounded-2xl border border-[#b9d49f] bg-[#dcefd1] p-4 text-center">
                    <span className="text-lg">✓</span>
                    <p className="mt-1 text-sm font-extrabold text-[#2f6f2d]">
                        Payment confirmed
                    </p>
                    <p className="text-xs font-medium text-[#4f7040]">
                        We're preparing your bowl now.
                    </p>
                </div>
            )}

            <div className="mt-4 space-y-3">
                <div className="rounded-2xl border border-[#d8c98f] bg-[#fff8da] p-4 text-center">
                    <div className="text-2xl font-extrabold text-[#1f321b]">
                        {formatVnd(order.total_price)}
                    </div>
                    <div className="text-xs font-semibold text-[#6f654a]">
                        Total
                    </div>
                </div>

                <div className="rounded-2xl border border-[#ded3ad] bg-[#fffdf6]/80 p-4">
                    <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6d5019]">
                        Bowl
                    </div>
                    <div className="space-y-1">
                        {entries.map(({ cat, sel }) => (
                            <div
                                key={`${cat}-${sel.component_id}`}
                                className="flex items-center justify-between text-sm"
                            >
                                <span className="font-extrabold text-[#1f321b]">
                                    {CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS] ?? cat}
                                </span>
                                <span className="font-semibold text-[#536342]">
                                    {sel.component_id}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="rounded-2xl border border-[#ded3ad] bg-[#fffdf6]/80 p-4">
                    <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6d5019]">
                        Delivery
                    </div>
                    <div className="text-sm font-extrabold text-[#1f321b]">
                        {order.delivery.full_name}
                    </div>
                    <div className="text-xs font-semibold text-[#68775a]">
                        {order.delivery.phone}
                    </div>
                    <div className="mt-1 text-xs font-bold leading-relaxed text-[#536342]">
                        {order.delivery.address}
                    </div>
                </div>
            </div>
        </div>
    );
}

function SingleOrderView({ orderId }: { orderId: string }) {
    const [order, setOrder] = useState<OrderStatusResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        let timer: ReturnType<typeof setTimeout> | null = null;

        const fetch = async () => {
            try {
                const data = await getOrder(orderId);
                if (!cancelled) {
                    setOrder(data);
                    setLoading(false);
                    if (data.status === "payment_pending" || data.status === "pending") {
                        timer = setTimeout(fetch, POLL_INTERVAL_MS);
                    }
                }
            } catch (err) {
                if (!cancelled) {
                    setError(
                        err instanceof ApiError ? err.getMessage() : "Order not found",
                    );
                    setLoading(false);
                }
            }
        };

        fetch();
        return () => {
            cancelled = true;
            if (timer) clearTimeout(timer);
        };
    }, [orderId]);

    if (loading) {
        return (
            <main className="min-h-screen px-4 py-8">
                <div className="mx-auto mb-4 flex max-w-md justify-between gap-2">
                    <Link
                        href="/orders"
                        className="rounded-full border border-[#cfc39f] bg-[#fffdf6] px-4 py-2 text-xs font-bold text-[#334b28] transition hover:border-[#8fae6e]"
                    >
                        ← Back
                    </Link>
                    <Link
                        href="/"
                        className="rounded-full border border-[#cfc39f] bg-[#fffdf6] px-4 py-2 text-xs font-bold text-[#334b28] transition hover:border-[#8fae6e]"
                    >
                        Home
                    </Link>
                </div>
                <div className="organic-card mx-auto max-w-md rounded-3xl border border-[#cfc39f] p-7 text-center shadow-[0_22px_55px_rgba(61,89,50,0.12)]">
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
                <div className="mx-auto mb-4 flex max-w-md justify-between gap-2">
                    <Link
                        href="/orders"
                        className="rounded-full border border-[#cfc39f] bg-[#fffdf6] px-4 py-2 text-xs font-bold text-[#334b28] transition hover:border-[#8fae6e]"
                    >
                        ← Back
                    </Link>
                    <Link
                        href="/"
                        className="rounded-full border border-[#cfc39f] bg-[#fffdf6] px-4 py-2 text-xs font-bold text-[#334b28] transition hover:border-[#8fae6e]"
                    >
                        Home
                    </Link>
                </div>
                <div className="organic-card mx-auto max-w-md rounded-3xl border border-[#cfc39f] p-7 text-center shadow-[0_22px_55px_rgba(61,89,50,0.12)]">
                    <p className="text-sm font-semibold text-[#a84828]">
                        {error ?? "Order not found"}
                    </p>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen px-4 pb-10 pt-5">
            <div className="mx-auto max-w-xl">
                <div className="mb-4 flex justify-between gap-2">
                    <Link
                        href="/orders"
                        className="rounded-full border border-[#cfc39f] bg-[#fffdf6] px-4 py-2 text-xs font-bold text-[#334b28] transition hover:border-[#8fae6e]"
                    >
                        ← Back to orders
                    </Link>
                    <Link
                        href="/"
                        className="rounded-full border border-[#cfc39f] bg-[#fffdf6] px-4 py-2 text-xs font-bold text-[#334b28] transition hover:border-[#8fae6e]"
                    >
                        Home
                    </Link>
                </div>
                <OrderStatusCard order={order} showPoll />
            </div>
        </main>
    );
}

function OrderListContent() {
    const router = useRouter();
    const params = useSearchParams();
    const lookupId = params.get("order_id");
    const [inputId, setInputId] = useState("");
    const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);

    useEffect(() => {
        if (!lookupId) setRecentOrders(getRecentOrders());
    }, [lookupId]);

    if (lookupId) {
        return <SingleOrderView orderId={lookupId} />;
    }

    const handleLookup = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = inputId.trim();
        if (!trimmed) return;
        router.push(`/orders?order_id=${encodeURIComponent(trimmed)}`);
    };

    return (
        <main className="min-h-screen px-4 pb-10 pt-5">
            <div className="mx-auto max-w-xl">
                <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#5e4318]">
                            PureOrganic
                        </p>
                        <h1 className="text-2xl font-extrabold text-[#1f321b]">
                            Check Your Order
                        </h1>
                        <p className="text-sm font-medium text-[#536342]">
                            Enter your order ID or pick from your recent orders below.
                        </p>
                    </div>
                    <Link
                        href="/"
                        className="rounded-full border border-[#cfc39f] bg-[#fffdf6] px-4 py-2 text-xs font-bold text-[#334b28] transition hover:border-[#8fae6e]"
                    >
                        Home
                    </Link>
                </header>

                <form
                    onSubmit={handleLookup}
                    className="mb-6 flex gap-2"
                >
                    <input
                        type="text"
                        value={inputId}
                        onChange={(e) => setInputId(e.target.value)}
                        placeholder="PO-XXXXXX-XXXX"
                        className="flex-1 rounded-2xl border border-[#cfc39f] bg-[#fffdf6] px-4 py-3 text-sm font-semibold text-[#1f321b] placeholder-[#b0a87e] outline-none focus:ring-2 focus:ring-[#2f6f2d]/30"
                    />
                    <button
                        type="submit"
                        disabled={!inputId.trim()}
                        className="rounded-2xl bg-[#2f6f2d] px-5 py-3 text-sm font-bold text-white shadow-[0_12px_25px_rgba(47,111,45,0.28)] transition hover:bg-[#245c24] disabled:bg-[#b6ad92] disabled:text-[#f7f0dc]"
                    >
                        Look up
                    </button>
                </form>

                {recentOrders.length > 0 && (
                    <div>
                        <h2 className="mb-3 text-sm font-extrabold uppercase tracking-[0.12em] text-[#6d5019]">
                            Recent orders
                        </h2>
                        <div className="overflow-hidden rounded-3xl border border-[#cfc39f] shadow-[0_22px_55px_rgba(61,89,50,0.08)]">
                            <div className="divide-y divide-[#ded3ad]">
                                {recentOrders.map((o: RecentOrder) => (
                                    <button
                                        key={o.orderId}
                                        onClick={() =>
                                            router.push(
                                                `/orders?order_id=${encodeURIComponent(o.orderId)}`,
                                            )
                                        }
                                        className="flex w-full items-center justify-between gap-3 bg-[#fffdf6] p-4 text-left transition hover:bg-[#fbf7ea]"
                                    >
                                        <div className="min-w-0">
                                            <code className="text-xs font-extrabold text-[#1f321b]">
                                                {o.orderId}
                                            </code>
                                            <div className="mt-0.5 text-xs font-semibold text-[#68775a]">
                                                {new Date(o.date).toLocaleDateString("vi-VN", {
                                                    month: "2-digit",
                                                    day: "2-digit",
                                                })}{" "}
                                                ·{" "}
                                                {o.paymentMethod === "vietqr" ? "VietQR" : "COD"}
                                            </div>
                                        </div>
                                        <div className="shrink-0 text-right">
                                            <div className="text-sm font-extrabold text-[#1f321b]">
                                                {formatVnd(o.amount)}
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}

export default function OrdersPage() {
    return (
        <Suspense
            fallback={
                <main className="min-h-screen px-4 py-8">
                    <div className="mx-auto mb-4 flex max-w-md justify-end">
                        <Link
                            href="/"
                            className="rounded-full border border-[#cfc39f] bg-[#fffdf6] px-4 py-2 text-xs font-bold text-[#334b28] transition hover:border-[#8fae6e]"
                        >
                            Home
                        </Link>
                    </div>
                    <div className="organic-card mx-auto max-w-md rounded-3xl border border-[#cfc39f] p-7 text-center">
                        <p className="text-sm font-semibold text-[#68775a]">
                            Loading...
                        </p>
                    </div>
                </main>
            }
        >
            <OrderListContent />
        </Suspense>
    );
}
