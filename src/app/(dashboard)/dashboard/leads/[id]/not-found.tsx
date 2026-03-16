import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function LeadNotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle>Lead not found</CardTitle>
          <CardDescription>
            This lead doesn&apos;t exist or may have been removed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/dashboard"
            className="inline-flex h-8 items-center justify-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/80"
          >
            Back to Dashboard
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
