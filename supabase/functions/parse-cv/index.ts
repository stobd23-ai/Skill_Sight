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
  "iso 26262": ["functional_safety", "iso_26262"],
  "functional safety": ["functional_safety"],
  "battery management": ["battery_management_systems"],
  "bms": ["battery_management_system", "bms_development"],
  "battery management system": ["battery_management_system"],
  "battery systems engineering": ["ev_battery_systems", "battery_engineering"],
  "battery systems": ["ev_battery_systems", "battery_engineering"],
  "cell chemistry": ["battery_chemistry", "cell_technology"],
  "thermal management": ["battery_thermal_mgmt", "thermal_engineering", "thermal_management"],
  "thermal runaway": ["functional_safety", "battery_thermal_mgmt"],
  "soc estimation": ["bms_development", "battery_algorithms"],
  "soh estimation": ["bms_development", "battery_algorithms"],
  "state of charge": ["bms_development", "battery_algorithms"],
  "state of health": ["bms_development", "battery_algorithms"],
  "un 38.3": ["battery_safety_standards"],
  "iec 62660": ["battery_standards"],
  "matlab/simulink": ["matlab", "simulink", "modeling_simulation"],
  "matlab": ["matlab", "modeling_simulation"],
  "simulink": ["simulink", "modeling_simulation"],
  "ansys": ["fea_simulation", "thermal_simulation"],
  "comsol": ["multi_physics_simulation", "thermal_simulation"],
  "aging models": ["battery_chemistry", "degradation_modeling"],
  "degradation modeling": ["degradation_modeling", "battery_chemistry"],
  "pack design": ["battery_module_design", "ev_battery_systems"],
  "module design": ["battery_module_design", "ev_battery_systems"],
  "busbar design": ["battery_module_design"],
  "cell configuration": ["battery_module_design", "cell_technology"],
  "energy density": ["battery_engineering", "ev_battery_systems"],
  "gen5": ["ev_battery_systems", "battery_module_design"],
  "gensix": ["gen_six_architecture"],
  "gen six": ["gen_six_architecture"],
  "lithium-ion": ["battery_chemistry", "cell_technology"],
  "lithium ion": ["battery_chemistry", "cell_technology"],
  "electrochemical": ["battery_chemistry", "cell_technology"],
  "abuse testing": ["functional_safety", "battery_safety_standards"],
  "warranty": ["field_reliability", "quality_engineering"],
  "high voltage": ["high_voltage_systems"],
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

// Depth multipliers for coverage scoring
const DEPTH_MULTIPLIERS: Record<string, number> = {
  LOW: 0.3,
  MEDIUM: 0.65,
  HIGH: 1.0,
};

