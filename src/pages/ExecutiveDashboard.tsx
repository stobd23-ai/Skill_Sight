import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { ReadinessRing } from "@/components/ReadinessRing";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useEmployees, useAlgorithmResults, useInterviews, useAllEmployeeSkills, useRoles } from "@/hooks/useData";
import { Users, AlertTriangle, MessageSquare, UserPlus, Inbox, UserCheck, Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Legend } from "recharts";
import { useNavigate } from "react-router-dom";
import { useMemo } from "react";

export default function ExecutiveDashboard() {
  const { data: employees, isLoading: loadingEmp } = useEmployees();
  const { data: results } = useAlgorithmResults();
  const { data: interviews } = useInterviews();
  
  const { data: allSkills } = useAllEmployeeSkills();
  const { data: roles } = useRoles();
  const navigate = useNavigate();

  const criticalGaps = useMemo(() => {
    if (!results?.length) return 0;
    return results.reduce((count, r) => {
      const ga = r.gap_analysis as any;
      if (ga?.criticalGaps) {
        return count + ga.criticalGaps.filter((g: any) => g.priority === 'critical').length;
      }
      return count;
    }, 0);
  }, [results]);

  const completedInterviews = interviews?.filter(i => i.status === 'completed').length || 0;

  const { data: externalCandidates } = useQuery({
    queryKey: ["external_candidates_dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase.from("external_candidates").select("id, interview_worthy, status, submission_source, manager_decision, name, role_id, submitted_at, worthy_score");
      if (error) throw error;
      return data;
    },
  });
  const externalWorthyCount = externalCandidates?.filter((c: any) => c.interview_worthy).length || 0;
  const pendingReviewCount = externalCandidates?.filter((c: any) => c.submission_source === "candidate_self_submit" && c.manager_decision === "pending" && c.interview_worthy).length || 0;

  // Critical Hiring Priorities
  const hiringPriorities = useMemo(() => {
    if (!roles?.length) return [];
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    // Only include actively_hiring and internal_development roles
    const eligibleRoles = roles.filter(r => {
      const status = (r as any).hiring_status || 'actively_hiring';
      return status === 'actively_hiring' || status === 'internal_development';
    });

    return eligibleRoles.map(role => {
      const roleStatus = (role as any).hiring_status || 'actively_hiring';
      const roleResults = results?.filter(r => r.role_id === role.id) || [];
      const bestReadiness = roleResults.length
        ? Math.max(...roleResults.map(r => {
            const tls = (r as any).three_layer_score;
            return tls != null ? Math.round(tls * 100) : Math.round((r.final_readiness || 0) * 100);
          }))
        : 0;
      const bestResult = roleResults.length
        ? roleResults.reduce((best, r) => {
            const tls = (r as any).three_layer_score;
            const score = tls != null ? tls : (r.final_readiness || 0);
            const bestScore = (best as any).three_layer_score != null ? (best as any).three_layer_score : (best.final_readiness || 0);
            return score > bestScore ? r : best;
          })
        : null;
      const bestEmployee = bestResult ? employees?.find(e => e.id === bestResult.employee_id) : null;
      const worthyExternals = externalCandidates?.filter((c: any) => c.role_id === role.id && c.interview_worthy).length || 0;
      const recentInterview = interviews?.some(i => i.target_role_id === role.id && i.completed_at && new Date(i.completed_at).getTime() > thirtyDaysAgo);

      // Urgency logic: actively_hiring with low readiness = HIGH, internal_development = MEDIUM unless <50%
      let urgency: 'HIGH' | 'MEDIUM' | 'LOW';
      if (roleStatus === 'actively_hiring') {
        if (bestReadiness < 60) urgency = 'HIGH';
        else if (bestReadiness <= 75) urgency = 'MEDIUM';
        else urgency = 'LOW';
      } else {
        // internal_development
        if (bestReadiness < 50) urgency = 'HIGH';
        else urgency = 'MEDIUM';
      }

      let urgencyScore = bestReadiness;
      if (worthyExternals === 0) urgencyScore -= 10;
      if (!recentInterview) urgencyScore -= 5;

      return { role, bestReadiness, bestEmployee, worthyExternals, recentInterview, urgency, urgencyScore };
    }).sort((a, b) => a.urgencyScore - b.urgencyScore).slice(0, 4);
  }, [roles, results, employees, externalCandidates, interviews]);

  const radarData = useMemo(() => {
    const strategicSkills = ['ThermalEngineering', 'Python', 'MachineLearning', 'EVBatterySystems', 'AUTOSAR', 'ProjectManagement', 'DeepLearning', 'ManufacturingProcesses'];
    if (!allSkills?.length || !roles?.length) return [];
    return strategicSkills.map(skill => {
      const skillEntries = allSkills.filter(s => s.skill_name === skill);
      const avgProf = skillEntries.length ? skillEntries.reduce((s, e) => s + (e.proficiency || 0), 0) / skillEntries.length : 0;
      const maxRequired = Math.max(0, ...roles.map(r => {
        const req = r.required_skills as any;
        return req?.[skill] || 0;
      }));
      return { skill: skill.replace(/([A-Z])/g, ' $1').trim(), workforce: Math.round(avgProf * 33.3), strategic: Math.round(maxRequired * 33.3) };
    });
  }, [allSkills, roles]);

  if (loadingEmp) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  const urgencyColors = {
    HIGH: { border: '#dc3545', bg: 'bg-destructive', text: 'text-destructive', badgeBg: 'bg-destructive/10 text-destructive', barBg: '#dc3545' },
    MEDIUM: { border: '#f59e0b', bg: 'bg-status-amber', text: 'text-status-amber', badgeBg: 'bg-status-amber-light text-status-amber', barBg: '#f59e0b' },
    LOW: { border: '#22c55e', bg: 'bg-status-green', text: 'text-status-green', badgeBg: 'bg-status-green-light text-status-green', barBg: '#22c55e' },
  };

  const openRoleCount = roles?.filter(r => r.is_open).length || roles?.length || 0;
  const emptySlots = Math.max(0, 4 - hiringPriorities.length);

  return (
    <div>
      <PageHeader title="Executive Dashboard" subtitle="Workforce intelligence overview" />
      <div className="p-6 space-y-6">
        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          <StatCard icon={Users} label="Employees Profiled" value={employees?.length || 0} subtitle="Full HR + interview data" color="blue" />
          <StatCard icon={AlertTriangle} label="Critical Skill Gaps" value={criticalGaps} subtitle="Require immediate action" color="red" />
          <StatCard icon={MessageSquare} label="Interviews Completed" value={completedInterviews} subtitle="Employee + manager combined" color="blue" />
          <StatCard icon={UserPlus} label="External Pipeline" value={externalWorthyCount} subtitle="Interview-worthy candidates" color="purple" />
          <StatCard icon={Inbox} label="Pending Review" value={pendingReviewCount} subtitle="Self-submitted, AI-cleared" color="amber" />
        </div>

        {/* Main content row — stretch aligned */}
        <div className="flex flex-col lg:flex-row gap-6 items-stretch">
          {/* Left column */}
          <div className="lg:flex-[3] flex flex-col">
            <div className="card-skillsight p-5 flex flex-col flex-1">
              <h3 className="text-[15px] font-semibold mb-4">Skill Coverage vs Strategic Requirements</h3>
              {radarData.length > 0 ? (
                <div className="flex-1 min-h-0 w-full" style={{ minHeight: 240 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="hsl(var(--border))" />
                      <PolarAngleAxis dataKey="skill" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                      <Radar name="Current Workforce" dataKey="workforce" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
                      <Radar name="Strategic Need" dataKey="strategic" stroke="hsl(var(--destructive))" fill="hsl(var(--destructive))" fillOpacity={0.2} strokeDasharray="5 5" />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8 flex-1 flex items-center justify-center">No skill data available</p>
              )}
            </div>
          </div>

          {/* Right column */}
          <div className="lg:flex-[2] flex flex-col gap-6">
            <div className="card-skillsight p-5 flex flex-col flex-1">
              <h3 className="text-[15px] font-semibold mb-4">Recent Assessments</h3>
              <div className="flex-1">
                {results?.length ? results.slice(0, 5).map((r, i) => {
                  const emp = employees?.find(e => e.id === r.employee_id);
                  const role = roles?.find(ro => ro.id === r.role_id);
                  if (!emp) return null;
                  const tls = (r as any).three_layer_score;
                  const displayScore = tls != null ? Math.round(tls * 100) : Math.round((r.final_readiness || 0) * 100);
                  return (
                    <div key={r.id} className={`flex items-center gap-3 py-3 cursor-pointer hover:bg-accent/50 rounded-md px-1 ${i > 0 ? 'border-t border-border' : ''}`}
                      onClick={() => navigate(`/analysis/${emp.id}`)}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-primary-foreground shrink-0" style={{ backgroundColor: emp.avatar_color || 'hsl(213, 77%, 47%)' }}>
                        {emp.avatar_initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{emp.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{role?.title || 'Unknown role'}</p>
                      </div>
                      <ReadinessRing value={displayScore} size="sm" />
                    </div>
                  );
                }) : (
                  <p className="text-xs text-muted-foreground text-center py-4">No assessments yet</p>
                )}
              </div>
            </div>

            <div className="card-skillsight p-5 flex flex-col">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-2 h-2 rounded-full bg-status-amber" />
                <h3 className="text-[15px] font-semibold">New Applications — Pending Your Review</h3>
              </div>
              {pendingReviewCount > 0 ? (
                externalCandidates
                  ?.filter((c: any) => c.submission_source === "candidate_self_submit" && c.manager_decision === "pending" && c.interview_worthy)
                  .slice(0, 3)
                  .map((c: any) => {
                    const role = roles?.find(r => r.id === c.role_id);
                    const hoursAgo = Math.round((Date.now() - new Date(c.submitted_at || c.created_at).getTime()) / 3600000);
                    return (
                      <div key={c.id} className="flex items-center gap-3 py-2 border-t border-border first:border-0">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{c.name}</p>
                          <p className="text-[10px] text-muted-foreground">{role?.title} · {hoursAgo}h ago</p>
                        </div>
                        {c.worthy_score != null && (
                          <div className="h-1.5 w-16 rounded-full bg-secondary overflow-hidden">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round(c.worthy_score * 100)}%` }} />
                          </div>
                        )}
                        <button
                          onClick={() => navigate("/employees?tab=external&filter=pending")}
                          className="text-[10px] text-primary font-medium hover:underline"
                        >
                          Review
                        </button>
                      </div>
                    );
                  })
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4">No new applications awaiting review.</p>
              )}
            </div>
          </div>
        </div>

        {/* Critical Hiring Priorities — bottom of page */}
        <div className="card-skillsight p-6">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h2 className="text-[20px] font-bold">Critical Hiring Priorities</h2>
              <p className="text-[13px] text-muted-foreground mt-0.5">Roles requiring immediate action — ranked by urgency</p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-secondary text-xs font-semibold font-mono text-foreground">
              {openRoleCount} open
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {hiringPriorities.map(({ role, bestReadiness, bestEmployee, worthyExternals, urgency }) => {
              const colors = urgencyColors[urgency];
              const gap = 100 - bestReadiness;
              return (
                <div
                  key={role.id}
                  className="bg-card rounded-[14px] border border-border p-5 relative overflow-hidden"
                  style={{ borderLeftWidth: 4, borderLeftColor: colors.border }}
                >
                  <div className="flex items-start justify-between mb-1">
                    <h3 className="text-[16px] font-bold leading-tight">{role.title}</h3>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${colors.badgeBg}`}>
                      {urgency}
                    </span>
                  </div>
                  <p className="text-[13px] text-muted-foreground mb-4">{role.department || 'No department'}</p>

                  <div className="mb-3">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Best Internal Match:</p>
                    {bestEmployee ? (
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium truncate">{bestEmployee.name}</span>
                        <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${bestReadiness}%`, backgroundColor: colors.barBg }} />
                        </div>
                        <span className="text-[12px] font-mono font-semibold" style={{ color: colors.border }}>{bestReadiness}%</span>
                      </div>
                    ) : (
                      <p className="text-[12px] italic text-destructive">No candidates assessed yet</p>
                    )}
                  </div>

                  <div className="mb-4">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">External Pipeline:</p>
                    {worthyExternals > 0 ? (
                      <span className="text-[13px] text-status-green font-medium flex items-center gap-1">
                        <UserCheck className="h-3.5 w-3.5" /> {worthyExternals} qualified
                      </span>
                    ) : (
                      <span className="text-[13px] text-destructive font-medium">0 qualified externals</span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 mb-4 pb-4 border-b border-border">
                    <div>
                      <span className="text-[11px] text-muted-foreground">Internal Best: </span>
                      <span className="text-[13px] font-mono font-bold" style={{ color: colors.border }}>{bestReadiness}%</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-muted-foreground">Gap to Ready: </span>
                      <span className="text-[13px] font-mono font-bold text-destructive">{gap}%</span>
                    </div>
                  </div>

                  {urgency === 'HIGH' && (
                    <button
                      onClick={() => navigate('/reorg')}
                      className="w-full py-2 rounded-lg text-[14px] font-semibold text-white transition-colors"
                      style={{ backgroundColor: '#dc3545' }}
                    >
                      Urgent — Start Assessment
                    </button>
                  )}
                  {urgency === 'MEDIUM' && (
                    <button
                      onClick={() => navigate('/reorg')}
                      className="w-full py-2 rounded-lg text-[14px] font-semibold text-white transition-colors"
                      style={{ backgroundColor: '#f59e0b' }}
                    >
                      Review Candidates
                    </button>
                  )}
                  {urgency === 'LOW' && (
                    <button
                      onClick={() => navigate('/reorg')}
                      className="w-full py-2 rounded-lg text-[14px] font-semibold border-2 transition-colors bg-transparent"
                      style={{ borderColor: '#22c55e', color: '#22c55e' }}
                    >
                      Monitor
                    </button>
                  )}
                </div>
              );
            })}

            {Array.from({ length: emptySlots }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="rounded-[14px] border-2 border-dashed border-border p-5 flex flex-col items-center justify-center gap-2 min-h-[200px] cursor-pointer hover:bg-accent/30 transition-colors"
                onClick={() => navigate('/roles')}
              >
                <Plus className="h-8 w-8 text-muted-foreground/50" />
                <p className="text-[13px] text-muted-foreground text-center">Add a role in Roles Manager to track hiring urgency</p>
              </div>
            ))}
          </div>

          <p className="text-[13px] text-muted-foreground italic text-center mt-5">
            Urgency is computed from internal candidate readiness, external pipeline depth, and assessment recency — updated in real time.
          </p>
        </div>
      </div>
    </div>
  );
}