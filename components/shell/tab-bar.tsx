"use client";

import { usePathname } from "next/navigation";
import { List, Target, User, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { GuardedLink } from "@/components/shell/guarded-link";

type Tab = {
  href: string;
  label: string;
  icon: LucideIcon;
};

// Three destinations, no action button: starting a round moved to a "+" in
// the Feed header when Wedgemaxx took the middle slot. Every tab is a
// GuardedLink — none of these pages is guaranteed cached for a given offline
// session, and landing on an uncached one is a dead end with no way back.
const tabs: Tab[] = [
  { href: "/feed", label: "Rounds", icon: List },
  { href: "/wedgemaxx", label: "Wedgemaxx", icon: Target },
  { href: "/profile", label: "Profile", icon: User },
];

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background pb-safe">
      <ul className="mx-auto flex max-w-md items-stretch justify-around">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="flex-1">
              <GuardedLink
                href={href}
                // Navigating to the tab you're already on can't fail offline.
                skipGuard={active}
                className={cn(
                  "flex min-h-tap flex-col items-center justify-center gap-1 text-xs font-medium",
                  active ? "text-primary" : "text-muted",
                )}
              >
                <Icon size={26} />
                <span>{label}</span>
              </GuardedLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
