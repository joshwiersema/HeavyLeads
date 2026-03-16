import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
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
            This lead doesn't exist or may have been removed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/dashboard" className={buttonVariants()}>
            Back to Dashboard
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
