import Link from "next/link";
import { Separator } from "@/components/ui/separator";

export const metadata = {
  title: "Settings | HeavyLeads",
};

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and company profile
        </p>
      </div>

      <Separator />

      <div className="flex flex-col gap-8 md:flex-row">
        {/* Settings navigation */}
        <nav className="flex gap-2 md:flex-col md:gap-1 md:w-48">
          <Link
            href="/settings/account"
            className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
          >
            Account
          </Link>
          <Link
            href="/settings/company"
            className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
          >
            Company
          </Link>
          <Link
            href="/billing"
            className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
          >
            Billing
          </Link>
        </nav>

        {/* Settings content */}
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
