"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { navLinks, isNavActive } from "./nav-links";
import { IndustryBadge } from "./industry-badge";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Separator } from "@/components/ui/separator";
import type { Industry } from "@/lib/onboarding/types";

export function MobileNav({
  userName,
  industry,
}: {
  userName?: string | null;
  industry: Industry;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="md:hidden">
      <button
        aria-label="Open navigation menu"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      >
        <Menu className="size-5" />
      </button>

      {/* Overlay */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-200 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setOpen(false)}
      />

      {/* Drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-background shadow-lg transition-transform duration-200 ease-in-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex h-14 items-center justify-between px-4">
            <Link
              href="/dashboard"
              className="text-lg font-semibold"
              onClick={() => setOpen(false)}
            >
              HeavyLeads
            </Link>
            <button
              aria-label="Close navigation menu"
              onClick={() => setOpen(false)}
              className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              <X className="size-5" />
            </button>
          </div>

          <Separator />

          {/* Industry badge + Nav links */}
          <nav className="flex-1 space-y-1 p-4">
            <div className="pb-3">
              <IndustryBadge industry={industry} />
            </div>
            {navLinks.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                    isNavActive(href, pathname) &&
                      "bg-accent text-accent-foreground"
                  )}
                >
                  <Icon className="size-4" />
                  {label}
                </Link>
              ))}
          </nav>

          <Separator />

          {/* Footer */}
          <div className="p-4">
            {userName && (
              <p className="mb-3 truncate text-sm text-muted-foreground">
                {userName}
              </p>
            )}
            <SignOutButton />
          </div>
        </div>
      </div>
    </div>
  );
}
