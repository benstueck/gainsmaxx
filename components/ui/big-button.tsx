import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Big, thumb-friendly button — the on-course workhorse.
 * Minimum height is the design-system tap target (64px) so it's easy to hit
 * while walking. Light-mode only.
 */
const bigButton = cva(
  "inline-flex items-center justify-center gap-2 rounded-app font-semibold " +
    "transition-colors select-none active:scale-[0.99] disabled:pointer-events-none " +
    "disabled:opacity-40 min-h-tap px-6 text-lg",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary-hover",
        secondary:
          "bg-surface text-foreground border border-border hover:bg-surface-2",
        ghost: "bg-transparent text-foreground hover:bg-surface",
        danger: "bg-negative text-white hover:brightness-95",
      },
      block: {
        true: "w-full",
        false: "",
      },
    },
    defaultVariants: {
      variant: "primary",
      block: false,
    },
  },
);

export interface BigButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof bigButton> {}

export function BigButton({
  className,
  variant,
  block,
  ...props
}: BigButtonProps) {
  return (
    <button
      className={cn(bigButton({ variant, block }), className)}
      {...props}
    />
  );
}
