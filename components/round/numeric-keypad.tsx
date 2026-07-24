"use client";

import { Delete } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Big custom numeric keypad for on-course distance entry — deliberately NOT the
 * OS keyboard. Digits only (distances are whole numbers). Thumb-zone sized.
 */
export function NumericKeypad({
  onDigit,
  onBackspace,
  className,
}: {
  onDigit: (d: string) => void;
  onBackspace: () => void;
  className?: string;
}) {
  const keyCls =
    "flex min-h-tap items-center justify-center rounded-app bg-surface text-2xl " +
    "font-semibold text-foreground active:bg-surface-2 select-none";

  return (
    <div className={cn("grid grid-cols-3 gap-2", className)}>
      {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
        <button
          key={d}
          type="button"
          className={keyCls}
          onClick={() => onDigit(d)}
        >
          {d}
        </button>
      ))}
      <span aria-hidden className="min-h-tap" />
      <button type="button" className={keyCls} onClick={() => onDigit("0")}>
        0
      </button>
      <button
        type="button"
        aria-label="Delete"
        className={keyCls}
        onClick={onBackspace}
      >
        <Delete size={26} />
      </button>
    </div>
  );
}
