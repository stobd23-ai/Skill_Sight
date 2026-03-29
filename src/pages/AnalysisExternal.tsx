import { useParams, useNavigate } from "react-router-dom";
import { formatSkillName } from "@/lib/utils";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { ReadinessRing } from "@/components/ReadinessRing";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, UserPlus, Target, Zap, Brain, BarChart3, Shield, TrendingUp, FileText, CheckCircle, AlertTriangle, Circle } from "lucide-react";

export default function AnalysisExternal() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: candidate, isLoading } = useQuery({
    queryKey: ["external_candidate", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("external_candidates")
        .select("*, roles(title, required_skills, strategic_weights)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const [report, setReport] = useState<string | null>(null);

  useEffect(() => {
    if (candidate?.full_algorithm_results) {
      const results = candidate.full_algorithm_results as any;
      setReport(results.reportMarkdown || null);
    }
  }, [candidate]);

  if (isLoading) return <div className="flex items-center justify-center h-64"><LoadingSpinner /></div>;
  if (!candidate) return <div className="p-6">Candidate not found.</div>;

  const results = (candidate.full_algorithm_results || {}) as any;
  const role = candidate.roles as any;
  const interviewCompleted = candidate.status === "completed";
  const technicalMatch = results.technicalMatch != null ? Math.round(results.technicalMatch * 100) : null;
  const capabilityMatch = results.capabilityMatch != null ? Math.round(results.capabilityMatch * 100) : null;
  const rawMomentum = results.momentumScore;
  const hasMomentum = rawMomentum != null && rawMomentum > 0 && interviewCompleted;
  const momentumScore = hasMomentum ? Math.round(rawMomentum * 100) : null;
  const transitionProfile = results.transitionProfile;

  // Compute displayed score: exclude momentum when unavailable
  let displayedScore: number | null = null;
  if (technicalMatch != null && capabilityMatch != null) {
    if (hasMomentum && momentumScore != null) {
      // Full three-layer
      displayedScore = candidate.full_three_layer_score != null
        ? Math.round(candidate.full_three_layer_score * 100)
        : Math.round((technicalMatch + capabilityMatch + momentumScore) / 3);
    } else {
      // Partial: tech + capability only
      displayedScore = Math.round((technicalMatch * 0.5) + (capabilityMatch * 0.5));
    }
  }

  // Report prerequisites
  const hasRole = !!candidate.role_id && !!role?.title;
  const hasAlgorithmResults = !!(results.technicalMatch != null || results.overallReadiness != null);
  const canGenerateReport = hasRole && interviewCompleted && hasAlgorithmResults;

  return (
    <div>
      <PageHeader
        title={candidate.name}
        subtitle="External Candidate Assessment"
        actions={
          <Button variant="outline" size="sm" onClick={() => navigate("/employees")}>
            <ArrowLeft className="h-4 w-4 mr-1" />Back to List
          </Button>
        }
      />
      <div className="p-6 space-y-6">
        {/* Banner */}
        <div className="rounded-lg border-l-4 border-primary p-4 bg-primary/5 flex items-center gap-4">
          <UserPlus className="w-6 h-6 text-primary shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold">External Candidate Assessment — {candidate.name}</p>
            <p className="text-xs text-muted-foreground">
              Applied for: {role?.title || "Unknown"} |
              Assessment: {interviewCompleted ? "CV + Interview" : "CV Only"}
            </p>
          </div>
          <Badge variant={interviewCompleted ? "default" : "secondary"}>
            {interviewCompleted ? "Complete" : candidate.status}
          </Badge>
        </div>

        {/* Transition profile banner */}
        {transitionProfile?.is_transitioning && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 flex items-start gap-3">
            <TrendingUp className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-primary">
                Active Transition Profile — {transitionProfile.transition_stage === "mid" ? "Mid-Transition" : transitionProfile.transition_stage === "late" ? "Late-Stage" : "Early Transition"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{transitionProfile.maturity_note}</p>
            </div>
          </div>
        )}

        {/* Three-layer score */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <Card className="lg:col-span-1">
            <CardContent className="p-6 flex flex-col items-center justify-center">
              <ReadinessRing value={displayedScore || 0} size="lg" />
              <p className="mt-3 text-sm font-bold">Overall Readiness</p>
              <p className="text-xs text-muted-foreground">
                {hasMomentum ? "Three-Layer Score" : "Partial Score"}
              </p>
              {!hasMomentum && (
                <p className="text-[11px] mt-1 text-center" style={{ color: "hsl(var(--amber, 45 93% 47%))" }}>
                  Partial Score — CV only. Momentum assessment requires interview.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 space-y-2">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Technical Match</span>
              </div>
              <p className="text-2xl font-bold font-mono">{technicalMatch ?? "—"}%</p>
              <p className="text-[11px] text-muted-foreground">Keyword and skill overlap</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 space-y-2">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Capability Match</span>
              </div>
              <p className="text-2xl font-bold font-mono">{capabilityMatch ?? "—"}%</p>
              <p className="text-[11px] text-muted-foreground">Behavioral inference</p>
            </CardContent>
          </Card>

          {/* Momentum card — gray placeholder when no interview */}
          <Card>
            <CardContent className="p-5 space-y-2">
              <div className="flex items-center gap-2">
                <Zap className={`w-4 h-4 ${hasMomentum ? "text-primary" : "text-muted-foreground"}`} />
                <span className="text-sm font-medium">Momentum</span>
              </div>
              {hasMomentum ? (
                <>
                  <p className="text-2xl font-bold font-mono">{momentumScore}%</p>
                  <p className="text-[11px] text-muted-foreground">Growth trajectory</p>
                </>
              ) : (
                <>
                  <p className="text-2xl font-bold font-mono text-muted-foreground">—</p>
                  <p className="text-[11px] text-muted-foreground italic">Pending Interview</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Gap analysis */}
        {results.gap && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />Skill Gap Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs mb-2">Critical Gaps</p>
                  {results.gap.criticalGaps?.slice(0, 5).map((g: any) => (
                    <div key={g.skill} className="flex justify-between py-1 border-b border-border last:border-0">
                      <span className="text-xs">{g.skill}</span>
                      <Badge variant={g.priority === "critical" ? "destructive" : "secondary"} className="text-[9px]">{g.priority}</Badge>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-2">Surplus Skills</p>
                  {results.gap.surplusSkills?.slice(0, 5).map((s: any) => (
                    <div key={s.skill} className="flex justify-between py-1 border-b border-border last:border-0">
                      <span className="text-xs">{formatSkillName(s.skill)}</span>
                      <span className="text-xs text-green-600 font-mono">+{s.surplus}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* AI Report — conditional on prerequisites */}
        {report && canGenerateReport ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="w-4 h-4" />AI Assessment Report
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none text-sm">
                {report.split("\n").map((line, i) => {
                  if (line.startsWith("## ")) return <h2 key={i} className="text-base font-bold mt-4 mb-2">{line.replace("## ", "")}</h2>;
                  if (line.startsWith("### ")) return <h3 key={i} className="text-sm font-bold mt-3 mb-1">{line.replace("### ", "")}</h3>;
                  if (line.startsWith("**") && line.endsWith("**")) return <p key={i} className="font-semibold mt-2">{line.replace(/\*\*/g, "")}</p>;
                  if (line.startsWith("- ")) return <p key={i} className="ml-4 text-muted-foreground">• {line.replace("- ", "")}</p>;
                  if (line.startsWith("---")) return <hr key={i} className="my-3" />;
                  if (line.trim() === "") return <br key={i} />;
                  return <p key={i} className="text-muted-foreground">{line}</p>;
                })}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-8 flex flex-col items-center text-center space-y-4">
              <FileText className="w-12 h-12 text-muted-foreground" />
              <div>
                <p className="text-base font-semibold">Report Pending</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-md">
                  The full AI assessment report generates automatically after the candidate completes their interview.
                </p>
              </div>
              <div className="space-y-2 text-left text-sm w-full max-w-xs">
                <div className="flex items-center gap-2">
                  {results.technicalMatch != null ? (
                    <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                  ) : (
                    <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}
                  <span className={results.technicalMatch != null ? "text-green-600" : "text-muted-foreground"}>
                    CV submitted and scored
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {hasRole ? (
                    <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                  )}
                  <span className={hasRole ? "text-green-600" : "text-amber-600"}>
                    {hasRole ? "Role assigned" : "⚠ Role not assigned"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {interviewCompleted ? (
                    <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                  ) : (
                    <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}
                  <span className={interviewCompleted ? "text-green-600" : "text-muted-foreground"}>
                    Interview completed
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {report && canGenerateReport ? (
                    <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                  ) : (
                    <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}
                  <span className="text-muted-foreground">Report generated</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}