import { useState, useCallback } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useEmployees, useAllEmployeeSkills, useRoles } from "@/hooks/useData";
import { supabase } from "@/integrations/supabase/client";
import { cosineSimilarity, weightedGapScore, type AlgorithmInput, type SkillVector, type GapItem } from "@/lib/algorithms";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ReadinessRing } from "@/components/ReadinessRing";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock, Sparkles, Scan } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ReorgMatch {
  employee: { id: string; name: string; job_title: string | null; department: string | null; avatar_initials: string | null; avatar_color: string | null };
  matchScore: number; readinessPercent: number; immediateReadiness: boolean;
  transferType: string; gapsRemaining: GapItem[];
}

export default function InternalReorg() {
  const { data: employees } = useEmployees();
  const { data: allSkills } = useAllEmployeeSkills();
  const { data: roles } = useRoles();
  const navigate = useNavigate();

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState<ReorgMatch[] | null>(null);

  const selectedRole = roles?.find(r => r.id === selectedRoleId);

  const runScan = useCallback(async () => {
    if (!selectedRole || !employees || !allSkills || !roles) return;
    setScanning(true);
    setResults(null);

    await new Promise(r => setTimeout(r, 1500));

    const reqSkills = (selectedRole.required_skills || {}) as SkillVector;
    const stratWeights = (selectedRole.strategic_weights || {}) as SkillVector;

    const matches: ReorgMatch[] = employees.map(emp => {
      const empSkills: SkillVector = {};
      allSkills.filter(s => s.employee_id === emp.id).forEach(s => { empSkills[s.skill_name] = s.proficiency || 0; });

      const input: AlgorithmInput = {
        employee: {
          id: emp.id, name: emp.name, skills: empSkills,
          performanceScore: emp.performance_score || 0.5,
          learningAgility: emp.learning_agility || 0.5,
          tenureYears: emp.tenure_years || 0,
        },
        targetRole: { id: selectedRole.id, title: selectedRole.title, requiredSkills: reqSkills, strategicWeights: stratWeights },
        allRoles: roles.map(r => ({ requiredSkills: (r.required_skills || {}) as SkillVector })),
      };

      const cosine = cosineSimilarity(input);
      const gap = weightedGapScore(input);
      const readiness = gap.readinessPercent;
      const isSameDept = emp.department === selectedRole.department;
      const transferType = readiness >= 80 ? (isSameDept ? 'direct' : 'lateral') : readiness >= 60 && !isSameDept ? 'hidden_match' : 'develop_promote';

      return {
        employee: { id: emp.id, name: emp.name, job_title: emp.job_title, department: emp.department, avatar_initials: emp.avatar_initials, avatar_color: emp.avatar_color },
        matchScore: cosine, readinessPercent: readiness, immediateReadiness: readiness >= 80,
        transferType, gapsRemaining: gap.criticalGaps,
      };
    }).sort((a, b) => {
      if (a.immediateReadiness && !b.immediateReadiness) return -1;
      if (!a.immediateReadiness && b.immediateReadiness) return 1;
      return b.readinessPercent - a.readinessPercent;
    });

    await supabase.from("reorg_matches").delete().eq("role_id", selectedRole.id);
    for (const m of matches) {
      await supabase.from("reorg_matches").insert({
        employee_id: m.employee.id, role_id: selectedRole.id,
        cosine_similarity: m.matchScore, readiness_percent: m.readinessPercent,
        immediate_readiness: m.immediateReadiness, transfer_type: m.transferType,
        department_from: m.employee.department, department_to: selectedRole.department,
        gaps_remaining: m.gapsRemaining as any,
      });
    }

    setResults(matches);
    setScanning(false);
  }, [selectedRole, employees, allSkills, roles]);

  const immediate = results?.filter(r => r.readinessPercent >= 80) || [];
  const nearReady = results?.filter(r => r.readinessPercent >= 60 && r.readinessPercent < 80) || [];
  const developing = results?.filter(r => r.readinessPercent < 60) || [];

  return (
    <div>
      <PageHeader title="Internal Reorganisation Engine" subtitle="Scan employees against open roles using all six algorithms" />
      <div className="p-6 space-y-6">
        {/* Role selector */}
        <Card>
          <CardContent className="p-4 flex flex-wrap items-center gap-4">
            <Scan className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium">Select a role to scan →</span>
            <Select value={selectedRoleId || ""} onValueChange={v => { setSelectedRoleId(v); setResults(null); }}>
              <SelectTrigger className="w-64"><SelectValue placeholder="Select a role" /></SelectTrigger>
              <SelectContent>
                {roles?.filter(r => r.is_open).map(r => (
                  <SelectItem key={r.id} value={r.id}>{r.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedRoleId && (
              <Button onClick={runScan} disabled={scanning} className="ml-auto">
                {scanning ? 'Scanning…' : 'Run Scan'}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Scanning state */}
        {scanning && (
          <Card>
            <CardContent className="py-10 text-center">
              <Progress value={65} className="h-1.5 max-w-sm mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Scanning {employees?.length || 0} employees across all skill dimensions…</p>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {results && !scanning && (
          <>
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-status-green" />
                <span className="font-semibold">{immediate.length}</span>
                <span className="text-muted-foreground">Immediately Transferable</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-status-amber" />
                <span className="font-semibold">{nearReady.length}</span>
                <span className="text-muted-foreground">Near-Ready</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Sparkles className="h-4 w-4 text-status-purple" />
                <span className="font-semibold">{results.filter(r => r.transferType === 'hidden_match').length}</span>
                <span className="text-muted-foreground">Hidden Matches</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Lane title="Immediate (≥80%)" color="green" matches={immediate} navigate={navigate} />
              <Lane title="Near-Ready (60–79%)" color="amber" matches={nearReady} navigate={navigate} />
              <Lane title="Developing (<60%)" color="muted" matches={developing} navigate={navigate} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Lane({ title, color, matches, navigate }: { title: string; color: string; matches: ReorgMatch[]; navigate: any }) {
  const borderColor = color === 'green' ? 'border-status-green/30' : color === 'amber' ? 'border-status-amber/30' : 'border-border';

  return (
    <div>
      <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-3">{title} ({matches.length})</h3>
      <div className="space-y-3">
        {matches.map(m => (
          <Card key={m.employee.id} className={`cursor-pointer hover:shadow-md transition-shadow ${borderColor}`}
            onClick={() => navigate(`/analysis/${m.employee.id}`)}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-primary-foreground"
                  style={{ backgroundColor: m.employee.avatar_color || 'hsl(213, 77%, 47%)' }}>
                  {m.employee.avatar_initials || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold truncate">{m.employee.name}</h4>
                  <p className="text-xs text-muted-foreground truncate">{m.employee.job_title}</p>
                  <p className="text-[10px] text-muted-foreground">{m.employee.department}</p>
                </div>
                <ReadinessRing value={m.readinessPercent} size="sm" />
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] font-mono text-muted-foreground">Match: {m.matchScore.toFixed(2)}</span>
                {m.transferType === 'hidden_match' && (
                  <Badge className="text-[10px] bg-status-purple-light text-status-purple border-status-purple/20">Hidden Match</Badge>
                )}
                {m.transferType === 'lateral' && (
                  <Badge className="text-[10px] bg-bmw-blue-light text-bmw-blue border-bmw-blue/20">Lateral</Badge>
                )}
              </div>
              {m.gapsRemaining.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {m.gapsRemaining.slice(0, 3).map((g, i) => (
                    <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{g.skill.replace(/([A-Z])/g, ' $1').trim()}</span>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {matches.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No matches</p>}
      </div>
    </div>
  );
}
