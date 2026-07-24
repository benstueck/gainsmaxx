"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { List, Plus, User, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = {
  href: string;
  label: string;
  icon: LucideIcon;
  primary?: boolean;
};

const tabs: Tab[] = [
  { href: "/feed", label: "Rounds", icon: List },
  { href: "/round/new", label: "New round", icon: Plus, primary: true },
  { href: "/profile", label: "Profile", icon: User },
];

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background pb-safe">
      <ul className="mx-auto flex max-w-md items-stretch justify-around">
        {tabs.map(({ href, label, icon: Icon, primary }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          if (primary) {
            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  aria-label={label}
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
  );
}
