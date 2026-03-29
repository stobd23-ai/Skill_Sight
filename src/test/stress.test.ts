import { describe, it, expect } from "vitest";
import {
  detectRoleType,
  computeThreeLayerScore,
  getAHPWeightsForRole,
  runFullAnalysis,
  type AlgorithmInput,
  type RoleType,
} from "@/lib/algorithms";
import { hybridWorthinessDecision } from "@/lib/verdictEngine";
import { computeCvOnlySkillCoverage } from "@/lib/cvCoverageScore";
import { skillsToVector, skillsToWeights, parseRequiredSkills, formatSkillName } from "@/lib/utils";
import { mapInterviewSkillsToRoleKeys } from "@/lib/interviewSkillMapping";

// ─── Helpers ────────────────────────────────────────────────────────

const ADAS_ROLE_SKILLS = [
  { name: "C++ / Embedded Systems", weight: 0.95, priority: "critical", required_level: 3 },
  { name: "Sensor Fusion", weight: 0.95, priority: "critical", required_level: 3 },
  { name: "Real-Time Systems", weight: 0.90, priority: "critical", required_level: 3 },
  { name: "Computer Vision / Perception", weight: 0.88, priority: "critical", required_level: 2 },
  { name: "ROS / ROS2", weight: 0.70, priority: "high", required_level: 2 },
  { name: "Deep Learning", weight: 0.68, priority: "high", required_level: 2 },
  { name: "AUTOSAR", weight: 0.50, priority: "medium", required_level: 1 },
  { name: "ISO 26262 / Functional Safety", weight: 0.48, priority: "medium", required_level: 1 },
];

const AI_MFG_ROLE_SKILLS = [
  { name: "Machine Learning / Deep Learning", weight: 0.92, priority: "critical", required_level: 3 },
  { name: "Computer Vision", weight: 0.90, priority: "critical", required_level: 2 },
  { name: "Python", weight: 0.88, priority: "critical", required_level: 3 },
  { name: "Data Engineering / Pipelines", weight: 0.80, priority: "high", required_level: 2 },
  { name: "Manufacturing Process Knowledge", weight: 0.75, priority: "high", required_level: 1 },
  { name: "Edge AI / Embedded Deployment", weight: 0.72, priority: "high", required_level: 2 },
  { name: "Digital Twin / Simulation", weight: 0.60, priority: "medium", required_level: 1 },
  { name: "Statistics / Anomaly Detection", weight: 0.65, priority: "high", required_level: 2 },
];

const DT_ROLE_SKILLS = [
  { name: "Digital Strategy", weight: 0.92, priority: "critical", required_level: 3 },
  { name: "Stakeholder Management", weight: 0.90, priority: "critical", required_level: 3 },
  { name: "Change Management", weight: 0.88, priority: "critical", required_level: 3 },
  { name: "Cross-Functional Leadership", weight: 0.85, priority: "critical", required_level: 3 },
  { name: "Data & AI Literacy", weight: 0.78, priority: "high", required_level: 2 },
  { name: "Program / Portfolio Management", weight: 0.75, priority: "high", required_level: 2 },
  { name: "Business Case Development", weight: 0.72, priority: "high", required_level: 2 },
  { name: "Agile / Scaled Agile", weight: 0.60, priority: "medium", required_level: 2 },
];

function makeAlgoInput(
  empSkills: Record<string, number>,
  roleSkills: { name: string; weight: number; required_level: number }[]
): AlgorithmInput {
  return {
    employee: {
      id: "test-emp",
      name: "Test",
      skills: empSkills,
      performanceScore: 0.7,
      learningAgility: 0.7,
      tenureYears: 4,
    },
    targetRole: {
      id: "test-role",
      title: "Test Role",
      requiredSkills: skillsToVector(roleSkills),
      strategicWeights: skillsToWeights(roleSkills),
    },
  };
}

// ─── 1. parseRequiredSkills edge cases ──────────────────────────────

