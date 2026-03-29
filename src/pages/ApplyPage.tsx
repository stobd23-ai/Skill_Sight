import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Clock, Shield, CheckCircle, FileText, Loader2, AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { runFullAnalysis, detectRoleType } from "@/lib/algorithms";

function useOpenRoles() {
  return useQuery({
    queryKey: ["open_roles_public"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("roles")
        .select("*")
        .eq("hiring_status", "actively_hiring");
      if (error) throw error;
      return data;
    },
  });
}

interface HybridResult {
  worthy: boolean;
  confidence: 'high' | 'mixed_signals' | 'low';
  verdict: string;
  verdictLabel: string;
  worthyScore: number;
  reasoning: string;
  aiReasoning: string;
  concerns: string[];
  keyStrengths: string[];
  recommendedPreset: string;
  recruiterNote: string;
  domainGapClassification: string;
  seniorityCheck: string;
}

function hybridWorthinessDecision(
  partialScore: number,
  extractedSkills: Record<string, any>,
  targetRole: any,
  experienceProfile: any,
  aiJudgment: any
): HybridResult {
  const requiredSkills = Object.keys(targetRole?.required_skills || {});
  const safeSkills = extractedSkills || {};
  const coveredSkills = requiredSkills.filter(
    (s) => safeSkills[s] && safeSkills[s].proficiency >= 1
  );
  const coverageRatio = requiredSkills.length > 0 ? coveredSkills.length / requiredSkills.length : 0;

  const weightedCoverage = coveredSkills.reduce(
    (sum, s) => sum + (targetRole.strategic_weights?.[s] || 0.5), 0
  );
  const maxWeighted = requiredSkills.reduce(
    (sum, s) => sum + (targetRole.strategic_weights?.[s] || 0.5), 0
  );
  const qualityCoverage = maxWeighted > 0 ? weightedCoverage / maxWeighted : 0;
  const effectiveCoverage = Math.max(coverageRatio, qualityCoverage);

  const expYears = experienceProfile?.total_years || 0;
  const redFlags = experienceProfile?.red_flags?.length || 0;
  const seniorityCheck = experienceProfile?.seniority_check || "not_applicable";
  const domainGapClass = aiJudgment?.domain_gap_classification || "mixed";

  // Score with penalties
  let algoScore = partialScore;
  const algoReasons: string[] = [];

  if (effectiveCoverage < 0.20) {
    algoReasons.push(`Low skill coverage: ${Math.round(effectiveCoverage * 100)}%`);
    algoScore *= 0.75;
  }
  if (expYears < 1) {
    algoReasons.push('Under 1 year experience');
    algoScore *= 0.8;
  }
  if (redFlags >= 3) {
    algoReasons.push(`${redFlags} profile concerns`);
    algoScore *= 0.85;
  }

  // Seniority mismatch penalty (FIX 6)
  if (seniorityCheck === "mismatch") {
    algoScore = Math.max(0, algoScore - 0.20);
    algoReasons.push("Seniority mismatch — senior title with low ownership evidence");
  }

  // Minimum score floor for experienced candidates
  if (expYears >= 3 && effectiveCoverage >= 0.40) {
    algoScore = Math.max(algoScore, 0.20);
  }

  // High-potential override
  const bvr = experienceProfile?.builder_verb_ratio ?? aiJudgment?.builder_verb_ratio ?? 0.5;
  const strongMetrics = (experienceProfile?.strong_metrics_count || 0) + (experienceProfile?.medium_metrics_count || 0);
  const isHighPotential =
    (experienceProfile?.education_level === 'phd' || experienceProfile?.education_level === 'masters') &&
    expYears >= 4 &&
    strongMetrics >= 3 &&
    bvr >= 0.5 &&
    effectiveCoverage >= 0.40;

  const algoWorthy = algoScore >= 0.35;
  const aiWorthy = aiJudgment?.ai_verdict === true;

  // Use calibrated confidence from parse-cv post-processing
  const calibratedConf = aiJudgment?.calibrated_confidence || aiJudgment?.ai_confidence || "medium";

  // Map to unified confidence labels
  const mapConfidence = (c: string): 'high' | 'mixed_signals' | 'low' => {
    if (c === 'high') return 'high';
    if (c === 'low') return 'low';
    return 'mixed_signals';
  };

  const buildResult = (
    worthy: boolean,
    verdictLabel: string,
    reasoning: string,
    score: number,
    confidence: 'high' | 'mixed_signals' | 'low'
  ): HybridResult => ({
    worthy,
    confidence,
    verdict: worthy ? 'recommend' : (confidence === 'mixed_signals' || confidence === 'low' ? 'flag' : 'reject'),
    verdictLabel,
    worthyScore: score,
    reasoning: reasoning,
    aiReasoning: aiJudgment?.ai_reasoning || '',
    concerns: [...algoReasons, ...(aiJudgment?.ai_concerns || [])].slice(0, 3),
    keyStrengths: (aiJudgment?.ai_key_strengths || []).slice(0, 3),
    recommendedPreset: aiJudgment?.ai_recommended_preset || 'technical_depth',
    recruiterNote: aiJudgment?.ai_recruiter_note || '',
    domainGapClassification: domainGapClass,
    seniorityCheck,
  });

  // High-potential override → FLAG
  if (isHighPotential && !algoWorthy) {
    return buildResult(
      false,
      'High-potential candidate — core capabilities exceptional, domain gaps are trainable',
      'Advanced credentials with production-scale impact. Missing domain-specific stack is learnable within 3-6 months. Recommend interview.',
      Math.max(algoScore, 0.30),
      'mixed_signals'
    );
  }

  if (aiJudgment?.high_potential_override && !algoWorthy) {
    return buildResult(
      false,
      'High-potential candidate — exceptional credentials warrant review',
      aiJudgment?.ai_reasoning || 'Exceptional credentials and production impact despite skill keyword gaps.',
      Math.max(algoScore, 0.30),
      'mixed_signals'
    );
  }

  if (!aiJudgment) {
    return buildResult(
      algoWorthy,
      algoWorthy ? 'Strong match — High Confidence' : 'Insufficient match — High Confidence',
      algoWorthy ? 'Algorithmic analysis indicates interview-worthy.' : 'Below algorithmic threshold.',
      algoScore,
      'mixed_signals'
    );
  }

  if (algoWorthy && aiWorthy) {
    const builderRatio = aiJudgment?.builder_verb_ratio || 0.5;
    if (builderRatio < 0.4) {
      return buildResult(
        false,
        'Surface coverage without ownership depth',
        'Skill keywords present but low ownership language detected. Manager review recommended.',
        algoScore,
        'mixed_signals'
      );
    }
    return buildResult(
      true,
      'Strong match — High Confidence',
      aiJudgment?.ai_reasoning || 'Both algorithmic and AI assessment agree this candidate is interview-worthy.',
      Math.max(algoScore, 0.75),
      mapConfidence(calibratedConf)
    );
  }

  if (!algoWorthy && !aiWorthy) {
    if (isHighPotential) {
      return buildResult(
        false,
        'High-potential candidate flagged despite threshold miss',
        'Advanced credentials warrant manager review.',
        Math.max(algoScore, 0.25),
        'mixed_signals'
      );
    }
    return buildResult(
      false,
      'Insufficient match — High Confidence',
      aiJudgment?.ai_reasoning || 'Both assessment layers agree this candidate does not meet the threshold.',
      Math.min(algoScore, 0.35),
      mapConfidence(calibratedConf)
    );
  }

  if (!algoWorthy && aiWorthy) {
    return buildResult(
      false,
      'Domain gap with strong transferable capability',
      aiJudgment?.ai_reasoning || 'Weak keyword coverage but strong domain expertise detected. Manager review recommended.',
      algoScore,
      'mixed_signals'
    );
  }

  // algoWorthy && !aiWorthy
  return buildResult(
    false,
    'Surface coverage without ownership depth',
    aiJudgment?.ai_reasoning || 'Sufficient skill keywords but concerns about depth or fit.',
    algoScore,
    'mixed_signals'
  );
}

