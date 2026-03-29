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

    const allEmployees = [
      { name: "Dr. Marcus Weber", email: "manager@bmw-skillsight.com", role: "manager" },
      { name: "Thomas Bauer", email: "thomas.bauer@bmw-skillsight.com", role: "employee" },
      { name: "Anna Keller", email: "anna.keller@bmw-skillsight.com", role: "employee" },
      { name: "Marcus Schmidt", email: "marcus.schmidt@bmw-skillsight.com", role: "employee" },
      { name: "Jens Richter", email: "jens.richter@bmw-skillsight.com", role: "employee" },
      { name: "Rachel Kim", email: "rachel.kim@bmw-skillsight.com", role: "employee" },
      { name: "Sophia Wagner", email: "sophia.wagner@bmw-skillsight.com", role: "employee" },
      { name: "Felix Braun", email: "felix.braun@bmw-skillsight.com", role: "employee" },
      { name: "Amara Diallo", email: "amara.diallo@bmw-skillsight.com", role: "employee" },
      { name: "Lars Hoffmann", email: "lars.hoffmann@bmw-skillsight.com", role: "employee" },
      { name: "Yuki Tanaka", email: "yuki.tanaka@bmw-skillsight.com", role: "employee" },
      { name: "Marcus Bauer", email: "marcus.bauer@bmw-skillsight.com", role: "employee" },
      { name: "Clara Müller", email: "clara.muller@bmw-skillsight.com", role: "employee" },
      { name: "Klaus Hoffmann", email: "klaus.hoffmann@bmw-skillsight.com", role: "employee" },
      { name: "Lena Fischer", email: "lena.fischer@bmw-skillsight.com", role: "employee" },
      { name: "Sarah Weber", email: "sarah.weber@bmw-skillsight.com", role: "employee" },
      { name: "Marie Dupont", email: "marie.dupont@bmw-skillsight.com", role: "employee" },
    ];

    const emails = allEmployees.map(e => e.email);
    const { data: existing } = await supabaseAdmin
      .from("user_profiles")
      .select("email")
      .in("email", emails);

    const existingEmails = new Set(existing?.map(e => e.email) || []);
    const results: string[] = [];

    for (const emp of allEmployees) {
      if (existingEmails.has(emp.email)) {
        results.push(`${emp.name} already exists`);
        continue;
      }

      // Look up employee_id by name (skip for manager)
      let employeeId: string | null = null;
      if (emp.role !== "manager") {
        const { data: empRecord } = await supabaseAdmin
          .from("employees")
          .select("id")
          .eq("name", emp.name)
          .limit(1)
          .single();
        employeeId = empRecord?.id || null;
      }

      const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: emp.email,
        password: "SkillSight2026!",
        email_confirm: true,
        user_metadata: { full_name: emp.name },
      });

      if (createErr) {
        console.error(`${emp.name} creation error:`, createErr);
        results.push(`${emp.name} error: ${createErr.message}`);
      } else if (newUser?.user) {
        await supabaseAdmin.from("user_profiles").insert({
          id: newUser.user.id,
          email: emp.email,
          role: emp.role,
          employee_id: employeeId,
          full_name: emp.name,
        });
        results.push(`${emp.name} created (${emp.email})`);
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
