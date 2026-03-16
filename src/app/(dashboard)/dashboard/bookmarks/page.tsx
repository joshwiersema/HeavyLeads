import { Suspense } from "react";
import {
  getBookmarksWithDetails,
  PIPELINE_STATUSES,
} from "@/actions/bookmarks";
import type { PipelineStatus, BookmarkWithLead } from "@/actions/bookmarks";
import { BookmarkFilters } from "@/components/bookmarks/bookmark-filters";
import { BookmarkCard } from "@/components/bookmarks/bookmark-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Bookmark } from "lucide-react";

export const metadata = {
  title: "Pipeline | LeadForge",
};

const STATUS_LABELS: Record<PipelineStatus, string> = {
  saved: "saved",
  contacted: "contacted",
  in_progress: "in progress",
  won: "won",
  lost: "lost",
};

interface BookmarksPageProps {
  searchParams: Promise<{ status?: string }>;
}

export default async function BookmarksPage({ searchParams }: BookmarksPageProps) {
  const params = await searchParams;
  const statusFilter =
    params.status && PIPELINE_STATUSES.includes(params.status as PipelineStatus)
      ? (params.status as PipelineStatus)
      : undefined;

  // Fetch all bookmarks (unfiltered) for counts, and filtered for display
  const [allBookmarks, filteredBookmarks] = await Promise.all([
    getBookmarksWithDetails(),
    statusFilter
      ? getBookmarksWithDetails(statusFilter)
      : getBookmarksWithDetails(),
  ]);

  // Compute status counts
  const counts: Record<string, number> = {};
  for (const status of PIPELINE_STATUSES) {
    counts[status] = allBookmarks.filter(
      (b) => (b.pipelineStatus ?? "saved") === status
    ).length;
  }

  const displayBookmarks = statusFilter ? filteredBookmarks : allBookmarks;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Pipeline</h1>
        <p className="text-muted-foreground">
          {allBookmarks.length} bookmarked lead
          {allBookmarks.length !== 1 ? "s" : ""} in your pipeline
        </p>
      </div>

      <Suspense fallback={null}>
        <BookmarkFilters counts={counts} total={allBookmarks.length} />
      </Suspense>

      {displayBookmarks.length === 0 ? (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bookmark className="size-5 text-muted-foreground" />
              <CardTitle>
                {statusFilter
                  ? `No ${STATUS_LABELS[statusFilter]} leads yet`
                  : "No bookmarked leads yet"}
              </CardTitle>
            </div>
            <CardDescription>
              {statusFilter
                ? `You haven't marked any leads as "${STATUS_LABELS[statusFilter]}". Update a lead's status from the pipeline dropdown.`
                : "Bookmark leads from the lead feed to save them here and track your pipeline."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Browse the{" "}
              <a
                href="/dashboard"
                className="font-medium text-primary underline underline-offset-4 hover:text-primary/80"
              >
                lead feed
              </a>{" "}
              and click the bookmark button on any lead to add it to your
              pipeline.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {displayBookmarks.map((bookmark) => (
            <BookmarkCard key={bookmark.id} bookmark={bookmark} />
          ))}
        </div>
      )}
    </div>
  );
}