function normalizeSkillsToRoleKeys(
  skills: Array<{ name: string; proficiency: number; evidence: string; depth?: string; depth_signals?: any }>,
  roleRequirements: Record<string, number>
): Record<string, { proficiency: number; evidence: string; depth: string; depth_signals?: any }> {
  const result: Record<string, { proficiency: number; evidence: string; depth: string; depth_signals?: any }> = {};
  const roleKeys = Object.keys(roleRequirements);
  const roleKeysLower = roleKeys.map((k) => k.toLowerCase());

  for (const skill of skills) {
    const skillNameLower = skill.name.toLowerCase().trim();
    const depth = skill.depth || "MEDIUM";
    const depthMultiplier = DEPTH_MULTIPLIERS[depth] || 0.65;
    // Effective proficiency adjusted by depth
    const effectiveProf = Math.max(1, Math.round(skill.proficiency * depthMultiplier));

    const matchAndAdd = (key: string) => {
      if (!result[key] || result[key].proficiency < effectiveProf) {
        result[key] = { proficiency: effectiveProf, evidence: skill.evidence, depth, depth_signals: skill.depth_signals };
      }
    };

    // Direct match
    for (let i = 0; i < roleKeys.length; i++) {
      if (skillNameLower === roleKeysLower[i] || skillNameLower.includes(roleKeysLower[i]) || roleKeysLower[i].includes(skillNameLower)) {
        matchAndAdd(roleKeys[i]);
      }
    }

    // Alias expansion
    const aliases = SKILL_ALIASES[skillNameLower];
    if (aliases) {
      for (const alias of aliases) {
        const aliasLower = alias.toLowerCase();
        for (let i = 0; i < roleKeys.length; i++) {
          if (aliasLower === roleKeysLower[i] || roleKeysLower[i].includes(aliasLower) || aliasLower.includes(roleKeysLower[i])) {
            matchAndAdd(roleKeys[i]);
          }
        }
      }
    }

    // Catalog name mapping
    const catalogKey = CATALOG_TO_ROLE_KEY[skill.name];
    if (catalogKey) {
      for (let i = 0; i < roleKeys.length; i++) {
        if (catalogKey.toLowerCase() === roleKeysLower[i]) {
          matchAndAdd(roleKeys[i]);
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

    // ── Call 1: CV skill extraction with depth scoring ──
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
        max_tokens: 4000,
        system: `You are a CV parser for BMW talent acquisition. Extract skills, experience, and qualifications from CVs with rigorous depth analysis.

=== EXPERIENCE DURATION CALCULATION (CRITICAL) ===
Calculate total_years_experience by identifying EVERY work experience entry in the CV.
For each role extract start_year and end_year.
"Present", "current", "now", "ongoing" all mean 2026.
Compute duration_years = end_year - start_year for each role.
Sum ALL durations to get total_years_experience.
Never return the start year of the most recent role as the total.
Never return a string — always return a number rounded to 1 decimal place.
Example:
  Role A: 2021–Present = 5 years
  Role B: 2019–2021 = 2 years
  total_years_experience = 7.0

=== SKILL DEPTH SCORING (CRITICAL) ===
For each skill, assess depth using these rules:

PARTICIPANT VERB LIST (apply 0.4 multiplier if skill is accompanied ONLY by these):
"assisted", "supported", "helped", "participated", "involved in", "contributed to", "worked on", "part of", "exposure to", "familiar with"

VAGUE PHRASE LIST (force depth to LOW regardless of verb):
"various projects", "multiple systems", "different environments", "extensive experience", "strong background in", "proficient in"

Depth classification:
LOW: skill mentioned or listed without context, or accompanied only by vague phrases
  "Python" in a skills list → LOW
  "familiar with ROS" → LOW
  "extensive experience in machine learning" → LOW (vague intensifier)

MEDIUM: skill used in a described project or task with some specifics
  "used PyTorch to train object detection models" → MEDIUM
  "implemented sensor fusion module" → MEDIUM

HIGH: skill used with measurable outcome, production context, or leadership
  "built PyTorch pipeline reducing inference latency 35% on edge GPU" → HIGH
  "led sensor fusion architecture across 3-sensor modality system deployed at 10M+ scale" → HIGH

=== METRIC QUALITY DETECTION ===
For each quantified claim found, classify quality:
WEAK: number present but missing 2+ of: what improved, how achieved, where/context, scale
MEDIUM: number present with 2 of the above fields
STRONG: number present with 3-4 of the above fields

"Improved accuracy by 20%" → WEAK (missing how, where)
"Reduced latency by 35% using quantization" → MEDIUM (what + how, no where)
"Reduced inference latency by 35% using quantization on edge GPU processing 10M+ samples" → STRONG

=== ROBUSTNESS TO WRITING STYLE ===
PROJECT COMPLEXITY SIGNAL: If a project involves 3+ distinct technical components working together, score as HIGH complexity equivalent to 1 strong metric even without numbers.

TECHNICAL STACK COHERENCE: If skills form a coherent, non-random stack (e.g. PyTorch + CUDA + ROS + C++ + Kubernetes = coherent ML systems stack), this is a positive depth signal. Random unrelated tools is negative.

PUBLICATION SIGNAL: A peer-reviewed publication at a named venue (IEEE, CVPR, ICRA, NeurIPS, ICLR, IROS, etc.) counts as:
- 1 strong metric equivalent
- HIGH depth evidence for the domain of the paper
- Overrides "research only" classification for that domain
Never penalize candidates for having publications.

Strong engineers often write tersely. Absence of polish is not evidence of absence of capability.

=== SEMANTIC SKILL EXTRACTION ===
Map what the candidate DESCRIBES to underlying technical competencies:
- "Led perception pipeline development" → sensor_fusion, computer_vision, real_time_processing
- "Distributed processing with Spark and Kubernetes on 10M+ samples" → distributed_systems, data_pipelines, kubernetes
- "Deployed models on embedded hardware" → embedded_systems, ml_deployment, edge_computing

=== PRODUCTION vs RESEARCH CLASSIFICATION ===
COUNTS AS PRODUCTION regardless of industry:
- Systems processing data at scale (1M+ samples, distributed compute)
- Measurable latency, accuracy, or uptime improvements
- Deployment on physical hardware (embedded, edge, robotics)
- Cross-functional team coordination with delivery timelines
- CI/CD, containerization, distributed infrastructure

=== SENIORITY CONSISTENCY CHECK ===
Extract the most senior title claimed. Compare against builder_verb_ratio and metrics.
If title contains "Senior"/"Lead"/"Principal"/"Head"/"Director":
  - AND builder verbs < 40% of total → flag "seniority_mismatch"
  - AND metrics < 2 → flag "seniority_unsubstantiated"
  - AND builder verbs >= 60% AND metrics >= 3 → mark "seniority_validated"

=== SKILL NAME NORMALISATION ===
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
- "CUDA" → "GPU Programming"
- "leadership" / "team lead" → "Leadership"

Return ONLY valid JSON:
{
  "skills": [
    {
      "name": "normalized skill name",
      "proficiency": 1-5,
      "evidence": "single best sentence from CV",
      "depth": "LOW" | "MEDIUM" | "HIGH",
      "depth_signals": {
        "verb_strength": "weak" | "moderate" | "strong",
        "metric_present": boolean,
        "context": "mentioned" | "project" | "production" | "led",
        "repetition": number
      }
    }
  ],
  "total_years_experience": number,
  "experience_breakdown": [
    {"role_title": "string", "company": "string", "start_year": number, "end_year": number, "duration_years": number}
  ],
  "education": "highest degree and field",
  "education_level": "phd" | "masters" | "bachelors" | "other",
  "institution_tier": "top" | "mid" | "unknown",
  "experience_type": "production" | "mixed" | "research",
  "most_senior_title": "string",
  "seniority_check": "validated" | "mismatch" | "unsubstantiated" | "not_applicable",
  "builder_verb_ratio": 0.0-1.0,
  "metrics": [
    {
      "raw_text": "string",
      "quality": "WEAK" | "MEDIUM" | "STRONG",
      "has_what": boolean,
      "has_how": boolean,
      "has_where": boolean,
      "has_scale": boolean
    }
  ],
  "publications": ["venue names if any"],
  "stack_coherence": "coherent" | "mixed" | "scattered",
  "project_complexity_signals": number,
  "summary": "2-3 sentence professional summary"
}`,
        messages: [
          {
            role: "user",
            content: `Parse this CV for the role of ${targetRole} (role type: ${targetRoleType || "technical_specialist"}):\n\n${cvText.slice(0, 8000)}`,
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

    // Process metrics into categorized counts
    const metrics = rawParsed.metrics || [];
    const strongMetrics = metrics.filter((m: any) => m.quality === "STRONG").length;
    const mediumMetrics = metrics.filter((m: any) => m.quality === "MEDIUM").length;
    const weakMetrics = metrics.filter((m: any) => m.quality === "WEAK").length;
    // Publication bonus
    const publicationCount = (rawParsed.publications || []).length;
    const effectiveStrongMetrics = strongMetrics + publicationCount;

    // Build experience profile
    const totalYears = rawParsed.total_years_experience ?? rawParsed.experience_years ?? 0;
    const experienceProfile = {
      total_years: totalYears,
      experience_breakdown: rawParsed.experience_breakdown || [],
      education: rawParsed.education || "Unknown",
      education_level: rawParsed.education_level || "unknown",
      institution_tier: rawParsed.institution_tier || "unknown",
      experience_type: rawParsed.experience_type || "unknown",
      most_senior_title: rawParsed.most_senior_title || null,
      seniority_check: rawParsed.seniority_check || "not_applicable",
      builder_verb_ratio: rawParsed.builder_verb_ratio ?? null,
      strong_metrics_count: effectiveStrongMetrics,
      medium_metrics_count: mediumMetrics,
      weak_metrics_count: weakMetrics,
      publications: rawParsed.publications || [],
      stack_coherence: rawParsed.stack_coherence || "mixed",
      project_complexity_signals: rawParsed.project_complexity_signals || 0,
      red_flags: [] as string[],
    };

    // Add seniority-based red flags
    if (rawParsed.seniority_check === "mismatch") {
      experienceProfile.red_flags.push("Seniority mismatch — senior title with low ownership evidence");
    }
    if (rawParsed.seniority_check === "unsubstantiated") {
      experienceProfile.red_flags.push("Senior-level claim without quantified impact");
    }

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
          max_tokens: 2500,
          system: `You are a senior BMW talent acquisition specialist. Rigorous, fair, evidence-focused.

CORE PRINCIPLE: A strong candidate built things, measured results, and owned outcomes.

=== STEP 1: VERB QUALITY ANALYSIS ===
Scan every bullet. Classify as BUILDER VERBS (built, designed, implemented, developed, led, owned, reduced by X%, achieved, deployed, optimized, engineered, created, architected) vs PARTICIPANT VERBS (assisted, supported, contributed to, was involved in, familiar with, exposure to, worked on, part of, helped, participated).
Count ratio. Apply 0.4 multiplier to any skill accompanied only by participant verbs.

=== STEP 2: METRIC QUALITY ===
Classify each metric:
STRONG: has what improved + how + where/context + scale (3+ fields)
MEDIUM: has 2 fields
WEAK: has 1 or fewer fields
Only count STRONG + MEDIUM as "measurable impacts."

=== STEP 3: ABSENCE ANALYSIS ===
For each role requirement, check for DIRECT evidence of ownership, not just mentions.

=== STEP 4: SENIORITY CALIBRATION ===
Verify title claims against evidence depth.

=== STEP 5: PRODUCTION vs RESEARCH ===
COUNTS AS PRODUCTION regardless of employer:
- Systems at scale (1M+ samples, distributed compute)
- Measurable improvements with specific numbers
- Physical hardware deployment (embedded, edge, robotics)
- Cross-functional team delivery
- CI/CD, containerization, distributed infrastructure
A publication at a named IEEE/ACM venue is evidence of production-grade work even in research context.

=== STEP 6: MISSING SKILLS — ROLE-TYPE AWARE ===
For role_type "emerging_tech" or "adas_software":
  core_capability (perception, sensor_fusion, real_time, cpp): weight 0.85–0.95
  domain_specific (autosar, iso_26262, automotive_production): weight 0.40–0.55
  Missing domain_specific = TRAINABLE gap (AUTOSAR: 2-3mo, ISO 26262: 3-4mo)
  Missing core_capability = CRITICAL gap
  Never classify AUTOSAR/ISO 26262 absence as disqualifying when core perception + real-time + C++ are HIGH depth.

For role_type "technical_specialist" or "safety_critical":
  Both core and domain skills: weight 0.75–0.85
  Missing domain_specific = CRITICAL

=== STEP 7: HIGH-POTENTIAL OVERRIDE ===
If candidate has PhD/Masters AND 4+ years AND 3+ strong/medium metrics AND builder_verb_ratio >= 0.50:
  Minimum outcome = FLAG (ai_verdict = true, ai_confidence = "medium")
  Note: "High-potential candidate. Core capabilities exceptional. Recommend interview."

=== STEP 8: ROBUSTNESS ===
Strong engineers often write tersely. Absence of polish is not absence of capability.
If technical stack is coherent, project scope is complex, and publication/deployment signals present, assess capability as PRESENT even with minimal prose.

Return ONLY valid JSON:
{
  "ai_verdict": boolean,
  "ai_confidence": "high" | "medium" | "low",
  "builder_verb_ratio": 0.0-1.0,
  "strong_metrics_count": number,
  "medium_metrics_count": number,
  "weak_metrics_count": number,
  "verb_quality_assessment": "one sentence",
  "absence_analysis": {
    "critical_gaps": ["skills with no ownership evidence"],
    "trainable_gaps": ["domain skills learnable in 2-6 months"],
    "indirect_only": ["skills mentioned as exposure only"],
    "well_evidenced": ["skills with builder verb + impact evidence"]
  },
  "high_potential_override": boolean,
  "domain_gap_classification": "trainable" | "critical" | "mixed",
  "ai_reasoning": "3 sentences maximum with specific examples",
  "ai_key_strengths": ["max 3 specific evidenced strengths"],
  "ai_concerns": ["max 3 specific concerns"],
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

    // ── Post-processing: Rule-based confidence calibration (FIX 9) ──
    if (aiJudgment) {
      const algoDirection = Object.keys(extractedSkills).length / Math.max(Object.keys(roleRequirements || {}).length, 1) >= 0.35;
      const aiDirection = aiJudgment.ai_verdict === true;
      const bvr = experienceProfile.builder_verb_ratio ?? aiJudgment.builder_verb_ratio ?? 0.5;
      const skillCoverage = Object.keys(extractedSkills).length / Math.max(Object.keys(roleRequirements || {}).length, 1);
      const hasSeniorityMismatch = experienceProfile.seniority_check === "mismatch";

      let calibratedConfidence: string;

      // LOW conditions
      const directionDisagree = algoDirection !== aiDirection;
      const ambiguousBvr = bvr >= 0.40 && bvr <= 0.55;
      const expUnreliable = totalYears <= 0;

      if (directionDisagree || expUnreliable || ambiguousBvr || hasSeniorityMismatch) {
        calibratedConfidence = "low";
      } else if (
        algoDirection === aiDirection &&
        totalYears > 0 &&
        (bvr > 0.55 || bvr < 0.35) &&
        (skillCoverage > 0.60 || skillCoverage < 0.25)
      ) {
        calibratedConfidence = "high";
      } else {
        calibratedConfidence = "medium";
      }

      // Override AI self-reported confidence
      aiJudgment.calibrated_confidence = calibratedConfidence;

      // Seniority penalty on score
      if (hasSeniorityMismatch) {
        aiJudgment.seniority_penalty = true;
      }
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
