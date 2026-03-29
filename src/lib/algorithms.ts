// SkillSight Algorithm Engine — Pure functions, no external dependencies

export interface SkillVector { [skillName: string]: number }

export interface AlgorithmInput {
  employee: {
    id: string; name: string; skills: SkillVector;
    performanceScore: number; learningAgility: number; tenureYears: number;
  }
  targetRole: {
    id: string; title: string; requiredSkills: SkillVector; strategicWeights: SkillVector;
  }
  allRoles?: { requiredSkills: SkillVector }[]
}

export interface GapItem {
  skill: string; currentProficiency: number; requiredProficiency: number;
  deficit: number; strategicWeight: number; weightedGap: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

export interface InterviewSurplusItem {
  skill: string; type: 'capability'; rating: string; evidence: string; relevance: string;
}

export interface GapAnalysis {
  normalizedGapScore: number; readinessPercent: number;
  criticalGaps: GapItem[];
  surplusSkills: { skill: string; current: number; required: number; surplus: number }[];
  interviewSurplus: InterviewSurplusItem[];
}

export interface PathResult {
  targetSkill: string; path: string[]; totalWeeks: number; startingFrom: string;
}

export interface AHPCandidate {
  employeeId: string; name: string; rank: number; finalScore: number;
  criteriaScores: {
    skillsMatch: number; performance: number; learningAgility: number;
    tenure: number; strategicFit: number;
  }
}

export interface FullResults {
  cosineSimilarity: number; jaccardBinary: number; jaccardWeighted: number;
  gapAnalysis: GapAnalysis; tfidfRarity: { [skill: string]: number };
  upskillingPaths: PathResult[]; overallReadiness: number;
}

// ─── Role Type Detection ────────────────────────────────────────────

export type RoleType = 'emerging_tech' | 'leadership' | 'technical_specialist' | 'cross_functional' | 'manufacturing'

export function detectRoleType(requiredSkills: Record<string, number>, strategicWeights: Record<string, number>): RoleType {
  // If role_type is explicitly set in strategic_weights, use it
  const explicit = (strategicWeights as any)?.role_type;
  if (explicit && ['emerging_tech', 'leadership', 'technical_specialist', 'cross_functional', 'manufacturing'].includes(explicit)) {
    return explicit as RoleType;
  }

  const evSkills = ['EVBatterySystems', 'BatteryThermalMgmt', 'GenSixArchitecture', 'CellChemistry', 'AUTOSAR', 'ADAS', 'FunctionalSafety',
    'Battery Systems Engineering', 'Thermal Management', 'Sensor Fusion', 'C++ / Embedded Systems']
  const leadershipSkills = ['TeamLeadership', 'StrategicPlanning', 'StakeholderManagement', 'CrossFunctional',
    'Digital Strategy', 'Stakeholder Management', 'Cross-Functional Leadership', 'Change Management']
  const manufacturingSkills = ['ManufacturingProcesses', 'DigitalTwin', 'RoboticsIntegration', 'Manufacturing Process Knowledge']
  const dataSkills = ['MachineLearning', 'DeepLearning', 'DataEngineering', 'MLOps', 'ComputerVision', 'NLP',
    'Machine Learning / Deep Learning', 'Computer Vision', 'Python', 'Deep Learning']

  const skillNames = Object.keys(requiredSkills)
  const evCount = skillNames.filter(s => evSkills.includes(s)).length
  const leaderCount = skillNames.filter(s => leadershipSkills.includes(s)).length
  const mfgCount = skillNames.filter(s => manufacturingSkills.includes(s)).length
  const dataCount = skillNames.filter(s => dataSkills.includes(s)).length

  const topWeightedSkills = Object.entries(strategicWeights)
    .filter(([k]) => k !== 'role_type')
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 3)
    .map(([k]) => k)
  const leadershipDominated = topWeightedSkills.length > 0 && topWeightedSkills.every(s => leadershipSkills.includes(s))

  if (leadershipDominated || leaderCount >= 3) return 'leadership'
  if (evCount >= 3) return 'emerging_tech'
  if (mfgCount >= 2) return 'manufacturing'
  if (dataCount >= 3) return 'technical_specialist'
  if (leaderCount >= 1 && evCount >= 1) return 'cross_functional'
  return 'technical_specialist'
}

