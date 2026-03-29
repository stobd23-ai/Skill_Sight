import { parseRequiredSkills } from "@/lib/utils";

type Depth = "LOW" | "MEDIUM" | "HIGH";

export const DEPTH_MULTIPLIERS: Record<Depth, number> = {
  LOW: 0.3,
  MEDIUM: 0.65,
  HIGH: 1.0,
};

const HIGH_SIGNAL_TERMS = [
  "built",
  "designed",
  "developed",
  "implemented",
  "led",
  "owned",
  "delivered",
  "deployed",
  "architected",
  "optimized",
  "optimised",
  "reduced",
  "improved",
  "managed",
  "launched",
  "contributed",
];

const MEDIUM_SIGNAL_TERMS = [
  "production",
  "real-time",
  "real time",
  "pipeline",
  "platform",
  "system",
  "framework",
  "programme",
  "program",
  "portfolio",
  "migration",
  "rollout",
  "deployment",
];

const METRIC_PATTERN = /\b\d+(?:[.,]\d+)?\s*(?:%|ms|k|m|million|billion|vehicles|users|markets|teams|squads|operators|engineers|papers|day|days|week|weeks|month|months|year|years)\b/i;

const SKILL_ALIASES: Record<string, string[]> = {
  "c++": ["cpp"],
  "cpp": ["cpp"],
  "embedded systems": ["embedded_systems"],
  "embedded linux": ["embedded_systems"],
  "embedded hardware": ["embedded_systems"],
  "sensor fusion": ["sensor_fusion"],
  "multi-modal sensor fusion": ["sensor_fusion"],
  "multi sensor fusion": ["sensor_fusion"],
  "lidar": ["sensor_fusion"],
  "radar": ["sensor_fusion"],
  "computer vision": ["computer_vision"],
  "perception": ["perception", "computer_vision"],
  "object detection": ["computer_vision"],
  "object tracking": ["computer_vision"],
  "real-time systems": ["real_time_systems"],
  "real time systems": ["real_time_systems"],
  "real-time": ["real_time_systems"],
  "real time": ["real_time_systems"],
  "ros": ["ros"],
  "ros2": ["ros"],
  "deep learning": ["deep_learning", "machine_learning"],
  "machine learning": ["machine_learning"],
  "pytorch": ["deep_learning", "machine_learning"],
  "tensorflow": ["deep_learning", "machine_learning"],
  "cuda": ["embedded_ai", "edge_ai_embedded_deployment"],
  "autosar": ["autosar"],
  "iso 26262": ["iso_26262", "functional_safety"],
  "functional safety": ["functional_safety"],
  "battery systems engineering": ["battery_systems", "battery_engineering", "ev_battery_systems"],
  "battery systems": ["battery_systems", "battery_engineering", "ev_battery_systems"],
  "battery engineering": ["battery_engineering", "ev_battery_systems"],
  "thermal management": ["thermal_management"],
  "thermal runaway": ["thermal_management", "functional_safety"],
  "cell chemistry": ["cell_chemistry", "battery_chemistry"],
  "electrochemistry": ["electrochemistry", "battery_chemistry"],
  "electrochemical": ["electrochemistry", "battery_chemistry"],
  "lithium-ion": ["cell_chemistry", "battery_chemistry"],
  "lithium ion": ["cell_chemistry", "battery_chemistry"],
  "battery management systems": ["bms", "battery_management_systems"],
  "battery management system": ["bms", "battery_management_systems"],
  "battery management": ["bms", "battery_management_systems"],
  "bms": ["bms", "battery_management_systems"],
  "module design": ["module_design", "battery_module_design"],
  "pack design": ["pack_design", "battery_module_design"],
  "module / pack design": ["module_design", "pack_design", "battery_module_design"],
  "matlab": ["matlab"],
  "simulink": ["simulink"],
  "project leadership": ["project_leadership", "leadership"],
  "team lead": ["leadership"],
  "led team": ["leadership"],
  "digital strategy": ["digital_strategy"],
  "stakeholder management": ["stakeholder_management"],
  "change management": ["change_management"],
  "cross-functional leadership": ["cross_functional_leadership"],
  "cross functional leadership": ["cross_functional_leadership"],
  "cross-functional": ["cross_functional_leadership"],
  "program management": ["program_portfolio_management", "project_management"],
  "programme management": ["program_portfolio_management", "project_management"],
  "portfolio management": ["program_portfolio_management"],
  "product management": ["program_portfolio_management"],
  "business case development": ["business_case_development"],
  "business case": ["business_case_development"],
  "p&l": ["business_case_development"],
  "data & ai literacy": ["data_ai_literacy"],
  "data-driven": ["data_ai_literacy"],
  "data driven": ["data_ai_literacy"],
  "ai literacy": ["data_ai_literacy"],
  "agile": ["agile", "project_management"],
  "scaled agile": ["scaled_agile", "agile"],
  "safe": ["safe", "scaled_agile", "agile"],
  "agile/safe": ["agile", "safe", "scaled_agile"],
  "agile/scaled agile": ["agile", "scaled_agile"],
  "it programme delivery": ["it_programme_delivery", "programme_delivery"],
  "it program delivery": ["it_programme_delivery", "programme_delivery"],
  "programme delivery": ["programme_delivery"],
  "program delivery": ["programme_delivery"],
  "stakeholder": ["stakeholder_management"],
  "risk management": ["risk_management"],
  "escalation management": ["escalation_management"],
  "vendor management": ["vendor_management"],
  "budget control": ["budget_control"],
  "budget": ["budget_control"],
  "resource planning": ["resource_planning"],
  "jira": ["project_management"],
  "confluence": ["project_management"],
  "technical literacy": ["technical_literacy"],
  "software delivery": ["technical_literacy", "programme_delivery"],
  "intercultural": ["intercultural_competence"],
  "machine learning / deep learning": ["machine_learning", "deep_learning"],
  "python": ["python"],
  "data engineering": ["data_engineering", "data_pipelines"],
  "data pipelines": ["data_pipelines"],
  "etl": ["data_pipelines"],
  "manufacturing": ["manufacturing_process_knowledge"],
  "manufacturing process": ["manufacturing_process_knowledge"],
  "predictive maintenance": ["manufacturing_process_knowledge", "machine_learning"],
  "edge ai": ["edge_ai_embedded_deployment", "embedded_ai"],
  "embedded deployment": ["edge_ai_embedded_deployment"],
  "digital twin": ["digital_twin", "simulation"],
  "simulation": ["simulation"],
  "statistics": ["statistics"],
  "anomaly detection": ["anomaly_detection", "statistics"],
  "sql": ["data_pipelines"],
  "tableau": ["statistics"],
  "gen6": ["gen6_architecture"],
  "neue klasse": ["gen6_architecture"],
  "project manager": ["project_management"],
  "programme manager": ["programme_delivery", "project_management"],
  "program manager": ["programme_delivery", "project_management"],
  "project management": ["project_management"],
};