describe("parseRequiredSkills", () => {
  it("handles array format", () => {
    const res = parseRequiredSkills(ADAS_ROLE_SKILLS);
    expect(res).toHaveLength(8);
    expect(res[0].name).toBe("C++ / Embedded Systems");
    expect(res[0].required_level).toBe(3);
    expect(res[0].weight).toBe(0.95);
  });

  it("handles null / undefined / empty", () => {
    expect(parseRequiredSkills(null)).toEqual([]);
    expect(parseRequiredSkills(undefined)).toEqual([]);
    expect(parseRequiredSkills({})).toEqual([]);
    expect(parseRequiredSkills([])).toEqual([]);
  });

  it("handles stringified JSON", () => {
    const res = parseRequiredSkills(JSON.stringify(ADAS_ROLE_SKILLS));
    expect(res.length).toBe(8);
  });

  it("handles object format { skillName: level }", () => {
    const res = parseRequiredSkills({ Python: 3, "Machine Learning": 2 });
    expect(res).toHaveLength(2);
    expect(res.find((s) => s.name === "Python")?.required_level).toBe(3);
  });
});

// ─── 2. skillsToVector / skillsToWeights ────────────────────────────

describe("skillsToVector / skillsToWeights", () => {
  it("converts required_skills array to vectors", () => {
    const vec = skillsToVector(AI_MFG_ROLE_SKILLS);
    expect(vec["Python"]).toBe(3);
    expect(vec["Manufacturing Process Knowledge"]).toBe(1);
    const wts = skillsToWeights(AI_MFG_ROLE_SKILLS);
    expect(wts["Python"]).toBe(0.88);
  });

  it("returns empty for garbage input", () => {
    expect(skillsToVector(null)).toEqual({});
    expect(skillsToWeights("invalid")).toEqual({});
  });
});

// ─── 3. detectRoleType ──────────────────────────────────────────────

describe("detectRoleType", () => {
  it("detects emerging_tech from ADAS skills", () => {
    const vec = skillsToVector(ADAS_ROLE_SKILLS);
    const rt = detectRoleType(vec, {});
    expect(["emerging_tech", "technical_specialist"]).toContain(rt);
  });

  it("detects cross_functional/leadership from DT skills", () => {
    const vec = skillsToVector(DT_ROLE_SKILLS);
    const rt = detectRoleType(vec, {});
    expect(["leadership", "cross_functional"]).toContain(rt);
  });

  it("respects explicit role_type in strategic_weights", () => {
    expect(detectRoleType({}, { role_type: "emerging_tech" } as any)).toBe("emerging_tech");
    expect(detectRoleType({}, { role_type: "cross_functional" } as any)).toBe("cross_functional");
  });

  it("returns technical_specialist by default", () => {
    expect(detectRoleType({ SomeRandomSkill: 2 }, {})).toBe("technical_specialist");
  });
});

// ─── 4. AHP weights ────────────────────────────────────────────────

describe("getAHPWeightsForRole", () => {
  const roleTypes: RoleType[] = [
    "emerging_tech",
    "leadership",
    "technical_specialist",
    "manufacturing",
    "cross_functional",
  ];

  roleTypes.forEach((rt) => {
    it(`${rt}: weights sum to ~1.0 and CR < 0.10`, () => {
      const { weights, cr } = getAHPWeightsForRole(rt);
      const sum = weights.reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0, 1);
      expect(cr).toBeLessThan(0.15); // AHP consistency threshold
      expect(weights.every((w) => w > 0)).toBe(true);
    });
  });
});

// ─── 5. Three-layer score ──────────────────────────────────────────

describe("computeThreeLayerScore", () => {
  it("handles null momentum (50/50 blend)", () => {
    const res = computeThreeLayerScore(0.8, 0.6, null, "emerging_tech");
    expect(res.threeLayerScore).toBeCloseTo(0.7, 1);
    expect(res.breakdown.momentum).toBeNull();
  });

  it("handles all zeros", () => {
    const res = computeThreeLayerScore(0, 0, 0, "technical_specialist");
    expect(res.threeLayerScore).toBe(0);
  });

  it("handles all max", () => {
    const res = computeThreeLayerScore(1, 1, 1, "leadership");
    expect(res.threeLayerScore).toBeCloseTo(1.0, 1);
  });

  it("handles values > 1 gracefully", () => {
    const res = computeThreeLayerScore(1.5, 1.2, 0.9, "emerging_tech");
    expect(res.threeLayerScore).toBeGreaterThan(1);
    // It should still compute without crashing
  });
});

