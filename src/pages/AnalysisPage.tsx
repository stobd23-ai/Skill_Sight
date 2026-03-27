import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState, useMemo, useCallback } from "react";
import { PageHeader } from "@/components/PageHeader";
import { ReadinessRing } from "@/components/ReadinessRing";
import { PriorityBadge } from "@/components/PriorityBadge";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { EmptyState } from "@/components/EmptyState";
import { EmployeeSelector } from "@/components/EmployeeSelector";
import { useEmployee, useEmployeeSkills, useAlgorithmResults, useRoles, useInterviews, useEmployees } from "@/hooks/useData";
import { supabase } from "@/integrations/supabase/client";
import { runFullAnalysis, type AlgorithmInput, type FullResults, type SkillVector } from "@/lib/algorithms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from "recharts";
import {
  ArrowLeft, Download, RefreshCw, ArrowRight, Sparkles, Target,
  BarChart3, Route, Star, AlertTriangle, Shield, ChevronDown, ChevronUp,
} from "lucide-react";

export default function AnalysisPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: employee, isLoading: empLoading } = useEmployee(id);
  const { data: skills } = useEmployeeSkills(id);
  const { data: results, refetch: refetchResults } = useAlgorithmResults(id);
  const { data: roles } = useRoles();
  const { data: interviews } = useInterviews(id);

  const [report, setReport] = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [localResults, setLocalResults] = useState<FullResults | null>(null);
  const [managerExpanded, setManagerExpanded] = useState(false);

  const latestResult = results?.[0];
  const managerInterview = interviews?.find(i => i.interview_type === 'manager' && i.status === 'completed');
  const targetRole = roles?.find(r => r.id === latestResult?.role_id);

  const algorithmInput = useMemo<AlgorithmInput | null>(() => {
    if (!employee || !targetRole || !skills) return null;
    const empSkills: SkillVector = {};
    skills.forEach(s => { empSkills[s.skill_name] = s.proficiency || 0; });
    const reqSkills = (targetRole.required_skills || {}) as SkillVector;
    const stratWeights = (targetRole.strategic_weights || {}) as SkillVector;
    return {
      employee: {
        id: employee.id, name: employee.name, skills: empSkills,
        performanceScore: employee.performance_score || 0.5,
        learningAgility: employee.learning_agility || 0.5,
        tenureYears: employee.tenure_years || 0,
      },
      targetRole: {
        id: targetRole.id, title: targetRole.title,
        requiredSkills: reqSkills, strategicWeights: stratWeights,
      },
      allRoles: roles?.map(r => ({ requiredSkills: (r.required_skills || {}) as SkillVector })),
    };
  }, [employee, targetRole, skills, roles]);

  useEffect(() => {
    if (algorithmInput && !latestResult) {
      const res = runFullAnalysis(algorithmInput);
      setLocalResults(res);
    }
  }, [algorithmInput, latestResult]);

  useEffect(() => {
    if (!id) return;
    supabase.from("reports").select("report_markdown").eq("employee_id", id).order("generated_at", { ascending: false }).limit(1)
      .then(({ data }) => { if (data?.[0]?.report_markdown) setReport(data[0].report_markdown); });
  }, [id]);

  const readiness = latestResult
    ? Math.round((latestResult.final_readiness || latestResult.overall_readiness || 0) * 100)
    : localResults ? Math.round(localResults.overallReadiness * 100) : 0;

  const gapAnalysis = latestResult?.gap_analysis
    ? latestResult.gap_analysis as unknown as { criticalGaps: Array<{ skill: string; currentProficiency: number; requiredProficiency: number; deficit: number; strategicWeight: number; weightedGap: number; priority: string }>; surplusSkills: Array<{ skill: string; current: number; required: number; surplus: number }>; normalizedGapScore: number; readinessPercent: number }
    : localResults?.gapAnalysis || null;

  const tfidfRarity = (latestResult?.tfidf_rarity || localResults?.tfidfRarity || {}) as Record<string, number>;
  const upskillingPaths = (latestResult?.upskilling_paths || localResults?.upskillingPaths || []) as Array<{ targetSkill: string; path: string[]; totalWeeks: number; startingFrom: string }>;

  const cosine = latestResult?.cosine_similarity ?? localResults?.cosineSimilarity ?? 0;
  const jaccBin = latestResult?.jaccard_binary ?? localResults?.jaccardBinary ?? 0;
  const jaccW = latestResult?.jaccard_weighted ?? localResults?.jaccardWeighted ?? 0;
  const gapScore = gapAnalysis?.normalizedGapScore ?? 0;
  const managerAdj = latestResult?.manager_readiness_adjustment ?? 0;

  const radarData = useMemo(() => {
    if (!targetRole?.required_skills || !skills) return [];
    const reqSkills = targetRole.required_skills as Record<string, number>;
    return Object.entries(reqSkills).map(([skill, required]) => {
      const empSkill = skills.find(s => s.skill_name === skill);
      return { skill: skill.replace(/([A-Z])/g, ' $1').trim(), employee: empSkill?.proficiency || 0, required };
    });
  }, [targetRole, skills]);

  const generateReport = useCallback(async () => {
    if (!employee || !targetRole) return;
    setReportLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-report", {
        body: {
          employeeName: employee.name,
          roleTitle: targetRole.title,
          algorithmResults: {
            cosineSimilarity: cosine, jaccardBinary: jaccBin, jaccardWeighted: jaccW,
            overallReadiness: latestResult?.overall_readiness ?? localResults?.overallReadiness ?? 0,
            finalReadiness: latestResult?.final_readiness ?? localResults?.overallReadiness ?? 0,
            managerAdjustment: managerAdj,
          },
          gapAnalysis, tfidfRarity, upskillingPaths,
          managerInsights: managerInterview ? {
            confidence: managerInterview.manager_confidence_score,
            potentialIndicators: managerInterview.potential_indicators,
            concerns: managerInterview.concerns,
            hiddenRole: managerInterview.hidden_role_suggestion,
          } : null,
        },
      });
      if (error) throw error;
      const md = data.report;
      setReport(md);
      await supabase.from("reports").insert({
        employee_id: id, role_id: targetRole.id,
        algorithm_result_id: latestResult?.id || null,
        report_markdown: md,
      });
    } catch (e) {
      console.error("Report generation failed:", e);
    } finally {
      setReportLoading(false);
    }
  }, [employee, targetRole, cosine, jaccBin, jaccW, gapAnalysis, tfidfRarity, upskillingPaths, managerInterview, latestResult, localResults, id, managerAdj]);

  if (!id) {
    return <EmployeeSelector title="Skills Analysis" subtitle="Select an employee to view their analysis" navigateTo="/analysis" />;
  }
  if (empLoading) return <div className="flex items-center justify-center h-64"><LoadingSpinner /></div>;
  if (!employee) return <div className="p-8 text-center text-muted-foreground">Employee not found</div>;

  return (
    <div>
      <PageHeader
        title={`${employee.name} — Skills Analysis`}
        subtitle={`${targetRole?.title || 'No role'} Assessment`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate(`/employees/${id}`)}>
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Profile
            </Button>
            <Button variant="outline" size="sm" onClick={generateReport} disabled={reportLoading}>
              <RefreshCw className={`h-3.5 w-3.5 ${reportLoading ? 'animate-spin' : ''}`} />
              {report ? 'Regenerate Report' : 'Generate Report'}
            </Button>
            {report && (
              <Button variant="outline" size="sm" onClick={() => {
                const blob = new Blob([report], { type: 'text/markdown' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = `${employee.name}_analysis.md`; a.click();
              }}>
                <Download className="h-3.5 w-3.5" /> Download
              </Button>
            )}
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* Algorithm Results Summary */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-8">
              <div className="flex flex-col items-center gap-1">
                <ReadinessRing value={readiness} size="lg" />
                <span className="text-xs text-muted-foreground mt-1">Final Readiness Score</span>
                <span className="text-[11px] text-muted-foreground">
                  Algorithmic: <span className="font-mono">{Math.round((latestResult?.overall_readiness ?? localResults?.overallReadiness ?? 0) * 100)}%</span>
                  {managerAdj !== 0 && <> + Manager: <span className="font-mono">{managerAdj > 0 ? '+' : ''}{Math.round(managerAdj * 100)}%</span></>}
                </span>
              </div>
              <div className="flex-1 grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard label="Profile Match" value={`${Math.round(cosine * 100)}%`} icon={<Target className="h-4 w-4" />} />
                <MetricCard label="Skill Coverage" value={`${Math.round(jaccBin * 100)}%`} icon={<Shield className="h-4 w-4" />} />
                <MetricCard label="Weighted Overlap" value={`${Math.round(jaccW * 100)}%`} icon={<BarChart3 className="h-4 w-4" />} />
                <MetricCard label="Strategic Gap" value={`${Math.round(gapScore * 100)}%`} icon={<AlertTriangle className="h-4 w-4" />} />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Skills Radar */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Skills Radar</CardTitle>
            </CardHeader>
            <CardContent>
              {radarData.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <RadarChart data={radarData} outerRadius="75%">
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis dataKey="skill" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                    <PolarRadiusAxis domain={[0, 3]} tick={{ fontSize: 9 }} />
                    <Radar name="Employee" dataKey="employee" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} />
                    <Radar name="Required" dataKey="required" stroke="hsl(var(--destructive))" fill="none" strokeDasharray="4 4" />
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-12">No role selected for comparison</p>
              )}
            </CardContent>
          </Card>

          {/* Priority Skill Gaps */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Priority Skill Gaps</CardTitle>
                {gapAnalysis?.criticalGaps && (
                  <Badge variant="secondary" className="text-xs">{gapAnalysis.criticalGaps.length} gaps</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {gapAnalysis?.criticalGaps?.slice(0, 6).map((gap, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <PriorityBadge priority={gap.priority as 'critical' | 'high' | 'medium' | 'low'} />
                    <span className="text-sm font-medium flex-1">{gap.skill.replace(/([A-Z])/g, ' $1').trim()}</span>
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="font-mono text-muted-foreground">{gap.currentProficiency}</span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <span className="font-mono font-semibold">{gap.requiredProficiency}</span>
                    </div>
                    <span className="text-[11px] text-muted-foreground font-mono w-10 text-right">
                      {(gap.strategicWeight * 100).toFixed(0)}%
                    </span>
                  </div>
                )) || <p className="text-sm text-muted-foreground">No gaps identified</p>}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Strengths + Rare Skills */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Star className="h-4 w-4 text-status-amber" /> Strengths Beyond Requirements
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {gapAnalysis?.surplusSkills?.length ? gapAnalysis.surplusSkills.map((s, i) => (
                  <Badge key={i} className="bg-status-green-light text-status-green border-status-green/20 hover:bg-status-green-light">
                    {s.skill.replace(/([A-Z])/g, ' $1').trim()} +{s.surplus}
                  </Badge>
                )) : <p className="text-sm text-muted-foreground">No surplus skills detected</p>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> Rare & Valuable Skills
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(tfidfRarity).length > 0
                  ? Object.entries(tfidfRarity).sort(([, a], [, b]) => b - a).slice(0, 5).map(([skill, score]) => {
                    const maxScore = Math.max(...Object.values(tfidfRarity), 0.01);
                    return (
                      <div key={skill} className="flex items-center gap-3">
                        <span className="text-xs w-28 truncate">{skill.replace(/([A-Z])/g, ' $1').trim()}</span>
                        <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                          <div className="h-full bg-primary/60 rounded-full" style={{ width: `${(score / maxScore) * 100}%` }} />
                        </div>
                        <span className="text-xs font-mono text-muted-foreground w-12 text-right">{score.toFixed(3)}</span>
                      </div>
                    );
                  })
                  : <p className="text-sm text-muted-foreground">TF-IDF scores not computed</p>}
              </div>
              <p className="text-[11px] text-muted-foreground mt-3">Higher score = rarer across BMW role catalog = more distinctively valuable</p>
            </CardContent>
          </Card>
        </div>

        {/* Learning Pathways */}
        {upskillingPaths.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Route className="h-4 w-4 text-primary" /> Learning Pathways
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {upskillingPaths.map((path, i) => (
                  <div key={i}>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className="text-xs font-medium">{path.targetSkill.replace(/([A-Z])/g, ' $1').trim()}</Badge>
                      <span className="text-[11px] text-muted-foreground font-mono">{path.totalWeeks} weeks total</span>
                    </div>
                    <div className="flex items-center gap-1 flex-wrap">
                      {path.path.map((node, j) => (
                        <div key={j} className="flex items-center gap-1">
                          <span className="px-2 py-0.5 text-xs rounded-md bg-primary/10 text-primary font-medium">
                            {node.replace(/([A-Z])/g, ' $1').trim()}
                          </span>
                          {j < path.path.length - 1 && (
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
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

        {/* Tabs: AI Report / Raw Scores */}
        <Tabs defaultValue="report">
          <TabsList>
            <TabsTrigger value="report">AI Report</TabsTrigger>
            <TabsTrigger value="raw">Raw Scores</TabsTrigger>
          </TabsList>

          <TabsContent value="report">
            <Card>
              <CardContent className="p-6">
                {reportLoading ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                      <span className="text-sm text-muted-foreground">Generating your personalised action plan…</span>
                    </div>
                    {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}
                  </div>
                ) : report ? (
                  <div className="prose prose-sm max-w-none prose-headings:text-foreground prose-p:text-foreground/80 prose-strong:text-foreground prose-li:text-foreground/80" dangerouslySetInnerHTML={{ __html: markdownToHtml(report) }} />
                ) : (
                  <div className="text-center py-12">
                    <Sparkles className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground mb-4">AI will interpret your algorithm results into an actionable plan.</p>
                    <Button onClick={generateReport} className="bg-primary text-primary-foreground">
                      Generate AI Report
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="raw">
            <Card>
              <CardContent className="p-6">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                  Algorithm Results — {employee.name} vs {targetRole?.title || 'N/A'}
                </h3>
                <div className="space-y-2">
                  <RawRow label="Cosine Similarity" value={cosine.toFixed(3)} desc="Profile shape alignment" />
                  <RawRow label="Jaccard (Binary)" value={jaccBin.toFixed(3)} desc="Skill set coverage" />
                  <RawRow label="Jaccard (Weighted)" value={jaccW.toFixed(3)} desc="Proficiency-weighted overlap" />
                  <RawRow label="Weighted Gap Score" value={gapScore.toFixed(3)} desc="Strategic priority gap" />
                  <RawRow label="Overall Readiness" value={((latestResult?.overall_readiness ?? localResults?.overallReadiness ?? 0)).toFixed(3)} desc="Composite score" />
                  <RawRow label="Manager Adjustment" value={`${managerAdj >= 0 ? '+' : ''}${managerAdj.toFixed(3)}`} desc={managerInterview ? 'From manager interview' : 'Pending manager interview'} />
                  <RawRow label="Final Readiness" value={`${readiness}%`} desc="" highlight />
                </div>

                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-6 mb-4">
                  AHP Criteria Weights (Neue Klasse priorities)
                </h3>
                <div className="space-y-2">
                  <RawRow label="Skills Match" value="33.2%" desc="" />
                  <RawRow label="Strategic Fit" value="30.5%" desc="" />
                  <RawRow label="Learning Agility" value="15.8%" desc="" />
                  <RawRow label="Performance" value="14.7%" desc="" />
                  <RawRow label="Tenure" value="5.7%" desc="" />
                </div>
                <p className="text-[11px] text-muted-foreground mt-2 font-mono">Consistency Ratio: 0.69% ✓</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Manager Insights (collapsible) */}
        {managerInterview && (
          <Card>
            <CardHeader className="pb-2 cursor-pointer" onClick={() => setManagerExpanded(!managerExpanded)}>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Manager Insights</CardTitle>
                {managerExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </CardHeader>
            {managerExpanded && (
              <CardContent className="space-y-4">
                {managerInterview.manager_confidence_score != null && (
                  <div>
                    <span className="text-xs text-muted-foreground">Confidence Score</span>
                    <div className="flex items-center gap-2 mt-1">
                      <Progress value={(managerInterview.manager_confidence_score as number) * 10} className="h-2 flex-1" />
                      <span className="font-mono text-sm">{managerInterview.manager_confidence_score}/10</span>
                    </div>
                  </div>
                )}
                {(managerInterview.potential_indicators as unknown as string[])?.length > 0 && (
                  <div>
                    <span className="text-xs text-muted-foreground flex items-center gap-1"><Star className="h-3 w-3 text-status-amber" /> Potential Indicators</span>
                    <ul className="mt-1 space-y-1">
                      {(managerInterview.potential_indicators as unknown as string[]).map((p, i) => (
                        <li key={i} className="text-sm text-foreground/80">• {p}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {(managerInterview.concerns as unknown as string[])?.length > 0 && (
                  <div>
                    <span className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-status-amber" /> Concerns</span>
                    <ul className="mt-1 space-y-1">
                      {(managerInterview.concerns as unknown as string[]).map((c, i) => (
                        <li key={i} className="text-sm text-foreground/80">• {c}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {managerInterview.hidden_role_suggestion && (
                  <div>
                    <span className="text-xs text-muted-foreground">Hidden Role Suggestion</span>
                    <p className="text-sm mt-1">{managerInterview.hidden_role_suggestion}</p>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border p-3 text-center">
      <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">{icon}<span className="text-xs">{label}</span></div>
      <span className="text-lg font-bold font-mono">{value}</span>
    </div>
  );
}

function RawRow({ label, value, desc, highlight }: { label: string; value: string; desc: string; highlight?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-1.5 px-2 rounded ${highlight ? 'bg-primary/5' : ''}`}>
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-3">
        <span className={`font-mono text-sm ${highlight ? 'font-bold text-primary' : ''}`}>{value}</span>
        {desc && <span className="text-[11px] text-muted-foreground w-40 text-right">{desc}</span>}
      </div>
    </div>
  );
}

function markdownToHtml(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold mt-6 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold mt-6 mb-3">$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/^---$/gm, '<hr class="my-4 border-border" />')
    .replace(/\n\n/g, '</p><p class="mb-3">')
    .replace(/^(?!<[hlu]|<li|<hr)(.+)$/gm, '<p class="mb-3">$1</p>')
    .replace(/<\/li>\n<li/g, '</li><li');
}
