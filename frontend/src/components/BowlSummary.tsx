"use client";

import { type Meal, type Macros } from "@/lib/types";
import { CATEGORY_LABELS, CATEGORY_DISPLAY_ORDER, FIXED_PRICE_CATEGORIES, REQUIRED_CATEGORIES } from "@/lib/constants";
import type { CategorySlug } from "@/lib/types";
import { calculateMealPrice, formatVnd } from "@/lib/pricing";

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

  return (
    <div className="border-t border-[#cfc39f] bg-[#fffdf6]/98 shadow-[0_-18px_40px_rgba(67,82,46,0.12)] lg:border lg:rounded-3xl lg:shadow-[0_22px_55px_rgba(61,89,50,0.14)]">
      {/* Mobile: fixed bottom bar */}
      <div className="lg:hidden">
        {hasItems ? (
          <div className="px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-extrabold text-[#5e4318] uppercase tracking-[0.18em]">
                Your Bowl
              </span>
              <button
                onClick={onClear}
                className="rounded-full border border-[#d8b4a5] bg-[#fff2ed] px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#9b3f24] shadow-sm transition hover:border-[#c76f55] hover:bg-[#ffe5dc] active:scale-95"
              >
                Clear
              </button>
            </div>
            <div className="flex flex-wrap gap-1 mb-2">
              {allItems.map(({ cat, sel }) => (
                <span
                  key={`${cat}-${sel.component.component_id}`}
                  className="text-xs bg-[#dcefd1] text-[#285b28] px-2 py-0.5 rounded-full font-bold"
                >
                  {sel.component.component_name}
                  {!FIXED_PRICE_CATEGORIES.includes(cat as CategorySlug) &&
                    ` ${formatPortion(sel.portion, sel.component.unit)}`}
                </span>
              ))}
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-base font-extrabold leading-none text-[#1f321b]">
                  {formatVnd(totalPrice)}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] font-semibold text-[#536342]">
                  <span>{macros.calories} cal</span>
                  <span>P{macros.protein}g</span>
                  <span>C{macros.carbs}g</span>
                  <span>F{macros.fat}g</span>
                </div>
              </div>
              <button
                onClick={onContinue}
                disabled={!canContinue}
                className="bg-[#2f6f2d] text-white text-sm font-bold px-5 py-2 rounded-xl shadow-[0_12px_25px_rgba(47,111,45,0.28)] transition-all hover:bg-[#245c24] active:scale-95 disabled:cursor-not-allowed disabled:bg-[#b6ad92] disabled:text-[#f7f0dc] disabled:shadow-none"
              >
                Continue →
              </button>
            </div>
          </div>
        ) : (
          <div className="px-4 py-3 text-center text-sm text-[#8f876f]">
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
