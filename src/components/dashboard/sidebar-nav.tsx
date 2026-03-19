"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { navLinks, isNavActive } from "./nav-links";
import { IndustryBadge } from "./industry-badge";
import type { Industry } from "@/lib/onboarding/types";

interface SidebarNavProps {
  industry: Industry;
}

export function SidebarNav({ industry }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 space-y-0.5 p-3">
      <div className="px-2 pb-3">
        <IndustryBadge industry={industry} />
      </div>
      {navLinks.map(({ href, label, icon: Icon }) => {
        const active = isNavActive(href, pathname);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <Icon className={cn("size-4", active && "text-primary")} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
