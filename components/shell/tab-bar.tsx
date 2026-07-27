"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { List, Plus, User, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { BigButton } from "@/components/ui/big-button";

type Tab = {
  href: string;
  label: string;
  icon: LucideIcon;
  primary?: boolean;
};

// Every tab is a fresh, dynamic, authenticated server render — none of them
// are guaranteed to have a cached copy for a given offline session (e.g.
// Profile was never opened this session). Rather than guess which ones are
// safe, block them all uniformly while offline: the alternative is landing
// on /~offline, a page outside the app shell with no way back.
const tabs: Tab[] = [
  { href: "/feed", label: "Rounds", icon: List },
  { href: "/round/new", label: "New round", icon: Plus, primary: true },
  { href: "/profile", label: "Profile", icon: User },
];

export function TabBar() {
  const pathname = usePathname();
  const [showOfflineNotice, setShowOfflineNotice] = useState(false);

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background pb-safe">
        <ul className="mx-auto flex max-w-md items-stretch justify-around">
          {tabs.map(({ href, label, icon: Icon, primary }) => {
            const active =
              pathname === href || pathname.startsWith(`${href}/`);
            const onClick = (e: React.MouseEvent) => {
              if (active) return;
              if (!navigator.onLine) {
                e.preventDefault();
                setShowOfflineNotice(true);
              }
            };
            if (primary) {
              return (
                <li key={href} className="flex-1">
                  <Link
                    href={href}
                    aria-label={label}
                    onClick={onClick}
                    className="flex min-h-tap flex-col items-center justify-center"
                  >
                    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md active:scale-95">
                      <Icon size={30} strokeWidth={2.5} />
                    </span>
                  </Link>
                </li>
              );
            }
            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  onClick={onClick}
                  className={cn(
                    "flex min-h-tap flex-col items-center justify-center gap-1 text-xs font-medium",
                    active ? "text-primary" : "text-muted",
                  )}
                >
                  <Icon size={26} />
                  <span>{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {showOfflineNotice && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="offline-notice-title"
          className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 sm:items-center"
          onClick={() => setShowOfflineNotice(false)}
        >
          <div
            className="w-full max-w-sm rounded-t-app bg-background p-5 pb-[calc(env(safe-area-inset-bottom)+2rem)] sm:rounded-app sm:pb-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="offline-notice-title" className="text-lg font-bold">
              You&rsquo;re offline
            </h2>
            <p className="mt-1.5 text-sm text-muted">
              That page needs a connection. Whatever&rsquo;s already open —
              including a round in progress — keeps working offline.
            </p>
            <div className="mt-6">
              <BigButton block onClick={() => setShowOfflineNotice(false)}>
                OK
              </BigButton>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
