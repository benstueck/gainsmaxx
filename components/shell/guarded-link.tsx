"use client";

import Link, { type LinkProps } from "next/link";
import { useOfflineGuard } from "@/lib/offline/use-offline-guard";
import { OfflineNoticeModal } from "@/components/shell/offline-notice-modal";

/**
 * A next/link that blocks navigation with a modal instead of following
 * through when offline. Use this for any in-app link to a dynamic,
 * authenticated page — none of them are guaranteed to have a cached copy
 * for a given offline session, and there's no tab bar to escape from if
 * one dead-ends.
 */
export function GuardedLink({
  children,
  skipGuard,
  ...props
}: LinkProps & {
  children: React.ReactNode;
  className?: string;
  "aria-label"?: string;
  /** Skip the offline check — e.g. a link to the page already being shown. */
  skipGuard?: boolean;
}) {
  const { blocked, dismiss, guardClick } = useOfflineGuard();

  return (
    <>
      <Link {...props} onClick={skipGuard ? undefined : guardClick}>
        {children}
      </Link>
      <OfflineNoticeModal open={blocked} onClose={dismiss} />
    </>
  );
}
