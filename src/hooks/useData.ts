import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useEmployees() {
  return useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useEmployee(id: string | undefined) {
  return useQuery({
    queryKey: ["employee", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
  });
}

export function useEmployeeSkills(employeeId: string | undefined) {
  return useQuery({
    queryKey: ["employee_skills", employeeId],
    enabled: !!employeeId,
    queryFn: async () => {
      const { data, error } = await supabase.from("employee_skills").select("*").eq("employee_id", employeeId!);
      if (error) throw error;
      return data;
    },
  });
}

export function useAllEmployeeSkills() {
  return useQuery({
    queryKey: ["all_employee_skills"],
    queryFn: async () => {
      const { data, error } = await supabase.from("employee_skills").select("*");
      if (error) throw error;
      return data;
    },
  });
}

export function useRoles() {
  return useQuery({
    queryKey: ["roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("roles").select("*");
      if (error) throw error;
      return data;
    },
  });
}

export function useAlgorithmResults(employeeId?: string) {
  return useQuery({
    queryKey: ["algorithm_results", employeeId],
    queryFn: async () => {
      let query = supabase.from("algorithm_results").select("*");
      if (employeeId) query = query.eq("employee_id", employeeId);
      const { data, error } = await query.order("computed_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useInterviews(employeeId?: string) {
  return useQuery({
    queryKey: ["interviews", employeeId],
    queryFn: async () => {
      let query = supabase.from("interviews").select("*");
      if (employeeId) query = query.eq("employee_id", employeeId);
      const { data, error } = await query.order("started_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useBootcamps(employeeId?: string) {
  return useQuery({
    queryKey: ["bootcamps", employeeId],
    queryFn: async () => {
      let query = supabase.from("bootcamps").select("*");
      if (employeeId) query = query.eq("employee_id", employeeId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useReorgMatches() {
  return useQuery({
    queryKey: ["reorg_matches"],
    queryFn: async () => {
      const { data, error } = await supabase.from("reorg_matches").select("*");
      if (error) throw error;
      return data;
    },
  });
}

export function useSkillsCatalog() {
  return useQuery({
    queryKey: ["skills_catalog"],
    queryFn: async () => {
      const { data, error } = await supabase.from("skills_catalog").select("*");
      if (error) throw error;
      return data;
    },
  });
}
