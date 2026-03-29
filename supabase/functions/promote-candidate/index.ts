import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { candidateId } = await req.json();
    if (!candidateId) {
      return new Response(JSON.stringify({ error: "candidateId is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch candidate with role info
    const { data: candidate, error: fetchErr } = await supabase
      .from("external_candidates")
      .select("*, roles(id, title, department, required_skills)")
      .eq("id", candidateId)
      .single();

    if (fetchErr || !candidate) {
      return new Response(JSON.stringify({ error: "Candidate not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch interview data if exists
    let interview = null;
    if (candidate.interview_id) {
      const { data } = await supabase
        .from("interviews")
        .select("*")
        .eq("id", candidate.interview_id)
        .single();
      interview = data;
    }

    // Build context for AI
    const role = candidate.roles as any;
    const interviewSkills = candidate.interview_skills || {};
    const algResults = candidate.full_algorithm_results || {};
    const cvText = candidate.candidate_message || "";
    const worthyReasoning = candidate.worthy_reasoning || "";

    const prompt = `You are an HR system that generates structured employee profiles.

Based on the following external candidate data, generate a complete employee profile for their transition to an internal employee.

CANDIDATE INFO:
- Name: ${candidate.name}
- Email: ${candidate.email || candidate.candidate_email || "N/A"}
- Applied for role: ${role?.title || "Unknown"} in ${role?.department || "Unknown"} department
- CV/Application text: ${cvText.slice(0, 3000)}
- Assessment reasoning: ${worthyReasoning.slice(0, 1500)}
- Interview skills detected: ${JSON.stringify(interviewSkills).slice(0, 2000)}
- Algorithm results: ${JSON.stringify(algResults).slice(0, 2000)}

Generate a JSON response with EXACTLY these fields:
{
  "job_title": "their job title based on the role they applied for",
  "department": "the department from the role",
  "tenure_years": 0,
  "performance_score": a number 0.5-0.8 representing initial performance estimate,
  "learning_agility": a number 0.4-0.9 based on their assessment signals,
  "avatar_color": "a hex color like #4F46E5",
  "skills": [
    { "skill_name": "skill name", "proficiency": 1-5, "source": "cv_import", "confidence": "high"|"medium"|"low", "evidence": "brief evidence" }
  ]
}

Base the skills on what was detected in their CV and interview. Include 5-10 most relevant skills.
The performance_score should reflect their assessment results.
The learning_agility should be based on momentum/learning velocity signals if available.`;

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1500,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", errText);
      return new Response(JSON.stringify({ error: "AI generation failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const textContent = aiData.content?.[0]?.text || "";

    // Extract JSON from response
    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return new Response(JSON.stringify({ error: "Could not parse AI response" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const profile = JSON.parse(jsonMatch[0]);
    const initials = candidate.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);

    // Create the employee record
    const { data: newEmployee, error: insertErr } = await supabase
      .from("employees")
      .insert({
        name: candidate.name,
        email: candidate.email || candidate.candidate_email || null,
        job_title: profile.job_title || role?.title || "New Hire",
        department: profile.department || role?.department || "Unassigned",
        tenure_years: 0,
        performance_score: profile.performance_score || 0.5,
        learning_agility: profile.learning_agility || 0.5,
        avatar_initials: initials,
        avatar_color: profile.avatar_color || "#6366F1",
        training_history: [],
        past_performance_reviews: [],
      })
      .select("id")
      .single();

    if (insertErr || !newEmployee) {
      console.error("Insert error:", insertErr);
      return new Response(JSON.stringify({ error: "Failed to create employee" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert skills
    const skills = profile.skills || [];
    if (skills.length > 0) {
      const skillRows = skills.map((s: any) => ({
        employee_id: newEmployee.id,
        skill_name: s.skill_name,
        proficiency: Math.min(5, Math.max(1, s.proficiency || 2)),
        source: s.source || "cv_import",
        confidence: s.confidence || "medium",
        evidence: s.evidence || null,
      }));

      await supabase.from("employee_skills").insert(skillRows);
    }

    // Update external candidate status to promoted
    await supabase.from("external_candidates").update({
      status: "promoted",
      manager_decision: "promoted",
      manager_decision_at: new Date().toISOString(),
    } as any).eq("id", candidateId);

    return new Response(JSON.stringify({
      success: true,
      employeeId: newEmployee.id,
      profile,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("promote-candidate error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
