import { useState, useEffect } from "react";
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
    }
    // Navigation handled by useEffect above
  };

  const hints = {
    manager: { email: "manager@bmw-skillsight.com", password: "SkillSight2026!" },
    employee: { email: "anna.keller@bmw-skillsight.com", password: "SkillSight2026!" },
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
          {/* Logo */}
          <div>
            <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center mb-4">
              <span className="text-lg font-bold text-white">BMW</span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              SkillSight
            </h1>
            <p className="text-sm text-white/70 mt-1">Workforce Intelligence Platform</p>
          </div>

          {/* Quote */}
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
            {/* Email */}
            <div>
              <label className="text-[13px] font-medium text-foreground block mb-1.5">
                Email address
              </label>
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

            {/* Password */}
            <div>
              <label className="text-[13px] font-medium text-foreground block mb-1.5">
                Password
              </label>
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

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            {/* Submit */}
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
        </div>
      </div>
    </div>
  );
}
