"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { formatVnd } from "@/lib/pricing";
import {
    type OrderStatusResponse,
    getOrder,
    confirmPayment,
} from "@/lib/api";
import { clearCheckoutOrder, saveRecentOrder } from "@/lib/order-storage";
import { apiUrl, ApiError } from "@/lib/api-client";

const BANK_DETAILS = {
    bankName: "PureOrganic Mock Bank",
    accountNumber: "1234 5678 9012",
    accountName: "PUREORGANIC VN",
};

function PaymentContent() {
    const router = useRouter();
    const params = useSearchParams();
    const orderId = params.get("order_id");

    const [order, setOrder] = useState<OrderStatusResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [completed, setCompleted] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [confirmResult, setConfirmResult] = useState<{
        status: string;
        message: string;
    } | null>(null);
    const [confirmError, setConfirmError] = useState<string | null>(null);

    useEffect(() => {
        if (!orderId) {
            setLoading(false);
            setError("No order id provided.");
            return;
        }

        let cancelled = false;
        getOrder(orderId)
            .then((data) => {
                if (!cancelled) {
                    setOrder(data);
                    setLoading(false);
                }
            })
            .catch((err) => {
                if (!cancelled) {
                    setError(
                        err instanceof ApiError
                            ? err.getMessage()
                            : "Order not found.",
                    );
                }
                setLoading(false);
            });
        return () => { cancelled = true; };
    }, [orderId]);

    const handleConfirmPayment = async () => {
        if (!orderId) return;
        setConfirming(true);
        setConfirmError(null);
        try {
            const result = await confirmPayment(orderId);
            setConfirmResult(result);
            setCompleted(true);
            clearCheckoutOrder();

            if (order) {
                saveRecentOrder({
                    orderId,
                    date: new Date().toISOString(),
                    amount: order.total_price,
                    paymentMethod: order.delivery.payment_method,
                });
            }
        } catch (err) {
            setConfirmError(
                err instanceof ApiError
                    ? err.getMessage()
                    : "Payment confirmation failed. Please try again.",
            );
            setConfirming(false);
        }
    };

    useEffect(() => {
        if (
            !orderId ||
            !completed ||
            confirmResult?.status !== "payment_pending"
        )
            return;

        let cancelled = false;
        const poll = async () => {
            try {
                const data = await getOrder(orderId);
                if (!cancelled && data.status === "paid") {
                    setConfirmResult({ status: "paid", message: "Payment confirmed" });
                }
            } catch {
                // silently ignore poll errors
            }
        };

        const interval = setInterval(poll, 10_000);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [orderId, completed, confirmResult?.status]);

    if (loading) {
        return (
            <main className="min-h-screen px-4 py-8">
                <div className="organic-card mx-auto max-w-md rounded-3xl border border-[#cfc39f] p-7 text-center shadow-[0_22px_55px_rgba(61,89,50,0.12)]">
                    <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#5e4318]">Loading</p>
                    <h1 className="mt-2 text-2xl font-extrabold text-[#1f321b]">Fetching order...</h1>
                </div>
            </main>
        );
    }

    if (completed) {
        const isVetting = confirmResult?.status === "payment_pending";
        return (
            <main className="min-h-screen px-4 py-8">
                <div className="organic-card mx-auto max-w-md rounded-3xl border border-[#cfc39f] p-7 text-center shadow-[0_22px_55px_rgba(61,89,50,0.12)]">
                    <div
                        className={`mx-auto grid h-16 w-16 place-items-center rounded-full text-3xl ring-1 ${
                            isVetting
                                ? "bg-[#fff2c7] text-[#604513] ring-[#d8bd69]"
                                : "bg-[#dcefd1] text-[#2f6f2d] ring-[#b9d49f]"
                        }`}
                    >
                        {isVetting ? "⏳" : "✓"}
                    </div>
                    <p className="mt-5 text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#5e4318]">
                        {isVetting ? "Verifying payment" : "Payment confirmed"}
                    </p>
                    <h1 className="mt-2 text-2xl font-extrabold text-[#1f321b]">
                        {isVetting
                            ? "We're checking your transfer"
                            : "We are preparing your bowl"}
                    </h1>
                    <p className="mt-2 text-sm font-medium leading-relaxed text-[#68775a]">
                        {isVetting
                            ? "Your payment has been submitted. Our team will verify it within 15 minutes and confirm your order."
                            : "Your order has been received. Our chef will begin preparing your custom bowl shortly."}
                    </p>
                    <button
                        onClick={() => router.push("/build")}
                        className="mt-6 rounded-2xl bg-[#2f6f2d] px-5 py-3 text-sm font-bold text-white shadow-[0_12px_25px_rgba(47,111,45,0.28)]"
                    >
                        Build another bowl →
                    </button>
                </div>
            </main>
        );
    }

    if (error || !order) {
        return (
            <main className="min-h-screen px-4 py-8">
                <div className="organic-card mx-auto max-w-md rounded-3xl border border-[#cfc39f] p-7 text-center shadow-[0_22px_55px_rgba(61,89,50,0.12)]">
                    <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#5e4318]">Payment</p>
                    <h1 className="mt-2 text-2xl font-extrabold text-[#1f321b]">
                        {error ?? "Order not found"}
                    </h1>
                    <p className="mt-2 text-sm font-medium text-[#68775a]">
                        {!orderId
                            ? "Submit your order from the review page first."
                            : "Build a bowl first, then we will collect delivery details."}
                    </p>
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

    const isVietQr = order.delivery.payment_method === "vietqr";

    return (
        <main className="min-h-screen px-4 pb-10 pt-5">
            <div className="mx-auto max-w-5xl">
                <header className="mb-5 flex items-center justify-between gap-4">
                    <div>
                        <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#5e4318]">Payment</p>
                        <h1 className="text-2xl font-extrabold text-[#1f321b]">
                            {isVietQr ? "Scan to Pay" : "Cash on Delivery"}
                        </h1>
                        <p className="text-sm font-medium text-[#536342]">
                            {isVietQr
                                ? "Use your banking app to transfer the exact amount."
                                : "Your order will be paid when it arrives."}
                        </p>
                    </div>
                    <span className="rounded-full border border-[#cfc39f] bg-[#fffdf6] px-3 py-2 text-xs font-bold text-[#334b28] shadow-sm">
                        {order.order_id}
                    </span>
                </header>

                <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
                    <section className="organic-card rounded-3xl border border-[#cfc39f] p-4 shadow-[0_22px_55px_rgba(61,89,50,0.12)] lg:p-6">
                        {isVietQr ? (
                            <div className="grid gap-6 lg:grid-cols-[18rem_1fr] lg:items-center">
                                <div className="rounded-[2rem] border border-[#d8c98f] bg-[#fffdf6] p-5 shadow-inner">
                                    {order.qr_url ? (
                                        <img
                                            src={apiUrl(order.qr_url)}
                                            alt="VietQR payment code"
                                            className="mx-auto max-w-64 aspect-square rounded-2xl bg-white shadow-[0_18px_38px_rgba(34,58,22,0.14)]"
                                        />
                                    ) : (
                                        <div className="mx-auto grid aspect-square max-w-64 grid-cols-7 gap-1 rounded-2xl bg-white p-4 shadow-[0_18px_38px_rgba(34,58,22,0.14)]">
                                            {Array.from({ length: 49 }).map((_, index) => {
                                                const active =
                                                    index % 3 === 0 ||
                                                    index % 7 === 1 ||
                                                    [0, 1, 7, 8, 40, 41, 47, 48].includes(index);
                                                return (
                                                    <span
                                                        key={index}
                                                        className={`rounded-[3px] ${active ? "bg-[#1f321b]" : "bg-[#eef3e7]"}`}
                                                    />
                                                );
                                            })}
                                        </div>
                                    )}
                                    <p className="mt-4 text-center text-xs font-bold uppercase tracking-[0.14em] text-[#6d5019]">
                                        {order.qr_url ? "Scan with your banking app" : "Mock VietQR"}
                                    </p>
                                </div>

                                <div>
                                    <div className="rounded-3xl border border-[#d8c98f] bg-[#fff8da] p-5">
                                        <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6d5019]">Amount</div>
                                        <div className="mt-1 text-4xl font-extrabold text-[#1f321b]">
                                            {formatVnd(order.total_price)}
                                        </div>
                                        <div className="mt-3 rounded-2xl bg-[#fffdf6] p-3 text-sm font-extrabold text-[#1f321b] ring-1 ring-[#d8c98f]">
                                            Transfer note: {order.order_id}
                                        </div>
                                    </div>

                                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                        <div className="rounded-2xl border border-[#ded3ad] bg-[#fffdf6]/80 p-3">
                                            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6d5019]">Bank</div>
                                            <div className="mt-1 text-sm font-extrabold text-[#1f321b]">
                                                {order.bank_details?.bank_name ?? BANK_DETAILS.bankName}
                                            </div>
                                        </div>
                                        <div className="rounded-2xl border border-[#ded3ad] bg-[#fffdf6]/80 p-3">
                                            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6d5019]">Account</div>
                                            <div className="mt-1 text-sm font-extrabold text-[#1f321b]">
                                                {order.bank_details?.account_number ?? BANK_DETAILS.accountNumber}
                                            </div>
                                        </div>
                                        <div className="rounded-2xl border border-[#ded3ad] bg-[#fffdf6]/80 p-3 sm:col-span-2">
                                            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6d5019]">Account name</div>
                                            <div className="mt-1 text-sm font-extrabold text-[#1f321b]">
                                                {order.bank_details?.account_name ?? BANK_DETAILS.accountName}
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleConfirmPayment}
                                        disabled={confirming}
                                        className="mt-5 w-full rounded-2xl bg-[#2f6f2d] px-5 py-3.5 text-sm font-extrabold text-white shadow-[0_14px_30px_rgba(47,111,45,0.28)] transition hover:bg-[#245c24] active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-[#b6ad92] disabled:text-[#f7f0dc]"
                                    >
                                        {confirming ? "Confirming..." : "I have paid →"}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="mx-auto max-w-2xl text-center">
                                <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-[#fff2c7] text-4xl text-[#604513] ring-1 ring-[#d8bd69]">₫</div>
                                <p className="mt-5 text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#5e4318]">COD selected</p>
                                <h2 className="mt-2 text-3xl font-extrabold text-[#1f321b]">
                                    Pay {formatVnd(order.total_price)} on delivery
                                </h2>
                                <p className="mx-auto mt-2 max-w-md text-sm font-medium leading-relaxed text-[#68775a]">
                                    Please keep the exact amount ready if possible. We will confirm by phone if anything needs clarification.
                                </p>
                                <button
                                    onClick={handleConfirmPayment}
                                    disabled={confirming}
                                    className="mt-6 rounded-2xl bg-[#2f6f2d] px-6 py-3.5 text-sm font-extrabold text-white shadow-[0_14px_30px_rgba(47,111,45,0.28)] transition hover:bg-[#245c24] active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-[#b6ad92] disabled:text-[#f7f0dc]"
                                >
                                    {confirming ? "Confirming..." : "Confirm COD order →"}
                                </button>
                            </div>
                        )}
                        {confirmError && (
                            <p className="mt-4 text-center text-xs font-semibold text-[#a84828]">
                                {confirmError}
                            </p>
                        )}
                    </section>

                    <aside className="organic-card h-fit rounded-3xl border border-[#cfc39f] p-5 shadow-[0_22px_55px_rgba(61,89,50,0.1)] lg:sticky lg:top-5">
                        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#5e4318]">Delivery to</p>
                        <div className="mt-3 rounded-2xl border border-[#ded3ad] bg-[#fffdf6]/80 p-3">
                            <div className="text-sm font-extrabold text-[#1f321b]">{order.delivery.full_name}</div>
                            <div className="text-xs font-semibold text-[#68775a]">{order.delivery.phone}</div>
                            <div className="mt-2 text-xs font-bold leading-relaxed text-[#536342]">{order.delivery.address}</div>
                        </div>
                        <button
                            onClick={() => router.push(`/review?order_id=${orderId}`)}
                            className="mt-2 w-full rounded-2xl border border-[#cfc39f] bg-[#fffdf6] px-5 py-3 text-sm font-bold text-[#334b28] transition hover:border-[#8fae6e]"
                        >
                            Edit order
                        </button>
                        <Link
                            href={`/orders?order_id=${orderId}`}
                            className="mt-2 block w-full rounded-2xl border border-[#cfc39f] bg-[#fffdf6] px-5 py-3 text-center text-sm font-bold text-[#334b28] transition hover:border-[#8fae6e]"
                        >
                            View order
                        </Link>
                        <p className="mt-4 text-xs font-semibold leading-relaxed text-[#68775a]">
                            This checkout is processed by the FastAPI backend. QR codes are real VietQR when BANK_BIN is configured.
                        </p>
                    </aside>
                </div>
            </div>
        </main>
    );
}

export default function PaymentPage() {
    return (
        <Suspense
            fallback={
                <main className="min-h-screen px-4 py-8">
                    <div className="organic-card mx-auto max-w-md rounded-3xl border border-[#cfc39f] p-7 text-center">
                        <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#5e4318]">Loading</p>
                        <h1 className="mt-2 text-2xl font-extrabold text-[#1f321b]">Fetching order...</h1>
                    </div>
                </main>
            }
        >
            <PaymentContent />
        </Suspense>
    );
}
