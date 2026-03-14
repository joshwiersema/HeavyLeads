"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

export const LeadMap = dynamic(
  () => import("./lead-map").then((mod) => ({ default: mod.LeadMap })),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[300px] w-full rounded-lg" />,
  }
);
