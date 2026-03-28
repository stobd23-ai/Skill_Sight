import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Briefcase, User, Eye, EyeOff, AlertCircle, Loader2 } from "lucide-react";

type RoleTab = "manager" | "employee";

export default function LoginPage() {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<RoleTab>("manager");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const { signIn } = useAuth();

  // Interview code state
  const [codeOpen, setCodeOpen] = useState(false);
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [codeError, setCodeError] = useState<{ text: string; color: string } | null>(null);
  const [codeLoading, setCodeLoading] = useState(false);
  const codeRefs = useRef<(HTMLInputElement | null)[]>([]);

  const allDigitsFilled = digits.every(d => d !== "");

  // Seed demo users on mount
  useEffect(() => {
    let cancelled = false;
    const seed = async () => {
      setSeeding(true);
      try {
        await supabase.functions.invoke("seed-demo-users");
      } catch (e) {
        console.error("Seed error:", e);
      }
      if (!cancelled) setSeeding(false);
    };
    seed();
    return () => { cancelled = true; };
  }, []);

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && user && profile) {
      navigate(profile.role === "manager" ? "/dashboard" : "/my-profile", { replace: true });
    }
  }, [authLoading, user, profile, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error: err } = await signIn(email, password);
    if (err) {
      setError("Invalid email or password. Please try again.");
      setLoading(false);
      return;
    }
    // Check that the logged-in user's role matches the selected tab
    const { data: { user: signedInUser } } = await supabase.auth.getUser();
    if (signedInUser) {
      const { data: prof } = await supabase
        .from("user_profiles")
        .select("role")
        .eq("id", signedInUser.id)
        .single();
      if (prof && prof.role !== tab) {
        await supabase.auth.signOut();
        setError(
          tab === "manager"
            ? "This account is not a manager. Please switch to the Employee tab."
            : "This account is not an employee. Please switch to the Manager tab."
        );
        setLoading(false);
        return;
      }
    }
  };

  const hints = {
    manager: { email: "manager@bmw-skillsight.com", password: "SkillSight2026!" },
    employee: { email: "anna.keller@bmw-skillsight.com", password: "SkillSight2026!" },
  };

  // --- Interview code handlers ---
  const handleDigitChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const digit = value.slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    setCodeError(null);
    if (digit && index < 5) codeRefs.current[index + 1]?.focus();
  };

  const handleDigitKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      codeRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setDigits(pasted.split(""));
      codeRefs.current[5]?.focus();
    }
  };

  const handleCodeCancel = () => {
    setCodeOpen(false);
    setDigits(["", "", "", "", "", ""]);
    setCodeError(null);
  };

  const handleCodeSubmit = async () => {
    const code = digits.join("");
    if (code.length !== 6) return;
    setCodeLoading(true);
    setCodeError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from("external_candidates")
        .select("*, roles(*)")
        .eq("access_code", code)
        .single();

      if (fetchError || !data) {
        setCodeError({ text: "✕ Invalid code. Please check and try again.", color: "#dc3545" });
        setCodeLoading(false);
        return;
      }

      if (new Date(data.code_expires_at as string) < new Date()) {
        setCodeError({ text: "⏱ This code has expired. Contact the hiring team.", color: "#f59e0b" });
        setCodeLoading(false);
        return;
      }

      if (data.status === "interviewing" || data.status === "completed") {
        setCodeError({ text: "✓ Assessment already completed.", color: "#1c69d3" });
        setCodeLoading(false);
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
      setCodeError({ text: "✕ Something went wrong. Please try again.", color: "#dc3545" });
    } finally {
      setCodeLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Left Panel — BMW Blue */}
      <div className="w-full md:w-1/2 bg-[#1c69d3] flex flex-col items-center justify-center p-8 md:p-12 text-white relative min-h-[280px] md:min-h-screen">
        <div className="max-w-md w-full flex flex-col items-start gap-6">
          <div>
            <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center mb-4">
              <span className="text-lg font-bold text-white">BMW</span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              SkillSight
            </h1>
            <p className="text-sm text-white/70 mt-1">Workforce Intelligence Platform</p>
          </div>
          <div className="bg-white/10 rounded-xl p-6 border-l-[3px] border-white mt-4">
            <p className="text-[15px] italic text-white/90 leading-relaxed">
              "Future jobs will depend on skills that don't exist in the marketplace today. BMW's competitive advantage is the talent already inside."
            </p>
            <p className="text-xs text-white/50 mt-3">— SkillSight Vision, BMW Group</p>
          </div>
          <p className="text-[11px] text-white/40 uppercase tracking-widest mt-auto pt-4 hidden md:block">
            BMW Group · Neue Klasse Transformation
          </p>
        </div>
      </div>

      {/* Right Panel — Login Form */}
      <div className="w-full md:w-1/2 bg-white flex items-center justify-center p-8 md:p-12">
        <div className="w-full max-w-[360px]">
          <h2 className="text-[26px] font-bold text-foreground" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            Welcome back
          </h2>
          <p className="text-sm text-muted-foreground mt-1 mb-6">
            Sign in to your SkillSight account
          </p>

          {/* Role tabs */}
          <div className="flex h-11 rounded-lg border border-border bg-secondary p-1 mb-6">
            <button
              type="button"
              onClick={() => setTab("manager")}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-md text-[13px] font-medium transition-all ${
                tab === "manager"
                  ? "bg-background text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Briefcase className="h-4 w-4" />
              Manager
            </button>
            <button
              type="button"
              onClick={() => setTab("employee")}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-md text-[13px] font-medium transition-all ${
                tab === "employee"
                  ? "bg-background text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <User className="h-4 w-4" />
              Employee
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-[13px] font-medium text-foreground block mb-1.5">Email address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@bmw.com"
                required
                className={`w-full h-11 px-3 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors ${
                  error ? "border-destructive" : "border-border"
                }`}
              />
              <p className="text-[11px] text-muted-foreground/60 mt-1">{hints[tab].email}</p>
            </div>

            <div>
              <label className="text-[13px] font-medium text-foreground block mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className={`w-full h-11 px-3 pr-10 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors ${
                    error ? "border-destructive" : "border-border"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground/60 mt-1">{hints[tab].password}</p>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || seeding}
              className="w-full h-11 rounded-lg bg-[#1c69d3] hover:bg-[#1557b8] text-white text-sm font-semibold transition-all hover:-translate-y-[1px] disabled:opacity-60 disabled:hover:translate-y-0 flex items-center justify-center gap-2"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : seeding ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Setting up demo...
                </>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          <p className="text-xs text-muted-foreground/50 text-center mt-4">
            Demo accounts are pre-loaded. Use the hints above.
          </p>

          {/* Divider with "or" */}
          <div className="relative flex items-center my-5">
            <div className="flex-1 h-px" style={{ backgroundColor: "#e5e5e5" }} />
            <span className="px-3 text-[12px] bg-white" style={{ color: "#aeaeb2" }}>or</span>
            <div className="flex-1 h-px" style={{ backgroundColor: "#e5e5e5" }} />
          </div>

          {/* Apply link */}
          <p className="text-center text-[13px] text-muted-foreground">
            Want to apply for a role?{" "}
            <button
              type="button"
              onClick={() => navigate("/apply")}
              className="underline font-medium text-primary hover:text-primary/80 transition-colors"
            >
              Click here to apply →
            </button>
          </p>

          {/* Interview code trigger */}
          <p className="text-center text-[13px] mt-2" style={{ color: "#6e6e73" }}>
            Have an interview code?{" "}
            <button
              type="button"
              onClick={() => { setCodeOpen(true); setTimeout(() => codeRefs.current[0]?.focus(), 300); }}
              className="underline font-medium"
              style={{ color: "#1c69d3" }}
            >
              Enter it here →
            </button>
          </p>

          {/* Expandable code entry */}
          <div
            className="overflow-hidden transition-all duration-250 ease-in-out"
            style={{ maxHeight: codeOpen ? "260px" : "0px" }}
          >
            <div className="pt-4 space-y-3">
              {/* 6 digit boxes */}
              <div className="flex justify-center gap-2" onPaste={handlePaste}>
                {digits.map((digit, i) => (
                  <input
                    key={i}
                    ref={el => { codeRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={e => handleDigitChange(i, e.target.value)}
                    onKeyDown={e => handleDigitKeyDown(i, e)}
                    className="text-center bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                    style={{
                      width: 42,
                      height: 50,
                      border: `1px solid ${codeError?.color === "#dc3545" ? "#dc3545" : digit ? "#1c69d3" : "#d1d1d6"}`,
                      borderRadius: 8,
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 22,
                    }}
                  />
                ))}
              </div>

              {/* Start Interview button */}
              <button
                type="button"
                onClick={handleCodeSubmit}
                disabled={!allDigitsFilled || codeLoading}
                className="w-full flex items-center justify-center gap-2 text-white text-[14px] font-semibold transition-colors"
                style={{
                  height: 42,
                  borderRadius: 8,
                  backgroundColor: allDigitsFilled && !codeLoading ? "#1c69d3" : "#aeaeb2",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                {codeLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Start Interview"
                )}
              </button>

              {/* Error message */}
              {codeError && (
                <p className="text-[12px] text-center font-medium" style={{ color: codeError.color }}>
                  {codeError.text}
                </p>
              )}

              {/* Cancel */}
              <p className="text-center">
                <button
                  type="button"
                  onClick={handleCodeCancel}
                  className="text-[12px]"
                  style={{ color: "#aeaeb2" }}
                >
                  Cancel
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
