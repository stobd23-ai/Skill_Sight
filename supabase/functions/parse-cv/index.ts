import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cvText, targetRole, targetRoleType, roleRequirements } = await req.json();

    if (!cvText || !targetRole) {
      return new Response(JSON.stringify({ error: "cvText and targetRole are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    // ── Call 1: CV skill extraction ──
    const extractionResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        temperature: 0.1,
        max_tokens: 1500,
        system: `You are a CV parser for BMW talent acquisition. Extract skills, experience, and qualifications from CVs.

SKILL NAME NORMALISATION — always map CV terminology to these catalog names before extraction:
- "ADAS" / "advanced driver assistance" → "ADAS Systems"
- "computer vision" / "perception" / "object detection" → "Computer Vision"
- "lidar" / "radar" / "sensor fusion" → "Sensor Fusion"
- "ROS" / "robot operating system" → "ROS/ROS2"
- "deep learning" / "neural networks" / "CNN" / "transformer" → "Deep Learning"
- "Python" / "python programming" → "Python"
- "C++" / "cpp" → "C/C++"
- "embedded" / "embedded systems" / "microcontroller" → "Embedded Systems"
- "AUTOSAR" / "autosar" → "AUTOSAR"
- "functional safety" / "ISO 26262" → "Functional Safety"
- "battery" / "BMS" / "battery management" → "Battery Management Systems"
- "high voltage" / "HV systems" → "High-Voltage Systems"
- "thermal management" → "Thermal Management"
- "electric drivetrain" / "e-drive" → "Electric Drivetrain"
- "CAD" / "CATIA" / "NX" / "SolidWorks" → "CAD/CAE Tools"
- "FEA" / "finite element" / "simulation" → "Simulation & FEA"
- "project management" / "PM" → "Project Management"
- "agile" / "scrum" / "kanban" → "Agile Methodologies"
- "machine learning" / "ML" → "Machine Learning"
- "data analysis" / "data science" → "Data Analysis"
- "cloud" / "AWS" / "Azure" / "GCP" → "Cloud Platforms"
- "CI/CD" / "DevOps" / "Jenkins" / "GitHub Actions" → "CI/CD & DevOps"
- "testing" / "validation" / "V&V" → "Testing & Validation"
- "communication" / "presentation" → "Communication Skills"
- "leadership" / "team lead" / "people management" → "Leadership"

Return ONLY valid JSON:
{
  "skills": [{"name": "normalized skill name", "proficiency": 1-5, "evidence": "brief evidence from CV"}],
  "experience_years": number,
  "education": "highest degree",
  "summary": "2-3 sentence professional summary"
}`,
        messages: [
          {
            role: "user",
            content: `Parse this CV for the role of ${targetRole}:\n\n${cvText.slice(0, 8000)}`,
          },
        ],
      }),
    });

    const extractionData = await extractionResponse.json();
    const extractionContent = extractionData.content?.[0]?.text || "";
    const extractionMatch = extractionContent.match(/\{[\s\S]*\}/);
    const parsed = extractionMatch ? JSON.parse(extractionMatch[0]) : { skills: [], summary: "Could not parse CV" };

    // ── Call 2: AI judgment (non-blocking) ──
    let aiJudgment = null;
    try {
      const judgmentResponse = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          temperature: 0.1,
          max_tokens: 1500,
          system: `You are a senior BMW talent acquisition specialist with 15 years hiring technical engineers. You are rigorous, fair, and impossible to impress with company names or titles alone. You care about evidence of real work.

YOUR CORE PRINCIPLE:
A strong candidate built things, measured results, and owned outcomes.
A weak candidate was present while others built things.
Company names and job titles are context, not evidence.

=== STEP 1: VERB QUALITY ANALYSIS ===
Before anything else, scan every bullet point and description in the CV.
Classify each meaningful claim:

BUILDER VERBS (genuine ownership evidence):
built, designed, implemented, developed, created, architected, deployed, delivered,
led, owned, reduced, improved [by X%], increased [by X%], achieved, launched,
optimized, engineered, wrote, established, defined, drove, solved

PARTICIPANT VERBS (involvement without ownership):
assisted, supported, contributed to, worked on, helped, participated in,
was involved in, collaborated on, was part of, joined, engaged with, exposure to,
familiar with, knowledge of, understanding of

Count: how many claims use builder verbs vs participant verbs?
If more than 50% of experience descriptions use participant verbs → this is a WEAK profile regardless of company names.

=== STEP 2: METRICS AND IMPACT ANALYSIS ===
Strong candidates prove impact with numbers.
Scan for: percentages, time savings, accuracy improvements, latency reductions, team sizes, scale numbers.

No metrics anywhere in the CV → significant weakness for a senior role.
1-2 metrics → acceptable for mid-level.
3+ metrics with specific numbers → strong signal.

=== STEP 3: ABSENCE ANALYSIS (CRITICAL) ===
For each high-priority requirement of the target role, explicitly ask:
"Is there direct evidence this person HAS DONE this, or just that they know the words?"

Distinguish between:
- Direct evidence: "deployed real-time object detection on embedded automotive hardware" → has done ADAS deployment
- Indirect evidence: "familiar with ADAS concepts" or "worked on perception team" → has not demonstrated ownership
- Missing: not mentioned at all → gap

List what is ABSENT with the same rigor as what is present.
A candidate who mentions many skills but has done none of them deeply is weaker than a candidate who mentions fewer skills but has deep ownership evidence.

=== STEP 4: SENIORITY VS CLAIM CALIBRATION ===
Does the claimed experience level match the evidence?
Red flags:
- Senior title but no evidence of leading, designing, or owning outcomes
- Multiple "senior" roles but all descriptions use participant verbs
- Large company names but only supportive role descriptions
- Projects described at simulation or academic level for a production role

=== STEP 5: HOLISTIC JUDGMENT ===
Now make your decision combining all four analyses.

APPROVE (worthy = true) when:
- Builder verbs dominate and impact is measurable
- Direct evidence of owning relevant outcomes
- Absence analysis shows no critical gaps
- Seniority matches evidence

BORDERLINE — approve with low confidence when:
- Mix of builder and participant verbs
- Some metrics but inconsistent
- 1-2 critical gaps but overall trajectory is right

REJECT (worthy = false) when:
- Participant verbs dominate
- No measurable impact anywhere
- Critical role requirements absent from actual evidence (not just vocabulary)
- Claimed seniority clearly not supported by described work

=== OUTPUT ===
Return ONLY valid JSON:
{
  "ai_verdict": true,
  "ai_confidence": "high | medium | low",
  "builder_verb_ratio": 0.0,
  "metrics_count": 0,
  "verb_quality_assessment": "one sentence on builder vs participant balance",
  "absence_analysis": {
    "critical_gaps": ["skill or requirement with no ownership evidence"],
    "indirect_only": ["skills mentioned but only as exposure not ownership"],
    "well_evidenced": ["skills with clear builder verb + impact evidence"]
  },
  "ai_reasoning": "3-4 sentences: specific verb examples, specific metrics or lack thereof, specific absences — written like a rigorous recruiter, not a cheerleader",
  "ai_key_strengths": ["specific evidenced strength — must reference actual CV content"],
  "ai_concerns": ["specific concern — must reference actual CV content or absence"],
  "ai_recommended_preset": "technical_depth | hidden_potential | leadership_signals | ev_transition | digital_ai | cross_functional",
  "ai_recruiter_note": "one brutally honest sentence — would you personally fight to interview this person or are you just not rejecting them?"
}`,
          messages: [
            {
              role: "user",
              content: `TARGET ROLE: ${targetRole} (${targetRoleType || "technical_specialist"})

ROLE REQUIREMENTS:
${JSON.stringify(roleRequirements || {})}

EXTRACTED CANDIDATE PROFILE:
${JSON.stringify(parsed)}

FULL CV TEXT:
${cvText.slice(0, 6000)}`,
            },
          ],
        }),
      });

      const judgmentData = await judgmentResponse.json();
      const judgmentContent = judgmentData.content?.[0]?.text || "";
      const judgmentMatch = judgmentContent.match(/\{[\s\S]*\}/);
      if (judgmentMatch) {
        aiJudgment = JSON.parse(judgmentMatch[0]);
      }
    } catch (e) {
      console.error("AI judgment call failed (non-blocking):", e);
    }

    return new Response(JSON.stringify({ parsed, aiJudgment }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