const ROLE_SKILL_TOKENS: Record<string, string[]> = {
  "C++ / Embedded Systems": ["cpp", "embedded_systems"],
  "Sensor Fusion": ["sensor_fusion"],
  "Real-Time Systems": ["real_time_systems", "embedded_systems"],
  "Computer Vision / Perception": ["computer_vision", "perception"],
  "ROS / ROS2": ["ros"],
  "Deep Learning": ["deep_learning", "machine_learning"],
  AUTOSAR: ["autosar"],
  "ISO 26262 / Functional Safety": ["iso_26262", "functional_safety"],
  "Machine Learning / Deep Learning": ["machine_learning", "deep_learning"],
  "Computer Vision": ["computer_vision"],
  Python: ["python"],
  "Data Engineering / Pipelines": ["data_engineering", "data_pipelines"],
  "Manufacturing Process Knowledge": ["manufacturing_process_knowledge"],
  "Edge AI / Embedded Deployment": ["edge_ai_embedded_deployment", "embedded_ai"],
  "Digital Twin / Simulation": ["digital_twin", "simulation"],
  "Statistics / Anomaly Detection": ["statistics", "anomaly_detection"],
  "Digital Strategy": ["digital_strategy"],
  "Stakeholder Management": ["stakeholder_management"],
  "Change Management": ["change_management"],
  "Cross-Functional Leadership": ["cross_functional_leadership"],
  "Data & AI Literacy": ["data_ai_literacy"],
  "Program / Portfolio Management": ["program_portfolio_management", "programme_delivery", "project_management"],
  "Business Case Development": ["business_case_development"],
  "Agile / Scaled Agile": ["agile", "scaled_agile", "safe"],
  "Battery Systems Engineering": ["battery_systems", "battery_engineering", "ev_battery_systems"],
  "Thermal Management": ["thermal_management"],
  "Cell Chemistry / Electrochemistry": ["cell_chemistry", "electrochemistry", "battery_chemistry"],
  "Battery Management Systems (BMS)": ["bms", "battery_management_systems"],
  "Module / Pack Design": ["module_design", "pack_design", "battery_module_design"],
  "MATLAB / Simulink": ["matlab", "simulink"],
  "Project Leadership": ["project_leadership", "leadership", "project_management"],
  "Gen6 / Neue Klasse Architecture": ["gen6_architecture"],
  "IT Programme Delivery": ["it_programme_delivery", "programme_delivery"],
  "Agile / SAFe Project Management": ["agile", "safe", "scaled_agile", "project_management"],
  "Risk & Escalation Management": ["risk_management", "escalation_management"],
  "Technical Literacy (Software)": ["technical_literacy"],
  "Budget & Resource Planning": ["budget_control", "resource_planning"],
  "Intercultural Competence": ["intercultural_competence"],
};

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9+\-/().\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getMentionContexts(text: string, needle: string) {
  const contexts: string[] = [];
  let startIndex = 0;

  while (startIndex < text.length) {
    const index = text.indexOf(needle, startIndex);
    if (index === -1) break;
    contexts.push(text.slice(Math.max(0, index - 140), Math.min(text.length, index + needle.length + 140)));
    startIndex = index + needle.length;
  }

  return contexts;
}

