import { useState, useEffect } from "react";
import { ArrowLeft, Save } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { listings as listingsApi, tenants as tenantsApi, upload as uploadApi, Listing } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { listingSchema } from "@/lib/validationSchemas";
import * as XLSX from 'xlsx';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const AdminCreate = () => {
  const [searchParams] = useSearchParams();
  const editingId = searchParams.get('id');
  
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [industry, setIndustry] = useState("");
  const [location, setLocation] = useState("");
  const [revenue, setRevenue] = useState("");
  const [ebitda, setEbitda] = useState("");
  const [askingPrice, setAskingPrice] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string>("");
  const [isAnonymized, setIsAnonymized] = useState(false);
  const [visibilityLevel, setVisibilityLevel] = useState("public");
  const [status, setStatus] = useState("draft");
  const [loading, setLoading] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [scrapedData, setScrapedData] = useState<any>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  
  // New fields
  const [sourceCodeRepository, setSourceCodeRepository] = useState("");
  const [patentFile, setPatentFile] = useState<File | null>(null);
  const [patentFileUrl, setPatentFileUrl] = useState<string>("");
  const [patentCount, setPatentCount] = useState<number>(0);
  const [patents, setPatents] = useState<string[]>([]);
  const [patentInput, setPatentInput] = useState("");
  const [trademarks, setTrademarks] = useState<string[]>([]);
  const [trademarkInput, setTrademarkInput] = useState("");
  const [trademarkSerialNumber, setTrademarkSerialNumber] = useState("");
  const [searchingTrademarks, setSearchingTrademarks] = useState(false);
  const [copyrights, setCopyrights] = useState<string[]>([]);
  const [copyrightInput, setCopyrightInput] = useState("");
  const [dataBreakdown, setDataBreakdown] = useState("");
  
  // Key Assets
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);
  const [brandDetails, setBrandDetails] = useState("");
  const [domainDetails, setDomainDetails] = useState("");
  const [codebaseDetails, setCodebaseDetails] = useState("");
  const [websiteDetails, setWebsiteDetails] = useState("");
  const [customerListDetails, setCustomerListDetails] = useState("");
  const [socialMediaDetails, setSocialMediaDetails] = useState("");
  const [emailListDetails, setEmailListDetails] = useState("");
  const [revenueStreamsDetails, setRevenueStreamsDetails] = useState("");
  const [mobileAppsDetails, setMobileAppsDetails] = useState("");
  const [inventoryDetails, setInventoryDetails] = useState("");
  const [documentationDetails, setDocumentationDetails] = useState("");
  const [technologyDetails, setTechnologyDetails] = useState("");
  const [commercialAssetsDetails, setCommercialAssetsDetails] = useState("");
  
  // Offering Memorandum Fields
  const [marketData, setMarketData] = useState("");
  const [targetMarkets, setTargetMarkets] = useState("");
  const [softwarePlatforms, setSoftwarePlatforms] = useState("");
  const [advancedChipArchitectures, setAdvancedChipArchitectures] = useState("");
  const [physicalInventory, setPhysicalInventory] = useState("");
  const [commercialAssets, setCommercialAssets] = useState("");
  const [documentationEducational, setDocumentationEducational] = useState("");
  const [opensourceComponents, setOpensourceComponents] = useState("");
  const [competitiveAdvantages, setCompetitiveAdvantages] = useState("");
  const [intellectualPropertyDetails, setIntellectualPropertyDetails] = useState("");
  const [termsConditions, setTermsConditions] = useState("");
  const [offerDeadline, setOfferDeadline] = useState("");
  const [isABC, setIsABC] = useState(false);
  
  const { user, hasRole } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      toast.error("Please sign in to create listings");
      navigate("/auth");
      return;
    }

    // Check if user has admin or editor role
    const isAdmin = hasRole('admin');
    const isEditor = hasRole('editor');
    
    if (!isAdmin && !isEditor) {
      toast.error("You don't have permission to create listings. Only admins and editors can create listings.");
      navigate("/");
      return;
    }

    // Fetch default tenant
    const fetchTenant = async () => {
      try {
        const { tenant } = await tenantsApi.get('sherwood');
        if (tenant) {
          setTenantId(tenant.id);
        }
      } catch (error) {
        console.error('Error fetching tenant:', error);
      }
    };

    // Load existing listing if editing
    const loadListing = async () => {
      if (!editingId) return;
      
      try {
        const { listing } = await listingsApi.get(editingId);
      
      // Populate form with existing data
        setTitle(listing.title || "");
        setDescription(listing.description || "");
        setIndustry(listing.industry || "");
        setLocation(listing.location || "");
        setCompanyName(listing.company_name || "");
        setCompanyWebsite(listing.company_website || "");
        setRevenue(listing.revenue?.toString() || "");
        setEbitda(listing.ebitda?.toString() || "");
        setAskingPrice(listing.asking_price?.toString() || "");
        setIsAnonymized(listing.is_anonymized || false);
        setVisibilityLevel(listing.visibility_level || "public");
        setStatus(listing.status || "draft");
        setScrapedData(listing.scraped_data);
        setTenantId(listing.tenant_id);
      
      // Load new fields
        setPatentFileUrl(listing.patent_file_url || "");
        setPatentCount(listing.patent_count || 0);
        setPatents(listing.patents || []);
        setTrademarks(listing.trademarks || []);
        setCopyrights(listing.copyrights || []);
        setDataBreakdown(listing.data_breakdown ? JSON.stringify(listing.data_breakdown, null, 2) : "");
      
      // Load key assets from meta
        const meta = listing.meta as Record<string, any> | null;
        if (meta && typeof meta === 'object') {
        if (meta.keyAssets) {
          setSelectedAssets(meta.keyAssets.selected || []);
          setBrandDetails(meta.keyAssets.brand || "");
          setDomainDetails(meta.keyAssets.domain || "");
          setCodebaseDetails(meta.keyAssets.codebase || "");
          setWebsiteDetails(meta.keyAssets.website || "");
          setCustomerListDetails(meta.keyAssets.customerList || "");
          setSocialMediaDetails(meta.keyAssets.socialMedia || "");
          setEmailListDetails(meta.keyAssets.emailList || "");
          setRevenueStreamsDetails(meta.keyAssets.revenueStreams || "");
          setMobileAppsDetails(meta.keyAssets.mobileApps || "");
          setInventoryDetails(meta.keyAssets.inventory || "");
          setDocumentationDetails(meta.keyAssets.documentation || "");
          setTechnologyDetails(meta.keyAssets.technology || "");
          setCommercialAssetsDetails(meta.keyAssets.commercialAssets || "");
        }
        // Load offering memorandum fields
        if (meta.offering_memorandum_summary) {
          setMarketData(JSON.stringify(meta.offering_memorandum_summary.market_data || {}, null, 2));
          setCompetitiveAdvantages(JSON.stringify(meta.offering_memorandum_summary.competitive_advantages || [], null, 2));
          setTermsConditions(meta.offering_memorandum_summary.terms_conditions || "");
          setOfferDeadline(meta.offering_memorandum_summary.offer_deadline || "");
          setIsABC(meta.offering_memorandum_summary.is_abc || false);
        }
      }
      
      // Load data_breakdown fields
        const dataBreakdownData = listing.data_breakdown as Record<string, any> | null;
        if (dataBreakdownData && typeof dataBreakdownData === 'object') {
          setTargetMarkets(JSON.stringify(dataBreakdownData.target_markets || [], null, 2));
          setSoftwarePlatforms(JSON.stringify(dataBreakdownData.software_platforms || [], null, 2));
          setAdvancedChipArchitectures(JSON.stringify(dataBreakdownData.advanced_chip_architectures || [], null, 2));
          setPhysicalInventory(JSON.stringify(dataBreakdownData.physical_inventory || [], null, 2));
          setCommercialAssets(JSON.stringify(dataBreakdownData.commercial_assets || [], null, 2));
          setDocumentationEducational(JSON.stringify(dataBreakdownData.documentation_educational || [], null, 2));
          setOpensourceComponents(JSON.stringify(dataBreakdownData.opensource_components || [], null, 2));
          setIntellectualPropertyDetails(JSON.stringify(dataBreakdownData.intellectual_property || [], null, 2));
      }
      } catch (error) {
        toast.error("Failed to load listing");
      }
    };

    fetchTenant();
    loadListing();
  }, [user, hasRole, navigate, editingId]);

  const parsePatentFile = async (file: File): Promise<{ patents: string[], count: number }> => {
    try {
      console.log('Starting to parse patent file:', file.name);
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer);
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];
      
      console.log('Excel data rows:', data.length);
      
      // Find the header row and locate "Publication Number" column
      let publicationColumnIndex = -1;
      let headerRowIndex = -1;
      
      for (let i = 0; i < Math.min(5, data.length); i++) {
        const row = data[i];
        const publicationColIdx = row.findIndex(cell => 
          typeof cell === 'string' && 
          cell.toLowerCase().includes('publication') && 
          cell.toLowerCase().includes('number')
        );
        
        if (publicationColIdx !== -1) {
          publicationColumnIndex = publicationColIdx;
          headerRowIndex = i;
          console.log('Found Publication Number column at index:', publicationColIdx, 'in row:', i);
          break;
        }
      }
      
      if (publicationColumnIndex === -1) {
        toast.error("Could not find 'Publication Number' column in the file");
        return { patents: [], count: 0 };
      }
      
      // Extract patent numbers from the Publication Number column
      const patentList: string[] = [];
      for (let i = headerRowIndex + 1; i < data.length; i++) {
        const row = data[i];
        const patentNumber = row[publicationColumnIndex];
        
        if (patentNumber && String(patentNumber).trim()) {
          patentList.push(String(patentNumber).trim());
        }
      }
      
      console.log('Extracted patents from Publication Number column:', patentList.length, patentList.slice(0, 5));
      
      if (patentList.length > 0) {
        setPatents(patentList);
        setPatentCount(patentList.length);
          toast.success(`Extracted ${patentList.length} patents from file`);
        return { patents: patentList, count: patentList.length };
      } else {
        toast.warning("No patent data found in Publication Number column");
        return { patents: [], count: 0 };
      }
    } catch (error) {
      console.error('Error parsing patent file:', error);
      toast.error("Failed to parse patent file. Please check the file format.");
      return { patents: [], count: 0 };
    }
  };

  const handleSearchTrademarks = async () => {
    if (!companyName.trim() && !trademarkSerialNumber.trim()) {
      toast.error("Please enter a company name or serial number");
      return;
    }

    setSearchingTrademarks(true);
    try {
      const response = await fetch(`${API_BASE}/search-trademarks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: companyName.trim() || undefined,
          serialNumber: trademarkSerialNumber.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to search trademarks');
      }

      if (data.success && data.trademarks) {
        const foundTrademarks = data.trademarks;
        
        if (foundTrademarks.length === 0) {
          toast.info(data.note || "No trademarks found");
          return;
        }
        
        // Add trademark identifications to the list
        const newTrademarks = foundTrademarks.map((tm: any) => 
          tm.registrationNumber 
            ? `${tm.markIdentification} (Reg. ${tm.registrationNumber})` 
            : `${tm.markIdentification} (Serial ${tm.serialNumber})`
        );
        
        // Merge with existing trademarks, avoiding duplicates
        const combined = [...new Set([...trademarks, ...newTrademarks])];
        setTrademarks(combined);
        
        toast.success(`Found ${foundTrademarks.length} trademark${foundTrademarks.length !== 1 ? 's' : ''} from USPTO!`);
        setTrademarkSerialNumber(""); // Clear the serial number input
      } else if (data.note) {
        toast.info(data.note);
      }
      
    } catch (error: any) {
      console.error('Error searching trademarks:', error);
      toast.error(error.message || "Failed to search trademarks");
    } finally {
      setSearchingTrademarks(false);
    }
  };

  const handleScrapeWebsite = async () => {
    if (!companyWebsite && !uploadedFile) {
      toast.error("Please provide at least a company website or pitch deck");
      return;
    }

    setScraping(true);
    try {
      let pitchDeckUrl = uploadedFileUrl;
      
      // Upload file if provided
      if (uploadedFile && !uploadedFileUrl) {
        const result = await uploadApi.pitchDeck(uploadedFile);
        pitchDeckUrl = result.url;
        setUploadedFileUrl(pitchDeckUrl);
      }

      const response = await fetch(`${API_BASE}/scrape-website`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: companyWebsite || undefined,
          pitchDeckUrl: pitchDeckUrl || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process information');
      }

      if (data.success) {
        setScrapedData(data.data);
        
        // Auto-fill company name from scraped title
        if (data.data.title && !companyName) {
          setCompanyName(data.data.title);
        }
        
        // Auto-fill description
        if (data.data.description && !description) {
          setDescription(data.data.description);
        }
        
        // Auto-fill industry
        if (data.data.industry && !industry) {
          setIndustry(data.data.industry);
        }
        
        // Auto-fill location if extracted
        if (data.data.location && !location) {
          setLocation(data.data.location);
        }
        
        // Generate AI listing title if we have scraped data
        if (data.data.aiListingTitle && !title) {
          setTitle(data.data.aiListingTitle);
        }
        
        const sources = [];
        if (companyWebsite) sources.push('website');
        if (pitchDeckUrl) sources.push('pitch deck');
        
        toast.success(`Information processed from ${sources.join(' and ')}! Review and edit the auto-filled data.`);
      } else {
        throw new Error(data.error || 'Failed to process information');
      }
    } catch (error: any) {
      console.error('Error processing information:', error);
      toast.error(error.message || "Failed to process information");
    } finally {
      setScraping(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!tenantId) {
      toast.error("Tenant not found. Please try again.");
      return;
    }

    setLoading(true);

    try {
      // Validate form data
      const validationResult = listingSchema.safeParse({
        title: title.trim(),
        description: description.trim(),
        industry,
        location: location.trim(),
        companyName: companyName.trim(),
        companyWebsite: companyWebsite.trim(),
        revenue: revenue ? parseInt(revenue.replace(/[^0-9]/g, '')) || undefined : undefined,
        ebitda: ebitda ? parseInt(ebitda.replace(/[^0-9]/g, '')) || undefined : undefined,
        askingPrice: askingPrice ? parseInt(askingPrice.replace(/[^0-9]/g, '')) || undefined : undefined,
        visibilityLevel: visibilityLevel as 'public' | 'private'
      });

      if (!validationResult.success) {
        const errors = validationResult.error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join('\n');
        toast.error("Validation Error", {
          description: errors
        });
        setLoading(false);
        return;
      }

      // Parse data breakdown if provided
      let parsedDataBreakdown: Record<string, any> | null = null;
      if (dataBreakdown.trim()) {
        try {
          parsedDataBreakdown = JSON.parse(dataBreakdown);
        } catch (error) {
          toast.error("Invalid JSON format in data breakdown");
          setLoading(false);
          return;
        }
      }
      
      // Build data_breakdown from individual fields
      const dataBreakdownObj: Record<string, any> = { ...parsedDataBreakdown };
      
      if (targetMarkets.trim()) {
        try { dataBreakdownObj.target_markets = JSON.parse(targetMarkets); } catch(e) {}
      }
      if (softwarePlatforms.trim()) {
        try { dataBreakdownObj.software_platforms = JSON.parse(softwarePlatforms); } catch(e) {}
      }
      if (advancedChipArchitectures.trim()) {
        try { dataBreakdownObj.advanced_chip_architectures = JSON.parse(advancedChipArchitectures); } catch(e) {}
      }
      if (physicalInventory.trim()) {
        try { dataBreakdownObj.physical_inventory = JSON.parse(physicalInventory); } catch(e) {}
      }
      if (commercialAssets.trim()) {
        try { dataBreakdownObj.commercial_assets = JSON.parse(commercialAssets); } catch(e) {}
      }
      if (documentationEducational.trim()) {
        try { dataBreakdownObj.documentation_educational = JSON.parse(documentationEducational); } catch(e) {}
      }
      if (opensourceComponents.trim()) {
        try { dataBreakdownObj.opensource_components = JSON.parse(opensourceComponents); } catch(e) {}
      }
      if (intellectualPropertyDetails.trim()) {
        try { dataBreakdownObj.intellectual_property = JSON.parse(intellectualPropertyDetails); } catch(e) {}
      }
      
      parsedDataBreakdown = Object.keys(dataBreakdownObj).length > 0 ? dataBreakdownObj : null;

      const listingData = {
        title: validationResult.data.title,
        description: validationResult.data.description,
        industry: validationResult.data.industry,
        location: validationResult.data.location,
        companyName: validationResult.data.companyName,
        companyWebsite: validationResult.data.companyWebsite || undefined,
        isAnonymized,
        revenue: validationResult.data.revenue || undefined,
        ebitda: validationResult.data.ebitda || undefined,
        askingPrice: validationResult.data.askingPrice || undefined,
        visibilityLevel: validationResult.data.visibilityLevel as 'public' | 'private',
        sourceCodeRepository: sourceCodeRepository.trim() || undefined,
        patentCount: patentCount || undefined,
        patents: patents.length > 0 ? patents : undefined,
        trademarks: trademarks.length > 0 ? trademarks : undefined,
        copyrights: copyrights.length > 0 ? copyrights : undefined,
        dataBreakdown: parsedDataBreakdown || undefined,
        status: status as 'draft' | 'active' | 'closed' | 'archived',
        meta: {
          sourceCodeRepository,
          patentCount,
          dataBreakdown: parsedDataBreakdown,
          keyAssets: {
            selected: selectedAssets,
            brand: brandDetails,
            domain: domainDetails,
            codebase: codebaseDetails,
            website: websiteDetails,
            customerList: customerListDetails,
            socialMedia: socialMediaDetails,
            emailList: emailListDetails,
            revenueStreams: revenueStreamsDetails,
            mobileApps: mobileAppsDetails,
            inventory: inventoryDetails,
            documentation: documentationDetails,
            technology: technologyDetails,
            commercialAssets: commercialAssetsDetails,
          },
          offering_memorandum_summary: {
            market_data: marketData.trim() ? JSON.parse(marketData) : null,
            competitive_advantages: competitiveAdvantages.trim() ? JSON.parse(competitiveAdvantages) : null,
            terms_conditions: termsConditions.trim() || null,
            offer_deadline: offerDeadline.trim() || null,
            is_abc: isABC,
          },
        },
      };

      let result;

      if (editingId) {
        // Update existing listing
        result = await listingsApi.update(editingId, listingData);
          toast.success("Listing updated successfully!");
      } else {
        // Create new listing
        result = await listingsApi.create(listingData);
          toast.success("Listing created successfully!");
        }

      // Upload patent file after listing is created/updated
      if (patentFile && result.listing) {
        try {
          const uploadResult = await uploadApi.patentFile(patentFile);
          // Update listing with patent file URL
          await listingsApi.update(result.listing.id, {
            meta: {
              ...result.listing.meta,
              patentFileUrl: uploadResult.url,
            },
          });
          toast.success("Patent file uploaded successfully!");
        } catch (uploadError) {
          console.error('Patent file upload error:', uploadError);
          toast.error("Listing saved but patent file upload failed.");
        }
      }
      
      // Navigate to the listing detail page
      navigate(`/listing/${result.listing.id}`);
    } catch (error: any) {
      console.error('Error saving listing:', error);
      toast.error(error.message || "Failed to save listing. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              </Link>
              <div className="border-l border-border h-6" />
              <span className="text-2xl font-bold text-primary">M&A Platform</span>
            </div>
            <div className="flex items-center gap-3">
              <Button type="submit" form="listing-form" disabled={loading}>
                <Save className="h-4 w-4 mr-2" />
                {loading ? (editingId ? "Updating..." : "Publishing...") : (editingId ? "Update Listing" : "Publish Listing")}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {editingId ? "Edit Listing" : "Create New Listing"}
          </h1>
          <p className="text-muted-foreground">
            {editingId 
              ? "Update the listing details below." 
              : "Fill in the details below to create a new acquisition opportunity listing."
            }
          </p>
        </div>

        <form id="listing-form" onSubmit={handleSubmit} className="space-y-6">
          {/* Company Website - Start Here */}
          <Card>
            <CardHeader>
              <CardTitle>Company Source Information</CardTitle>
              <CardDescription>
                Provide website AND/OR pitch materials - AI will use all available sources for best results
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="companyWebsite">Company Website</Label>
                <Input
                  id="companyWebsite"
                  type="text"
                  placeholder="example.com or https://example.com"
                  value={companyWebsite}
                  onChange={(e) => setCompanyWebsite(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Enter domain name (e.g., example.com) - AI will process it automatically
                </p>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">And/Or</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pitchDeck">Upload Pitch Deck / Pitch Book</Label>
                <Input
                  id="pitchDeck"
                  type="file"
                  accept=".pdf,.pptx,.docx"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setUploadedFile(file);
                      setUploadedFileUrl(""); // Clear previous URL
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  PDF, PowerPoint, or Word (max 20MB) - combines with website data
                </p>
                {uploadedFile && (
                  <p className="text-xs text-green-600">
                    ✓ {uploadedFile.name} ready to upload
                  </p>
                )}
              </div>

              <Button
                type="button"
                onClick={handleScrapeWebsite}
                disabled={scraping || (!companyWebsite && !uploadedFile)}
                className="w-full"
              >
                {scraping ? "Processing..." : "Process All Information"}
              </Button>
            </CardContent>
          </Card>

          {/* Company Information */}
          <Card>
            <CardHeader>
              <CardTitle>Company Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name</Label>
                <Input
                  id="companyName"
                  placeholder="e.g., Acme Corporation"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Leave blank if creating an anonymized listing
                </p>
              </div>

              <div className="pt-4 border-t border-border">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Anonymize Listing</Label>
                    <p className="text-sm text-muted-foreground">
                      Hide company name until NDA is signed
                    </p>
                  </div>
                  <Switch
                    checked={isAnonymized}
                    onCheckedChange={setIsAnonymized}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Listing Title *</Label>
                <Input
                  id="title"
                  placeholder="e.g., SaaS Platform - B2B Enterprise"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Business Description *</Label>
                <Textarea
                  id="description"
                  placeholder="Provide a comprehensive overview of the business..."
                  rows={5}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                />
              </div>
            </CardContent>
          </Card>

          {/* Key Highlights */}
          <Card>
            <CardHeader>
              <CardTitle>Key Highlights</CardTitle>
              <CardDescription>These metrics appear prominently in the listing overview</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="revenue">Annual Revenue</Label>
                  <Input
                    id="revenue"
                    placeholder="e.g., 5200000"
                    value={revenue}
                    onChange={(e) => setRevenue(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Enter amount in dollars</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ebitda">EBITDA</Label>
                  <Input
                    id="ebitda"
                    placeholder="e.g., 1800000"
                    value={ebitda}
                    onChange={(e) => setEbitda(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Enter amount in dollars</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="askingPrice">Asking Price</Label>
                  <Input
                    id="askingPrice"
                    placeholder="e.g., 15000000"
                    value={askingPrice}
                    onChange={(e) => setAskingPrice(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Enter amount in dollars</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="industry-highlight">Industry</Label>
                  <Select value={industry} onValueChange={setIndustry}>
                    <SelectTrigger id="industry-highlight">
                      <SelectValue placeholder="Select industry" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Technology">Technology</SelectItem>
                      <SelectItem value="Healthcare">Healthcare</SelectItem>
                      <SelectItem value="Finance">Finance</SelectItem>
                      <SelectItem value="E-commerce">E-commerce</SelectItem>
                      <SelectItem value="Manufacturing">Manufacturing</SelectItem>
                      <SelectItem value="Real Estate">Real Estate</SelectItem>
                      <SelectItem value="SaaS">SaaS</SelectItem>
                      <SelectItem value="Retail">Retail</SelectItem>
                      <SelectItem value="Education">Education</SelectItem>
                      <SelectItem value="Media">Media & Entertainment</SelectItem>
                      <SelectItem value="Energy">Energy</SelectItem>
                      <SelectItem value="Transportation">Transportation</SelectItem>
                      <SelectItem value="Consumer">Consumer Goods</SelectItem>
                      <SelectItem value="Financial">Financial Services</SelectItem>
                      <SelectItem value="Logistics">Logistics</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location-highlight">Location</Label>
                  <Input
                    id="location-highlight"
                    placeholder="e.g., San Francisco, CA"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Intellectual Property */}
          <Card>
            <CardHeader>
              <CardTitle>Intellectual Property</CardTitle>
              <CardDescription>Patents, trademarks, and other IP assets</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                <Label htmlFor="patentCount">Number of Patents</Label>
                <Input
                  id="patentCount"
                  type="number"
                  min="0"
                  placeholder="e.g., 15"
                  value={patentCount || ""}
                  onChange={(e) => setPatentCount(parseInt(e.target.value) || 0)}
                  />
                </div>
                
                <div className="space-y-2">
                <Label htmlFor="patentFile">Patent List File (Excel/CSV)</Label>
                <Input
                  id="patentFile"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setPatentFile(file);
                      setPatentFileUrl("");
                      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv')) {
                        await parsePatentFile(file);
                      }
                    }
                  }}
                />
                {patents.length > 0 && (
                  <p className="text-xs text-green-600">
                    ✓ {patents.length} patents extracted
                  </p>
                )}
              </div>

              <div className="space-y-2">
                  <Label htmlFor="trademarks">Trademarks</Label>
                <div className="flex gap-2">
                  <Input
                    id="trademarks"
                    placeholder="Add trademark name"
                    value={trademarkInput}
                    onChange={(e) => setTrademarkInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (trademarkInput.trim()) {
                          setTrademarks([...trademarks, trademarkInput.trim()]);
                          setTrademarkInput("");
                        }
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (trademarkInput.trim()) {
                        setTrademarks([...trademarks, trademarkInput.trim()]);
                        setTrademarkInput("");
                      }
                    }}
                  >
                    Add
                  </Button>
                </div>
                {trademarks.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {trademarks.map((trademark, idx) => (
                      <Badge key={idx} variant="secondary">
                        {trademark}
                        <button
                          type="button"
                          onClick={() => setTrademarks(trademarks.filter((_, i) => i !== idx))}
                          className="ml-2 hover:text-destructive"
                        >
                          ×
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Privacy & Visibility Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Privacy & Visibility Settings</CardTitle>
              <CardDescription>Control who can see and access this listing</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="visibility">Visibility Level</Label>
                <Select value={visibilityLevel} onValueChange={setVisibilityLevel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public - Show in marketplace</SelectItem>
                    <SelectItem value="private">Private - Link only access</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Submit Buttons */}
          <div className="flex gap-4">
            <Button type="submit" size="lg" className="flex-1" disabled={loading}>
              <Save className="h-4 w-4 mr-2" />
              {loading ? (editingId ? "Updating..." : "Publishing...") : (editingId ? "Update Listing" : "Publish Listing")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminCreate;
