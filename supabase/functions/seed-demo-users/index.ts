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

    // Check if demo users already exist
    const { data: existing } = await supabaseAdmin
      .from("user_profiles")
      .select("email")
      .in("email", ["manager@bmw-skillsight.com", "thomas.bauer@bmw-skillsight.com", "anna.keller@bmw-skillsight.com"]);

    const results: string[] = [];

    // Create Manager account
    const managerExists = existing?.some(e => e.email === "manager@bmw-skillsight.com");
    if (!managerExists) {
      const { data: managerUser, error: managerErr } = await supabaseAdmin.auth.admin.createUser({
        email: "manager@bmw-skillsight.com",
        password: "SkillSight2026!",
        email_confirm: true,
        user_metadata: { full_name: "Dr. Ishansh Gupta" },
      });

      if (managerErr) {
        console.error("Manager creation error:", managerErr);
        results.push(`Manager error: ${managerErr.message}`);
      } else if (managerUser?.user) {
        await supabaseAdmin.from("user_profiles").insert({
          id: managerUser.user.id,
          email: "manager@bmw-skillsight.com",
          role: "manager",
          employee_id: null,
          full_name: "Dr. Ishansh Gupta",
        });
        results.push("Manager created");
      }
    }

    // Create Employee account (Thomas Bauer)
    const employeeExists = existing?.some(e => e.email === "thomas.bauer@bmw-skillsight.com");
    if (!employeeExists) {
      // Look up Thomas Bauer's employee ID
      const { data: thomas } = await supabaseAdmin
        .from("employees")
        .select("id")
        .eq("name", "Thomas Bauer")
        .limit(1)
        .single();

      const { data: employeeUser, error: employeeErr } = await supabaseAdmin.auth.admin.createUser({
        email: "thomas.bauer@bmw-skillsight.com",
        password: "SkillSight2026!",
        email_confirm: true,
        user_metadata: { full_name: "Thomas Bauer" },
      });

      if (employeeErr) {
        console.error("Employee creation error:", employeeErr);
        results.push(`Employee error: ${employeeErr.message}`);
      } else if (employeeUser?.user) {
        await supabaseAdmin.from("user_profiles").insert({
          id: employeeUser.user.id,
          email: "thomas.bauer@bmw-skillsight.com",
          role: "employee",
          employee_id: thomas?.id || null,
          full_name: "Thomas Bauer",
        });
        results.push("Employee created");
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
