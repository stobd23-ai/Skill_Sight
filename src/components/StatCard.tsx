import { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown } from "lucide-react";

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  subtitle?: string;
  trend?: { value: number; direction: "up" | "down" };
  color?: string;
}

const colorMap: Record<string, { bg: string; text: string }> = {
  blue: { bg: "bg-bmw-blue/10", text: "text-bmw-blue" },
  green: { bg: "bg-status-green-light", text: "text-status-green" },
  amber: { bg: "bg-status-amber-light", text: "text-status-amber" },
  red: { bg: "bg-status-red-light", text: "text-status-red" },
};

export function StatCard({ icon: Icon, label, value, subtitle, trend, color = "blue" }: StatCardProps) {
  const colors = colorMap[color] || colorMap.blue;

  return (
    <div className="card-skillsight p-5 animate-fade-in">
      <div className="flex items-start justify-between">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center ${colors.bg}`}>
          <Icon className={`h-[18px] w-[18px] ${colors.text}`} />
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-medium ${
            trend.direction === "up" ? "text-status-green" : "text-status-red"
          }`}>
            {trend.direction === "up" ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            <span className="font-mono">{trend.value}%</span>
          </div>
        )}
      </div>
      <div className="mt-3">
        <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
        <p className="text-[28px] font-bold font-mono leading-tight mt-0.5">{value}</p>
        {subtitle && (
          <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
