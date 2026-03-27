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

const PRESET_BLOCKS: Record<string, string> = {
  technical_depth: `INTERVIEW FOCUS: Technical Depth Explorer
Starting ideas (not a script — adapt freely based on answers):
- Ask about the most technically complex thing they've built or solved
- Explore what tools, languages, or systems they've worked with hands-on
- Probe for depth: what happens when they get stuck on a technical problem?
- Ask about something they figured out on their own with no guidance
- Explore if they've ever taught or documented a technical skill for others
- Look for evidence of going beyond their job description technically
Key signals to listen for: self-directed learning, debugging instinct, systems thinking, tool mastery`,

  hidden_potential: `INTERVIEW FOCUS: Hidden Potential Finder
Starting ideas (not a script — adapt freely based on answers):
- Ask what they do outside their official responsibilities that they enjoy
- Explore side projects, personal initiatives, or things they built without being asked
- Ask if there's a problem at BMW they've thought about solving but nobody asked them to
- Probe for moments where they stepped up unexpectedly
- Explore what they'd do if they could redesign part of their team or process
- Ask what skills they have that BMW doesn't currently use
Key signals to listen for: initiative, self-motivation, cross-boundary thinking, untapped skills`,

  leadership_signals: `INTERVIEW FOCUS: Leadership Signals
Starting ideas (not a script — adapt freely based on answers):
- Ask about a time they influenced a decision without having formal authority
- Explore moments where they helped a colleague or junior team member
- Ask about a project where they had to coordinate people across teams
- Probe for how they handle disagreement with peers or managers
- Ask what they do when a project is going wrong and they're not in charge
- Explore if they've ever started something that others adopted
Key signals to listen for: influence without authority, team orientation, accountability taking, vision-setting`,

  ev_transition: `INTERVIEW FOCUS: EV & Neue Klasse Transition
Starting ideas (not a script — adapt freely based on answers):
- Ask what they know about BMW's Neue Klasse platform from their day-to-day work
- Explore any experience with high-voltage systems, battery components, or thermal management
- Ask if they've worked on anything connected to electrification — even indirectly
- Probe for self-study or curiosity: have they researched EV technology on their own?
- Ask how their current engineering skills could apply to an EV context
- Explore their comfort with learning something technically unfamiliar under time pressure
Key signals to listen for: EV-adjacent skills, learning orientation, curiosity about electrification, transferable engineering depth`,

  digital_ai: `INTERVIEW FOCUS: Digital & AI Readiness
Starting ideas (not a script — adapt freely based on answers):
- Ask if they've worked with any data — even spreadsheets, reports, or simple automation
- Explore if they've used Python, SQL, or any scripting tools (even basic)
- Ask about their experience with BMW's digital tools — SAP, digital twin systems, dashboards
- Probe for comfort with uncertainty and experimentation
- Ask what digital tools or skills they've picked up in the last 2 years on their own
- Explore their reaction to BMW's Digital Boost programme
Key signals to listen for: data curiosity, tool comfort, learning without formal training, openness to AI augmentation`,

  cross_functional: `INTERVIEW FOCUS: Cross-Functional Collaborator
Starting ideas (not a script — adapt freely based on answers):
- Ask about a time they worked closely with a team very different from their own
- Explore how they communicate technical topics to non-technical people
- Ask about a moment where two teams disagreed and how they navigated it
- Probe for stakeholder management
- Ask about a cross-department project — what worked, what didn't, what they learned
- Explore how they build trust with people who have different priorities
Key signals to listen for: adaptability, empathy, communication range, political awareness, bridge-building`,
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, interviewType, employeeName, employeeTitle, roleName, targetSkills, managerName, presetPack } = await req.json();

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

    // Inject preset pack if provided
    if (presetPack && PRESET_BLOCKS[presetPack]) {
      systemPrompt += `\n\n${PRESET_BLOCKS[presetPack]}`;
      systemPrompt += `\n\nIMPORTANT: These are starting INSPIRATIONS only. Do not follow them rigidly. If the employee's answers take the conversation somewhere more interesting and relevant, follow that thread. Always prioritise rich evidence over topic coverage.`;
    }

    const chatMessages = [
      { role: "system", content: systemPrompt },
      ...messages.map((m: any) => ({
        role: m.role === "ai" ? "assistant" : "user",
        content: m.content,
      })),
    ];

    if (messages.length === 0) {
      chatMessages.push({ role: "user", content: "Hello, I'm ready to begin." });
    }

    // Ensure conversation doesn't end with assistant message (prevents AI responding to itself)
    // Filter out any consecutive assistant messages and ensure proper turn-taking
    const cleanedMessages: any[] = [];
    for (const msg of chatMessages) {
      if (msg.role === "system") {
        cleanedMessages.push(msg);
        continue;
      }
      // Skip assistant messages that follow another assistant message
      const lastNonSystem = cleanedMessages.filter(m => m.role !== "system").pop();
      if (msg.role === "assistant" && lastNonSystem?.role === "assistant") {
        continue;
      }
      cleanedMessages.push(msg);
    }

    // If last message is from assistant, add a nudge so AI doesn't respond to itself
    const lastMsg = cleanedMessages[cleanedMessages.length - 1];
    if (lastMsg?.role === "assistant") {
      cleanedMessages.push({ role: "user", content: "[waiting for employee response — do not generate another message]" });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: cleanedMessages,
        temperature: 0.6,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again shortly." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", status, errorText);
      throw new Error(`AI gateway error: ${status}`);
    }

    const data = await response.json();
    const assistantMessage = data.choices?.[0]?.message?.content || "";

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
    console.error("Interview chat error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
