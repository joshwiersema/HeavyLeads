"use client";

import { useRef, useEffect, useCallback } from "react";
import { APIProvider, useMapsLibrary } from "@vis.gl/react-google-maps";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { COMPANY_SIZES } from "@/lib/onboarding/config";
import { US_STATES } from "@/lib/validators/onboarding";
import type { WizardState, WizardAction } from "@/lib/onboarding/types";

export interface WizardStepProps {
  state: WizardState;
  dispatch: React.Dispatch<WizardAction>;
}

// ---------------------------------------------------------------------------
// Address form with optional Google Places Autocomplete
// ---------------------------------------------------------------------------

function AddressFieldsWithAutocomplete({
  state,
  dispatch,
}: WizardStepProps) {
  const places = useMapsLibrary("places");
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  const handlePlaceChanged = useCallback(() => {
    const ac = autocompleteRef.current;
    if (!ac) return;

    const place = ac.getPlace();
    if (!place?.address_components) return;

    let street = "";
    let city = "";
    let usState = "";
    let zip = "";

    for (const component of place.address_components) {
      const types = component.types;
      if (types.includes("street_number")) {
        street = component.long_name;
      } else if (types.includes("route")) {
        street = street ? `${street} ${component.short_name}` : component.short_name;
      } else if (types.includes("locality")) {
        city = component.long_name;
      } else if (types.includes("administrative_area_level_1")) {
        usState = component.short_name;
      } else if (types.includes("postal_code")) {
        zip = component.long_name;
      }
    }

    const lat = place.geometry?.location?.lat() ?? null;
    const lng = place.geometry?.location?.lng() ?? null;

    dispatch({
      type: "SET_FIELDS",
      fields: {
        street,
        city,
        state: usState,
        zip,
        serviceAreaLat: lat,
        serviceAreaLng: lng,
      },
    });
  }, [dispatch]);

  useEffect(() => {
    if (!places || !inputRef.current || autocompleteRef.current) return;

    const ac = new places.Autocomplete(inputRef.current, {
      types: ["address"],
      componentRestrictions: { country: "us" },
      fields: ["address_components", "geometry"],
    });

    ac.addListener("place_changed", handlePlaceChanged);
    autocompleteRef.current = ac;

    return () => {
      google.maps.event.clearInstanceListeners(ac);
    };
  }, [places, handlePlaceChanged]);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="street">Street Address</Label>
        <Input
          ref={inputRef}
          id="street"
          placeholder="Start typing your address..."
          value={state.street}
          onChange={(e) =>
            dispatch({ type: "SET_FIELD", field: "street", value: e.target.value })
          }
        />
      </div>

      <div className="grid grid-cols-6 gap-3">
        <div className="col-span-3 space-y-2">
          <Label htmlFor="city">City</Label>
          <Input
            id="city"
            placeholder="Dallas"
            value={state.city}
            onChange={(e) =>
              dispatch({ type: "SET_FIELD", field: "city", value: e.target.value })
            }
          />
        </div>

        <div className="col-span-1 space-y-2">
          <Label htmlFor="state">State</Label>
          <Select
            value={state.state}
            onValueChange={(val) =>
              dispatch({ type: "SET_FIELD", field: "state", value: val ?? "" })
            }
          >
            <SelectTrigger id="state" className="w-full">
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
        </div>

        <div className="col-span-2 space-y-2">
          <Label htmlFor="zip">ZIP Code</Label>
          <Input
            id="zip"
            placeholder="75201"
            maxLength={10}
            value={state.zip}
            onChange={(e) =>
              dispatch({ type: "SET_FIELD", field: "zip", value: e.target.value })
            }
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fallback manual address form (no Google API key)
// ---------------------------------------------------------------------------

function ManualAddressFields({ state, dispatch }: WizardStepProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="street">Street Address</Label>
        <Input
          id="street"
          placeholder="123 Main St"
          value={state.street}
          onChange={(e) =>
            dispatch({ type: "SET_FIELD", field: "street", value: e.target.value })
          }
        />
      </div>

      <div className="grid grid-cols-6 gap-3">
        <div className="col-span-3 space-y-2">
          <Label htmlFor="city">City</Label>
          <Input
            id="city"
            placeholder="Dallas"
            value={state.city}
            onChange={(e) =>
              dispatch({ type: "SET_FIELD", field: "city", value: e.target.value })
            }
          />
        </div>

        <div className="col-span-1 space-y-2">
          <Label htmlFor="state">State</Label>
          <Select
            value={state.state}
            onValueChange={(val) =>
              dispatch({ type: "SET_FIELD", field: "state", value: val ?? "" })
            }
          >
            <SelectTrigger id="state" className="w-full">
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
        </div>

        <div className="col-span-2 space-y-2">
          <Label htmlFor="zip">ZIP Code</Label>
          <Input
            id="zip"
            placeholder="75201"
            maxLength={10}
            value={state.zip}
            onChange={(e) =>
              dispatch({ type: "SET_FIELD", field: "zip", value: e.target.value })
            }
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CompanyBasics step -- main export
// ---------------------------------------------------------------------------

export function CompanyBasics({ state, dispatch }: WizardStepProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Company Basics</h2>
        <p className="text-sm text-muted-foreground">
          Tell us about your company so we can personalize your lead feed
        </p>
      </div>

      {/* Company Name */}
      <div className="space-y-2">
        <Label htmlFor="companyName">Company Name</Label>
        <Input
          id="companyName"
          placeholder="Acme Equipment Co."
          value={state.companyName}
          onChange={(e) =>
            dispatch({
              type: "SET_FIELD",
              field: "companyName",
              value: e.target.value,
            })
          }
        />
      </div>

      {/* Company Size */}
      <div className="space-y-2">
        <Label htmlFor="companySize">Company Size</Label>
        <Select
          value={state.companySize}
          onValueChange={(val) =>
            dispatch({ type: "SET_FIELD", field: "companySize", value: val ?? "" })
          }
        >
          <SelectTrigger id="companySize" className="w-full">
            <SelectValue placeholder="Select company size" />
          </SelectTrigger>
          <SelectContent>
            {COMPANY_SIZES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Years in Business */}
      <div className="space-y-2">
        <Label htmlFor="yearsInBusiness">Years in Business</Label>
        <Input
          id="yearsInBusiness"
          type="number"
          placeholder="e.g. 15"
          min={0}
          max={200}
          value={state.yearsInBusiness ?? ""}
          onChange={(e) => {
            const raw = e.target.value;
            dispatch({
              type: "SET_FIELD",
              field: "yearsInBusiness",
              value: raw === "" ? null : parseInt(raw, 10),
            });
          }}
        />
      </div>

      {/* Address */}
      <div>
        <h3 className="mb-2 text-base font-medium">
          Headquarters Address
        </h3>
        <p className="mb-3 text-sm text-muted-foreground">
          We&apos;ll use this to find leads near your location
        </p>
        {apiKey ? (
          <APIProvider apiKey={apiKey}>
            <AddressFieldsWithAutocomplete state={state} dispatch={dispatch} />
          </APIProvider>
        ) : (
          <ManualAddressFields state={state} dispatch={dispatch} />
        )}
      </div>
    </div>
  );
}
