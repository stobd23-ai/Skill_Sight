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
    const { cvText, targetRole, targetRoleType } = await req.json();

    if (!cvText || !targetRole) {
      return new Response(JSON.stringify({ error: 'cvText and targetRole are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not set');

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
Map skills to common SkillSight taxonomy: Python, MachineLearning, DeepLearning, DataEngineering, CloudComputing, DevOps, ProjectManagement, SystemsEngineering, ThermalEngineering, EVBatterySystems, AUTOSAR, ManufacturingProcesses, QualityManagement, AgileMethodology, TechnicalCommunication, LeadershipSkills, etc.

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
    
    // Extract JSON from response
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

    return new Response(JSON.stringify({ parsed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
