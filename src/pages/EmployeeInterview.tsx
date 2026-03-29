import { useState, useRef, useEffect, useCallback } from "react";
import { EmployeeSelector } from "@/components/EmployeeSelector";
import { useParams, useNavigate } from "react-router-dom";
import { useEmployee, useRoles, useEmployeeSkills } from "@/hooks/useData";
import { supabase } from "@/integrations/supabase/client";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { SkillBadge } from "@/components/SkillBadge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, Check, ArrowLeft } from "lucide-react";
import { usePipeline } from "@/contexts/PipelineContext";

type Phase = "role_selection" | "interviewing" | "algorithms_running" | "complete";
interface Message { role: "ai" | "user"; content: string; timestamp: Date }

export default function EmployeeInterview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: employee, isLoading } = useEmployee(id);
  const { data: roles } = useRoles();
  const { data: existingSkills } = useEmployeeSkills(id);

  const [phase, setPhase] = useState<Phase>("role_selection");
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [questionsAsked, setQuestionsAsked] = useState(0);
  const [discoveredSkills, setDiscoveredSkills] = useState<any[]>([]);
  const [interviewId, setInterviewId] = useState<string | null>(null);
  const [algorithmSteps, setAlgorithmSteps] = useState<number>(0);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const selectedRole = roles?.find(r => r.id === selectedRoleId);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isAiTyping]);

  const sendMessage = useCallback(async (userMessage?: string) => {
    if (!employee || !selectedRole) return;

    const newMessages = userMessage
      ? [...messages, { role: "user" as const, content: userMessage, timestamp: new Date() }]
      : messages;

    if (userMessage) {
      setMessages(newMessages);
      setInput("");
    }

    setIsAiTyping(true);

    try {
      const parsedSkills = parseRequiredSkills(selectedRole.required_skills as any);
      const targetSkills = parsedSkills.map(s => s.name);
      const { data, error } = await supabase.functions.invoke("interview-chat", {
        body: {
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          interviewType: "employee",
          employeeName: employee.name,
          employeeTitle: employee.job_title,
          roleName: selectedRole.title,
          targetSkills,
          presetPack: null,
        },
      });

      if (error) throw error;

      const aiMsg: Message = { role: "ai", content: data.message, timestamp: new Date() };
      const questionDelta = typeof data.questionDelta === "number" ? data.questionDelta : 1;
      const nextQuestionsAsked = Math.min(questionsAsked + questionDelta, 12);

      setMessages(prev => [...prev, aiMsg]);
      setQuestionsAsked(nextQuestionsAsked);

      if (data.isComplete && data.extractedData) {
        await handleInterviewComplete(data.extractedData, [...newMessages, aiMsg], nextQuestionsAsked);
      } else if (data.extractedData?.extracted_skills) {
        updateDiscoveredSkills(data.extractedData.extracted_skills);
      }
    } catch (err) {
      console.error("Interview chat error:", err);
      setMessages(prev => [...prev, { role: "ai", content: "I apologize, there was a technical issue. Could you please repeat that?", timestamp: new Date() }]);
    } finally {
      setIsAiTyping(false);
    }
  }, [employee, selectedRole, messages, questionsAsked]);

  const displayedQuestionNumber = Math.min(Math.max(questionsAsked, 1), 12);

  const updateDiscoveredSkills = (skills: Record<string, any>) => {
    const newSkills = Object.entries(skills).map(([name, data]: [string, any]) => ({
      name,
      proficiency: data.proficiency || 1,
      evidence: data.evidence || "",
      confidence: data.confidence || "medium",
    }));
    setDiscoveredSkills(newSkills);
  };

  const pipeline = usePipeline();

  const handleInterviewComplete = async (extractedData: any, finalMessages: Message[], finalQuestionCount: number) => {
    const { data: interview } = await supabase.from("interviews").insert({
      employee_id: id,
      target_role_id: selectedRoleId,
      interview_type: "employee",
      status: "completed",
      conversation_history: finalMessages.map(m => ({ role: m.role, content: m.content, timestamp: m.timestamp.toISOString() })) as any,
      questions_asked: finalQuestionCount,
      extracted_skills: extractedData.extracted_skills || {} as any,
      unexpected_skills: extractedData.unexpected_skills || [] as any,
      insufficient_evidence: extractedData.insufficient_evidence || [] as any,
      completed_at: new Date().toISOString(),
    }).select().single();

    if (interview) setInterviewId(interview.id);

    // Merge extracted skills into employee_skills
    if (extractedData.extracted_skills) {
      for (const [skillName, skillData] of Object.entries(extractedData.extracted_skills) as [string, any][]) {
        await supabase.from("employee_skills").upsert({
          employee_id: id!,
          skill_name: skillName,
          proficiency: skillData.proficiency,
          source: "employee_interview",
          evidence: skillData.evidence,
          confidence: skillData.confidence,
          updated_at: new Date().toISOString(),
        }, { onConflict: "employee_id,skill_name" });
      }
    }

    // Run full auto-pipeline: algorithms → report → navigate
    setPhase("algorithms_running");
    for (let i = 1; i <= 6; i++) {
      await new Promise(r => setTimeout(r, 300));
      setAlgorithmSteps(i);
    }

    // Trigger pipeline in background
    if (id && selectedRoleId && interview) {
      pipeline.completePipeline({
        employeeId: id,
        roleId: selectedRoleId,
        interviewId: interview.id,
        interviewType: 'employee',
        extractedSkills: extractedData.extracted_skills || {},
      }).catch(console.error);
    }

    await new Promise(r => setTimeout(r, 800));
    setPhase("complete");
    setTimeout(() => navigate(`/analysis/${id}`), 3000);
  };

  const beginInterview = async () => {
    if (!selectedRoleId) return;
    setPhase("interviewing");
    // Send initial empty message to get AI greeting
    setTimeout(() => sendMessage(), 300);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && input.trim() && !isAiTyping) {
      e.preventDefault();
      sendMessage(input.trim());
    }
  };

  if (!id) {
    return <EmployeeSelector title="Employee Interview" subtitle="Select an employee to invite for an interview" navigateTo="/employees" />;
  }

  // Redirect managers to use invitation flow on employee profile
  return (
    <div className="flex items-center justify-center h-[70vh]">
      <div className="card-skillsight p-8 max-w-md text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
          <ArrowRight className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-lg font-bold">Use the Invitation Flow</h2>
        <p className="text-sm text-muted-foreground">Employee interviews are now started via invitation. Go to the employee's profile and click "Invite to Interview" to select a focus pack and send the invitation.</p>
        <Button onClick={() => navigate(`/employees/${id}`)}>Go to Employee Profile →</Button>
      </div>
    </div>
  );

  const algorithmLabels = ["Cosine Similarity Analysis", "Jaccard Skill Coverage", "Weighted Gap Scoring", "TF-IDF Rarity Mapping", "Pathfinding Optimisation", "AHP Succession Ranking"];

  return (
    <div className="min-h-screen flex bg-secondary">
      {/* Left panel (38%) */}
      <div className="w-[38%] p-6 flex flex-col gap-4 overflow-y-auto">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground w-fit">
          <ArrowLeft className="h-3 w-3" /> Back
        </button>

        {/* Employee context card */}
        <div className="card-skillsight p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ backgroundColor: employee.avatar_color || '#1c69d3' }}>
              {employee.avatar_initials}
            </div>
            <div>
              <p className="text-base font-bold">{employee.name}</p>
              <p className="text-[13px] text-muted-foreground">{employee.job_title}</p>
            </div>
          </div>
          {selectedRole && (
            <div className="mt-3">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-bmw-blue/10 text-bmw-blue">
                → {selectedRole.title}
              </span>
            </div>
          )}
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground mt-3">Career Development Session</p>
        </div>

        {phase === "role_selection" && (
          <div className="card-skillsight p-4 space-y-3">
            <label className="text-xs font-medium">Select target role</label>
            <select value={selectedRoleId || ""} onChange={e => setSelectedRoleId(e.target.value || null)} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Select target role...</option>
              {roles?.map(r => <option key={r.id} value={r.id}>{r.title} — {r.department}</option>)}
            </select>
            <Button onClick={beginInterview} disabled={!selectedRoleId} className="w-full">Begin Interview</Button>
          </div>
        )}

        {phase === "interviewing" && (
          <>
            {/* Progress */}
            <div className="card-skillsight p-3">
              <p className="text-[13px] font-semibold">Question {displayedQuestionNumber} / 12</p>
              <div className="h-1 rounded-full bg-secondary mt-2 overflow-hidden">
                <div className="h-full bg-bmw-blue rounded-full transition-all" style={{ width: `${(questionsAsked / 12) * 100}%` }} />
              </div>
            </div>

            {/* Skills Discovered */}
            <div className="card-skillsight p-4 flex-1">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[13px] font-semibold flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-bmw-blue" />Skills Discovered</h3>
                <span className="text-xs font-mono bg-bmw-blue/10 text-bmw-blue px-2 py-0.5 rounded">{discoveredSkills.length} found</span>
              </div>
              {discoveredSkills.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Skills will appear as the interview progresses...</p>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {discoveredSkills.map((skill, i) => (
                    <div key={skill.name} className="animate-slide-in-right bg-secondary rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold">{skill.name}</span>
                        <SkillBadge skill="" proficiency={skill.proficiency as 0 | 1 | 2 | 3} showLabel />
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${skill.confidence === 'high' ? 'bg-status-green' : skill.confidence === 'medium' ? 'bg-status-amber' : 'bg-orange-400'}`} />
                        <p className="text-[10px] italic text-muted-foreground truncate">{skill.evidence?.slice(0, 60) || "Evidence captured"}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button onClick={() => { if (confirm("End interview early? Current progress will be saved.")) handleInterviewComplete({ extracted_skills: {} }, messages, questionsAsked); }} className="text-xs text-muted-foreground hover:text-foreground">
              End Interview Early
            </button>
          </>
        )}
      </div>

      {/* Right panel (62%) */}
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
              <p className="text-sm text-muted-foreground mt-1">{employee.name} → {selectedRole?.title}</p>
              <p className="text-xs text-muted-foreground mt-4">Redirecting to results...</p>
              <div className="w-48 h-1 rounded-full bg-secondary mx-auto mt-2 overflow-hidden">
                <div className="h-full bg-bmw-blue rounded-full animate-[grow_3s_linear]" style={{ animation: 'grow 3s linear forwards', width: '0%' }} />
              </div>
            </div>
          </div>
        )}

        {/* Chat header */}
        <div className="border-b border-border px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-bmw-blue flex items-center justify-center"><span className="text-[8px] font-bold text-white">S</span></div>
            <span className="text-sm font-semibold">SkillSight AI</span>
          </div>
          <p className="text-xs text-muted-foreground">{employee.name} · {employee.job_title}</p>
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

        {/* Input area */}
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
