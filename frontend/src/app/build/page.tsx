"use client";

import { useState, useMemo, useCallback, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CategorySection } from "@/components/CategorySection";
import { BowlSummary } from "@/components/BowlSummary";
import { MOCK_COMPONENTS } from "@/lib/mock-data";
import {
    CATEGORY_DISPLAY_ORDER,
    REQUIRED_CATEGORIES,
    OPTIONAL_CATEGORIES,
    CATEGORY_LABELS,
    CATEGORY_ICONS,
    MULTI_SELECT_CATEGORIES,
    CATEGORY_MAX_ITEMS,
} from "@/lib/constants";
import type { Component, Meal, Macros, SelectedIngredient } from "@/lib/types";
import type { CheckoutOrder } from "@/lib/order-storage";
import { calculateMealPrice } from "@/lib/pricing";
import { loadCreateCheckoutOrder, loadEditCheckoutOrder, saveCheckoutOrder, getRecentOrders } from "@/lib/order-storage";
import { fetchMenu, getOrder } from "@/lib/api";
import { ApiError } from "@/lib/api-client";
import { MenuLoadingSkeleton } from "@/components/MenuLoadingSkeleton";

function initMeal(saved?: Meal): Meal {
    const meal: Meal = {};
    for (const cat of CATEGORY_DISPLAY_ORDER) {
        meal[cat] = saved?.[cat] ?? [];
    }
    return meal;
}

export default function BuildPage() {
    return (
        <Suspense
            fallback={
                <main className="min-h-screen pb-40 lg:pb-10">
                    <MenuLoadingSkeleton />
                </main>
            }
        >
            <BuildPageContent />
        </Suspense>
    );
}

function BuildPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const editOrderId = searchParams.get("order_id");

    const [meal, setMeal] = useState<Meal>(() => initMeal());
    const [activeByCategory, setActiveByCategory] = useState<Record<string, string | null>>({});
    const [showOptionals, setShowOptionals] = useState(false);
    const [menuData, setMenuData] = useState<Record<string, Component[]>>(MOCK_COMPONENTS);
    const [menuLoading, setMenuLoading] = useState(true);
    const [menuError, setMenuError] = useState(false);
    const [orderStatuses, setOrderStatuses] = useState<{ orderId: string; status: string }[]>([]);
    const [toast, setToast] = useState<string | null>(null);
    const mealRef = useRef(meal);
    mealRef.current = meal;

    useEffect(() => {
        const recent = getRecentOrders();
        if (recent.length === 0) return;

        let cancelled = false;
        let timer: ReturnType<typeof setTimeout> | null = null;
        let prevKey = "";

        const fetchStatuses = async () => {
            const targets = recent.slice(0, 3);
            const settled = await Promise.allSettled(
                targets.map((r) => getOrder(r.orderId)),
            );
            if (cancelled) return;

            const results: { orderId: string; status: string }[] = [];
            for (let i = 0; i < targets.length; i++) {
                const s = settled[i];
                if (s.status === "fulfilled") {
                    results.push({ orderId: targets[i].orderId, status: s.value.status });
                } else if (!(s.reason instanceof ApiError && s.reason.status === 404)) {
                    results.push({ orderId: targets[i].orderId, status: "unknown" });
                }
            }

            const key = results.map((r) => `${r.orderId}:${r.status}`).join(",");
            if (key !== prevKey) {
                prevKey = key;
                setOrderStatuses(results);
            }

            if (results.some((r) => r.status === "pending" || r.status === "payment_pending")) {
                timer = setTimeout(fetchStatuses, 30_000);
            }
        };

        timer = setTimeout(fetchStatuses, 2_000);
        return () => {
            cancelled = true;
            if (timer) clearTimeout(timer);
        };
    }, []);

    useEffect(() => {
        const saved = editOrderId
            ? loadEditCheckoutOrder(editOrderId)
            : loadCreateCheckoutOrder();
        if (saved?.meal) {
            setMeal(initMeal(saved.meal));
            setShowOptionals(
                OPTIONAL_CATEGORIES.some(
                    (cat) => (saved.meal[cat] ?? []).length > 0,
                ),
            );
            const active: Record<string, string | null> = {};
            for (const cat of CATEGORY_DISPLAY_ORDER) {
                const items = saved.meal[cat] ?? [];
                active[cat] = items.length > 0 ? items[0].component.component_id : null;
            }
            setActiveByCategory(active);
        }
    }, [editOrderId]);

    useEffect(() => {
        let cancelled = false;
        fetchMenu()
            .then((res) => {
                if (!cancelled) {
                    setMenuData(res.categories);
                    setMenuLoading(false);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setMenuError(true);
                    setMenuLoading(false);
                }
            });
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        if (!editOrderId) return;
        if (loadEditCheckoutOrder(editOrderId)) return;
        let cancelled = false;
        getOrder(editOrderId)
            .then((data) => {
                if (cancelled) return;
                const nextMeal: Meal = {};
                const nextActive: Record<string, string | null> = {};
                for (const cat of CATEGORY_DISPLAY_ORDER) {
                    nextMeal[cat] = [];
                }
                for (const cat of CATEGORY_DISPLAY_ORDER) {
                    const items = data.meal[cat] ?? [];
                    for (const item of items) {
                        const comp = menuData[cat]?.find((c) => c.component_id === item.component_id);
                        if (!comp) continue;
                        nextMeal[cat] = [...(nextMeal[cat] ?? []), { component: comp, portion: item.portion } as SelectedIngredient];
                        if (nextActive[cat] == null) nextActive[cat] = item.component_id;
                    }
                }
                setMeal(nextMeal);
                setActiveByCategory(nextActive);
                setShowOptionals(OPTIONAL_CATEGORIES.some((cat) => (nextMeal[cat] ?? []).length > 0));
                if (data.delivery) {
                    const nextOrder = {
                        meal: nextMeal,
                        macros: { calories: 0, protein: 0, carbs: 0, fat: 0 },
                        totalPrice: data.total_price,
                        details: {
                            fullName: data.delivery.full_name,
                            phone: data.delivery.phone,
                            address: data.delivery.address,
                            notes: data.delivery.notes,
                            paymentMethod: data.delivery.payment_method,
                        },
                        createdAt: new Date().toISOString(),
                        orderId: editOrderId,
                        source: "server" as const,
                    };
                    saveCheckoutOrder(nextOrder);
                }
            })
            .catch(() => {});
        return () => { cancelled = true; };
    }, [editOrderId, menuData]);

    const handleSelect = useCallback((component: Component) => {
        const cat = component.category;
        const isMulti = MULTI_SELECT_CATEGORIES.includes(cat);

        const currentItems = mealRef.current[cat] ?? [];
        const alreadySelected = currentItems.some(
            (s) => s.component.component_id === component.component_id,
        );

        if (isMulti && !alreadySelected) {
            const maxItems = CATEGORY_MAX_ITEMS[cat as keyof typeof CATEGORY_MAX_ITEMS];
            if (maxItems && currentItems.length >= maxItems) {
                const label = CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS];
                setToast(`Max ${maxItems} items in ${label}`);
                setTimeout(() => setToast(null), 2500);
                return;
            }
        }

        setMeal((prev) => {
            const items = prev[cat] ?? [];
            const idx = items.findIndex(
                (s) => s.component.component_id === component.component_id,
            );

            if (isMulti) {
                if (idx >= 0) {
                    setActiveByCategory((a) => ({ ...a, [cat]: component.component_id }));
                    return prev;
                }
                setActiveByCategory((a) => ({ ...a, [cat]: component.component_id }));
                return {
                    ...prev,
                    [cat]: [
                        ...items,
                        { component, portion: component.default_portion } as SelectedIngredient,
                    ],
                };
            }

            if (idx >= 0) {
                setActiveByCategory((a) => ({ ...a, [cat]: component.component_id }));
                return prev;
            }
            setActiveByCategory((a) => ({ ...a, [cat]: component.component_id }));
            return {
                ...prev,
                [cat]: [
                    { component, portion: component.default_portion } as SelectedIngredient,
                ],
            };
        });
    }, []);

    const handlePortionChange = useCallback(
        (componentId: string, portion: number) => {
            setMeal((prev) => {
                const next = { ...prev };
                for (const cat of CATEGORY_DISPLAY_ORDER) {
                    const items = next[cat] ?? [];
                    const idx = items.findIndex(
                        (s) => s.component.component_id === componentId,
                    );
                    if (idx >= 0) {
                        next[cat] = [
                            ...items.slice(0, idx),
                            { ...items[idx], portion },
                            ...items.slice(idx + 1),
                        ];
                        return next;
                    }
                }
                return prev;
            });
        },
        [],
    );

    const handleUnselect = useCallback((componentId: string, category: string) => {
        setMeal((prev) => {
            const items = prev[category] ?? [];
            const filtered = items.filter((s) => s.component.component_id !== componentId);

            setActiveByCategory((actPrev) => {
                if (actPrev[category] === componentId) {
                    return {
                        ...actPrev,
                        [category]: filtered.length > 0 ? filtered[0].component.component_id : null,
                    };
                }
                return actPrev;
            });

            return { ...prev, [category]: filtered };
        });
    }, []);

    const handleClear = useCallback(() => {
        setMeal(initMeal());
        setActiveByCategory({});
    }, []);

    const macros = useMemo((): Macros => {
        let calories = 0,
            protein = 0,
            carbs = 0,
            fat = 0;
        for (const cat of CATEGORY_DISPLAY_ORDER) {
            for (const sel of meal[cat] ?? []) {
                const ratio = sel.portion / sel.component.default_portion;
                calories += sel.component.calories * ratio;
                protein += sel.component.protein * ratio;
                carbs += sel.component.carbs * ratio;
                fat += sel.component.fat * ratio;
            }
        }
        return {
            calories: Math.round(calories),
            protein: Math.round(protein * 10) / 10,
            carbs: Math.round(carbs * 10) / 10,
            fat: Math.round(fat * 10) / 10,
        };
    }, [meal]);

    const handleContinue = useCallback(() => {
        const existingOrder = editOrderId
            ? loadEditCheckoutOrder(editOrderId)
            : loadCreateCheckoutOrder();
        const currentOrderId = editOrderId ?? undefined;
        const nextOrder: CheckoutOrder = {
            meal,
            macros,
            totalPrice: calculateMealPrice(meal),
            details: existingOrder?.details ?? null,
            createdAt: existingOrder?.createdAt ?? new Date().toISOString(),
            orderId: currentOrderId,
            source: editOrderId ? "server" : "draft",
        };

        saveCheckoutOrder(nextOrder);
        const detailsPath = currentOrderId
            ? `/details?order_id=${currentOrderId}`
            : "/details";
        router.push(detailsPath);
    }, [router, meal, macros, editOrderId]);

    const requiredComplete = REQUIRED_CATEGORIES.every(
        (cat) => (meal[cat] ?? []).length > 0,
    );

    const pendingCount = orderStatuses.filter((s) => s.status === "pending").length;
    const verifyingCount = orderStatuses.filter((s) => s.status === "payment_pending").length;
    const needsPayment = pendingCount + verifyingCount;
    const paidCount = orderStatuses.filter((s) => s.status === "paid").length;
    const firstPending = orderStatuses.find(
        (s) => s.status === "pending" || s.status === "payment_pending",
    );

    const showSinglePending = needsPayment === 1 && firstPending && orderStatuses.length <= 3;
    const ordersHref = showSinglePending
        ? `/payment?order_id=${firstPending!.orderId}`
        : "/orders";

    return (
        <main className="min-h-screen pb-40 lg:pb-10">
            {/* Header */}
            <div className="sticky top-0 z-10 border-b border-[#cfc39f]/90 bg-[#fbf7ea]">
                <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
                    <div>
                        <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#5e4318]">
                            PureOrganic
                        </p>
                        <h1 className="text-lg font-extrabold text-[#1f321b]">
                            Build Your Bowl
                        </h1>
                    </div>

                    {/* Progress dots + Orders button */}
                    <div className="flex items-center gap-3">
                        <div className="flex gap-1.5">
                            {CATEGORY_DISPLAY_ORDER.map((cat) => (
                                <div
                                    key={cat}
                                    className={`w-2 h-2 rounded-full transition-colors ${(meal[cat] ?? []).length > 0 ? "bg-[#2f6f2d]" : "bg-[#bbae86]"
                                        }`}
                                    title={CATEGORY_LABELS[cat]}
                                />
                            ))}
                        </div>

                        {orderStatuses.length > 0 ? (
                            showSinglePending ? (
                                <Link
                                    href={ordersHref}
                                    className="rounded-full border border-[#d8bd69] bg-[#fff2c7] px-3 py-1.5 text-[11px] font-extrabold text-[#604513] transition hover:bg-[#ffe5a8] active:scale-95"
                                >
                                    {firstPending!.status === "payment_pending"
                                        ? "Verifying..."
                                        : "Complete Payment →"}
                                </Link>
                            ) : needsPayment > 0 ? (
                                <Link
                                    href={ordersHref}
                                    className="rounded-full border border-[#d8bd69] bg-[#fff2c7] px-3 py-1.5 text-[11px] font-extrabold text-[#604513] transition hover:bg-[#ffe5a8] active:scale-95"
                                >
                                    {needsPayment} to pay
                                </Link>
                            ) : paidCount > 0 ? (
                                <Link
                                    href={ordersHref}
                                    className="rounded-full border border-[#b9d49f] bg-[#dcefd1] px-3 py-1.5 text-[11px] font-extrabold text-[#2f6f2d] transition hover:bg-[#c8e0bc] active:scale-95"
                                >
                                    Orders ✓
                                </Link>
                            ) : null
                        ) : (
                            <Link
                                href="/orders"
                                className="rounded-full border border-[#cfc39f] bg-[#fffdf6] px-3 py-1.5 text-[11px] font-bold text-[#536342] transition hover:border-[#8fae6e] active:scale-95"
                            >
                                My Orders
                            </Link>
                        )}
                    </div>
                </div>
            </div>

            {/* Toast notification */}
            {toast && (
                <div className="pointer-events-none fixed left-1/2 top-4 z-50 -translate-x-1/2 transition-all duration-300 animate-in fade-in slide-in-from-top-4">
                    <div className="rounded-full bg-[#1f321b] px-5 py-2.5 text-sm font-bold text-[#fff2c7] shadow-[0_10px_30px_rgba(31,50,27,0.35)] ring-1 ring-[#d8bd69]/40">
                        {toast}
                    </div>
                </div>
            )}

            {/* Main content area */}
            <div className="max-w-5xl mx-auto lg:flex lg:gap-6">
                {/* Left: Category sections */}
                {menuLoading ? (
                    <MenuLoadingSkeleton />
                ) : (
                    <div className="flex-1 min-w-0 px-4 pt-4 lg:pt-6">
                        {/* Required categories */}
                        {REQUIRED_CATEGORIES.map((cat) => {
                            const comps = menuData[cat] || [];
                            return (
                                <CategorySection
                                    key={cat}
                                    categoryKey={cat}
                                    categoryLabel={CATEGORY_LABELS[cat]}
                                    icon={CATEGORY_ICONS[cat]}
                                    components={comps}
                                    selected={meal[cat] ?? []}
                                    activeComponentId={activeByCategory[cat] ?? null}
                                    isRequired={true}
                                    maxItems={CATEGORY_MAX_ITEMS[cat as keyof typeof CATEGORY_MAX_ITEMS]}
                                    onSelect={handleSelect}
                                    onPortionChange={handlePortionChange}
                                    onUnselect={handleUnselect}
                                />
                            );
                        })}

                        {/* Optional categories toggle */}
                        <button
                            onClick={() => setShowOptionals(!showOptionals)}
                            className="organic-card flex items-center gap-2 w-full rounded-2xl border border-[#cfc39f] px-4 py-3 mb-5 text-left text-sm font-bold text-[#334b28] transition-all hover:border-[#8fae6e] hover:shadow-[0_14px_30px_rgba(74,89,50,0.14)]"
                        >
                            <span className={`transition-transform ${showOptionals ? "rotate-90" : ""}`}>
                                ▸
                            </span>
                            {showOptionals ? "Hide extras" : "Add more"}
                            {!showOptionals && (
                                <span className="text-xs font-semibold text-[#6f654a] ml-1">
                                    (raw veg, toppings, egg, oil)
                                </span>
                            )}
                        </button>

                        {/* Optional categories */}
                        {showOptionals &&
                            OPTIONAL_CATEGORIES.map((cat) => {
                                const comps = menuData[cat] || [];
                                return (
                                    <CategorySection
                                        key={cat}
                                        categoryKey={cat}
                                        categoryLabel={CATEGORY_LABELS[cat]}
                                        icon={CATEGORY_ICONS[cat]}
                                        components={comps}
                                        selected={meal[cat] ?? []}
                                        activeComponentId={activeByCategory[cat] ?? null}
                                        isRequired={false}
                                        maxItems={CATEGORY_MAX_ITEMS[cat as keyof typeof CATEGORY_MAX_ITEMS]}
                                        onSelect={handleSelect}
                                        onPortionChange={handlePortionChange}
                                        onUnselect={handleUnselect}
                                    />
                                );
                            })}
                    </div>
                )}

                {/* Right: Bowl Summary (desktop sidebar) */}
                <div className="hidden lg:block w-72 pt-6">
                    <div className="sticky top-16">
                        <BowlSummary
                            meal={meal}
                            macros={macros}
                            onClear={handleClear}
                            onContinue={handleContinue}
                        />
                    </div>
                </div>
            </div>

            {/* Mobile: bottom fixed bar */}
            <div className="lg:hidden fixed bottom-0 left-0 right-0 z-20">
                <BowlSummary
                    meal={meal}
                    macros={macros}
                    onClear={handleClear}
                    onContinue={handleContinue}
                />
            </div>
        </main>
    );
}
