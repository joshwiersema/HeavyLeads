"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { User, Building2, CreditCard, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/settings/account", label: "Account", icon: User },
  { href: "/settings/company", label: "Company", icon: Building2 },
  { href: "/settings/subscription", label: "Subscription", icon: CreditCard },
  { href: "/settings/security", label: "Security", icon: Shield },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-2 md:flex-col md:gap-1 md:w-48 flex-shrink-0">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
            pathname === href && "bg-accent text-accent-foreground"
          )}
        >
          <Icon className="size-4" />
          {label}
        </Link>
      ))}
    </nav>
  );
}
