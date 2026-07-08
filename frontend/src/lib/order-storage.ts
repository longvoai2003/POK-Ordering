import type { Macros, Meal } from "./types";

const ORDER_STORAGE_KEY = "pureorganic.checkout.v1";
const CUSTOMER_DETAILS_KEY = "pureorganic.customer-details.v1";

export type PaymentMethod = "vietqr" | "cod";

export interface DeliveryDetails {
  fullName: string;
  phone: string;
  address: string;
  notes: string;
  paymentMethod: PaymentMethod;
}

export interface CustomerDetails {
  fullName: string;
  phone: string;
  address: string;
}

export interface CheckoutOrder {
  meal: Meal;
  macros: Macros;
  totalPrice: number;
  details: DeliveryDetails | null;
  createdAt: string;
}

export const EMPTY_DETAILS: DeliveryDetails = {
  fullName: "",
  phone: "",
  address: "",
  notes: "",
  paymentMethod: "vietqr",
};

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function saveCheckoutOrder(order: CheckoutOrder): void {
  if (!canUseStorage()) return;
  window.localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(order));
}

export function loadCheckoutOrder(): CheckoutOrder | null {
  if (!canUseStorage()) return null;
  const raw = window.localStorage.getItem(ORDER_STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as CheckoutOrder;
  } catch {
    window.localStorage.removeItem(ORDER_STORAGE_KEY);
    return null;
  }
}

export function updateCheckoutOrder(patch: Partial<CheckoutOrder>): CheckoutOrder | null {
  const current = loadCheckoutOrder();
  if (!current) return null;
  const next = { ...current, ...patch };
  saveCheckoutOrder(next);
  return next;
}

export function clearCheckoutOrder(): void {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(ORDER_STORAGE_KEY);
}

export function saveCustomerDetails(details: CustomerDetails): void {
  if (!canUseStorage()) return;
  window.localStorage.setItem(CUSTOMER_DETAILS_KEY, JSON.stringify(details));
}

export function loadCustomerDetails(): CustomerDetails | null {
  if (!canUseStorage()) return null;
  const raw = window.localStorage.getItem(CUSTOMER_DETAILS_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as CustomerDetails;
  } catch {
    window.localStorage.removeItem(CUSTOMER_DETAILS_KEY);
    return null;
  }
}

// ── Recent orders (status check page) ──────────────────────────────

const RECENT_ORDERS_KEY = "pureorganic.recent-orders.v1";
const MAX_RECENT = 20;
const MAX_AGE_DAYS = 30;

export interface RecentOrder {
  orderId: string;
  date: string;
  amount: number;
  paymentMethod: PaymentMethod;
}

export function saveRecentOrder(order: RecentOrder): void {
  if (!canUseStorage()) return;
  const raw = window.localStorage.getItem(RECENT_ORDERS_KEY);
  let orders: RecentOrder[] = [];
  if (raw) {
    try {
      orders = JSON.parse(raw);
    } catch {
      orders = [];
    }
  }

  const dedupe = orders.filter((o) => o.orderId !== order.orderId);
  dedupe.unshift(order);

  const cutoff = Date.now() - MAX_AGE_DAYS * 86400000;
  const trimmed = dedupe
    .filter((o) => new Date(o.date).getTime() > cutoff)
    .slice(0, MAX_RECENT);

  window.localStorage.setItem(RECENT_ORDERS_KEY, JSON.stringify(trimmed));
}

export function getRecentOrders(): RecentOrder[] {
  if (!canUseStorage()) return [];
  const raw = window.localStorage.getItem(RECENT_ORDERS_KEY);
  if (!raw) return [];
  try {
    const orders: RecentOrder[] = JSON.parse(raw);
    const cutoff = Date.now() - MAX_AGE_DAYS * 86400000;
    return orders.filter((o) => new Date(o.date).getTime() > cutoff);
  } catch {
    return [];
  }
}
