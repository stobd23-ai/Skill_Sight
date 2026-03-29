import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Only create logins for the manager + employees that exist in the employees table
    const managerAccount = { name: "Dr. Marcus Weber", email: "manager@bmw-skillsight.com", role: "manager" };

    // Fetch all employees from DB
    const { data: allEmployees } = await supabaseAdmin
      .from("employees")
      .select("id, name, email")
      .order("name");

    const employeeAccounts = (allEmployees || []).map(emp => ({
      name: emp.name,
      email: (emp.email || "").replace("@bmw.com", "@bmw-skillsight.com"),
      role: "employee",
      employee_id: emp.id,
    }));

    const allAccounts = [
      { ...managerAccount, employee_id: null as string | null },
      ...employeeAccounts,
    ];

    const emails = allAccounts.map(e => e.email);
    const { data: existing } = await supabaseAdmin
      .from("user_profiles")
      .select("email")
      .in("email", emails);

    const existingEmails = new Set(existing?.map(e => e.email) || []);
    const results: string[] = [];

    // Also ban/delete orphaned accounts (profiles with no employee_id that aren't managers)
    const { data: orphans } = await supabaseAdmin
      .from("user_profiles")
      .select("id, email")
      .is("employee_id", null)
      .neq("role", "manager");

    for (const orphan of (orphans || [])) {
      await supabaseAdmin.auth.admin.deleteUser(orphan.id);
      await supabaseAdmin.from("user_profiles").delete().eq("id", orphan.id);
      results.push(`Deleted orphan: ${orphan.email}`);
    }

    for (const acc of allAccounts) {
      if (existingEmails.has(acc.email)) {
        results.push(`${acc.name} already exists`);
        continue;
      }

      const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: acc.email,
        password: "SkillSight2026!",
        email_confirm: true,
        user_metadata: { full_name: acc.name },
      });

      if (createErr) {
        results.push(`${acc.name} error: ${createErr.message}`);
      } else if (newUser?.user) {
        await supabaseAdmin.from("user_profiles").insert({
          id: newUser.user.id,
          email: acc.email,
          role: acc.role,
          employee_id: acc.employee_id,
          full_name: acc.name,
        });
        results.push(`${acc.name} created (${acc.email})`);
      }
    }

    return new Response(JSON.stringify({ message: "Seeding complete", results, seeded: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Seed error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