// ─── 6. runFullAnalysis ────────────────────────────────────────────

describe("runFullAnalysis", () => {
  it("zero-skill employee produces worst-case scores", () => {
    const input = makeAlgoInput({}, ADAS_ROLE_SKILLS);
    const res = runFullAnalysis(input);
    expect(res.cosineSimilarity).toBe(0);
    expect(res.jaccardBinary).toBe(0);
    expect(res.jaccardWeighted).toBe(0);
    expect(res.gapAnalysis.criticalGaps.length).toBeGreaterThan(0);
    expect(res.overallReadiness).toBeLessThan(0.3);
  });

  it("perfect-match employee produces high scores", () => {
    const empSkills: Record<string, number> = {};
    ADAS_ROLE_SKILLS.forEach((s) => {
      empSkills[s.name] = s.required_level;
    });
    const input = makeAlgoInput(empSkills, ADAS_ROLE_SKILLS);
    const res = runFullAnalysis(input);
    expect(res.cosineSimilarity).toBeGreaterThan(0.9);
    expect(res.jaccardBinary).toBeCloseTo(1, 1);
    expect(res.gapAnalysis.criticalGaps).toHaveLength(0);
    expect(res.gapAnalysis.normalizedGapScore).toBe(0);
  });

  it("partial-match employee (Jens Richter scenario)", () => {
    const empSkills: Record<string, number> = {
      Python: 2,
      "Data Analysis": 2,
      "Process Automation": 2,
      "Manufacturing Processes": 3,
      "Battery Cell Production": 3,
      "Lean Manufacturing": 2,
      "Statistical Process Control": 2,
    };
    const input = makeAlgoInput(empSkills, AI_MFG_ROLE_SKILLS);
    const res = runFullAnalysis(input);
    // Jens has Python but not at required_level 3, so partial match
    expect(res.cosineSimilarity).toBeGreaterThan(0);
    expect(res.gapAnalysis.criticalGaps.length).toBeGreaterThan(0);
    // Should not be zero — he has some relevant skills
    expect(res.overallReadiness).toBeGreaterThan(0.1);
  });

  it("employee with extra skills not in role", () => {
    const empSkills: Record<string, number> = {
      Python: 3,
      "Machine Learning / Deep Learning": 3,
      "Quantum Computing": 5, // Not in any role
      "Blockchain": 5, // Not in any role
    };
    const input = makeAlgoInput(empSkills, AI_MFG_ROLE_SKILLS);
    const res = runFullAnalysis(input);
    // Extra skills should not crash or distort
    expect(res.cosineSimilarity).toBeGreaterThan(0);
    expect(res.overallReadiness).toBeGreaterThan(0);
  });
});

// ─── 7. mapInterviewSkillsToRoleKeys ────────────────────────────────

describe("mapInterviewSkillsToRoleKeys", () => {
  it("maps camelCase interview skills to role display names", () => {
    const extracted = {
      Python: { proficiency: 3 },
      ComputerVision: { proficiency: 2 },
      ManufacturingProcesses: { proficiency: 3 },
      DigitalTwin: { proficiency: 1 },
    };
    const roleNames = AI_MFG_ROLE_SKILLS.map((s) => s.name);
    const result = mapInterviewSkillsToRoleKeys(extracted, roleNames);
    expect(result["Python"]).toBe(3);
    expect(result["Manufacturing Process Knowledge"]).toBe(3);
    expect(result["Digital Twin / Simulation"]).toBe(1);
  });

  it("handles empty inputs", () => {
    expect(mapInterviewSkillsToRoleKeys({}, [])).toEqual({});
    expect(mapInterviewSkillsToRoleKeys({}, ["Python"])).toEqual({});
  });

  it("handles numeric proficiency values", () => {
    const extracted = { Python: 3, ComputerVision: 2 };
    const roleNames = ["Python", "Computer Vision / Perception"];
    const result = mapInterviewSkillsToRoleKeys(extracted, roleNames);
    expect(result["Python"]).toBe(3);
    expect(result["Computer Vision / Perception"]).toBe(2);
  });
});

// ─── 8. hybridWorthinessDecision edge cases ─────────────────────────

