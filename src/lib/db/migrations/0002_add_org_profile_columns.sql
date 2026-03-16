ALTER TABLE "organization_profiles" ADD COLUMN "specializations" text[];
ALTER TABLE "organization_profiles" ADD COLUMN "service_types" text[];
ALTER TABLE "organization_profiles" ADD COLUMN "certifications" text[];
ALTER TABLE "organization_profiles" ADD COLUMN "target_project_value_min" integer;
ALTER TABLE "organization_profiles" ADD COLUMN "target_project_value_max" integer;
ALTER TABLE "organization_profiles" ADD COLUMN "years_in_business" integer;
ALTER TABLE "organization_profiles" ADD COLUMN "company_size" text;
