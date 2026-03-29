import { useParams, useNavigate } from "react-router-dom";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { ReadinessRing } from "@/components/ReadinessRing";
import { PriorityBadge } from "@/components/PriorityBadge";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  ArrowLeft, ArrowRight, BarChart3, Shield,
  FileText, Sparkles, Mail, Eye, EyeOff, Quote, AlertTriangle,
  CheckCircle, XCircle, ChevronDown, ChevronUp, Star, Search,
  Copy, Trash2, UserPlus, Loader2,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";

import { formatSkillName } from "@/lib/utils";

function markdownToHtml(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold mt-6 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold mt-6 mb-3">$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/^---$/gm, '<hr class="my-4 border-border" />')
    .replace(/\n\n/g, '</p><p class="mb-3">')
    .replace(/^(?!<[hlu]|<li|<hr)(.+)$/gm, '<p class="mb-3">$1</p>')
    .replace(/<\/li>\n<li/g, '</li><li');
}

function AbsenceAnalysisSection({ analysis }: { analysis: { critical_gaps?: string[]; indirect_only?: string[]; well_evidenced?: string[] } }) {
  const [open, setOpen] = useState(false);
  const hasContent = (analysis.well_evidenced?.length || 0) + (analysis.indirect_only?.length || 0) + (analysis.critical_gaps?.length || 0) > 0;
  if (!hasContent) return null;
  return (
    <div>
      <button onClick={() => setOpen(!open)} className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors">
        <Search className="h-3 w-3" />Evidence Analysis
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
      {open && (
        <div className="mt-2 space-y-2 pl-1">
          {(analysis.well_evidenced?.length || 0) > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-green-700 mb-0.5">✓ Well Evidenced</p>
              <ul className="space-y-0.5">{analysis.well_evidenced!.map((s: string, i: number) => (
                <li key={i} className="text-[11px] text-green-700 flex items-start gap-1"><CheckCircle className="h-2.5 w-2.5 mt-0.5 shrink-0" />{formatSkillName(s)}</li>
              ))}</ul>
            </div>
          )}
          {(analysis.indirect_only?.length || 0) > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-amber-700 mb-0.5">⚠ Indirect Only</p>
              <ul className="space-y-0.5">{analysis.indirect_only!.map((s: string, i: number) => (
                <li key={i} className="text-[11px] text-amber-700 flex items-start gap-1"><AlertTriangle className="h-2.5 w-2.5 mt-0.5 shrink-0" />{formatSkillName(s)}</li>
              ))}</ul>
            </div>
          )}
          {(analysis.critical_gaps?.length || 0) > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-destructive mb-0.5">✗ Critical Gaps</p>
              <ul className="space-y-0.5">{analysis.critical_gaps!.map((s: string, i: number) => (
                <li key={i} className="text-[11px] text-destructive flex items-start gap-1"><XCircle className="h-2.5 w-2.5 mt-0.5 shrink-0" />{formatSkillName(s)}</li>
              ))}</ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ExpandableSection({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen(!open)} className="text-[11px] text-primary hover:underline">{label}</button>
      {open && <div className="mt-1">{children}</div>}
    </div>
  );
}

export default function ExternalCandidateProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [codeRevealed, setCodeRevealed] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineNote, setDeclineNote] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [cvModalOpen, setCvModalOpen] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [managerInsights, setManagerInsights] = useState({
    culturalFit: "",
    communicationStyle: "",
    leadershipPotential: "",
    technicalDepth: "",
    concernsOrRisks: "",
  });

  const { data: candidate, isLoading, refetch } = useQuery({
    queryKey: ["external_candidate_detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("external_candidates")
        .select("*, roles(id, title, required_skills, strategic_weights, department)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const candidateInterviewId = candidate?.interview_id;

  // Fetch interview data if exists
  const { data: interview } = useQuery({
    queryKey: ["external_interview", candidateInterviewId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("interviews")
        .select("*")
        .eq("id", candidateInterviewId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!candidateInterviewId,
  });

  // Risk factors from report - must be before conditional returns
  const results_raw = (candidate?.full_algorithm_results || {}) as any;
  const report_raw = results_raw.reportMarkdown;
  const riskFactors = useMemo(() => {
    if (!report_raw) return [];
    const riskSection = report_raw.match(/### Risk Factors\n([\s\S]*?)(?=\n### |\n## |$)/);
    if (!riskSection) return [];
    const risks: { name: string; level: string; description: string }[] = [];
    const riskMatches = riskSection[1].matchAll(/\*\*(.+?)\*\*\s*·\s*(LOW|MEDIUM|HIGH)\n(.+?)(?=\n\*\*|\n$|$)/gs);
    for (const match of riskMatches) risks.push({ name: match[1].trim(), level: match[2].trim(), description: match[3].trim() });
    return risks;
  }, [report_raw]);

  // Parse hybrid reasoning data — must be before conditional returns
  const hybridInfo = useMemo(() => {
    if (!candidate) return null;
    try {
      const data = JSON.parse(candidate.worthy_reasoning || '{}');
      // Accept if it has any meaningful assessment data
      if (data.method || data.verdict || data.reasoning || data.verdictLabel || data.confidence) return data;
      return null;
    } catch {
      return null;
    }
  }, [candidate?.worthy_reasoning]);

  if (isLoading) return <div className="flex items-center justify-center h-64"><LoadingSpinner /></div>;
  if (!candidate) return <div className="p-6">Candidate not found.</div>;

  const role = candidate.roles as any;
  const results = (candidate.full_algorithm_results || {}) as any;
  const score = candidate.full_three_layer_score != null ? Math.round(candidate.full_three_layer_score * 100) : null;
  const technicalMatch = results.technicalMatch;
  const capabilityMatch = results.capabilityMatch;
  const momentumScore = results.momentumScore;
  const momentumBreakdown = results.momentumBreakdown;
  const gapAnalysis = results.gap || results.gapAnalysis;
  const tfidfRarity = results.tfidfRarity || {};
  const upskillingPaths = results.upskillingPaths || [];
  const transitionProfile = results.transitionProfile;
  const scoreBreakdown = results.scoreBreakdown;
  const report = results.reportMarkdown;
  const interviewSkills = (candidate.interview_skills || {}) as any;
  const isCompleted = candidate.status === "completed";
  const hasAssessment = !!(hybridInfo || candidate.worthy_score != null || technicalMatch != null);
  const initials = candidate.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);

  const sourceBadge = () => {
    const src = (candidate as any).submission_source;
    if (src === "candidate_self_submit") return <Badge className="bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 text-[10px]">Self-Submitted</Badge>;
    if (src === "manager_cv_paste") return <Badge variant="secondary" className="text-[10px]">Manager CV Paste</Badge>;
    return <Badge variant="secondary" className="text-[10px]">Manager Manual</Badge>;
  };

  const statusBadge = () => {
    // Check for hard_reject verdict in hybridInfo
    const isHardReject = hybridInfo?.verdict === 'hard_reject';
    if (isHardReject) {
      return <Badge variant="secondary" className="text-[10px] bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400">Declined</Badge>;
    }

    const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string }> = {
      pending_manager_review: { label: "Pending Review", variant: "outline" },
      below_threshold: { label: "Below Threshold", variant: "destructive" },
      interviewing: { label: "Interview In Progress", variant: "outline" },
      completed: { label: "Assessment Complete", variant: "default" },
      invited: { label: "Invited", variant: "secondary" },
      rejected: { label: "Declined", variant: "secondary" },
      flagged_review: { label: "⚠ Needs Review", variant: "outline", className: "border-amber-500 text-amber-700 bg-amber-50" },
    };
    // Don't show "Pending" when assessment exists
    const status = candidate.status || "";
    if (status === "pending_manager_review" && !hasAssessment) {
      return <Badge variant="outline" className="text-[10px]">Awaiting Assessment</Badge>;
    }
    const s = map[status] || { label: status || "Unknown", variant: "secondary" as const };
    return <Badge variant={s.variant} className={`text-[10px] ${s.className || ''}`}>{s.label}</Badge>;
  };

  const handleApprove = async () => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await supabase.from("external_candidates").update({
      access_code: code, code_expires_at: expiresAt, status: "invited",
      manager_decision: "approved", manager_decision_at: new Date().toISOString(),
    } as any).eq("id", candidate.id);
    toast.success(`Interview code generated: ${code}`);
    refetch();
  };

  const handleDecline = async () => {
    await supabase.from("external_candidates").update({
      status: "rejected", manager_decision: "rejected",
      manager_decision_at: new Date().toISOString(),
      manager_decision_note: declineNote || null,
    } as any).eq("id", candidate.id);
    toast.success("Application declined");
    setDeclineOpen(false);
    refetch();
  };

  const handleDelete = async () => {
    setDeleting(true);
    const { error } = await supabase.from("external_candidates").delete().eq("id", candidate.id);
    if (error) {
      toast.error("Failed to delete candidate");
      setDeleting(false);
      return;
    }
    toast.success("Candidate deleted");
    navigate("/employees?tab=external");
  };

  const handleToggleInterviewPassed = async (passed: boolean) => {
    if (passed) {
      // Open insights dialog instead of toggling directly
      setInsightsOpen(true);
      return;
    }
    await supabase.from("external_candidates").update({
      interview_passed: false,
      manager_insights: null,
    } as any).eq("id", candidate.id);
    refetch();
    toast.success("Interview marked as not passed");
  };

  const handleSubmitInsights = async () => {
    const hasContent = Object.values(managerInsights).some(v => v.trim());
    if (!hasContent) {
      toast.error("Please fill in at least one insight field");
      return;
    }
    await supabase.from("external_candidates").update({
      interview_passed: true,
      manager_insights: managerInsights,
    } as any).eq("id", candidate.id);
    setInsightsOpen(false);
    refetch();
    toast.success("Interview passed with manager insights saved");
  };

  const handlePromote = async () => {
    setPromoting(true);
    try {
      const { data, error } = await supabase.functions.invoke("promote-candidate", {
        body: { candidateId: candidate.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`${candidate.name} has been promoted to internal employee!`);
      navigate(`/employee/${data.employeeId}`);
    } catch (e: any) {
      toast.error(e.message || "Failed to promote candidate");
      setPromoting(false);
    }
  };

  const interviewPassed = (candidate as any).interview_passed === true;
  const cvPassed = candidate.interview_worthy === true || candidate.status === "completed" || candidate.status === "talent_pool" || candidate.status === "invited";
  const canPromote = cvPassed && interviewPassed;

  const conversationHistory = interview?.conversation_history as any[] || [];

  return (
    <div>
      <PageHeader
        title={candidate.name}
        subtitle="External Candidate Profile"
        actions={
          <Button variant="outline" size="sm" onClick={() => navigate("/employees?tab=external")}>
            <ArrowLeft className="h-4 w-4 mr-1" />Back to External Candidates
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        {/* Profile Header Card */}
        <div className="card-skillsight p-6">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex items-start gap-4 flex-1">
              <div className="w-[72px] h-[72px] rounded-full bg-purple-500 flex items-center justify-center text-xl font-bold text-primary-foreground shrink-0">
                {initials}
              </div>
              <div>
                <h2 className="text-2xl font-bold">{candidate.name}</h2>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <Badge className="text-[11px]">{role?.title || "Unknown Role"}</Badge>
                  {sourceBadge()}
                  {statusBadge()}
                </div>
              </div>
            </div>
            {/* Right: readiness rings */}
            <div className="flex items-center gap-6">
              {technicalMatch != null ? (
                <>
                  <ReadinessRing value={Math.round(technicalMatch * 100)} size="sm" label="Technical" />
                  <ReadinessRing value={Math.round((capabilityMatch || 0) * 100)} size="sm" label="Capability" />
                  {isCompleted && momentumScore != null && momentumScore > 0 ? (
                    <ReadinessRing value={Math.round(momentumScore * 100)} size="sm" label="Momentum" />
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-12 h-12 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
                        <span className="text-[10px] text-muted-foreground">—</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground italic">Pending</span>
                    </div>
                  )}
                </>
              ) : candidate.worthy_score != null ? (
                <ReadinessRing value={Math.round(candidate.worthy_score * 100)} size="sm" label="CV Score" />
              ) : (
                <div className="flex items-center gap-3 text-muted-foreground">
                  <div className="w-12 h-12 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
                    <span className="text-[10px]">—</span>
                  </div>
                  <span className="text-xs">Awaiting Assessment</span>
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 mt-4">
             {hybridInfo?.verdict !== 'hard_reject' && (candidate.status === "pending_manager_review" || candidate.status === "flagged_review" || ((candidate as any).submission_source === "candidate_self_submit" && (candidate as any).manager_decision === "pending" && candidate.interview_worthy)) && (
              <>
                <Button size="sm" className="bg-green-600 hover:bg-green-700 text-xs" onClick={handleApprove}>
                  <CheckCircle className="h-3 w-3 mr-1" />Approve for Interview
                </Button>
                <Button variant="outline" size="sm" className="text-xs text-destructive border-destructive/30" onClick={() => setDeclineOpen(true)}>
                  <XCircle className="h-3 w-3 mr-1" />Decline
                </Button>
              </>
            )}
            {candidate.status === "invited" && candidate.access_code && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-muted/50">
                <span className="text-xs text-muted-foreground">Interview Code:</span>
                <span className="font-mono font-bold text-sm tracking-widest">{candidate.access_code}</span>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => { navigator.clipboard.writeText(candidate.access_code!); toast.success("Code copied"); }}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            )}
            {isCompleted && (
              <Button size="sm" className="text-xs" onClick={() => navigate(`/analysis-external/${candidate.id}`)}>
                View Full Assessment
              </Button>
            )}
            {(candidate.status === "rejected" || candidate.status === "below_threshold") && (
              <Button variant="destructive" size="sm" className="text-xs" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="h-3 w-3 mr-1" />Delete Candidate
              </Button>
            )}
            {(candidate as any).candidate_message && (
              <Button variant="outline" size="sm" className="text-xs" onClick={() => setCvModalOpen(true)}>
                <FileText className="h-3 w-3 mr-1" />View Submitted CV
              </Button>
            )}
            {/* Interview Pass Toggle — only after AI interview completed with summary */}
            {cvPassed && hybridInfo?.verdict !== 'hard_reject' && candidate.status !== "rejected" && candidate.status !== "below_threshold" && isCompleted && interview?.status === "completed" && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-muted/30">
                <span className="text-xs text-muted-foreground">In-Person Interview Passed:</span>
                <Switch
                  checked={interviewPassed}
                  onCheckedChange={handleToggleInterviewPassed}
                />
                <span className={`text-xs font-medium ${interviewPassed ? "text-green-600" : "text-muted-foreground"}`}>
                  {interviewPassed ? "Yes" : "No"}
                </span>
              </div>
            )}
            {/* Show message if AI interview not yet completed */}
            {cvPassed && hybridInfo?.verdict !== 'hard_reject' && candidate.status !== "rejected" && candidate.status !== "below_threshold" && !(isCompleted && interview?.status === "completed") && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-dashed border-muted-foreground/30 bg-muted/10">
                <span className="text-xs text-muted-foreground italic">AI Interview must be completed before marking in-person interview</span>
              </div>
            )}
            {/* Promote to Employee */}
            {canPromote && candidate.status !== "promoted" && (
              <Button size="sm" className="text-xs bg-primary hover:bg-primary/90" onClick={handlePromote} disabled={promoting}>
                {promoting ? (
                  <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Generating Profile...</>
                ) : (
                  <><UserPlus className="h-3 w-3 mr-1" />Promote to Employee</>
                )}
              </Button>
            )}
            {candidate.status === "promoted" && (
              <Badge className="bg-green-100 text-green-800 border-green-300 text-xs">✓ Promoted to Internal Employee</Badge>
            )}
          </div>
        </div>

        {/* Full Assessment Summary Card */}
        {hybridInfo && (() => {
          const verdictLabel = hybridInfo.verdictLabel || hybridInfo.reasoning || '';
          const confidence = hybridInfo.confidence || 'mixed_signals';
          const confLabel = confidence === 'high' ? 'High Confidence' : confidence === 'low' ? 'Low Confidence' : 'Mixed Signals';
          const reasoning = hybridInfo.reasoning || hybridInfo.aiReasoning || '';
          const recruiterSummary = hybridInfo.recruiterSummary || hybridInfo.recruiter_summary || hybridInfo.recruiterNote || hybridInfo.recruiter_note || '';
          const absenceAnalysis = hybridInfo.absence_analysis || null;
          const seniorityCheck = hybridInfo.seniority_check || null;
          const domainGaps = hybridInfo.domain_gap_classification || null;
          const strongMetrics = (hybridInfo.strong_metrics_count || 0) + (hybridInfo.medium_metrics_count || 0);
          const closingJudgment = hybridInfo.closing_judgment || hybridInfo.closingJudgment || hybridInfo.verb_quality_assessment || '';
          const ownershipRaw = hybridInfo.ownership_signal || hybridInfo.ownershipSignal || null;
          const builderVerbRatio = hybridInfo.builder_verb_ratio;
          const notWorthyReasons = hybridInfo.not_worthy_reasons || hybridInfo.concerns || candidate.not_worthy_reasons as any[] || [];
          const keyStrengths = hybridInfo.keyStrengths || hybridInfo.key_strengths || [];

          const isPositive = hybridInfo.verdict === 'recommend' || candidate.interview_worthy;
          const isHardReject = hybridInfo.verdict === 'hard_reject';
          const isFlag = !isHardReject && (hybridInfo.verdict === 'flag' || confidence === 'mixed_signals' || confidence === 'low');

          const borderClass = isPositive ? 'border-green-400 border-2' : isFlag ? 'border-amber-400 border-2' : 'border-destructive border-2';
          const iconColor = isPositive ? 'text-green-600' : isFlag ? 'text-amber-600' : 'text-destructive';
          const Icon = isPositive ? CheckCircle : isFlag ? AlertTriangle : XCircle;
          const titleColor = isPositive ? 'text-green-700' : isFlag ? 'text-amber-700' : 'text-destructive';
          const agreementLabel = isHardReject ? 'Candidate does not meet minimum signal threshold.' : confidence === 'high' ? 'Both algorithmic and AI assessment agree.' : confidence === 'low' ? 'Assessment signals are weak or insufficient.' : 'Algorithmic and AI assessments show mixed signals.';

          // Derive ownership percentages from either object or decimal ratio
          const builderPct = ownershipRaw?.builder_pct ?? ownershipRaw?.builder ?? (builderVerbRatio != null ? Math.round(builderVerbRatio * 100) : null);
          const participantPct = ownershipRaw?.participant_pct ?? ownershipRaw?.participant ?? (builderVerbRatio != null ? Math.round((1 - builderVerbRatio) * 100) : null);
          const ownershipNote = ownershipRaw?.note || ownershipRaw?.description || (builderVerbRatio != null ? hybridInfo.verb_quality_assessment || '' : '');

          return (
            <>
              <Card className={borderClass}>
                <CardContent className="p-5 space-y-4">
                  {/* Verdict Header */}
                  <div className="flex items-start gap-2">
                    <Icon className={`h-5 w-5 ${iconColor} mt-0.5 shrink-0`} />
                    <div>
                      <h3 className={`text-base font-bold ${titleColor}`}>
                        {isHardReject ? verdictLabel : `${isPositive ? '✓' : isFlag ? '⚠' : '✕'} ${verdictLabel} — ${confLabel}`}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{agreementLabel}</p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        {seniorityCheck && seniorityCheck !== 'not_applicable' && (
                          <Badge variant="outline" className={`text-[10px] ${seniorityCheck === 'validated' ? 'border-green-300 text-green-700' : seniorityCheck === 'mismatch' ? 'border-destructive text-destructive' : 'border-amber-300 text-amber-700'}`}>
                            Seniority: {seniorityCheck === 'validated' ? 'Validated' : seniorityCheck === 'mismatch' ? 'Mismatch' : 'Insufficient Evidence'}
                          </Badge>
                        )}
                        {domainGaps && domainGaps !== 'mixed' && (
                          <Badge variant="outline" className={`text-[10px] ${domainGaps === 'trainable' ? 'border-blue-300 text-blue-700' : 'border-destructive text-destructive'}`}>
                            Domain gaps: {domainGaps === 'trainable' ? 'Trainable' : 'Critical'}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Full reasoning paragraph — no truncation */}
                  {reasoning && (
                    <p className="text-sm text-foreground/90 leading-relaxed">{reasoning}</p>
                  )}

                  {/* Recruiter summary blockquote */}
                  {recruiterSummary && (
                    <blockquote className="border-l-2 border-muted-foreground/30 pl-3 py-1">
                      <p className="text-sm italic text-muted-foreground">"{recruiterSummary}"</p>
                    </blockquote>
                  )}

                  {/* Rejection/Flag Reasons */}
                  {notWorthyReasons.length > 0 && (
                    <div className="space-y-1.5">
                      {notWorthyReasons.map((reason: any, i: number) => {
                        const text = typeof reason === 'string' ? reason : reason.reason || reason.text || JSON.stringify(reason);
                        return (
                          <div key={i} className="flex items-start gap-2">
                            <XCircle className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
                            <span className="text-xs text-destructive">{text}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Closing judgment */}
                  {closingJudgment && (
                    <p className="text-xs italic text-muted-foreground">{closingJudgment}</p>
                  )}

                  {/* Strengths section */}
                  {keyStrengths.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <p className="text-xs font-semibold text-muted-foreground">
                        {isPositive ? 'Key strengths:' : 'Strengths noted but insufficient for this role:'}
                      </p>
                      {keyStrengths.map((s: string, i: number) => (
                        <div key={i} className="flex items-start gap-2">
                          <Star className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                          <span className="text-xs text-muted-foreground">{s}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Ownership Signal Bar — outside the card */}
              {builderPct != null && participantPct != null && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground">Ownership Signal</p>
                  <div className="w-full h-5 rounded-full overflow-hidden flex bg-secondary">
                    <div
                      className="h-full bg-primary flex items-center justify-center"
                      style={{ width: `${builderPct}%` }}
                    >
                      {builderPct > 15 && <span className="text-[10px] font-bold text-primary-foreground">Builder {builderPct}%</span>}
                    </div>
                    <div
                      className="h-full bg-muted flex items-center justify-center"
                      style={{ width: `${participantPct}%` }}
                    >
                      {participantPct > 15 && <span className="text-[10px] font-medium text-muted-foreground">Participant {participantPct}%</span>}
                    </div>
                  </div>
                  {ownershipNote && (
                    <p className="text-[11px] italic text-muted-foreground">{ownershipNote}</p>
                  )}
                </div>
              )}

              {/* Metrics badge */}
              {strongMetrics > 0 && (
                <Badge className="bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300">
                  📊 {strongMetrics} measurable impact{strongMetrics !== 1 ? 's' : ''} found
                </Badge>
              )}

              {/* Evidence Analysis — collapsed by default */}
              {absenceAnalysis && (
                <AbsenceAnalysisSection analysis={absenceAnalysis} />
              )}
            </>
          );
        })()}

        {/* Section 5 — Algorithm Results (show whenever data exists) */}
        {(technicalMatch != null || gapAnalysis) && (
          <>
            {/* Three-Layer Score — show if we have scores */}
            {technicalMatch != null && (
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-5">
                    {isCompleted ? 'Three-Layer Assessment' : 'CV-Based Assessment'}
                  </h3>
                  <div className="flex items-start gap-8 flex-wrap">
                    <div className="flex gap-6">
                      <div className="flex flex-col items-center">
                        <ReadinessRing value={Math.round((technicalMatch || 0) * 100)} size="md" />
                        <span className="text-xs font-semibold mt-1">Technical Match</span>
                        <span className="text-[11px] text-muted-foreground">Current skills vs</span>
                        <span className="text-[11px] text-muted-foreground">role requirements</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <ReadinessRing value={Math.round((capabilityMatch || 0) * 100)} size="md" />
                        <span className="text-xs font-semibold mt-1">Capability Match</span>
                        <span className="text-[11px] text-muted-foreground">Problem-solving depth</span>
                        <span className="text-[11px] text-muted-foreground">& thinking patterns</span>
                      </div>
                      {isCompleted && momentumScore != null && momentumScore > 0 ? (
                        <div className="flex flex-col items-center">
                          <ReadinessRing value={Math.round(momentumScore * 100)} size="md" />
                          <span className="text-xs font-semibold mt-1">Momentum Score</span>
                          <span className="text-[11px] text-muted-foreground">Growth trajectory</span>
                          <span className="text-[11px] text-muted-foreground">& role motivation</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center">
                          <div className="w-16 h-16 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
                            <span className="text-xs text-muted-foreground">—</span>
                          </div>
                          <span className="text-xs font-semibold mt-1">Momentum</span>
                          <span className="text-[11px] text-muted-foreground italic">Interview needed</span>
                        </div>
                      )}
                    </div>
                    {score != null && (
                      <div className="flex-1 border-l border-border pl-8 min-w-[200px]">
                        <div className="flex items-center gap-4 mb-3">
                          <span className="text-4xl font-bold font-mono">{score}%</span>
                          <span className="text-sm font-medium text-muted-foreground">Final Score</span>
                        </div>
                        <Progress value={score} className="h-2.5 mb-2" />
                        {scoreBreakdown?.interpretation && (
                          <p className="text-sm text-muted-foreground italic">{scoreBreakdown.interpretation}</p>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Gap Analysis */}
            {gapAnalysis && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />Priority Skill Gaps
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {(gapAnalysis.criticalGaps || []).slice(0, 6).map((gap: any, i: number) => (
                        <div key={i} className="flex items-center gap-3">
                          <PriorityBadge priority={gap.priority} />
                          <span className="text-sm font-medium flex-1">{formatSkillName(gap.skill)}</span>
                          <div className="flex items-center gap-1.5 text-xs">
                            <span className="font-mono text-muted-foreground">{gap.currentProficiency}</span>
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                            <span className="font-mono font-semibold">{gap.requiredProficiency}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Strengths */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Star className="h-4 w-4 text-status-amber" />Strengths
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const algorithmicSurplus = gapAnalysis.surplusSkills || [];
                      // Auto-detect surplus signals from experience profile / hybrid data
                      const autoSignals: string[] = [];
                      const expProfile = results.parsed?.experience_profile || hybridInfo || {};
                      const educationLevel = expProfile.education_level || results.parsed?.education_level;
                      const publications = expProfile.publications || results.parsed?.publications || [];
                      const totalYears = expProfile.total_years || expProfile.total_years_experience || 0;
                      const skills = results.parsed?.skills || [];
                      const hasHighDepthSkills = skills.some((s: any) => s.depth === "HIGH");

                      if (educationLevel === "phd") autoSignals.push("Doctoral-level domain expertise");
                      if (publications.length >= 2) autoSignals.push("Published research in domain");
                      // Check for patents in CV text
                      const cvText = ((candidate as any).candidate_message || "").toLowerCase();
                      if (cvText.includes("patent") || cvText.match(/\d+\s*patents?/i)) autoSignals.push("Patented innovations in domain");
                      // TÜV or equivalent certification
                      if (cvText.includes("tüv") || cvText.includes("tuev") || cvText.includes("tüv") || skills.some((s: any) => s.name?.toLowerCase().includes("tüv"))) autoSignals.push("Professional safety certification");
                      if (totalYears >= 10) autoSignals.push("Decade-plus domain experience");

                      const hasSurplus = algorithmicSurplus.length > 0 || autoSignals.length > 0;

                      return hasSurplus ? (
                        <div className="flex flex-wrap gap-2">
                          {algorithmicSurplus.map((s: any, i: number) => (
                            <Badge key={`alg-${i}`} className="bg-status-green-light text-status-green border-status-green/20">
                              {formatSkillName(s.skill)} +{s.surplus}
                            </Badge>
                          ))}
                          {autoSignals.map((signal, i) => (
                            <Badge key={`auto-${i}`} className="bg-status-green-light text-status-green border-status-green/20">
                              ★ {signal}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No surplus skills identified</p>
                      );
                    })()}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* AI Report */}
            {report && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">AI Report</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none prose-headings:text-foreground prose-p:text-foreground/80" dangerouslySetInnerHTML={{ __html: markdownToHtml(report) }} />
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Section 6 — Interview Transcript (collapsible) */}
        {conversationHistory.length > 0 && (
          <Card>
            <CardHeader className="pb-2 cursor-pointer" onClick={() => setTranscriptOpen(!transcriptOpen)}>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Interview Transcript</CardTitle>
                {transcriptOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </CardHeader>
            {transcriptOpen && (
              <CardContent>
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {conversationHistory.map((msg: any, i: number) => (
                    <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[75%] rounded-lg px-4 py-2 text-sm ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-foreground"
                      }`}>
                        <p>{msg.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        )}
      </div>

      {/* Decline Dialog */}
      <Dialog open={declineOpen} onOpenChange={setDeclineOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Decline {candidate.name}'s application?</DialogTitle>
          </DialogHeader>
          <Textarea placeholder="Add a reason (internal only)" value={declineNote} onChange={e => setDeclineNote(e.target.value)} rows={3} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeclineOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDecline}>Confirm Decline</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete {candidate.name}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This will permanently remove this candidate and all their data. This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete Permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* View Submitted CV Modal */}
      <Dialog open={cvModalOpen} onOpenChange={setCvModalOpen}>
        <DialogContent className="max-w-[720px] max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{candidate.name} — Submitted CV</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto rounded-md border border-border bg-muted/30 p-4">
            <pre className="whitespace-pre-wrap text-sm font-mono leading-relaxed text-foreground">{(candidate as any).candidate_message || "No CV text available."}</pre>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCvModalOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Helper Components ──────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <div className="text-sm font-medium mt-0.5">{value}</div>
    </div>
  );
}
