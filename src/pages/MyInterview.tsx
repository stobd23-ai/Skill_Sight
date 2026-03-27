import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useEmployee, useInterviews } from "@/hooks/useData";
import { supabase } from "@/integrations/supabase/client";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { EmptyState } from "@/components/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, MessageSquare, Check, Sparkles } from "lucide-react";

interface Message {
  role: "ai" | "user";
  content: string;
  timestamp: Date;
}

export default function MyInterview() {
  const { profile } = useAuth();
  const employeeId = profile?.employee_id;
  const { data: employee, isLoading: empLoading } = useEmployee(employeeId || undefined);
  const { data: interviews, isLoading: intLoading } = useInterviews(employeeId || undefined);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [questionsAsked, setQuestionsAsked] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [started, setStarted] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Find an in-progress interview for this employee
  const activeInterview = interviews?.find(
    i => i.interview_type === "employee" && i.status === "in_progress"
  );

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isAiTyping]);

  const sendMessage = useCallback(
    async (userMessage?: string) => {
      if (!employee || !activeInterview) return;

      const newMessages = userMessage
        ? [...messages, { role: "user" as const, content: userMessage, timestamp: new Date() }]
        : messages;

      if (userMessage) {
        setMessages(newMessages);
        setInput("");
      }

      setIsAiTyping(true);
      try {
        const targetSkills = Object.keys((activeInterview as any).extracted_skills || {});
        const { data, error } = await supabase.functions.invoke("interview-chat", {
          body: {
            messages: newMessages.map(m => ({ role: m.role, content: m.content })),
            interviewType: "employee",
            employeeName: employee.name,
            employeeTitle: employee.job_title,
            roleName: "your next career step",
            targetSkills,
          },
        });

        if (error) throw error;

        const aiMsg: Message = {
          role: "ai",
          content: data.message,
          timestamp: new Date(),
        };
        const questionDelta = typeof data.questionDelta === "number" ? data.questionDelta : 1;
        const nextQuestionsAsked = questionsAsked + questionDelta;

        setMessages(prev => [...prev, aiMsg]);
        setQuestionsAsked(nextQuestionsAsked);

        if (data.isComplete && data.extractedData) {
          await handleComplete(data.extractedData, [...newMessages, aiMsg], nextQuestionsAsked);
        }
      } catch (err) {
        console.error("Interview chat error:", err);
        setMessages(prev => [
          ...prev,
          { role: "ai", content: "I apologize, there was a technical issue. Could you please repeat that?", timestamp: new Date() },
        ]);
      } finally {
        setIsAiTyping(false);
      }
    },
    [employee, activeInterview, messages, questionsAsked]
  );

  const handleComplete = async (extractedData: any, finalMessages: Message[], finalQuestionCount: number) => {
    if (!activeInterview || !employeeId) return;

    await supabase
      .from("interviews")
      .update({
        status: "completed",
        conversation_history: finalMessages.map(m => ({
          role: m.role,
          content: m.content,
          timestamp: m.timestamp.toISOString(),
        })) as any,
        questions_asked: finalQuestionCount,
        extracted_skills: extractedData.extracted_skills || ({} as any),
        unexpected_skills: extractedData.unexpected_skills || ([] as any),
        insufficient_evidence: extractedData.insufficient_evidence || ([] as any),
        completed_at: new Date().toISOString(),
      })
      .eq("id", activeInterview.id);

    // Merge skills
    if (extractedData.extracted_skills) {
      for (const [skillName, skillData] of Object.entries(extractedData.extracted_skills) as [string, any][]) {
        await supabase.from("employee_skills").upsert(
          {
            employee_id: employeeId,
            skill_name: skillName,
            proficiency: skillData.proficiency,
            source: "employee_interview",
            evidence: skillData.evidence,
            confidence: skillData.confidence,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "employee_id,skill_name" }
        );
      }
    }

    setCompleted(true);
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

  // No active interview
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

  // Completed state
  if (completed) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-48px)]">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-status-green flex items-center justify-center mx-auto mb-4">
              <Check className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-lg font-bold mb-2">Thank You!</h2>
            <p className="text-sm text-muted-foreground">
              Your responses have been submitted. Your HR team will review your assessment.
            </p>
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
            <p className="text-[13px] font-semibold">Question {questionsAsked} / 12</p>
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
        {/* Chat header */}
        <div className="border-b border-border px-6 py-4 flex items-center gap-2 shrink-0">
          <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
            <span className="text-[8px] font-bold text-white">S</span>
          </div>
          <span className="text-sm font-semibold">SkillSight AI</span>
        </div>

        {/* Chat messages */}
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

        {/* Input */}
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
