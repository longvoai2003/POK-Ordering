"use client";

import { useRef, useState, type PointerEvent } from "react";
import { type Meal, type Macros } from "@/lib/types";
import { CATEGORY_LABELS, CATEGORY_DISPLAY_ORDER, FIXED_PRICE_CATEGORIES, REQUIRED_CATEGORIES } from "@/lib/constants";
import type { CategorySlug } from "@/lib/types";
import { calculateIngredientPrice, calculateMealPrice, formatVnd } from "@/lib/pricing";

interface BowlSummaryProps {
  meal: Meal;
  macros: Macros;
  onClear: () => void;
  onContinue: () => void;
}

function formatPortion(portion: number, unit: string): string {
  if (unit === "count") return `${portion} egg${portion > 1 ? "s" : ""}`;
  return `${portion}${unit}`;
}

export function BowlSummary({ meal, macros, onClear, onContinue }: BowlSummaryProps) {
  const allItems = CATEGORY_DISPLAY_ORDER.flatMap(
    (cat) => (meal[cat] ?? []).map((sel) => ({ cat, sel })),
  );
  const hasItems = allItems.length > 0;
  const requiredCount = REQUIRED_CATEGORIES.filter(
    (cat) => (meal[cat] ?? []).length > 0,
  ).length;
  const canContinue = requiredCount === REQUIRED_CATEGORIES.length;
  const totalPrice = calculateMealPrice(meal);
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const dragStartY = useRef<number | null>(null);

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    dragStartY.current = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (dragStartY.current === null) return;
    const delta = event.clientY - dragStartY.current;
    dragStartY.current = null;
    if (Math.abs(delta) > 40) {
      setMobileExpanded(delta < 0);
    }
  }

  return (
    <div className="border-t border-[#cfc39f] bg-[#fffdf6]/98 shadow-[0_-18px_40px_rgba(67,82,46,0.12)] lg:border lg:rounded-3xl lg:shadow-[0_22px_55px_rgba(61,89,50,0.14)]">
      {/* Mobile: draggable order sheet */}
      <div className="lg:hidden">
        {hasItems ? (
          <div
            className={`rounded-t-[2rem] bg-[#1f321b] px-4 text-[#fffdf6] shadow-[0_-18px_45px_rgba(31,50,27,0.24)] transition-[height] duration-300 ${mobileExpanded ? "h-[78vh]" : "h-[7.5rem]"}`}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
          >
            <button
              type="button"
              aria-label={mobileExpanded ? "Collapse bowl details" : "Expand bowl details"}
              onClick={() => setMobileExpanded((expanded) => !expanded)}
              className="flex w-full flex-col items-center pt-3 pb-2"
            >
              <span className="h-1.5 w-16 rounded-full bg-[#b9c8a4]/70" />
              <span className="sr-only">Swipe up to see your order details</span>
            </button>

            <div className="flex items-center justify-between border-b border-[#b9c8a4]/25 pb-3">
              <div>
                <div className="text-sm font-medium text-[#cbd6be]">Your Bowl</div>
                <div className="text-xl font-extrabold leading-tight">{allItems.length} items</div>
              </div>
              <div className="text-2xl font-extrabold text-[#f3d36b]">{formatVnd(totalPrice)}</div>
            </div>

            {mobileExpanded && (
              <div className="flex h-[calc(78vh-7.5rem)] flex-col overflow-hidden pt-4">
                <div className="mb-3">
                  <h3 className="text-2xl font-extrabold">Your Bowl</h3>
                  <p className="mt-1 text-sm text-[#cbd6be]">Review your selections before continuing.</p>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                  {allItems.map(({ cat, sel }) => (
                    <div
                      key={`${cat}-${sel.component.component_id}`}
                      className="flex items-center justify-between gap-3 border-b border-[#b9c8a4]/20 py-3 text-sm"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-[#f5f1df]">{sel.component.component_name}</div>
                        <div className="mt-0.5 text-xs text-[#b9c8a4]">
                          {CATEGORY_LABELS[cat]}{!FIXED_PRICE_CATEGORIES.includes(cat as CategorySlug) && ` · ${formatPortion(sel.portion, sel.component.unit)}`}
                        </div>
                      </div>
                      <span className="shrink-0 font-bold text-[#f3d36b]">
                        {formatVnd(calculateIngredientPrice(sel))}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="border-t-2 border-[#b9c8a4]/40 pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium uppercase tracking-[0.16em] text-[#cbd6be]">Total</span>
                    <span className="text-3xl font-extrabold text-[#f3d36b]">{formatVnd(totalPrice)}</span>
                  </div>
                  {/* Macros disabled — nutrition data is inaccurate
                  <div className="mt-2 flex gap-3 text-xs text-[#cbd6be]">
                    <span>{macros.calories} cal</span><span>P{macros.protein}g</span><span>C{macros.carbs}g</span><span>F{macros.fat}g</span>
                  </div>
                  */}
                  <div className="mt-4 flex gap-2 pb-3">
                    <button onClick={onClear} className="rounded-xl border border-[#b9c8a4]/40 px-4 py-3 text-sm font-bold text-[#dcefd1]">Clear</button>
                    <button onClick={onContinue} disabled={!canContinue} className="flex-1 rounded-xl bg-[#77a878] py-3 text-sm font-extrabold text-white shadow-[0_12px_25px_rgba(47,111,45,0.28)] disabled:bg-[#596552]">Continue →</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-t-[2rem] bg-[#fffdf6] px-4 py-4 text-center text-sm text-[#8f876f] shadow-[0_-18px_40px_rgba(67,82,46,0.12)]">
            Pick at least a base, protein, veggie &amp; sauce to get started
          </div>
        )}
      </div>

      {/* Desktop: sidebar card */}
      <div className="hidden lg:block p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-[#1f321b]">Your Bowl</h3>
          {hasItems && (
            <button
              onClick={onClear}
              className="rounded-full border border-[#d8b4a5] bg-[#fff2ed] px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#9b3f24] shadow-sm transition hover:border-[#c76f55] hover:bg-[#ffe5dc] active:scale-95"
            >
              Clear
            </button>
          )}
        </div>

        {hasItems ? (
          <>
            <div className="space-y-2 mb-4">
              {CATEGORY_DISPLAY_ORDER.map((cat) => {
                const items = meal[cat] ?? [];
                if (items.length === 0) return null;
                return items.map((sel) => (
                  <div key={`${cat}-${sel.component.component_id}`} className="flex justify-between items-center text-sm">
                    <span className="font-semibold text-[#536342]">
                      {CATEGORY_LABELS[cat]}
                    </span>
                    <span className="font-bold text-[#1f321b] text-right">
                      {sel.component.component_name}
                      {!FIXED_PRICE_CATEGORIES.includes(cat as CategorySlug) && (
                        <span className="font-semibold text-[#6f654a] ml-1">
                          {formatPortion(sel.portion, sel.component.unit)}
                        </span>
                      )}
                    </span>
                  </div>
                ));
              })}
            </div>

            <div className="border-t border-[#cfc39f] pt-3 mb-4">
              <div className="mb-3 rounded-2xl border border-[#d8c98f] bg-[#fff8da] px-3 py-2">
                <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6d5019]">
                  Total
                </div>
                <div className="mt-0.5 text-2xl font-extrabold text-[#1f321b]">
                  {formatVnd(totalPrice)}
                </div>
              </div>
              {/* Macros disabled — nutrition data is inaccurate
              <div className="grid grid-cols-4 gap-1 text-center text-xs">
                <div>
                  <div className="font-extrabold text-[#1f321b]">{macros.calories}</div>
                  <div className="font-semibold text-[#6f654a]">cal</div>
                </div>
                <div>
                  <div className="font-extrabold text-[#1f321b]">{macros.protein}g</div>
                  <div className="font-semibold text-[#6f654a]">protein</div>
                </div>
                <div>
                  <div className="font-extrabold text-[#1f321b]">{macros.carbs}g</div>
                  <div className="font-semibold text-[#6f654a]">carbs</div>
                </div>
                <div>
                  <div className="font-extrabold text-[#1f321b]">{macros.fat}g</div>
                  <div className="font-semibold text-[#6f654a]">fat</div>
                </div>
              </div>
              */}
            </div>

            <button
              onClick={onContinue}
              disabled={!canContinue}
              className="w-full bg-[#2f6f2d] text-white text-sm font-bold py-2.5 rounded-xl shadow-[0_12px_25px_rgba(47,111,45,0.28)] transition-all hover:bg-[#245c24] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[#b6ad92] disabled:text-[#f7f0dc] disabled:shadow-none"
            >
              Continue →
            </button>
          </>
        ) : (
          <p className="text-sm text-[#8f876f] text-center py-8">
            Pick at least a base, protein, veggie &amp; sauce
          </p>
        )}
      </div>
    </div>
  );
}
