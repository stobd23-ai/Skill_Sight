import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Shield, Send, Check, Sparkles, Brain, BarChart3, Target, Cpu, Zap } from "lucide-react";
import { runFullAnalysis, detectRoleType, computeThreeLayerScore, getAHPWeightsForRole, type AlgorithmInput, type SkillVector, type RoleType } from "@/lib/algorithms";
import { skillsToVector, skillsToWeights, parseRequiredSkills } from "@/lib/utils";
import { mapInterviewSkillsToRoleKeys } from "@/lib/interviewSkillMapping";
import { computeCvSkillVector } from "@/lib/cvCoverageScore";

interface Message { role: "ai" | "user"; content: string; timestamp: Date; }
type Phase = "interviewing" | "processing" | "complete" | "expired";

const ALGO_STEPS = [
  { icon: Target, label: "Cosine Similarity" },
  { icon: Shield, label: "Jaccard Analysis" },
  { icon: BarChart3, label: "Weighted Gap Score" },
  { icon: Sparkles, label: "TF-IDF Rarity" },
  { icon: Brain, label: "Dijkstra Pathfinding" },
  { icon: Cpu, label: "Overall Readiness" },
  { icon: Zap, label: "Three-Layer Score" },
];

export default function InterviewExternal() {
  const { interviewId } = useParams();
  const navigate = useNavigate();
  const [candidate, setCandidate] = useState<any>(null);
  const [phase, setPhase] = useState<Phase>("interviewing");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [questionsAsked, setQuestionsAsked] = useState(0);
  const [algoStep, setAlgoStep] = useState(0);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem("external_candidate");
    if (!stored) {
      setPhase("expired");
      return;
    }
    const parsed = JSON.parse(stored);
    if (parsed.interviewId !== interviewId) {
      setPhase("expired");
      return;
    }
    setCandidate(parsed);
  }, [interviewId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isAiTyping]);

  // Start interview on mount
  useEffect(() => {
    if (candidate && messages.length === 0) {
      sendMessage();
    }
  }, [candidate]);

  const sendMessage = useCallback(async (userMessage?: string) => {
    if (!candidate) return;

    if (questionsAsked >= 12) {
      handleComplete(null);
      return;
    }

    const newMessages = userMessage
      ? [...messages, { role: "user" as const, content: userMessage, timestamp: new Date() }]
      : messages;

    if (userMessage) {
      setMessages(newMessages);
      setInput("");
    }

    setIsAiTyping(true);

    try {
      const targetSkills = Object.keys(skillsToVector(candidate.requiredSkills));
      const { data, error } = await supabase.functions.invoke("interview-chat", {
        body: {
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          interviewType: "employee",
          employeeName: candidate.name,
          employeeTitle: "External Candidate",
          roleName: candidate.roleTitle,
          targetSkills,
        },
      });

      if (error) throw error;

      const aiMsg: Message = { role: "ai", content: data.message, timestamp: new Date() };
      const questionDelta = typeof data.questionDelta === "number" ? data.questionDelta : 1;
      const nextQ = questionsAsked + questionDelta;

      setMessages(prev => [...prev, aiMsg]);
      setQuestionsAsked(nextQ);

      if (data.isComplete && data.extractedData) {
        await handleComplete(data.extractedData);
      } else if (nextQ >= 12) {
        setTimeout(() => handleComplete(data.extractedData || null), 1500);
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: "ai", content: "I apologize, there was a technical issue. Could you please repeat that?", timestamp: new Date() }]);
    } finally {
      setIsAiTyping(false);
    }
  }, [candidate, messages, questionsAsked]);

  const handleComplete = async (extractedData: any) => {
    if (!candidate) return;
    setPhase("processing");

    try {
      const historyForInterpret = messages.map(m => ({
        role: m.role === "ai" ? "assistant" : "user",
        content: m.content,
      }));

      // Step 1: Interpret interview
      setAlgoStep(0);
      const { data: interpretResult } = await supabase.functions.invoke("interpret-interview", {
        body: {
          conversationHistory: historyForInterpret,
          employeeName: candidate.name,
          employeeRole: "External Candidate",
          targetRole: candidate.roleTitle,
          existingSkills: {},
        },
      });

      const interpreted = interpretResult?.interpreted;
      const extractedSkills = interpreted?.extracted_skills || extractedData?.extracted_skills || {};

      // Step 2: Map capabilities
      let capabilityData: any = null;
      try {
        const { data: capResult } = await supabase.functions.invoke("map-capabilities", {
          body: {
            conversationHistory: historyForInterpret,
            employeeName: candidate.name,
            employeeRole: "External Candidate",
            targetRole: candidate.roleTitle,
            requiredSkills: candidate.requiredSkills || {},
            existingSkills: {},
          },
        });
        capabilityData = capResult?.capabilities;
      } catch (e) {
        console.error("Capability mapping failed:", e);
      }

      // Step 3: Compute momentum
      let momentum: any = null;
      try {
        const { data: momentumResponse } = await supabase.functions.invoke("compute-momentum", {
          body: {
            conversationHistory: historyForInterpret,
            extractedSkills,
            performanceReviews: [],
            trainingHistory: [],
            performanceScore: 0.5,
            learningAgility: 0.5,
            tenureYears: 0,
          },
        });
        momentum = momentumResponse?.momentum;
      } catch (e) {
        console.error("Momentum computation failed:", e);
      }

      // Step 4: Run algorithms with animation
      // Get role skill names for mapping
      const parsedRoleSkills = parseRequiredSkills(candidate.requiredSkills);
      const roleSkillNames = parsedRoleSkills.map(s => s.name);
      const reqSkills = skillsToVector(candidate.requiredSkills);

      // Merge CV skills + interview-demonstrated skills using role display names
      const empSkills: SkillVector = {};
      // First: CV-based skill matching
      const cvText = candidate.candidateMessage || "";
      const cvSkills = computeCvSkillVector(cvText, candidate.requiredSkills);
      Object.entries(cvSkills).forEach(([k, v]) => {
        empSkills[k] = Math.max(empSkills[k] || 0, v);
      });
      // Then: interview-extracted skills mapped to role display names
      const mappedInterviewSkills = mapInterviewSkillsToRoleKeys(extractedSkills, roleSkillNames);
      Object.entries(mappedInterviewSkills).forEach(([k, v]) => {
        empSkills[k] = Math.max(empSkills[k] || 0, v);
      });
      const stratWeights = skillsToWeights(candidate.requiredSkills);
      const roleType: RoleType = detectRoleType(
        reqSkills as Record<string, number>,
        { ...stratWeights, ...(candidate.strategicWeights || {}) } as Record<string, number>
      );

      const algorithmInput: AlgorithmInput = {
        employee: {
          id: candidate.id,
          name: candidate.name,
          skills: empSkills,
          performanceScore: 0.5,
          learningAgility: 0.5,
          tenureYears: 0,
        },
        targetRole: {
          id: candidate.roleId,
          title: candidate.roleTitle,
          requiredSkills: reqSkills,
          strategicWeights: stratWeights,
        },
        allRoles: [{ requiredSkills: reqSkills }],
      };

      // Animate steps
      for (let i = 0; i < ALGO_STEPS.length; i++) {
        setAlgoStep(i + 1);
        await new Promise(r => setTimeout(r, 400));
      }

      const fullResults = runFullAnalysis(algorithmInput);

      const momentumScoreVal = momentum?.momentum_score ?? null;
      const learningVelocity = momentum?.learning_velocity ?? null;
      const scopeTrajectory = momentum?.scope_trajectory ?? null;
      const motivationAlignment = momentum?.motivation_alignment ?? null;

      // Compute technical match from combined CV + interview skills
      const technicalMatch = fullResults.cosineSimilarity;
      const capabilityMatch = capabilityData
        ? Object.values(capabilityData.capability_profile || {}).filter((c: any) =>
            ["DEMONSTRATED", "EXCEPTIONAL"].includes(c.rating) && c.relevance_to_role === "HIGH"
          ).length / Math.max(Object.keys(capabilityData.capability_profile || {}).length, 1)
        : 0;

      const threeLayer = computeThreeLayerScore(technicalMatch, capabilityMatch, momentumScoreVal, roleType);

      // Build updated gap analysis reflecting interview evidence
      const interviewEvidenced: string[] = [];
      const interviewIndirect: string[] = [];
      Object.entries(extractedSkills).forEach(([k, v]: [string, any]) => {
        const conf = typeof v === "object" ? v?.confidence : null;
        if (conf === "high" || (typeof v === "number" ? v >= 3 : (v?.proficiency || 0) >= 3)) {
          interviewEvidenced.push(k);
        } else {
          interviewIndirect.push(k);
        }
      });

      // Update gap analysis: remove interview-demonstrated skills from critical gaps
      const updatedGapAnalysis = { ...fullResults.gapAnalysis };
      if (updatedGapAnalysis.criticalGaps) {
        updatedGapAnalysis.criticalGaps = updatedGapAnalysis.criticalGaps.filter(
          (g: any) => !interviewEvidenced.includes(g.skill)
        );
      }

      // Step 5: Update interview record
      await supabase.from("interviews").update({
        status: "completed",
        conversation_history: messages.map(m => ({
          role: m.role,
          content: m.content,
          timestamp: m.timestamp.toISOString(),
        })) as any,
        questions_asked: questionsAsked,
        extracted_skills: extractedSkills as any,
        interview_notes: interpreted?.interview_summary || "",
        completed_at: new Date().toISOString(),
      }).eq("id", candidate.interviewId);

      // Step 6: Generate report — ensure all fields are defined, never undefined
      let reportMarkdown = "";
      try {
        const strengths = Object.entries(extractedSkills)
          .filter(([, v]: [string, any]) => {
            const conf = typeof v === "object" ? v?.confidence : null;
            return conf === "high" || (typeof v === "number" ? v >= 3 : (v?.proficiency || 0) >= 3);
          })
          .map(([k]) => k);

        const gaps = (updatedGapAnalysis.criticalGaps || []).map((g: any) => g.skill);

        const { data: reportData } = await supabase.functions.invoke("generate-report", {
          body: {
            employeeName: candidate.name || "Unknown Candidate",
            roleTitle: candidate.roleTitle || "Unknown Role",
            algorithmResults: {
              cosineSimilarity: fullResults.cosineSimilarity,
              jaccardBinary: fullResults.jaccardBinary,
              jaccardWeighted: fullResults.jaccardWeighted,
              overallReadiness: fullResults.overallReadiness,
              finalReadiness: threeLayer.threeLayerScore,
              managerAdjustment: 0,
            },
            gapAnalysis: updatedGapAnalysis,
            tfidfRarity: fullResults.tfidfRarity,
            upskillingPaths: fullResults.upskillingPaths,
            threeLayerScore: threeLayer.threeLayerScore,
            technicalMatch,
            capabilityMatch,
            momentumData: momentum || null,
            roleType,
            capabilityData: capabilityData || null,
            strengths,
            gaps,
          },
        });
        reportMarkdown = reportData?.reportMarkdown || reportData?.report_markdown || reportData?.report || "";
      } catch (e) {
        console.error("Report gen failed:", e);
      }

      // Step 7: Build evidence analysis from interview
      const absenceAnalysis = {
        well_evidenced: interviewEvidenced,
        indirect_only: interviewIndirect,
        critical_gaps: (updatedGapAnalysis.criticalGaps || []).map((g: any) => g.skill),
      };

      // Step 8: Save to external_candidates
      await supabase.from("external_candidates").update({
        status: "completed",
        interview_skills: extractedSkills as any,
        interview_notes: interpreted?.interview_summary || "",
        full_algorithm_results: {
          cosine: fullResults.cosineSimilarity,
          jaccard: { binary: fullResults.jaccardBinary, weighted: fullResults.jaccardWeighted },
          gap: updatedGapAnalysis,
          gapAnalysis: updatedGapAnalysis,
          tfidf: fullResults.tfidfRarity,
          technicalMatch,
          capabilityMatch,
          momentumScore: momentumScoreVal,
          momentumScoreVal,
          threeLayerScore: threeLayer.threeLayerScore,
          roleType,
          capabilityProfile: capabilityData?.capability_profile || {},
          transitionProfile: capabilityData?.transition_profile || {},
          gapClassification: capabilityData?.gap_classification || {},
          behavioralStrengths: capabilityData?.behavioral_strengths || [],
          momentumBreakdown: { learningVelocity, scopeTrajectory, motivationAlignment },
          reportMarkdown,
          absenceAnalysis,
          interviewCompleted: true,
          scoreBreakdown: threeLayer.breakdown,
        } as any,
        full_three_layer_score: threeLayer.threeLayerScore,
      }).eq("id", candidate.id);

      // Step 8: Evaluate for talent pool
      const meetsScoreThreshold = threeLayer.threeLayerScore >= 0.65;
      const meetsMomentumThreshold = momentumScoreVal != null && momentumScoreVal >= 0.60;
      const meetsCapabilityThreshold = capabilityMatch >= 0.50;
      const shouldAddToPool = meetsScoreThreshold && meetsMomentumThreshold && meetsCapabilityThreshold;

      if (shouldAddToPool) {
        await supabase.from("external_candidates").update({
          status: "talent_pool",
          manager_decision: "approved_for_pool",
          manager_decision_at: new Date().toISOString(),
          manager_decision_note: `Automatically promoted to talent pool after interview. Three-layer score: ${Math.round(threeLayer.threeLayerScore * 100)}%, Momentum: ${Math.round(((momentumScoreVal || 0) * 100))}%, Capability: ${Math.round(capabilityMatch * 100)}%`,
        } as any).eq("id", candidate.id);
      }

      setPhase("complete");
    } catch (err) {
      console.error("Pipeline error:", err);
      setPhase("complete");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && input.trim()) {
      e.preventDefault();
      sendMessage(input.trim());
    }
  };

  if (phase === "expired") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <h2 className="text-xl font-bold">Session Expired</h2>
            <p className="text-sm text-muted-foreground">Please use your access code to begin again.</p>
            <Button onClick={() => navigate("/interview-access")}>Return to Code Entry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!candidate) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const initials = candidate.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
  const displayQ = Math.min(Math.max(questionsAsked, 1), 12);

  // Completion overlay
  if (phase === "complete") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold">Assessment Complete</h2>
          <p className="text-sm text-muted-foreground">{candidate.name} — {candidate.roleTitle}</p>
          <p className="text-sm">Thank you for completing your SkillSight assessment. The hiring team will review your results and be in touch shortly.</p>
          <p className="text-xs text-muted-foreground italic">You may now close this window.</p>
        </div>
      </div>
    );
  }

  // Processing overlay
  if (phase === "processing") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-6 max-w-sm">
          <div className="animate-spin w-10 h-10 border-2 border-primary border-t-transparent rounded-full mx-auto" />
          <h2 className="text-xl font-bold">Processing Your Assessment</h2>
          <div className="space-y-2">
            {ALGO_STEPS.map((step, i) => {
              const Icon = step.icon;
              const done = algoStep > i;
              const active = algoStep === i;
              return (
                <div key={i} className={`flex items-center gap-3 p-2 rounded-lg transition-all ${done ? "opacity-100" : active ? "opacity-100 bg-accent" : "opacity-40"}`}>
                  <Icon className={`w-4 h-4 ${done ? "text-green-600" : "text-muted-foreground"}`} />
                  <span className="text-sm">{step.label}</span>
                  {done && <Check className="w-3 h-3 text-green-600 ml-auto" />}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left panel */}
      <div className="w-[38%] bg-secondary/50 p-6 space-y-4 hidden lg:block overflow-y-auto">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-primary flex items-center justify-center text-sm font-bold text-primary-foreground">
                {initials}
              </div>
              <div>
                <p className="text-[15px] font-bold">{candidate.name}</p>
                <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary">
                  Applying for: {candidate.roleTitle}
                </span>
              </div>
            </div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-3">
              EXTERNAL CANDIDATE ASSESSMENT
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Question {displayQ} of 12</span>
              <span className="text-muted-foreground">{Math.round((displayQ / 12) * 100)}%</span>
            </div>
            <Progress value={(displayQ / 12) * 100} className="h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-2">
            <p className="text-sm font-medium">About this interview</p>
            <p className="text-xs text-muted-foreground">This is a structured conversation about your real experience.</p>
            <p className="text-xs text-muted-foreground">Describe specific projects and situations you have been part of.</p>
            <p className="text-xs text-muted-foreground">There are no trick questions. Concrete examples matter more than perfect answers.</p>
          </CardContent>
        </Card>
      </div>

      {/* Right panel - chat */}
      <div className="flex-1 flex flex-col">
        <div className="border-b px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <span className="font-bold text-sm">SkillSight Assessment Interview</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{candidate.name}</span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-secondary text-muted-foreground">External Candidate</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-lg px-4 py-3 text-sm whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
              }`}>
                {msg.content}
              </div>
            </div>
          ))}
          {isAiTyping && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg px-4 py-3 text-sm">
                <span className="animate-pulse">Thinking...</span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="border-t p-4">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your response..."
              className="flex-1 h-10 px-4 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <Button
              size="icon"
              onClick={() => input.trim() && sendMessage(input.trim())}
              disabled={!input.trim() || isAiTyping}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          {/* Mobile progress */}
          <div className="lg:hidden mt-2">
            <Progress value={(displayQ / 12) * 100} className="h-1" />
            <p className="text-[10px] text-muted-foreground mt-1">Question {displayQ} of 12</p>
          </div>
        </div>
      </div>
    </div>
  );
}
