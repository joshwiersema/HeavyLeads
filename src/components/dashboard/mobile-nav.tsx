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
        className="inline-flex items-center justify-center rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
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
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-sidebar shadow-xl transition-transform duration-200 ease-in-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex h-14 items-center justify-between px-5">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
                H
              </div>
              <Link
                href="/dashboard"
                className="text-base font-semibold tracking-tight"
                onClick={() => setOpen(false)}
              >
                HeavyLeads
              </Link>
            </div>
            <button
              aria-label="Close navigation menu"
              onClick={() => setOpen(false)}
              className="inline-flex items-center justify-center rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="size-5" />
            </button>
          </div>

          <Separator />

          {/* Industry badge + Nav links */}
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
                  onClick={() => setOpen(false)}
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

          <Separator />

          {/* Footer */}
          <div className="p-4">
            {userName && (
              <div className="mb-3 flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {userName.charAt(0).toUpperCase()}
                </div>
                <p className="truncate text-sm font-medium">{userName}</p>
              </div>
            )}
            <SignOutButton />
          </div>
        </div>
      </div>
    </div>
  );
}