// ─── Role-Type-Aware AHP Matrices ───────────────────────────────────
// Criteria order: [SkillsMatch, Performance, LearningAgility, Tenure, StrategicFit]

const AHP_MATRICES: Record<RoleType, number[][]> = {
  emerging_tech: [
    [1,   3,   2,   7,   1  ],
    [1/3, 1,   0.5, 3,   0.5],
    [0.5, 2,   1,   5,   0.5],
    [1/7, 1/3, 1/5, 1,   1/6],
    [1,   2,   2,   6,   1  ]
  ],
  leadership: [
    [1,   2,   1,   4,   0.5],
    [0.5, 1,   0.5, 3,   0.5],
    [1,   2,   1,   4,   0.5],
    [1/4, 1/3, 1/4, 1,   1/5],
    [2,   2,   2,   5,   1  ]
  ],
  technical_specialist: [
    [1,   4,   2,   6,   1  ],
    [1/4, 1,   0.5, 3,   0.5],
    [0.5, 2,   1,   4,   0.5],
    [1/6, 1/3, 1/4, 1,   1/5],
    [1,   2,   2,   5,   1  ]
  ],
  manufacturing: [
    [1,   2,   1,   3,   1  ],
    [0.5, 1,   0.5, 2,   0.5],
    [1,   2,   1,   3,   1  ],
    [1/3, 0.5, 1/3, 1,   1/3],
    [1,   2,   1,   3,   1  ]
  ],
  cross_functional: [
    [1,   2,   0.5, 4,   0.5],
    [0.5, 1,   0.5, 3,   0.5],
    [2,   2,   1,   5,   1  ],
    [1/4, 1/3, 1/5, 1,   1/5],
    [2,   2,   1,   5,   1  ]
  ]
}

export function getAHPWeightsForRole(roleType: RoleType): { weights: number[]; matrix: number[][]; cr: number } {
  const matrix = AHP_MATRICES[roleType]
  const n = 5
  const colSums = Array(n).fill(0)
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) colSums[j] += matrix[i][j]
  const weights = matrix.map(row => row.reduce((s, v, j) => s + v / colSums[j], 0) / n)
  const wSums = matrix.map(row => row.reduce((s, v, j) => s + v * weights[j], 0))
  const lMax = wSums.reduce((s, ws, i) => s + ws / weights[i], 0) / n
  const cr = ((lMax - n) / (n - 1)) / 1.12
  return { weights, matrix, cr }
}

// ─── Three-Layer Score Computation ──────────────────────────────────

export function computeThreeLayerScore(
  technicalMatch: number,
  capabilityMatch: number,
  momentumScore: number | null,
  roleType: RoleType
): {
  threeLayerScore: number
  breakdown: { technical: number; capability: number; momentum: number | null }
  weights: { technical: number; capability: number; momentum: number }
  interpretation: string
} {
  const layerWeights: Record<RoleType, { technical: number; capability: number; momentum: number }> = {
    emerging_tech:       { technical: 0.30, capability: 0.30, momentum: 0.40 },
    leadership:          { technical: 0.25, capability: 0.40, momentum: 0.35 },
    technical_specialist:{ technical: 0.40, capability: 0.30, momentum: 0.30 },
    manufacturing:       { technical: 0.35, capability: 0.30, momentum: 0.35 },
    cross_functional:    { technical: 0.25, capability: 0.35, momentum: 0.40 }
  }

  const w = layerWeights[roleType]
  
  // If momentum is null, compute as 50/50 blend of technical and capability
  const score = momentumScore === null
    ? (technicalMatch * 0.5) + (capabilityMatch * 0.5)
    : (technicalMatch * w.technical) + (capabilityMatch * w.capability) + (momentumScore * w.momentum)

  const interpretation = getInterpretation(score, technicalMatch, momentumScore, capabilityMatch)

  return {
    threeLayerScore: Math.round(score * 100) / 100,
    breakdown: { technical: technicalMatch, capability: capabilityMatch, momentum: momentumScore },
    weights: w,
    interpretation
  }
}

