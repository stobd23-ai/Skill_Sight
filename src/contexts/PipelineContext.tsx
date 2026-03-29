import React, { createContext, useContext, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { runFullAnalysis, type AlgorithmInput, type SkillVector } from "@/lib/algorithms";

type Phase = 'idle' | 'interview_active' | 'algorithms' | 'generating_report' | 'complete' | 'error';

interface PipelineState {
  phase: Phase;
  employeeId: string | null;
  roleId: string | null;
  interviewId: string | null;
  algorithmResultId: string | null;
  reportId: string | null;
  error: string | null;
}

interface PipelineContextValue extends PipelineState {
  startInterview: (employeeId: string, roleId: string) => void;
  completePipeline: (opts: {
    employeeId: string; roleId: string; interviewId: string;
    interviewType: 'employee' | 'manager';
    extractedSkills: Record<string, any>;
    managerInsights?: any;
  }) => Promise<void>;
  reset: () => void;
}

const initial: PipelineState = {
  phase: 'idle', employeeId: null, roleId: null, interviewId: null,
  algorithmResultId: null, reportId: null, error: null,
};

const PipelineContext = createContext<PipelineContextValue>({
  ...initial, startInterview: () => {}, completePipeline: async () => {}, reset: () => {},
});

export function usePipeline() { return useContext(PipelineContext); }

export function PipelineProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PipelineState>(initial);

  const startInterview = useCallback((employeeId: string, roleId: string) => {
    setState({ ...initial, phase: 'interview_active', employeeId, roleId });
  }, []);

  const reset = useCallback(() => setState(initial), []);

  const completePipeline = useCallback(async (opts: {
    employeeId: string; roleId: string; interviewId: string;
    interviewType: 'employee' | 'manager';
    extractedSkills: Record<string, any>;
    managerInsights?: any;
  }) => {
    const { employeeId, roleId, interviewId, interviewType, extractedSkills, managerInsights } = opts;

    try {
      // Phase: algorithms
      setState(s => ({ ...s, phase: 'algorithms', interviewId }));

      // Fetch fresh data
      const [{ data: employee }, { data: skills }, { data: role }, { data: allRoles }] = await Promise.all([
        supabase.from("employees").select("*").eq("id", employeeId).single(),
        supabase.from("employee_skills").select("*").eq("employee_id", employeeId),
        supabase.from("roles").select("*").eq("id", roleId).single(),
        supabase.from("roles").select("*"),
      ]);

      if (!employee || !role) throw new Error("Missing employee or role data");

      // Build skill vector (merged)
      const empSkills: SkillVector = {};
      skills?.forEach(s => { empSkills[s.skill_name] = s.proficiency || 0; });

      const input: AlgorithmInput = {
        employee: {
          id: employee.id, name: employee.name, skills: empSkills,
          performanceScore: employee.performance_score || 0.5,
          learningAgility: employee.learning_agility || 0.5,
          tenureYears: employee.tenure_years || 0,
        },
        targetRole: {
          id: role.id, title: role.title,
          requiredSkills: skillsToVector(role.required_skills),
          strategicWeights: skillsToWeights(role.required_skills),
        },
        allRoles: allRoles?.map(r => ({ requiredSkills: skillsToVector(r.required_skills) })),
      };

      const results = runFullAnalysis(input);

      // Manager adjustment
      let managerAdj = 0;
      let finalReadiness = results.overallReadiness;
      if (interviewType === 'manager' && managerInsights) {
        const mcs = managerInsights.manager_confidence_score || 0;
        const numConcerns = (managerInsights.concerns || []).length;
        if (mcs > 8) managerAdj += 0.05;
        managerAdj -= Math.min(numConcerns * 0.05, 0.10);
        managerAdj = Math.max(-0.15, Math.min(0.10, managerAdj));
        finalReadiness = results.overallReadiness + managerAdj;
      }

      // Check for existing result to update or insert
      const { data: existingResult } = await supabase.from("algorithm_results")
        .select("id").eq("employee_id", employeeId).eq("role_id", roleId)
        .order("computed_at", { ascending: false }).limit(1).maybeSingle();

      let algorithmResultId: string;
      if (existingResult && interviewType === 'manager') {
        // Update existing with manager adjustment
        await supabase.from("algorithm_results").update({
          manager_readiness_adjustment: managerAdj,
          final_readiness: finalReadiness,
          manager_interview_id: interviewId,
        }).eq("id", existingResult.id);
        algorithmResultId = existingResult.id;
      } else {
        // Insert new
        const { data: newResult } = await supabase.from("algorithm_results").insert({
          employee_id: employeeId, role_id: roleId,
          employee_interview_id: interviewType === 'employee' ? interviewId : null,
          manager_interview_id: interviewType === 'manager' ? interviewId : null,
          cosine_similarity: results.cosineSimilarity,
          jaccard_binary: results.jaccardBinary,
          jaccard_weighted: results.jaccardWeighted,
          normalized_gap_score: results.gapAnalysis.normalizedGapScore,
          overall_readiness: results.overallReadiness,
          final_readiness: finalReadiness,
          manager_readiness_adjustment: managerAdj,
          gap_analysis: results.gapAnalysis as any,
          tfidf_rarity: results.tfidfRarity as any,
          upskilling_paths: results.upskillingPaths as any,
          ahp_data: {} as any,
        }).select("id").single();
        algorithmResultId = newResult?.id || '';
      }

      setState(s => ({ ...s, algorithmResultId }));

      // Phase: generating report
      setState(s => ({ ...s, phase: 'generating_report' }));

      try {
        const { data: reportData } = await supabase.functions.invoke("generate-report", {
          body: {
            employeeName: employee.name, roleTitle: role.title,
            algorithmResults: {
              cosineSimilarity: results.cosineSimilarity, jaccardBinary: results.jaccardBinary,
              jaccardWeighted: results.jaccardWeighted, overallReadiness: results.overallReadiness,
              finalReadiness, managerAdjustment: managerAdj,
            },
            gapAnalysis: results.gapAnalysis, tfidfRarity: results.tfidfRarity,
            upskillingPaths: results.upskillingPaths,
            managerInsights: managerInsights || null,
          },
        });

        if (reportData?.report) {
          const { data: savedReport } = await supabase.from("reports").insert({
            employee_id: employeeId, role_id: roleId, algorithm_result_id: algorithmResultId,
            report_markdown: reportData.report,
          }).select("id").single();
          setState(s => ({ ...s, reportId: savedReport?.id || null }));
        }
      } catch (e) {
        console.error("Report generation failed (non-blocking):", e);
      }


      setState(s => ({ ...s, phase: 'complete' }));
    } catch (e: any) {
      console.error("Pipeline error:", e);
      setState(s => ({ ...s, phase: 'error', error: e.message }));
    }
  }, []);

  return (
    <PipelineContext.Provider value={{ ...state, startInterview, completePipeline, reset }}>
      {children}
    </PipelineContext.Provider>
  );
}
