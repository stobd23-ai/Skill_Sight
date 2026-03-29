/**
 * Verdict Decision Engine v2
 * 
 * Computes candidate worthiness verdict from parse-cv analysis output.
 * Used by both /apply page and seed pipeline.
 */

export interface HybridResult {
  worthy: boolean;
  confidence: 'high' | 'mixed_signals' | 'low';
  verdict: string;
  verdictLabel: string;
  worthyScore: number;
  reasoning: string;
  aiReasoning: string;
  concerns: string[];
  keyStrengths: string[];
  recommendedPreset: string;
  recruiterNote: string;
  domainGapClassification: string;
  seniorityCheck: string;
}

export function hybridWorthinessDecision(
  partialScore: number,
  extractedSkills: Record<string, any>,
  targetRole: any,
  experienceProfile: any,
  aiJudgment: any
): HybridResult {
  const safeSkills = extractedSkills || {};
  const seniorityCheck = experienceProfile?.seniority_check || "not_applicable";

  // ═══════════════════════════════════════════════════════════
  // STEP 1 — Compute input signals
  // ═══════════════════════════════════════════════════════════

  const bvr = experienceProfile?.builder_verb_ratio ?? aiJudgment?.builder_verb_ratio ?? 0;
  const expYears = experienceProfile?.total_years || 0;
  const strongMetrics = aiJudgment?.strong_metrics_count || 0;
  const mediumMetrics = aiJudgment?.medium_metrics_count || 0;
  const expBreakdown = experienceProfile?.experience_breakdown || [];
  const allInternship = expBreakdown.length > 0 && expBreakdown.every((e: any) =>
    /intern/i.test(e.role_title || '')
  );
  const educationLevel = experienceProfile?.education_level || '';
  const wellEvidenced = aiJudgment?.absence_analysis?.well_evidenced || [];
  const aiVerdict = aiJudgment?.ai_verdict;
  const aiConfidence = aiJudgment?.calibrated_confidence || aiJudgment?.ai_confidence || 'medium';

  // A. domain_signal — any relevant connection to the role domain
  // hasMappedSkill: at least one skill from the CV maps to role requirements
  const hasMappedSkill = Object.keys(safeSkills).length > 0 &&
    Object.values(safeSkills).some((s: any) => (s?.proficiency || 0) >= 1);
  // Only PhD/Masters count as domain signal (generic BSc is too weak)
  const hasRelevantEducation = educationLevel === 'phd' || educationLevel === 'masters';
  const hasCert = aiJudgment?.surplus_signals?.safety_certifications?.length > 0 ||
    aiJudgment?.surplus_signals?.patents?.length > 0 ||
    aiJudgment?.surplus_signals?.publications?.length > 0;
  const hasRelevantExp = expYears >= 2 && !allInternship && hasMappedSkill;
  const domain_signal = hasMappedSkill || hasRelevantEducation || hasCert || hasRelevantExp;

  // B. ownership_present
  const ownership_present = bvr >= 0.30;

  // C. experience_real
  const experience_real = expYears >= 2 && !(allInternship && expBreakdown.length > 0 && expBreakdown.length === expBreakdown.filter((e: any) => /intern/i.test(e.role_title || '')).length);

  // D. has_metric
  const has_metric = strongMetrics >= 1 || mediumMetrics >= 1;

  // E. high_potential
  const hasPhDOrMasters = educationLevel === 'phd' || educationLevel === 'masters';
  const hasSafetyCert = (aiJudgment?.surplus_signals?.safety_certifications?.length || 0) > 0;
  const hasPatent = (aiJudgment?.surplus_signals?.patents?.length || 0) > 0;
  const hasPublications = (aiJudgment?.surplus_signals?.publications?.length || 0) >= 5;
  const longDomainExp = expYears >= 8 && !allInternship;
  const high_potential = hasPhDOrMasters || hasSafetyCert || hasPatent || hasPublications || longDomainExp;

  // F. gap_severity + skill_coverage
  // Compute coverage from role required skills
  const roleSkills = targetRole?.required_skills;
  let requiredKeys: string[] = [];
  let weights: Record<string, number> = {};

  if (Array.isArray(roleSkills)) {
    requiredKeys = roleSkills.map((s: any) => s.name);
    roleSkills.forEach((s: any) => { weights[s.name] = s.weight || 0.5; });
  } else if (roleSkills && typeof roleSkills === 'object') {
    requiredKeys = Object.keys(roleSkills);
    Object.entries(roleSkills).forEach(([k, v]: [string, any]) => {
      weights[k] = typeof v === 'number' ? 0.5 : (v?.weight || 0.5);
    });
  }

  const coveredSkills = requiredKeys.filter(s => safeSkills[s] && safeSkills[s].proficiency >= 1);
  const coverageRatio = requiredKeys.length > 0 ? coveredSkills.length / requiredKeys.length : 0;

  // Weighted coverage
  const coveredWeight = coveredSkills.reduce((sum, s) => sum + (weights[s] || 0.5), 0);
  const totalWeight = requiredKeys.reduce((sum, s) => sum + (weights[s] || 0.5), 0);
  const weightedCoverage = totalWeight > 0 ? coveredWeight / totalWeight : 0;
  const skill_coverage = Math.max(coverageRatio, weightedCoverage);

  // Gap severity
  const highWeightMissing = requiredKeys.filter(s =>
    !coveredSkills.includes(s) && (weights[s] || 0) >= 0.80
  );
  let gap_severity: 'critical' | 'trainable' | 'minor';
  if (skill_coverage >= 0.70) {
    gap_severity = 'minor';
  } else if (highWeightMissing.length >= 2 && !high_potential) {
    gap_severity = 'critical';
  } else {
    gap_severity = 'trainable';
  }

  // ═══════════════════════════════════════════════════════════
  // STEP 2 — Verdict decision tree (first match wins)
  // ═══════════════════════════════════════════════════════════

  let verdict: string;
  let verdictLabel: string;
  let worthy: boolean;
  let worthyScore: number;
  let domainGapClassification: string;

  // ── HARD REJECT: ALL four must be false ──
  const isHardReject = !ownership_present && !experience_real && !has_metric && !domain_signal;

  if (isHardReject) {
    verdict = 'hard_reject';
    verdictLabel = '✕ Below Threshold — Hard Reject';
    worthy = false;
    worthyScore = Math.min(partialScore, 0.10);
    domainGapClassification = 'critical';
  }
  // ── STRONG MATCH ──
  else if (
    (domain_signal && ownership_present && experience_real &&
      (gap_severity === 'minor' || gap_severity === 'trainable') &&
      skill_coverage >= 0.55 && bvr >= 0.55)
    ||
    (high_potential && gap_severity !== 'critical' && ownership_present && experience_real)
  ) {
    verdict = 'recommend';
    verdictLabel = 'Strong Match — High Confidence';
    worthy = true;
    worthyScore = Math.max(partialScore, 0.75);
    domainGapClassification = gap_severity === 'minor' ? 'no_significant_gaps' : 'trainable';
  }
  // ── FLAG (default middle bucket) ──
  else {
    verdict = 'flag';
    worthy = false;
    worthyScore = Math.max(partialScore, 0.20);

    // Choose reason phrase
    if (domain_signal && experience_real && has_metric && gap_severity === 'critical') {
      verdictLabel = 'Needs Review — Strong credentials, insufficient role-specific depth';
    } else if (domain_signal && ownership_present && !experience_real) {
      verdictLabel = 'Needs Review — Solid foundation, below senior threshold';
    } else if (domain_signal && !ownership_present && experience_real) {
      verdictLabel = 'Needs Review — Surface coverage without ownership depth';
    } else if (domain_signal && experience_real && (gap_severity === 'trainable' || gap_severity === 'minor')) {
      verdictLabel = 'Needs Review — Domain gap with strong transferable capability';
    } else {
      verdictLabel = 'Needs Review — Manager judgment required';
    }

    // Domain gap badge for flags
    domainGapClassification = gap_severity === 'minor' ? 'trainable' : gap_severity;
  }

  // ═══════════════════════════════════════════════════════════
  // STEP 3 — Confidence level
  // ═══════════════════════════════════════════════════════════

  let confidence: 'high' | 'mixed_signals' | 'low';

  if (verdict === 'hard_reject') {
    confidence = 'high';
  } else if (verdict === 'recommend' && skill_coverage >= 0.70 && gap_severity !== 'critical') {
    confidence = 'high';
  } else if (verdict === 'flag') {
    // Check if algo and AI agree
    const aiAgrees = (aiVerdict === true && worthy) || (aiVerdict === false && !worthy);
    if (aiAgrees && bvr >= 0.55) {
      confidence = 'high';
    } else if (bvr >= 0.35 && bvr < 0.55) {
      confidence = 'mixed_signals';
    } else {
      confidence = aiConfidence === 'high' ? 'high' : aiConfidence === 'low' ? 'low' : 'mixed_signals';
    }
  } else {
    confidence = aiConfidence === 'high' ? 'high' : 'mixed_signals';
  }

  // ═══════════════════════════════════════════════════════════
  // STEP 4 — Domain gaps badge consistency
  // ═══════════════════════════════════════════════════════════

  // Strong Match + Critical = impossible → force trainable
  if (verdict === 'recommend' && domainGapClassification === 'critical') {
    domainGapClassification = 'trainable';
  }
  // Hard Reject + Trainable = impossible → force critical
  if (verdict === 'hard_reject' && domainGapClassification === 'trainable') {
    domainGapClassification = 'critical';
  }

  // ═══════════════════════════════════════════════════════════
  // Build result
  // ═══════════════════════════════════════════════════════════

  const concerns: string[] = [];
  if (!ownership_present) concerns.push(`Builder verb ratio: ${Math.round(bvr * 100)}%`);
  if (!has_metric) concerns.push('Zero measurable impacts found');
  if (!experience_real) concerns.push(`${expYears < 1 ? 'Under 1 year' : expYears + ' years'} experience${allInternship ? ' (internship-level only)' : ''}`);
  if (gap_severity === 'critical') concerns.push(`${highWeightMissing.length} critical skills missing`);
  // Add AI concerns
  const aiConcerns = aiJudgment?.ai_concerns || [];
  concerns.push(...aiConcerns);

  return {
    worthy,
    confidence,
    verdict,
    verdictLabel,
    worthyScore,
    reasoning: aiJudgment?.ai_reasoning || verdictLabel,
    aiReasoning: aiJudgment?.ai_reasoning || '',
    concerns: concerns.slice(0, 4),
    keyStrengths: (aiJudgment?.ai_key_strengths || wellEvidenced || []).slice(0, 3),
    recommendedPreset: aiJudgment?.ai_recommended_preset || 'technical_depth',
    recruiterNote: aiJudgment?.ai_recruiter_note || '',
    domainGapClassification,
    seniorityCheck,
  };
}
