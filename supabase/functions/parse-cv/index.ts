import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Skill alias mapping table ──
const SKILL_ALIASES: Record<string, string[]> = {
  "perception pipeline": ["sensor_fusion", "computer_vision"],
  "perception pipelines": ["sensor_fusion", "computer_vision"],
  "autonomous systems": ["adas_systems", "autonomous_driving"],
  "autonomous driving": ["adas_systems", "autonomous_driving"],
  "sensor fusion": ["sensor_fusion"],
  "lidar": ["lidar_processing", "sensor_fusion"],
  "radar": ["radar_processing", "sensor_fusion"],
  "object detection": ["computer_vision", "perception"],
  "real-time systems": ["embedded_systems", "real_time_processing"],
  "real time systems": ["embedded_systems", "real_time_processing"],
  "embedded hardware": ["embedded_systems"],
  "embedded systems": ["embedded_systems"],
  "localization": ["slam", "localization"],
  "slam": ["slam", "localization"],
  "planning": ["motion_planning"],
  "motion planning": ["motion_planning"],
  "deep learning": ["machine_learning", "deep_learning"],
  "neural networks": ["deep_learning", "machine_learning"],
  "cnn": ["deep_learning", "computer_vision"],
  "transformer": ["deep_learning", "machine_learning"],
  "reinforcement learning": ["machine_learning", "reinforcement_learning"],
  "edge ai": ["edge_computing", "embedded_ai"],
  "distributed processing": ["distributed_systems"],
  "distributed systems": ["distributed_systems"],
  "model inference": ["ml_deployment"],
  "quantization": ["model_optimization"],
  "pytorch": ["pytorch", "deep_learning"],
  "tensorflow": ["tensorflow", "deep_learning"],
  "ros": ["ros", "robotics_middleware"],
  "ros2": ["ros", "robotics_middleware"],
  "cuda": ["gpu_programming", "cuda"],
  "kubernetes": ["kubernetes", "distributed_systems"],
  "docker": ["containerization", "devops"],
  "spark": ["distributed_systems", "data_pipelines"],
  "c++": ["cpp"],
  "cpp": ["cpp"],
  "python": ["python"],
  "adas": ["adas_systems"],
  "advanced driver assistance": ["adas_systems"],
  "computer vision": ["computer_vision"],
  "machine learning": ["machine_learning"],
  "ml": ["machine_learning"],
  "autosar": ["autosar"],
  "iso 26262": ["functional_safety"],
  "functional safety": ["functional_safety"],
  "battery management": ["battery_management_systems"],
  "bms": ["battery_management_systems"],
  "high voltage": ["high_voltage_systems"],
  "thermal management": ["thermal_management"],
  "electric drivetrain": ["electric_drivetrain"],
  "e-drive": ["electric_drivetrain"],
  "cad": ["cad_cae_tools"],
  "catia": ["cad_cae_tools"],
  "solidworks": ["cad_cae_tools"],
  "fea": ["simulation_fea"],
  "finite element": ["simulation_fea"],
  "project management": ["project_management"],
  "agile": ["agile_methodologies"],
  "scrum": ["agile_methodologies"],
  "ci/cd": ["ci_cd_devops"],
  "devops": ["ci_cd_devops"],
  "jenkins": ["ci_cd_devops"],
  "github actions": ["ci_cd_devops"],
  "testing": ["testing_validation"],
  "validation": ["testing_validation"],
  "leadership": ["leadership"],
  "team lead": ["leadership"],
  "people management": ["leadership"],
  "data analysis": ["data_analysis"],
  "data science": ["data_analysis", "machine_learning"],
  "cloud": ["cloud_platforms"],
  "aws": ["cloud_platforms"],
  "azure": ["cloud_platforms"],
  "gcp": ["cloud_platforms"],
  "communication": ["communication_skills"],
};

// Also map normalized catalog names to snake_case keys used in role required_skills
const CATALOG_TO_ROLE_KEY: Record<string, string> = {
  "ADAS Systems": "adas_systems",
  "Computer Vision": "ComputerVision",
  "Sensor Fusion": "sensor_fusion",
  "ROS/ROS2": "ROS",
  "Deep Learning": "DeepLearning",
  "Python": "Python",
  "C/C++": "CppLanguage",
  "Embedded Systems": "embedded_systems",
  "AUTOSAR": "AUTOSAR",
  "Functional Safety": "FunctionalSafety",
  "Machine Learning": "MachineLearning",
  "Leadership": "leadership",
};

