"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
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
} from "@/lib/constants";
import type { Component, Meal, Macros, SelectedIngredient } from "@/lib/types";
import { calculateMealPrice } from "@/lib/pricing";
import { loadCheckoutOrder, saveCheckoutOrder } from "@/lib/order-storage";
import { fetchMenu } from "@/lib/api";
import { MenuLoadingSkeleton } from "@/components/MenuLoadingSkeleton";

function initMeal(saved?: Meal): Meal {
    const meal: Meal = {};
    for (const cat of CATEGORY_DISPLAY_ORDER) {
        meal[cat] = saved?.[cat] ?? [];
    }
    return meal;
}

export default function BuildPage() {
    const router = useRouter();

    const [meal, setMeal] = useState<Meal>(() => initMeal());
    const [activeByCategory, setActiveByCategory] = useState<Record<string, string | null>>({});
    const [showOptionals, setShowOptionals] = useState(false);
    const [menuData, setMenuData] = useState<Record<string, Component[]>>(MOCK_COMPONENTS);
    const [menuLoading, setMenuLoading] = useState(true);
    const [menuError, setMenuError] = useState(false);

    useEffect(() => {
        const saved = loadCheckoutOrder();
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
    }, []);

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

    const handleSelect = useCallback((component: Component) => {
        const cat = component.category;
        const isMulti = MULTI_SELECT_CATEGORIES.includes(cat);

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
        const existingOrder = loadCheckoutOrder();
        saveCheckoutOrder({
            meal,
            macros,
            totalPrice: calculateMealPrice(meal),
            details: existingOrder?.details ?? null,
            createdAt: existingOrder?.createdAt ?? new Date().toISOString(),
        });
        router.push("/details");
    }, [router, meal, macros]);

    const requiredComplete = REQUIRED_CATEGORIES.every(
        (cat) => (meal[cat] ?? []).length > 0,
    );

    return (
        <main className="min-h-screen pb-40 lg:pb-10">
            {/* Header */}
            <div className="sticky top-0 z-10 border-b border-[#cfc39f]/90 bg-[#fbf7ea]/92 backdrop-blur-xl">
                <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
                    <div>
                        <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#5e4318]">
                            PureOrganic
                        </p>
                        <h1 className="text-lg font-extrabold text-[#1f321b]">
                            Build Your Bowl
                        </h1>
                        <p className="text-xs font-medium text-[#536342]">
                            {menuLoading
                                ? "Loading menu..."
                                : menuError
                                    ? "Offline — using cached menu"
                                    : requiredComplete
                                        ? "All set! Continue below"
                                        : "Pick one from each required category"}
                        </p>
                    </div>

                    {/* Progress dots */}
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
                </div>
            </div>

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
