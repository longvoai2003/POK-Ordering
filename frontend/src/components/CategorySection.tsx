"use client";

import { memo, useRef } from "react";
import { type Component, type SelectedIngredient } from "@/lib/types";
import { FIXED_PRICE_CATEGORIES, MULTI_SELECT_CATEGORIES } from "@/lib/constants";
import { IngredientCard } from "./IngredientCard";
import { SnappingSlider } from "./SnappingSlider";
import { calculateIngredientPrice, formatVnd } from "@/lib/pricing";

interface CategorySectionProps {
    categoryKey: string;
    categoryLabel: string;
    icon: string;
    components: Component[];
    selected: SelectedIngredient[];
    activeComponentId: string | null;
    isRequired: boolean;
    maxItems?: number;
    onSelect: (component: Component) => void;
    onPortionChange: (componentId: string, portion: number) => void;
    onUnselect: (componentId: string, category: string) => void;
}

export const CategorySection = memo(function CategorySection({
    categoryKey,
    categoryLabel,
    icon,
    components,
    selected,
    activeComponentId,
    isRequired,
    maxItems,
    onSelect,
    onPortionChange,
    onUnselect,
}: CategorySectionProps) {
    const scrollerRef = useRef<HTMLDivElement>(null);
    const isFixedPrice = FIXED_PRICE_CATEGORIES.includes(categoryKey as never);
    const isMulti = MULTI_SELECT_CATEGORIES.includes(categoryKey as never);
    const selectedMap = new Map(selected.map((s) => [s.component.component_id, s]));
    const totalPrice = selected.reduce((sum, s) => sum + calculateIngredientPrice(s), 0);
    const showScrollHints = components.length > 2;
    const scrollCards = (direction: "left" | "right") => {
        const el = scrollerRef.current;
        if (!el) return;
        el.scrollBy({
            left: direction === "right" ? el.clientWidth : -el.clientWidth,
            behavior: "smooth",
        });
    };

    const activeSelection = activeComponentId
        ? selected.find((s) => s.component.component_id === activeComponentId) ?? null
        : null;

    const showSlider =
        activeSelection != null &&
        !isFixedPrice &&
        activeSelection.component.min_portion > 0;
    const activePrice = activeSelection ? calculateIngredientPrice(activeSelection) : 0;

    return (
        <section className="organic-card mb-5 overflow-visible rounded-3xl border border-[#cfc39f] p-3.5 lg:p-4">
            {/* Header */}
            <div className="flex items-start gap-2.5 mb-3 px-1">
                <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-[#dbeecf] text-base text-[#28451f] ring-1 ring-[#b9d49f]">
                    {icon}
                </span>
                <div className="min-w-0 flex-1">
                    <h2 className="truncate text-base font-bold text-[#1f321b]">{categoryLabel}</h2>
                    {isMulti && selected.length > 0 && (
                        <p className="mt-0.5 text-xs font-semibold text-[#6f654a]">
                            {selected.length} selected · {formatVnd(totalPrice)}
                        </p>
                    )}
                </div>
                <div className="ml-auto flex flex-none flex-wrap justify-end gap-1.5 pt-0.5">
                    {!isRequired && (
                        <span className="rounded-full border border-[#b8aa7e] bg-[#fff2c7] px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-[#6d5019]">
                            optional
                        </span>
                    )}
                    {isRequired && selected.length === 0 && (
                        <span className="rounded-full border border-[#d1952e] bg-[#ffd46f] px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-[#593707] shadow-sm">
                            required
                        </span>
                    )}
                    {maxItems != null && (
                        <span className="rounded-full border border-[#cfc39f] bg-[#fffdf6] px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-[#6f654a]">
                            max {maxItems}
                        </span>
                    )}
                    {isMulti && selected.length > 0 && (
                        <span className="rounded-full border border-[#366f2f] bg-[#4f8a48] px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-white shadow-sm">
                            {maxItems ? `${selected.length}/${maxItems}` : selected.length} selected
                        </span>
                    )}
                    {!isMulti && selected.length > 0 && (
                        <span className="rounded-full border border-[#366f2f] bg-[#4f8a48] px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-white shadow-sm">
                            selected
                        </span>
                    )}
                </div>
            </div>

            {/* Ingredient cards — horizontal scroll */}
            <div className="relative -mx-3.5 overflow-hidden rounded-2xl lg:-mx-4">
                <div className="pointer-events-none absolute inset-y-0 left-0 z-[1] w-7 bg-gradient-to-r from-[var(--card-bg,#fffdf6)] to-transparent lg:w-16" />
                <div className="pointer-events-none absolute inset-y-0 right-0 z-[1] w-7 bg-gradient-to-l from-[var(--card-bg,#fffdf6)] to-transparent lg:w-16" />
                {showScrollHints && (
                    <>
                        <button
                            type="button"
                            onClick={() => scrollCards("left")}
                            className="absolute left-3 top-1/2 z-[2] hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-[#9f8f61] bg-[#fffdf6]/95 text-xl font-black text-[#234f23] shadow-[0_14px_34px_rgba(34,58,22,0.32),0_0_0_5px_rgba(255,253,246,0.72)] backdrop-blur transition hover:bg-[#edf4e7] hover:scale-105 lg:grid"
                            aria-label={`Scroll ${categoryLabel} left`}
                        >
                            ←
                        </button>
                        <button
                            type="button"
                            onClick={() => scrollCards("right")}
                            className="absolute right-3 top-1/2 z-[2] hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-[#9f8f61] bg-[#fffdf6]/95 text-xl font-black text-[#234f23] shadow-[0_14px_34px_rgba(34,58,22,0.32),0_0_0_5px_rgba(255,253,246,0.72)] backdrop-blur transition hover:bg-[#edf4e7] hover:scale-105 lg:grid"
                            aria-label={`Scroll ${categoryLabel} right`}
                        >
                            →
                        </button>
                    </>
                )}
                <div ref={scrollerRef} className="flex snap-x snap-mandatory scroll-px-4 gap-2 overflow-x-auto overscroll-x-contain px-4 pb-2 pt-0.5 scrollbar-hide lg:scroll-px-14 lg:px-14">
                    {components.map((comp) => {
                        const sel = selectedMap.get(comp.component_id);
                        return (
                            <IngredientCard
                                key={comp.component_id}
                                component={comp}
                                isSelected={sel != null}
                                isActive={activeComponentId === comp.component_id}
                                portion={sel?.portion ?? comp.default_portion}
                                onSelect={onSelect}
                                onUnselect={onUnselect}
                            />
                        );
                    })}
                </div>
            </div>

            {showScrollHints && (
                <div className="mt-1 flex justify-center gap-1.5" aria-hidden="true">
                    {components.map((comp) => (
                        <span
                            key={comp.component_id}
                            className={`h-1.5 rounded-full transition-all ${
                                selectedMap.has(comp.component_id)
                                    ? activeComponentId === comp.component_id
                                        ? "w-6 bg-[#2f6f2d]"
                                        : "w-3 bg-[#649757]"
                                    : "w-1.5 bg-[#bbae86]"
                            }`}
                        />
                    ))}
                </div>
            )}

            {/* Shared portion slider for active ingredient */}
            {showSlider && activeSelection && (
                <div className="mt-3 px-1">
                    <div className="rounded-2xl border border-[#b9d49f] bg-[#eef8e6] px-3 pb-1 pt-3">
                        <div className="mb-2 flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#6f654a]">
                                    Editing portion
                                </p>
                                <p className="truncate text-sm font-extrabold text-[#1f321b]">
                                    {activeSelection.component.component_name}
                                </p>
                            </div>
                            <div className="flex flex-none flex-col items-end">
                                <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#6f654a]">
                                    Price now
                                </span>
                                <span className="rounded-full border border-[#d8bd69] bg-[#fff2c7] px-3 py-1 text-sm font-extrabold text-[#604513] shadow-sm">
                                    {formatVnd(activePrice)}
                                </span>
                            </div>
                        </div>
                        <SnappingSlider
                            min={activeSelection.component.min_portion}
                            max={activeSelection.component.max_portion}
                            step={activeSelection.component.portion_step}
                            value={activeSelection.portion}
                            unit={activeSelection.component.unit}
                            onChange={(v) => onPortionChange(activeSelection.component.component_id, v)}
                        />
                    </div>
                </div>
            )}
        </section>
    );
});