function normalizeSkillsToRoleKeys(
  skills: Array<{ name: string; proficiency: number; evidence: string }>,
  roleRequirements: Record<string, number>
): Record<string, { proficiency: number; evidence: string }> {
  const result: Record<string, { proficiency: number; evidence: string }> = {};
  const roleKeys = Object.keys(roleRequirements);
  const roleKeysLower = roleKeys.map((k) => k.toLowerCase());

  for (const skill of skills) {
    const skillNameLower = skill.name.toLowerCase().trim();

    // Direct match against role keys
    for (let i = 0; i < roleKeys.length; i++) {
      if (skillNameLower === roleKeysLower[i] || skillNameLower.includes(roleKeysLower[i]) || roleKeysLower[i].includes(skillNameLower)) {
        const key = roleKeys[i];
        if (!result[key] || result[key].proficiency < skill.proficiency) {
          result[key] = { proficiency: skill.proficiency, evidence: skill.evidence };
        }
      }
    }

    // Alias expansion
    const aliases = SKILL_ALIASES[skillNameLower];
    if (aliases) {
      for (const alias of aliases) {
        const aliasLower = alias.toLowerCase();
        for (let i = 0; i < roleKeys.length; i++) {
          if (aliasLower === roleKeysLower[i] || roleKeysLower[i].includes(aliasLower) || aliasLower.includes(roleKeysLower[i])) {
            const key = roleKeys[i];
            if (!result[key] || result[key].proficiency < skill.proficiency) {
              result[key] = { proficiency: skill.proficiency, evidence: skill.evidence };
            }
          }
        }
      }
    }

    // Catalog name mapping
    const catalogKey = CATALOG_TO_ROLE_KEY[skill.name];
    if (catalogKey) {
      for (let i = 0; i < roleKeys.length; i++) {
        if (catalogKey.toLowerCase() === roleKeysLower[i]) {
          const key = roleKeys[i];
          if (!result[key] || result[key].proficiency < skill.proficiency) {
            result[key] = { proficiency: skill.proficiency, evidence: skill.evidence };
          }
        }
      }
    }
  }

  return result;
}

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
        max_tokens: 2500,
        system: `You are a CV parser for BMW talent acquisition. Extract skills, experience, and qualifications from CVs.

EXPERIENCE DURATION CALCULATION (CRITICAL):
Calculate total_years_experience by identifying ALL work experience date ranges in the CV. For each role, compute the duration. Sum all durations. Return the total as a number. "Present" means 2026. Do not return the start year of the most recent role — return the TOTAL cumulative years across all roles. For example: "2021–Present" (5 years) + "2019–2021" (2 years) = 7 years total. Always return a number, never a string like "under 1 year."

SEMANTIC SKILL EXTRACTION (CRITICAL):
When extracting skills, map what the candidate DESCRIBES to their underlying technical competencies, not just the exact words. Examples:
- "Led perception pipeline development" → sensor_fusion, computer_vision, real_time_processing
- "Distributed processing with Spark and Kubernetes on 10M+ samples" → distributed_systems, data_pipelines, kubernetes, production_deployment
- "Deployed models on embedded hardware" → embedded_systems, ml_deployment, edge_computing
- "Reduced inference latency by 35%" → model_optimization, production_engineering
- "Cross-functional team of 6 engineers" → leadership, project_management
Always extract the underlying competency, not just the tool name.

PRODUCTION vs RESEARCH CLASSIFICATION (CRITICAL):
COUNTS AS PRODUCTION ENGINEERING regardless of industry:
- Systems processing data at scale (1M+ samples, distributed compute)
- Measurable latency, accuracy, or uptime improvements with specific numbers
- Deployment on physical hardware (embedded, edge, robotics)
- Cross-functional team coordination with real delivery timelines
- CI/CD, containerization (Docker/Kubernetes), or distributed infrastructure

COUNTS AS RESEARCH/ACADEMIC ONLY if:
- Work was exclusively in simulation with no hardware deployment
- No measurable real-world outcomes reported
- Output was only papers with no implementation artifact

Do not classify a candidate as "research only" if they show production signals from the list above, even if they work in a university lab or research group.

SKILL NAME NORMALISATION — map CV terminology to catalog names:
- "ADAS" / "advanced driver assistance" → "ADAS Systems"
- "computer vision" / "perception" / "object detection" → "Computer Vision"
- "lidar" / "radar" / "sensor fusion" → "Sensor Fusion"
- "ROS" / "robot operating system" → "ROS/ROS2"
- "deep learning" / "neural networks" / "CNN" / "transformer" → "Deep Learning"
- "Python" → "Python"
- "C++" / "cpp" → "C/C++"
- "embedded" / "embedded systems" → "Embedded Systems"
- "AUTOSAR" → "AUTOSAR"
- "functional safety" / "ISO 26262" → "Functional Safety"
- "machine learning" / "ML" → "Machine Learning"
- "perception pipeline" / "autonomous systems" → "Sensor Fusion", "Computer Vision"
- "PyTorch" / "TensorFlow" → "Deep Learning"
- "Kubernetes" / "Docker" → "Distributed Systems"
- "edge AI" / "embedded AI" → "Embedded Systems", "Deep Learning"
- "reinforcement learning" → "Machine Learning"
- "CUDA" → "GPU Programming"
- "leadership" / "team lead" → "Leadership"

Return ONLY valid JSON:
{
  "skills": [{"name": "normalized skill name", "proficiency": 1-5, "evidence": "brief evidence from CV"}],
  "total_years_experience": number,
  "experience_breakdown": [{"role": "job title", "start_year": number, "end_year": number, "duration_years": number}],
  "education": "highest degree and field",
  "education_level": "phd" | "masters" | "bachelors" | "other",
  "institution_tier": "top" | "mid" | "unknown",
  "experience_type": "production" | "mixed" | "research",
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
    const rawParsed = extractionMatch ? JSON.parse(extractionMatch[0]) : { skills: [], summary: "Could not parse CV" };

    // Normalize extracted skills against role requirements
    const extractedSkills = normalizeSkillsToRoleKeys(
      rawParsed.skills || [],
      roleRequirements || {}
    );

    // Build experience profile
    const totalYears = rawParsed.total_years_experience ?? rawParsed.experience_years ?? 0;
    const experienceProfile = {
      total_years: totalYears,
      experience_breakdown: rawParsed.experience_breakdown || [],
      education: rawParsed.education || "Unknown",
      education_level: rawParsed.education_level || "unknown",
      institution_tier: rawParsed.institution_tier || "unknown",
      experience_type: rawParsed.experience_type || "unknown",
      red_flags: [] as string[],
    };

    const parsed = {
      skills: rawParsed.skills,
      extracted_skills: extractedSkills,
      experience_profile: experienceProfile,
      summary: rawParsed.summary,
      education: rawParsed.education,
    };

    // ── Call 2: AI judgment ──
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
          max_tokens: 2000,
          system: `You are a senior BMW talent acquisition specialist. Rigorous, fair, evidence-focused.

