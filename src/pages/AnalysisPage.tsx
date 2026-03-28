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
  Zap, TrendingUp, Brain, Heart, Search, ShieldAlert,
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
  const employeeInterview = interviews?.find(i => i.interview_type === 'employee' && i.status === 'completed');
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

  // Three-layer data
  const threeLayerScore = (latestResult as any)?.three_layer_score ?? null;
  const technicalMatch = (latestResult as any)?.technical_match ?? latestResult?.overall_readiness ?? localResults?.overallReadiness ?? 0;
  const capabilityMatch = (latestResult as any)?.capability_match ?? 0.5;
  const momentumScore = (latestResult as any)?.momentum_score ?? null;
  const momentumBreakdown = (latestResult as any)?.momentum_breakdown as any || null;
  const roleType = (latestResult as any)?.role_type || 'technical_specialist';
  const ahpWeightsUsed = (latestResult as any)?.ahp_weights_used as any || null;
  const scoreBreakdown = (latestResult as any)?.score_breakdown as any || null;
  const capabilityData = scoreBreakdown?.capabilityData || null;
  const transitionProfile = capabilityData?.transition_profile || null;
  const capabilityProfile = capabilityData?.capability_profile || null;
  const gapClassification = capabilityData?.gap_classification || null;

  const readiness = useMemo(() => {
    if (threeLayerScore != null) return Math.round(threeLayerScore * 100);
    if (latestResult) {
      // If momentum is null, recompute as 50/50 technical + capability
      if (momentumScore === null) {
        const partial = (technicalMatch * 0.5) + (capabilityMatch * 0.5);
        return Math.round(partial * 100);
      }
      return Math.round((latestResult.final_readiness || latestResult.overall_readiness || 0) * 100);
    }
    return localResults ? Math.round(localResults.overallReadiness * 100) : 0;
  }, [threeLayerScore, latestResult, localResults, momentumScore, technicalMatch, capabilityMatch]);

  const gapAnalysis = latestResult?.gap_analysis
    ? latestResult.gap_analysis as unknown as { criticalGaps: Array<{ skill: string; currentProficiency: number; requiredProficiency: number; deficit: number; strategicWeight: number; weightedGap: number; priority: string }>; surplusSkills: Array<{ skill: string; current: number; required: number; surplus: number }>; interviewSurplus?: Array<{ skill: string; type: string; rating: string; evidence: string; relevance: string }>; normalizedGapScore: number; readinessPercent: number }
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

  // Extract interview-discovered capabilities from completed interview
  const interviewSurplus = useMemo(() => {
    // From gap analysis (if computed with interview data)
    if (gapAnalysis?.interviewSurplus?.length) return gapAnalysis.interviewSurplus;
    // From interview extracted_skills capabilities
    if (employeeInterview?.extracted_skills) {
      const extracted = employeeInterview.extracted_skills as any;
      const capabilities = extracted?.capabilities || extracted?.capability_assessment;
      if (capabilities && typeof capabilities === 'object') {
        return Object.entries(capabilities)
          .filter(([, v]: [string, any]) => v && ['DEMONSTRATED', 'EXCEPTIONAL'].includes(v.rating))
          .map(([k, v]: [string, any]) => ({
            skill: k, type: 'capability' as const, rating: v.rating,
            evidence: v.evidence || v.justification || '', relevance: v.relevance_to_role || v.relevance || 'MEDIUM'
          }));
      }
    }
    return [];
  }, [gapAnalysis, employeeInterview]);

  // Build score factor data
  const technicalFactors = useMemo(() => {
    const factors = [
      { label: 'Profile shape alignment (Cosine)', value: `${Math.round(cosine * 100)}%`, note: 'skill emphasis matches role direction' },
      { label: 'Skill set coverage (Jaccard)', value: `${Math.round(jaccBin * 100)}%`, note: 'covers required skills' },
      { label: 'Proficiency-weighted overlap', value: `${Math.round(jaccW * 100)}%`, note: 'depth of matched skills' },
      { label: 'Strategic gap remaining', value: `${Math.round(gapScore * 100)}%`, note: 'weighted by BMW priority' },
    ];
    const bestSurplus = gapAnalysis?.surplusSkills?.[0];
    const worstGap = gapAnalysis?.criticalGaps?.[0];
    let standout = '';
    if (bestSurplus) standout += `Strongest contributor: ${bestSurplus.skill.replace(/([A-Z])/g, ' $1').trim()} (${bestSurplus.current}/3, surplus +${bestSurplus.surplus})`;
    if (worstGap) standout += `${standout ? ' · ' : ''}Biggest drag: ${worstGap.skill.replace(/([A-Z])/g, ' $1').trim()} (${worstGap.currentProficiency}/3 → ${worstGap.requiredProficiency}/3, weight ${(worstGap.strategicWeight * 100).toFixed(0)}%)`;
    return { factors, standout };
  }, [cosine, jaccBin, jaccW, gapScore, gapAnalysis]);

  const capabilityFactors = useMemo(() => {
    // Use capabilityProfile from map-capabilities if available, fallback to interviewSurplus
    const allCaps = capabilityProfile ? Object.entries(capabilityProfile) : [];
    const exceptional = allCaps.filter(([, c]: [string, any]) => c.rating === 'EXCEPTIONAL');
    const demonstrated = allCaps.filter(([, c]: [string, any]) => c.rating === 'DEMONSTRATED');
    const highRelevance = allCaps.filter(([, c]: [string, any]) => c.relevance_to_role === 'HIGH');
    const strongHighRelevance = highRelevance.filter(([, c]: [string, any]) => ['DEMONSTRATED', 'EXCEPTIONAL'].includes(c.rating));

    const factors = [
      { label: 'EXCEPTIONAL capabilities', value: exceptional.length > 0 ? exceptional.map(([name]) => name).join(', ') : 'None at this level', note: 'top-tier demonstrated thinking patterns' },
      { label: 'DEMONSTRATED capabilities', value: demonstrated.length > 0 ? demonstrated.map(([name]) => name).join(', ') : 'None confirmed', note: 'solidly evidenced in interview behavior' },
      { label: 'High-relevance capabilities assessed', value: `${highRelevance.length}`, note: 'directly relevant to target role' },
      { label: 'Strong high-relevance', value: highRelevance.length > 0 ? `${strongHighRelevance.length} of ${highRelevance.length}` : 'Requires capability interview data', note: highRelevance.length > 0 ? 'confirmed through behavioral evidence' : 'Run interview to populate this' },
    ];
    const standoutItem = exceptional[0] || demonstrated[0];
    const standout = standoutItem ? `Standout: "${standoutItem[0]}" — ${(standoutItem[1] as any).inferred_from?.slice(0, 100) || (standoutItem[1] as any).evidence?.slice(0, 100) || ''}` : '';
    return { factors, standout, allCaps };
  }, [capabilityProfile, interviewSurplus]);

  const momentumFactors = useMemo(() => {
    if (!momentumBreakdown) return { factors: [], standout: '' };
    const factors = [
      { label: 'Learning Velocity', value: `${Math.round((momentumBreakdown.learning_velocity || 0) * 100)}%`, note: momentumBreakdown.learning_velocity_evidence || 'self-directed learning signals' },
      { label: 'Scope Trajectory', value: `${Math.round((momentumBreakdown.scope_trajectory || 0) * 100)}%`, note: momentumBreakdown.scope_trajectory_evidence || 'responsibility growth pattern' },
      { label: 'Motivation Alignment', value: `${Math.round((momentumBreakdown.motivation_alignment || 0) * 100)}%`, note: momentumBreakdown.motivation_alignment_evidence || 'domain interest alignment' },
    ];
    const scores = [momentumBreakdown.learning_velocity || 0, momentumBreakdown.scope_trajectory || 0, momentumBreakdown.motivation_alignment || 0];
    const labels = ['Learning velocity', 'Scope trajectory', 'Motivation alignment'];
    const maxIdx = scores.indexOf(Math.max(...scores));
    const standout = `Strongest signal: ${labels[maxIdx]} at ${Math.round(scores[maxIdx] * 100)}%`;
    return { factors, standout };
  }, [momentumBreakdown]);

  // Extract risk factors from report
  const riskFactors = useMemo(() => {
    if (!report) return [];
    const riskSection = report.match(/### Risk Factors\n([\s\S]*?)(?=\n### |\n## |$)/);
    if (!riskSection) return [];
    const riskText = riskSection[1];
    const risks: { name: string; level: string; description: string }[] = [];
    const riskMatches = riskText.matchAll(/\*\*(.+?)\*\*\s*·\s*(LOW|MEDIUM|HIGH)\n(.+?)(?=\n\*\*|\n$|$)/gs);
    for (const match of riskMatches) {
      risks.push({ name: match[1].trim(), level: match[2].trim(), description: match[3].trim() });
    }
    return risks;
  }, [report]);

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
          momentumData: momentumBreakdown ? {
            momentumScore: momentumBreakdown.momentum_score,
            learningVelocity: momentumBreakdown.learning_velocity,
            scopeTrajectory: momentumBreakdown.scope_trajectory,
            motivationAlignment: momentumBreakdown.motivation_alignment,
            narrative: momentumBreakdown.momentum_narrative,
            trajectoryRisk: momentumBreakdown.trajectory_risk,
          } : null,
          roleType,
          threeLayerScore: scoreBreakdown,
          ahpWeightsUsed,
          capabilityData: capabilityData || null,
        },
      });
      if (error) throw error;
      const md = data?.reportMarkdown || data?.report_markdown || data?.report || '';
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
  }, [employee, targetRole, cosine, jaccBin, jaccW, gapAnalysis, tfidfRarity, upskillingPaths, managerInterview, latestResult, localResults, id, managerAdj, momentumBreakdown, roleType, scoreBreakdown, ahpWeightsUsed]);

  if (!id) {
    return <EmployeeSelector title="Skills Analysis" subtitle="Select an employee to view their analysis" navigateTo="/analysis" />;
  }
  if (empLoading) return <div className="flex items-center justify-center h-64"><LoadingSpinner /></div>;
  if (!employee) return <div className="p-8 text-center text-muted-foreground">Employee not found</div>;

  const roleTypeLabel = roleType.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
  const interpretation = scoreBreakdown?.interpretation || '';

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
        {/* Three-Layer Assessment Hero */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-5">Three-Layer Assessment</h3>
            <div className="flex items-start gap-8">
              <div className="flex gap-6">
                <div className="flex flex-col items-center">
                  <ReadinessRing value={Math.round(technicalMatch * 100)} size="md" />
                  <span className="text-xs font-semibold mt-1">Technical Match</span>
                  <span className="text-[11px] text-muted-foreground">Current skills vs</span>
                  <span className="text-[11px] text-muted-foreground">role requirements</span>
                </div>
                <div className="flex flex-col items-center">
                  <ReadinessRing value={Math.round(capabilityMatch * 100)} size="md" />
                  <span className="text-xs font-semibold mt-1">Capability Match</span>
                  <span className="text-[11px] text-muted-foreground">Problem-solving depth</span>
                  <span className="text-[11px] text-muted-foreground">& thinking patterns</span>
                </div>
                <div className="flex flex-col items-center">
                  {momentumScore === null ? (
                    <>
                      <div className="relative" style={{ width: 80, height: 80 }}>
                        <svg width={80} height={80} className="-rotate-90">
                          <circle cx={40} cy={40} r={32} fill="none" stroke="hsl(var(--border))" strokeWidth={5} />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center font-mono font-semibold text-muted-foreground" style={{ fontSize: 14 }}>N/A</span>
                      </div>
                    </>
                  ) : (
                    <ReadinessRing value={Math.round(momentumScore * 100)} size="md" />
                  )}
                  <span className="text-xs font-semibold mt-1">Momentum Score</span>
                  <span className="text-[11px] text-muted-foreground">
                    {momentumScore === null ? 'Pending interview' : 'Growth trajectory'}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {momentumScore === null ? 'data' : '& role motivation'}
                  </span>
                </div>
              </div>

              <div className="flex-1 border-l border-border pl-8">
                <div className="flex items-center gap-4 mb-3">
                  <span className="text-4xl font-bold font-mono">{readiness}%</span>
                  <span className="text-sm font-medium text-muted-foreground">Final Score</span>
                </div>
                <Progress value={readiness} className="h-2.5 mb-2" />
                {interpretation && (
                  <p className="text-sm text-muted-foreground italic mb-3">{interpretation}</p>
                )}
                <div className="flex gap-2">
                  <Badge variant="secondary" className="text-[10px]">Role Type: {roleTypeLabel}</Badge>
                  {ahpWeightsUsed?.weights && (
                    <Badge variant="outline" className="text-[10px]">
                      AHP adjusted for {roleTypeLabel} — Learning Agility {(ahpWeightsUsed.weights[2] * 100).toFixed(0)}%
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Score Transparency - Expandable Factors */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <ScoreWithFactors
            title="Technical Match"
            score={technicalMatch}
            color="hsl(var(--primary))"
            factors={technicalFactors.factors}
            standout={technicalFactors.standout}
          />
          <ScoreWithFactors
            title="Capability Match"
            score={capabilityMatch}
            color="hsl(270 60% 55%)"
            factors={capabilityFactors.factors}
            standout={capabilityFactors.standout}
            capabilityDetails={capabilityFactors.allCaps}
          />
          <ScoreWithFactors
            title="Momentum Score"
            score={momentumScore}
            color="hsl(142 76% 36%)"
            factors={momentumFactors.factors}
            standout={momentumFactors.standout}
            isNull={momentumScore === null}
          />
        </div>


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

        {/* Momentum Assessment */}
        {momentumBreakdown && momentumBreakdown.momentum_score != null && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" /> Momentum Assessment — Where This Person Is Going
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <MomentumRow
                label="Learning Velocity"
                icon={<Brain className="h-3.5 w-3.5" />}
                value={momentumBreakdown.learning_velocity || 0}
                evidence={momentumBreakdown.learning_velocity_evidence}
                signals={momentumBreakdown.learning_velocity_signals}
                color="hsl(var(--primary))"
              />
              <MomentumRow
                label="Scope Trajectory"
                icon={<TrendingUp className="h-3.5 w-3.5" />}
                value={momentumBreakdown.scope_trajectory || 0}
                evidence={momentumBreakdown.scope_trajectory_evidence}
                signals={momentumBreakdown.scope_trajectory_signals}
                color="hsl(var(--green, 142 76% 36%))"
              />
              <MomentumRow
                label="Motivation Alignment"
                icon={<Heart className="h-3.5 w-3.5" />}
                value={momentumBreakdown.motivation_alignment || 0}
                evidence={momentumBreakdown.motivation_alignment_evidence}
                signals={momentumBreakdown.motivation_alignment_signals}
                color="hsl(270 60% 55%)"
              />

              {momentumBreakdown.momentum_narrative && (
                <div className="border-l-4 border-primary/40 bg-primary/5 rounded-r-lg p-4 mt-4">
                  <p className="text-sm italic text-foreground/80">{momentumBreakdown.momentum_narrative}</p>
                </div>
              )}

              {(momentumBreakdown.trajectory_risk === 'medium' || momentumBreakdown.trajectory_risk === 'high') && (
                <div className="flex items-start gap-3 p-3 bg-status-amber-light rounded-lg border border-status-amber/20">
                  <AlertTriangle className="h-4 w-4 text-status-amber mt-0.5" />
                  <div>
                    <span className="text-xs font-semibold text-status-amber">Trajectory Risk: {momentumBreakdown.trajectory_risk}</span>
                    <p className="text-xs text-muted-foreground mt-0.5">{momentumBreakdown.trajectory_risk_reason}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Strengths + Rare Skills */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Star className="h-4 w-4 text-status-amber" /> Strengths Beyond Requirements
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Section A — Verified Skills Above Requirement */}
              {gapAnalysis?.surplusSkills?.length ? (
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Verified Skills Above Requirement</p>
                  <div className="flex flex-wrap gap-2">
                    {gapAnalysis.surplusSkills.map((s, i) => (
                      <Badge key={i} className="bg-status-green-light text-status-green border-status-green/20 hover:bg-status-green-light">
                        {s.skill.replace(/([A-Z])/g, ' $1').trim()} +{s.surplus}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Section B — Interview-Discovered Strengths */}
              {interviewSurplus.length > 0 ? (
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Search className="h-3 w-3" /> Interview-Discovered Strengths
                    <span className="text-[10px] font-normal ml-1 text-purple-500">Found in Interview — Not in HR Records</span>
                  </p>
                  <div className="grid gap-2">
                    {interviewSurplus.map((s, i) => (
                      <div key={i} className="rounded-lg border border-purple-200 bg-purple-50 dark:bg-purple-950/20 dark:border-purple-800 p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold">{s.skill.replace(/([A-Z])/g, ' $1').trim()}</span>
                          <Badge className={`text-[10px] ${s.rating === 'EXCEPTIONAL' ? 'bg-status-green-light text-status-green border-status-green/20' : 'bg-primary/10 text-primary border-primary/20'}`}>
                            {s.rating}
                          </Badge>
                          {s.relevance && (
                            <Badge variant="outline" className="text-[10px]">{s.relevance}</Badge>
                          )}
                        </div>
                        {s.evidence && <p className="text-xs text-muted-foreground italic">{s.evidence}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* If neither section has data */}
              {(!gapAnalysis?.surplusSkills?.length && interviewSurplus.length === 0) && (
                <p className="text-sm text-muted-foreground">Complete an interview to discover hidden strengths beyond the HR profile.</p>
              )}
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

        {/* Transition Profile Banner */}
        {transitionProfile?.is_transitioning && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4 flex items-start gap-3">
              <ArrowRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Active Transition Profile — {transitionProfile.transition_stage === 'mid' ? 'Mid-Transition' : transitionProfile.transition_stage === 'late' ? 'Late-Stage Transition' : 'Early Transition'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{transitionProfile.maturity_note}</p>
                {transitionProfile.transition_evidence && (
                  <p className="text-xs text-muted-foreground mt-1 italic">"{transitionProfile.transition_evidence?.slice(0, 150)}..."</p>
                )}
                {transitionProfile.transition_domains?.length > 0 && (
                  <div className="flex gap-2 mt-2">
                    {transitionProfile.transition_domains.map((d: string, i: number) => (
                      <Badge key={i} variant="secondary" className="text-[10px]">{d}</Badge>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* AI Report */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">AI Assessment Report</CardTitle>
          </CardHeader>
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
              <div className="prose prose-sm max-w-none prose-headings:text-foreground prose-p:text-foreground/80 prose-strong:text-foreground prose-li:text-foreground/80" dangerouslySetInnerHTML={{ __html: markdownToHtml(report.replace(/### Risk Factors[\s\S]*?(?=\n### |\n## |$)/, '')) }} />
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

        {/* Risk Factors Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-status-amber" /> Risk Factors
            </CardTitle>
            <p className="text-[11px] text-muted-foreground">Honest assessment — every strong candidate has risks worth planning for</p>
          </CardHeader>
          <CardContent>
            {riskFactors.length > 0 ? (
              <div className="space-y-3">
                {riskFactors.map((risk, i) => {
                  const borderColor = risk.level === 'HIGH' ? 'border-l-destructive' : risk.level === 'MEDIUM' ? 'border-l-status-amber' : 'border-l-primary';
                  const badgeBg = risk.level === 'HIGH' ? 'bg-destructive/10 text-destructive' : risk.level === 'MEDIUM' ? 'bg-status-amber-light text-status-amber' : 'bg-primary/10 text-primary';
                  return (
                    <div key={i} className={`border-l-4 ${borderColor} pl-3 py-2`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold">{risk.name}</span>
                        <Badge className={`text-[10px] ${badgeBg}`}>{risk.level}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{risk.description}</p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">Risk analysis generates after AI report is complete</p>
            )}
          </CardContent>
        </Card>

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

// ─── Score With Factors Component ───────────────────────────────────

function ScoreWithFactors({
  title, score, color, factors, standout, capabilityDetails, isNull,
}: {
  title: string; score: number | null; color: string;
  factors: { label: string; value: string; note: string }[];
  standout?: string;
  capabilityDetails?: [string, any][];
  isNull?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="cursor-pointer" onClick={() => setExpanded(!expanded)}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isNull ? (
              <div className="relative" style={{ width: 48, height: 48 }}>
                <svg width={48} height={48} className="-rotate-90">
                  <circle cx={24} cy={24} r={18} fill="none" stroke="hsl(var(--border))" strokeWidth={4} />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center font-mono font-semibold text-muted-foreground text-[10px]">N/A</span>
              </div>
            ) : (
              <ReadinessRing value={Math.round((score || 0) * 100)} size="sm" />
            )}
            <div>
              <p className="text-sm font-semibold">{title}</p>
              <p className="text-[11px] text-muted-foreground">Click to see what drives this</p>
            </div>
          </div>
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>

        {expanded && (
          <div className="mt-3 pt-3 border-t border-border space-y-2" onClick={e => e.stopPropagation()}>
            {factors.map((f, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: color }} />
                <div className="text-xs">
                  <span className="font-medium">{f.label}: </span>
                  <span className="font-mono text-muted-foreground">{f.value}</span>
                  <span className="text-muted-foreground"> — {f.note}</span>
                </div>
              </div>
            ))}
            {standout && (
              <div className="mt-2 p-2 bg-muted/50 rounded-md">
                <p className="text-xs text-muted-foreground italic">{standout}</p>
              </div>
            )}
            {/* Show behavioral inference details for capability cards */}
            {capabilityDetails && capabilityDetails
              .filter(([, c]) => ['DEMONSTRATED', 'EXCEPTIONAL'].includes(c.rating))
              .slice(0, 4)
              .map(([capName, capData]) => (
                <div key={capName} className="mt-2 p-2 bg-secondary rounded-md">
                  <p className="text-xs font-semibold">{capName} — <span className={capData.rating === 'EXCEPTIONAL' ? 'text-green-600 dark:text-green-400' : 'text-primary'}>{capData.rating}</span></p>
                  {capData.inferred_from && <p className="text-[11px] text-muted-foreground italic mt-0.5">Inferred from: "{capData.inferred_from.slice(0, 120)}"</p>}
                </div>
              ))
            }
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Helper Components ──────────────────────────────────────────────

function MomentumRow({ label, icon, value, evidence, signals, color }: {
  label: string; icon: React.ReactNode; value: number;
  evidence?: string; signals?: string[]; color: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-sm font-medium flex-1">{label}</span>
        <span className="font-mono text-sm font-semibold">{Math.round(value * 100)}%</span>
      </div>
      <div className="h-2 bg-secondary rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${value * 100}%`, backgroundColor: color }} />
      </div>
      {evidence && <p className="text-xs text-muted-foreground italic pl-6">{evidence}</p>}
      {signals?.length ? (
        <div className="flex flex-wrap gap-1 pl-6">
          {signals.map((s, i) => (
            <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{s}</span>
          ))}
        </div>
      ) : null}
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

function RawMonoRow({ label, value, weight, contribution }: { label: string; value: string; weight?: number; contribution?: number }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span>{label}</span>
      <div className="flex items-center gap-6">
        <span>{value}</span>
        {weight != null && <span className="text-muted-foreground">Weight: {(weight * 100).toFixed(0)}%</span>}
        {contribution != null && <span className="text-muted-foreground">Contribution: {(contribution * 100).toFixed(1)}%</span>}
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
