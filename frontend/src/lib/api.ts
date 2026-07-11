import type { Component } from "./types";
import { API_BASE, apiFetch, ApiError } from "./api-client";

export interface MenuResponse {
  categories: Record<string, Component[]>;
}

export interface MealItemPayload {
  component_id: string;
  portion: number;
}

export interface DeliveryPayload {
  full_name: string;
  phone: string;
  address: string;
  notes: string;
  payment_method: "vietqr" | "cod";
}

export interface CreateOrderPayload {
  meal: Record<string, MealItemPayload[] | null>;
  delivery: DeliveryPayload;
}

export interface CreateOrderResponse {
  order_id: string;
  total_price: number;
  qr_url: string | null;
  bank_details: Record<string, string> | null;
  status: string;
}

export interface OrderStatusResponse {
  order_id: string;
  status: string;
  total_price: number;
  qr_url: string | null;
  bank_details: Record<string, string> | null;
  delivery: DeliveryPayload;
  meal: Record<string, MealItemPayload[] | null>;
}

export async function fetchMenu(): Promise<MenuResponse> {
  return apiFetch<MenuResponse>("/api/menu");
}

export async function fetchMenuCategory(
  category: string,
): Promise<Component[]> {
  return apiFetch<Component[]>(`/api/menu/${category}`);
}

export async function createOrder(
  payload: CreateOrderPayload,
): Promise<CreateOrderResponse> {
  return apiFetch<CreateOrderResponse>("/api/orders", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getOrder(
  orderId: string,
): Promise<OrderStatusResponse> {
  return apiFetch<OrderStatusResponse>(`/api/orders/${orderId}`);
}

export async function confirmPayment(orderId: string): Promise<{
  order_id: string;
  status: string;
  message: string;
}> {
  return apiFetch(`/api/orders/${orderId}/confirm-payment`, {
    method: "POST",
  });
}

export async function updateOrder(
  orderId: string,
  payload: CreateOrderPayload,
): Promise<OrderStatusResponse> {
  return apiFetch<OrderStatusResponse>(`/api/orders/${orderId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

// ── Staff dashboard ──────────────────────────────────────────────────

const TOKEN_KEY = "pureorganic.staff.token";

export function getStaffToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setStaffToken(token: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearStaffToken(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
}

async function staffFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const token = getStaffToken();
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });

  if (!res.ok) {
    let detail: unknown;
    try {
      detail = await res.json();
    } catch {
      detail = await res.text();
    }
    throw new ApiError(res.status, detail);
  }

  return res.json() as Promise<T>;
}

export interface StaffOrderSummary {
  order_id: string;
  status: string;
  payment_method: string;
  total_price: number;
  total_price_vnd: string;
  full_name: string;
  phone: string;
  address: string;
  notes: string;
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
  items_summary: string;
  qr_url: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface StaffOrderListResponse {
  orders: StaffOrderSummary[];
  total: number;
  limit: number;
  offset: number;
}

export async function staffLogin(password: string): Promise<{ token: string }> {
  return apiFetch<{ token: string }>("/api/staff/login", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

export async function fetchStaffOrders(params: {
  status?: string;
  q?: string;
  limit?: number;
  offset?: number;
}): Promise<StaffOrderListResponse> {
  const searchParams = new URLSearchParams();
  if (params.status) searchParams.set("status", params.status);
  if (params.q) searchParams.set("q", params.q);
  if (params.limit != null) searchParams.set("limit", String(params.limit));
  if (params.offset != null) searchParams.set("offset", String(params.offset));
  const qs = searchParams.toString();
  return staffFetch<StaffOrderListResponse>(
    `/api/staff/orders${qs ? `?${qs}` : ""}`,
  );
}

export async function staffConfirmPayment(orderId: string): Promise<{
  order_id: string;
  status: string;
  message: string;
}> {
  return staffFetch(`/api/staff/orders/${orderId}/confirm`, {
    method: "POST",
  });
}

export interface StaffOrderDetail {
  order_id: string;
  status: string;
  payment_method: string;
  total_price: number;
  total_price_vnd: string;
  full_name: string;
  phone: string;
  address: string;
  notes: string;
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
  qr_url: string | null;
  paid_at: string | null;
  created_at: string;
  items: Array<{
    category: string;
    component_id: string;
    component_name: string;
    portion: number;
    unit: string;
    cost: number;
  }>;
}

export async function fetchStaffOrderDetail(
  orderId: string,
): Promise<StaffOrderDetail> {
  return staffFetch<StaffOrderDetail>(`/api/staff/orders/${orderId}`);
}