CORE PRINCIPLE: A strong candidate built things, measured results, and owned outcomes.

=== STEP 1: VERB QUALITY ANALYSIS ===
Scan every bullet. Classify claims as BUILDER VERBS (built, designed, implemented, developed, led, owned, reduced by X%, achieved, deployed, optimized, engineered) vs PARTICIPANT VERBS (assisted, supported, contributed to, was involved in, familiar with, exposure to). Count ratio.

=== STEP 2: METRICS AND IMPACT ===
Count measurable outcomes: percentages, scale numbers, team sizes, latency reductions.

=== STEP 3: ABSENCE ANALYSIS ===
For each role requirement, ask: "Is there DIRECT evidence of ownership, indirect evidence, or nothing?"

=== STEP 4: SENIORITY CALIBRATION ===
Does evidence support the claimed seniority level?

=== STEP 5: PRODUCTION vs RESEARCH ===
COUNTS AS PRODUCTION regardless of employer:
- Systems at scale (1M+ samples, distributed compute)
- Measurable improvements with specific numbers
- Physical hardware deployment (embedded, edge, robotics)
- Cross-functional team delivery
- CI/CD, containerization, distributed infrastructure
Do NOT dismiss as "research" if production signals are present.

=== STEP 6: MISSING SKILLS POLICY (CRITICAL) ===
Missing automotive-specific stack items (AUTOSAR, ISO 26262, automotive production) should reduce worthiness score by 10–20 points but must NEVER be the sole reason for rejection. A candidate with strong domain-adjacent skills and 5+ years who is missing automotive stack items is a FLAG candidate, not a reject.

=== STEP 7: HIGH-POTENTIAL OVERRIDE (CRITICAL) ===
If a candidate holds a PhD or Masters AND has 4+ years experience AND demonstrates measurable production-scale impact (quantified improvements, large-scale systems, team leadership), the minimum outcome must be FLAG (ai_verdict = true with ai_confidence = "medium") regardless of missing domain-specific keywords. The verdict should note: "High-potential candidate. Missing automotive-specific stack but core engineering capabilities are exceptional. Recommend interview."

=== OUTPUT ===
Return ONLY valid JSON:
{
  "ai_verdict": boolean,
  "ai_confidence": "high" | "medium" | "low",
  "builder_verb_ratio": 0.0-1.0,
  "metrics_count": number,
  "verb_quality_assessment": "one sentence",
  "absence_analysis": {
    "critical_gaps": ["skills with no ownership evidence"],
    "indirect_only": ["skills mentioned as exposure only"],
    "well_evidenced": ["skills with builder verb + impact evidence"]
  },
  "high_potential_override": boolean,
  "ai_reasoning": "3-4 sentences with specific examples",
  "ai_key_strengths": ["specific evidenced strengths"],
  "ai_concerns": ["specific concerns"],
  "ai_recommended_preset": "technical_depth | hidden_potential | leadership_signals | ev_transition | digital_ai | cross_functional",
  "ai_recruiter_note": "one honest sentence"
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
