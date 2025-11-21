import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DnsValidationRequest {
  domain: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { domain }: DnsValidationRequest = await req.json();

    if (!domain) {
      return new Response(
        JSON.stringify({ error: "Domain is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Validating DNS for domain:", domain);

    // In a real implementation, you would use DNS lookup libraries
    // For now, we'll simulate the validation
    const results = {
      spf: await validateSpfRecord(domain),
      dkim: await validateDkimRecord(domain),
      cname: await validateCnameRecord(domain),
    };

    console.log("DNS validation results:", results);

    return new Response(
      JSON.stringify(results),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error validating DNS:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function validateSpfRecord(domain: string): Promise<boolean> {
  try {
    // DNS TXT lookup for SPF record
    // In production, use Deno's DNS API or external DNS service
    const response = await fetch(`https://dns.google/resolve?name=${domain}&type=TXT`);
    const data = await response.json();
    
    if (data.Answer) {
      return data.Answer.some((record: any) => 
        record.data.includes("v=spf1") && record.data.includes("mailgun.org")
      );
    }
    return false;
  } catch (error) {
    console.error("SPF validation error:", error);
    return false;
  }
}

async function validateDkimRecord(domain: string): Promise<boolean> {
  try {
    // DNS TXT lookup for DKIM record
    const dkimDomain = `mg._domainkey.${domain}`;
    const response = await fetch(`https://dns.google/resolve?name=${dkimDomain}&type=TXT`);
    const data = await response.json();
    
    if (data.Answer) {
      return data.Answer.some((record: any) => 
        record.data.includes("k=rsa") && record.data.includes("p=")
      );
    }
    return false;
  } catch (error) {
    console.error("DKIM validation error:", error);
    return false;
  }
}

async function validateCnameRecord(domain: string): Promise<boolean> {
  try {
    // DNS CNAME lookup
    const cnameSubdomain = `email.${domain}`;
    const response = await fetch(`https://dns.google/resolve?name=${cnameSubdomain}&type=CNAME`);
    const data = await response.json();
    
    if (data.Answer) {
      return data.Answer.some((record: any) => 
        record.data.includes("mailgun.org")
      );
    }
    return false;
  } catch (error) {
    console.error("CNAME validation error:", error);
    return false;
  }
}
