"use client";

import { BigButton } from "@/components/ui/big-button";

/**
 * Full-screen confirmation modal matching the app's light-only, big-target
 * design system — used instead of the browser's native confirm().
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  pending = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 sm:items-center"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-t-app bg-background p-5 pb-[calc(env(safe-area-inset-bottom)+2rem)] sm:rounded-app sm:pb-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-dialog-title" className="text-lg font-bold">
          {title}
        </h2>
        {description && (
          <p className="mt-1.5 text-sm text-muted">{description}</p>
        )}
        <div className="mt-6 flex flex-col gap-3">
          <BigButton
            variant={destructive ? "danger" : "primary"}
            block
            disabled={pending}
            onClick={onConfirm}
          >
            {pending ? "…" : confirmLabel}
          </BigButton>
          <BigButton
            variant="secondary"
            block
            disabled={pending}
            onClick={onCancel}
          >
            {cancelLabel}
          </BigButton>
        </div>
      </div>
    </div>
  );
}
