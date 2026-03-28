import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const {
      conversationHistory,
      performanceReviews,
      trainingHistory,
      managerAssessment,
      employeeName,
      employeeRole,
      targetRole,
      targetRoleType,
      existingSkills,
    } = await req.json();

    const employeeMessages = (conversationHistory || [])
      .filter((m: any) => m.role === "user")
      .map((m: any) => m.content)
      .join("\n\n");

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
        max_tokens: 2500,
        messages: [
          {
            role: "user",
            content: `You are a talent trajectory assessment system. You do not measure what someone knows right now. You measure where they are going and how fast they are getting there.

You assess three components:

=== COMPONENT 1: LEARNING VELOCITY (0.0 to 1.0) ===
How fast is this person acquiring new knowledge and skills?
Evidence sources:
- Interview: Did they describe learning something WITHOUT being asked to? Did they self-study? Did they pick up a new tool or technique on their own initiative?
- Training history: How many courses completed in last 2 years? Do they finish what they start?
- Manager assessment: Did the manager describe them as a fast learner or adaptable?
- Performance reviews: Do reviews mention growth, development, or new capabilities?

Scoring guide:
0.0-0.3: No evidence of self-directed learning. Learns only when required.
0.4-0.6: Some evidence. Completes assigned training. Occasional self-study.
0.7-0.8: Clear evidence. Regularly learns unprompted. Manager confirms fast learner.
0.9-1.0: Exceptional. Multiple examples of rapid self-directed learning across domains.

=== COMPONENT 2: SCOPE TRAJECTORY (0.0 to 1.0) ===
Are their projects and responsibilities getting bigger and more complex over time?
Evidence sources:
- Performance reviews across years: Is the language escalating from "completed tasks" to "led teams" to "designed systems"?
- Interview: Do their most recent examples involve more complexity, more people, more ownership than earlier ones?
- Career history: Are they taking on more scope or staying flat?

Scoring guide:
0.0-0.3: Flat trajectory. Same scope and complexity year over year.
0.4-0.6: Slight upward trend. Some growth in responsibility.
0.7-0.8: Clear upward trajectory. Meaningfully more complex and owned work each year.
0.9-1.0: Rapid escalation. Went from individual contributor to leading significant outcomes.

=== COMPONENT 3: MOTIVATION ALIGNMENT (0.0 to 1.0) ===
Does what this person cares about and talks about with enthusiasm actually connect to what the target role requires?
This is NOT about whether they said "I want this role." It is about detecting genuine interest from language patterns.

Evidence sources:
- Interview: Where did they go into the most depth UNPROMPTED? What did they bring up themselves without being asked? What language do they use when excited vs flat?
- Target role requirements: What domains and capabilities does the role actually need?
- Alignment: Is there a genuine connection between their passion areas and the role needs?

Scoring guide:
0.0-0.3: Clear misalignment. Their enthusiasm is in a different direction from the role.
0.4-0.6: Neutral. Some overlap but no strong signal of genuine pull toward the role domain.
0.7-0.8: Good alignment. Their deepest answers connect to what the role needs.
0.9-1.0: Exceptional alignment. They naturally went deep in exactly the domains the role requires.

=== OUTPUT ===
Return ONLY valid JSON:
{
  "learning_velocity": 0.0,
  "learning_velocity_evidence": "specific examples from interview and reviews",
  "learning_velocity_signals": ["signal 1", "signal 2"],
  "scope_trajectory": 0.0,
  "scope_trajectory_evidence": "what changed year over year",
  "scope_trajectory_signals": ["signal 1", "signal 2"],
  "motivation_alignment": 0.0,
  "motivation_alignment_evidence": "where they showed genuine depth and enthusiasm",
  "motivation_alignment_signals": ["signal 1", "signal 2"],
  "momentum_score": 0.0,
  "momentum_narrative": "2-3 sentences: where is this person going and how fast",
  "trajectory_risk": "none",
  "trajectory_risk_reason": ""
}

momentum_score = (learning_velocity * 0.35) + (scope_trajectory * 0.35) + (motivation_alignment * 0.30)`,
          },
          {
            role: "user",
            content: `Employee: ${employeeName}, currently ${employeeRole}
Target Role: ${targetRole} (type: ${targetRoleType})
Current Skills: ${JSON.stringify(existingSkills)}

Performance Reviews (chronological):
${JSON.stringify(performanceReviews)}

Training History:
${JSON.stringify(trainingHistory)}

Manager Assessment:
${JSON.stringify(managerAssessment || "Not yet completed")}

What the employee said in the interview (their words only):
${employeeMessages}

Assess their momentum across all three components.`,
          },
        ],
      }),
    });

    const rawText = await response.text();

    // Robust JSON extraction
    let data;
    try {
      data = JSON.parse(rawText);
    } catch {
      let cleaned = rawText
        .replace(/```json\s*/gi, "")
        .replace(/```\s*/g, "")
        .trim();
      const jsonStart = cleaned.search(/[\{\[]/);
      const jsonEnd = cleaned.lastIndexOf(jsonStart !== -1 && cleaned[jsonStart] === "[" ? "]" : "}");
      if (jsonStart !== -1 && jsonEnd !== -1) {
        cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
      }
      try {
        data = JSON.parse(cleaned);
      } catch {
        return new Response(JSON.stringify({ momentum: null, error: "Failed to parse AI response" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Extract the momentum from the AI response
    const aiContent = data.choices?.[0]?.message?.content || "";
    let momentum;
    if (aiContent) {
      try {
        const match = aiContent.match(/\{[\s\S]*\}/);
        momentum = match ? JSON.parse(match[0]) : null;
      } catch {
        momentum = null;
      }
    } else {
      // data itself might be the momentum object
      momentum = data.momentum_score !== undefined ? data : null;
    }

    return new Response(JSON.stringify({ momentum }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