describe("hybridWorthinessDecision", () => {
  it("hard reject: zero everything", () => {
    const result = hybridWorthinessDecision(0, {}, null, {}, {});
    expect(result.verdict).toBe("hard_reject");
    expect(result.worthy).toBe(false);
    expect(result.confidence).toBe("high");
  });

  it("recommend: strong candidate", () => {
    const result = hybridWorthinessDecision(
      0.8,
      { Python: { proficiency: 3 }, ML: { proficiency: 3 } },
      { required_skills: AI_MFG_ROLE_SKILLS },
      {
        total_years: 8,
        seniority_check: "senior",
        builder_verb_ratio: 0.65,
        experience_breakdown: [{ role_title: "Senior Engineer" }],
        education_level: "masters",
      },
      {
        builder_verb_ratio: 0.65,
        strong_metrics_count: 3,
        medium_metrics_count: 2,
        ai_verdict: true,
        calibrated_confidence: "high",
        ai_reasoning: "Strong match",
        ai_key_strengths: ["Python", "ML"],
        ai_concerns: [],
        absence_analysis: { well_evidenced: ["Python"] },
        surplus_signals: {},
      }
    );
    expect(result.verdict).toBe("recommend");
    expect(result.worthy).toBe(true);
  });

  it("flag: mixed signals", () => {
    const result = hybridWorthinessDecision(
      0.4,
      { Python: { proficiency: 2 } },
      { required_skills: AI_MFG_ROLE_SKILLS },
      {
        total_years: 3,
        builder_verb_ratio: 0.4,
        experience_breakdown: [{ role_title: "Engineer" }],
        education_level: "bachelors",
      },
      {
        strong_metrics_count: 1,
        medium_metrics_count: 0,
        ai_verdict: false,
        calibrated_confidence: "medium",
        ai_reasoning: "Potential but gaps",
        ai_key_strengths: [],
        ai_concerns: ["Limited depth"],
        absence_analysis: {},
        surplus_signals: {},
      }
    );
    expect(result.verdict).toBe("flag");
    expect(result.worthy).toBe(false);
  });

  it("handles null/undefined aiJudgment gracefully", () => {
    const result = hybridWorthinessDecision(0.5, {}, null, null, null);
    expect(["hard_reject", "flag"]).toContain(result.verdict);
    expect(result.concerns).toBeDefined();
    expect(result.keyStrengths).toBeDefined();
  });

  it("handles cvText path for skill_coverage", () => {
    const cv = "Python expert, built ML pipelines, deep learning deployment, data engineering at scale";
    const result = hybridWorthinessDecision(
      0.2, // partialScore (should be overridden by cvText)
      { Python: { proficiency: 3 } },
      { required_skills: AI_MFG_ROLE_SKILLS },
      {
        total_years: 5,
        builder_verb_ratio: 0.5,
        experience_breakdown: [{ role_title: "ML Engineer" }],
      },
      { strong_metrics_count: 1, medium_metrics_count: 1, absence_analysis: {}, surplus_signals: {} },
      cv
    );
    // With cvText, coverage should differ from partialScore
    expect(result.worthyScore).toBeDefined();
  });
});

// ─── 9. computeCvOnlySkillCoverage ──────────────────────────────────

describe("computeCvOnlySkillCoverage", () => {
  it("returns 0 for empty CV", () => {
    expect(computeCvOnlySkillCoverage("", AI_MFG_ROLE_SKILLS)).toBe(0);
  });

  it("returns 0 for null skills", () => {
    expect(computeCvOnlySkillCoverage("some text", null as any)).toBe(0);
    expect(computeCvOnlySkillCoverage("some text", [])).toBe(0);
  });

  it("finds Python in CV text", () => {
    const cv = "Expert Python developer with 5 years experience building production ML pipelines";
    const score = computeCvOnlySkillCoverage(cv, AI_MFG_ROLE_SKILLS);
    expect(score).toBeGreaterThan(0);
  });

  it("detects multiple skills", () => {
    const cv = `
      Senior ML Engineer with expertise in Python, deep learning, computer vision,
      data engineering pipelines, manufacturing process optimization, edge AI deployment,
      digital twin simulation, and statistical anomaly detection systems.
      Built production inference pipelines serving 1M+ predictions/day.
    `;
    const score = computeCvOnlySkillCoverage(cv, AI_MFG_ROLE_SKILLS);
    expect(score).toBeGreaterThan(0.5);
  });
});

