import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SYSTEM = `You are the SkillSight Interpreter at BMW Group.
You receive mathematical algorithm output and translate it into a clear actionable report for BMW HR managers.
You are a COMMUNICATOR not an analyst. The math is done. Translate numbers into meaning.
Do NOT re-score. Do NOT question results. Do NOT speculate beyond the data.

CONTEXT: BMW Neue Klasse transformation. Strategic priorities: EVBatterySystems, AUTOSAR, MachineLearning, Python, DigitalTwin, AQIXQualityAI.
BMW programs: Digital Boost (80,000 employees), iFACTORY, Debrecen battery plant.
External hire cost: €30,000–€80,000. Upskilling cost: €1,000–€5,000. Internal hires outperform external for first 2 years (Wharton).

=== MOMENTUM DATA ===
You have access to a trajectory assessment showing where this person is going, not just where they are now.
Use momentum_narrative in the Summary section.
Reference learning_velocity when discussing development capacity.
Reference motivation_alignment when discussing role fit.
If trajectory_risk is medium or high, mention it honestly in the Summary.
Always reference the three-layer score breakdown when discussing readiness.
The final score is a three-layer blend — explain this briefly so the HR manager understands it is not just a keyword match.

OUTPUT FORMAT — strict markdown:
## SkillSight Assessment: [name]
**Role:** [role] | **Readiness:** [X]% | **Date:** [today]
---
### Summary
One honest paragraph. Translate cosine+readiness into plain language. Include momentum narrative. Be direct.
---
### Distinctive Strengths
2-4 bullets. Surplus skills + high TF-IDF rarity scores. Connect to BMW strategy.
---
### Priority Skill Gaps
Top 4 gaps max. For each:
**[Skill]** · [current]/3 → [required]/3 · Priority: [CRITICAL/HIGH/MEDIUM]
Why it matters: [1-2 sentences — BMW-specific]
---
### 90-Day Action Plan
3 phases (Weeks 1-4, 5-8, 9-12). Use upskillingPaths for sequence. BMW-specific resources: Digital Boost modules, internal secondments, BMW Academy.
---
### 6-Month Roadmap
Month-by-month bullets. Reference Digital Boost, iFACTORY, Neue Klasse.
---
### Recommended HR Actions
Exactly 3 bullets. Verb-first. Specific. Time-bound.

TONE: Professional, direct, honest. Not cheerleader. If rank is 4th of 4 say so. Specific > vague.
Avoid: leverage, synergize, holistic, robust, cutting-edge.
700-900 words total.`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { employeeName, roleTitle, algorithmResults, gapAnalysis, tfidfRarity, upskillingPaths, managerInsights, momentumData, roleType, threeLayerScore, ahpWeightsUsed } = await req.json();

    const userContent = `Generate the SkillSight assessment report.

Employee: ${employeeName}
Target Role: ${roleTitle}
Date: ${new Date().toISOString().split('T')[0]}

ALGORITHM RESULTS:
- Cosine Similarity: ${algorithmResults.cosineSimilarity?.toFixed(3) || 'N/A'}
- Jaccard Binary: ${algorithmResults.jaccardBinary?.toFixed(3) || 'N/A'}
- Jaccard Weighted: ${algorithmResults.jaccardWeighted?.toFixed(3) || 'N/A'}
- Overall Readiness: ${(algorithmResults.overallReadiness * 100)?.toFixed(1) || 'N/A'}%
- Final Readiness: ${((algorithmResults.finalReadiness || algorithmResults.overallReadiness) * 100)?.toFixed(1) || 'N/A'}%
- Manager Adjustment: ${algorithmResults.managerAdjustment || 0}

${momentumData ? `MOMENTUM ASSESSMENT:
- Momentum Score: ${momentumData.momentumScore?.toFixed(3) || 'N/A'}
- Learning Velocity: ${momentumData.learningVelocity?.toFixed(3) || 'N/A'}
- Scope Trajectory: ${momentumData.scopeTrajectory?.toFixed(3) || 'N/A'}
- Motivation Alignment: ${momentumData.motivationAlignment?.toFixed(3) || 'N/A'}
- Narrative: ${momentumData.narrative || 'N/A'}
- Trajectory Risk: ${momentumData.trajectoryRisk || 'none'}` : ''}

${threeLayerScore ? `THREE-LAYER SCORE:
- Technical Match: ${threeLayerScore.breakdown?.technical?.toFixed(3) || 'N/A'}
- Capability Match: ${threeLayerScore.breakdown?.capability?.toFixed(3) || 'N/A'}
- Momentum: ${threeLayerScore.breakdown?.momentum?.toFixed(3) || 'N/A'}
- Final Three-Layer Score: ${threeLayerScore.threeLayerScore?.toFixed(3) || 'N/A'}
- Interpretation: ${threeLayerScore.interpretation || 'N/A'}` : ''}

ROLE TYPE: ${roleType || 'technical_specialist'}

GAP ANALYSIS:
${JSON.stringify(gapAnalysis, null, 2)}

TF-IDF RARITY SCORES:
${JSON.stringify(tfidfRarity, null, 2)}

UPSKILLING PATHS:
${JSON.stringify(upskillingPaths, null, 2)}

${managerInsights ? `MANAGER INSIGHTS:\n${JSON.stringify(managerInsights, null, 2)}` : 'No manager interview conducted yet.'}`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userContent },
        ],
        temperature: 0.4,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI API error:", response.status, errText);
      throw new Error(`AI API returned ${response.status}: ${errText.substring(0, 200)}`);
    }

    const rawText = await response.text();
    
    // Robust JSON parsing - handle markdown fences or malformed responses
    let data;
    try {
      data = JSON.parse(rawText);
    } catch {
      // Try to extract JSON from markdown-wrapped response
      let cleaned = rawText
        .replace(/```json\s*/gi, "")
        .replace(/```\s*/g, "")
        .trim();
      const jsonStart = cleaned.search(/[\{\[]/);
      const jsonEnd = cleaned.lastIndexOf(jsonStart !== -1 && cleaned[jsonStart] === '[' ? ']' : '}');
      if (jsonStart !== -1 && jsonEnd !== -1) {
        cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
      }
      try {
        data = JSON.parse(cleaned);
      } catch {
        // If still can't parse, return the raw text as the report
        return new Response(JSON.stringify({ report: rawText }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
    
    const report = data.choices?.[0]?.message?.content || data.report || rawText || "Report generation failed.";

    return new Response(JSON.stringify({ report }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
