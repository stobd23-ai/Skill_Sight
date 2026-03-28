import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { ReadinessRing } from "@/components/ReadinessRing";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useEmployees, useAlgorithmResults, useInterviews, useBootcamps, useReorgMatches, useAllEmployeeSkills, useRoles } from "@/hooks/useData";
import { Users, TrendingUp, AlertTriangle, MessageSquare, GraduationCap, DollarSign, UserPlus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Legend } from "recharts";
import { useNavigate } from "react-router-dom";
import { useMemo } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function ExecutiveDashboard() {
  const { data: employees, isLoading: loadingEmp } = useEmployees();
  const { data: results } = useAlgorithmResults();
  const { data: interviews } = useInterviews();
  const { data: bootcamps } = useBootcamps();
  const { data: reorgMatches } = useReorgMatches();
  const { data: allSkills } = useAllEmployeeSkills();
  const { data: roles } = useRoles();
  const navigate = useNavigate();

  const avgReadiness = useMemo(() => {
    if (!results?.length) return 0;
    const withScore = results.filter(r => {
      const tls = (r as any).three_layer_score;
      return tls != null || r.final_readiness != null;
    });
    if (!withScore.length) return 0;
    return Math.round(
      (withScore.reduce((s, r) => {
        const tls = (r as any).three_layer_score;
        return s + (tls != null ? tls : (r.final_readiness || 0));
      }, 0) / withScore.length) * 100
    );
  }, [results]);

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
  const activeBootcamps = bootcamps?.filter(b => b.status !== 'not_started').length || 0;
  const immediateMatches = reorgMatches?.filter(m => m.immediate_readiness).length || 0;
  const hiringCostAvoided = immediateMatches * 45000;

  const { data: externalCandidates } = useQuery({
    queryKey: ["external_candidates_dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase.from("external_candidates").select("id, interview_worthy, status").eq("interview_worthy", true);
      if (error) throw error;
      return data;
    },
  });
  const externalWorthyCount = externalCandidates?.length || 0;

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

  const heatmapSkills = ['EVBatterySystems', 'MachineLearning', 'Python', 'AUTOSAR', 'BatteryThermalMgmt', 'DeepLearning'];
  const heatmapData = useMemo(() => {
    if (!employees?.length || !allSkills?.length) return [];
    return (employees || []).slice(0, 5).map(emp => {
      const empSkills = allSkills.filter(s => s.employee_id === emp.id);
      const row: any = { name: emp.name?.split(' ')[0] || '', empId: emp.id };
      heatmapSkills.forEach(skill => {
        const found = empSkills.find(s => s.skill_name === skill);
        row[skill] = found?.proficiency || 0;
      });
      return row;
    });
  }, [employees, allSkills]);

  if (loadingEmp) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  const profBg: Record<number, string> = {
    0: 'bg-status-red-light',
    1: 'bg-status-amber-light',
    2: 'bg-bmw-blue-light',
    3: 'bg-status-green-light',
  };
  const profText: Record<number, string> = {
    0: 'text-status-red',
    1: 'text-status-amber',
    2: 'text-bmw-blue',
    3: 'text-status-green',
  };

  return (
    <div>
      <PageHeader title="Executive Dashboard" subtitle="Workforce intelligence overview" />
      <div className="p-6 space-y-6">
        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
          <StatCard icon={Users} label="Employees Profiled" value={employees?.length || 0} subtitle="Full HR + interview data" color="blue" />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <StatCard icon={TrendingUp} label="Avg Readiness Score" value={`${avgReadiness}%`} subtitle="Three-layer score" color="green" />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Three-layer score: Technical Match + Capability Match + Momentum Score</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <StatCard icon={AlertTriangle} label="Critical Skill Gaps" value={criticalGaps} subtitle="Require immediate action" color="red" />
          <StatCard icon={MessageSquare} label="Interviews Completed" value={completedInterviews} subtitle="Employee + manager combined" color="blue" />
          <StatCard icon={GraduationCap} label="Active Bootcamps" value={activeBootcamps} subtitle="Personalized training plans" color="amber" />
          <StatCard icon={DollarSign} label="Hiring Cost Avoided" value={hiringCostAvoided > 0 ? `€${(hiringCostAvoided / 1000000).toFixed(1)}M` : '€0'} subtitle="Through internal mobility" color="green" />
          <StatCard icon={UserPlus} label="External Pipeline" value={externalWorthyCount} subtitle="Interview-worthy candidates" color="purple" />
        </div>

        {/* Main content 60/40 split */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left column */}
          <div className="lg:col-span-3 space-y-6">
            {/* Radar Chart */}
            <div className="card-skillsight p-5">
              <h3 className="text-[15px] font-semibold mb-4">Skill Coverage vs Strategic Requirements</h3>
              {radarData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis dataKey="skill" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                    <Radar name="Current Workforce" dataKey="workforce" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
                    <Radar name="Strategic Need" dataKey="strategic" stroke="hsl(var(--destructive))" fill="hsl(var(--destructive))" fillOpacity={0.2} strokeDasharray="5 5" />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No skill data available</p>
              )}
            </div>

            {/* Neue Klasse Alignment */}
            <div className="card-skillsight p-6 text-center">
              <p className="text-xs font-semibold text-muted-foreground mb-2">Neue Klasse Alignment</p>
              <p className="text-4xl font-bold font-mono">{avgReadiness}%</p>
              <p className="text-xs text-muted-foreground mt-1">Based on Digital Boost · iFACTORY · EV Battery programs</p>
              <div className="flex gap-1 mt-4 h-2 rounded-full overflow-hidden bg-secondary">
                <div className="bg-status-red rounded-l-full" style={{ width: '50%', opacity: avgReadiness < 50 ? 1 : 0.2 }} />
                <div className="bg-status-amber" style={{ width: '25%', opacity: avgReadiness >= 50 && avgReadiness < 75 ? 1 : 0.2 }} />
                <div className="bg-status-green rounded-r-full" style={{ width: '25%', opacity: avgReadiness >= 75 ? 1 : 0.2 }} />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>0-50%</span><span>50-75%</span><span>75-100%</span>
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Heatmap */}
            <div className="card-skillsight p-5">
              <h3 className="text-[15px] font-semibold mb-4">Skills × People Heatmap</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr>
                      <th className="text-left pb-2 font-medium text-muted-foreground pr-2"></th>
                      {heatmapSkills.map(s => (
                        <th key={s} className="pb-2 font-medium text-muted-foreground px-1" style={{ writingMode: 'vertical-lr', transform: 'rotate(180deg)', fontSize: 10 }}>
                          {s.replace(/([A-Z])/g, ' $1').trim()}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {heatmapData.map((row, i) => (
                      <tr key={i} className="cursor-pointer hover:bg-accent/50" onClick={() => {
                        if (row.empId) navigate(`/employees/${row.empId}`);
                      }}>
                        <td className="py-1 pr-2 font-medium">{row.name}</td>
                        {heatmapSkills.map(skill => {
                          const val = row[skill] as number;
                          return (
                            <td key={skill} className="p-1 text-center">
                              <div
                                className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-mono font-semibold mx-auto ${profBg[val] || profBg[0]} ${profText[val] || profText[0]}`}
                              >
                                {val}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
                Reading this heatmap: <span className="text-status-red font-medium">Red = not yet present</span> · <span className="text-status-amber font-medium">Orange = beginner</span> · <span className="text-bmw-blue font-medium">Yellow = intermediate</span> · <span className="text-status-green font-medium">Green = expert</span>
                <br />Skills ordered by BMW strategic priority (left = highest priority)
              </p>
            </div>

            {/* Internal Reorg Opportunity */}
            <div className="card-skillsight p-5">
              <h3 className="text-[15px] font-semibold mb-4">Internal Reorg Opportunity</h3>
              {roles?.map(role => (
                <div key={role.id} className="mb-3 cursor-pointer" onClick={() => navigate('/reorg')}>
                  <p className="text-xs font-medium mb-1">{role.title}</p>
                  <div className="flex gap-0.5 h-3 rounded-full overflow-hidden bg-secondary">
                    <div className="bg-status-green rounded-l-full" style={{ width: '10%' }} />
                    <div className="bg-primary" style={{ width: '20%' }} />
                    <div className="bg-status-amber rounded-r-full" style={{ width: '30%' }} />
                  </div>
                </div>
              ))}
              <div className="flex gap-4 mt-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-status-green" />≥80%</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary" />60-79%</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-status-amber" />40-59%</span>
              </div>
            </div>

            {/* Recent Assessments */}
            <div className="card-skillsight p-5">
              <h3 className="text-[15px] font-semibold mb-4">Recent Assessments</h3>
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
        </div>
      </div>
    </div>
  );
}
