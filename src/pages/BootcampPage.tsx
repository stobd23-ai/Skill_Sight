import { useParams, useNavigate } from "react-router-dom";
import { useState, useCallback } from "react";
import { useEmployee, useAlgorithmResults, useRoles, useBootcamps, useInterviews } from "@/hooks/useData";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, RefreshCw, Sparkles, BookOpen, Clock, Calendar,
  TrendingUp, CheckCircle2, Circle, ChevronDown, ChevronUp, Wrench, GraduationCap, Users,
} from "lucide-react";
import { toast } from "sonner";

interface BootcampModule {
  index: number; title: string; duration_weeks: number; skill_targeted: string;
  gap_being_closed: string; objective: string;
  weekly_structure: { theory: { hours: number; content: string }; hands_on: { hours: number; content: string }; reflection: { hours: number; content: string } };
  bmw_project: { title: string; description: string; deliverable: string; bmw_connection: string };
  success_metrics: string[]; mentoring: string; prerequisite_modules: number[];
}

interface Milestone { week: number; title: string; assessment: string }

export default function BootcampPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: employee, isLoading: empLoading } = useEmployee(id);
  const { data: results } = useAlgorithmResults(id);
  const { data: roles } = useRoles();
  const { data: bootcamps, refetch: refetchBootcamps } = useBootcamps(id);
  const { data: interviews } = useInterviews(id);

  const [generating, setGenerating] = useState(false);
  const [expandedModules, setExpandedModules] = useState<Set<number>>(new Set([0]));

  const latestResult = results?.[0];
  const targetRole = roles?.find(r => r.id === latestResult?.role_id);
  const bootcamp = bootcamps?.[0];
  const managerInterview = interviews?.find(i => i.interview_type === 'manager' && i.status === 'completed');

  const modules = (bootcamp?.modules || []) as unknown as BootcampModule[];
  const milestones = (bootcamp?.milestones || []) as unknown as Milestone[];
  const expectedOutcomes = (bootcamp?.expected_outcomes || []) as unknown as string[];

  const readiness = latestResult ? Math.round((latestResult.final_readiness || latestResult.overall_readiness || 0) * 100) : 0;

  const toggleModule = (idx: number) => {
    setExpandedModules(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const generateBootcamp = useCallback(async () => {
    if (!employee || !targetRole || !latestResult) return;
    setGenerating(true);
    try {
      const gapAnalysis = latestResult.gap_analysis;
      const upskillingPaths = latestResult.upskilling_paths;

      const { data, error } = await supabase.functions.invoke("generate-bootcamp", {
        body: {
          employeeName: employee.name, roleTitle: targetRole.title,
          gapAnalysis, upskillingPaths, currentReadiness: readiness,
          managerInsights: managerInterview ? {
            confidence: managerInterview.manager_confidence_score,
            potentialIndicators: managerInterview.potential_indicators,
            concerns: managerInterview.concerns,
          } : null,
        },
      });
      if (error) throw error;

      const bc = data.bootcamp;
      if (bootcamp?.id) await supabase.from("bootcamps").delete().eq("id", bootcamp.id);

      await supabase.from("bootcamps").insert({
        employee_id: id, target_role_id: targetRole.id, algorithm_result_id: latestResult.id,
        title: bc.title, total_duration_weeks: bc.total_duration_weeks,
        hours_per_week: bc.hours_per_week, modules: bc.modules as any,
        milestones: bc.milestones as any, expected_outcomes: bc.expected_outcomes as any,
        status: 'not_started',
      });

      await refetchBootcamps();
      toast.success("Bootcamp generated successfully");
    } catch (e: any) {
      console.error("Bootcamp generation failed:", e);
      toast.error(e.message || "Failed to generate bootcamp");
    } finally {
      setGenerating(false);
    }
  }, [employee, targetRole, latestResult, readiness, managerInterview, bootcamp, id, refetchBootcamps]);

  if (empLoading) return <div className="flex items-center justify-center h-64"><LoadingSpinner /></div>;
  if (!employee) return <div className="p-8 text-center text-muted-foreground">Employee not found</div>;

  return (
    <div>
      <PageHeader
        title={`${employee.name} — Personalised Bootcamp`}
        subtitle={`${targetRole?.title || 'No role'} Development Plan`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate(`/employees/${id}`)}>
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Profile
            </Button>
            <Button variant="outline" size="sm" onClick={generateBootcamp} disabled={generating || !latestResult}>
              <RefreshCw className={`h-3.5 w-3.5 ${generating ? 'animate-spin' : ''}`} />
              {bootcamp ? 'Regenerate' : 'Generate AI Bootcamp'}
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* Empty state */}
        {!bootcamp && !generating && (
          <Card>
            <CardContent className="py-16 text-center">
              <Sparkles className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-lg font-semibold mb-2">Generate AI Bootcamp</h2>
              <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                Based on your algorithm results and manager insights, AI will create a personalised BMW training plan.
              </p>
              <Button onClick={generateBootcamp} disabled={!latestResult}>
                {latestResult ? 'Generate Bootcamp' : 'Run Analysis First'}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Generating state */}
        {generating && (
          <Card>
            <CardContent className="py-16 text-center">
              <RefreshCw className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
              <h2 className="text-lg font-semibold mb-2">Designing Your Bootcamp</h2>
              <p className="text-sm text-muted-foreground">AI is creating a personalised BMW training curriculum…</p>
              <div className="mt-6 space-y-2 max-w-sm mx-auto">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Bootcamp content */}
        {bootcamp && !generating && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatBox icon={<BookOpen className="h-4 w-4" />} label="Total Modules" value={`${modules.length}`} />
              <StatBox icon={<Calendar className="h-4 w-4" />} label="Total Duration" value={`${bootcamp.total_duration_weeks || 0} weeks`} />
              <StatBox icon={<Clock className="h-4 w-4" />} label="Hours/Week" value={`${bootcamp.hours_per_week || 5}h`} />
              <StatBox icon={<TrendingUp className="h-4 w-4" />} label="Expected Readiness" value={`${readiness}% → 85%`} />
            </div>

            {/* Bootcamp title + progress */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-semibold">{bootcamp.title || 'Personalised Bootcamp'}</h2>
                  <span className="text-xs text-muted-foreground">Module 0 of {modules.length} complete — 0% progress</span>
                </div>
                <Progress value={0} className="h-1.5" />
              </CardContent>
            </Card>

            {/* Modules */}
            <div className="space-y-4">
              {modules.map((mod, i) => (
                <Card key={i}>
                  <CardHeader className="pb-2 cursor-pointer" onClick={() => toggleModule(i)}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                          {mod.index || i + 1}
                        </div>
                        <div>
                          <CardTitle className="text-sm font-semibold">{mod.title}</CardTitle>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-muted-foreground">{mod.duration_weeks} weeks</span>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">{mod.skill_targeted?.replace(/([A-Z])/g, ' $1').trim()}</Badge>
                            <span className="text-[10px] font-mono text-muted-foreground">{mod.gap_being_closed}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px]">Not Started</Badge>
                        {expandedModules.has(i) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </div>
                  </CardHeader>

                  {expandedModules.has(i) && (
                    <CardContent className="pt-0 space-y-4">
                      <div>
                        <span className="text-xs font-semibold text-muted-foreground uppercase">Objective</span>
                        <p className="text-sm mt-1">{mod.objective}</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <WeeklyBlock icon={<GraduationCap className="h-3.5 w-3.5" />} label="Theory" hours={mod.weekly_structure?.theory?.hours} content={mod.weekly_structure?.theory?.content} />
                        <WeeklyBlock icon={<Wrench className="h-3.5 w-3.5" />} label="Hands-On" hours={mod.weekly_structure?.hands_on?.hours} content={mod.weekly_structure?.hands_on?.content} />
                        <WeeklyBlock icon={<BookOpen className="h-3.5 w-3.5" />} label="Reflection" hours={mod.weekly_structure?.reflection?.hours} content={mod.weekly_structure?.reflection?.content} />
                      </div>

                      {mod.bmw_project && (
                        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                          <span className="text-xs font-semibold text-primary uppercase">BMW Project</span>
                          <h4 className="text-sm font-semibold mt-1">{mod.bmw_project.title}</h4>
                          <p className="text-xs text-muted-foreground mt-1">{mod.bmw_project.description}</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                            <div><span className="text-[10px] font-semibold text-muted-foreground">Deliverable:</span><p className="text-xs">{mod.bmw_project.deliverable}</p></div>
                            <div><span className="text-[10px] font-semibold text-muted-foreground">BMW Connection:</span><p className="text-xs">{mod.bmw_project.bmw_connection}</p></div>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <span className="text-xs font-semibold text-muted-foreground uppercase">Success Metrics</span>
                          <ul className="mt-1 space-y-1">
                            {mod.success_metrics?.map((m, j) => (
                              <li key={j} className="flex items-start gap-1.5 text-xs"><Circle className="h-2.5 w-2.5 mt-0.5 text-muted-foreground" />{m}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <span className="text-xs font-semibold text-muted-foreground uppercase">Mentoring</span>
                          <p className="text-xs mt-1 flex items-start gap-1.5"><Users className="h-3.5 w-3.5 mt-0.5 text-muted-foreground" />{mod.mentoring}</p>
                          {mod.prerequisite_modules?.length > 0 && (
                            <p className="text-[10px] text-muted-foreground mt-2">Requires: Module {mod.prerequisite_modules.join(', ')}</p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>

            {/* Milestones */}
            {milestones.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Milestones</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col md:flex-row items-start gap-4">
                    {milestones.map((ms, i) => (
                      <div key={i} className="flex-1 text-center">
                        <div className="w-3 h-3 bg-primary/20 rotate-45 mx-auto mb-2" />
                        <span className="text-xs font-mono text-muted-foreground">Week {ms.week}</span>
                        <h4 className="text-sm font-semibold mt-0.5">{ms.title}</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">{ms.assessment}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Expected Outcomes */}
            {expectedOutcomes.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Expected Outcomes After Completion</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1.5">
                    {expectedOutcomes.map((o, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-status-green mt-0.5 shrink-0" />{o}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StatBox({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4 text-center">
        <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">{icon}<span className="text-xs">{label}</span></div>
        <span className="text-lg font-bold font-mono">{value}</span>
      </CardContent>
    </Card>
  );
}

function WeeklyBlock({ icon, label, hours, content }: { icon: React.ReactNode; label: string; hours?: number; content?: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">{icon}<span className="text-xs font-semibold">{label} · {hours || 0}h/week</span></div>
      <p className="text-xs text-foreground/80">{content || '—'}</p>
    </div>
  );
}