function classifyDepth(cvText: string, alias: string): Depth {
  const contexts = getMentionContexts(cvText, alias);
  if (contexts.length === 0) return "LOW";

  let bestDepth: Depth = "LOW";

  contexts.forEach((context) => {
    const highSignalCount = HIGH_SIGNAL_TERMS.filter((term) => context.includes(term)).length;
    const hasMetric = METRIC_PATTERN.test(context);
    const hasMediumSignal = MEDIUM_SIGNAL_TERMS.some((term) => context.includes(term));
    const skillListOnly = /skills?\s+[\s\S]{0,80}$/.test(context);

    if ((hasMetric && highSignalCount >= 1) || highSignalCount >= 2) {
      bestDepth = "HIGH";
      return;
    }

    if (bestDepth !== "HIGH" && ((highSignalCount === 1 && !skillListOnly) || hasMediumSignal)) {
      bestDepth = "MEDIUM";
    }
  });

  return bestDepth;
}

function collectCanonicalDepths(cvText: string) {
  const normalizedCv = normalizeText(cvText);
  const tokenDepths = new Map<string, Depth>();

  Object.entries(SKILL_ALIASES).forEach(([alias, canonicalTokens]) => {
    if (!normalizedCv.includes(alias)) return;
    const depth = classifyDepth(normalizedCv, alias);

    canonicalTokens.forEach((token) => {
      const current = tokenDepths.get(token);
      if (!current || DEPTH_MULTIPLIERS[depth] > DEPTH_MULTIPLIERS[current]) {
        tokenDepths.set(token, depth);
      }
    });
  });

  return { normalizedCv, tokenDepths };
}

function getRoleSkillDepth(skillName: string, normalizedCv: string, tokenDepths: Map<string, Depth>) {
  const mappedTokens = ROLE_SKILL_TOKENS[skillName] || [];
  let bestDepth: Depth | null = null;

  mappedTokens.forEach((token) => {
    const tokenDepth = tokenDepths.get(token);
    if (!tokenDepth) return;
    if (!bestDepth || DEPTH_MULTIPLIERS[tokenDepth] > DEPTH_MULTIPLIERS[bestDepth]) {
      bestDepth = tokenDepth;
    }
  });

  if (bestDepth) return bestDepth;

  const directPhrases = skillName
    .toLowerCase()
    .replace(/[()]/g, " ")
    .split(/[\/,&]/)
    .map((part) => normalizeText(part))
    .filter((part) => part.length >= 3);

  for (const phrase of directPhrases) {
    if (normalizedCv.includes(phrase)) {
      return classifyDepth(normalizedCv, phrase);
    }
  }

  return null;
}

export function computeCvOnlySkillCoverage(cvText: string, rawRequiredSkills: any) {
  if (!cvText) return 0;

  const requiredSkills = parseRequiredSkills(rawRequiredSkills);
  if (requiredSkills.length === 0) return 0;

  const { normalizedCv, tokenDepths } = collectCanonicalDepths(cvText);

  const totalWeight = requiredSkills.reduce((sum, skill) => sum + (skill.weight || 0.5), 0);
  if (totalWeight === 0) return 0;

  const matchedWeight = requiredSkills.reduce((sum, skill) => {
    const depth = getRoleSkillDepth(skill.name, normalizedCv, tokenDepths);
    if (!depth) return sum;
    return sum + (skill.weight || 0.5) * DEPTH_MULTIPLIERS[depth];
  }, 0);

  return Math.max(0, Math.min(1, matchedWeight / totalWeight));
}