function getInterpretation(score: number, technicalMatch: number, momentum: number | null, capabilityMatch: number): string {
  if (momentum === null) {
    if (technicalMatch >= 0.60 && capabilityMatch >= 0.55) return 'Strong technical profile — interview assessment pending for full score'
    if (technicalMatch >= 0.40) return 'Solid technical foundation — interview data needed to assess growth potential'
    return 'Early stage technical profile — significant development investment required'
  }
  if (score >= 0.80) return 'Exceptional candidate — ready with minor development'
  if (score >= 0.70) return 'Strong candidate — clear development path exists'
  if (score >= 0.60) {
    if (momentum >= 0.75) return 'High-momentum candidate — technical gaps exist but trajectory is strong'
    return 'Promising candidate — meaningful gaps but manageable with structured development'
  }
  if (score >= 0.50) {
    if (momentum >= 0.70) return 'Strong growth profile — not yet technically ready but high learning velocity'
    if (technicalMatch >= 0.65) return 'Solid technical base — limited momentum signals detected'
    return 'Developing candidate — significant investment required across multiple dimensions'
  }
  if (technicalMatch >= 0.60) return 'Systems engineer with domain gaps — strong foundation, missing target-specific experience'
  return 'Early stage — longer development horizon needed'
}

// ─── Algorithm 1: Cosine Similarity ─────────────────────────────────

export function cosineSimilarity(input: AlgorithmInput): number {
  const skills = new Set([
    ...Object.keys(input.employee.skills),
    ...Object.keys(input.targetRole.requiredSkills),
  ])
  let dot = 0, magA = 0, magB = 0
  skills.forEach(s => {
    const a = input.employee.skills[s] || 0
    const b = input.targetRole.requiredSkills[s] || 0
    dot += a * b; magA += a * a; magB += b * b
  })
  const denom = Math.sqrt(magA) * Math.sqrt(magB)
  return denom === 0 ? 0 : dot / denom
}

// ─── Algorithm 2: Jaccard (binary + weighted) ───────────────────────

export function jaccardSimilarity(input: AlgorithmInput): { binary: number; weighted: number } {
  const emp = new Set(Object.keys(input.employee.skills).filter(s => input.employee.skills[s] > 0))
  const role = new Set(Object.keys(input.targetRole.requiredSkills).filter(s => input.targetRole.requiredSkills[s] > 0))
  const inter = [...emp].filter(s => role.has(s)).length
  const union = new Set([...emp, ...role]).size
  const binary = union === 0 ? 0 : inter / union

  const allSkills = new Set([...Object.keys(input.employee.skills), ...Object.keys(input.targetRole.requiredSkills)])
  let sumMin = 0, sumMax = 0
  allSkills.forEach(s => {
    const a = input.employee.skills[s] || 0
    const b = input.targetRole.requiredSkills[s] || 0
    sumMin += Math.min(a, b); sumMax += Math.max(a, b)
  })
  return { binary, weighted: sumMax === 0 ? 0 : sumMin / sumMax }
}

// ─── Algorithm 3: Weighted Gap Score ────────────────────────────────

export function weightedGapScore(
  input: AlgorithmInput,
  interviewCapabilities?: Record<string, { rating: string; evidence: string; relevance_to_role: string }>
): GapAnalysis {
  const gaps: GapItem[] = []
  const surplus: GapAnalysis['surplusSkills'] = []
  let totalWGap = 0, maxPossible = 0

  Object.entries(input.targetRole.requiredSkills).forEach(([skill, required]) => {
    const current = input.employee.skills[skill] || 0
    const weight = input.targetRole.strategicWeights[skill] || 0.5
    const deficit = Math.max(required - current, 0)
    const surplusAmt = Math.max(current - required, 0)
    totalWGap += weight * deficit
    maxPossible += weight * required

    if (deficit > 0) {
      const priority: GapItem['priority'] =
        weight >= 0.85 && deficit >= 2 ? 'critical' :
        weight >= 0.7 || deficit >= 2 ? 'high' :
        weight >= 0.5 ? 'medium' : 'low'
      gaps.push({ skill, currentProficiency: current, requiredProficiency: required, deficit, strategicWeight: weight, weightedGap: weight * deficit, priority })
    }
    if (surplusAmt > 0) surplus.push({ skill, current, required, surplus: surplusAmt })
  })

  // Add interview-discovered capabilities as surplus strengths
  const interviewSurplus: InterviewSurplusItem[] = []
  if (interviewCapabilities) {
    Object.entries(interviewCapabilities).forEach(([capName, capData]) => {
      if (['DEMONSTRATED', 'EXCEPTIONAL'].includes(capData.rating)) {
        const alreadyCaptured = surplus.some(s => s.skill.toLowerCase().includes(capName.toLowerCase()))
        if (!alreadyCaptured) {
          interviewSurplus.push({
            skill: capName,
            type: 'capability',
            rating: capData.rating,
            evidence: capData.evidence,
            relevance: capData.relevance_to_role
          })
        }
      }
    })
  }

  gaps.sort((a, b) => b.weightedGap - a.weightedGap)
  const normalizedGapScore = maxPossible === 0 ? 0 : totalWGap / maxPossible
  return { normalizedGapScore, readinessPercent: Math.round((1 - normalizedGapScore) * 100), criticalGaps: gaps, surplusSkills: surplus, interviewSurplus }
}

