import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { useEmployees, useAllEmployeeSkills, useRoles, useAlgorithmResults } from "@/hooks/useData";
import { cosineSimilarity, weightedGapScore, runAHP, detectRoleType, type AlgorithmInput, type SkillVector, type RoleType } from "@/lib/algorithms";
import { skillsToVector, skillsToWeights } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ReadinessRing } from "@/components/ReadinessRing";
import { Button } from "@/components/ui/button";
import { Info, ArrowRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function SuccessionBoard() {
  const { data: employees } = useEmployees();
  const { data: allSkills } = useAllEmployeeSkills();
  const { data: roles } = useRoles();
  const { data: allResults } = useAlgorithmResults();
  const navigate = useNavigate();

  const { data: talentPoolCandidates } = useQuery({
    queryKey: ["talent_pool_succession"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("external_candidates")
        .select("*, roles(title)")
        .in("status", ["talent_pool", "proceeding"]);
      if (error) throw error;
      return data;
    },
  });

  const roleRankings = useMemo(() => {
    if (!employees || !allSkills || !roles) return [];

    return roles.filter(r => r.is_open).map(role => {
      const reqSkills = (role.required_skills || {}) as SkillVector;
      const stratWeights = (role.strategic_weights || {}) as SkillVector;
      const roleType: RoleType = detectRoleType(reqSkills as Record<string, number>, stratWeights as Record<string, number>);

      // Internal candidates
      const internalCandidates = employees.map(emp => {
        const empSkills: SkillVector = {};
        allSkills.filter(s => s.employee_id === emp.id).forEach(s => { empSkills[s.skill_name] = s.proficiency || 0; });

        const input: AlgorithmInput = {
          employee: {
            id: emp.id, name: emp.name, skills: empSkills,
            performanceScore: emp.performance_score || 0.5,
            learningAgility: emp.learning_agility || 0.5,
            tenureYears: emp.tenure_years || 0,
          },
          targetRole: { id: role.id, title: role.title, requiredSkills: reqSkills, strategicWeights: stratWeights },
          allRoles: roles.map(r => ({ requiredSkills: (r.required_skills || {}) as SkillVector })),
        };

        const cosine = cosineSimilarity(input);
        const gap = weightedGapScore(input);
        const readiness = gap.readinessPercent;

        const dbResult = allResults?.find(r => r.employee_id === emp.id && r.role_id === role.id);
        const threeLayerScore = (dbResult as any)?.three_layer_score;
        const momentumScore = (dbResult as any)?.momentum_score || 0;
        const technicalMatch = (dbResult as any)?.technical_match || cosine;

        return {
          ...emp, empSkills, cosine, readiness, gap, threeLayerScore, momentumScore, technicalMatch,
          isExternal: false,
        };
      });

      // External talent pool candidates for this role
      const externalForRole = (talentPoolCandidates || [])
        .filter(c => c.role_id === role.id)
        .map(c => {
          const algoResults = c.full_algorithm_results as any;
          const interviewSkills = (c.interview_skills || {}) as Record<string, any>;
          const empSkills: SkillVector = {};
          Object.entries(interviewSkills).forEach(([k, v]: [string, any]) => {
            empSkills[k] = typeof v === "number" ? v : v?.proficiency || 0;
          });

          const cosine = algoResults?.cosine || algoResults?.technicalMatch || 0;
          const threeLayerScore = c.full_three_layer_score || 0;
          const momentumScore = algoResults?.momentumScore || 0;
          const technicalMatch = algoResults?.technicalMatch || cosine;
          const readiness = Math.round(threeLayerScore * 100);

          const initials = c.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();

          return {
            id: c.id,
            name: c.name,
            job_title: "External Candidate",
            department: "External",
            avatar_initials: initials,
            avatar_color: "#8b5cf6",
            performance_score: 0.5,
            learning_agility: 0.5,
            tenure_years: 0,
            empSkills,
            cosine,
            readiness,
            gap: { readinessPercent: readiness, criticalGaps: [], surplusSkills: [] },
            threeLayerScore,
            momentumScore,
            technicalMatch,
            isExternal: true,
          };
        });

      const allCandidates = [...internalCandidates, ...externalForRole];

      const ahpInput = allCandidates.map(c => ({
        id: c.id, name: c.name, skills: c.empSkills,
        performanceScore: c.performance_score || 0.5,
        learningAgility: c.learning_agility || 0.5,
        tenureYears: c.tenure_years || 0,
      }));
      const resultsMap: Record<string, { cosine: number; readiness: number }> = {};
      allCandidates.forEach(c => { resultsMap[c.id] = { cosine: c.cosine, readiness: c.readiness / 100 }; });

      const ahp = runAHP(ahpInput, resultsMap, roleType);
      const assessedCount = allResults?.filter(r => r.role_id === role.id).length || 0;

      return {
        role,
        roleType,
        ahpWeights: ahp.weights,
        assessedCount,
        externalCount: externalForRole.length,
        rankedCandidates: ahp.candidates.map(ac => {
          const emp = allCandidates.find(c => c.id === ac.employeeId)!;
          const topSurplus = emp.gap.surplusSkills[0];
          const topGap = emp.gap.criticalGaps[0];
          return {
            ...ac, employee: emp, readiness: emp.readiness,
            topSurplus, topGap,
            threeLayerScore: emp.threeLayerScore,
            momentumScore: emp.momentumScore,
            technicalMatch: emp.technicalMatch,
            isExternal: emp.isExternal,
          };
        }),
      };
    });
  }, [employees, allSkills, roles, allResults, talentPoolCandidates]);

  return (
    <div>
      <PageHeader title="Succession Planning" subtitle="AHP-ranked candidates per strategic role — internal and external talent pool combined" />
      <div className="p-6 space-y-6">
        {/* AHP Explanation */}
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground gap-1.5">
              <Info className="h-3.5 w-3.5" /> AHP Rankings Explained
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Card className="mt-2">
              <CardContent className="p-4 text-xs text-muted-foreground">
                Rankings use the <strong>Analytic Hierarchy Process</strong> with role-type-aware weights.
                AHP weights adapt based on role type (Emerging Tech, Leadership, Technical Specialist, Manufacturing, Cross-Functional).
                Candidates are scored across three layers: Technical Match, Capability Match, and Momentum Score.
                External talent pool candidates compete on equal footing with internal employees.
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>

        {/* Role cards */}
        {roleRankings.map(({ role, roleType, ahpWeights, assessedCount, externalCount, rankedCandidates }) => (
          <Card key={role.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold">{role.title}</CardTitle>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-muted-foreground">{role.department}</span>
                    <Badge variant="outline" className="text-[10px]">{roleType.replace(/_/g, ' ')}</Badge>
                    <span className="text-xs text-muted-foreground">{assessedCount} assessed</span>
                    <span className="text-xs text-muted-foreground">{role.headcount_needed || 1} open</span>
                    {externalCount > 0 && (
                      <Badge className="text-[9px] bg-purple-100 text-purple-700 border-purple-200">{externalCount} external in pool</Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {rankedCandidates.slice(0, 4).map((c) => {
                  const displayScore = c.threeLayerScore != null ? Math.round(c.threeLayerScore * 100) : c.readiness;
                  const techPct = Math.round((c.technicalMatch || 0) * 100);
                  const momPct = Math.round((c.momentumScore || 0) * 100);
                  return (
                    <div key={c.employeeId} className={`rounded-lg border p-3 hover:shadow-md transition-shadow cursor-pointer flex flex-col ${
                      c.isExternal ? 'border-l-4' : 'border-border'
                    }`}
                      style={c.isExternal ? { borderLeftColor: '#8b5cf6' } : undefined}
                      onClick={() => navigate(c.isExternal ? `/external-candidate/${c.employeeId}` : `/analysis/${c.employeeId}`)}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                          #{c.rank}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h4 className="text-sm font-semibold truncate">{c.name}</h4>
                            {c.isExternal && <Badge className="text-[8px] bg-purple-100 text-purple-700 border-purple-200 shrink-0">External</Badge>}
                          </div>
                          <p className="text-[10px] text-muted-foreground truncate">{c.employee.job_title}</p>
                        </div>
                      </div>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex gap-0.5 h-2 rounded-full overflow-hidden mb-1.5">
                              <div className="bg-primary rounded-l-full" style={{ width: `${techPct}%` }} />
                              <div className="bg-purple-500" style={{ width: `${Math.round((c.readiness / 3) || 0)}%` }} />
                              <div className="bg-status-green rounded-r-full" style={{ width: `${momPct}%` }} />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs space-y-1">
                            <p><span className="inline-block w-2 h-2 rounded-full bg-primary mr-1" />Technical — current skill match: {techPct}%</p>
                            <p><span className="inline-block w-2 h-2 rounded-full bg-purple-500 mr-1" />Capability — thinking patterns</p>
                            <p><span className="inline-block w-2 h-2 rounded-full bg-status-green mr-1" />Momentum — growth trajectory: {momPct}%</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <div className="flex items-center justify-between mb-2">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-xs font-mono cursor-help">{displayScore}% ready</span>
                            </TooltipTrigger>
                            <TooltipContent className="text-xs max-w-[220px]">
                              Score combines: Technical skill match + Thinking capability + Growth momentum. Weights adjusted for role type.
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <span className="text-[10px] font-mono text-muted-foreground">Score: {c.finalScore.toFixed(3)}</span>
                      </div>
                      <div className="space-y-1">
                        {c.topSurplus && (
                          <Badge className="text-[10px] bg-status-green-light text-status-green border-status-green/20 w-full justify-start truncate">
                            ↑ {c.topSurplus.skill.replace(/([A-Z])/g, ' $1').trim()}
                          </Badge>
                        )}
                        {c.topGap && (
                          <Badge variant="secondary" className="text-[10px] w-full justify-start truncate">
                            ↓ {c.topGap.skill.replace(/([A-Z])/g, ' $1').trim()}
                          </Badge>
                        )}
                      </div>
                      <Button variant="ghost" size="sm" className="w-full mt-auto pt-2 text-xs text-primary h-7">
                        View Analysis <ArrowRight className="h-3 w-3 ml-1" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}

        {roleRankings.length === 0 && (
          <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">No open roles defined yet.</CardContent></Card>
        )}
      </div>
    </div>
  );
}
