import { Suspense } from "react";
import { getSavedSearches } from "@/actions/saved-searches";
import { SaveSearchForm } from "./save-search-form";
import { SavedSearchCard } from "./saved-search-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Search } from "lucide-react";

export const metadata = {
  title: "Saved Searches | GroundPulse",
};

export default async function SavedSearchesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const showSaveForm = params.save === "true";

  const searches = await getSavedSearches();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Saved Searches</h1>
        <p className="text-muted-foreground">
          {searches.length} saved search{searches.length !== 1 ? "es" : ""}
        </p>
      </div>

      {/* Save form shown when redirected from filters with ?save=true */}
      {showSaveForm && (
        <Suspense fallback={null}>
          <SaveSearchForm />
        </Suspense>
      )}

      {/* Saved search list */}
      {searches.length === 0 && !showSaveForm ? (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Search className="size-5 text-muted-foreground" />
              <CardTitle>No saved searches yet</CardTitle>
            </div>
            <CardDescription>
              Use the &quot;Save Search&quot; button on the lead feed to save
              your filter configurations.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Saved searches let you quickly reload your favorite filter
              combinations and can be used for email digests.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {searches.map((search) => (
            <SavedSearchCard key={search.id} search={search} />
          ))}
        </div>
      )}
    </div>
  );
}
