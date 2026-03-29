import { cn } from "@/lib/utils";

type Priority = "critical" | "high" | "medium" | "low";

interface PriorityBadgeProps {
  priority: Priority;
}

const priorityConfig: Record<Priority, { bg: string; text: string; label: string }> = {
  critical: { bg: "bg-status-red-light", text: "text-status-red", label: "Critical" },
  high: { bg: "bg-status-amber-light", text: "text-status-amber", label: "High" },
  medium: { bg: "bg-status-orange-light", text: "text-status-orange", label: "Medium" },
  low: { bg: "bg-secondary", text: "text-muted-foreground", label: "Low" },
};

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  const config = priorityConfig[priority] || priorityConfig.low;

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold",
        config.bg,
        config.text
      )}
    >
      {config.label}
    </span>
  );
}
