"use client";

import { useTransition } from "react";
import { updateLeadStatus } from "@/actions/lead-status";
import type { LeadStatus } from "@/lib/db/schema/lead-statuses";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const STATUS_OPTIONS: { value: LeadStatus; label: string; color: string }[] = [
  { value: "new", label: "New", color: "bg-gray-400" },
  { value: "viewed", label: "Viewed", color: "bg-blue-500" },
  { value: "contacted", label: "Contacted", color: "bg-amber-500" },
  { value: "won", label: "Won", color: "bg-green-500" },
  { value: "lost", label: "Lost", color: "bg-red-500" },
];

interface LeadStatusSelectProps {
  leadId: string;
  currentStatus: LeadStatus;
}

export function LeadStatusSelect({
  leadId,
  currentStatus,
}: LeadStatusSelectProps) {
  const [isPending, startTransition] = useTransition();

  function handleChange(newStatus: LeadStatus | null) {
    if (!newStatus || newStatus === currentStatus) return;

    startTransition(async () => {
      try {
        await updateLeadStatus(leadId, newStatus);
        toast.success("Status updated");
      } catch {
        toast.error("Failed to update status");
      }
    });
  }

  return (
    <div className="relative inline-flex items-center gap-1.5">
      {isPending && (
        <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
      )}
      <Select value={currentStatus} onValueChange={handleChange}>
        <SelectTrigger size="sm" className="gap-1.5">
          <StatusDot status={currentStatus} />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              <StatusDot status={opt.value} />
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function StatusDot({ status }: { status: LeadStatus }) {
  const option = STATUS_OPTIONS.find((o) => o.value === status);
  return (
    <span
      className={`inline-block size-2 shrink-0 rounded-full ${option?.color ?? "bg-gray-400"}`}
    />
  );
}
