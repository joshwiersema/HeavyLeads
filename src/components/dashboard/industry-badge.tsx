import type { Industry } from "@/lib/onboarding/types";

const INDUSTRY_COLORS: Record<Industry, { bg: string; text: string }> = {
  heavy_equipment: {
    bg: "bg-amber-100 dark:bg-amber-900/30",
    text: "text-amber-800 dark:text-amber-300",
  },
  hvac: {
    bg: "bg-blue-100 dark:bg-blue-900/30",
    text: "text-blue-800 dark:text-blue-300",
  },
  roofing: {
    bg: "bg-red-100 dark:bg-red-900/30",
    text: "text-red-800 dark:text-red-300",
  },
  solar: {
    bg: "bg-yellow-100 dark:bg-yellow-900/30",
    text: "text-yellow-800 dark:text-yellow-300",
  },
  electrical: {
    bg: "bg-purple-100 dark:bg-purple-900/30",
    text: "text-purple-800 dark:text-purple-300",
  },
};

const INDUSTRY_LABELS: Record<Industry, string> = {
  heavy_equipment: "Heavy Equipment",
  hvac: "HVAC",
  roofing: "Roofing",
  solar: "Solar",
  electrical: "Electrical",
};

interface IndustryBadgeProps {
  industry: Industry;
}

export function IndustryBadge({ industry }: IndustryBadgeProps) {
  const colors = INDUSTRY_COLORS[industry];
  const label = INDUSTRY_LABELS[industry];

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors.bg} ${colors.text}`}
    >
      {label}
    </span>
  );
}