type SubmitPhase = "idle" | "parsing" | "scoring" | "saving" | "done_worthy" | "done_not_worthy" | "done_flagged";

export default function ApplyPage() {
  const [searchParams] = useSearchParams();
  const { data: openRoles } = useOpenRoles();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [cvText, setCvText] = useState("");
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [phase, setPhase] = useState<SubmitPhase>("idle");
  const [roleName, setRoleName] = useState("");

  useEffect(() => {
    const roleParam = searchParams.get("role");
    if (roleParam && !selectedRoleId) {
      setSelectedRoleId(roleParam);
    }
  }, [searchParams, selectedRoleId]);

  const selectedRole = useMemo(() => {
    if (!openRoles || !selectedRoleId) return null;
    const app = openRoles.find((a: any) => a.role_id === selectedRoleId);
    return app?.roles as any;
  }, [openRoles, selectedRoleId]);

  const allRoles = useMemo(() => {
    if (!openRoles) return [];
    return openRoles.map((a: any) => a.roles).filter(Boolean);
  }, [openRoles]);

  const canSubmit = name.trim() && email.trim() && selectedRoleId && cvText.trim().length >= 50 && consent && phase === "idle";

  const handleSubmit = async () => {
    if (!canSubmit || !selectedRole) return;
    setRoleName(selectedRole.title);

    try {
      // Phase 1: Parse CV
      setPhase("parsing");
      const roleType = detectRoleType(selectedRole.required_skills || {}, selectedRole.strategic_weights || {});

      const parseResponse = await supabase.functions.invoke("parse-cv", {
        body: {
          cvText: cvText,
          targetRole: selectedRole.title,
          targetRoleType: roleType,
          roleRequirements: selectedRole.required_skills || {},
        },
      });

      const parsed = parseResponse.data?.parsed;
      const aiJudgment = parseResponse.data?.aiJudgment || null;
      if (!parsed) throw new Error("CV parsing failed");

      // Phase 2: Score
      setPhase("scoring");
      const skillsVector: Record<string, number> = {};
      Object.entries(parsed.extracted_skills || {}).forEach(([skill, data]: [string, any]) => {
        skillsVector[skill] = data.proficiency;
      });

      const algorithmInput = {
        employee: {
          id: "external",
          name: name,
          skills: skillsVector,
          performanceScore: 0.5,
          learningAgility: 0.5,
          tenureYears: parsed.experience_profile?.total_years || 0,
        },
        targetRole: {
          id: selectedRoleId!,
          title: selectedRole.title,
          requiredSkills: selectedRole.required_skills || {},
          strategicWeights: selectedRole.strategic_weights || {},
        },
        allRoles: allRoles.map((r: any) => ({ requiredSkills: r.required_skills || {} })),
      };

      const results = runFullAnalysis(algorithmInput);

      const hybrid = hybridWorthinessDecision(
        results.overallReadiness,
        parsed.extracted_skills,
        selectedRole,
        parsed.experience_profile,
        aiJudgment
      );

      // Determine status
      let candidateStatus: string;
      if (hybrid.verdict === 'flag') {
        candidateStatus = 'flagged_review';
      } else if (hybrid.worthy) {
        candidateStatus = 'pending_manager_review';
      } else {
        candidateStatus = 'below_threshold';
      }

      // Phase 3: Save
      setPhase("saving");
      await supabase.from("external_candidates").insert({
        name: name.trim(),
        email: email.trim() || null,
        candidate_email: email.trim(),
        role_id: selectedRoleId,
        status: candidateStatus,
        interview_worthy: hybrid.worthy,
        worthy_score: hybrid.worthyScore,
        worthy_reasoning: JSON.stringify({
          verdict: hybrid.verdict,
          verdictLabel: hybrid.verdictLabel,
          confidence: hybrid.confidence,
          reasoning: hybrid.reasoning,
          aiReasoning: hybrid.aiReasoning,
          concerns: hybrid.concerns,
          keyStrengths: hybrid.keyStrengths,
          recommendedPreset: hybrid.recommendedPreset,
          recruiterNote: hybrid.recruiterNote,
          builder_verb_ratio: aiJudgment?.builder_verb_ratio ?? null,
          strong_metrics_count: aiJudgment?.strong_metrics_count ?? null,
          medium_metrics_count: aiJudgment?.medium_metrics_count ?? null,
          weak_metrics_count: aiJudgment?.weak_metrics_count ?? null,
          verb_quality_assessment: aiJudgment?.verb_quality_assessment ?? null,
          absence_analysis: aiJudgment?.absence_analysis ?? null,
          domain_gap_classification: hybrid.domainGapClassification,
          seniority_check: hybrid.seniorityCheck,
        }),
        not_worthy_reasons: hybrid.concerns as any,
        submission_source: "candidate_self_submit",
        candidate_message: message.trim() || null,
        submitted_at: new Date().toISOString(),
        manager_notified: false,
        manager_decision: "pending",
        interview_skills: parsed.extracted_skills as any,
        full_algorithm_results: results as any,
      } as any);

      if (hybrid.verdict === 'flag') {
        setPhase("done_flagged");
      } else if (hybrid.worthy) {
        setPhase("done_worthy");
      } else {
        setPhase("done_not_worthy");
      }
    } catch (err) {
      console.error("Submission error:", err);
      setPhase("idle");
    }
  };

  // Success screen — same for all outcomes
  if (phase === "done_worthy" || phase === "done_flagged" || phase === "done_not_worthy") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-5">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Your Application Has Been Received</h1>
          <p className="text-sm text-muted-foreground">
            Thank you for applying to the <strong>{roleName}</strong> position at BMW Group. Our hiring team will review your profile and get back to you at <strong>{email}</strong> within 48 hours.
          </p>
          <Card>
            <CardContent className="p-4 text-left space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">What happens next:</p>
              <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                <li>The hiring team reviews your profile</li>
                <li>If selected, you'll receive an interview access code by email</li>
                <li>Complete a 15-minute skills interview</li>
              </ol>
            </CardContent>
          </Card>
          <Button variant="outline" onClick={() => window.location.reload()}>Return to Portal</Button>
        </div>
      </div>
    );
  }

  const isProcessing = ["parsing", "scoring", "saving"].includes(phase);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-6 py-3 flex items-center justify-between">
        <button
          onClick={() => window.history.length > 1 ? window.history.back() : (window.location.href = "/login")}
          className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
            <span className="text-[9px] font-bold text-primary-foreground">BMW</span>
          </div>
          <div className="text-center">
            <span className="text-sm font-bold">SkillSight</span>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">BMW Group · Career Assessment Portal</p>
          </div>
        </div>
        <div className="w-7" />
      </header>

      <div className="text-center py-10 px-6">
        <h1 className="text-3xl font-bold mb-3">Apply for a Role at BMW Group</h1>
        <p className="text-base text-muted-foreground max-w-xl mx-auto">
          Submit your CV below. Our AI will assess your profile and the hiring team will be in touch if there is a strong match.
        </p>
        <div className="flex items-center justify-center gap-6 mt-5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />15-min skills interview if selected</span>
          <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" />Your data is handled securely</span>
          <span className="flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5" />Decision within 48 hours</span>
        </div>
      </div>

      <div className="max-w-[640px] mx-auto px-6 pb-16 relative">
        {isProcessing && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg">
            <div className="text-center space-y-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
              <div className="space-y-2 text-sm font-mono">
                <p className={phase === "parsing" ? "text-primary font-medium" : "text-muted-foreground"}>
                  {phase === "parsing" ? "Analysing CV + AI assessment..." : "✓ CV parsed & AI assessed"}
                </p>
                <p className={phase === "scoring" ? "text-primary font-medium" : phase === "parsing" ? "text-muted-foreground/50" : "text-muted-foreground"}>
                  {phase === "scoring" ? "Scoring skill match..." : phase === "parsing" ? "Scoring skill match..." : "✓ Skills scored"}
                </p>
                <p className={phase === "saving" ? "text-primary font-medium" : "text-muted-foreground/50"}>
                  {phase === "saving" ? "Computing role fit..." : "Computing role fit..."}
                </p>
              </div>
            </div>
          </div>
        )}

        <Card>
          <CardContent className="p-8 space-y-8">
            <div className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">About You</h2>
              <div>
                <label className="text-xs font-medium">Full Name *</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Maria Gonzalez" className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium">Email Address *</label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. maria@example.com" className="mt-1" />
                <p className="text-[11px] text-muted-foreground mt-1">We'll contact you here if selected</p>
              </div>
              <div>
                <label className="text-xs font-medium">LinkedIn URL (optional)</label>
                <Input value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="https://linkedin.com/in/yourprofile" className="mt-1" />
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Which role are you applying for? *</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {openRoles?.map((app: any) => {
                  const role = app.roles;
                  if (!role) return null;
                  const isSelected = selectedRoleId === app.role_id;
                  return (
                    <button
                      key={app.id}
                      onClick={() => setSelectedRoleId(app.role_id)}
                      className={`p-4 rounded-lg border-2 text-left transition-all ${
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      <p className="text-sm font-semibold">{role.title}</p>
                      {role.department && (
                        <Badge variant="secondary" className="text-[10px] mt-1">{role.department}</Badge>
                      )}
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                        {app.public_description?.slice(0, 80) || role.description?.slice(0, 80) || ""}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Your CV *</h2>
              <p className="text-[11px] text-muted-foreground">Paste your CV or resume below. Include your work experience, skills, projects, and any relevant achievements. Plain text works best.</p>
              <Textarea
                value={cvText}
                onChange={(e) => setCvText(e.target.value.slice(0, 5000))}
                className="min-h-[280px] font-mono text-xs"
                placeholder={`WORK EXPERIENCE\nSenior Engineer — Company Name (2020–Present)\n- Designed and implemented...\n- Led a team of...\n\nSKILLS\nPython, Machine Learning, ...\n\nEDUCATION\n...`}
              />
              <p className="text-[11px] text-muted-foreground text-right">{cvText.length} / 5000 characters</p>
            </div>

            <div className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Optional Message</h2>
              <p className="text-[11px] text-muted-foreground">Anything else you'd like the hiring team to know?</p>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, 200))}
                className="text-sm"
                rows={3}
              />
              <p className="text-[11px] text-muted-foreground text-right">{message.length} / 200 characters</p>
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                checked={consent}
                onCheckedChange={(v) => setConsent(v === true)}
                className="mt-0.5"
              />
              <p className="text-xs text-muted-foreground leading-relaxed">
                I consent to SkillSight processing my CV and conducting an AI-powered skills assessment for the purpose of this job application. I understand this data will be used only for evaluating my fit for the selected role at BMW Group.
              </p>
            </div>

            <Button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="w-full h-11"
              size="lg"
            >
              Submit Application
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
