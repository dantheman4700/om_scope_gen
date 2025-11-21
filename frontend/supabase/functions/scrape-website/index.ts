const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScrapeRequest {
  url?: string;
  pitchDeckUrl?: string;
}

interface ScrapedData {
  title?: string;
  description?: string;
  industry?: string;
  location?: string;
  content?: string;
  metadata?: Record<string, any>;
  aiListingTitle?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, pitchDeckUrl }: ScrapeRequest = await req.json();

    if (!url && !pitchDeckUrl) {
      return new Response(
        JSON.stringify({ error: 'At least one source (URL or pitch deck) is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    let websiteContent = '';
    let pitchDeckContent = '';
    let pageData: any = {};

    // Scrape website if URL provided
    if (url) {
      if (!FIRECRAWL_API_KEY) {
        console.error('FIRECRAWL_API_KEY not configured');
        return new Response(
          JSON.stringify({ error: 'Firecrawl API key not configured' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Scraping website:', url);

      const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          formats: ['markdown', 'html'],
          onlyMainContent: true,
          includeTags: ['title', 'meta', 'h1', 'h2', 'p'],
        }),
      });

      if (!scrapeResponse.ok) {
        const errorText = await scrapeResponse.text();
        console.error('Firecrawl API error:', scrapeResponse.status, errorText);
        
        let errorMessage = 'Failed to scrape website';
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (e) {
          // If not JSON, use the raw error text
          errorMessage = errorText || errorMessage;
        }
        
        return new Response(
          JSON.stringify({ 
            error: errorMessage,
            success: false 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const scrapeResult = await scrapeResponse.json();
      console.log('Firecrawl response structure:', JSON.stringify(scrapeResult, null, 2));

      if (!scrapeResult.success) {
        console.error('Scrape failed:', scrapeResult);
        const errorMsg = scrapeResult.error || 'Failed to scrape website. Please check the URL and try again.';
        return new Response(
          JSON.stringify({ 
            error: errorMsg,
            success: false 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Scrape successful');
      pageData = scrapeResult.data || {};
      websiteContent = pageData.markdown || pageData.content || '';
    }

    // Extract pitch deck content if provided
    if (pitchDeckUrl && LOVABLE_API_KEY) {
      try {
        console.log('Processing pitch deck:', pitchDeckUrl);
        
        // Fetch the pitch deck file
        const fileResponse = await fetch(pitchDeckUrl);
        if (!fileResponse.ok) {
          console.error('Failed to fetch pitch deck');
        } else {
          const fileBlob = await fileResponse.blob();
          const base64Data = btoa(String.fromCharCode(...new Uint8Array(await fileBlob.arrayBuffer())));
          
          // Use AI to extract text from the document
          const extractResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${LOVABLE_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'google/gemini-2.5-flash',
              messages: [
                {
                  role: 'user',
                  content: [
                    {
                      type: 'text',
                      text: 'Extract all key information from this pitch deck/pitch book. Include company overview, business model, financials, market opportunity, team, and any other relevant details for an M&A listing.'
                    },
                    {
                      type: 'image_url',
                      image_url: {
                        url: `data:${fileBlob.type};base64,${base64Data}`
                      }
                    }
                  ]
                }
              ],
            }),
          });

          if (extractResponse.ok) {
            const extractData = await extractResponse.json();
            pitchDeckContent = extractData.choices?.[0]?.message?.content || '';
            console.log('Pitch deck extracted, content length:', pitchDeckContent.length);
          }
        }
      } catch (error) {
        console.error('Error processing pitch deck:', error);
        // Continue without pitch deck content
      }
    }

    
    // Combine website and pitch deck content
    const combinedContent = `${websiteContent}\n\n${pitchDeckContent}`.trim();
    const content = combinedContent || websiteContent;
    
    console.log('Extracted content length:', content.length);
    console.log('Page metadata:', JSON.stringify(pageData.metadata, null, 2));
    
    // Extract structured data from the scraped content
    const scrapedData: ScrapedData = {
      title: pageData.metadata?.title || pageData.title || '',
      description: '', // Will be AI-generated below
      content: content.substring(0, 5000), // First 5000 chars
      metadata: {
        ogTitle: pageData.metadata?.ogTitle,
        ogDescription: pageData.metadata?.ogDescription,
        keywords: pageData.metadata?.keywords,
        author: pageData.metadata?.author,
        language: pageData.metadata?.language,
        url: pageData.metadata?.sourceURL || url,
      }
    };

    // Extract industry
    const industryKeywords = {
      'Technology': ['technology', 'software', 'saas', 'tech', 'digital', 'app', 'platform', 'cloud', 'ai', 'data'],
      'Healthcare': ['healthcare', 'medical', 'health', 'hospital', 'clinic', 'pharma', 'biotech'],
      'Manufacturing': ['manufacturing', 'factory', 'production', 'industrial', 'semiconductor', 'chip', 'foundry', 'hardware'],
      'Consumer': ['consumer', 'retail', 'ecommerce', 'e-commerce', 'marketplace', 'shopping'],
      'Financial': ['financial', 'finance', 'banking', 'fintech', 'investment', 'trading'],
      'Logistics': ['logistics', 'shipping', 'transportation', 'supply chain', 'delivery', 'warehouse']
    };
    
    let foundIndustry = '';
    let maxMatches = 0;
    
    for (const [industry, keywords] of Object.entries(industryKeywords)) {
      const matches = keywords.filter(keyword => 
        content.toLowerCase().includes(keyword)
      ).length;
      
      if (matches > maxMatches) {
        maxMatches = matches;
        foundIndustry = industry;
      }
    }
    
    if (foundIndustry) {
      scrapedData.industry = foundIndustry;
    }
    
    console.log('Detected industry:', foundIndustry);
    
    // Extract location with better patterns
    const locationRegex = /(?:based in|located in|headquarters|headquartered in|office in|founded in|from)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,?\s*(?:CA|California|NY|New York|TX|Texas|FL|Florida|MA|Massachusetts|WA|Washington|IL|Illinois|PA|Pennsylvania|OH|Ohio|GA|Georgia|NC|North Carolina|MI|Michigan|NJ|New Jersey|VA|Virginia|AZ|Arizona|TN|Tennessee|IN|Indiana|MO|Missouri|MD|Maryland|WI|Wisconsin|CO|Colorado|MN|Minnesota))/gi;
    
    const locationMatches = content.match(locationRegex);
    if (locationMatches && locationMatches.length > 0) {
      // Take the first match and clean it up
      const cleanLocation = locationMatches[0]
        .replace(/(?:based in|located in|headquarters|headquartered in|office in|founded in|from)\s+/gi, '')
        .trim();
      scrapedData.location = cleanLocation;
      console.log('Extracted location:', cleanLocation);
    }

    // Use AI to generate both listing title and business description
    if (LOVABLE_API_KEY && scrapedData.title) {
      try {
        const contentSnippet = content.substring(0, 3000); // Use more content for context
        
        // Build source description
        let sourceInfo = '';
        if (websiteContent && pitchDeckContent) {
          sourceInfo = 'company website and pitch deck';
        } else if (pitchDeckContent) {
          sourceInfo = 'pitch deck';
        } else {
          sourceInfo = 'company website';
        }
        
        console.log(`Generating AI content from: ${sourceInfo}`);
        
        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              {
                role: 'system',
                content: 'You are an expert M&A advisor creating professional acquisition listings. Generate compelling, professional content that would attract serious buyers.'
              },
              {
                role: 'user',
                content: `Based on this company information from ${sourceInfo}, create:
1. A compelling M&A listing title (40-60 chars) that highlights the business value proposition, NOT just the company name. Focus on what makes this a great acquisition.
2. A professional business description (150-250 words) suitable for an M&A listing that highlights key metrics, market position, and acquisition appeal.

Company: ${scrapedData.title}
Industry: ${scrapedData.industry || 'Technology'}
Location: ${scrapedData.location || 'Not specified'}

Content: ${contentSnippet}

Format your response as JSON:
{
  "listingTitle": "your compelling title here",
  "businessDescription": "your detailed description here"
}`
              }
            ],
            response_format: { type: "json_object" },
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const responseText = aiData.choices?.[0]?.message?.content?.trim();
          
          if (responseText) {
            try {
              const parsed = JSON.parse(responseText);
              if (parsed.listingTitle) {
                scrapedData.aiListingTitle = parsed.listingTitle;
                console.log('AI generated listing title:', parsed.listingTitle);
              }
              if (parsed.businessDescription) {
                scrapedData.description = parsed.businessDescription;
                console.log('AI generated description:', parsed.businessDescription.substring(0, 100) + '...');
              }
            } catch (parseError) {
              console.error('Failed to parse AI response as JSON:', parseError);
            }
          }
        } else {
          console.error('AI request failed:', aiResponse.status, await aiResponse.text());
        }
      } catch (aiError) {
        console.error('AI generation failed:', aiError);
        // Fallback to metadata description
        scrapedData.description = pageData.metadata?.description || pageData.metadata?.ogDescription || '';
      }
    } else {
      // No AI available, use metadata
      scrapedData.description = pageData.metadata?.description || pageData.metadata?.ogDescription || '';
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        data: scrapedData,
        rawContent: pageData.markdown || pageData.content,
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in scrape-website function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        details: error instanceof Error ? error.stack : undefined
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
