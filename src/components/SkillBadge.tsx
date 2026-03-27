import { cn } from "@/lib/utils";

interface SkillBadgeProps {
  skill: string;
  proficiency: 0 | 1 | 2 | 3;
  showLabel?: boolean;
}

const proficiencyConfig = {
  0: { bg: "bg-secondary", text: "text-muted-foreground", label: "–" },
  1: { bg: "bg-status-amber-light", text: "text-amber-700", label: "Beginner" },
  2: { bg: "bg-bmw-blue/10", text: "text-bmw-blue", label: "Intermediate" },
  3: { bg: "bg-status-green-light", text: "text-status-green", label: "Expert" },
};

export function SkillBadge({ skill, proficiency, showLabel = true }: SkillBadgeProps) {
  const config = proficiencyConfig[proficiency];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium",
        config.bg,
        config.text
      )}
    >
      {skill}
      {showLabel && <span className="opacity-75">· {config.label}</span>}
    </span>
  );
}
