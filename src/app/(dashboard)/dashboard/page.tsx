import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = {
  title: "Dashboard | HeavyLeads",
};

export default async function DashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome to HeavyLeads
        </h1>
        <p className="text-muted-foreground">
          {session?.user.name
            ? `Hello, ${session.user.name}.`
            : "Hello!"}{" "}
          Your lead feed will appear here once the scraping pipeline is active.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Getting Started</CardTitle>
          <CardDescription>
            Your dashboard is ready. Lead data will be populated in upcoming
            phases.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            The scraping pipeline will automatically collect building permits,
            bid board postings, and construction news. Once active, you will see
            fresh leads here every morning, filtered by your equipment types and
            service radius.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
