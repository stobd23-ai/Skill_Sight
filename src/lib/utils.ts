import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Known acronyms to preserve during skill name formatting
const KNOWN_ACRONYMS = new Set(["EV", "BMS", "ROS", "AUTOSAR", "ADAS", "SOC", "SOH", "ISO", "TÜV", "ML", "AI", "CV", "FEA", "CAD", "GPU", "CI", "CD", "AWS", "GCP"]);

export function formatSkillName(raw: string): string {
  if (!raw) return raw;
  let formatted = raw.replace(/([a-z])([A-Z])/g, "$1 $2");
  formatted = formatted.replace(/_/g, " ");
  return formatted
    .split(/\s+/)
    .map(word => {
      const upper = word.toUpperCase();
      if (KNOWN_ACRONYMS.has(upper)) return upper;
      if (word.length <= 1) return word.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}
