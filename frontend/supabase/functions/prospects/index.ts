import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ProspectRequest {
  listing_id: string;
  company: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  stage?: string;
  notes?: string;
  metadata?: Record<string, any>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const url = new URL(req.url);
    const listingId = url.searchParams.get("listing_id");

    // GET: Fetch prospects for a listing
    if (req.method === "GET") {
      if (!listingId) {
        return new Response(
          JSON.stringify({ error: "listing_id parameter required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const { data, error } = await supabaseClient
        .from("listing_prospects")
        .select("*")
        .eq("listing_id", listingId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching prospects:", error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ prospects: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST: Create or update prospect (N8n webhook endpoint)
    if (req.method === "POST") {
      const body: ProspectRequest = await req.json();

      if (!body.listing_id || !body.company) {
        return new Response(
          JSON.stringify({
            error: "listing_id and company are required fields",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Check if prospect already exists by email
      let prospectId: string | null = null;

      if (body.contact_email) {
        const { data: existing } = await supabaseClient
          .from("listing_prospects")
          .select("id")
          .eq("listing_id", body.listing_id)
          .eq("contact_email", body.contact_email)
          .maybeSingle();

        if (existing) {
          prospectId = existing.id;
        }
      }

      if (prospectId) {
        // Update existing prospect
        const { data, error } = await supabaseClient
          .from("listing_prospects")
          .update({
            company: body.company,
            contact_name: body.contact_name,
            contact_phone: body.contact_phone,
            stage: body.stage || "new",
            notes: body.notes,
            metadata: body.metadata || {},
            updated_at: new Date().toISOString(),
          })
          .eq("id", prospectId)
          .select()
          .single();

        if (error) {
          console.error("Error updating prospect:", error);
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        console.log("Prospect updated:", data);
        return new Response(
          JSON.stringify({ success: true, prospect: data, action: "updated" }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      } else {
        // Create new prospect
        const { data, error } = await supabaseClient
          .from("listing_prospects")
          .insert({
            listing_id: body.listing_id,
            company: body.company,
            contact_name: body.contact_name,
            contact_email: body.contact_email,
            contact_phone: body.contact_phone,
            stage: body.stage || "new",
            notes: body.notes,
            metadata: body.metadata || {},
          })
          .select()
          .single();

        if (error) {
          console.error("Error creating prospect:", error);
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        console.log("Prospect created:", data);
        return new Response(
          JSON.stringify({ success: true, prospect: data, action: "created" }),
          {
            status: 201,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // PATCH: Update prospect stage or notes
    if (req.method === "PATCH") {
      const prospectId = url.searchParams.get("id");
      if (!prospectId) {
        return new Response(
          JSON.stringify({ error: "Prospect id parameter required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const updates = await req.json();

      const { data, error } = await supabaseClient
        .from("listing_prospects")
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq("id", prospectId)
        .select()
        .single();

      if (error) {
        console.error("Error updating prospect:", error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, prospect: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Function error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
