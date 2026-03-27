import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { SkillBadge } from "@/components/SkillBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEmployees, useAllEmployeeSkills, useAlgorithmResults } from "@/hooks/useData";
import { Search, Clock, Star, Zap, Plus } from "lucide-react";

export default function EmployeeList() {
  const { data: employees, isLoading } = useEmployees();
  const { data: allSkills } = useAllEmployeeSkills();
  const { data: results } = useAlgorithmResults();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [readinessFilter, setReadinessFilter] = useState("all");

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

  if (isLoading) return <div className="flex items-center justify-center h-64"><LoadingSpinner /></div>;

  return (
    <div>
      <PageHeader title="Employees" subtitle="BMW Group Workforce" actions={<Button size="sm"><Plus className="h-4 w-4 mr-1" />Add Employee</Button>} />
      <div className="p-6 space-y-5">
        {/* Filter bar */}
        <div className="card-skillsight p-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by name or role..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
          </div>
          <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
            <option value="all">All Departments</option>
            {departments.map(d => <option key={d} value={d!}>{d}</option>)}
          </select>
          <div className="flex gap-1">
            {[{ value: "all", label: "All" }, { value: "none", label: "Not Assessed" }, { value: "low", label: "<50%" }, { value: "mid", label: "50-75%" }, { value: "high", label: ">75%" }].map(f => (
              <button
                key={f.value}
                onClick={() => setReadinessFilter(f.value)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${readinessFilter === f.value ? 'bg-bmw-blue text-white' : 'bg-secondary text-muted-foreground hover:bg-accent'}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <p className="text-xs text-muted-foreground">Showing {filtered.length} of {employees?.length || 0} employees</p>

        {/* Employee grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(emp => {
            const empSkills = allSkills?.filter(s => s.employee_id === emp.id && (s.proficiency || 0) > 0) || [];
            const topSkills = empSkills.sort((a, b) => (b.proficiency || 0) - (a.proficiency || 0)).slice(0, 3);
            const result = results?.find(r => r.employee_id === emp.id);
            const readiness = result ? Math.round((result.final_readiness || 0) * 100) : null;

            return (
              <div key={emp.id} className="card-skillsight p-5 cursor-pointer hover:shadow-skillsight-md hover:-translate-y-0.5 transition-all duration-150">
                {/* Top row */}
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0" style={{ backgroundColor: emp.avatar_color || '#1c69d3' }}>
                    {emp.avatar_initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-bold truncate">{emp.name}</p>
                    <p className="text-[13px] text-muted-foreground truncate">{emp.job_title}</p>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-medium bg-secondary text-muted-foreground">{emp.department}</span>
                  </div>
                </div>

                {/* Micro stats */}
                <div className="flex gap-4 mt-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{emp.tenure_years}yrs</span>
                  <span className="flex items-center gap-1 font-mono"><Star className="h-3 w-3" />{Math.round((emp.performance_score || 0) * 100)}% perf</span>
                  <span className="flex items-center gap-1 font-mono"><Zap className="h-3 w-3" />{Math.round((emp.learning_agility || 0) * 100)}% agility</span>
                </div>

                {/* Readiness */}
                {readiness !== null ? (
                  <div className="mt-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Readiness</span>
                      <span className="font-mono font-semibold" style={{ color: readiness < 50 ? '#ef4444' : readiness < 75 ? '#f59e0b' : '#22c55e' }}>{readiness}%</span>
                    </div>
                    <div className="h-1 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full rounded-full bg-bmw-blue transition-all" style={{ width: `${readiness}%` }} />
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-[11px] italic text-muted-foreground">Not yet assessed</p>
                )}

                {/* Top skills */}
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {topSkills.map(s => (
                    <SkillBadge key={s.skill_name} skill={s.skill_name} proficiency={(s.proficiency || 0) as 0 | 1 | 2 | 3} showLabel={false} />
                  ))}
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => navigate(`/employees/${emp.id}`)}>View Profile</Button>
                  <Button size="sm" className="flex-1 text-xs" onClick={() => navigate(`/interview/employee/${emp.id}`)}>Start Interview</Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
