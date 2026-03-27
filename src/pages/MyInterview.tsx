import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useEmployee, useInterviews, useRoles } from "@/hooks/useData";
import { supabase } from "@/integrations/supabase/client";
import { runFullAnalysis, type AlgorithmInput, type SkillVector } from "@/lib/algorithms";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, MessageSquare, Check, Sparkles, Brain, BarChart3, FileText, Cpu, Target, Shield } from "lucide-react";

interface Message {
  role: "ai" | "user";
  content: string;
  timestamp: Date;
}

type PipelinePhase = "idle" | "extracting" | "algorithms" | "generating" | "complete";

const ALGORITHM_STEPS = [
  { icon: Target, label: "Cosine Similarity" },
  { icon: Shield, label: "Jaccard Analysis" },
  { icon: BarChart3, label: "Weighted Gap Score" },
  { icon: Sparkles, label: "TF-IDF Rarity" },
  { icon: Brain, label: "Dijkstra Pathfinding" },
  { icon: Cpu, label: "Overall Readiness" },
];

export default function MyInterview() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const employeeId = profile?.employee_id;
  const { data: employee, isLoading: empLoading } = useEmployee(employeeId || undefined);
  const { data: interviews, isLoading: intLoading } = useInterviews(employeeId || undefined);
  const { data: roles } = useRoles();

  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationHistory, setConversationHistory] = useState<{role: string, content: string}[]>([]);
  const [input, setInput] = useState("");
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [questionsAsked, setQuestionsAsked] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [started, setStarted] = useState(false);
  const [pipelinePhase, setPipelinePhase] = useState<PipelinePhase>("idle");
  const [algoStep, setAlgoStep] = useState(0);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const displayedQuestionNumber = Math.min(Math.max(questionsAsked, 1), 12);

  const activeInterview = interviews?.find(
    i => i.interview_type === "employee" && i.status === "in_progress"
  );

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isAiTyping]);

  const sendMessage = useCallback(
    async (userMessage?: string) => {
      if (!employee || !activeInterview) return;

      if (questionsAsked >= 12) {
        await handleComplete(null, messages, questionsAsked);
        return;
      }

      const newHistory = userMessage
        ? [...conversationHistory, { role: "user", content: userMessage }]
        : conversationHistory;

      const newMessages = userMessage
        ? [...messages, { role: "user" as const, content: userMessage, timestamp: new Date() }]
        : messages;

      if (userMessage) {
        setMessages(newMessages);
        setConversationHistory(newHistory);
        setInput("");
      }

      setIsAiTyping(true);
      try {
        const targetSkills = Object.keys((activeInterview as any).extracted_skills || {});
        const { data, error } = await supabase.functions.invoke("interview-chat", {
          body: {
            messages: newHistory.map(m => ({ role: m.role === "assistant" ? "ai" : m.role, content: m.content })),
            interviewType: "employee",
            employeeName: employee.name,
            employeeTitle: employee.job_title,
            roleName: "your next career step",
            targetSkills,
          },
        });

        if (error) throw error;

        const aiMsg: Message = { role: "ai", content: data.message, timestamp: new Date() };
        const questionDelta = typeof data.questionDelta === "number" ? data.questionDelta : 1;
        const nextQuestionsAsked = questionsAsked + questionDelta;

        setMessages(prev => [...prev, aiMsg]);
        const historyWithReply = [...newHistory, { role: "ai", content: data.message }];
        setConversationHistory(historyWithReply);
        setQuestionsAsked(nextQuestionsAsked);

        if (data.isComplete && data.extractedData) {
          await handleComplete(data.extractedData, [...newMessages, aiMsg], nextQuestionsAsked);
        } else if (nextQuestionsAsked >= 12) {
          setTimeout(() => handleComplete(data.extractedData || null, [...newMessages, aiMsg], nextQuestionsAsked), 1500);
        }
      } catch (err) {
        console.error("Interview chat error:", err);
        const errorMsg: Message = { role: "ai", content: "I apologize, there was a technical issue. Could you please repeat that?", timestamp: new Date() };
        setMessages(prev => [...prev, errorMsg]);
        setConversationHistory(prev => [...prev, { role: "ai", content: errorMsg.content }]);
      } finally {
        setIsAiTyping(false);
      }
    },
    [employee, activeInterview, messages, conversationHistory, questionsAsked]
  );

  const handleComplete = async (extractedData: any, finalMessages?: Message[], finalQuestionCount?: number) => {
    if (!activeInterview || !employeeId || !employee) return;
    const msgs = finalMessages || messages;
    const qCount = finalQuestionCount ?? questionsAsked;

    try {
      // Phase 1: Extracting skills from transcript
      setPipelinePhase("extracting");

      const historyForInterpret = msgs.map(m => ({
        role: m.role === "ai" ? "assistant" : "user",
        content: m.content,
      }));

      const targetRole = roles?.find(r => r.id === activeInterview.target_role_id);

      // Fetch existing skills for context
      const { data: existingSkills } = await supabase
        .from("employee_skills")
        .select("skill_name, proficiency")
        .eq("employee_id", employeeId);

      const existingSkillsMap: Record<string, number> = {};
      existingSkills?.forEach(s => { existingSkillsMap[s.skill_name] = s.proficiency || 0; });

      const { data: interpretResult, error: interpretError } = await supabase.functions.invoke("interpret-interview", {
        body: {
          conversationHistory: historyForInterpret,
          employeeName: employee.name,
          employeeRole: employee.job_title || "Employee",
          targetRole: targetRole?.title || "Target Role",
          existingSkills: existingSkillsMap,
        },
      });

      if (interpretError) {
        console.error("Interpret error:", interpretError);
      }

      const interpreted = interpretResult?.interpreted;
      const mergedExtracted = interpreted?.extracted_skills || extractedData?.extracted_skills || {};
      const newSkillsDiscovered = interpreted?.new_skills_discovered || [];
      const interviewSummary = interpreted?.interview_summary || "";

      // Phase 2: Save completed interview
      await supabase
        .from("interviews")
        .update({
          status: "completed",
          conversation_history: msgs.map(m => ({
            role: m.role,
            content: m.content,
            timestamp: m.timestamp.toISOString(),
          })) as any,
          questions_asked: qCount,
          extracted_skills: mergedExtracted as any,
          unexpected_skills: newSkillsDiscovered as any,
          interview_notes: interviewSummary,
          completed_at: new Date().toISOString(),
        })
        .eq("id", activeInterview.id);

      // Phase 3: Upsert skills
      for (const [skillName, skillData] of Object.entries(mergedExtracted) as [string, any][]) {
        await supabase.from("employee_skills").upsert(
          {
            employee_id: employeeId,
            skill_name: skillName,
            proficiency: skillData.proficiency,
            source: "employee_interview",
            evidence: skillData.evidence,
            confidence: skillData.confidence || "medium",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "employee_id,skill_name" }
        );
      }

      // Phase 4: Algorithms animation
      setPipelinePhase("algorithms");
      
      // Fetch fresh merged skills
      const { data: freshSkills } = await supabase
        .from("employee_skills")
        .select("*")
        .eq("employee_id", employeeId);

      const empSkills: SkillVector = {};
      freshSkills?.forEach(s => { empSkills[s.skill_name] = s.proficiency || 0; });

      // Fetch all roles for TF-IDF
      const { data: allRoles } = await supabase.from("roles").select("*");

      if (!targetRole) {
        console.error("No target role found");
        setPipelinePhase("complete");
        setCompleted(true);
        return;
      }

      const algorithmInput: AlgorithmInput = {
        employee: {
          id: employee.id,
          name: employee.name,
          skills: empSkills,
          performanceScore: employee.performance_score || 0.5,
          learningAgility: employee.learning_agility || 0.5,
          tenureYears: employee.tenure_years || 0,
        },
        targetRole: {
          id: targetRole.id,
          title: targetRole.title,
          requiredSkills: (targetRole.required_skills || {}) as SkillVector,
          strategicWeights: (targetRole.strategic_weights || {}) as SkillVector,
        },
        allRoles: allRoles?.map(r => ({ requiredSkills: (r.required_skills || {}) as SkillVector })),
      };

      // Animate algorithm steps
      for (let i = 0; i < ALGORITHM_STEPS.length; i++) {
        setAlgoStep(i);
        await new Promise(resolve => setTimeout(resolve, 600));
      }

      const results = runFullAnalysis(algorithmInput);

      // Phase 5: Save algorithm results
      await supabase.from("algorithm_results").upsert(
        {
          employee_id: employeeId,
          role_id: targetRole.id,
          employee_interview_id: activeInterview.id,
          cosine_similarity: results.cosineSimilarity,
          jaccard_binary: results.jaccardBinary,
          jaccard_weighted: results.jaccardWeighted,
          normalized_gap_score: results.gapAnalysis.normalizedGapScore,
          overall_readiness: results.overallReadiness,
          final_readiness: results.overallReadiness,
          manager_readiness_adjustment: 0,
          gap_analysis: results.gapAnalysis as any,
          tfidf_rarity: results.tfidfRarity as any,
          upskilling_paths: results.upskillingPaths as any,
          ahp_data: {} as any,
          computed_at: new Date().toISOString(),
        },
        { onConflict: "employee_id,role_id" }
      );

      // Phase 6: Generate report
      setPipelinePhase("generating");

      try {
        const { data: reportData } = await supabase.functions.invoke("generate-report", {
          body: {
            employeeName: employee.name,
            roleTitle: targetRole.title,
            algorithmResults: {
              cosineSimilarity: results.cosineSimilarity,
              jaccardBinary: results.jaccardBinary,
              jaccardWeighted: results.jaccardWeighted,
              overallReadiness: results.overallReadiness,
              finalReadiness: results.overallReadiness,
              managerAdjustment: 0,
            },
            gapAnalysis: results.gapAnalysis,
            tfidfRarity: results.tfidfRarity,
            upskillingPaths: results.upskillingPaths,
          },
        });

        if (reportData?.report) {
          await supabase.from("reports").upsert(
            {
              employee_id: employeeId,
              role_id: targetRole.id,
              algorithm_result_id: null,
              report_markdown: reportData.report,
              generated_at: new Date().toISOString(),
            },
            { onConflict: "employee_id,role_id" }
          );
        }
      } catch (e) {
        console.error("Report generation failed (non-blocking):", e);
      }

      // Phase 7: Complete → redirect
      setPipelinePhase("complete");
      setCompleted(true);

      setTimeout(() => {
        navigate(`/analysis/${employeeId}`);
      }, 2000);
    } catch (e: any) {
      console.error("Pipeline error:", e);
      setPipelinePhase("complete");
      setCompleted(true);
    }
  };

  const beginInterview = () => {
    setStarted(true);
    setTimeout(() => sendMessage(), 300);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && input.trim() && !isAiTyping) {
      e.preventDefault();
      sendMessage(input.trim());
    }
  };

  if (empLoading || intLoading) {
    return <div className="flex items-center justify-center h-64"><LoadingSpinner /></div>;
  }

  if (!activeInterview) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-48px)]">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-lg font-bold mb-2">No Active Interview</h2>
            <p className="text-sm text-muted-foreground">
              Your manager will invite you to complete your career discovery interview.
              You'll receive access here when it's ready.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Pipeline overlay
  if (pipelinePhase !== "idle") {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-48px)]">
        <Card className="max-w-lg w-full">
          <CardContent className="p-8">
            {pipelinePhase === "extracting" && (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto animate-pulse">
                  <Brain className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-lg font-bold">Analysing Your Responses</h2>
                <p className="text-sm text-muted-foreground">
                  Our AI is reading through your conversation to identify demonstrated skills and evidence…
                </p>
              </div>
            )}

            {pipelinePhase === "algorithms" && (
              <div className="space-y-4">
                <div className="text-center mb-6">
                  <h2 className="text-lg font-bold">Running Algorithms</h2>
                  <p className="text-sm text-muted-foreground">Computing your skills profile against the target role…</p>
                </div>
                <div className="space-y-3">
                  {ALGORITHM_STEPS.map((step, i) => {
                    const Icon = step.icon;
                    const isDone = i < algoStep;
                    const isActive = i === algoStep;
                    return (
                      <div key={i} className={`flex items-center gap-3 p-3 rounded-lg transition-all ${isActive ? "bg-primary/10 border border-primary/20" : isDone ? "bg-muted/50" : "opacity-40"}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isDone ? "bg-primary text-white" : isActive ? "bg-primary/20 text-primary animate-pulse" : "bg-muted text-muted-foreground"}`}>
                          {isDone ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                        </div>
                        <span className={`text-sm font-medium ${isDone || isActive ? "text-foreground" : "text-muted-foreground"}`}>{step.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {pipelinePhase === "generating" && (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto animate-pulse">
                  <FileText className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-lg font-bold">Generating Report</h2>
                <p className="text-sm text-muted-foreground">
                  Creating your personalised skills assessment report…
                </p>
              </div>
            )}

            {pipelinePhase === "complete" && (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-status-green flex items-center justify-center mx-auto">
                  <Check className="h-8 w-8 text-white" />
                </div>
                <h2 className="text-lg font-bold">Analysis Complete</h2>
                <p className="text-sm text-muted-foreground">
                  Redirecting to your results…
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-48px)]">
      {/* Left panel */}
      <div className="w-[300px] p-6 flex flex-col gap-4 border-r border-border bg-secondary/30 shrink-0">
        <div className="card-skillsight p-4">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold text-white"
              style={{ backgroundColor: employee?.avatar_color || "#1c69d3" }}
            >
              {employee?.avatar_initials}
            </div>
            <div>
              <p className="text-base font-bold">{employee?.name}</p>
              <p className="text-[13px] text-muted-foreground">{employee?.job_title}</p>
            </div>
          </div>
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground mt-3">
            Career Development Session
          </p>
        </div>

        {started && (
          <div className="card-skillsight p-3">
            <p className="text-[13px] font-semibold">Question {displayedQuestionNumber} / 12</p>
            <div className="h-1 rounded-full bg-secondary mt-2 overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${(questionsAsked / 12) * 100}%` }}
              />
            </div>
          </div>
        )}

        <div className="card-skillsight p-4 flex-1">
          <Sparkles className="h-5 w-5 text-primary mb-2" />
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            This conversation will help SkillSight discover your hidden strengths.
            Just answer honestly — there are no wrong answers.
          </p>
        </div>
      </div>

      {/* Right panel — Chat */}
      <div className="flex-1 flex flex-col">
        <div className="border-b border-border px-6 py-4 flex items-center gap-2 shrink-0">
          <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
            <span className="text-[8px] font-bold text-white">S</span>
          </div>
          <span className="text-sm font-semibold">SkillSight AI</span>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {!started && (
            <div className="flex items-center justify-center h-full">
              <button
                onClick={beginInterview}
                className="px-6 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors"
              >
                Begin Interview
              </button>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  msg.role === "user"
                    ? "bg-primary text-white rounded-br-sm"
                    : "bg-background border border-border rounded-bl-sm shadow-sm"
                }`}
              >
                <p className="text-sm leading-relaxed">{msg.content}</p>
                <p className={`text-[10px] mt-1 ${msg.role === "user" ? "text-white/70" : "text-muted-foreground"}`}>
                  {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          ))}

          {isAiTyping && (
            <div className="flex justify-start">
              <div className="bg-background border border-border rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {started && !completed && (
          <div className="border-t border-border px-6 py-4 shrink-0">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isAiTyping}
                placeholder="Type your response..."
                className="flex-1 px-4 py-3 text-sm border border-border rounded-lg bg-background focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10 disabled:opacity-50"
              />
              <button
                onClick={() => input.trim() && sendMessage(input.trim())}
                disabled={isAiTyping || !input.trim()}
                className="w-10 h-10 rounded-lg bg-primary text-white flex items-center justify-center disabled:opacity-40 hover:bg-primary/90 transition-colors shrink-0"
              >
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
