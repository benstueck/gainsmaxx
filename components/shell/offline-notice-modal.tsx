"use client";

import { BigButton } from "@/components/ui/big-button";

/** Shared "that needs a connection" notice — used anywhere an offline tap
 *  is blocked instead of being allowed to navigate/act and fail. */
export function OfflineNoticeModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
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
          You&rsquo;re offline
        </h2>
        <p className="mt-1.5 text-sm text-muted">
          That needs a connection. Whatever&rsquo;s already open — including
          a round in progress — keeps working offline.
        </p>
        <div className="mt-6">
          <BigButton block onClick={onClose}>
            OK
          </BigButton>
        </div>
      </div>
    </div>
  );
}
