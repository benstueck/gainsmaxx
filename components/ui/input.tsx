import * as React from "react";
import { cn } from "@/lib/utils";

/** Large, high-contrast text input tuned for on-course, one-handed use. */
export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-14 w-full rounded-app border border-border bg-background px-4 text-lg",
        "outline-none placeholder:text-muted/60 focus:border-primary",
        className,
      )}
      {...props}
    />
  );
}
