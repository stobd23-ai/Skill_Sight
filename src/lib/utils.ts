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

/**
 * Parse required_skills from either format:
 * - New array format: [{name, weight, required_level, priority}]
 * - Old object format: {skillName: level}
 * Returns normalized array of {name, required_level, weight, priority}
 */
export function parseRequiredSkills(raw: any): { name: string; required_level: number; weight: number; priority?: string; note?: string }[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((s: any) => ({
      name: s.name || '',
      required_level: s.required_level ?? s.required ?? 2,
      weight: s.weight ?? 0.5,
      priority: s.priority,
      note: s.note,
    }));
  }
  // Old object format
  return Object.entries(raw).map(([name, level]) => ({
    name,
    required_level: typeof level === 'number' ? level : 2,
    weight: 0.5,
  }));
}

/**
 * Convert required_skills to SkillVector {name: level} for algorithm consumption
 */
export function skillsToVector(raw: any): Record<string, number> {
  const parsed = parseRequiredSkills(raw);
  const vec: Record<string, number> = {};
  parsed.forEach(s => { if (s.name) vec[s.name] = s.required_level; });
  return vec;
}

/**
 * Convert required_skills to weights vector {name: weight}
 */
export function skillsToWeights(raw: any): Record<string, number> {
  const parsed = parseRequiredSkills(raw);
  const vec: Record<string, number> = {};
  parsed.forEach(s => { if (s.name) vec[s.name] = s.weight; });
  return vec;
}
