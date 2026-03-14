import { Badge } from "@/components/ui/badge";
import type { TimelineWindow } from "@/lib/leads/types";

interface LeadTimelineProps {
  timeline: TimelineWindow[];
}

export function LeadTimeline({ timeline }: LeadTimelineProps) {
  if (timeline.length === 0) {
    return null;
  }

  return (
    <div className="relative space-y-6 border-l-2 border-muted pl-4">
      {timeline.map((window, index) => (
        <div key={index} className="relative">
          {/* Dot on the timeline line */}
          <div className="absolute -left-[calc(1rem+5px)] top-1 h-2.5 w-2.5 rounded-full border-2 border-background bg-muted-foreground" />

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{window.phase}</span>
              <UrgencyBadge urgency={window.urgency} />
            </div>

            <p className="text-xs text-muted-foreground">
              {window.equipment.join(", ")}
            </p>

            <p className="text-xs text-muted-foreground/70">
              {window.description}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function UrgencyBadge({ urgency }: { urgency: TimelineWindow["urgency"] }) {
  switch (urgency) {
    case "Now":
      return <Badge variant="destructive">Now</Badge>;
    case "Soon":
      return (
        <Badge variant="outline" className="text-yellow-600 border-yellow-300">
          Soon
        </Badge>
      );
    case "Later":
      return <Badge variant="secondary">Later</Badge>;
  }
}
