import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function SingleCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-16" />
        </div>
        <Skeleton className="mt-1 h-5 w-3/4" />
        <div className="flex items-center gap-2 mt-1">
          <Skeleton className="h-5 w-10 rounded-full" />
          <Skeleton className="h-4 w-16" />
        </div>
      </CardHeader>
      <CardContent>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="mt-1 h-4 w-2/3" />
      </CardContent>
      <CardContent className="pt-0">
        <div className="flex gap-1">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-18" />
        </div>
      </CardContent>
      <CardFooter className="gap-4">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-28" />
      </CardFooter>
    </Card>
  );
}

/** Loading skeleton showing 3 placeholder lead cards for Suspense boundaries */
export function LeadCardSkeleton() {
  return (
    <div className="space-y-4">
      <SingleCardSkeleton />
      <SingleCardSkeleton />
      <SingleCardSkeleton />
    </div>
  );
}
