import { useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { SkillBadge } from "@/components/SkillBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useEmployees, useAllEmployeeSkills, useAlgorithmResults, useRoles } from "@/hooks/useData";
import { supabase } from "@/integrations/supabase/client";
import { Search, Clock, Star, Zap, Plus, UserPlus, Users, CheckCircle, XCircle, AlertTriangle, Award } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { AddExternalCandidateModal } from "@/components/AddExternalCandidateModal";
import { ReadinessRing } from "@/components/ReadinessRing";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  const { data: roles } = useRoles();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [readinessFilter, setReadinessFilter] = useState("all");
  const initialView = searchParams.get("tab") === "external" ? "external" : "internal";
  const [viewMode, setViewMode] = useState<"internal" | "external">(initialView);
  const [showAddModal, setShowAddModal] = useState(false);
  const [extFilter, setExtFilter] = useState<"all" | "pending" | "self" | "flagged" | "talent_pool">(
    searchParams.get("filter") === "pending" ? "pending" : searchParams.get("filter") === "flagged" ? "flagged" : searchParams.get("filter") === "talent_pool" ? "talent_pool" : "all"
  );
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineTarget, setDeclineTarget] = useState<any>(null);
  const [declineNote, setDeclineNote] = useState("");
  const [codeModalCandidate, setCodeModalCandidate] = useState<any>(null);

  // Talent pool modal state
  const [proceedOpen, setProceedOpen] = useState(false);
  const [proceedTarget, setProceedTarget] = useState<any>(null);
  const [proceedNote, setProceedNote] = useState("");
  const [successionOpen, setSuccessionOpen] = useState(false);
  const [successionTarget, setSuccessionTarget] = useState<any>(null);
  const [successionRoleId, setSuccessionRoleId] = useState("");

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
    let list = externalCandidates;
    if (extFilter === "pending") {
      list = list.filter((c: any) => c.submission_source === "candidate_self_submit" && c.manager_decision === "pending" && c.interview_worthy);
    } else if (extFilter === "self") {
      list = list.filter((c: any) => c.submission_source === "candidate_self_submit");
    } else if (extFilter === "flagged") {
      list = list.filter((c: any) => c.status === "flagged_review");
    } else if (extFilter === "talent_pool") {
      list = list.filter((c: any) => c.status === "talent_pool" || c.status === "proceeding");
    }
    return list.filter(c => {
      if (!search) return true;
      return c.name?.toLowerCase().includes(search.toLowerCase());
    });
  }, [externalCandidates, search, extFilter]);

  const pendingCount = useMemo(() => {
    if (!externalCandidates) return 0;
    return externalCandidates.filter((c: any) => c.submission_source === "candidate_self_submit" && c.manager_decision === "pending" && c.interview_worthy).length;
  }, [externalCandidates]);

  const flaggedCount = useMemo(() => {
    if (!externalCandidates) return 0;
    return externalCandidates.filter((c: any) => c.status === "flagged_review").length;
  }, [externalCandidates]);

  const talentPoolCount = useMemo(() => {
    if (!externalCandidates) return 0;
    return externalCandidates.filter((c: any) => c.status === "talent_pool" || c.status === "proceeding").length;
  }, [externalCandidates]);

  const handleApprove = async (candidate: any) => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await supabase.from("external_candidates").update({
      access_code: code,
      code_expires_at: expiresAt,
      status: "invited",
      manager_decision: "approved",
      manager_decision_at: new Date().toISOString(),
    } as any).eq("id", candidate.id);
    toast.success("Interview code generated");
    setCodeModalCandidate({ ...candidate, access_code: code, code_expires_at: expiresAt });
    refetchExternal();
  };

  const handleDecline = async () => {
    if (!declineTarget) return;
    await supabase.from("external_candidates").update({
      status: "rejected",
      manager_decision: "rejected",
      manager_decision_at: new Date().toISOString(),
      manager_decision_note: declineNote || null,
    } as any).eq("id", declineTarget.id);
    toast.success("Application declined");
    setDeclineOpen(false);
    setDeclineTarget(null);
    setDeclineNote("");
    refetchExternal();
  };

  const handleProceed = async () => {
    if (!proceedTarget) return;
    await supabase.from("external_candidates").update({
      status: "proceeding",
      manager_decision: "proceeding",
      manager_decision_at: new Date().toISOString(),
      manager_decision_note: proceedNote || "Marked as proceeding by manager",
    } as any).eq("id", proceedTarget.id);
    toast.success("Candidate marked as proceeding — good luck with the next steps.");
    setProceedOpen(false);
    setProceedTarget(null);
    setProceedNote("");
    refetchExternal();
  };

  if (isLoading) return <div className="flex items-center justify-center h-64"><LoadingSpinner /></div>;

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string }> = {
      cv_assessed: { label: "CV Assessed", variant: "secondary" },
      invited: { label: "Invited — Code Sent", variant: "default" },
      interviewing: { label: "Interview In Progress", variant: "outline" },
      completed: { label: "Assessment Complete", variant: "default" },
      not_worthy: { label: "Below Threshold", variant: "destructive" },
      pending_manager_review: { label: "Pending Review", variant: "outline" },
      below_threshold: { label: "Below Threshold", variant: "destructive" },
      rejected: { label: "Declined", variant: "secondary" },
      flagged_review: { label: "⚠ Needs Review", variant: "outline", className: "border-amber-500 text-amber-700 bg-amber-50" },
      talent_pool: { label: "⭐ Talent Pool", variant: "default", className: "bg-amber-500 text-white border-amber-500" },
      proceeding: { label: "🚀 Proceeding", variant: "default", className: "bg-green-600 text-white border-green-600" },
    };
    const s = map[status] || { label: status, variant: "secondary" as const };
    return <Badge variant={s.variant} className={`text-[10px] ${s.className || ''}`}>{s.label}</Badge>;
  };

  const parseHybridInfo = (candidate: any) => {
    try {
      const data = JSON.parse(candidate.worthy_reasoning || '{}');
      return data;
    } catch {
      return null;
    }
  };

  const isTalentPool = (c: any) => c.status === "talent_pool" || c.status === "proceeding";

  return (
    <div>
      <PageHeader
        title="People"
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
          <div className="space-y-4">
            {/* Sub-filter tabs */}
            <div className="flex gap-1">
              {[
                { value: "all" as const, label: "All" },
                { value: "pending" as const, label: `Pending Review${pendingCount > 0 ? ` (${pendingCount})` : ""}` },
                { value: "flagged" as const, label: `Flagged${flaggedCount > 0 ? ` (${flaggedCount})` : ""}`, amber: true },
                { value: "self" as const, label: "Self-Submitted" },
                { value: "talent_pool" as const, label: `⭐ Talent Pool${talentPoolCount > 0 ? ` (${talentPoolCount})` : ""}`, gold: true },
              ].map(f => (
                <button
                  key={f.value}
                  onClick={() => setExtFilter(f.value)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    extFilter === f.value
                      ? (f as any).amber ? "bg-amber-500 text-white"
                        : (f as any).gold ? "bg-amber-500 text-white"
                        : "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredExternal.length === 0 ? (
                <div className="col-span-full text-center py-12">
                  <UserPlus className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm font-medium">No candidates match this filter</p>
                </div>
              ) : (
                filteredExternal.map(c => {
                  const initials = c.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
                  const role = c.roles as any;
                  const score = c.full_three_layer_score != null ? Math.round(c.full_three_layer_score * 100) : null;
                  const codeDisplay = c.access_code ? c.access_code.slice(0, 3) + "***" : "";
                  const isExpiringSoon = c.code_expires_at ? (new Date(c.code_expires_at).getTime() - Date.now()) < 2 * 24 * 60 * 60 * 1000 : false;
                  const isSelfSubmit = (c as any).submission_source === "candidate_self_submit";
                  const isPendingReview = isSelfSubmit && (c as any).manager_decision === "pending" && c.interview_worthy;
                  const isFlagged = c.status === "flagged_review";
                  const hybridInfo = isFlagged ? parseHybridInfo(c) : null;
                  const isPool = isTalentPool(c);
                  const algoResults = c.full_algorithm_results as any;

                  return (
                    <div
                      key={c.id}
                      className={`card-skillsight p-5 cursor-pointer hover:shadow-skillsight-md hover:-translate-y-0.5 transition-all duration-150 ${
                        isPool ? 'border-l-4' : isFlagged ? 'border-l-4 border-l-amber-500' : ''
                      }`}
                      style={isPool ? { borderLeftColor: '#f59e0b' } : undefined}
                      onClick={() => navigate(`/external-candidate/${c.id}`)}
                    >
                      {/* Talent pool banner */}
                      {isPool && (
                        <div className="flex items-center gap-1.5 text-xs font-semibold mb-3 px-2 py-1 rounded-md" style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>
                          <Award className="h-3.5 w-3.5" />
                          Talent Pool — Interview Verified
                        </div>
                      )}

                      <div className="flex items-start gap-3">
                        <div className="w-11 h-11 rounded-full bg-purple-500 flex items-center justify-center text-sm font-bold text-primary-foreground shrink-0">
                          {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-[15px] font-bold truncate">{c.name}</p>
                            {isSelfSubmit && <Badge variant="outline" className="text-[9px] shrink-0">Self-submitted</Badge>}
                          </div>
                          <p className="text-[13px] text-muted-foreground truncate">{role?.title || "Unknown Role"}</p>
                          <div className="mt-1">{statusBadge(c.status || "invited")}</div>
                        </div>
                      </div>

                      {/* Talent pool: show all three score rings */}
                      {isPool && algoResults && (
                        <div className="mt-3 flex items-center justify-around gap-2 p-2 rounded-md bg-secondary/50">
                          <div className="text-center">
                            <ReadinessRing value={Math.round((algoResults.technicalMatch || 0) * 100)} size="sm" />
                            <p className="text-[9px] text-muted-foreground mt-1">Technical</p>
                          </div>
                          <div className="text-center">
                            <ReadinessRing value={Math.round((algoResults.capabilityMatch || 0) * 100)} size="sm" />
                            <p className="text-[9px] text-muted-foreground mt-1">Capability</p>
                          </div>
                          <div className="text-center">
                            <ReadinessRing value={Math.round((algoResults.momentumScore || 0) * 100)} size="sm" />
                            <p className="text-[9px] text-muted-foreground mt-1">Momentum</p>
                          </div>
                        </div>
                      )}

                      {/* Flagged: show algo vs AI side by side */}
                      {isFlagged && hybridInfo && (
                        <div className="mt-3 p-2 rounded-md bg-amber-50 border border-amber-200 text-xs space-y-1">
                          <div className="flex items-center gap-1.5 text-amber-700 font-medium">
                            <AlertTriangle className="w-3 h-3" />
                            Conflicting Assessment
                          </div>
                          <div className="flex gap-3 text-[11px]">
                            <span>Algo: <span className="font-mono font-medium">{Math.round((c.worthy_score || 0) * 100)}%</span></span>
                            <span>AI: <span className="font-medium">{hybridInfo.method === 'flagged_ai_overrides' ? '✓ Worthy' : '✗ Concerns'}</span></span>
                          </div>
                        </div>
                      )}

                      {/* Score */}
                      {!isFlagged && !isPool && (
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
                      )}

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
                      <div className="flex gap-2 mt-4" onClick={e => e.stopPropagation()}>
                        {isPool && c.status === "talent_pool" && (
                          <>
                            <Button size="sm" className="flex-1 text-xs text-white" style={{ backgroundColor: '#f59e0b' }}
                              onClick={() => { setProceedTarget(c); setProceedOpen(true); }}>
                              Make Offer / Proceed
                            </Button>
                            <Button variant="outline" size="sm" className="text-xs text-primary border-primary/30"
                              onClick={() => { setSuccessionTarget(c); setSuccessionOpen(true); }}>
                              Add to Succession
                            </Button>
                          </>
                        )}
                        {isPool && c.status === "proceeding" && (
                          <Button size="sm" className="flex-1 text-xs" onClick={() => navigate(`/external-candidate/${c.id}`)}>
                            View Details
                          </Button>
                        )}
                        {isFlagged && (
                          <>
                            <Button size="sm" className="flex-1 text-xs bg-green-600 hover:bg-green-700" onClick={() => handleApprove(c)}>
                              <CheckCircle className="w-3 h-3 mr-1" />Approve — Send Code
                            </Button>
                            <Button variant="outline" size="sm" className="text-xs text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => { setDeclineTarget(c); setDeclineOpen(true); }}>
                              <XCircle className="w-3 h-3 mr-1" />Reject
                            </Button>
                          </>
                        )}
                        {isPendingReview && !isFlagged && (
                          <>
                            <Button size="sm" className="flex-1 text-xs bg-green-600 hover:bg-green-700" onClick={() => handleApprove(c)}>
                              <CheckCircle className="w-3 h-3 mr-1" />Send Interview Code
                            </Button>
                            <Button variant="outline" size="sm" className="text-xs text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => { setDeclineTarget(c); setDeclineOpen(true); }}>
                              <XCircle className="w-3 h-3 mr-1" />Decline
                            </Button>
                          </>
                        )}
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
          </div>
        )}
      </div>

      <AddExternalCandidateModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        onCreated={() => refetchExternal()}
      />

      {codeModalCandidate && (
        <AddExternalCandidateModal
          open={!!codeModalCandidate}
          onOpenChange={() => setCodeModalCandidate(null)}
          onCreated={() => refetchExternal()}
        />
      )}

      {/* Decline dialog */}
      <Dialog open={declineOpen} onOpenChange={setDeclineOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Decline {declineTarget?.name}'s application?</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="Add a reason (internal only, not shown to candidate)"
            value={declineNote}
            onChange={e => setDeclineNote(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeclineOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDecline}>Confirm Decline</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Proceed / Make Offer dialog */}
      <Dialog open={proceedOpen} onOpenChange={setProceedOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Proceed with {proceedTarget?.name}?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-md bg-secondary/50">
              <div className="text-center">
                <p className="text-lg font-bold font-mono">{proceedTarget?.full_three_layer_score != null ? Math.round(proceedTarget.full_three_layer_score * 100) : '—'}%</p>
                <p className="text-[10px] text-muted-foreground">Three-Layer Score</p>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{proceedTarget?.name}</p>
                <p className="text-xs text-muted-foreground">{(proceedTarget?.roles as any)?.title || 'Unknown Role'}</p>
              </div>
            </div>
            <Textarea
              placeholder="Next steps / notes for this candidate (optional)"
              value={proceedNote}
              onChange={e => setProceedNote(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProceedOpen(false)}>Cancel</Button>
            <Button className="text-white" style={{ backgroundColor: '#f59e0b' }} onClick={handleProceed}>Mark as Proceeding</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add to Succession dialog */}
      <Dialog open={successionOpen} onOpenChange={setSuccessionOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add {successionTarget?.name} to Succession Plan</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Select a role to add this candidate to the succession plan:</p>
            <Select value={successionRoleId} onValueChange={setSuccessionRoleId}>
              <SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger>
              <SelectContent>
                {roles?.filter(r => r.is_open).map(r => (
                  <SelectItem key={r.id} value={r.id}>{r.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuccessionOpen(false)}>Cancel</Button>
            <Button disabled={!successionRoleId} onClick={async () => {
              if (!successionTarget || !successionRoleId) return;
              // Update the candidate's role_id to add them to succession consideration
              await supabase.from("external_candidates").update({
                role_id: successionRoleId,
              } as any).eq("id", successionTarget.id);
              toast.success(`${successionTarget.name} added to succession plan for this role.`);
              setSuccessionOpen(false);
              setSuccessionTarget(null);
              setSuccessionRoleId("");
              refetchExternal();
            }}>Add to Succession</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
