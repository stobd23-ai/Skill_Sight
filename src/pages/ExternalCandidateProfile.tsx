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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  ArrowLeft, ArrowRight, UserPlus, Target, Zap, Brain, BarChart3, Shield, TrendingUp,
  FileText, Sparkles, ExternalLink, Mail, Eye, EyeOff, Quote, AlertTriangle,
  CheckCircle, XCircle, ChevronDown, ChevronUp, Star, Heart, Route, Search, ShieldAlert,
  Copy, RefreshCw, Trash2,
} from "lucide-react";

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
                <li key={i} className="text-[11px] text-green-700 flex items-start gap-1"><CheckCircle className="h-2.5 w-2.5 mt-0.5 shrink-0" />{s}</li>
              ))}</ul>
            </div>
          )}
          {(analysis.indirect_only?.length || 0) > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-amber-700 mb-0.5">⚠ Indirect Only</p>
              <ul className="space-y-0.5">{analysis.indirect_only!.map((s: string, i: number) => (
                <li key={i} className="text-[11px] text-amber-700 flex items-start gap-1"><AlertTriangle className="h-2.5 w-2.5 mt-0.5 shrink-0" />{s}</li>
              ))}</ul>
            </div>
          )}
          {(analysis.critical_gaps?.length || 0) > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-destructive mb-0.5">✗ Critical Gaps</p>
              <ul className="space-y-0.5">{analysis.critical_gaps!.map((s: string, i: number) => (
                <li key={i} className="text-[11px] text-destructive flex items-start gap-1"><XCircle className="h-2.5 w-2.5 mt-0.5 shrink-0" />{s}</li>
              ))}</ul>
            </div>
          )}
        </div>
      )}
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
      if (data.method) return data;
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
  const initials = candidate.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);

  const sourceBadge = () => {
    const src = (candidate as any).submission_source;
    if (src === "candidate_self_submit") return <Badge className="bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 text-[10px]">Self-Submitted</Badge>;
    if (src === "manager_cv_paste") return <Badge variant="secondary" className="text-[10px]">Manager CV Paste</Badge>;
    return <Badge variant="secondary" className="text-[10px]">Manager Manual</Badge>;
  };

  const statusBadge = () => {
    const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string }> = {
      pending_manager_review: { label: "Pending Review", variant: "outline" },
      below_threshold: { label: "Below Threshold", variant: "destructive" },
      interviewing: { label: "Interview In Progress", variant: "outline" },
      completed: { label: "Assessment Complete", variant: "default" },
      invited: { label: "Invited", variant: "secondary" },
      rejected: { label: "Declined", variant: "secondary" },
      flagged_review: { label: "⚠ Needs Review", variant: "outline", className: "border-amber-500 text-amber-700 bg-amber-50" },
    };
    const s = map[candidate.status || ""] || { label: candidate.status || "Unknown", variant: "secondary" as const };
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
              ) : (
                <div className="flex items-center gap-3 text-muted-foreground">
                  <div className="w-12 h-12 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
                    <span className="text-[10px]">—</span>
                  </div>
                  <span className="text-xs">Pending Assessment</span>
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 mt-4">
            {(candidate.status === "pending_manager_review" || candidate.status === "flagged_review" || ((candidate as any).submission_source === "candidate_self_submit" && (candidate as any).manager_decision === "pending" && candidate.interview_worthy)) && (
              <>
                <Button size="sm" className="bg-green-600 hover:bg-green-700 text-xs" onClick={handleApprove}>
                  <CheckCircle className="h-3 w-3 mr-1" />{candidate.status === "flagged_review" ? "Approve — Send Interview Code" : "Send Interview Code"}
                </Button>
                <Button variant="outline" size="sm" className="text-xs text-destructive border-destructive/30" onClick={() => setDeclineOpen(true)}>
                  <XCircle className="h-3 w-3 mr-1" />{candidate.status === "flagged_review" ? "Reject" : "Decline"}
                </Button>
              </>
            )}
            {candidate.status === "invited" && candidate.access_code && (
              <>
                <Button variant="outline" size="sm" className="text-xs" onClick={() => { navigator.clipboard.writeText(candidate.access_code!); toast.success("Code copied"); }}>
                  <Copy className="h-3 w-3 mr-1" />Copy Code
                </Button>
              </>
            )}
            {isCompleted && (
              <>
                <Button size="sm" className="text-xs" onClick={() => navigate(`/analysis-external/${candidate.id}`)}>
                  View Full Assessment
                </Button>
              </>
            )}
            {candidate.status === "rejected" && (
              <Button variant="destructive" size="sm" className="text-xs" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="h-3 w-3 mr-1" />Delete Candidate
              </Button>
            )}
          </div>
        </div>

        {/* Hybrid Verdict Banner */}
        {hybridInfo && (() => {
          const builderRatio = hybridInfo.builder_verb_ratio != null ? hybridInfo.builder_verb_ratio : null;
          const metricsCount = hybridInfo.metrics_count != null ? hybridInfo.metrics_count : null;
          const absenceAnalysis = hybridInfo.absence_analysis || null;
          const verbAssessment = hybridInfo.verb_quality_assessment || null;

          const OwnershipSignals = () => (
            <div className="space-y-3 mt-3 pt-3 border-t border-border/50">
              {/* Builder/Participant ratio bar */}
              {builderRatio != null && (
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground mb-1">Ownership Signal</p>
                  <div className="flex h-3 rounded-full overflow-hidden bg-muted">
                    <div className="bg-primary h-full transition-all" style={{ width: `${Math.round(builderRatio * 100)}%` }} />
                    <div className="bg-muted-foreground/20 h-full flex-1" />
                  </div>
                  <div className="flex justify-between mt-0.5">
                    <span className="text-[10px] text-primary font-medium">Builder {Math.round(builderRatio * 100)}%</span>
                    <span className="text-[10px] text-muted-foreground">Participant {Math.round((1 - builderRatio) * 100)}%</span>
                  </div>
                  {builderRatio < 0.5 && (
                    <p className="text-[10px] text-amber-600 mt-0.5 flex items-center gap-1">
                      <AlertTriangle className="h-2.5 w-2.5" />Mostly participation language detected.
                    </p>
                  )}
                  {verbAssessment && <p className="text-[10px] text-muted-foreground italic mt-0.5">{verbAssessment}</p>}
                </div>
              )}

              {/* Metrics count badge */}
              {metricsCount != null && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className={`text-[10px] ${metricsCount >= 3 ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300' : metricsCount >= 1 ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'}`}>
                    <BarChart3 className="h-3 w-3 mr-1" />{metricsCount} measurable impact{metricsCount !== 1 ? 's' : ''} found
                  </Badge>
                </div>
              )}

              {/* Absence analysis (collapsible) */}
              {absenceAnalysis && (
                <AbsenceAnalysisSection analysis={absenceAnalysis} />
              )}
            </div>
          );

          return (
          <Card className={
            hybridInfo.confidence === 'flagged'
              ? 'border-amber-400 border-2'
              : hybridInfo.method === 'both_agree_worthy'
                ? 'border-green-400 border-2'
                : hybridInfo.method === 'both_agree_not_worthy'
                  ? 'border-destructive border-2'
                  : ''
          }>
            <CardContent className="p-5 space-y-4">
              {/* BOTH AGREE WORTHY */}
              {hybridInfo.method === 'both_agree_worthy' && (
                <>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <div>
                      <h3 className="text-base font-bold text-green-700">✓ Interview Recommended — {hybridInfo.confidence === 'high' ? 'High' : 'Medium'} Confidence</h3>
                      <p className="text-xs text-muted-foreground">Both algorithmic and AI assessment agree.</p>
                    </div>
                  </div>
                  {hybridInfo.aiReasoning && (
                    <p className="text-sm text-foreground/80">{hybridInfo.aiReasoning}</p>
                  )}
                  {hybridInfo.recruiterNote && (
                    <p className="text-sm italic text-muted-foreground border-l-2 border-muted-foreground/30 pl-3">"{hybridInfo.recruiterNote}"</p>
                  )}
                  {hybridInfo.keyStrengths?.length > 0 && (
                    <ul className="space-y-1">
                      {hybridInfo.keyStrengths.map((s: string, i: number) => (
                        <li key={i} className="text-xs text-green-700 flex items-start gap-1.5">
                          <CheckCircle className="h-3 w-3 mt-0.5 shrink-0" />{s}
                        </li>
                      ))}
                    </ul>
                  )}
                  {hybridInfo.recommendedPreset && (
                    <Badge variant="secondary" className="text-[10px]">Recommended: {hybridInfo.recommendedPreset.replace(/_/g, ' ')}</Badge>
                  )}
                  <OwnershipSignals />
                </>
              )}

              {/* BOTH AGREE NOT WORTHY */}
              {hybridInfo.method === 'both_agree_not_worthy' && (
                <>
                  <div className="flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-destructive" />
                    <div>
                      <h3 className="text-base font-bold text-destructive">✗ Below Threshold — High Confidence</h3>
                      <p className="text-xs text-muted-foreground">Both algorithmic and AI assessment agree.</p>
                    </div>
                  </div>
                  {hybridInfo.aiReasoning && (
                    <p className="text-sm text-foreground/80">{hybridInfo.aiReasoning}</p>
                  )}
                  {hybridInfo.recruiterNote && (
                    <p className="text-sm italic text-muted-foreground border-l-2 border-muted-foreground/30 pl-3">"{hybridInfo.recruiterNote}"</p>
                  )}
                  {hybridInfo.concerns?.length > 0 && (
                    <ul className="space-y-1">
                      {hybridInfo.concerns.map((c: string, i: number) => (
                        <li key={i} className="text-xs text-destructive flex items-start gap-1.5">
                          <XCircle className="h-3 w-3 mt-0.5 shrink-0" />{c}
                        </li>
                      ))}
                    </ul>
                  )}
                  {hybridInfo.keyStrengths?.length > 0 && (
                    <div>
                      <p className="text-[11px] text-muted-foreground italic mb-1">Strengths noted but insufficient for this role:</p>
                      <ul className="space-y-1">
                        {hybridInfo.keyStrengths.map((s: string, i: number) => (
                          <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                            <Star className="h-3 w-3 mt-0.5 shrink-0" />{s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <OwnershipSignals />
                </>
              )}

              {/* FLAGGED — CONFLICTING */}
              {hybridInfo.confidence === 'flagged' && (
                <>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                    <div>
                      <h3 className="text-base font-bold text-amber-700">⚠ Conflicting Assessment — Manager Review Required</h3>
                    </div>
                  </div>
                  <div className="text-sm text-foreground/80">
                    {hybridInfo.method === 'flagged_ai_overrides' ? (
                      <p><strong>Algorithm:</strong> Below threshold due to skill name mismatch. <strong>AI Assessment:</strong> Strong domain expertise detected. The AI recommends proceeding.</p>
                    ) : (
                      <p><strong>Algorithm:</strong> Sufficient skill coverage. <strong>AI Assessment:</strong> Has concerns about depth or fit.</p>
                    )}
                  </div>
                  {hybridInfo.aiReasoning && (
                    <div className="border-l-4 border-primary/40 pl-3 py-1 bg-primary/5 rounded-r-md">
                      <p className="text-sm text-foreground/80 italic">{hybridInfo.aiReasoning}</p>
                    </div>
                  )}
                  {hybridInfo.recruiterNote && (
                    <p className="text-sm italic text-muted-foreground border-l-2 border-muted-foreground/30 pl-3">"{hybridInfo.recruiterNote}"</p>
                  )}
                  {hybridInfo.concerns?.length > 0 && (
                    <ul className="space-y-1">
                      {hybridInfo.concerns.map((c: string, i: number) => (
                        <li key={i} className="text-xs text-amber-700 flex items-start gap-1.5">
                          <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />{c}
                        </li>
                      ))}
                    </ul>
                  )}
                  {hybridInfo.keyStrengths?.length > 0 && (
                    <ul className="space-y-1">
                      {hybridInfo.keyStrengths.map((s: string, i: number) => (
                        <li key={i} className="text-xs text-green-700 flex items-start gap-1.5">
                          <CheckCircle className="h-3 w-3 mt-0.5 shrink-0" />{s}
                        </li>
                      ))}
                    </ul>
                  )}
                  <OwnershipSignals />
                </>
              )}
            </CardContent>
          </Card>
          );
        })()}

        {/* Section 1 — Candidate Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Candidate Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <InfoRow label="Full Name" value={candidate.name} />
              <InfoRow label="Email" value={
                (candidate as any).candidate_email ? (
                  <a href={`mailto:${(candidate as any).candidate_email}`} className="text-primary hover:underline flex items-center gap-1">
                    <Mail className="h-3 w-3" />{(candidate as any).candidate_email}
                  </a>
                ) : candidate.email || "—"
              } />
              <InfoRow label="Role Applied For" value={role?.title || "—"} />
              <InfoRow label="Submitted At" value={
                (candidate as any).submitted_at
                  ? new Date((candidate as any).submitted_at).toLocaleString()
                  : candidate.created_at ? new Date(candidate.created_at).toLocaleString() : "—"
              } />
              <InfoRow label="Submission Source" value={(candidate as any).submission_source?.replace(/_/g, " ") || "—"} />
              <InfoRow label="Manager Decision" value={
                <span className={`capitalize ${(candidate as any).manager_decision === "approved" ? "text-green-600" : (candidate as any).manager_decision === "rejected" ? "text-destructive" : "text-muted-foreground"}`}>
                  {(candidate as any).manager_decision || "pending"}
                </span>
              } />
              <InfoRow label="Access Code" value={
                candidate.access_code ? (
                  <div className="flex items-center gap-2">
                    <span className="font-mono">{codeRevealed ? candidate.access_code : candidate.access_code.slice(0, 3) + "***"}</span>
                    <button onClick={() => setCodeRevealed(!codeRevealed)} className="text-muted-foreground hover:text-foreground">
                      {codeRevealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    </button>
                  </div>
                ) : "—"
              } />
              <InfoRow label="Code Expires" value={
                candidate.code_expires_at ? new Date(candidate.code_expires_at).toLocaleString() : "—"
              } />
            </div>
          </CardContent>
        </Card>

        {/* Candidate Message */}
        {(candidate as any).candidate_message && (
          <Card>
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <Quote className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Candidate's Message</p>
                  <p className="text-sm text-foreground/80 italic">"{(candidate as any).candidate_message}"</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Section 2 — CV Content */}
        {(candidate as any).interview_notes && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />Submitted CV
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-secondary rounded-lg p-4 max-h-80 overflow-y-auto">
                <pre className="text-xs font-mono whitespace-pre-wrap text-foreground/80">
                  {(candidate as any).interview_notes}
                </pre>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Section 3 — AI-Extracted Skills */}
        {Object.keys(interviewSkills).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4" />AI-Extracted Skills
              </CardTitle>
              <p className="text-[11px] text-muted-foreground">Extracted by CV Agent — requires interview verification</p>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {Object.entries(interviewSkills).map(([skill, data]: [string, any]) => (
                  <div key={skill} className="rounded-lg border border-border p-2 text-xs">
                    <span className="font-medium">{skill.replace(/([A-Z])/g, " $1").trim()}</span>
                    {typeof data === "object" && data?.proficiency != null && (
                      <Badge variant="secondary" className="ml-2 text-[9px]">
                        {data.proficiency}/3
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-3 p-2 rounded-md bg-status-amber-light border border-status-amber/20 text-xs text-status-amber flex items-center gap-2">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                CV data is claimed, not verified. Skills marked ⚠ should be confirmed in the interview.
              </div>
            </CardContent>
          </Card>
        )}

        {/* Section 4 — Worthiness Assessment */}
        <Card className={`border-l-4 ${candidate.interview_worthy ? "border-l-green-500" : "border-l-destructive"}`}>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4" />AI Screening Decision
            </CardTitle>
          </CardHeader>
          <CardContent>
            {candidate.interview_worthy ? (
              <div className="space-y-3">
                <p className="text-lg font-bold text-green-600 dark:text-green-400">✓ Interview Recommended</p>
                {candidate.worthy_score != null && (
                  <p className="text-sm text-muted-foreground">Score: <span className="font-mono font-semibold">{Math.round(candidate.worthy_score * 100)}%</span></p>
                )}
                {candidate.worthy_reasoning && <p className="text-sm text-foreground/80">{candidate.worthy_reasoning}</p>}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-lg font-bold text-destructive">✗ Below Threshold</p>
                {(candidate.not_worthy_reasons as any[])?.length > 0 && (
                  <ul className="space-y-1">
                    {(candidate.not_worthy_reasons as any[]).map((r: any, i: number) => (
                      <li key={i} className="text-sm text-destructive/80 flex items-start gap-2">
                        <span className="mt-1">•</span>
                        <span>{typeof r === "string" ? r : r.reason || JSON.stringify(r)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-xs text-muted-foreground italic">These gaps are too large to bridge in a reasonable timeframe for this role.</p>
                {!candidate.access_code && (
                  <Button variant="outline" size="sm" className="text-xs text-muted-foreground" onClick={() => {
                    if (confirm("Override AI screening and send interview code anyway?")) handleApprove();
                  }}>
                    Override — Send Interview Code Anyway
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section 5 — Interview & Assessment (after completion) */}
        {isCompleted && score != null && (
          <>
            {/* Three-Layer Score */}
            <Card>
              <CardContent className="p-6">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-5">Three-Layer Assessment</h3>
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
                    <div className="flex flex-col items-center">
                      <ReadinessRing value={Math.round((momentumScore || 0) * 100)} size="md" />
                      <span className="text-xs font-semibold mt-1">Momentum Score</span>
                      <span className="text-[11px] text-muted-foreground">Growth trajectory</span>
                      <span className="text-[11px] text-muted-foreground">& role motivation</span>
                    </div>
                  </div>
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
                </div>
              </CardContent>
            </Card>

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
                          <span className="text-sm font-medium flex-1">{gap.skill?.replace(/([A-Z])/g, " $1").trim()}</span>
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
                    {gapAnalysis.surplusSkills?.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {gapAnalysis.surplusSkills.map((s: any, i: number) => (
                          <Badge key={i} className="bg-status-green-light text-status-green border-status-green/20">
                            {s.skill?.replace(/([A-Z])/g, " $1").trim()} +{s.surplus}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No surplus skills identified</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Momentum Assessment */}
            {momentumBreakdown && momentumBreakdown.momentum_score != null && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Zap className="h-4 w-4 text-primary" />Momentum Assessment
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <MomentumRow label="Learning Velocity" icon={<Brain className="h-3.5 w-3.5" />}
                    value={momentumBreakdown.learning_velocity || 0}
                    evidence={momentumBreakdown.learning_velocity_evidence}
                    color="hsl(var(--primary))" />
                  <MomentumRow label="Scope Trajectory" icon={<TrendingUp className="h-3.5 w-3.5" />}
                    value={momentumBreakdown.scope_trajectory || 0}
                    evidence={momentumBreakdown.scope_trajectory_evidence}
                    color="hsl(142 76% 36%)" />
                  <MomentumRow label="Motivation Alignment" icon={<Heart className="h-3.5 w-3.5" />}
                    value={momentumBreakdown.motivation_alignment || 0}
                    evidence={momentumBreakdown.motivation_alignment_evidence}
                    color="hsl(270 60% 55%)" />
                  {momentumBreakdown.momentum_narrative && (
                    <div className="border-l-4 border-primary/40 bg-primary/5 rounded-r-lg p-4">
                      <p className="text-sm italic text-foreground/80">{momentumBreakdown.momentum_narrative}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Transition Profile */}
            {transitionProfile?.is_transitioning && (
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="p-4 flex items-start gap-3">
                  <TrendingUp className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">
                      Active Transition Profile — {transitionProfile.transition_stage === "mid" ? "Mid-Transition" : transitionProfile.transition_stage === "late" ? "Late-Stage" : "Early Transition"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{transitionProfile.maturity_note}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Upskilling Paths */}
            {upskillingPaths.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Route className="h-4 w-4 text-primary" />Learning Pathways
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {upskillingPaths.map((path: any, i: number) => (
                      <div key={i}>
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="text-xs">{path.targetSkill?.replace(/([A-Z])/g, " $1").trim()}</Badge>
                          <span className="text-[11px] text-muted-foreground font-mono">{path.totalWeeks} weeks</span>
                        </div>
                        <div className="flex items-center gap-1 flex-wrap">
                          {path.path?.map((node: string, j: number) => (
                            <div key={j} className="flex items-center gap-1">
                              <span className="px-2 py-0.5 text-xs rounded-md bg-primary/10 text-primary font-medium">
                                {node.replace(/([A-Z])/g, " $1").trim()}
                              </span>
                              {j < path.path.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* AI Report + Raw Scores */}
            <Tabs defaultValue="report">
              <TabsList>
                <TabsTrigger value="report">AI Report</TabsTrigger>
                <TabsTrigger value="raw">Raw Scores</TabsTrigger>
              </TabsList>
              <TabsContent value="report">
                <Card>
                  <CardContent className="p-6">
                    {report ? (
                      <div className="prose prose-sm max-w-none prose-headings:text-foreground prose-p:text-foreground/80" dangerouslySetInnerHTML={{ __html: markdownToHtml(report) }} />
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-8">No AI report generated yet.</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="raw">
                <Card>
                  <CardContent className="p-6 font-mono text-xs space-y-4">
                    <RawRow label="Technical Match" value={technicalMatch != null ? Number(technicalMatch).toFixed(3) : "—"} />
                    <RawRow label="Capability Match" value={capabilityMatch != null ? Number(capabilityMatch).toFixed(3) : "—"} />
                    <RawRow label="Momentum Score" value={momentumScore != null ? Number(momentumScore).toFixed(3) : "—"} />
                    <RawRow label="Three-Layer Score" value={candidate.full_three_layer_score != null ? Number(candidate.full_three_layer_score).toFixed(3) : "—"} />
                    {results.cosineSimilarity != null && <RawRow label="Cosine Similarity" value={Number(results.cosineSimilarity).toFixed(3)} />}
                    {results.jaccardBinary != null && <RawRow label="Jaccard (Binary)" value={Number(results.jaccardBinary).toFixed(3)} />}
                    {results.jaccardWeighted != null && <RawRow label="Jaccard (Weighted)" value={Number(results.jaccardWeighted).toFixed(3)} />}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* Risk Factors */}
            {riskFactors.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-status-amber" />Risk Factors
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {riskFactors.map((risk, i) => {
                      const borderColor = risk.level === "HIGH" ? "border-l-destructive" : risk.level === "MEDIUM" ? "border-l-status-amber" : "border-l-primary";
                      const badgeBg = risk.level === "HIGH" ? "bg-destructive/10 text-destructive" : risk.level === "MEDIUM" ? "bg-status-amber-light text-status-amber" : "bg-primary/10 text-primary";
                      return (
                        <div key={i} className={`border-l-4 ${borderColor} pl-3 py-2`}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-semibold">{risk.name}</span>
                            <Badge className={`text-[10px] ${badgeBg}`}>{risk.level}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{risk.description}</p>
                        </div>
                      );
                    })}
                  </div>
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

function MomentumRow({ label, icon, value, evidence, color }: {
  label: string; icon: React.ReactNode; value: number; evidence?: string; color: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-sm font-medium flex-1">{label}</span>
        <span className="font-mono text-sm font-semibold">{Math.round(value * 100)}%</span>
      </div>
      <div className="h-2 bg-secondary rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${value * 100}%`, backgroundColor: color }} />
      </div>
      {evidence && <p className="text-xs text-muted-foreground italic pl-6">{evidence}</p>}
    </div>
  );
}

function RawRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 px-2 rounded">
      <span className="text-sm">{label}</span>
      <span className="font-mono text-sm">{value}</span>
    </div>
  );
}
