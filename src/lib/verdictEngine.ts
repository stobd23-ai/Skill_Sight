/**
 * Verdict Decision Engine v2
 * 
 * Computes candidate worthiness verdict from parse-cv analysis output.
 * Used by both /apply page and seed pipeline.
 */

import { computeCvOnlySkillCoverage } from "@/lib/cvCoverageScore";

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
  aiJudgment: any,
  cvText?: string
): HybridResult {
  const safeSkills = extractedSkills || {};
  const seniorityCheck = experienceProfile?.seniority_check || "not_applicable";

  const bvr = experienceProfile?.builder_verb_ratio ?? aiJudgment?.builder_verb_ratio ?? 0;
  const expYears = experienceProfile?.total_years || 0;
  const strongMetrics = aiJudgment?.strong_metrics_count || 0;
  const mediumMetrics = aiJudgment?.medium_metrics_count || 0;
  const expBreakdown = experienceProfile?.experience_breakdown || [];
  const allInternship = expBreakdown.length > 0 && expBreakdown.every((e: any) => /intern/i.test(e.role_title || ""));
  const educationLevel = experienceProfile?.education_level || "";
  const wellEvidenced = aiJudgment?.absence_analysis?.well_evidenced || [];
  const aiVerdict = aiJudgment?.ai_verdict;
  const aiConfidence = aiJudgment?.calibrated_confidence || aiJudgment?.ai_confidence || 'medium';

  const roleSkills = targetRole?.required_skills;
  const skill_coverage = cvText
    ? computeCvOnlySkillCoverage(cvText, roleSkills)
    : partialScore;

  const hasMappedSkill = Object.keys(safeSkills).length > 0 && Object.values(safeSkills).some((s: any) => (s?.proficiency || 0) >= 1);
  const hasRelevantEducation = educationLevel === 'phd' || educationLevel === 'masters';
  const hasCert = aiJudgment?.surplus_signals?.safety_certifications?.length > 0 || aiJudgment?.surplus_signals?.patents?.length > 0 || aiJudgment?.surplus_signals?.publications?.length > 0;
  const hasRelevantExp = expYears >= 2 && !allInternship && hasMappedSkill;
  const domain_signal = hasMappedSkill || hasRelevantEducation || hasCert || hasRelevantExp;

  const ownership_present = bvr >= 0.30;
  const experience_real = expYears >= 2 && !(allInternship && expBreakdown.length > 0 && expBreakdown.length === expBreakdown.filter((e: any) => /intern/i.test(e.role_title || '')).length);
  const has_metric = strongMetrics >= 1 || mediumMetrics >= 1;

  const hasPhDOrMasters = educationLevel === 'phd' || educationLevel === 'masters';
  const hasSafetyCert = (aiJudgment?.surplus_signals?.safety_certifications?.length || 0) > 0;
  const hasPatent = (aiJudgment?.surplus_signals?.patents?.length || 0) > 0;
  const hasPublications = (aiJudgment?.surplus_signals?.publications?.length || 0) >= 5;
  const longDomainExp = expYears >= 8 && !allInternship;
  const high_potential = hasPhDOrMasters || hasSafetyCert || hasPatent || hasPublications || longDomainExp;

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

  const totalWeight = requiredKeys.reduce((sum, s) => sum + (weights[s] || 0.5), 0);
  const highWeightMissing = requiredKeys.filter((s) => (weights[s] || 0) >= 0.8).filter(() => skill_coverage < 0.7);

  let gap_severity: 'critical' | 'trainable' | 'minor';
  if (skill_coverage >= 0.7) {
    gap_severity = 'minor';
  } else if (skill_coverage < 0.35 && !high_potential) {
    gap_severity = 'critical';
  } else {
    gap_severity = 'trainable';
  }

  let verdict: string;
  let verdictLabel: string;
  let worthy: boolean;
  let worthyScore: number;
  let domainGapClassification: string;

  const isHardReject = !ownership_present && !experience_real && !has_metric && !domain_signal;

  if (isHardReject) {
    verdict = 'hard_reject';
    verdictLabel = '✕ Below Threshold — Hard Reject';
    worthy = false;
    worthyScore = skill_coverage;
    domainGapClassification = 'critical';
  } else if (
    (domain_signal && ownership_present && experience_real && (gap_severity === 'minor' || gap_severity === 'trainable') && skill_coverage >= 0.55 && bvr >= 0.55) ||
    (high_potential && gap_severity !== 'critical' && ownership_present && experience_real)
  ) {
    verdict = 'recommend';
    verdictLabel = 'Strong Match — High Confidence';
    worthy = true;
    worthyScore = skill_coverage;
    domainGapClassification = gap_severity === 'minor' ? 'no_significant_gaps' : 'trainable';
  } else {
    verdict = 'flag';
    worthy = false;
    worthyScore = skill_coverage;

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

    domainGapClassification = gap_severity === 'minor' ? 'trainable' : gap_severity;
  }

  let confidence: 'high' | 'mixed_signals' | 'low';

  if (verdict === 'hard_reject') {
    confidence = 'high';
  } else if (verdict === 'recommend' && skill_coverage >= 0.7 && gap_severity !== 'critical') {
    confidence = 'high';
  } else if (verdict === 'flag') {
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

  if (verdict === 'recommend' && domainGapClassification === 'critical') {
    domainGapClassification = 'trainable';
  }
  if (verdict === 'hard_reject' && domainGapClassification === 'trainable') {
    domainGapClassification = 'critical';
  }

  const concerns: string[] = [];
  if (!ownership_present) concerns.push(`Builder verb ratio: ${Math.round(bvr * 100)}%`);
  if (!has_metric) concerns.push('Zero measurable impacts found');
  if (!experience_real) concerns.push(`${expYears < 1 ? 'Under 1 year' : expYears + ' years'} experience${allInternship ? ' (internship-level only)' : ''}`);
  if (gap_severity === 'critical') concerns.push(`${Math.max(1, highWeightMissing.length || Math.round((1 - skill_coverage) * Math.max(totalWeight, 1)))} critical skills missing`);
  concerns.push(...(aiJudgment?.ai_concerns || []));

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
