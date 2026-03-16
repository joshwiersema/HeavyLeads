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
    <nav className="flex-1 space-y-1 p-4">
      <div className="px-0 pb-3">
        <IndustryBadge industry={industry} />
      </div>
      {navLinks.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
            isNavActive(href, pathname) && "bg-accent text-accent-foreground"
          )}
        >
          <Icon className="size-4" />
          {label}
        </Link>
      ))}
    </nav>
  );
}
