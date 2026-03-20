import { Separator } from "@/components/ui/separator";
import { SettingsNav } from "@/components/settings/settings-nav";

export const metadata = {
  title: "Settings | GroundPulse",
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
          Manage your account, company profile, and subscription
        </p>
      </div>

      <Separator />

      <div className="flex flex-col gap-8 md:flex-row">
        <SettingsNav />
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}
