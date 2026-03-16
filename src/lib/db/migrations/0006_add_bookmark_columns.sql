ALTER TABLE "bookmarks" ADD COLUMN "notes" text;
ALTER TABLE "bookmarks" ADD COLUMN "pipeline_status" text DEFAULT 'saved';
