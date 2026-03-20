import { LayoutDashboard, Kanban, Search, Settings } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const navLinks: NavLink[] = [
  { href: "/dashboard", label: "Leads", icon: LayoutDashboard },
  { href: "/dashboard/bookmarks", label: "Pipeline", icon: Kanban },
  {
    href: "/dashboard/saved-searches",
    label: "Saved Searches",
    icon: Search,
  },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function isNavActive(href: string, pathname: string): boolean {
  if (href === "/dashboard") {
    // Match /dashboard exactly OR /dashboard/leads/* (nested lead detail pages)
    // But NOT /dashboard/bookmarks or /dashboard/saved-searches (separate nav items)
    return pathname === "/dashboard" || pathname.startsWith("/dashboard/leads");
  }
  // For all other links: standard prefix match
  return pathname.startsWith(href);
}
