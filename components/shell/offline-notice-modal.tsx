"use client";

import { BigButton } from "@/components/ui/big-button";

/**
 * Shared offline notice — used anywhere an offline tap is blocked instead of
 * being allowed to navigate/act and fail.
 *
 * The copy is overridable because not every offline moment is a refusal. A
 * queued finish, for instance, *succeeded* locally and is waiting to sync, so
 * telling the player "that needs a connection" would be plainly wrong — but
 * the shell, the dismiss behaviour and the safe-area padding are identical, so
 * the markup is shared rather than duplicated.
 */
export function OfflineNoticeModal({
  open,
  onClose,
  title = "You\u2019re offline",
  description = "That needs a connection. Whatever\u2019s already open \u2014 including a round in progress \u2014 keeps working offline.",
  closeLabel = "OK",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  closeLabel?: string;
}) {
  if (!open) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="offline-notice-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-t-app bg-background p-5 pb-[calc(env(safe-area-inset-bottom)+2rem)] sm:rounded-app sm:pb-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="offline-notice-title" className="text-lg font-bold">
          {title}
        </h2>
        <p className="mt-1.5 text-sm text-muted">{description}</p>
        <div className="mt-6">
          <BigButton block onClick={onClose}>
            {closeLabel}
          </BigButton>
        </div>
      </div>
    </div>
  );
}
