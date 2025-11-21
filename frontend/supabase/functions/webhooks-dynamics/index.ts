import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface DynamicsWebhookPayload {
  event_type: "stage_change" | "email_interaction" | "prospect_update";
  deal_id: string;
  prospect_id?: string;
  data: Record<string, any>;
  timestamp: string;
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

    if (req.method === "POST") {
      const payload: DynamicsWebhookPayload = await req.json();

      console.log("Received webhook from Dynamics:", payload);

      // Validate required fields
      if (!payload.event_type || !payload.deal_id) {
        return new Response(
          JSON.stringify({ error: "event_type and deal_id are required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Process based on event type
      switch (payload.event_type) {
        case "stage_change":
          if (!payload.prospect_id) {
            return new Response(
              JSON.stringify({ error: "prospect_id required for stage_change" }),
              {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              }
            );
          }

          // Update prospect stage
          const { error: stageError } = await supabaseClient
            .from("listing_prospects")
            .update({
              stage: payload.data.new_stage,
              updated_at: new Date().toISOString(),
            })
            .eq("id", payload.prospect_id)
            .eq("listing_id", payload.deal_id);

          if (stageError) {
            console.error("Error updating stage:", stageError);
            return new Response(JSON.stringify({ error: stageError.message }), {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          console.log("Stage updated successfully");
          break;

        case "email_interaction":
          if (!payload.prospect_id) {
            return new Response(
              JSON.stringify({
                error: "prospect_id required for email_interaction",
              }),
              {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              }
            );
          }

          // Log email interaction
          const { error: interactionError } = await supabaseClient
            .from("email_interactions")
            .insert({
              prospect_id: payload.prospect_id,
              interaction_type: payload.data.interaction_type || "sent",
              email_subject: payload.data.subject,
              email_body: payload.data.body,
              metadata: payload.data.metadata || {},
            });

          if (interactionError) {
            console.error("Error logging interaction:", interactionError);
            return new Response(
              JSON.stringify({ error: interactionError.message }),
              {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              }
            );
          }

          console.log("Email interaction logged successfully");
          break;

        case "prospect_update":
          if (!payload.prospect_id) {
            return new Response(
              JSON.stringify({
                error: "prospect_id required for prospect_update",
              }),
              {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              }
            );
          }

          // Update prospect data
          const { error: updateError } = await supabaseClient
            .from("listing_prospects")
            .update({
              ...payload.data,
              updated_at: new Date().toISOString(),
            })
            .eq("id", payload.prospect_id)
            .eq("listing_id", payload.deal_id);

          if (updateError) {
            console.error("Error updating prospect:", updateError);
            return new Response(
              JSON.stringify({ error: updateError.message }),
              {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              }
            );
          }

          console.log("Prospect updated successfully");
          break;

        default:
          return new Response(
            JSON.stringify({ error: "Unknown event_type" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `${payload.event_type} processed successfully`,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
