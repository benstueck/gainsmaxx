"use client";

import { useCallback, useState } from "react";

/**
 * Every authenticated page in this app is a fresh, dynamic server render —
 * none of them are guaranteed to have a cached copy for a given offline
 * session. Rather than track which specific pages happen to be cached,
 * block any offline navigation/action uniformly and say so, instead of
 * letting it fail into a dead end with no way back.
 */
export function useOfflineGuard() {
  const [blocked, setBlocked] = useState(false);

  const guardClick = useCallback((e: React.MouseEvent) => {
    if (!navigator.onLine) {
      e.preventDefault();
      setBlocked(true);
    }
  }, []);

  const guard = useCallback((action: () => void) => {
    if (!navigator.onLine) {
      setBlocked(true);
      return;
    }
    action();
  }, []);

  return { blocked, dismiss: () => setBlocked(false), guardClick, guard };
}
