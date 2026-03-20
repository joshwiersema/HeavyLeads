"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  companySettingsSchema,
  type CompanySettingsInput,
} from "@/lib/validators/settings";
import { US_STATES } from "@/lib/validators/onboarding";
import { updateCompanyProfile } from "@/actions/settings";
import { getEquipmentTypesForIndustry } from "@/types";
import type { Industry } from "@/lib/onboarding/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface CompanyFormProps {
  initialData: {
    street: string;
    city: string;
    state: string;
    zip: string;
    equipmentTypes: string[];
    serviceRadius: number;
    targetProjectValueMin: number | null;
    targetProjectValueMax: number | null;
  };
  isAdmin: boolean;
  industry: Industry;
}

export function CompanyForm({ initialData, isAdmin, industry }: CompanyFormProps) {
  const equipmentTypes = getEquipmentTypesForIndustry(industry);
  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<CompanySettingsInput>({
    resolver: zodResolver(companySettingsSchema),
    defaultValues: initialData,
  });

  const stateValue = watch("state") ?? "";

  async function onSubmit(data: CompanySettingsInput) {
    try {
      const result = await updateCompanyProfile(data);
      if (result.success) {
        toast.success("Company profile updated");
      } else if (result.error) {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update company profile"
      );
    }
  }

  // Read-only view for non-admin users
  if (!isAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Company Profile</CardTitle>
          <CardDescription>
            Contact an admin to make changes to the company profile
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-muted-foreground">Address</Label>
            <p className="mt-1 text-sm">
              {initialData.street ? (
                <>
                  {initialData.street}<br />
                  {initialData.city}, {initialData.state} {initialData.zip}
                </>
              ) : (
                "Not set"
              )}
            </p>
          </div>

          <div>
            <Label className="text-muted-foreground">Equipment Types</Label>
            <div className="mt-1 flex flex-wrap gap-2">
              {initialData.equipmentTypes.length > 0 ? (
                initialData.equipmentTypes.map((type) => (
                  <span
                    key={type}
                    className="rounded-md bg-muted px-2 py-1 text-xs"
                  >
                    {type}
                  </span>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">None selected</p>
              )}
            </div>
          </div>

          <div>
            <Label className="text-muted-foreground">Service Radius</Label>
            <p className="mt-1 text-sm">{initialData.serviceRadius} miles</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Admin editable form
  return (
    <Card>
      <CardHeader>
        <CardTitle>Company Profile</CardTitle>
        <CardDescription>
          Update your company&apos;s location, equipment types, and service area
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-4">
            <Label className="text-base font-medium">Headquarters Address</Label>

            <div className="space-y-2">
              <Label htmlFor="street">Street Address</Label>
              <Input
                id="street"
                placeholder="123 Main St"
                {...register("street")}
              />
              {errors.street && (
                <p className="text-sm text-destructive">{errors.street.message}</p>
              )}
            </div>

            <div className="grid grid-cols-6 gap-3">
              <div className="col-span-3 space-y-2">
                <Label htmlFor="city">City</Label>
                <Input id="city" placeholder="Dallas" {...register("city")} />
                {errors.city && (
                  <p className="text-sm text-destructive">{errors.city.message}</p>
                )}
              </div>

              <div className="col-span-1 space-y-2">
                <Label htmlFor="state">State</Label>
                <Select
                  value={stateValue}
                  onValueChange={(val) => setValue("state", val ?? "", { shouldValidate: true, shouldDirty: true })}
                >
                  <SelectTrigger id="state">
                    <SelectValue placeholder="TX" />
                  </SelectTrigger>
                  <SelectContent>
                    {US_STATES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.state && (
                  <p className="text-sm text-destructive">{errors.state.message}</p>
                )}
              </div>

              <div className="col-span-2 space-y-2">
                <Label htmlFor="zip">ZIP Code</Label>
                <Input id="zip" placeholder="75201" maxLength={10} {...register("zip")} />
                {errors.zip && (
                  <p className="text-sm text-destructive">{errors.zip.message}</p>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Equipment Types</Label>
            <Controller
              name="equipmentTypes"
              control={control}
              render={({ field }) => (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {equipmentTypes.map((type) => {
                    const isChecked = field.value?.includes(type) ?? false;
                    return (
                      <label
                        key={type}
                        className="flex cursor-pointer items-center space-x-2 rounded-md border p-3 hover:bg-accent"
                      >
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={(checked) => {
                            const current = field.value ?? [];
                            if (checked) {
                              field.onChange([...current, type]);
                            } else {
                              field.onChange(
                                current.filter((t: string) => t !== type)
                              );
                            }
                          }}
                        />
                        <Label className="cursor-pointer text-sm font-normal">
                          {type}
                        </Label>
                      </label>
                    );
                  })}
                </div>
              )}
            />
            {errors.equipmentTypes && (
              <p className="text-sm text-destructive">
                {errors.equipmentTypes.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="serviceRadius">Service Radius (miles)</Label>
            <Input
              id="serviceRadius"
              type="number"
              min={10}
              max={500}
              {...register("serviceRadius", { valueAsNumber: true })}
            />
            {errors.serviceRadius && (
              <p className="text-sm text-destructive">
                {errors.serviceRadius.message}
              </p>
            )}
          </div>

          <div className="space-y-4">
            <Label className="text-base font-medium">Target Project Value Range</Label>
            <p className="text-sm text-muted-foreground">
              Set the project value range you typically pursue. This improves lead scoring.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="targetProjectValueMin">Minimum ($)</Label>
                <Input
                  id="targetProjectValueMin"
                  type="number"
                  min={0}
                  placeholder="e.g. 10000"
                  {...register("targetProjectValueMin", {
                    setValueAs: (v: string) => (v === "" ? null : parseInt(v, 10)),
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="targetProjectValueMax">Maximum ($)</Label>
                <Input
                  id="targetProjectValueMax"
                  type="number"
                  min={0}
                  placeholder="e.g. 500000"
                  {...register("targetProjectValueMax", {
                    setValueAs: (v: string) => (v === "" ? null : parseInt(v, 10)),
                  })}
                />
              </div>
            </div>
          </div>

          <Button type="submit" disabled={!isDirty || isSubmitting}>
            {isSubmitting ? "Saving..." : "Save Changes"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
