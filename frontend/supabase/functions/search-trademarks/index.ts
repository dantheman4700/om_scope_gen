import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NormalizedTrademark {
  number: string;
  mark: string;
  owner: string;
  status: string;
  classes: string[];
  filingDate: string | null;
  registrationDate: string | null;
  raw: any;
}

// Rate limiting: simple in-memory tracker
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 333; // ~3 requests per second

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, maxRetries = 3, timeoutMs = 5000): Promise<Response> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempt ${attempt}/${maxRetries}: Fetching ${url}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        },
      });
      
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error);
      if (attempt === maxRetries) throw error;
      await sleep(1000 * attempt); // Exponential backoff
    }
  }
  throw new Error('Max retries exceeded');
}

function detectNumberType(number: string): 'serial' | 'registration' | null {
  // Registration numbers are typically 7 digits and start with specific patterns
  // Serial numbers are typically 8 digits
  const cleaned = number.replace(/[^0-9]/g, '');
  
  if (cleaned.length === 8) return 'serial';
  if (cleaned.length === 7) return 'registration';
  if (cleaned.length > 8) return 'serial'; // Assume newer serial
  
  return null;
}

function parseTSDRResponse(data: any, numberType: string, number: string): NormalizedTrademark | null {
  try {
    // TSDR response structure varies, try common paths
    const tmData = data.trademarkBag || data;
    const app = tmData.applicantBag?.[0] || tmData.applicant?.[0] || {};
    const status = tmData.statusBag?.[0] || tmData.status || {};
    const classification = tmData.classificationBag || [];
    
    return {
      number: number,
      mark: tmData.markCurrentStatusExternalDescriptionText || 
            tmData.markIdentification || 
            tmData.markLiteralElements || 
            'N/A',
      owner: app.applicantName || 
             app.ownerName || 
             tmData.ownerName || 
             'Unknown',
      status: status.statusCode || 
              status.markCurrentStatusExternalDescriptionText || 
              tmData.status || 
              'UNKNOWN',
      classes: classification.map((c: any) => 
        c.internationalClassNumber || c.classNumber
      ).filter(Boolean),
      filingDate: tmData.filingDate || tmData.applicationDate || null,
      registrationDate: tmData.registrationDate || null,
      raw: data,
    };
  } catch (error) {
    console.error('Error parsing TSDR response:', error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { companyName, serialNumber } = await req.json();

    // Block company name searches
    if (companyName && !serialNumber) {
      return new Response(
        JSON.stringify({ 
          error: 'USPTO does not support name searches via API. Use bulk data or a 3rd-party API.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!serialNumber) {
      return new Response(
        JSON.stringify({ error: 'Serial or registration number is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limiting
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
      await sleep(MIN_REQUEST_INTERVAL - timeSinceLastRequest);
    }
    lastRequestTime = Date.now();

    // Detect number type
    const numberType = detectNumberType(serialNumber);
    if (!numberType) {
      return new Response(
        JSON.stringify({ error: 'Invalid serial or registration number format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Looking up trademark: ${serialNumber} (type: ${numberType})`);

    // Build correct URL
    const prefix = numberType === 'serial' ? 'sn' : 'rn';
    const tsdrUrl = `https://tsdr.uspto.gov/ts/cd/casestatus/${prefix}${serialNumber}`;

    const response = await fetchWithRetry(tsdrUrl);

    console.log('USPTO Response Status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('USPTO API error:', response.status, errorText);
      return new Response(
        JSON.stringify({ 
          error: `Trademark not found (HTTP ${response.status})`,
          number: serialNumber,
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('Raw USPTO response keys:', Object.keys(data));

    const normalized = parseTSDRResponse(data, numberType, serialNumber);

    if (!normalized) {
      return new Response(
        JSON.stringify({ 
          error: 'Failed to parse trademark data',
          raw: data,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(normalized),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in search-trademarks function:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to search trademark',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
