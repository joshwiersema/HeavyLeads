"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  companySettingsSchema,
  type CompanySettingsInput,
} from "@/lib/validators/settings";
import { updateCompanyProfile } from "@/actions/settings";
import { EQUIPMENT_TYPES } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface CompanyFormProps {
  initialData: {
    hqAddress: string;
    equipmentTypes: string[];
    serviceRadius: number;
  };
  isAdmin: boolean;
}

export function CompanyForm({ initialData, isAdmin }: CompanyFormProps) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<CompanySettingsInput>({
    resolver: zodResolver(companySettingsSchema),
    defaultValues: initialData,
  });

  async function onSubmit(data: CompanySettingsInput) {
    try {
      const result = await updateCompanyProfile(data);
      if (result.success) {
        toast.success("Company profile updated");
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
            <Label className="text-muted-foreground">
              Headquarters Address
            </Label>
            <p className="mt-1 text-sm">{initialData.hqAddress || "Not set"}</p>
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
            <Label className="text-muted-foreground">
              Service Radius
            </Label>
            <p className="mt-1 text-sm">
              {initialData.serviceRadius} miles
            </p>
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
          <div className="space-y-2">
            <Label htmlFor="hqAddress">Headquarters Address</Label>
            <Input
              id="hqAddress"
              placeholder="123 Main St, City, State, ZIP"
              {...register("hqAddress")}
            />
            {errors.hqAddress && (
              <p className="text-sm text-destructive">
                {errors.hqAddress.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Equipment Types</Label>
            <Controller
              name="equipmentTypes"
              control={control}
              render={({ field }) => (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {EQUIPMENT_TYPES.map((type) => {
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

          <Button type="submit" disabled={!isDirty || isSubmitting}>
            {isSubmitting ? "Saving..." : "Save Changes"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
