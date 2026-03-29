import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Copy, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";

interface Candidate {
  id: string;
  name: string;
  email: string | null;
  role_title: string | null;
  role_id: string | null;
  status: string | null;
  worthy_score: number | null;
  interview_worthy: boolean | null;
  worthy_reasoning: any;
  not_worthy_reasons: any;
  candidate_message: string | null;
  interview_skills: any;
  full_algorithm_results: any;
}

function parseReasoning(raw: any) {
  if (!raw) return {};
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return {}; }
  }
  return raw;
}

function verdictOrder(verdict: string) {
  if (verdict === "hard_reject") return 0;
  if (verdict === "flag") return 1;
  return 2;
}

function VerdictBadge({ verdict }: { verdict: string }) {
  if (verdict === "hard_reject")
    return <Badge variant="destructive" className="text-xs">Hard Reject</Badge>;
  if (verdict === "recommend")
    return <Badge className="text-xs bg-emerald-600 hover:bg-emerald-700">Strong Match</Badge>;
  return <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800 hover:bg-amber-200">Needs Review</Badge>;
}

function CVBlock({ text }: { text: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-1">CV Text:</p>
      <pre className="p-3 bg-muted rounded text-xs font-mono whitespace-pre-wrap max-h-[300px] overflow-y-auto">
        {text}
      </pre>
    </div>
  );
}

export default function BulkReview() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [roles, setRoles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [{ data: cands }, { data: rolesData }] = await Promise.all([
        (supabase.from as any)("external_candidates").select("*").order("name"),
        (supabase.from as any)("roles").select("id, title"),
      ]);
      const roleMap: Record<string, string> = {};
      (rolesData || []).forEach((r: any) => { roleMap[r.id] = r.title; });
      setRoles(roleMap);
      setCandidates((cands || []).map((c: any) => ({
        ...c,
        role_title: c.role_id ? roleMap[c.role_id] || "Unknown" : "No Role",
      })));
      setLoading(false);
    }
    load();
  }, []);

  const sorted = [...candidates].sort((a, b) => {
    const ra = parseReasoning(a.worthy_reasoning);
    const rb = parseReasoning(b.worthy_reasoning);
    const va = verdictOrder(ra.verdict || "flag");
    const vb = verdictOrder(rb.verdict || "flag");
    if (va !== vb) return va - vb;
    return a.name.localeCompare(b.name);
  });

  const counts = sorted.reduce(
    (acc, c) => {
      const r = parseReasoning(c.worthy_reasoning);
      if (r.verdict === "hard_reject") acc.reject++;
      else if (r.verdict === "recommend") acc.strong++;
      else acc.review++;
      return acc;
    },
    { strong: 0, review: 0, reject: 0 }
  );

  const handleCopyJSON = () => {
    const data = sorted.map((c) => {
      const r = parseReasoning(c.worthy_reasoning);
      return {
        name: c.name,
        email: c.email,
        role: c.role_title,
        verdict: r.verdict,
        verdictLabel: r.verdictLabel,
        confidence: r.confidence,
        worthyScore: c.worthy_score,
        builderVerbRatio: r.builder_verb_ratio,
        strongMetrics: r.strong_metrics_count,
        concerns: r.concerns,
        keyStrengths: r.keyStrengths,
        aiReasoning: r.aiReasoning || r.reasoning,
        domainGaps: r.domain_gap_classification,
      };
    });
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    toast.success("Copied all candidates as JSON");
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen"><LoadingSpinner /></div>;

  return (
    <div>
      <PageHeader
        title="Bulk Review"
        subtitle={`QA debug view — ${sorted.length} candidates`}
        actions={
          <Button variant="outline" size="sm" onClick={handleCopyJSON}>
            <Copy className="h-4 w-4 mr-1" />Copy All as JSON
          </Button>
        }
      />
      <div className="p-6 space-y-4">
        {/* Summary bar */}
        <div className="flex gap-4 items-center p-4 rounded-lg bg-muted/50 border border-border text-sm">
          <span className="font-medium">Total: {sorted.length}</span>
          <span className="text-emerald-600 font-medium">Strong Match: {counts.strong}</span>
          <span className="text-amber-600 font-medium">Needs Review: {counts.review}</span>
          <span className="text-destructive font-medium">Hard Reject: {counts.reject}</span>
        </div>

        {/* Candidate list */}
        {sorted.map((c) => {
          const r = parseReasoning(c.worthy_reasoning);
          const concerns = Array.isArray(r.concerns) ? r.concerns : Array.isArray(c.not_worthy_reasons) ? c.not_worthy_reasons : [];
          const strengths = Array.isArray(r.keyStrengths) ? r.keyStrengths : [];
          const bvr = r.builder_verb_ratio != null ? `${Math.round(r.builder_verb_ratio * 100)}%` : "—";
          const metrics = r.strong_metrics_count ?? "—";
          const expYears = r.absence_analysis?.total_years || "—";

          return (
            <div key={c.id} className="border border-border rounded-lg p-5 space-y-3">
              {/* Header */}
              <div className="flex items-center gap-3 flex-wrap">
                <h3 className="font-semibold text-base">{c.name}</h3>
                <span className="text-muted-foreground text-sm">— {c.role_title}</span>
                <VerdictBadge verdict={r.verdict || "flag"} />
              </div>

              {/* Stats row */}
              <div className="flex gap-4 text-xs text-muted-foreground flex-wrap">
                <span>CV Score: {c.worthy_score != null ? `${Math.round(c.worthy_score * 100)}%` : "—"}</span>
                <span>Builder: {bvr}</span>
                <span>Metrics: {metrics}</span>
                <span>Experience: {expYears} yrs</span>
              </div>

              {/* Verdict details */}
              <div className="text-sm space-y-1">
                <p><span className="font-medium">Verdict:</span> {r.verdictLabel || r.verdict || "Unknown"}</p>
                <p><span className="font-medium">Confidence:</span> {r.confidence || "—"}</p>
                <p><span className="font-medium">Domain gaps:</span> {r.domain_gap_classification || "—"}</p>
              </div>

              {/* CV Text */}
              {c.candidate_message && <CollapsibleCV text={c.candidate_message} />}

              {/* AI Reasoning */}
              {(r.aiReasoning || r.reasoning) && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">AI Reasoning:</p>
                  <p className="text-sm text-foreground/80">{r.aiReasoning || r.reasoning}</p>
                </div>
              )}

              {/* Concerns */}
              {concerns.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Rejection reasons:</p>
                  <ul className="list-disc list-inside text-sm text-foreground/80 space-y-0.5">
                    {concerns.map((c: string, i: number) => <li key={i}>{c}</li>)}
                  </ul>
                </div>
              )}

              {/* Strengths */}
              {strengths.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Strengths:</p>
                  <ul className="list-disc list-inside text-sm text-foreground/80 space-y-0.5">
                    {strengths.map((s: string, i: number) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
