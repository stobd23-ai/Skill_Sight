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
      .in("email", ["manager@bmw-skillsight.com", "thomas.bauer@bmw-skillsight.com", "anna.keller@bmw-skillsight.com", "jens.richter@bmw.de"]);

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
        results.push("Employee (Thomas) created");
      }
    }

    // Create Employee account (Anna Keller)
    const annaExists = existing?.some(e => e.email === "anna.keller@bmw-skillsight.com");
    if (!annaExists) {
      const { data: anna } = await supabaseAdmin
        .from("employees")
        .select("id")
        .eq("name", "Anna Keller")
        .limit(1)
        .single();

      const { data: annaUser, error: annaErr } = await supabaseAdmin.auth.admin.createUser({
        email: "anna.keller@bmw-skillsight.com",
        password: "SkillSight2026!",
        email_confirm: true,
        user_metadata: { full_name: "Anna Keller" },
      });

      if (annaErr) {
        console.error("Anna creation error:", annaErr);
        results.push(`Anna error: ${annaErr.message}`);
      } else if (annaUser?.user) {
        await supabaseAdmin.from("user_profiles").insert({
          id: annaUser.user.id,
          email: "anna.keller@bmw-skillsight.com",
          role: "employee",
          employee_id: anna?.id || null,
          full_name: "Anna Keller",
        });
        results.push("Employee (Anna) created");
      }
    }

    // Create Employee account (Jens Richter)
    const jensExists = existing?.some(e => e.email === "jens.richter@bmw.de");
    if (!jensExists) {
      const { data: jens } = await supabaseAdmin
        .from("employees")
        .select("id")
        .eq("name", "Jens Richter")
        .limit(1)
        .single();

      const { data: jensUser, error: jensErr } = await supabaseAdmin.auth.admin.createUser({
        email: "jens.richter@bmw.de",
        password: "SkillSight2026!",
        email_confirm: true,
        user_metadata: { full_name: "Jens Richter" },
      });

      if (jensErr) {
        console.error("Jens creation error:", jensErr);
        results.push(`Jens error: ${jensErr.message}`);
      } else if (jensUser?.user) {
        await supabaseAdmin.from("user_profiles").insert({
          id: jensUser.user.id,
          email: "jens.richter@bmw.de",
          role: "employee",
          employee_id: jens?.id || null,
          full_name: "Jens Richter",
        });
        results.push("Employee (Jens) created");
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