// ─── Algorithm 4: TF-IDF Rarity ─────────────────────────────────────

export function computeTfIdf(input: AlgorithmInput): { [skill: string]: number } {
  if (!input.allRoles?.length) return {}
  const N = input.allRoles.length
  const df: { [s: string]: number } = {}
  input.allRoles.forEach(r => Object.keys(r.requiredSkills).forEach(s => { df[s] = (df[s] || 0) + 1 }))
  const idf: { [s: string]: number } = {}
  Object.keys(df).forEach(s => { idf[s] = Math.log(N / df[s]) })
  const total = Object.values(input.employee.skills).reduce((a, b) => a + b, 0)
  const result: { [s: string]: number } = {}
  Object.entries(input.employee.skills).forEach(([s, p]) => {
    if (p > 0) result[s] = (p / (total || 1)) * (idf[s] ?? Math.log(N))
  })
  return result
}

// ─── Algorithm 5: Dijkstra Pathfinding ──────────────────────────────

const BMW_SKILL_GRAPH = {
  nodes: [
    'Python', 'Statistics', 'MachineLearning', 'DeepLearning', 'ComputerVision',
    'ADAS', 'CppLanguage', 'AUTOSAR', 'V2XCommunication', 'EmbeddedSystems',
    'CANBus', 'FunctionalSafety', 'EVBatterySystems', 'BatteryThermalMgmt',
    'PowerElectronics', 'ThermalEngineering', 'DigitalTwin', 'AQIXQualityAI',
    'CloudAWS', 'ProjectManagement', 'SystemsEngineering', 'SixSigma',
  ],
  edges: [
    { f: 'Python', t: 'Statistics', w: 4 },
    { f: 'Statistics', t: 'MachineLearning', w: 8 },
    { f: 'MachineLearning', t: 'DeepLearning', w: 6 },
    { f: 'DeepLearning', t: 'ComputerVision', w: 6 },
    { f: 'ComputerVision', t: 'ADAS', w: 4 },
    { f: 'CppLanguage', t: 'AUTOSAR', w: 6 },
    { f: 'AUTOSAR', t: 'EmbeddedSystems', w: 4 },
    { f: 'EmbeddedSystems', t: 'CANBus', w: 3 },
    { f: 'CANBus', t: 'V2XCommunication', w: 6 },
    { f: 'AUTOSAR', t: 'FunctionalSafety', w: 4 },
    { f: 'ThermalEngineering', t: 'BatteryThermalMgmt', w: 6 },
    { f: 'BatteryThermalMgmt', t: 'EVBatterySystems', w: 8 },
    { f: 'EVBatterySystems', t: 'PowerElectronics', w: 4 },
    { f: 'Python', t: 'MachineLearning', w: 10 },
    { f: 'MachineLearning', t: 'AQIXQualityAI', w: 6 },
    { f: 'MachineLearning', t: 'DigitalTwin', w: 8 },
    { f: 'Python', t: 'CloudAWS', w: 6 },
    { f: 'ProjectManagement', t: 'SystemsEngineering', w: 4 },
    { f: 'SystemsEngineering', t: 'FunctionalSafety', w: 6 },
    { f: 'SixSigma', t: 'AQIXQualityAI', w: 8 },
  ],
}

