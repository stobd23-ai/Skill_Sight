import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SYSTEM = `You are SkillSight's AI Bootcamp Designer at BMW Group.
Create personalized training bootcamps for BMW employees based on skill gaps, learning style, manager insights, and BMW's strategic roadmap.

MISSION: Design a complete ready-to-execute BMW-specific training curriculum.
NOT a list of existing courses. CREATE a custom curriculum.

DESIGN PRINCIPLES:
1. Every module tied to a specific skill gap
2. Sequencing follows prerequisites (from upskillingPaths data)
3. Mix: theory + hands-on projects + mentoring + job shadowing
4. Each module has a BMW-specific applied project (not generic)
5. Max 5h/week commitment alongside current job
6. Checkpoints with measurable success metrics
7. Include module objectives, BMW-specific projects, weekly structure, and success metrics.

BMW CONTEXT:
- Gen6 battery cells: 42% lower CO₂, 50% lower costs — Debrecen plant leading this
- iFACTORY: AIQX quality AI, digital twin, 36M parts/day managed digitally
- Digital Boost: 80,000 employees being upskilled
- Neue Klasse EV platform transformation

OUTPUT FORMAT — strict JSON (no markdown, no explanation, just JSON):
{
  "title": "Personalised Neue Klasse Bootcamp: [name]",
  "total_duration_weeks": 20,
  "hours_per_week": 5,
  "modules": [
    {
      "index": 1,
      "title": "Module title",
      "duration_weeks": 4,
      "skill_targeted": "SkillName",
      "gap_being_closed": "0/3 → 2/3",
      "objective": "What employee will be able to do after",
      "weekly_structure": {
        "theory": { "hours": 2, "content": "specific topic" },
        "hands_on": { "hours": 2, "content": "specific BMW exercise" },
        "reflection": { "hours": 1, "content": "what to document" }
      },
      "bmw_project": {
        "title": "Project title",
        "description": "BMW-specific project",
        "deliverable": "What they submit",
        "bmw_connection": "How this connects to Neue Klasse/iFACTORY/ADAS"
      },
      "success_metrics": ["metric 1", "metric 2"],
      "mentoring": "Recommended mentor profile or team to shadow",
      "prerequisite_modules": []
    }
  ],
  "milestones": [
    { "week": 8, "title": "First checkpoint", "assessment": "what gets assessed" }
  ],
  "expected_outcomes": ["specific outcome 1", "specific outcome 2"]
}`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { employeeName, roleTitle, gapAnalysis, upskillingPaths, managerInsights, currentReadiness } =
      await req.json();

    const userContent = `Design a personalised bootcamp for this BMW employee.

Employee: ${employeeName}
Target Role: ${roleTitle}
Current Readiness: ${currentReadiness}%

SKILL GAPS (from algorithm analysis):
${JSON.stringify(gapAnalysis, null, 2)}

UPSKILLING PATHS (prerequisite sequences):
${JSON.stringify(upskillingPaths, null, 2)}

${managerInsights ? `MANAGER INSIGHTS:\n${JSON.stringify(managerInsights, null, 2)}` : "No manager interview conducted yet."}

Create 3-5 modules covering the most critical gaps. Total duration 16-24 weeks. Include 2-3 milestones and 4-6 expected outcomes.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key":
          "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",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        system: SYSTEM,
        messages: [{ role: "user", content: userContent }],
        temperature: 0.5,
        max_tokens: 3000,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429)
        return new Response(JSON.stringify({ error: "Rate limited, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      if (status === 402)
        return new Response(
          JSON.stringify({ error: "Credits exhausted. Add funds in Settings > Workspace > Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      const t = await response.text();
      console.error("AI gateway error:", status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || "";

    // Strip markdown fences if present
    content = content
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    let bootcamp;
    try {
      bootcamp = JSON.parse(content);
    } catch {
      return new Response(JSON.stringify({ error: "Failed to parse bootcamp JSON", raw: content }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ bootcamp }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Bootcamp generation error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