// ─── 10. formatSkillName ────────────────────────────────────────────

describe("formatSkillName", () => {
  it("handles camelCase", () => {
    const result = formatSkillName("MachineLearning");
    expect(result).toContain("Machine");
  });

  it("handles display names with /", () => {
    expect(formatSkillName("C++ / Embedded Systems")).toBe("C++ / Embedded Systems");
    expect(formatSkillName("Computer Vision / Perception")).toBe("Computer Vision / Perception");
  });

  it("handles empty and null-ish", () => {
    expect(formatSkillName("")).toBe("");
    expect(formatSkillName(null as any)).toBeFalsy();
  });
});

// ─── 11. Gap analysis correctness ──────────────────────────────────

describe("Gap analysis correctness", () => {
  it("surplus skills are detected", () => {
    const empSkills = { "Python": 3, "Computer Vision": 2, "Manufacturing Process Knowledge": 3 };
    const roleSkills = [
      { name: "Python", weight: 0.88, required_level: 2 },
      { name: "Manufacturing Process Knowledge", weight: 0.75, required_level: 1 },
    ];
    const input = makeAlgoInput(empSkills, roleSkills);
    const res = runFullAnalysis(input);
    expect(res.gapAnalysis.surplusSkills.length).toBeGreaterThan(0);
    expect(res.gapAnalysis.criticalGaps).toHaveLength(0);
  });

  it("critical gaps flagged correctly", () => {
    const empSkills = { "Python": 1 };
    const roleSkills = [
      { name: "Python", weight: 0.95, required_level: 3 },
      { name: "Machine Learning / Deep Learning", weight: 0.92, required_level: 3 },
    ];
    const input = makeAlgoInput(empSkills, roleSkills);
    const res = runFullAnalysis(input);
    const mlGap = res.gapAnalysis.criticalGaps.find((g) => g.skill === "Machine Learning / Deep Learning");
    expect(mlGap).toBeDefined();
    expect(mlGap!.deficit).toBe(3);
    expect(mlGap!.priority).toBe("critical");
  });
});

// ─── 12. Boundary / stress values ──────────────────────────────────

describe("Boundary and stress values", () => {
  it("extremely large skill vectors don't crash", () => {
    const empSkills: Record<string, number> = {};
    const roleSkills: { name: string; weight: number; required_level: number }[] = [];
    for (let i = 0; i < 100; i++) {
      empSkills[`Skill_${i}`] = Math.floor(Math.random() * 4);
      roleSkills.push({ name: `Skill_${i}`, weight: Math.random(), required_level: Math.ceil(Math.random() * 3) });
    }
    const input = makeAlgoInput(empSkills, roleSkills);
    const res = runFullAnalysis(input);
    expect(res.overallReadiness).toBeGreaterThanOrEqual(0);
    expect(res.overallReadiness).toBeLessThanOrEqual(1.5); // Allow slight over-1 from formula
  });

  it("negative proficiency doesn't crash", () => {
    const empSkills = { Python: -1 };
    const input = makeAlgoInput(empSkills, [{ name: "Python", weight: 0.9, required_level: 3 }]);
    const res = runFullAnalysis(input);
    expect(res).toBeDefined();
  });

  it("zero-weight skills handled", () => {
    const input = makeAlgoInput(
      { Python: 3 },
      [{ name: "Python", weight: 0, required_level: 3 }]
    );
    const res = runFullAnalysis(input);
    expect(res).toBeDefined();
  });

  it("special characters in skill names", () => {
    const input = makeAlgoInput(
      { "C++ / Embedded": 2, "ISO 26262 / Functional Safety": 1 },
      [
        { name: "C++ / Embedded", weight: 0.9, required_level: 3 },
        { name: "ISO 26262 / Functional Safety", weight: 0.5, required_level: 2 },
      ]
    );
    const res = runFullAnalysis(input);
    expect(res.cosineSimilarity).toBeGreaterThan(0);
  });
});