function dijkstra(sources: string[], target: string): PathResult {
  const adj: { [n: string]: { to: string; w: number }[] } = {}
  BMW_SKILL_GRAPH.edges.forEach(({ f, t, w }) => {
    if (!adj[f]) adj[f] = []
    adj[f].push({ to: t, w })
  })
  const dist: { [n: string]: number } = {}
  const prev: { [n: string]: string | null } = {}
  BMW_SKILL_GRAPH.nodes.forEach(n => { dist[n] = Infinity; prev[n] = null })
  const valid = sources.filter(s => BMW_SKILL_GRAPH.nodes.includes(s))
  valid.forEach(s => { dist[s] = 0 })
  const visited = new Set<string>()
  const queue = [...valid]

  while (queue.length) {
    queue.sort((a, b) => (dist[a] ?? Infinity) - (dist[b] ?? Infinity))
    const cur = queue.shift()!
    if (visited.has(cur)) continue
    visited.add(cur)
    if (cur === target) break
    ;(adj[cur] || []).forEach(({ to, w }) => {
      const nd = (dist[cur] ?? Infinity) + w
      if (nd < (dist[to] ?? Infinity)) {
        dist[to] = nd; prev[to] = cur
        if (!visited.has(to)) queue.push(to)
      }
    })
  }

  if (!isFinite(dist[target])) return { targetSkill: target, path: [], totalWeeks: 0, startingFrom: '' }
  const path: string[] = []
  let cur: string | null = target
  while (cur) { path.unshift(cur); cur = prev[cur] }
  return { targetSkill: target, path, totalWeeks: dist[target], startingFrom: valid.find(s => path[0] === s) || path[0] }
}

export function findUpskillingPaths(input: AlgorithmInput): PathResult[] {
  const currentSkills = Object.entries(input.employee.skills).filter(([, v]) => v >= 1).map(([k]) => k)
  const targets = Object.keys(input.targetRole.requiredSkills).filter(s => {
    const def = (input.targetRole.requiredSkills[s] || 0) - (input.employee.skills[s] || 0)
    return def >= 1
  }).slice(0, 5)
  return targets.map(t => dijkstra(currentSkills, t)).filter(p => p.path.length > 0)
}

// ─── Algorithm 6: AHP ───────────────────────────────────────────────

export function runAHP(
  candidates: AlgorithmInput['employee'][],
  resultsMap: { [id: string]: { cosine: number; readiness: number } },
  roleType: RoleType = 'technical_specialist'
): { weights: number[]; candidates: AHPCandidate[]; cr: number; roleType: RoleType } {
  const { weights, cr } = getAHPWeightsForRole(roleType)
  const maxTenure = Math.max(...candidates.map(c => c.tenureYears), 1)

  const scored: AHPCandidate[] = candidates.map(c => {
    const r = resultsMap[c.id] || { cosine: 0, readiness: 0 }
    const cs = {
      skillsMatch: r.cosine,
      performance: c.performanceScore,
      learningAgility: c.learningAgility,
      tenure: Math.min(c.tenureYears / maxTenure, 1),
      strategicFit: r.readiness,
    }
    const finalScore = weights[0] * cs.skillsMatch + weights[1] * cs.performance +
      weights[2] * cs.learningAgility + weights[3] * cs.tenure + weights[4] * cs.strategicFit
    return { employeeId: c.id, name: c.name, finalScore, criteriaScores: cs, rank: 0 }
  }).sort((a, b) => b.finalScore - a.finalScore)

  scored.forEach((c, i) => { c.rank = i + 1 })
  return { weights, candidates: scored, cr, roleType }
}

// ─── Main Runner ────────────────────────────────────────────────────

export function runFullAnalysis(input: AlgorithmInput): FullResults {
  const cosine = cosineSimilarity(input)
  const jaccard = jaccardSimilarity(input)
  const gap = weightedGapScore(input)
  const tfidf = computeTfIdf(input)
  const paths = findUpskillingPaths(input)
  const overall = 0.35 * cosine + 0.30 * (1 - gap.normalizedGapScore) + 0.20 * jaccard.weighted + 0.15 * jaccard.binary
  return {
    cosineSimilarity: cosine, jaccardBinary: jaccard.binary, jaccardWeighted: jaccard.weighted,
    gapAnalysis: gap, tfidfRarity: tfidf, upskillingPaths: paths, overallReadiness: overall,
  }
}
