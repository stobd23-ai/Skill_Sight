import { useParams, useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { ReadinessRing } from "@/components/ReadinessRing";
import { SkillBadge } from "@/components/SkillBadge";
import { PriorityBadge } from "@/components/PriorityBadge";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { useEmployee, useEmployeeSkills, useAlgorithmResults, useInterviews, useRoles } from "@/hooks/useData";
import { useInvitations } from "@/hooks/useInvitations";
import { InviteInterviewModal } from "@/components/InviteInterviewModal";
import { supabase } from "@/integrations/supabase/client";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Legend } from "recharts";
import { Check, Clock, AlertCircle, Sparkles, ChevronRight, Users, BarChart3, Mail, XCircle } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { PRESET_PACKS } from "@/lib/presetPacks";
import { toast } from "@/hooks/use-toast";

export default function EmployeeProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: employee, isLoading } = useEmployee(id);
  const { data: skills } = useEmployeeSkills(id);
  const { data: results } = useAlgorithmResults(id);
  const { data: interviews } = useInterviews(id);
  
  const { data: roles } = useRoles();
  const { data: invitations, refetch: refetchInvitations } = useInvitations(id);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);

  const pendingInvite = invitations?.find(i => i.status === 'pending');
  const acceptedInvite = invitations?.find(i => i.status === 'accepted' || i.status === 'in_progress');

  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`interview-updates-${id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'interviews',
        filter: `employee_id=eq.${id}`,
      }, () => {
        window.location.reload();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id]);

  const latestResult = results?.[0];
  const readiness = latestResult ? Math.round((latestResult.final_readiness || 0) * 100) : null;
  const empInterviews = interviews?.filter(i => i.employee_id === id) || [];
  
  const completedEmployee = empInterviews.some(i => i.interview_type === 'employee' && i.status === 'completed');
  const completedManager = empInterviews.some(i => i.interview_type === 'manager' && i.status === 'completed');

  const selectedRole = roles?.find(r => r.id === (selectedRoleId || latestResult?.role_id));
  const radarData = useMemo(() => {
    if (!skills?.length) return [];
    const requiredSkills = skillsToVector(selectedRole?.required_skills);
    const allSkillNames = new Set<string>();
    skills.forEach(s => allSkillNames.add(s.skill_name));
    if (requiredSkills) Object.keys(requiredSkills).forEach(s => allSkillNames.add(s));

    return Array.from(allSkillNames).map(name => ({
      skill: formatSkillName(name),
      employee: (skills.find(s => s.skill_name === name)?.proficiency || 0),
      role: requiredSkills?.[name] || 0,
    }));
  }, [skills, selectedRole]);

  const aiSkills = skills?.filter(s => s.source === 'employee_interview' || s.source === 'combined') || [];

  if (isLoading) return <div className="flex items-center justify-center h-64"><LoadingSpinner /></div>;
  if (!employee) return <EmptyState icon={Users} title="Employee not found" description="This employee does not exist." />;

  const reviews = (employee.past_performance_reviews as string[]) || [];
  const training = (employee.training_history as string[]) || [];

  const pipeline = [
    { name: 'HR Data Ingested', done: true, icon: Check },
    { name: 'Employee Interview', done: completedEmployee, inProgress: empInterviews.some(i => i.interview_type === 'employee' && i.status === 'in_progress'), pending: !!pendingInvite, icon: completedEmployee ? Check : Clock },
    { name: 'Manager Interview', done: completedManager, inProgress: empInterviews.some(i => i.interview_type === 'manager' && i.status === 'in_progress'), icon: completedManager ? Check : Clock },
    { name: 'Algorithm Analysis', done: !!latestResult, icon: latestResult ? Check : AlertCircle },
  ];

  return (
    <div>
      <PageHeader title="Employee Profile" />
      <div className="p-6 space-y-6">
        {/* Profile header */}
        <div className="card-skillsight p-6">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex items-start gap-4 flex-1">
              <div className="w-[72px] h-[72px] rounded-full flex items-center justify-center text-xl font-bold text-primary-foreground shrink-0" style={{ backgroundColor: employee.avatar_color || 'hsl(213, 77%, 47%)' }}>
                {employee.avatar_initials}
              </div>
              <div>
                <h2 className="text-2xl font-bold">{employee.name}</h2>
                <p className="text-sm text-muted-foreground">{employee.job_title} · {employee.department}</p>
                <div className="flex gap-2 mt-2">
                  <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-secondary text-muted-foreground">{employee.tenure_years} years</span>
                  {completedEmployee && <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-status-green-light text-status-green">Interviewed</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-6">
              {readiness !== null && <ReadinessRing value={readiness} size="sm" label="Readiness" />}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            {pendingInvite ? (
              <div className="flex items-center gap-3">
                <Button size="sm" disabled className="bg-status-green/20 text-status-green border-status-green/30">
                  <Check className="h-3 w-3 mr-1" /> Invitation Sent
                </Button>
                <button
                  onClick={async () => {
                    if (!confirm("Cancel this invitation?")) return;
                    await supabase.from("interview_invitations" as any).update({ status: "expired" } as any).eq("id", pendingInvite.id);
                    await supabase.from("interviews").update({ status: "cancelled" }).eq("id", pendingInvite.interview_id);
                    refetchInvitations();
                    toast({ title: "Invitation cancelled" });
                  }}
                  className="text-xs text-muted-foreground hover:text-destructive"
                >Cancel Invite</button>
              </div>
            ) : acceptedInvite ? (
              <Button size="sm" variant="outline" disabled>
                <Clock className="h-3 w-3 mr-1" /> Interview In Progress
              </Button>
            ) : (
              <Button size="sm" onClick={() => setInviteModalOpen(true)}>
                <Mail className="h-3 w-3 mr-1" /> Invite to Interview
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => navigate(`/interview/manager/${id}`)}>Start Manager Interview</Button>
            {latestResult && <Button size="sm" variant="outline" onClick={() => navigate(`/analysis/${id}`)}>View Analysis</Button>}
          </div>
          {employee && (
            <InviteInterviewModal
              open={inviteModalOpen}
              onOpenChange={setInviteModalOpen}
              employee={employee}
              onSent={() => refetchInvitations()}
            />
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Assessment Pipeline */}
          <div className="card-skillsight p-5">
            <h3 className="text-[15px] font-semibold mb-4">Assessment Status</h3>
            <div className="flex items-center gap-0">
              {pipeline.map((step, i) => (
                <div key={step.name} className="flex items-center flex-1">
                  <div className="flex flex-col items-center text-center gap-1.5">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step.done ? 'bg-status-green text-primary-foreground' : step.inProgress ? 'bg-status-amber text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
                      <step.icon className="h-4 w-4" />
                    </div>
                    <span className="text-[10px] font-medium leading-tight max-w-[70px]">{step.name}</span>
                  </div>
                  {i < pipeline.length - 1 && <div className={`h-0.5 flex-1 mx-1 ${step.done ? 'bg-status-green' : 'bg-border'}`} />}
                </div>
              ))}
            </div>
          </div>

          {/* Data Sources */}
          <div className="card-skillsight p-5">
            <h3 className="text-[15px] font-semibold mb-4">Ingested Data Sources</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'HR Skills Database', done: true },
                { label: `Performance Reviews (${reviews.length})`, done: reviews.length > 0 },
                { label: `Training History (${training.length})`, done: training.length > 0 },
                { label: 'Job Description', done: true },
                { label: 'Manager Assessments', done: completedManager },
                { label: 'Company Strategy Alignment', done: true },
              ].map(source => (
                <div key={source.label} className={`flex items-center gap-2 px-3 py-2 rounded text-xs ${source.done ? 'bg-status-green-light text-status-green' : 'bg-secondary text-muted-foreground'}`}>
                  {source.done ? <Check className="h-3 w-3 shrink-0" /> : <AlertCircle className="h-3 w-3 shrink-0" />}
                  {source.label}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Performance Reviews */}
        {reviews.length > 0 && (
          <div className="card-skillsight p-5">
            <h3 className="text-[15px] font-semibold mb-4">Performance Reviews</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {reviews.map((review, i) => {
                const [year, ...rest] = (review as string).split(': ');
                return (
                  <div key={i} className="bg-secondary rounded-lg p-4">
                    <p className="text-xs font-semibold mb-1">{year}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{rest.join(': ')}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Skills Portfolio */}
        <div className="card-skillsight p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[15px] font-semibold">Skills Profile</h3>
            <select value={selectedRoleId || ''} onChange={e => setSelectedRoleId(e.target.value || null)} className="h-8 rounded-md border border-input bg-background px-2 text-xs">
              <option value="">Select role to compare</option>
              {roles?.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              {radarData.length > 0 && (
                <ResponsiveContainer width="100%" height={240}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis dataKey="skill" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} />
                    <Radar name="Employee" dataKey="employee" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
                    {selectedRole && <Radar name="Role" dataKey="role" stroke="hsl(var(--destructive))" fill="none" strokeDasharray="5 5" />}
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                  </RadarChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {skills?.sort((a, b) => (b.proficiency || 0) - (a.proficiency || 0)).map(s => (
                <div key={s.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                  <div>
                    <span className="text-xs font-medium">{s.skill_name}</span>
                    {s.evidence && <p className="text-[10px] italic text-muted-foreground mt-0.5">{s.evidence}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground capitalize">{s.source?.replace('_', ' ')}</span>
                    <SkillBadge skill="" proficiency={(s.proficiency || 0) as 0 | 1 | 2 | 3} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* AI-Discovered Skills */}
        {aiSkills.length > 0 && (
          <div className="card-skillsight p-5 border-l-4 border-l-status-purple">
            <h3 className="text-[15px] font-semibold mb-3 flex items-center gap-2"><Sparkles className="h-4 w-4 text-status-purple" />AI-Discovered Skills</h3>
            <div className="flex flex-wrap gap-2">
              {aiSkills.map(s => <SkillBadge key={s.id} skill={s.skill_name} proficiency={(s.proficiency || 0) as 0 | 1 | 2 | 3} />)}
            </div>
          </div>
        )}

        {/* Interview History */}
        <div className="card-skillsight p-5">
          <h3 className="text-[15px] font-semibold mb-4">Interview History</h3>
          {empInterviews.length > 0 ? (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 font-medium text-muted-foreground">Date</th>
                  <th className="text-left py-2 font-medium text-muted-foreground">Type</th>
                  <th className="text-left py-2 font-medium text-muted-foreground">Role</th>
                   <th className="text-left py-2 font-medium text-muted-foreground">Focus</th>
                   <th className="text-left py-2 font-medium text-muted-foreground">Status</th>
                   
                </tr>
              </thead>
              <tbody>
                {empInterviews.map(interview => {
                  const role = roles?.find(r => r.id === interview.target_role_id);
                  return (
                    <tr key={interview.id} className="border-b border-border last:border-0">
                      <td className="py-2.5">{interview.started_at ? new Date(interview.started_at).toLocaleDateString() : '—'}</td>
                      <td className="py-2.5 capitalize">{interview.interview_type}</td>
                      <td className="py-2.5">{role?.title || '—'}</td>
                      <td className="py-2.5">
                        {(() => {
                          const inv = invitations?.find(inv => inv.interview_id === interview.id);
                          const pack = inv?.preset_pack ? PRESET_PACKS.find(p => p.id === inv.preset_pack) : null;
                          if (!pack) return <span className="text-muted-foreground">—</span>;
                          const Icon = pack.icon;
                          return <span className="inline-flex items-center gap-1 text-[10px] font-medium"><Icon className="h-3 w-3" />{pack.name}</span>;
                        })()}
                      </td>
                      <td className="py-2.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${interview.status === 'completed' ? 'bg-status-green-light text-status-green' : interview.status === 'in_progress' ? 'bg-status-amber-light text-status-amber' : 'bg-secondary text-muted-foreground'}`}>{interview.status}</span>
                      </td>
                      
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-4">No interviews conducted yet</p>
          )}
        </div>

        {/* Latest Analysis */}
        <div className="card-skillsight p-5">
          <h3 className="text-[15px] font-semibold mb-4">Latest Analysis</h3>
          {latestResult ? (
            <div className="flex flex-col md:flex-row items-center gap-6">
              <ReadinessRing value={readiness || 0} size="md" label="Overall Readiness" />
              <div className="flex-1 space-y-2">
                {((latestResult.gap_analysis as any)?.criticalGaps || []).slice(0, 3).map((gap: any, i: number) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-xs">{gap.skill}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-muted-foreground">{gap.current}/{gap.required}</span>
                      <PriorityBadge priority={gap.priority} />
                    </div>
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate(`/analysis/${id}`)} className="shrink-0">
                View Full Analysis <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          ) : completedEmployee || completedManager ? (
            <div className="text-center py-6">
              <BarChart3 className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-medium">Analysis will be available once the pipeline completes</p>
              <Button size="sm" className="mt-3" onClick={() => navigate(`/analysis/${id}`)}>View Analysis</Button>
            </div>
          ) : empInterviews.some(i => i.status === 'in_progress' || i.status === 'pending') ? (
            <div className="text-center py-6">
              <Clock className="h-8 w-8 mx-auto text-status-amber mb-2" />
              <p className="text-sm font-medium">Interview In Progress</p>
              <p className="text-xs text-muted-foreground mt-1">Analysis will be generated once the interview is completed.</p>
            </div>
          ) : (
            <div className="text-center py-6">
              <BarChart3 className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-medium">No analysis yet</p>
              <p className="text-xs text-muted-foreground mt-1">This person needs to be interviewed before an assessment can be generated.</p>
              <Button size="sm" className="mt-3" onClick={() => setInviteModalOpen(true)}>
                <Mail className="h-3 w-3 mr-1" /> Invite to Interview
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
