import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useEmployee, useEmployeeSkills, useAlgorithmResults } from "@/hooks/useData";
import { supabase } from "@/integrations/supabase/client";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { EmptyState } from "@/components/EmptyState";
import { ReadinessRing } from "@/components/ReadinessRing";
import { SkillBadge } from "@/components/SkillBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer } from "recharts";
import { BarChart3, Sparkles, Star, Route } from "lucide-react";
import { useEffect, useState } from "react";

export default function MyResults() {
  const { profile } = useAuth();
  const employeeId = profile?.employee_id;
  const { data: employee, isLoading: empLoading } = useEmployee(employeeId || undefined);
  const { data: skills } = useEmployeeSkills(employeeId || undefined);
  const { data: results } = useAlgorithmResults(employeeId || undefined);

  const [report, setReport] = useState<string | null>(null);

  const latestResult = results?.[0];
  const readiness = latestResult
    ? Math.round((latestResult.final_readiness || latestResult.overall_readiness || 0) * 100)
    : 0;

  const gapAnalysis = latestResult?.gap_analysis as any;
  const upskillingPaths = (latestResult?.upskilling_paths || []) as Array<{
    targetSkill: string;
    path: string[];
    totalWeeks: number;
  }>;

  // Fetch report
  useEffect(() => {
    if (!employeeId) return;
    supabase
      .from("reports")
      .select("report_markdown")
      .eq("employee_id", employeeId)
      .order("generated_at", { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (data?.[0]?.report_markdown) setReport(data[0].report_markdown);
      });
  }, [employeeId]);

  const radarData = useMemo(() => {
    if (!skills?.length) return [];
    return skills.map(s => ({
      skill: s.skill_name.replace(/([A-Z])/g, " $1").trim(),
      value: s.proficiency || 0,
    }));
  }, [skills]);

  // Filter report to only show employee-safe sections
  const filteredReport = useMemo(() => {
    if (!report) return null;
    const lines = report.split("\n");
    const safeSections: string[] = [];
    let inSafeSection = false;
    let skipSection = false;

    for (const line of lines) {
      // Detect section headers
      if (line.startsWith("## ") || line.startsWith("### ")) {
        const header = line.toLowerCase();
        if (
          header.includes("summary") ||
          header.includes("strength") ||
          header.includes("distinctive") ||
          header.includes("overview")
        ) {
          inSafeSection = true;
          skipSection = false;
        } else if (
          header.includes("succession") ||
          header.includes("hr action") ||
          header.includes("gap") ||
          header.includes("ranking") ||
          header.includes("manager") ||
          header.includes("recommendation") ||
          header.includes("readiness breakdown") ||
          header.includes("action plan") ||
          header.includes("90-day") ||
          header.includes("90 day") ||
          header.includes("6-month") ||
          header.includes("6 month") ||
          header.includes("roadmap")
        ) {
          inSafeSection = false;
          skipSection = true;
        }
      }

      if (inSafeSection && !skipSection) {
        safeSections.push(line);
      }
    }

    return safeSections.join("\n") || null;
  }, [report]);

  if (empLoading) return <div className="flex items-center justify-center h-64"><LoadingSpinner /></div>;

  if (!latestResult) {
    return (
      <div className="p-6">
        <EmptyState
          icon={BarChart3}
          title="Your results will appear here"
          description="After your assessment is complete, you'll see your development score and personalised learning journey."
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Development Score */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-6">
            <ReadinessRing value={readiness} size="lg" label="Your Development Score" />
            <div>
              <h2 className="text-lg font-bold">Your Development Score</h2>
              <p className="text-sm text-muted-foreground mt-1">
                This score reflects how your current skills align with your next career opportunity at BMW.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Skills Radar */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Your Skills Profile</CardTitle>
          </CardHeader>
          <CardContent>
            {radarData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="skill" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                  <Radar name="Your Skills" dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-12">No skills data available</p>
            )}
          </CardContent>
        </Card>

        {/* Key Strengths */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Star className="h-4 w-4 text-status-amber" /> Your Key Strengths
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {gapAnalysis?.surplusSkills?.length ? (
                gapAnalysis.surplusSkills.map((s: any, i: number) => (
                  <Badge
                    key={i}
                    className="bg-status-green-light text-status-green border-status-green/20"
                  >
                    {s.skill.replace(/([A-Z])/g, " $1").trim()} +{s.surplus}
                  </Badge>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Complete your assessment to discover your strengths</p>
              )}
            </div>

            {/* Verified skills */}
            {skills && skills.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-purple-500" /> Verified Skills
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {skills
                    .filter(s => (s.proficiency || 0) >= 2)
                    .map(s => (
                      <SkillBadge key={s.id} skill={s.skill_name} proficiency={(s.proficiency || 0) as 0 | 1 | 2 | 3} />
                    ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Learning Journey */}
      {upskillingPaths.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Route className="h-4 w-4 text-primary" /> Your Learning Journey
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {upskillingPaths.map((path, i) => (
                <div key={i}>
                  <Badge variant="outline" className="text-xs font-medium mb-2">
                    {path.targetSkill.replace(/([A-Z])/g, " $1").trim()}
                  </Badge>
                  <div className="flex items-center gap-1 flex-wrap">
                    {path.path.map((node, j) => (
                      <div key={j} className="flex items-center gap-1">
                        <span className="px-2 py-0.5 text-xs rounded-md bg-primary/10 text-primary font-medium">
                          {node.replace(/([A-Z])/g, " $1").trim()}
                        </span>
                        {j < path.path.length - 1 && (
                          <span className="text-muted-foreground text-xs">→</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filtered AI Report */}
      {filteredReport && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Your Personalised Development Plan</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="prose prose-sm max-w-none prose-headings:text-foreground prose-p:text-foreground/80"
              dangerouslySetInnerHTML={{ __html: markdownToHtml(filteredReport) }}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function markdownToHtml(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold mt-4 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold mt-4 mb-3">$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/\n\n/g, '</p><p class="mb-3">')
    .replace(/^(?!<[hlu]|<li)(.+)$/gm, '<p class="mb-3">$1</p>');
}
