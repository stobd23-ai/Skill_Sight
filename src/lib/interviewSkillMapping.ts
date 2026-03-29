/**
 * Maps skill names returned by interpret-interview (camelCase/short names)
 * to role display names used in required_skills arrays.
 *
 * This mapping must stay in sync with role definitions in the database.
 */

const INTERVIEW_TO_ROLE: Record<string, string[]> = {
  // ADAS / Embedded
  CppLanguage: ["C++ / Embedded Systems"],
  EmbeddedSystems: ["C++ / Embedded Systems"],
  SensorFusion: ["Sensor Fusion"],
  ComputerVision: ["Computer Vision / Perception"],
  ROS: ["ROS / ROS2"],
  DeepLearning: ["Deep Learning"],
  MachineLearning: ["Deep Learning", "Machine Learning / Deep Learning"],
  AUTOSAR: ["AUTOSAR"],
  FunctionalSafety: ["ISO 26262 / Functional Safety"],
  ADAS: ["Sensor Fusion", "Computer Vision / Perception"],

  // EV Battery
  EVBatterySystems: ["Battery Systems Engineering"],
  BatteryThermalMgmt: ["Thermal Management"],
  CellChemistry: ["Cell Chemistry / Electrochemistry"],
  HighVoltageSystems: ["Battery Systems Engineering"],
  BatteryManagementSystems: ["Battery Management Systems (BMS)"],
  GenSixArchitecture: ["Gen6 / Neue Klasse Architecture"],

  // AI Manufacturing
  Python: ["Python"],
  DataEngineering: ["Data Engineering / Pipelines"],
  Statistics: ["Statistics / Anomaly Detection"],
  DigitalTwin: ["Digital Twin / Simulation"],
  SimulationModeling: ["Digital Twin / Simulation"],
  ManufacturingProcesses: ["Manufacturing Process Knowledge"],
  MLOps: ["Edge AI / Embedded Deployment"],

  // Digital Transformation
  DigitalStrategy: ["Digital Strategy"],
  StakeholderManagement: ["Stakeholder Management"],
  ChangeManagement: ["Change Management"],
  CrossFunctional: ["Cross-Functional Leadership"],
  ProjectManagement: ["Program / Portfolio Management", "Agile / SAFe Project Management", "Project Leadership"],
  TeamLeadership: ["Cross-Functional Leadership", "Project Leadership"],

  // IT Delivery
  ITDelivery: ["IT Programme Delivery"],
  RiskManagement: ["Risk & Escalation Management"],
  BudgetControl: ["Budget & Resource Planning"],
  VendorManagement: ["Stakeholder Management"],
  Agile: ["Agile / Scaled Agile", "Agile / SAFe Project Management"],
  SAFe: ["Agile / Scaled Agile", "Agile / SAFe Project Management"],
  TechnicalMentoring: ["Technical Literacy (Software)"],

  // General
  CAD: ["MATLAB / Simulink"],
  FEA: ["MATLAB / Simulink"],
};

/**
 * Takes interview-extracted skills (keyed by interpret-interview names)
 * and returns a SkillVector keyed by role display names.
 *
 * Only includes skills that appear in the role's required_skills list.
 */
export function mapInterviewSkillsToRoleKeys(
  extractedSkills: Record<string, any>,
  requiredSkillNames: string[]
): Record<string, number> {
  const result: Record<string, number> = {};
  const reqSet = new Set(requiredSkillNames.map(n => n.toLowerCase()));

  Object.entries(extractedSkills).forEach(([key, val]) => {
    const prof = typeof val === "number" ? val : val?.proficiency || 0;
    const mappedNames = INTERVIEW_TO_ROLE[key] || [];

    // Try mapped names
    for (const roleName of mappedNames) {
      if (reqSet.has(roleName.toLowerCase())) {
        result[roleName] = Math.max(result[roleName] || 0, prof);
      }
    }

    // Also try direct match (skill name matches a required skill exactly)
    for (const reqName of requiredSkillNames) {
      if (reqName.toLowerCase() === key.toLowerCase()) {
        result[reqName] = Math.max(result[reqName] || 0, prof);
      }
    }
  });

  return result;
}
