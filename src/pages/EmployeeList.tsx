import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { SkillBadge } from "@/components/SkillBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useEmployees, useAllEmployeeSkills, useAlgorithmResults } from "@/hooks/useData";
import { supabase } from "@/integrations/supabase/client";
import { Search, Clock, Star, Zap, Plus, UserPlus, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { AddExternalCandidateModal } from "@/components/AddExternalCandidateModal";
import { ReadinessRing } from "@/components/ReadinessRing";

function useExternalCandidates() {
  return useQuery({
    queryKey: ["external_candidates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("external_candidates")
        .select("*, roles(title)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export default function EmployeeList() {
  const { data: employees, isLoading } = useEmployees();
  const { data: allSkills } = useAllEmployeeSkills();
  const { data: results } = useAlgorithmResults();
  const { data: externalCandidates, refetch: refetchExternal } = useExternalCandidates();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [readinessFilter, setReadinessFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"internal" | "external">("internal");
  const [showAddModal, setShowAddModal] = useState(false);

  const departments = useMemo(() => {
    if (!employees) return [];
    return [...new Set(employees.map(e => e.department).filter(Boolean))];
  }, [employees]);

  const filtered = useMemo(() => {
    if (!employees) return [];
    return employees.filter(emp => {
      const matchesSearch = !search || emp.name?.toLowerCase().includes(search.toLowerCase()) || emp.job_title?.toLowerCase().includes(search.toLowerCase());
      const matchesDept = deptFilter === "all" || emp.department === deptFilter;
      const result = results?.find(r => r.employee_id === emp.id);
      const readiness = result ? Math.round((result.final_readiness || 0) * 100) : null;
      let matchesReadiness = true;
      if (readinessFilter === "none") matchesReadiness = readiness === null;
      else if (readinessFilter === "low") matchesReadiness = readiness !== null && readiness < 50;
      else if (readinessFilter === "mid") matchesReadiness = readiness !== null && readiness >= 50 && readiness <= 75;
      else if (readinessFilter === "high") matchesReadiness = readiness !== null && readiness > 75;
      return matchesSearch && matchesDept && matchesReadiness;
    });
  }, [employees, search, deptFilter, readinessFilter, results]);

  const filteredExternal = useMemo(() => {
    if (!externalCandidates) return [];
    return externalCandidates.filter(c => {
      if (!search) return true;
      return c.name?.toLowerCase().includes(search.toLowerCase());
    });
  }, [externalCandidates, search]);

  if (isLoading) return <div className="flex items-center justify-center h-64"><LoadingSpinner /></div>;

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      cv_assessed: { label: "CV Assessed", variant: "secondary" },
      invited: { label: "Invited — Code Sent", variant: "default" },
      interviewing: { label: "Interview In Progress", variant: "outline" },
      completed: { label: "Assessment Complete", variant: "default" },
      not_worthy: { label: "Below Threshold", variant: "destructive" },
    };
    const s = map[status] || { label: status, variant: "secondary" as const };
    return <Badge variant={s.variant} className="text-[10px]">{s.label}</Badge>;
  };

  return (
    <div>
      <PageHeader
        title="Employees"
        subtitle="BMW Group Workforce"
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowAddModal(true)}>
              <UserPlus className="h-4 w-4 mr-1" />External Candidate
            </Button>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" />Add Employee</Button>
          </div>
        }
      />
      <div className="p-6 space-y-5">
        {/* Filter bar */}
        <div className="card-skillsight p-4 flex flex-wrap items-center gap-3">
          {/* View toggle */}
          <div className="flex rounded-lg border border-input overflow-hidden">
            <button
              onClick={() => setViewMode("internal")}
              className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors ${
                viewMode === "internal" ? "bg-background shadow-sm" : "bg-transparent text-muted-foreground hover:bg-accent"
              }`}
            >
              <Users className="h-3 w-3" />Internal Employees
            </button>
            <button
              onClick={() => setViewMode("external")}
              className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors ${
                viewMode === "external" ? "bg-background shadow-sm" : "bg-transparent text-muted-foreground hover:bg-accent"
              }`}
            >
              <UserPlus className="h-3 w-3" />External Candidates
              {(externalCandidates?.length || 0) > 0 && (
                <span className="ml-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center">
                  {externalCandidates?.length}
                </span>
              )}
            </button>
          </div>

          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by name or role..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
          </div>

          {viewMode === "internal" && (
            <>
              <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
                <option value="all">All Departments</option>
                {departments.map(d => <option key={d} value={d!}>{d}</option>)}
              </select>
              <div className="flex gap-1">
                {[{ value: "all", label: "All" }, { value: "none", label: "Not Assessed" }, { value: "low", label: "<50%" }, { value: "mid", label: "50-75%" }, { value: "high", label: ">75%" }].map(f => (
                  <button
                    key={f.value}
                    onClick={() => setReadinessFilter(f.value)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${readinessFilter === f.value ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:bg-accent'}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          {viewMode === "internal"
            ? `Showing ${filtered.length} of ${employees?.length || 0} employees`
            : `Showing ${filteredExternal.length} external candidates`
          }
        </p>

        {/* Internal employees grid */}
        {viewMode === "internal" && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(emp => {
              const empSkills = allSkills?.filter(s => s.employee_id === emp.id && (s.proficiency || 0) > 0) || [];
              const topSkills = empSkills.sort((a, b) => (b.proficiency || 0) - (a.proficiency || 0)).slice(0, 3);
              const result = results?.find(r => r.employee_id === emp.id);
              const readiness = result ? Math.round((result.final_readiness || 0) * 100) : null;

              return (
                <div key={emp.id} className="card-skillsight p-5 cursor-pointer hover:shadow-skillsight-md hover:-translate-y-0.5 transition-all duration-150">
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold text-primary-foreground shrink-0" style={{ backgroundColor: emp.avatar_color || 'hsl(213, 77%, 47%)' }}>
                      {emp.avatar_initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-bold truncate">{emp.name}</p>
                      <p className="text-[13px] text-muted-foreground truncate">{emp.job_title}</p>
                      <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-medium bg-secondary text-muted-foreground">{emp.department}</span>
                    </div>
                  </div>

                  <div className="flex gap-4 mt-3 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{emp.tenure_years}yrs</span>
                    <span className="flex items-center gap-1 font-mono"><Star className="h-3 w-3" />{Math.round((emp.performance_score || 0) * 100)}% perf</span>
                    <span className="flex items-center gap-1 font-mono"><Zap className="h-3 w-3" />{Math.round((emp.learning_agility || 0) * 100)}% agility</span>
                  </div>

                  {readiness !== null ? (
                    <div className="mt-3">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Readiness</span>
                        <span className={`font-mono font-semibold ${readiness < 50 ? 'text-destructive' : readiness < 75 ? 'text-yellow-600' : 'text-green-600'}`}>{readiness}%</span>
                      </div>
                      <div className="h-1 rounded-full bg-secondary overflow-hidden">
                        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${readiness}%` }} />
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3 text-[11px] italic text-muted-foreground">Not yet assessed</p>
                  )}

                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {topSkills.map(s => (
                      <SkillBadge key={s.skill_name} skill={s.skill_name} proficiency={(s.proficiency || 0) as 0 | 1 | 2 | 3} showLabel={false} />
                    ))}
                  </div>

                  <div className="flex gap-2 mt-4">
                    <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => navigate(`/employees/${emp.id}`)}>View Profile</Button>
                    <Button size="sm" className="flex-1 text-xs" onClick={() => navigate(`/interview/employee/${emp.id}`)}>Start Interview</Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* External candidates grid */}
        {viewMode === "external" && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredExternal.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <UserPlus className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium">No external candidates yet</p>
                <p className="text-xs text-muted-foreground mt-1">Click "External Candidate" to add one and generate an interview code.</p>
              </div>
            ) : (
              filteredExternal.map(c => {
                const initials = c.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
                const role = c.roles as any;
                const score = c.full_three_layer_score != null ? Math.round(c.full_three_layer_score * 100) : null;
                const codeDisplay = c.access_code ? c.access_code.slice(0, 3) + "***" : "";
                const isExpiringSoon = c.code_expires_at ? (new Date(c.code_expires_at).getTime() - Date.now()) < 2 * 24 * 60 * 60 * 1000 : false;

                return (
                  <div key={c.id} className="card-skillsight p-5">
                    <div className="flex items-start gap-3">
                      <div className="w-11 h-11 rounded-full bg-purple-500 flex items-center justify-center text-sm font-bold text-primary-foreground shrink-0">
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-bold truncate">{c.name}</p>
                        <p className="text-[13px] text-muted-foreground truncate">{role?.title || "Unknown Role"}</p>
                        <div className="mt-1">{statusBadge(c.status || "invited")}</div>
                      </div>
                    </div>

                    {/* Score */}
                    <div className="mt-3">
                      {score !== null ? (
                        <div className="flex items-center gap-2">
                          <ReadinessRing value={score} size="sm" />
                          <div>
                            <p className="text-xs font-medium">Full Score: {score}%</p>
                            <Badge variant="outline" className="text-[9px] mt-0.5">CV + Interview ✓</Badge>
                          </div>
                        </div>
                      ) : c.worthy_score != null ? (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-mono">Partial Score (CV Only): {Math.round(c.worthy_score * 100)}%</span>
                          <Badge variant="secondary" className="text-[9px]">CV Only ⚠</Badge>
                        </div>
                      ) : null}
                    </div>

                    {/* Code section */}
                    {c.status === "invited" && c.access_code && (
                      <div className="mt-3 p-2 rounded-md bg-secondary text-xs space-y-1">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Code: <span className="font-mono font-medium">{codeDisplay}</span></span>
                          {c.code_expires_at && (
                            <span className={isExpiringSoon ? "text-yellow-600 font-medium" : "text-muted-foreground"}>
                              Expires {new Date(c.code_expires_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 mt-4">
                      {c.status === "completed" && (
                        <Button size="sm" className="flex-1 text-xs" onClick={() => navigate(`/analysis-external/${c.id}`)}>
                          View Full Assessment
                        </Button>
                      )}
                      {c.status === "invited" && (
                        <Button variant="outline" size="sm" className="flex-1 text-xs">
                          View Code
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      <AddExternalCandidateModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        onCreated={() => refetchExternal()}
      />
    </div>
  );
}
