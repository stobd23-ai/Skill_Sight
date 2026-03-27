import { Code2, Sparkles, Users, Zap, Cpu, Network } from "lucide-react";

export interface PresetPack {
  id: string;
  name: string;
  description: string;
  icon: any;
  prompt: string;
}

export const PRESET_PACKS: PresetPack[] = [
  {
    id: "technical_depth",
    name: "Technical Depth",
    description: "Uncover deep technical expertise and hands-on engineering skills",
    icon: Code2,
    prompt: `INTERVIEW FOCUS: Technical Depth Explorer
Starting ideas (not a script — adapt freely based on answers):
- Ask about the most technically complex thing they've built or solved
- Explore what tools, languages, or systems they've worked with hands-on
- Probe for depth: what happens when they get stuck on a technical problem?
- Ask about something they figured out on their own with no guidance
- Explore if they've ever taught or documented a technical skill for others
- Look for evidence of going beyond their job description technically
Key signals to listen for: self-directed learning, debugging instinct, systems thinking, tool mastery`,
  },
  {
    id: "hidden_potential",
    name: "Hidden Potential",
    description: "Surface skills and abilities not visible in their current role",
    icon: Sparkles,
    prompt: `INTERVIEW FOCUS: Hidden Potential Finder
Starting ideas (not a script — adapt freely based on answers):
- Ask what they do outside their official responsibilities that they enjoy
- Explore side projects, personal initiatives, or things they built without being asked
- Ask if there's a problem at BMW they've thought about solving but nobody asked them to
- Probe for moments where they stepped up unexpectedly
- Explore what they'd do if they could redesign part of their team or process
- Ask what skills they have that BMW doesn't currently use
Key signals to listen for: initiative, self-motivation, cross-boundary thinking, untapped skills`,
  },
  {
    id: "leadership_signals",
    name: "Leadership Signals",
    description: "Identify informal leadership moments and team influence",
    icon: Users,
    prompt: `INTERVIEW FOCUS: Leadership Signals
Starting ideas (not a script — adapt freely based on answers):
- Ask about a time they influenced a decision without having formal authority
- Explore moments where they helped a colleague or junior team member
- Ask about a project where they had to coordinate people across teams
- Probe for how they handle disagreement with peers or managers
- Ask what they do when a project is going wrong and they're not in charge
- Explore if they've ever started something that others adopted
Key signals to listen for: influence without authority, team orientation, accountability taking, vision-setting`,
  },
  {
    id: "ev_transition",
    name: "EV Transition",
    description: "Assess readiness for BMW's electric transformation",
    icon: Zap,
    prompt: `INTERVIEW FOCUS: EV & Neue Klasse Transition
Starting ideas (not a script — adapt freely based on answers):
- Ask what they know about BMW's Neue Klasse platform from their day-to-day work
- Explore any experience with high-voltage systems, battery components, or thermal management
- Ask if they've worked on anything connected to electrification — even indirectly
- Probe for self-study or curiosity: have they researched EV technology on their own?
- Ask how their current engineering skills could apply to an EV context
- Explore their comfort with learning something technically unfamiliar under time pressure
Key signals to listen for: EV-adjacent skills, learning orientation, curiosity about electrification, transferable engineering depth`,
  },
  {
    id: "digital_ai",
    name: "Digital & AI Readiness",
    description: "Gauge data, software, and AI literacy for digital roles",
    icon: Cpu,
    prompt: `INTERVIEW FOCUS: Digital & AI Readiness
Starting ideas (not a script — adapt freely based on answers):
- Ask if they've worked with any data — even spreadsheets, reports, or simple automation
- Explore if they've used Python, SQL, or any scripting tools (even basic)
- Ask about their experience with BMW's digital tools — SAP, digital twin systems, dashboards
- Probe for comfort with uncertainty and experimentation
- Ask what digital tools or skills they've picked up in the last 2 years on their own
- Explore their reaction to BMW's Digital Boost programme
Key signals to listen for: data curiosity, tool comfort, learning without formal training, openness to AI augmentation`,
  },
  {
    id: "cross_functional",
    name: "Cross-Functional",
    description: "Assess collaboration skills and organisational impact",
    icon: Network,
    prompt: `INTERVIEW FOCUS: Cross-Functional Collaborator
Starting ideas (not a script — adapt freely based on answers):
- Ask about a time they worked closely with a team very different from their own
- Explore how they communicate technical topics to non-technical people
- Ask about a moment where two teams disagreed and how they navigated it
- Probe for stakeholder management
- Ask about a cross-department project — what worked, what didn't, what they learned
- Explore how they build trust with people who have different priorities
Key signals to listen for: adaptability, empathy, communication range, political awareness, bridge-building`,
  },
];
