import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { HttpError } from '../utils/httpError';

const router = Router();

// Validation schemas
const scrapeWebsiteSchema = z.object({
  url: z.string().url().optional(),
  pitchDeckUrl: z.string().url().optional(),
}).refine(data => data.url || data.pitchDeckUrl, {
  message: 'Either url or pitchDeckUrl is required',
});

const searchTrademarksSchema = z.object({
  companyName: z.string().optional(),
  serialNumber: z.string().optional(),
}).refine(data => data.companyName || data.serialNumber, {
  message: 'Either companyName or serialNumber is required',
});

const validateDnsSchema = z.object({
  domain: z.string().min(1, 'Domain is required'),
});

/**
 * POST /api/scrape-website
 * Scrape company website and/or process pitch deck
 */
router.post('/scrape-website', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validation = scrapeWebsiteSchema.safeParse(req.body);
    
    if (!validation.success) {
      throw HttpError.badRequest(
        validation.error.issues.map((e: any) => e.message).join(', ')
      );
    }

    const { url, pitchDeckUrl } = validation.data;

    // Mock response - in production, this would call actual scraping services
    const scrapedData = {
      title: url ? new URL(url).hostname.replace('www.', '').split('.')[0] : null,
      description: null,
      industry: null,
      location: null,
      aiListingTitle: null,
    };

    // Try to fetch basic website info
    if (url) {
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; MABot/1.0)',
          },
        });
        
        if (response.ok) {
          const html = await response.text();
          
          // Extract title
          const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
          if (titleMatch) {
            scrapedData.title = titleMatch[1].trim();
          }
          
          // Extract meta description
          const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
          if (descMatch) {
            scrapedData.description = descMatch[1].trim();
          }
        }
      } catch (fetchError) {
        console.error('Error fetching website:', fetchError);
      }
    }

    res.json({
      success: true,
      data: scrapedData,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/search-trademarks
 * Search USPTO trademark database
 */
router.post('/search-trademarks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validation = searchTrademarksSchema.safeParse(req.body);
    
    if (!validation.success) {
      throw HttpError.badRequest(
        validation.error.issues.map((e: any) => e.message).join(', ')
      );
    }

    const { companyName, serialNumber } = validation.data;

    // Mock response - in production, this would call USPTO API
    // The USPTO trademark API requires registration and has rate limits
    
    const trademarks: Array<{
      serialNumber: string;
      registrationNumber?: string;
      markIdentification: string;
      status: string;
    }> = [];

    // Return mock data for now
    res.json({
      success: true,
      trademarks,
      note: serialNumber 
        ? `Searched for serial number: ${serialNumber}` 
        : `Searched for company: ${companyName}`,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/validate-dns
 * Validate DNS records for email sending domain
 */
router.post('/validate-dns', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validation = validateDnsSchema.safeParse(req.body);
    
    if (!validation.success) {
      throw HttpError.badRequest(
        validation.error.issues.map((e: any) => e.message).join(', ')
      );
    }

    const { domain } = validation.data;

    // DNS verification would use Node's dns module or a DNS library
    // For now, return mock validation status
    
    // In production:
    // 1. Check SPF record: dns.resolveTxt(domain)
    // 2. Check DKIM record: dns.resolveTxt(`selector._domainkey.${domain}`)
    // 3. Check CNAME: dns.resolveCname(`mail.${domain}`)

    const verificationResult = {
      spf: false,
      dkim: false,
      cname: false,
    };

    try {
      // Mock verification - in production use dns.promises
      // const txtRecords = await dns.promises.resolveTxt(domain);
      // Check if SPF record exists
      verificationResult.spf = false; // Would check for 'v=spf1' in TXT records
      verificationResult.dkim = false; // Would check DKIM selector
      verificationResult.cname = false; // Would check CNAME record
    } catch (dnsError) {
      console.error('DNS lookup error:', dnsError);
    }

    res.json({
      success: true,
      domain,
      ...verificationResult,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/webhooks/dynamics
 * Handle incoming webhooks from Dynamics 365
 */
router.post('/webhooks/dynamics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = req.body;
    
    console.log('Received Dynamics webhook:', JSON.stringify(payload, null, 2));

    // Process the webhook based on type
    // This would integrate with Dynamics 365 CRM

    res.json({
      success: true,
      message: 'Webhook received',
    });
  } catch (error) {
    next(error);
  }
});

export default router;

