import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Shield, Clock, MessageSquare, CheckCircle } from "lucide-react";

export default function InterviewAccess() {
  const navigate = useNavigate();
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const allFilled = digits.every(d => d !== "");

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleDigitChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const digit = value.slice(-1);
    const newDigits = [...digits];
    newDigits[index] = digit;
    setDigits(newDigits);
    setError(null);
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setDigits(pasted.split(""));
      inputRefs.current[5]?.focus();
    }
  };

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 300);
  };

  const handleSubmit = async () => {
    const code = digits.join("");
    if (code.length !== 6) return;
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from("external_candidates")
        .select("*, roles(*)")
        .eq("access_code", code)
        .single();

      if (fetchError || !data) {
        setError("Invalid code. Please check and try again.");
        triggerShake();
        setLoading(false);
        return;
      }

      if (new Date(data.code_expires_at) < new Date()) {
        setError("This code has expired. Please contact the hiring team for a new code.");
        setLoading(false);
        return;
      }

      if (data.status === "interviewing" || data.status === "completed") {
        setError("This code has already been used. Please contact the hiring team if you need assistance.");
        setLoading(false);
        return;
      }

      const role = data.roles as any;
      const { data: interview } = await supabase
        .from("interviews")
        .insert({
          employee_id: null,
          target_role_id: data.role_id,
          interview_type: "external_candidate",
          status: "in_progress",
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (!interview) throw new Error("Failed to create interview");

      await supabase
        .from("external_candidates")
        .update({
          status: "interviewing",
          code_used_at: new Date().toISOString(),
          interview_id: interview.id,
        })
        .eq("id", data.id);

      sessionStorage.setItem(
        "external_candidate",
        JSON.stringify({
          id: data.id,
          name: data.name,
          roleTitle: role?.title || "Target Role",
          roleId: data.role_id,
          requiredSkills: role?.required_skills || {},
          strategicWeights: role?.strategic_weights || {},
          interviewId: interview.id,
        })
      );

      navigate(`/interview-external/${interview.id}`);
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-[460px]">
        <div className="card-skillsight p-8 space-y-6">
          {/* Header */}
          <div className="text-center space-y-1">
            <div className="flex items-center justify-center gap-2 mb-2">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-2xl font-bold tracking-tight">SkillSight</span>
            </div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              External Candidate Assessment
            </p>
          </div>

          <div className="h-px bg-border" />

          {/* Title */}
          <div className="text-center space-y-2">
            <h1 className="text-[22px] font-bold">Enter Your Access Code</h1>
            <p className="text-sm text-muted-foreground">
              You should have received a 6-digit code from the BMW hiring team.
            </p>
          </div>

          {/* Info box */}
          <div className="rounded-lg p-4 space-y-2" style={{ backgroundColor: "hsl(213 66% 94.5%)" }}>
            <div className="flex items-start gap-2 text-sm">
              <Clock className="w-4 h-4 mt-0.5 text-primary shrink-0" />
              <span>This conversation takes approximately 15–20 minutes</span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <MessageSquare className="w-4 h-4 mt-0.5 text-primary shrink-0" />
              <span>Answer based on your real experience — there are no wrong answers</span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <CheckCircle className="w-4 h-4 mt-0.5 text-primary shrink-0" />
              <span>Your responses are used only for this role assessment</span>
            </div>
          </div>

          {/* OTP Input */}
          <div className="flex justify-center gap-2" onPaste={handlePaste}>
            {digits.map((digit, i) => (
              <input
                key={i}
                ref={el => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={e => handleDigitChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                className={`
                  w-[52px] h-[60px] text-center text-[28px] font-mono font-bold
                  border-2 rounded-lg bg-background
                  focus:outline-none focus:ring-2 focus:ring-primary/20
                  transition-all duration-200
                  ${shake ? "animate-shake" : ""}
                  ${error ? "border-destructive" : digit ? "border-primary" : "border-input"}
                  ${!error && !digit ? "focus:border-primary" : ""}
                `}
              />
            ))}
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-destructive text-center font-medium">{error}</p>
          )}

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            disabled={!allFilled || loading}
            className="w-full h-11 text-sm font-semibold"
          >
            {loading ? "Verifying code..." : "Begin Interview"}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Not a BMW employee? That's correct — this interview is open to external candidates.
          </p>
        </div>
      </div>
    </div>
  );
}
