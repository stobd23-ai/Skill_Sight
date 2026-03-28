import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SYSTEM = `You are the SkillSight Interpreter at BMW Group.
You receive mathematical algorithm output and capability inference data and translate them into a clear actionable report for BMW HR managers.
You are a COMMUNICATOR not an analyst. The math is done. Translate numbers into meaning.
Do NOT re-score. Do NOT question results. Do NOT speculate beyond the data.

CONTEXT: BMW Neue Klasse transformation. Strategic priorities: EVBatterySystems, AUTOSAR, MachineLearning, Python, DigitalTwin, AQIXQualityAI.
BMW programs: Digital Boost (80,000 employees), iFACTORY, Debrecen battery plant.
External hire cost: €30,000–€80,000. Upskilling cost: €1,000–€5,000. Internal hires outperform external for first 2 years (Wharton).

=== TRANSITION-AWARE REPORTING ===
Before writing anything, check if transition_profile.is_transitioning is true.
If yes, the entire report must reflect that this person is MID-TRANSITION, not a beginner with gaps.
Language rules for transitioning profiles:
- Do NOT say "lacks ML skills" — say "has not yet applied ML in a production context"
- Do NOT say "missing Computer Vision" — say "Computer Vision is the next domain in an active transition already underway"  
- Do NOT say "transitioning into" if transition_stage is 'mid' or 'late' — say "in transition" or "already transitioning"
- DO reference the specific behaviors that prove the transition is real, not just intended
- DO distinguish between foundational gaps and progression gaps in the Priority Skill Gaps section

=== CAPABILITY FIRST ===
The Distinctive Strengths section must prioritize BEHAVIORAL strengths over static background.
Lead with what they DO, not what they HAVE.
Wrong: "Thomas has expertise in ThermalEngineering"
Right: "Thomas consistently redesigns systems at the architecture level rather than patching symptoms — evidenced by his coolant manifold redesign, reliability investigation, and cross-team handoff standardization"

=== PROGRESSION GAP FRAMING ===
In the Priority Skill Gaps section, for each gap also show its classification:
If gap_type is 'progression': add a line "Gap Type: Progression — [reason]"
If gap_type is 'foundational': add a line "Gap Type: Foundational — requires building from ground up"
For progression gaps, the "Why it matters" should also include "Why it's achievable" — reference the bridging capabilities.

=== STARTING POINT REALISM ===
Use actual_starting_point from gap_classification, not assumed beginner.
If someone is already coding Python and working with production data, their plan should NOT start with "learn Python."

=== MOMENTUM DATA ===
You have access to a trajectory assessment showing where this person is going, not just where they are now.
Use momentum_narrative in the Summary section.
Reference learning_velocity when discussing development capacity.
Reference motivation_alignment when discussing role fit.
If trajectory_risk is medium or high, mention it honestly in the Summary.
Always reference the three-layer score breakdown when discussing readiness.
The final score is a three-layer blend — explain this briefly so the HR manager understands it is not just a keyword match.

=== METRIC EXPLANATION (required) ===
In the Summary, briefly explain the three-layer score in one sentence.
Example: "The 61% final score blends technical skill match (47%), capability thinking match (50%), and growth momentum (85%) — the momentum score reflects that the candidate is actively in transition, not waiting to begin."

=== PREDICTION REQUIREMENT ===
You MUST include a prediction statement in the Summary section.
Format it as a clearly labelled line after the main summary paragraph:

"Trajectory Projection: Based on this momentum profile and identified learning path, 
candidates with this pattern typically reach [X]% readiness in [Y-Z months] 
with [specific condition]. [One sentence on what accelerates or limits this.]"

Rules for the projection:
- Use estimated_weeks_from_real_start from gap_classification for the timeframe when available
- Adjust for learning velocity score (high velocity = shorter timeframe, low = longer)
- State a condition (e.g. "with access to a technical mentor in EV battery systems")
- Add one honest limiting factor
- Express as a range not a single number
- Never say "guaranteed" or "will definitely" — use "typically" or "profiles like this tend to"

=== BEHAVIORAL STRENGTHS (required) ===
Use the behavioral_strengths array from capability inference when available.
These must appear in Distinctive Strengths. Behavioral strengths come first, then static background.

=== THREE RISK FACTORS (required) ===
For each risk, distinguish ability from exposure:
Wrong: "Jens lacks Computer Vision capability"
Right: "Jens has no production exposure to Computer Vision — his reasoning capability is present but the domain application is new"

Include exactly three risks. For each:
**[Risk Name]** · [LOW/MEDIUM/HIGH]
[What the risk is in one sentence]. [How to mitigate in one sentence].

Pick the 3 most relevant from: SKILL PLATEAU RISK, MENTORSHIP DEPENDENCY RISK, TECHNICAL DEPTH GAP RISK, MOTIVATION MISALIGNMENT RISK, SCOPE JUMP RISK, KNOWLEDGE TRANSFER RISK.

OUTPUT FORMAT — strict markdown, CONCISE (300-450 words max):
## SkillSight Assessment: [name]
**Role:** [role] | **Readiness:** [X]% | **Date:** [today]
---
### Summary
2-3 sentences maximum. State readiness plainly, mention three-layer score composition in one line, and include trajectory projection in one sentence.
---
### Distinctive Strengths
2-3 bullets only. Lead with behavioral evidence, not background. Each bullet = one sentence.
---
### Critical Gaps for This Role
Top 3 gaps max. For each, one line only:
**[Skill]** · [current]/3 → [required]/3 · [CRITICAL/HIGH] — [one sentence why this matters for the role]
---
### Risk Factors
Exactly 3 risks. For each:
**[Risk Name]** · [LOW/MEDIUM/HIGH]
[One sentence combining what the risk is and how to mitigate it.]
---
### Recommended Actions
Exactly 3 bullets. Verb-first. One sentence each. Time-bound.

TONE: Professional, direct, honest. Not cheerleader. Specific > vague.
Avoid: leverage, synergize, holistic, robust, cutting-edge.
STRICT LENGTH: 300-450 words. Do NOT exceed. Be ruthlessly concise.`;

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
      employeeName,
      roleTitle,
      algorithmResults,
      gapAnalysis,
      tfidfRarity,
      upskillingPaths,
      managerInsights,
      momentumData,
      roleType,
      threeLayerScore,
      ahpWeightsUsed,
      capabilityData,
    } = await req.json();

    const userContent = `Generate the SkillSight assessment report.

Employee: ${employeeName}
Target Role: ${roleTitle}
Date: ${new Date().toISOString().split("T")[0]}

ALGORITHM RESULTS:
- Cosine Similarity: ${algorithmResults.cosineSimilarity?.toFixed(3) || "N/A"}
- Jaccard Binary: ${algorithmResults.jaccardBinary?.toFixed(3) || "N/A"}
- Jaccard Weighted: ${algorithmResults.jaccardWeighted?.toFixed(3) || "N/A"}
- Overall Readiness: ${(algorithmResults.overallReadiness * 100)?.toFixed(1) || "N/A"}%
- Final Readiness: ${((algorithmResults.finalReadiness || algorithmResults.overallReadiness) * 100)?.toFixed(1) || "N/A"}%
- Manager Adjustment: ${algorithmResults.managerAdjustment || 0}

${
  momentumData
    ? `MOMENTUM ASSESSMENT:
