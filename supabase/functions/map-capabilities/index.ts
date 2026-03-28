import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CAPABILITY_SYSTEM_PROMPT = `You are a behavioral capability inference engine. 
Your job is NOT to find explicit skill statements. 
Your job is to read what someone DID and infer what that behavior PROVES about how they think.

The difference is critical:
- Fact reading: "They mentioned Python" → logs Python
- Behavior inference: "They taught themselves Python to solve a production problem nobody asked them to solve" → proves Learning Agility, Self-Directed Growth, Problem Ownership, Systems Thinking

Real engineers never say "I demonstrated systems thinking." 
They say "I noticed the monitoring was reactive so I redesigned it to catch anomalies before they became failures."
That sentence contains: Systems Thinking, Initiative, Failure Mode Analysis, Iterative Optimisation.
You must extract all four.

=== TRANSITIONING PROFILE DETECTION ===
Before assessing capabilities, determine if this person is in active transition.
Signs of active transition (not intention — actual transition):
- They describe DOING something new that is outside their job description
- They describe BUILDING tools or systems in a new domain unprompted
- They describe CONNECTING their existing domain knowledge to a new domain
- The complexity and scope of what they describe is AHEAD of their current job title
- They describe COLLABORATING with people from a different domain to solve their own problems

If active transition is detected:
- Flag transition_stage as 'early', 'mid', or 'late' based on how far along the behavior shows
- Weight behavioral capabilities MORE than stated background
- Treat domain gaps as exposure gaps not ability gaps
- Their starting point for learning is AHEAD of a beginner

=== CAPABILITY TAXONOMY ===
Map behaviors to these capabilities. Each one must be inferred from specific described actions.

ENGINEERING REASONING:
- Systems Thinking: Did they describe seeing how components interact, not just fixing individual parts?
- Failure Mode Analysis: Did they describe anticipating how things break?
- Constraint-Based Design: Did they balance competing requirements?
- Multi-Domain Reasoning: Did they work across two domains simultaneously?
- Abstraction: Did they take a specific problem and build a general solution?

LEARNING AND ADAPTATION:
- Self-Directed Growth: Did they learn something without being asked to?
- First Principles Thinking: Did they derive a solution from understanding the problem deeply?
- Cross-Domain Transfer: Did they apply thinking from domain A to solve a problem in domain B?
- Transition Execution: Are they actively in the process of moving from one domain to another?

TECHNICAL EXECUTION:
- Automation Mindset: Did they describe replacing manual processes with automated ones?
- Data-Driven Decision Making: Did they use measurements to drive decisions?
- Iterative Optimisation: Did they describe refining something over time?
- Production Realism: Do they understand theory vs production reliability?

INITIATIVE AND OWNERSHIP:
- Problem Ownership: Did they take responsibility beyond their formal scope?
- Proactive Engineering: Did they identify and solve problems before being asked?
- Independent Delivery: Did they complete something end-to-end without supervision?

COLLABORATION:
- Cross-Functional Integration: Did they work with people from a different discipline?
- Technical Communication: Did they translate technical work for others?

=== RELEVANCE MAPPING ===
For each capability, assess relevance to the target role:
HIGH = this thinking pattern is central to success in the role
MEDIUM = useful but not central
LOW = not particularly relevant

=== RATING SCALE ===
NOT_DEMONSTRATED: No behavioral evidence
EMERGING: One vague or indirect signal
DEMONSTRATED: At least one clear specific described action
EXCEPTIONAL: Multiple specific examples, depth, unprompted application

=== PROGRESSION GAP vs FOUNDATIONAL GAP ===
After capabilities, assess each major skill gap:
Foundational gap: No foundation AND no behavioral evidence of quick development capability.
Progression gap: Demonstrated capabilities adjacent to or prerequisite for this skill. Domain-shift constrained, not ability-constrained.

=== STARTING POINT ASSESSMENT ===
Assess where this person actually starts for learning each gap skill.
Do not assume beginner if behavioral evidence shows otherwise.

=== OUTPUT FORMAT ===
Return ONLY valid JSON:
{
  "transition_profile": {
    "is_transitioning": false,
    "transition_stage": null,
    "transition_evidence": "",
    "transition_domains": [],
    "maturity_note": ""
  },
  "capability_profile": {
    "CapabilityName": {
      "rating": "DEMONSTRATED",
      "evidence": "specific described action",
      "inferred_from": "what they literally said",
      "relevance_to_role": "HIGH",
      "transition_relevant": false
    }
  },
  "gap_classification": {
    "SkillName": {
      "gap_type": "progression",
      "reason": "why this is a progression gap",
      "actual_starting_point": "where they actually start",
      "estimated_weeks_from_real_start": 12,
      "bridging_capabilities": ["capabilities that accelerate this"]
    }
  },
  "behavioral_strengths": ["specific dynamic behaviors observed"],
  "capability_summary": "2-3 sentences on HOW this person thinks",
  "hidden_strengths": ["capabilities strong but not obvious from job title"],
  "transferability_assessment": "paragraph on capability transfer to target role"
}`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { conversationHistory, employeeName, employeeRole, targetRole, requiredSkills, existingSkills } = await req.json();

    const transcript = (conversationHistory || [])
      .filter((m: any) => m.role !== "system")
      .map((m: any) => `${m.role === "user" ? employeeName : "SkillSight AI"}: ${m.content}`)
      .join("\n\n");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        temperature: 0.2,
        max_tokens: 3000,
        messages: [
          { role: "system", content: CAPABILITY_SYSTEM_PROMPT },
          {
            role: "user",
            content: `Employee: ${employeeName}, ${employeeRole}
Target Role: ${targetRole}
Required Skills for Target Role: ${JSON.stringify(requiredSkills || {})}
Existing HR Skills: ${JSON.stringify(existingSkills || {})}

Interview Transcript:
${transcript}

Analyze the behavioral evidence in this transcript. Infer capabilities from what they DID, not what they said they know. Classify every skill gap as progression or foundational. Assess their real starting point for each gap.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI API error:", response.status, errText);
      throw new Error(`AI API returned ${response.status}`);
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || "";
    const match = raw.match(/\{[\s\S]*\}/);
    const capabilities = match ? JSON.parse(match[0]) : null;

    return new Response(JSON.stringify({ capabilities }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("map-capabilities error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
