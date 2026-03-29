import { useAuth } from "@/contexts/AuthContext";
import { useEmployee, useEmployeeSkills, useAlgorithmResults, useInterviews } from "@/hooks/useData";
import { useInvitations } from "@/hooks/useInvitations";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { SkillBadge } from "@/components/SkillBadge";
import { ReadinessRing } from "@/components/ReadinessRing";
import { EmptyState } from "@/components/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer } from "recharts";
import { Check, Clock, AlertCircle, Sparkles, User, MessageSquare, Mail } from "lucide-react";
import { useMemo } from "react";
import { PRESET_PACKS } from "@/lib/presetPacks";
import { toast } from "@/hooks/use-toast";

export default function MyProfile() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const employeeId = profile?.employee_id;
  const { data: employee, isLoading } = useEmployee(employeeId || undefined);
  const { data: skills } = useEmployeeSkills(employeeId || undefined);
  const { data: results } = useAlgorithmResults(employeeId || undefined);
  const { data: interviews } = useInterviews(employeeId || undefined);
  const { data: invitations, refetch: refetchInvitations } = useInvitations(employeeId || undefined);

  const latestResult = results?.[0];
  const empInterviews = interviews || [];
  const completedEmployee = empInterviews.some(i => i.interview_type === "employee" && i.status === "completed");
  const completedManager = empInterviews.some(i => i.interview_type === "manager" && i.status === "completed");
  const interviewInProgress = empInterviews.some(i => i.interview_type === "employee" && i.status === "in_progress");

  const pendingInvite = invitations?.find(i => i.status === "pending" && new Date(i.expires_at) > new Date());
  const expiredInvite = invitations?.find(i => i.status === "pending" && new Date(i.expires_at) <= new Date());
  const pack = pendingInvite?.preset_pack ? PRESET_PACKS.find(p => p.id === pendingInvite.preset_pack) : null;

  const daysUntilExpiry = pendingInvite ? Math.ceil((new Date(pendingInvite.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;

  const aiSkills = skills?.filter(s => s.source === "employee_interview" || s.source === "combined") || [];

  const radarData = useMemo(() => {
    if (!skills?.length) return [];
    return skills.map(s => ({
      skill: s.skill_name.replace(/([A-Z])/g, " $1").trim(),
      value: s.proficiency || 0,
    }));
  }, [skills]);

  const firstName = profile?.full_name?.split(" ")[0] || "there";

  if (isLoading) return <div className="flex items-center justify-center h-64"><LoadingSpinner /></div>;
  if (!employee) return <EmptyState icon={User} title="Profile not found" description="Your employee record could not be located." />;

  const handleAcceptInvite = async () => {
    if (!pendingInvite) return;
    await supabase.from("interview_invitations" as any).update({ status: "accepted", accepted_at: new Date().toISOString() } as any).eq("id", pendingInvite.id);
    await supabase.from("interviews").update({ status: "in_progress" }).eq("id", pendingInvite.interview_id);
    refetchInvitations();
    toast({ title: "Interview accepted" });
    navigate("/my-interview");
  };

  const pipeline = [
    { name: "HR Data", done: true },
    { name: "My Interview", done: completedEmployee, inProgress: interviewInProgress || !!pendingInvite },
    { name: "Manager Review", done: completedManager },
    { name: "Analysis", done: !!latestResult && completedEmployee && completedManager },
    { name: "Results Ready", done: !!latestResult && completedManager },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Invitation Banner */}
      {pendingInvite && (
        <Card className="border-l-[3px] border-l-primary bg-primary/[0.02]">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" />
                <span className="text-[15px] font-bold">You have a career assessment invitation</span>
              </div>
              <Badge variant={daysUntilExpiry <= 3 ? "destructive" : "secondary"} className="text-[10px] shrink-0">
                <Clock className="h-3 w-3 mr-1" /> Expires in {daysUntilExpiry} day{daysUntilExpiry !== 1 ? "s" : ""}
              </Badge>
            </div>
            <p className="text-[13px] text-muted-foreground mt-1">
              From {pendingInvite.invited_by_manager} · Strategic Development Role
            </p>
            {pendingInvite.message && (
              <div className="border-l-2 border-border pl-3 mt-2">
                <p className="text-[13px] italic text-muted-foreground">"{pendingInvite.message}"</p>
              </div>
            )}
            {pack && (
              <div className="flex items-center gap-1 mt-2">
                <pack.icon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[11px] text-muted-foreground">Interview Focus: {pack.name}</span>
              </div>
            )}
            <div className="flex gap-3 mt-4">
              <Button size="sm" onClick={handleAcceptInvite}>
                <MessageSquare className="h-3.5 w-3.5 mr-1.5" /> Begin Interview →
              </Button>
              <button className="text-xs text-muted-foreground hover:text-foreground">Remind me later</button>
            </div>
          </CardContent>
        </Card>
      )}

      {expiredInvite && !pendingInvite && !interviewInProgress && (
        <Card className="border-l-[3px] border-l-muted opacity-60">
          <CardContent className="p-4">
            <p className="text-[13px] text-muted-foreground">This invitation has expired. Ask your manager to send a new one.</p>
          </CardContent>
        </Card>
      )}

      {/* Welcome */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold text-primary-foreground shrink-0"
              style={{ backgroundColor: employee.avatar_color || "hsl(213, 77%, 47%)" }}
            >
              {employee.avatar_initials}
            </div>
            <div>
              <h1 className="text-[22px] font-bold">Welcome back, {firstName}</h1>
              <p className="text-sm text-muted-foreground">
                Here is your current skills profile and assessment status.
              </p>
              <div className="flex gap-2 mt-2">
                <Badge variant="secondary">{employee.job_title}</Badge>
                <Badge variant="outline">{employee.department}</Badge>
                <Badge variant="outline">{employee.tenure_years} years</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Assessment Pipeline */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-[15px]">Assessment Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-0">
              {pipeline.map((step, i) => (
                <div key={step.name} className="flex items-center flex-1">
                  <div className="flex flex-col items-center text-center gap-1.5">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        step.done
                          ? "bg-status-green text-white"
                          : step.inProgress
                          ? "bg-status-amber text-white"
                          : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {step.done ? <Check className="h-4 w-4" /> : step.inProgress ? <Clock className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                    </div>
                    <span className="text-[10px] font-medium leading-tight max-w-[65px]">{step.name}</span>
                  </div>
                  {i < pipeline.length - 1 && (
                    <div className={`h-0.5 flex-1 mx-1 ${step.done ? "bg-status-green" : "bg-border"}`} />
                  )}
                </div>
              ))}
            </div>

            {/* Interview CTA */}
            <div className="mt-4 pt-4 border-t border-border">
              {interviewInProgress ? (
                <Button size="sm" onClick={() => navigate("/my-interview")} className="w-full">
                  <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                  Your interview is ready →
                </Button>
              ) : completedEmployee ? (
                <p className="text-xs text-status-green flex items-center gap-1">
                  <Check className="h-3 w-3" /> Interview completed
                </p>
              ) : pendingInvite ? (
                <Button size="sm" onClick={handleAcceptInvite} className="w-full">
                  <Mail className="h-3.5 w-3.5 mr-1.5" /> Accept Invitation & Begin →
                </Button>
              ) : (
                <p className="text-[13px] italic text-muted-foreground">
                  Your HR team will invite you to complete your career assessment interview soon.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Data Sources */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-[15px]">Your Data on File</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "HR Skills Database", done: true },
                { label: "Performance Reviews", done: (employee.past_performance_reviews as any[])?.length > 0 },
                { label: "Training History", done: (employee.training_history as any[])?.length > 0 },
                { label: "Job Description", done: true },
                { label: "Manager Assessment", done: completedManager },
                { label: "Strategy Alignment", done: !!latestResult },
              ].map(source => (
                <div
                  key={source.label}
                  className={`flex items-center gap-2 px-3 py-2 rounded text-xs ${
                    source.done
                      ? "bg-status-green-light text-status-green"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {source.done ? <Check className="h-3 w-3 shrink-0" /> : <AlertCircle className="h-3 w-3 shrink-0" />}
                  {source.label}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Skills Profile */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-[15px]">Your Current Skills Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              {radarData.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis dataKey="skill" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                    <Radar name="Your Skills" dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-12">No skills data available yet</p>
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
                    <span className="text-[10px] text-muted-foreground capitalize">{s.source?.replace("_", " ")}</span>
                    <SkillBadge skill="" proficiency={(s.proficiency || 0) as 0 | 1 | 2 | 3} />
                  </div>
                </div>
              ))}
              {!skills?.length && <p className="text-xs text-muted-foreground">No skills recorded yet</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI-Discovered Skills */}
      {aiSkills.length > 0 && (
        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-[15px] flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-500" />
              Discovered in Interview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {aiSkills.map(s => (
                <SkillBadge key={s.id} skill={s.skill_name} proficiency={(s.proficiency || 0) as 0 | 1 | 2 | 3} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