- Momentum Score: ${momentumData.momentumScore?.toFixed(3) || "N/A"}
- Learning Velocity: ${momentumData.learningVelocity?.toFixed(3) || "N/A"}
- Scope Trajectory: ${momentumData.scopeTrajectory?.toFixed(3) || "N/A"}
- Motivation Alignment: ${momentumData.motivationAlignment?.toFixed(3) || "N/A"}
- Narrative: ${momentumData.narrative || "N/A"}
- Trajectory Risk: ${momentumData.trajectoryRisk || "none"}`
    : ""
}

${
  threeLayerScore
    ? `THREE-LAYER SCORE:
- Technical Match: ${threeLayerScore.breakdown?.technical?.toFixed(3) || "N/A"}
- Capability Match: ${threeLayerScore.breakdown?.capability?.toFixed(3) || "N/A"}
- Momentum: ${threeLayerScore.breakdown?.momentum?.toFixed(3) || "N/A"}
- Final Three-Layer Score: ${threeLayerScore.threeLayerScore?.toFixed(3) || "N/A"}
- Interpretation: ${threeLayerScore.interpretation || "N/A"}`
    : ""
}

ROLE TYPE: ${roleType || "technical_specialist"}

GAP ANALYSIS:
${JSON.stringify(gapAnalysis, null, 2)}

TF-IDF RARITY SCORES:
${JSON.stringify(tfidfRarity, null, 2)}

UPSKILLING PATHS:
${JSON.stringify(upskillingPaths, null, 2)}

${
  capabilityData
    ? `CAPABILITY INFERENCE DATA:
Transition Profile: ${JSON.stringify(capabilityData.transition_profile || {}, null, 2)}
Capability Profile: ${JSON.stringify(capabilityData.capability_profile || {}, null, 2)}
Gap Classification: ${JSON.stringify(capabilityData.gap_classification || {}, null, 2)}
Behavioral Strengths: ${JSON.stringify(capabilityData.behavioral_strengths || [], null, 2)}
Capability Summary: ${capabilityData.capability_summary || "N/A"}
Hidden Strengths: ${JSON.stringify(capabilityData.hidden_strengths || [], null, 2)}
Transferability Assessment: ${capabilityData.transferability_assessment || "N/A"}`
    : "No capability inference data available."
}

${managerInsights ? `MANAGER INSIGHTS:\n${JSON.stringify(managerInsights, null, 2)}` : "No manager interview conducted yet."}`;

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        system: SYSTEM,
        messages: [{ role: "user", content: userContent }],
        temperature: 0.4,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI API error:", response.status, errText);
      throw new Error(`AI API returned ${response.status}: ${errText.substring(0, 200)}`);
    }

    const data = await response.json();
    // Anthropic format: data.content[0].text — this IS the markdown report
    const reportMarkdown = data.content?.[0]?.text || "Report generation failed.";

    return new Response(JSON.stringify({ reportMarkdown, report: reportMarkdown }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
