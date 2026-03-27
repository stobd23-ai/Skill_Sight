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

  const color =
    value < 50 ? "hsl(0, 84%, 60%)" : value < 75 ? "hsl(32, 95%, 44%)" : "hsl(142, 71%, 35%)";

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
          stroke="hsl(0, 0%, 93%)"
          strokeWidth={config.stroke}
        />
        <circle
          cx={config.total / 2}
          cy={config.total / 2}
          r={config.radius}
          fill="none"
          stroke={color}
          strokeWidth={config.stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <span
        className="absolute font-mono font-semibold"
        style={{
          fontSize: config.fontSize,
          lineHeight: `${config.total}px`,
          width: config.total,
          textAlign: "center",
        }}
      >
        {value}%
      </span>
      {label && size !== "sm" && (
        <span className="text-[11px] text-muted-foreground mt-0.5">{label}</span>
      )}
    </div>
  );
}
