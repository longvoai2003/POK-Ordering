"use client";

import { memo } from "react";
import { type Component } from "@/lib/types";
import { FIXED_PRICE_CATEGORIES } from "@/lib/constants";
import { calculateIngredientPrice, formatVnd } from "@/lib/pricing";

interface IngredientCardProps {
    component: Component;
    isSelected: boolean;
    isActive: boolean;
    portion: number;
    onSelect: (component: Component) => void;
    onUnselect: (componentId: string, category: string) => void;
}

export const IngredientCard = memo(function IngredientCard({
    component,
    isSelected,
    isActive,
    portion,
    onSelect,
    onUnselect,
}: IngredientCardProps) {
    const isFixedPrice = FIXED_PRICE_CATEGORIES.includes(component.category);
    const currentPrice = isSelected
        ? calculateIngredientPrice({ component, portion })
        : component.cost;
    const portionLabel =
        component.unit === "ml"
            ? `${component.default_portion}ml`
            : component.unit === "count"
                ? `${component.default_portion} egg${component.default_portion > 1 ? "s" : ""}`
                : `${component.default_portion}g`;

    return (
        <button
            onClick={() => onSelect(component)}
            className={`
        group flex-shrink-0 snap-start basis-[calc((100%_-_0.5rem)/2)] sm:basis-[calc((100%_-_1rem)/3)] overflow-hidden rounded-2xl border p-3 text-left transition-all duration-200
        ${isSelected
                    ? isActive
                        ? "border-[#1f5c1d] bg-[#daf0ce] shadow-[0_18px_35px_rgba(47,111,45,0.28)] ring-2 ring-[#2f6f2d]"
                        : "border-[#2f6f2d] bg-[#e8f4dd] shadow-[0_10px_22px_rgba(47,111,45,0.15)]"
                    : "border-[#cfc39f] bg-[#fffdf6]/95 hover:border-[#8fae6e] hover:shadow-[0_14px_30px_rgba(74,89,50,0.14)] active:scale-95"
                }
      `}
        >
            <div className="flex items-center justify-between gap-2 mb-1">
                <span className="max-w-[6.5rem] truncate text-[11px] font-bold text-[#5e4318] uppercase tracking-[0.12em]">
                    {isFixedPrice ? "fixed" : portionLabel}
                </span>
                {isSelected && (
                    <span
                        onClick={(e) => {
                            e.stopPropagation();
                            onUnselect(component.component_id, component.category);
                        }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                                e.stopPropagation();
                                onUnselect(component.component_id, component.category);
                            }
                        }}
                        className="grid h-6 w-6 flex-none place-items-center rounded-full bg-[#c0392b] text-xs font-bold text-white shadow-sm ring-2 ring-[#fffdf6] hover:bg-[#9f2f24] hover:scale-110 transition-all cursor-pointer"
                        title="Remove"
                    >
                        ×
                    </span>
                )}
            </div>
            <p className="text-sm font-bold leading-tight text-[#1f321b]">
                {component.component_name}
            </p>
            <p className="hidden md:block text-xs font-medium text-[#586949] mt-0.5 line-clamp-1">
                {component.description}
            </p>
            {/* Macros disabled — nutrition data is inaccurate
            <p className="text-[10px] font-semibold text-[#6f654a] mt-0.5">
                {component.calories.toFixed(0)}cal · P{component.protein.toFixed(1)}g
            </p>
            */}
            <div className="mt-2 flex items-center justify-end border-t border-[#dfd3ae]/70 pt-2">
                <span className="rounded-full bg-[#fff2c7] px-2 py-0.5 text-[11px] font-extrabold text-[#604513] ring-1 ring-[#d8bd69]">
                    {formatVnd(currentPrice)}
                </span>
            </div>
        </button>
    );
});
