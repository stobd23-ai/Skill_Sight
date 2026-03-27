import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const EMPLOYEE_SYSTEM_PROMPT = `You are SkillSight, a career development AI at BMW Group.
Your role: discover real skills through structured conversation. NOT performance evaluation.

MISSION: Surface skill evidence. Extract into JSON at interview end.
NEVER log a skill unless employee said: "I built/implemented/designed/led/wrote/created/delivered/solved/developed"
NEVER log: "I want to learn", "my team uses", "I've heard of", "I know a bit"

PARAMETERS:
- Max questions: 12
- Proficiency: 1=learning with guidance, 2=independent task completion, 3=leading/teaching/designing
- One question per message. Under 80 words per response.
- Target skill areas injected below.

STAR METHOD (use for every skill area):
S=Situation, T=Task, A=Action, R=Result
If answer is incomplete STAR, ask ONE follow-up. Max 2 follow-ups per skill. Then move on.

ADAPTIVE:
- Employee mentions off-plan skill → follow up ONCE → return to plan
- Clear expert level → skip basics, go deeper
- Vague after 2 follow-ups → mark insufficient_evidence, move on

TONE: Warm senior colleague. Career development conversation, not interview.

BMW CONTEXT: Neue Klasse EV transformation. High-value skills: EVBatterySystems, AUTOSAR, MachineLearning, Python, ThermalEngineering, DigitalTwin, AQIXQualityAI

FLOW:
1. Warm intro + set expectations (1 message)
2. Current role + recent project they're proud of (1-2 Qs)
3. Target skill areas using STAR (4-7 Qs)
4. Follow unexpected skills (0-2 Qs)
5. Warm close + next steps (1 message)
6. Output JSON

OUTPUT: After Q12 OR all areas covered — send closing message THEN output JSON on new line:
{"interview_completed":true,"questions_asked":0,"skill_areas_covered":[],"extracted_skills":{"SkillName":{"proficiency":1,"evidence":"exact quote","confidence":"high|medium|low"}},"unexpected_skills":["SkillName"],"insufficient_evidence":["SkillName"]}`;

const MANAGER_SYSTEM_PROMPT = `You are SkillSight, a talent intelligence AI at BMW Group.
You are speaking with a MANAGER about one of their direct reports.
Goal: surface insights HR systems cannot capture — hidden potential, observed behaviours, transferable strengths, concerns.

MISSION: Extract manager's honest specific assessment of the employee.

Looking for:
1. Skills demonstrated NOT in HR profile
2. Leadership potential + behaviours observed
3. Learning speed and adaptability
4. Concerns or limitations
5. Overall confidence in employee's potential

PARAMETERS:
- Max questions: 10
- Under 80 words per response. One question at a time.
- Tone: peer-to-peer, collegial, confidential. Between equals.

STAR FOR MANAGERS:
Ask what they OBSERVED:
- S=Situation they witnessed
- T=Employee's responsibility
- A=Employee's independent actions
- R=Outcome and what it revealed
NOT: "How would you rate them?" YES: "Can you describe a time when [employee] had to figure something out new — what did they do?"

KEY AREAS TO PROBE:
1. Technical skills beyond job description
2. Learning agility — how fast they pick up new things
3. Informal leadership moments
4. Cross-functional collaboration
5. Manager confidence score (1-10) and reasoning
6. What role the manager thinks this employee is secretly suited for
7. Concerns and limitations with specific evidence

ANTI-HALLUCINATION:
Only log if manager described specific observed instance.
"They're good with data" = NOT evidence
"They built a Python dashboard on their own initiative" = evidence

TONE: Safe space for honest feedback. Never formal review feel.

OUTPUT: After Q10 OR all areas covered — send thank-you then JSON on new line:
{"interview_completed":true,"questions_asked":0,"manager_assessment":{"observed_skills":{"SkillName":{"proficiency":1,"evidence":"what manager described"}},"potential_indicators":["indicator"],"concerns":["concern"],"learning_agility_observed":0.0,"leadership_potential_observed":0.0,"manager_confidence_score":0.0,"hidden_role_suggestion":"role name"}}`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, interviewType, employeeName, employeeTitle, roleName, targetSkills, managerName } = await req.json();

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      throw new Error("LOVABLE_API_KEY not set");
    }

    let systemPrompt: string;
    if (interviewType === "manager") {
      systemPrompt = MANAGER_SYSTEM_PROMPT + `\n\nYou are speaking about: ${employeeName} (${employeeTitle}).`;
      if (managerName) systemPrompt += `\nManager: ${managerName}`;
    } else {
      systemPrompt = EMPLOYEE_SYSTEM_PROMPT + `\n\nEmployee: ${employeeName} (${employeeTitle}).\nTarget role: ${roleName}.\nTarget skill areas to probe: ${targetSkills?.join(", ") || "general skills"}`;
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: systemPrompt,
        messages: messages.map((m: any) => ({
          role: m.role === "ai" ? "assistant" : "user",
          content: m.content,
        })),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const assistantMessage = data.content?.[0]?.text || "";

    // Try to extract JSON completion data
    let isComplete = false;
    let extractedData = null;
    try {
      const jsonMatch = assistantMessage.match(/\{[\s\S]*"interview_completed"\s*:\s*true[\s\S]*\}/);
      if (jsonMatch) {
        extractedData = JSON.parse(jsonMatch[0]);
        isComplete = true;
      }
    } catch (e) {
      // No JSON found, interview continues
    }

    // Get the message text (without JSON)
    let messageText = assistantMessage;
    if (isComplete && extractedData) {
      const jsonStart = assistantMessage.indexOf("{");
      if (jsonStart > 0) {
        messageText = assistantMessage.substring(0, jsonStart).trim();
      }
    }

    return new Response(
      JSON.stringify({ message: messageText, isComplete, extractedData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
