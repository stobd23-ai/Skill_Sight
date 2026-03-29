import { useState, useRef, useEffect, useCallback } from "react";
import { EmployeeSelector } from "@/components/EmployeeSelector";
import { useParams, useNavigate } from "react-router-dom";
import { useEmployee, useRoles } from "@/hooks/useData";
import { supabase } from "@/integrations/supabase/client";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, UserCheck, Check, ArrowLeft, Star, Eye, AlertTriangle } from "lucide-react";
import { usePipeline } from "@/contexts/PipelineContext";
import { useAuth } from "@/contexts/AuthContext";

type Phase = "setup" | "interviewing" | "algorithms_running" | "complete";
interface Message { role: "ai" | "user"; content: string; timestamp: Date }

export default function ManagerInterview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: employee, isLoading } = useEmployee(id);
  const { data: roles } = useRoles();

  const { profile } = useAuth();

  const [phase, setPhase] = useState<Phase>("setup");
  const [managerName, setManagerName] = useState(profile?.full_name || "");
  const [managerTitle, setManagerTitle] = useState(profile?.role === "manager" ? "Manager" : "");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [questionsAsked, setQuestionsAsked] = useState(0);
  const [potentialIndicators, setPotentialIndicators] = useState<string[]>([]);
  const [hiddenSkills, setHiddenSkills] = useState<string[]>([]);
  const [concerns, setConcerns] = useState<string[]>([]);
  const [confidenceScore, setConfidenceScore] = useState<number | null>(null);
  const [algorithmSteps, setAlgorithmSteps] = useState(0);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isAiTyping]);

  const MAX_QUESTIONS = 10;

  const sendMessage = useCallback(async (userMessage?: string) => {
    if (!employee) return;

    const newMessages = userMessage
      ? [...messages, { role: "user" as const, content: userMessage, timestamp: new Date() }]
      : messages;

    if (userMessage) {
      setMessages(newMessages);
      setInput("");
    }

    // If we've hit the question limit, force completion
    const currentCount = questionsAsked + 1;
    if (currentCount > MAX_QUESTIONS && userMessage) {
      setIsAiTyping(true);
      const closingMsg = "Thank you for sharing all of that — I have a thorough picture now. Let me compile everything into the assessment.";
      const finalMessages = [...newMessages, { role: "ai" as const, content: closingMsg, timestamp: new Date() }];
      setMessages(finalMessages);
      setQuestionsAsked(currentCount);

      // Invoke one final time with forceComplete flag to get extracted data
      try {
        const { data, error } = await supabase.functions.invoke("interview-chat", {
          body: {
            messages: finalMessages.map(m => ({ role: m.role, content: m.content })),
            interviewType: "manager",
            employeeName: employee.name,
            employeeTitle: employee.job_title,
            managerName,
            forceComplete: true,
          },
        });
        if (!error && data?.extractedData?.manager_assessment) {
          await handleComplete(data.extractedData.manager_assessment, finalMessages);
        } else {
          // Fallback: complete with empty assessment
          await handleComplete({
            observed_skills: {},
            potential_indicators: [],
            concerns: [],
            learning_agility_observed: null,
            leadership_potential_observed: null,
            manager_confidence_score: null,
            hidden_role_suggestion: null,
          }, finalMessages);
        }
      } catch {
        await handleComplete({
          observed_skills: {},
          potential_indicators: [],
          concerns: [],
        }, finalMessages);
      } finally {
        setIsAiTyping(false);
      }
      return;
    }

    setIsAiTyping(true);
    try {
      const { data, error } = await supabase.functions.invoke("interview-chat", {
        body: {
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          interviewType: "manager",
          employeeName: employee.name,
          employeeTitle: employee.job_title,
          managerName,
          questionNumber: currentCount,
          maxQuestions: MAX_QUESTIONS,
        },
      });

      if (error) throw error;

      setMessages(prev => [...prev, { role: "ai", content: data.message, timestamp: new Date() }]);
      setQuestionsAsked(currentCount);

      if (data.isComplete && data.extractedData?.manager_assessment) {
        const assessment = data.extractedData.manager_assessment;
        await handleComplete(assessment, [...newMessages, { role: "ai" as const, content: data.message, timestamp: new Date() }]);
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: "ai", content: "Technical issue — could you repeat that?", timestamp: new Date() }]);
    } finally {
      setIsAiTyping(false);
    }
  }, [employee, messages, managerName, questionsAsked]);

  const pipeline = usePipeline();

  const handleComplete = async (assessment: any, finalMessages: Message[]) => {
    // Save interview
    const { data: interview } = await supabase.from("interviews").insert({
      employee_id: id,
      interview_type: "manager",
      interviewer_name: managerName,
      interviewer_title: managerTitle,
      status: "completed",
      conversation_history: finalMessages.map(m => ({ role: m.role, content: m.content, timestamp: m.timestamp.toISOString() })) as any,
      questions_asked: questionsAsked,
      extracted_skills: assessment.observed_skills || {} as any,
      potential_indicators: assessment.potential_indicators || [] as any,
      concerns: assessment.concerns || [] as any,
      learning_agility_observed: assessment.learning_agility_observed,
      leadership_potential_observed: assessment.leadership_potential_observed,
      manager_confidence_score: assessment.manager_confidence_score,
      hidden_role_suggestion: assessment.hidden_role_suggestion,
      completed_at: new Date().toISOString(),
    }).select().single();

    // Merge observed skills
    if (assessment.observed_skills) {
      for (const [skillName, skillData] of Object.entries(assessment.observed_skills) as [string, any][]) {
        await supabase.from("employee_skills").upsert({
          employee_id: id!,
          skill_name: skillName,
          proficiency: skillData.proficiency,
          source: "manager_interview",
          evidence: skillData.evidence,
          updated_at: new Date().toISOString(),
        }, { onConflict: "employee_id,skill_name" });
      }
    }

    // Run algorithm animation
    setPhase("algorithms_running");
    for (let i = 1; i <= 6; i++) {
      await new Promise(r => setTimeout(r, 300));
      setAlgorithmSteps(i);
    }

    // Find the target role from existing algorithm results
    const { data: existingResult } = await supabase.from("algorithm_results")
      .select("role_id").eq("employee_id", id!).order("computed_at", { ascending: false }).limit(1).maybeSingle();
    const targetRoleId = existingResult?.role_id;

    // Trigger full pipeline (algorithms + report + bootcamp)
    if (id && targetRoleId && interview) {
      pipeline.completePipeline({
        employeeId: id,
        roleId: targetRoleId,
        interviewId: interview.id,
        interviewType: 'manager',
        extractedSkills: assessment.observed_skills || {},
        managerInsights: assessment,
      }).catch(console.error);
    }

    await new Promise(r => setTimeout(r, 800));
    setPhase("complete");
    setTimeout(() => navigate(`/analysis/${id}`), 3000);
  };

  const beginInterview = () => {
    if (!managerName.trim() || !managerTitle.trim()) return;
    setPhase("interviewing");
    setTimeout(() => sendMessage(), 300);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && input.trim() && !isAiTyping) {
      e.preventDefault();
      sendMessage(input.trim());
    }
  };

  if (!id) {
    return <EmployeeSelector title="Manager Interview" subtitle="Select an employee to discuss" navigateTo="/interview/manager" />;
  }
  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><LoadingSpinner /></div>;
  if (!employee) return <div className="min-h-screen flex items-center justify-center"><p>Employee not found</p></div>;

  const algorithmLabels = ["Cosine Similarity Analysis", "Jaccard Skill Coverage", "Weighted Gap Scoring", "TF-IDF Rarity Mapping", "Pathfinding Optimisation", "AHP Succession Ranking"];

  return (
    <div className="min-h-screen flex bg-secondary">
      {/* Left panel */}
      <div className="w-[38%] p-6 flex flex-col gap-4 overflow-y-auto">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground w-fit">
          <ArrowLeft className="h-3 w-3" /> Back
        </button>

        <div className="card-skillsight p-4">
          <p className="text-base font-bold">Manager Conversation</p>
          <p className="text-[13px] text-muted-foreground">About {employee.name}</p>
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground mt-2">Confidential Assessment</p>
        </div>

        {phase === "setup" && (
          <div className="card-skillsight p-4 space-y-3">
            <label className="text-xs font-medium">Manager Name *</label>
            <Input value={managerName} onChange={e => setManagerName(e.target.value)} placeholder="Your name" className="h-9 text-sm" />
            <label className="text-xs font-medium">Manager Title *</label>
            <Input value={managerTitle} onChange={e => setManagerTitle(e.target.value)} placeholder="Your title" className="h-9 text-sm" />
            <Button onClick={beginInterview} disabled={!managerName.trim() || !managerTitle.trim()} className="w-full">Begin Conversation</Button>
          </div>
        )}

        {phase === "interviewing" && (
          <>
            <div className="card-skillsight p-3">
             <p className="text-[13px] font-semibold">Question {Math.min(questionsAsked, MAX_QUESTIONS)} / {MAX_QUESTIONS}</p>
              <div className="h-1 rounded-full bg-secondary mt-2 overflow-hidden">
                <div className="h-full bg-bmw-blue rounded-full transition-all" style={{ width: `${Math.min((questionsAsked / MAX_QUESTIONS) * 100, 100)}%` }} />
              </div>
            </div>

            <div className="card-skillsight p-4 flex-1">
              <h3 className="text-[13px] font-semibold mb-3">Insights Discovered</h3>

              {confidenceScore !== null && (
                <div className="mb-3 p-3 bg-secondary rounded-lg">
                  <p className="text-[10px] text-muted-foreground mb-1">Manager Confidence</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full bg-border overflow-hidden">
                      <div className="h-full bg-bmw-blue rounded-full transition-all" style={{ width: `${confidenceScore * 10}%` }} />
                    </div>
                    <span className="text-xs font-mono font-semibold">{confidenceScore}/10</span>
                  </div>
                </div>
              )}

              {[
                { items: potentialIndicators, icon: Star, color: "text-amber-500", label: "Potential Indicators" },
                { items: hiddenSkills, icon: Eye, color: "text-purple-500", label: "Hidden Skills" },
                { items: concerns, icon: AlertTriangle, color: "text-status-amber", label: "Concerns" },
              ].map(section => section.items.length > 0 && (
                <div key={section.label} className="mb-3">
                  <p className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1 mb-1">
                    <section.icon className={`h-3 w-3 ${section.color}`} /> {section.label}
                  </p>
                  {section.items.map((item, i) => (
                    <p key={i} className="text-[11px] text-muted-foreground pl-4">• {item}</p>
                  ))}
                </div>
              ))}

              {potentialIndicators.length === 0 && hiddenSkills.length === 0 && concerns.length === 0 && (
                <p className="text-xs text-muted-foreground italic">Insights will appear as the conversation progresses...</p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Right panel */}
      <div className="flex-1 bg-background flex flex-col relative">
        {phase === "algorithms_running" && (
          <div className="absolute inset-0 bg-background z-20 flex items-center justify-center">
            <div className="text-center max-w-sm">
              <div className="w-10 h-10 rounded-lg bg-bmw-blue flex items-center justify-center mx-auto mb-4">
                <span className="text-[8px] font-bold text-white">BMW</span>
              </div>
              <h2 className="text-xl font-bold mb-6">Analysing Skills Intelligence</h2>
              <div className="space-y-3 text-left">
                {algorithmLabels.map((label, i) => (
                  <div key={label} className={`flex items-center gap-3 text-sm transition-all duration-300 ${i < algorithmSteps ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {i < algorithmSteps ? <Check className="h-4 w-4 text-status-green shrink-0" /> : <div className="w-4 h-4 shrink-0" />}
                    {label}
                  </div>
                ))}
              </div>
              {algorithmSteps >= 6 && (
                <div className="flex items-center gap-2 justify-center mt-6 text-sm text-muted-foreground animate-fade-in">
                  <LoadingSpinner variant="inline" /> Generating personalised action plan...
                </div>
              )}
            </div>
          </div>
        )}

        {phase === "complete" && (
          <div className="absolute inset-0 bg-background z-20 flex items-center justify-center">
            <div className="text-center animate-fade-in">
              <div className="w-16 h-16 rounded-full bg-status-green flex items-center justify-center mx-auto mb-4">
                <Check className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-xl font-bold">Assessment Complete</h2>
              <p className="text-sm text-muted-foreground mt-1">{employee.name}</p>
              <p className="text-xs text-muted-foreground mt-4">Redirecting to results...</p>
              <div className="w-48 h-1 rounded-full bg-secondary mx-auto mt-2 overflow-hidden">
                <div className="h-full bg-bmw-blue rounded-full" style={{ animation: 'grow 3s linear forwards', width: '0%' }} />
              </div>
            </div>
          </div>
        )}

        {/* Chat header */}
        <div className="border-b border-border px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-bmw-blue flex items-center justify-center"><UserCheck className="h-3 w-3 text-white" /></div>
            <span className="text-sm font-semibold">Manager Interview — re: {employee.name}</span>
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${msg.role === "user" ? "bg-bmw-blue text-white rounded-br-sm" : "bg-background border border-border rounded-bl-sm shadow-skillsight"}`}>
                <p className="text-sm leading-relaxed">{msg.content}</p>
                <p className={`text-[10px] mt-1 ${msg.role === "user" ? "text-white/70" : "text-muted-foreground"}`}>
                  {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          ))}
          {isAiTyping && (
            <div className="flex justify-start">
              <div className="bg-background border border-border rounded-2xl rounded-bl-sm px-4 py-3 shadow-skillsight">
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

        {/* Input */}
        {phase === "interviewing" && (
          <div className="border-t border-border px-6 py-4 shrink-0">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isAiTyping}
                placeholder="Type your response..."
                className="flex-1 px-4 py-3 text-sm border border-border rounded-lg bg-background focus:border-bmw-blue focus:outline-none focus:ring-[3px] focus:ring-bmw-blue/10 disabled:opacity-50"
              />
              <button onClick={() => input.trim() && sendMessage(input.trim())} disabled={isAiTyping || !input.trim()} className="w-10 h-10 rounded-lg bg-bmw-blue text-white flex items-center justify-center disabled:opacity-40 hover:bg-bmw-blue-hover transition-colors shrink-0">
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes grow { from { width: 0%; } to { width: 100%; } }
      `}</style>
    </div>
  );
}
