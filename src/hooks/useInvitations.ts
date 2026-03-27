import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useInvitations(employeeId?: string) {
  return useQuery({
    queryKey: ["interview_invitations", employeeId],
    enabled: !!employeeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("interview_invitations" as any)
        .select("*")
        .eq("employee_id", employeeId!)
        .order("invited_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
}
