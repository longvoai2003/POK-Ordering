"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface SnappingSliderProps {
    min: number;
    max: number;
    step: number;
    value: number;
    unit: "g" | "ml" | "count";
    onChange: (value: number) => void;
}

export function SnappingSlider({
    min,
    max,
    step,
    value,
    unit,
    onChange,
}: SnappingSliderProps) {
    const sliderRef = useRef<HTMLDivElement>(null);
    const animationFrameRef = useRef<number | null>(null);
    const pendingValueRef = useRef<number>(value);
    const [dragging, setDragging] = useState(false);
    const [dragValue, setDragValue] = useState(value);

    const safeStep = step > 0 ? step : 1;
    const levels = useMemo(() => {
        const nextLevels: number[] = [];
        for (let v = min; v <= max; v += safeStep) {
            nextLevels.push(v);
        }
        if (!nextLevels.includes(max)) nextLevels.push(max);
        return nextLevels;
    }, [min, max, safeStep]);

    const displayValue = dragging ? dragValue : value;
    const valueIndex = levels.indexOf(displayValue);
    const progressPercent = levels.length > 1
        ? ((valueIndex >= 0 ? valueIndex : 0) / (levels.length - 1)) * 100
        : 50;
    const labelPositionClass = (idx: number) => {
        if (idx === 0) return "left-0 translate-x-0 text-left";
        if (idx === levels.length - 1) return "right-0 translate-x-0 text-right";
        return "-translate-x-1/2 text-center";
    };

    const commitThrottled = useCallback(
        (nextValue: number) => {
            pendingValueRef.current = nextValue;
            if (animationFrameRef.current != null) return;

            animationFrameRef.current = window.requestAnimationFrame(() => {
                animationFrameRef.current = null;
                onChange(pendingValueRef.current);
            });
        },
        [onChange],
    );

    const snapToClosest = useCallback(
        (clientX: number) => {
            if (!sliderRef.current) return;
            const rect = sliderRef.current.getBoundingClientRect();
            const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            const rawIndex = pct * (levels.length - 1);
            const idx = Math.round(rawIndex);
            const nextValue = levels[idx];
            if (nextValue !== undefined) {
                setDragValue(nextValue);
                commitThrottled(nextValue);
            }
        },
        [levels, commitThrottled],
    );

    const handlePointerDown = useCallback(
        (e: React.PointerEvent) => {
            e.preventDefault();
            setDragging(true);
            setDragValue(value);
            pendingValueRef.current = value;
            snapToClosest(e.clientX);
        },
        [snapToClosest, value],
    );

    useEffect(() => {
        if (!dragging) return;
        const handleMove = (e: PointerEvent) => snapToClosest(e.clientX);
        const handleUp = () => {
            setDragging(false);
            if (animationFrameRef.current != null) {
                window.cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
            onChange(pendingValueRef.current);
        };
        window.addEventListener("pointermove", handleMove);
        window.addEventListener("pointerup", handleUp);
        return () => {
            window.removeEventListener("pointermove", handleMove);
            window.removeEventListener("pointerup", handleUp);
            if (animationFrameRef.current != null) {
                window.cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
        };
    }, [dragging, snapToClosest, onChange]);

    useEffect(() => {
        if (!dragging) setDragValue(value);
    }, [dragging, value]);

    const formatValue = (v: number) =>
        unit === "count"
            ? `${v} egg${v > 1 ? "s" : ""}`
            : `${v}${unit}`;

    return (
        <div className="w-full pt-1 pb-12">
            <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-[#334b28]">Portion</span>
                <span className="rounded-full bg-[#dcefd1] px-3 py-1 text-sm font-extrabold text-[#234f23] ring-1 ring-[#a7c88e]">
                    {formatValue(displayValue)}
                </span>
            </div>

            {/* Track */}
            <div
                ref={sliderRef}
                onPointerDown={handlePointerDown}
                className="relative h-20 flex items-center cursor-pointer touch-none select-none"
            >
                {/* Rail */}
                <div className="absolute left-0 right-0 h-3 bg-[#cfc39f] rounded-full" />
                {/* Filled rail */}
                <div
                    className={`absolute left-0 h-3 rounded-full bg-gradient-to-r from-[#7cad4e] to-[#2f6f2d] ${dragging ? "" : "transition-all duration-150"}`}
                    style={{ width: `${progressPercent}%` }}
                />

                {/* Tick marks + labels */}
                <div className="absolute left-0 right-0 top-full mt-4 flex justify-between">
                    {levels.map((level) => (
                        <div key={level} className="flex flex-col items-center">
                            <div
                                className={`w-1 h-1.5 rounded-full ${level <= displayValue ? "bg-[#2f6f2d]" : "bg-[#bbae86]"
                                    }`}
                            />
                        </div>
                    ))}
                </div>

                {/* Labels row */}
                <div className="absolute left-0 right-0 top-full mt-8 overflow-hidden pb-7">
                    {levels.map((level, idx) => (
                        <span
                            key={level}
                            className={`absolute min-w-max text-[10px] font-semibold ${labelPositionClass(idx)} ${level === displayValue
                                    ? "text-[#245c24]"
                                    : "text-[#6f654a]"
                                }`}
                            style={
                                idx === 0 || idx === levels.length - 1
                                    ? undefined
                                    : { left: `${(idx / (levels.length - 1)) * 100}%` }
                            }
                        >
                            {formatValue(level)}
                        </span>
                    ))}
                </div>

                {/* Thumb */}
                <div
                    className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 ${dragging ? "" : "transition-all duration-150"}`}
                    style={{ left: `${progressPercent}%` }}
                >
                    <div
                        className={`
              w-8 h-8 rounded-full border-[3px] border-[#2f6f2d] bg-[#fffdf6] shadow-[0_8px_20px_rgba(47,111,45,0.38)]
              ${dragging ? "scale-110 shadow-lg" : ""}
            `}
                    />
                </div>
            </div>
        </div>
    );
}
