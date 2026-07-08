"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  EMPTY_DETAILS,
  type CheckoutOrder,
  type DeliveryDetails,
  loadCustomerDetails,
  loadCheckoutOrder,
  saveCustomerDetails,
  updateCheckoutOrder,
} from "@/lib/order-storage";
import { formatVnd } from "@/lib/pricing";

export default function DetailsPage() {
  const router = useRouter();
  const [order, setOrder] = useState<CheckoutOrder | null>(null);
  const [details, setDetails] = useState<DeliveryDetails>(EMPTY_DETAILS);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const saved = loadCheckoutOrder();
    const savedCustomer = loadCustomerDetails();
    setOrder(saved);
    if (saved?.details) {
      setDetails(saved.details);
    } else if (savedCustomer) {
      setDetails((prev) => ({
        ...prev,
        fullName: savedCustomer.fullName,
        phone: savedCustomer.phone,
        address: savedCustomer.address,
      }));
    }
  }, []);

  const hasBowl = order != null && Object.values(order.meal).some(Boolean);
  const isValid =
    details.fullName.trim().length > 1 &&
    details.phone.trim().length >= 8 &&
    details.address.trim().length > 5;

  const updateField = (field: keyof DeliveryDetails, value: string) => {
    setDetails((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    if (!isValid) return;
    saveCustomerDetails({
      fullName: details.fullName,
      phone: details.phone,
      address: details.address,
    });
    const next = updateCheckoutOrder({ details });
    if (next) router.push("/review");
  };

  if (!hasBowl) {
    return (
      <main className="min-h-screen px-4 py-8">
        <div className="organic-card mx-auto max-w-md rounded-3xl border border-[#cfc39f] p-7 text-center shadow-[0_22px_55px_rgba(61,89,50,0.12)]">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#5e4318]">PureOrganic</p>
          <h1 className="mt-2 text-2xl font-extrabold text-[#1f321b]">No bowl yet</h1>
          <p className="mt-2 text-sm font-medium text-[#68775a]">
            Build your bowl first, then we will collect delivery details.
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

  return (
    <main className="min-h-screen px-4 pb-10 pt-5">
      <div className="mx-auto max-w-5xl">
        <header className="mb-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#5e4318]">Checkout</p>
            <h1 className="text-2xl font-extrabold text-[#1f321b]">Delivery Details</h1>
            <p className="text-sm font-medium text-[#536342]">Tell us where to send your custom bowl.</p>
          </div>
          <button
            onClick={() => router.push("/build")}
            className="rounded-full border border-[#cfc39f] bg-[#fffdf6] px-3 py-2 text-xs font-bold text-[#334b28] shadow-sm"
          >
            Edit bowl
          </button>
        </header>

        <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
          <form onSubmit={handleSubmit} className="organic-card rounded-3xl border border-[#cfc39f] p-4 shadow-[0_22px_55px_rgba(61,89,50,0.12)] lg:p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-1">
                <span className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#5e4318]">Full name</span>
                <input
                  value={details.fullName}
                  onChange={(event) => updateField("fullName", event.target.value)}
                  placeholder="Nguyen An"
                  className="mt-2 w-full rounded-2xl border border-[#cfc39f] bg-[#fffdf6] px-4 py-3 text-sm font-semibold text-[#1f321b] outline-none transition focus:border-[#2f6f2d] focus:ring-4 focus:ring-[#dcefd1]"
                />
                {submitted && details.fullName.trim().length <= 1 && (
                  <span className="mt-1 block text-xs font-semibold text-[#a84828]">Please enter your name.</span>
                )}
              </label>

              <label className="block sm:col-span-1">
                <span className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#5e4318]">Phone</span>
                <input
                  value={details.phone}
                  onChange={(event) => updateField("phone", event.target.value)}
                  placeholder="090 123 4567"
                  className="mt-2 w-full rounded-2xl border border-[#cfc39f] bg-[#fffdf6] px-4 py-3 text-sm font-semibold text-[#1f321b] outline-none transition focus:border-[#2f6f2d] focus:ring-4 focus:ring-[#dcefd1]"
                />
                {submitted && details.phone.trim().length < 8 && (
                  <span className="mt-1 block text-xs font-semibold text-[#a84828]">Please enter a valid phone number.</span>
                )}
              </label>

              <label className="block sm:col-span-2">
                <span className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#5e4318]">Delivery address</span>
                <textarea
                  value={details.address}
                  onChange={(event) => updateField("address", event.target.value)}
                  placeholder="Apartment, street, ward, district..."
                  rows={4}
                  className="mt-2 w-full resize-none rounded-2xl border border-[#cfc39f] bg-[#fffdf6] px-4 py-3 text-sm font-semibold text-[#1f321b] outline-none transition focus:border-[#2f6f2d] focus:ring-4 focus:ring-[#dcefd1]"
                />
                {submitted && details.address.trim().length <= 5 && (
                  <span className="mt-1 block text-xs font-semibold text-[#a84828]">Please enter your delivery address.</span>
                )}
              </label>

              <label className="block sm:col-span-2">
                <span className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#5e4318]">Notes</span>
                <textarea
                  value={details.notes}
                  onChange={(event) => updateField("notes", event.target.value)}
                  placeholder="Gate code, allergies, no plastic cutlery..."
                  rows={3}
                  className="mt-2 w-full resize-none rounded-2xl border border-[#cfc39f] bg-[#fffdf6] px-4 py-3 text-sm font-semibold text-[#1f321b] outline-none transition focus:border-[#2f6f2d] focus:ring-4 focus:ring-[#dcefd1]"
                />
              </label>
            </div>

            <div className="mt-5">
              <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#5e4318]">Payment method</p>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                {[
                  ["vietqr", "VietQR transfer", "Fast bank transfer with QR code."],
                  ["cod", "Cash on delivery", "Pay when your bowl arrives."],
                ].map(([value, title, description]) => (
                  <label
                    key={value}
                    className={`cursor-pointer rounded-2xl border p-4 transition ${
                      details.paymentMethod === value
                        ? "border-[#2f6f2d] bg-[#e8f4dd] shadow-[0_14px_30px_rgba(47,111,45,0.16)]"
                        : "border-[#cfc39f] bg-[#fffdf6] hover:border-[#8fae6e]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={value}
                      checked={details.paymentMethod === value}
                      onChange={() => updateField("paymentMethod", value)}
                      className="sr-only"
                    />
                    <span className="block text-sm font-extrabold text-[#1f321b]">{title}</span>
                    <span className="mt-1 block text-xs font-semibold text-[#68775a]">{description}</span>
                  </label>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="mt-6 w-full rounded-2xl bg-[#2f6f2d] px-5 py-3.5 text-sm font-extrabold text-white shadow-[0_14px_30px_rgba(47,111,45,0.28)] transition hover:bg-[#245c24] active:scale-[0.99]"
            >
              Review order →
            </button>
          </form>

          <aside className="organic-card h-fit rounded-3xl border border-[#cfc39f] p-5 shadow-[0_22px_55px_rgba(61,89,50,0.1)]">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#5e4318]">Order</p>
            <div className="mt-3 rounded-2xl border border-[#d8c98f] bg-[#fff8da] p-4">
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6d5019]">Total</div>
              <div className="mt-1 text-3xl font-extrabold text-[#1f321b]">{formatVnd(order.totalPrice)}</div>
            </div>
            <div className="mt-4 grid grid-cols-4 gap-1 text-center text-xs">
              <div><div className="font-extrabold text-[#1f321b]">{order.macros.calories}</div><div className="font-semibold text-[#6f654a]">cal</div></div>
              <div><div className="font-extrabold text-[#1f321b]">{order.macros.protein}g</div><div className="font-semibold text-[#6f654a]">protein</div></div>
              <div><div className="font-extrabold text-[#1f321b]">{order.macros.carbs}g</div><div className="font-semibold text-[#6f654a]">carbs</div></div>
              <div><div className="font-extrabold text-[#1f321b]">{order.macros.fat}g</div><div className="font-semibold text-[#6f654a]">fat</div></div>
            </div>
            <p className="mt-4 text-xs font-semibold leading-relaxed text-[#68775a]">
              This checkout is mocked locally for now. Backend order creation will replace localStorage later.
            </p>
          </aside>
        </div>
      </div>
    </main>
  );
}
