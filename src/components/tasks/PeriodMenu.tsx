"use client";

import { useEffect, useRef, useState } from "react";
import { AppIcon } from "@/components/icons/AppIcon";

export type PlanPeriod = "today" | "week";

type PeriodMenuProps = {
  value: PlanPeriod;
  onChange(value: PlanPeriod): void;
};

const options: Array<{ value: PlanPeriod; label: string }> = [
  { value: "today", label: "Сьогодні" },
  { value: "week", label: "Тиждень" },
];

export function PeriodMenu({ value, onChange }: PeriodMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selected = options.find((option) => option.value === value) ?? options[0];

  function closeAndFocus() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return;

    const selectedIndex = Math.max(
      0,
      options.findIndex((option) => option.value === value),
    );
    optionRefs.current[selectedIndex]?.focus();

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeAndFocus();
        return;
      }

      const currentIndex = optionRefs.current.findIndex(
        (option) => option === document.activeElement,
      );
      let nextIndex: number | null = null;
      if (event.key === "ArrowDown") {
        nextIndex = (Math.max(0, currentIndex) + 1) % options.length;
      } else if (event.key === "ArrowUp") {
        nextIndex =
          (currentIndex <= 0 ? options.length : currentIndex) - 1;
      } else if (event.key === "Home") {
        nextIndex = 0;
      } else if (event.key === "End") {
        nextIndex = options.length - 1;
      }

      if (nextIndex !== null) {
        event.preventDefault();
        optionRefs.current[nextIndex]?.focus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, value]);

  return (
    <div className="period-menu" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="period-trigger"
        aria-label="Змінити період"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <AppIcon name="calendar" size={17} decorative />
        <span>{selected.label}</span>
      </button>
      {open ? (
        <div className="period-options" role="menu" aria-label="Період задач">
          {options.map((option, index) => (
            <button
              key={option.value}
              ref={(element) => {
                optionRefs.current[index] = element;
              }}
              type="button"
              role="menuitemradio"
              aria-checked={value === option.value}
              tabIndex={value === option.value ? 0 : -1}
              onClick={() => {
                onChange(option.value);
                closeAndFocus();
              }}
            >
              <span>{option.label}</span>
              {value === option.value ? (
                <AppIcon name="check" size={16} decorative />
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
