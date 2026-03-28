import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cvText, targetRole, targetRoleType, roleRequirements } = await req.json();

    if (!cvText || !targetRole) {
      return new Response(JSON.stringify({ error: 'cvText and targetRole are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not set');

    // ── Call 1: CV skill extraction ──
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are a CV parsing engine for BMW Group's SkillSight platform.
You receive raw CV/resume text and a target role name.
Extract structured data from the CV.

SKILL NAME NORMALISATION — always map these to the catalog name:
ROS2, ROS 2 → ROS
ISO 26262, ISO26262, Functional Safety, ASIL → FunctionalSafety
PyTorch, TensorFlow, Keras, Scikit-learn → DeepLearning or MachineLearning
CUDA, GPU Programming → DeepLearning
LiDAR, Radar, Sensor Fusion, Kalman Filter → SensorFusion
SLAM, Localisation → EmbeddedSystems
Object Detection, Perception → ComputerVision
Trajectory Prediction, Path Planning, Motion Planning → ADAS
Automotive-grade software, AUTOSAR Classic, AUTOSAR Adaptive → AUTOSAR
Embedded AI, Real-time systems → EmbeddedSystems
C++, Cpp, C Plus Plus → CppLanguage
Docker, Kubernetes, CI/CD → MLOps
Leadership, Team Lead, Cross-functional coordination → TeamLeadership
Publications, Speaker, Research → TechnicalMentoring

Return ONLY valid JSON with this exact structure:
{
  "extracted_skills": {
    "SkillName": {
      "proficiency": 0-3,
      "evidence": "brief quote or description from CV",
      "source": "cv"
    }
  },
  "experience_profile": {
    "total_years": number,
    "current_title": "string",
    "current_company": "string",
    "domain_experience": ["domain1", "domain2"],
    "education": "highest degree",
    "red_flags": ["any concerns"],
    "strengths": ["notable strengths from CV"]
  },
  "candidate_summary": "2-3 sentence summary of the candidate"
}

Proficiency scale:
0 = mentioned but no evidence of real use
1 = basic / beginner level evidence  
2 = intermediate / solid working experience
3 = expert / deep experience with multiple examples

Be generous with skill extraction - infer skills from described work even if not explicitly listed.
Map skills to common SkillSight taxonomy: Python, MachineLearning, DeepLearning, DataEngineering, CloudComputing, DevOps, ProjectManagement, SystemsEngineering, ThermalEngineering, EVBatterySystems, AUTOSAR, ManufacturingProcesses, QualityManagement, AgileMethodology, TechnicalCommunication, LeadershipSkills, CppLanguage, ComputerVision, SensorFusion, ADAS, EmbeddedSystems, FunctionalSafety, MLOps, TeamLeadership, TechnicalMentoring, ROS, etc.

Target role: ${targetRole}
Role type: ${targetRoleType || 'technical_specialist'}`
          },
          {
            role: 'user',
            content: `Parse this CV and extract skills relevant to the "${targetRole}" role:\n\n${cvText.slice(0, 8000)}`
          }
        ],
        temperature: 0.3,
        max_tokens: 3000,
      }),
    });

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content || '';
    
    let parsed;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch {
      parsed = null;
    }

    if (!parsed) {
      return new Response(JSON.stringify({ error: 'Failed to parse CV', raw: content }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ── Call 2: AI Judgment (recruiter assessment) ──
    let aiJudgment = null;
    try {
      const judgmentResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            {
              role: 'system',
              content: `You are a senior BMW talent acquisition specialist with 15 years hiring technical engineers.

Your job: read this CV and give your honest professional judgment on whether this candidate deserves an interview for this specific role.

HOW YOU THINK:
- Look at the whole picture: education trajectory, domain experience, depth of achievements, career direction
- You understand that terminology differs: ROS2=ROS, ISO26262=FunctionalSafety, PyTorch=DeepLearning
- PhD in the exact domain + industry experience = very strong signal
- Currently doing the job at a competitor or at BMW = very strong signal
- Measurable achievements, patents, publications = strong signal
- Career trajectory clearly heading toward this role = positive signal
- You are not fooled by keyword gaps when domain expertise is obvious
- You are not fooled by keyword-stuffed CVs with no real depth

WHEN TO SAY NOT WORTHY:
- Background is in a completely unrelated domain with no bridge
- Under 1 year experience for a senior technical role
- No evidence of technical depth in the relevant area
- Clear inconsistencies or signs of fabrication
- Genuinely very poor fit — not just vocabulary mismatch

IMPORTANT: If uncertain, lean toward worthy. The interview exists to verify.
A false rejection costs more than a wasted interview slot.

Return ONLY valid JSON:
{
  "ai_verdict": true,
  "ai_confidence": "high",
  "ai_reasoning": "2-3 sentences — specific, referencing actual CV content, written like a recruiter",
  "ai_key_strengths": ["specific strength from CV", "specific strength from CV"],
  "ai_concerns": ["specific concern if any"],
  "ai_recommended_preset": "technical_depth | hidden_potential | leadership_signals | ev_transition | digital_ai | cross_functional",
  "ai_recruiter_note": "one honest sentence a recruiter would say about this person"
}`
            },
            {
              role: 'user',
              content: `TARGET ROLE: ${targetRole} (${targetRoleType || 'technical_specialist'})

ROLE REQUIREMENTS:
${JSON.stringify(roleRequirements || {})}

EXTRACTED CANDIDATE PROFILE:
${JSON.stringify(parsed)}

FULL CV TEXT:
${cvText.slice(0, 6000)}`
            }
          ],
          temperature: 0.1,
          max_tokens: 800,
        }),
      });

      const judgmentData = await judgmentResponse.json();
      const judgmentContent = judgmentData.choices?.[0]?.message?.content || '';
      const judgmentMatch = judgmentContent.match(/\{[\s\S]*\}/);
      if (judgmentMatch) {
        aiJudgment = JSON.parse(judgmentMatch[0]);
      }
    } catch (e) {
      console.error("AI judgment call failed (non-blocking):", e);
    }

    return new Response(JSON.stringify({ parsed, aiJudgment }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
