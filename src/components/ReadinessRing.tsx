import { useEffect, useState } from "react";

interface ReadinessRingProps {
  value: number;
  size?: "sm" | "md" | "lg";
  label?: string;
}

const sizeConfig = {
  sm: { total: 48, stroke: 4, fontSize: 12, radius: 18 },
  md: { total: 80, stroke: 5, fontSize: 18, radius: 32 },
  lg: { total: 120, stroke: 6, fontSize: 26, radius: 48 },
};

export function ReadinessRing({ value, size = "md", label }: ReadinessRingProps) {
  const [animatedValue, setAnimatedValue] = useState(0);
  const config = sizeConfig[size];
  const circumference = 2 * Math.PI * config.radius;
  const offset = circumference - (animatedValue / 100) * circumference;

  const colorClass =
    value < 50 ? "text-status-red" : value < 75 ? "text-status-amber" : "text-status-green";
  const strokeColor =
    value < 50 ? "hsl(var(--red))" : value < 75 ? "hsl(var(--amber))" : "hsl(var(--green))";

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedValue(value), 100);
    return () => clearTimeout(timer);
  }, [value]);

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: config.total, height: config.total }}>
      <svg width={config.total} height={config.total} className="-rotate-90">
        <circle
          cx={config.total / 2}
          cy={config.total / 2}
          r={config.radius}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth={config.stroke}
        />
        <circle
          cx={config.total / 2}
          cy={config.total / 2}
          r={config.radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={config.stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <span
        className={`absolute inset-0 flex items-center justify-center font-mono font-semibold ${colorClass}`}
        style={{ fontSize: config.fontSize }}
      >
        {value}%
      </span>
      </div>
      {label && size !== "sm" && (
        <span className="text-[11px] text-muted-foreground mt-0.5">{label}</span>
      )}
    </div>
  );
}
