import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { useEmployees, useAllEmployeeSkills, useRoles, useAlgorithmResults } from "@/hooks/useData";
import { cosineSimilarity, weightedGapScore, runAHP, type AlgorithmInput, type SkillVector } from "@/lib/algorithms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ReadinessRing } from "@/components/ReadinessRing";
import { Button } from "@/components/ui/button";
import { Info, ArrowRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export default function SuccessionBoard() {
  const { data: employees } = useEmployees();
  const { data: allSkills } = useAllEmployeeSkills();
  const { data: roles } = useRoles();
  const { data: allResults } = useAlgorithmResults();
  const navigate = useNavigate();

  const roleRankings = useMemo(() => {
    if (!employees || !allSkills || !roles) return [];

    return roles.filter(r => r.is_open).map(role => {
      const reqSkills = (role.required_skills || {}) as SkillVector;
      const stratWeights = (role.strategic_weights || {}) as SkillVector;

      const candidates = employees.map(emp => {
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

        return {
          ...emp, empSkills, cosine, readiness, gap,
        };
      });

      // Run AHP
      const ahpInput = candidates.map(c => ({
        id: c.id, name: c.name, skills: c.empSkills,
        performanceScore: c.performance_score || 0.5,
        learningAgility: c.learning_agility || 0.5,
        tenureYears: c.tenure_years || 0,
      }));
      const resultsMap: Record<string, { cosine: number; readiness: number }> = {};
      candidates.forEach(c => { resultsMap[c.id] = { cosine: c.cosine, readiness: c.readiness / 100 }; });

      const ahp = runAHP(ahpInput, resultsMap);

      // Assessed count from algorithm_results
      const assessedCount = allResults?.filter(r => r.role_id === role.id).length || 0;

      return {
        role,
        assessedCount,
        rankedCandidates: ahp.candidates.map(ac => {
          const emp = candidates.find(c => c.id === ac.employeeId)!;
          const topSurplus = emp.gap.surplusSkills[0];
          const topGap = emp.gap.criticalGaps[0];
          return { ...ac, employee: emp, readiness: emp.readiness, topSurplus, topGap };
        }),
      };
    });
  }, [employees, allSkills, roles, allResults]);

  return (
    <div>
      <PageHeader title="Succession Planning" subtitle="AHP-ranked internal candidates per strategic role" />
      <div className="px-8 pb-8 space-y-6">
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
                Rankings use the <strong>Analytic Hierarchy Process</strong> — a mathematical multi-criteria decision method.
                Weights: Skills Match <span className="font-mono">33.2%</span> · Strategic Fit <span className="font-mono">30.5%</span> · Learning Agility <span className="font-mono">15.8%</span> · Performance <span className="font-mono">14.7%</span> · Tenure <span className="font-mono">5.7%</span>.
                Consistency Ratio: <span className="font-mono">0.69%</span> (acceptable threshold &lt;10%).
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>

        {/* Role cards */}
        {roleRankings.map(({ role, assessedCount, rankedCandidates }) => (
          <Card key={role.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold">{role.title}</CardTitle>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-muted-foreground">{role.department}</span>
                    <span className="text-xs text-muted-foreground">{assessedCount} assessed</span>
                    <span className="text-xs text-muted-foreground">{role.headcount_needed || 1} open position{(role.headcount_needed || 1) > 1 ? 's' : ''}</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-3">
                {rankedCandidates.slice(0, 4).map((c) => (
                  <div key={c.employeeId} className="rounded-lg border border-border p-3 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => navigate(`/analysis/${c.employeeId}`)}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                        #{c.rank}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold truncate">{c.name}</h4>
                        <p className="text-[10px] text-muted-foreground truncate">{c.employee.job_title}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-mono">{c.readiness}% ready</span>
                      <span className="text-[10px] font-mono text-muted-foreground">Score: {c.finalScore.toFixed(3)}</span>
                    </div>
                    <div className="space-y-1">
                      {c.topSurplus && (
                        <Badge className="text-[10px] bg-green-50 text-green-700 border-green-200 w-full justify-start truncate">
                          ↑ {c.topSurplus.skill.replace(/([A-Z])/g, ' $1').trim()}
                        </Badge>
                      )}
                      {c.topGap && (
                        <Badge variant="secondary" className="text-[10px] w-full justify-start truncate">
                          ↓ {c.topGap.skill.replace(/([A-Z])/g, ' $1').trim()}
                        </Badge>
                      )}
                    </div>
                    <Button variant="ghost" size="sm" className="w-full mt-2 text-xs text-primary h-7">
                      View Analysis <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                ))}
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
