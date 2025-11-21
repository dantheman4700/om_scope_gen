import { useState, useEffect } from "react";
import { updateChipFoundryListing } from "@/utils/updateChipFoundryListing";
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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { listingSchema } from "@/lib/validationSchemas";
import * as XLSX from 'xlsx';

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
      const { data } = await supabase
        .from('tenants')
        .select('id')
        .eq('slug', 'sherwood')
        .maybeSingle();
      
      if (data) {
        setTenantId(data.id);
      }
    };

    // Load existing listing if editing
    const loadListing = async () => {
      if (!editingId) return;
      
      const { data, error } = await supabase
        .from('listings')
        .select('*')
        .eq('id', editingId)
        .single();
      
      if (error) {
        toast.error("Failed to load listing");
        return;
      }
      
      // Populate form with existing data
      setTitle(data.title || "");
      setDescription(data.description || "");
      setIndustry(data.industry || "");
      setLocation(data.location || "");
      setCompanyName(data.company_name || "");
      setCompanyWebsite(data.company_website || "");
      setRevenue(data.revenue?.toString() || "");
      setEbitda(data.ebitda?.toString() || "");
      setAskingPrice(data.asking_price?.toString() || "");
      setIsAnonymized(data.is_anonymized || false);
      setVisibilityLevel(data.visibility_level || "public");
      setStatus(data.status || "draft");
      setScrapedData(data.scraped_data);
      setTenantId(data.tenant_id);
      
      // Load new fields
      setSourceCodeRepository(data.source_code_repository || "");
      setPatentFileUrl(data.patent_file_url || "");
      setPatentCount(data.patent_count || 0);
      setPatents(data.patents || []);
      setTrademarks(data.trademarks || []);
      setCopyrights(data.copyrights || []);
      setDataBreakdown(data.data_breakdown ? JSON.stringify(data.data_breakdown, null, 2) : "");
      
      // Load key assets from meta
      if (data.meta && typeof data.meta === 'object' && !Array.isArray(data.meta)) {
        const meta = data.meta as Record<string, any>;
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
      if (data.data_breakdown && typeof data.data_breakdown === 'object') {
        const breakdown = data.data_breakdown as Record<string, any>;
        setTargetMarkets(JSON.stringify(breakdown.target_markets || [], null, 2));
        setSoftwarePlatforms(JSON.stringify(breakdown.software_platforms || [], null, 2));
        setAdvancedChipArchitectures(JSON.stringify(breakdown.advanced_chip_architectures || [], null, 2));
        setPhysicalInventory(JSON.stringify(breakdown.physical_inventory || [], null, 2));
        setCommercialAssets(JSON.stringify(breakdown.commercial_assets || [], null, 2));
        setDocumentationEducational(JSON.stringify(breakdown.documentation_educational || [], null, 2));
        setOpensourceComponents(JSON.stringify(breakdown.opensource_components || [], null, 2));
        setIntellectualPropertyDetails(JSON.stringify(breakdown.intellectual_property || [], null, 2));
      }
      
      // If there's a patent file URL but no patent data, try to download and parse it
      if (data.patent_file_url && (!data.patents || data.patents.length === 0)) {
        downloadAndParsePatentFile(data.patent_file_url);
      }
    };

    fetchTenant();
    loadListing();
  }, [user, hasRole, navigate, editingId]);

  const downloadAndParsePatentFile = async (url: string) => {
    try {
      console.log('Downloading patent file from:', url);
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to download file');
      
      const blob = await response.blob();
      const file = new File([blob], 'patent_list.xlsx', { type: blob.type });
      
      await parsePatentFile(file);
    } catch (error) {
      console.error('Error downloading/parsing patent file:', error);
    }
  };

  const generateSlug = (text: string) => {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const generateShareToken = () => {
    return Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  };

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
        
        // If editing an existing listing, update it immediately with the parsed data
        if (editingId) {
          console.log('Updating listing with parsed patent data:', editingId);
          const { error: updateError } = await supabase
            .from('listings')
            .update({ 
              patent_count: patentList.length,
              patents: patentList
            })
            .eq('id', editingId);
            
          if (updateError) {
            console.error('Error updating listing with patent data:', updateError);
            toast.error("Failed to save patent data to listing");
          } else {
            console.log('Successfully updated listing with patent data');
            toast.success(`Extracted and saved ${patentList.length} patents to listing`);
          }
        } else {
          toast.success(`Extracted ${patentList.length} patents from file`);
        }
        
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
      const body: any = {};
      if (companyName.trim()) body.companyName = companyName.trim();
      if (trademarkSerialNumber.trim()) body.serialNumber = trademarkSerialNumber.trim();
      
      console.log('Searching USPTO trademarks with:', body);
      const { data, error } = await supabase.functions.invoke('search-trademarks', { body });

      if (error) {
        console.error('Trademark search error:', error);
        throw new Error('Failed to search trademarks');
      }

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      if (data?.success && data.trademarks) {
        const foundTrademarks = data.trademarks;
        console.log('Found trademarks:', foundTrademarks);
        
        if (foundTrademarks.length === 0) {
          if (data.note) {
            toast.info(data.note);
          } else {
            toast.info("No trademarks found");
          }
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
      } else if (data?.note) {
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
      
      // Upload file to storage if provided
      if (uploadedFile && !uploadedFileUrl) {
        const fileExt = uploadedFile.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${user?.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('pitch-decks')
          .upload(filePath, uploadedFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('pitch-decks')
          .getPublicUrl(filePath);

        pitchDeckUrl = publicUrl;
        setUploadedFileUrl(publicUrl);
      }

      const { data, error } = await supabase.functions.invoke('scrape-website', {
        body: { 
          url: companyWebsite || undefined,
          pitchDeckUrl: pitchDeckUrl || undefined,
          userId: user?.id
        }
      });

      if (error) {
        console.error('Edge function error:', error);
        throw new Error('Failed to process information. Please try again.');
      }

      if (data?.error) {
        toast.error(data.error);
        setScraping(false);
        return;
      }

      if (data?.success) {
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
        throw new Error(data?.error || 'Failed to process information');
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

      const slug = generateSlug(validationResult.data.title);
      const shareToken = validationResult.data.visibilityLevel === 'private' ? generateShareToken() : null;

      // Parse data breakdown if provided
      let parsedDataBreakdown = null;
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
      const dataBreakdownObj: any = { ...parsedDataBreakdown };
      
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
        tenant_id: tenantId,
        slug,
        title: validationResult.data.title,
        description: validationResult.data.description,
        industry: validationResult.data.industry,
        location: validationResult.data.location,
        company_name: validationResult.data.companyName,
        company_website: validationResult.data.companyWebsite || null,
        is_anonymized: isAnonymized,
        scraped_data: scrapedData || {},
        revenue: validationResult.data.revenue || null,
        ebitda: validationResult.data.ebitda || null,
        asking_price: validationResult.data.askingPrice || null,
        visibility_level: validationResult.data.visibilityLevel,
        share_token: shareToken,
        source_code_repository: sourceCodeRepository.trim() || null,
        patent_count: patentCount || null,
        patents: patents.length > 0 ? patents : null,
        trademarks: trademarks.length > 0 ? trademarks : null,
        copyrights: copyrights.length > 0 ? copyrights : null,
        data_breakdown: parsedDataBreakdown,
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

      let data;
      let error;

      if (editingId) {
        // Update existing listing
        const result = await supabase
          .from('listings')
          .update({
            ...listingData,
            status,
            published_at: status === 'active' ? (new Date().toISOString()) : null,
          })
          .eq('id', editingId)
          .select()
          .single();
        
        data = result.data;
        error = result.error;
        
        if (!error) {
          toast.success("Listing updated successfully!");
        }
      } else {
        // Create new listing
        const result = await supabase
          .from('listings')
          .insert({
            ...listingData,
            status,
            published_at: status === 'active' ? new Date().toISOString() : null,
          })
          .select()
          .single();
        
        data = result.data;
        error = result.error;
        
        if (!error) {
          toast.success("Listing created successfully!");
        }
      }

      if (error) throw error;

      // Upload patent file after listing is created/updated (now we have the listing ID)
      if (patentFile && data) {
        console.log('Starting patent file upload. Current patents in state:', patents);
        
        // Re-parse the file to ensure we have fresh data
        let extractedPatents: string[] = [];
        let extractedCount: number = 0;
        
        if (patentFile.name.endsWith('.xlsx') || patentFile.name.endsWith('.xls') || patentFile.name.endsWith('.csv')) {
          const result = await parsePatentFile(patentFile);
          extractedPatents = result.patents;
          extractedCount = result.count;
        }
        
        const fileExt = patentFile.name.split('.').pop();
        const sanitizedCompanyName = validationResult.data.companyName.replace(/[^a-zA-Z0-9]/g, '_');
        const fileName = `${sanitizedCompanyName}_patent_list.${fileExt}`;
        const filePath = `${data.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('patent-files')
          .upload(filePath, patentFile, { upsert: true });

        if (uploadError) {
          console.error('Patent file upload error:', uploadError);
          toast.error("Listing saved but patent file upload failed. Please check your permissions.");
        } else {
          // Update listing with patent file URL
          const { data: urlData } = supabase.storage
            .from('patent-files')
            .getPublicUrl(filePath);
          
          console.log('Updating listing with:', {
            patent_file_url: urlData.publicUrl,
            patent_count: extractedCount || patentCount || null,
            patents: extractedPatents.length > 0 ? extractedPatents : (patents.length > 0 ? patents : null)
          });
          
          const { error: updateError } = await supabase
            .from('listings')
            .update({ 
              patent_file_url: urlData.publicUrl,
              patent_count: extractedCount || patentCount || null,
              patents: extractedPatents.length > 0 ? extractedPatents : (patents.length > 0 ? patents : null)
            })
            .eq('id', data.id);
            
          if (updateError) {
            console.error('Error updating listing with patent data:', updateError);
            toast.error("Patent file uploaded but failed to save patent data");
          } else {
            console.log('Successfully updated listing with patent data');
            toast.success("Patent file uploaded and data extracted successfully!");
          }
        }
      } else if (patentFileUrl && (patents.length > 0 || patentCount > 0) && data) {
        // If editing and we have patent data but no new file, update the listing
        console.log('Updating existing listing with patent data from state');
        const { error: updateError } = await supabase
          .from('listings')
          .update({ 
            patent_count: patents.length > 0 ? patents.length : patentCount || null,
            patents: patents.length > 0 ? patents : null
          })
          .eq('id', data.id);
          
        if (updateError) {
          console.error('Error updating listing with patent data:', updateError);
        } else {
          console.log('Successfully updated listing with patent data from state');
        }
      }
      
      // Navigate to the listing detail page
      navigate(`/listing/${data.id}`);
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
              
              {(companyWebsite || uploadedFile) && (
                <p className="text-xs text-muted-foreground text-center">
                  {companyWebsite && uploadedFile 
                    ? "✓ Will analyze both website and pitch deck for comprehensive insights"
                    : companyWebsite 
                    ? "✓ Will analyze website - add pitch deck for more details"
                    : "✓ Will analyze pitch deck - add website URL for more context"}
                </p>
              )}
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
                {isAnonymized && (
                  <div className="mt-3 p-3 bg-muted/50 rounded-md">
                    <p className="text-xs text-muted-foreground">
                      <strong>Anonymized mode:</strong> Company name will be hidden from public view and share links. 
                      Only buyers who sign the NDA will see the company name.
                    </p>
                  </div>
                )}
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

          {/* Key Assets */}
          <Card>
            <CardHeader>
              <CardTitle>Key Assets</CardTitle>
              <CardDescription>Select which assets are included - additional fields will appear for each selection</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { id: 'ip', label: 'Intellectual Property' },
                  { id: 'brand', label: 'Brand' },
                  { id: 'domain', label: 'Domain' },
                  { id: 'codebase', label: 'Codebase' },
                  { id: 'technology', label: 'Technology / Software Platforms' },
                  { id: 'website', label: 'Website' },
                  { id: 'customerList', label: 'Customer List / User Base' },
                  { id: 'socialMedia', label: 'Social Media Accounts' },
                  { id: 'emailList', label: 'Email List / CRM' },
                  { id: 'revenueStreams', label: 'Revenue Streams / Contracts' },
                  { id: 'mobileApps', label: 'Mobile Apps' },
                  { id: 'inventory', label: 'Inventory / Hardware' },
                  { id: 'documentation', label: 'Documentation / SOPs' },
                  { id: 'commercialAssets', label: 'Commercial Assets' },
                ].map((asset) => (
                  <div key={asset.id} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={asset.id}
                      checked={selectedAssets.includes(asset.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedAssets([...selectedAssets, asset.id]);
                        } else {
                          setSelectedAssets(selectedAssets.filter(a => a !== asset.id));
                        }
                      }}
                      className="rounded border-border"
                    />
                    <Label htmlFor={asset.id} className="text-sm font-normal cursor-pointer">
                      {asset.label}
                    </Label>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Conditional Asset Details */}
          {selectedAssets.includes('brand') && (
            <Card>
              <CardHeader>
                <CardTitle>Brand Details</CardTitle>
                <CardDescription>Public identity, reputation, and emotional value customers associate with the business</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Brand name, logo, visual identity, design system, reputation, goodwill, market presence, brand guidelines, positioning, press coverage, awards, etc."
                  value={brandDetails}
                  onChange={(e) => setBrandDetails(e.target.value)}
                  rows={4}
                />
              </CardContent>
            </Card>
          )}

          {selectedAssets.includes('domain') && (
            <Card>
              <CardHeader>
                <CardTitle>Domain Details</CardTitle>
                <CardDescription>Digital address customers use to find your business online (carries SEO and branding value)</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Primary domain (e.g., company.com), related domains (redirects, country codes), domain ownership rights, transfer documentation, SEO value, traffic metrics, etc."
                  value={domainDetails}
                  onChange={(e) => setDomainDetails(e.target.value)}
                  rows={4}
                />
              </CardContent>
            </Card>
          )}

          {selectedAssets.includes('codebase') && (
            <Card>
              <CardHeader>
                <CardTitle>Codebase Details</CardTitle>
                <CardDescription>Software source code that powers the company's products, platforms, or systems</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Backend/frontend source code, GitHub/GitLab repositories, documentation, libraries, APIs, scripts, build/deployment instructions, tech stack, code quality, testing coverage, etc."
                  value={codebaseDetails}
                  onChange={(e) => setCodebaseDetails(e.target.value)}
                  rows={4}
                />
              </CardContent>
            </Card>
          )}

          {selectedAssets.includes('technology') && (
            <Card>
              <CardHeader>
                <CardTitle>Technology / Software Platforms Details</CardTitle>
                <CardDescription>Advanced technology platforms, software systems, and specialized architectures</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="technologyDetails">Technology Platform Overview</Label>
                  <Textarea
                    id="technologyDetails"
                    placeholder="Describe technology platforms, software systems, APIs, toolchains, frameworks, SDKs, etc."
                    value={technologyDetails}
                    onChange={(e) => setTechnologyDetails(e.target.value)}
                    rows={4}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="softwarePlatforms">Software Platforms & Code (JSON Array)</Label>
                  <Textarea
                    id="softwarePlatforms"
                    placeholder='["EF Platform (design-to-silicon)", "Private code repositories", "Automated toolchain"]'
                    value={softwarePlatforms}
                    onChange={(e) => setSoftwarePlatforms(e.target.value)}
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground">Detailed platform breakdown for offering memorandum</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="advancedChipArchitectures">Advanced Chip Architectures (JSON Array)</Label>
                  <Textarea
                    id="advancedChipArchitectures"
                    placeholder='["Frigate & Cheetah RISC-V processors", "ML Accelerator designs"]'
                    value={advancedChipArchitectures}
                    onChange={(e) => setAdvancedChipArchitectures(e.target.value)}
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground">For semiconductor companies: describe custom chip designs and architectures</p>
                </div>
              </CardContent>
            </Card>
          )}

          {selectedAssets.includes('website') && (
            <Card>
              <CardHeader>
                <CardTitle>Website Details</CardTitle>
                <CardDescription>Public-facing interface and content users interact with (the vessel, while codebase is the engine)</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Live website(s), CMS (WordPress, Webflow, etc.), UI/UX design, templates, website analytics, SEO data, content assets, hosting/deployment configuration, traffic metrics, etc."
                  value={websiteDetails}
                  onChange={(e) => setWebsiteDetails(e.target.value)}
                  rows={4}
                />
              </CardContent>
            </Card>
          )}

          {selectedAssets.includes('customerList') && (
            <Card>
              <CardHeader>
                <CardTitle>Customer List / User Base Details</CardTitle>
                <CardDescription>Detailed record of past and current customers - a key indicator of market traction and monetization potential</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="CRM exports, user segments, churn data, purchase history, LTV (lifetime value), engagement metrics, customer contracts/agreements, retention rates, user demographics, etc."
                  value={customerListDetails}
                  onChange={(e) => setCustomerListDetails(e.target.value)}
                  rows={4}
                />
              </CardContent>
            </Card>
          )}

          {selectedAssets.includes('socialMedia') && (
            <Card>
              <CardHeader>
                <CardTitle>Social Media Details</CardTitle>
                <CardDescription>Official handles, follower base, and audience access across major platforms</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="LinkedIn, Twitter/X, Instagram, YouTube, TikTok, Facebook - handle ownership, admin rights, follower counts, engagement analytics, ad accounts, audience demographics, etc."
                  value={socialMediaDetails}
                  onChange={(e) => setSocialMediaDetails(e.target.value)}
                  rows={4}
                />
              </CardContent>
            </Card>
          )}

          {selectedAssets.includes('emailList') && (
            <Card>
              <CardHeader>
                <CardTitle>Email List / CRM Details</CardTitle>
                <CardDescription>Direct marketing channels and structured contact data (must comply with GDPR, CCPA)</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Newsletter subscribers, leads, customer records (HubSpot, Salesforce, etc.), email sequences, templates, automation workflows, list size, engagement rates, open/click rates, segmentation, etc."
                  value={emailListDetails}
                  onChange={(e) => setEmailListDetails(e.target.value)}
                  rows={4}
                />
              </CardContent>
            </Card>
          )}

          {selectedAssets.includes('revenueStreams') && (
            <Card>
              <CardHeader>
                <CardTitle>Revenue Streams / Contracts Details</CardTitle>
                <CardDescription>All income-generating arrangements - shows verifiable monetization and financial stability</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Subscription revenue, licensing deals, recurring billing, customer/vendor contracts, affiliate revenue, ad revenue agreements, partnership terms, payment processing setup, MRR/ARR breakdown, etc."
                  value={revenueStreamsDetails}
                  onChange={(e) => setRevenueStreamsDetails(e.target.value)}
                  rows={4}
                />
              </CardContent>
            </Card>
          )}

          {selectedAssets.includes('mobileApps') && (
            <Card>
              <CardHeader>
                <CardTitle>Mobile Apps Details</CardTitle>
                <CardDescription>Standalone or complementary mobile applications (distinct asset if app-based engagement drives value)</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="iOS and Android apps, source code, deployment keys, app store listings (Apple App Store, Google Play), analytics, user data, downloads, ratings, reviews, in-app purchases, update history, etc."
                  value={mobileAppsDetails}
                  onChange={(e) => setMobileAppsDetails(e.target.value)}
                  rows={4}
                />
              </CardContent>
            </Card>
          )}

          {selectedAssets.includes('inventory') && (
            <Card>
              <CardHeader>
                <CardTitle>Inventory / Hardware Details</CardTitle>
                <CardDescription>Physical goods or equipment owned by the business (typically relevant for eCommerce or hardware startups)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="inventoryDetails">Inventory Overview</Label>
                  <Textarea
                    id="inventoryDetails"
                    placeholder="Product inventory, prototypes, servers, devices, proprietary hardware, manufacturing equipment, warehouse/storage details, inventory management systems, SKU counts, valuation, condition, etc."
                    value={inventoryDetails}
                    onChange={(e) => setInventoryDetails(e.target.value)}
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="physicalInventory">Physical Inventory (JSON Array)</Label>
                  <Textarea
                    id="physicalInventory"
                    placeholder='["Silicon lots CI-2409 & CI-2411", "Caravel development boards", "Test equipment"]'
                    value={physicalInventory}
                    onChange={(e) => setPhysicalInventory(e.target.value)}
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground">Detailed inventory breakdown for offering memorandum</p>
                </div>
              </CardContent>
            </Card>
          )}

          {selectedAssets.includes('documentation') && (
            <Card>
              <CardHeader>
                <CardTitle>Documentation / Processes Details</CardTitle>
                <CardDescription>Institutional knowledge of how the business operates (critical for post-acquisition continuity)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="documentationDetails">Documentation Overview</Label>
                  <Textarea
                    id="documentationDetails"
                    placeholder="Standard Operating Procedures (SOPs), training manuals, onboarding guides, playbooks for marketing/sales/operations, process documentation, internal wikis, knowledge bases, video tutorials, etc."
                    value={documentationDetails}
                    onChange={(e) => setDocumentationDetails(e.target.value)}
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="documentationEducational">Documentation & Educational Content (JSON Array)</Label>
                  <Textarea
                    id="documentationEducational"
                    placeholder='["Complete technical documentation", "Training videos and webinars", "Design examples"]'
                    value={documentationEducational}
                    onChange={(e) => setDocumentationEducational(e.target.value)}
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground">Detailed documentation breakdown for offering memorandum</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="opensourceComponents">Open-Source Components (JSON Array)</Label>
                  <Textarea
                    id="opensourceComponents"
                    placeholder='["Caravel Framework", "OpenLane toolchain", "PDK files"]'
                    value={opensourceComponents}
                    onChange={(e) => setOpensourceComponents(e.target.value)}
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground">For businesses built on open-source: list key components and frameworks</p>
                </div>
              </CardContent>
            </Card>
          )}

          {selectedAssets.includes('commercialAssets') && (
            <Card>
              <CardHeader>
                <CardTitle>Commercial Assets Details</CardTitle>
                <CardDescription>Customer relationships, partnerships, databases, and market presence</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="commercialAssetsDetails">Commercial Assets Overview</Label>
                  <Textarea
                    id="commercialAssetsDetails"
                    placeholder="Customer databases, strategic partnerships, distributor relationships, community ecosystems, market presence, brand collaborations, etc."
                    value={commercialAssetsDetails}
                    onChange={(e) => setCommercialAssetsDetails(e.target.value)}
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="commercialAssets">Commercial Assets (JSON Array)</Label>
                  <Textarea
                    id="commercialAssets"
                    placeholder='["Customer database (13,000+ users)", "Academic partnerships", "Community ecosystem"]'
                    value={commercialAssets}
                    onChange={(e) => setCommercialAssets(e.target.value)}
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground">Detailed commercial assets breakdown for offering memorandum</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Intellectual Property (IP) */}
          {selectedAssets.includes('ip') && (
            <Card>
              <CardHeader>
                <CardTitle>Intellectual Property</CardTitle>
                <CardDescription>Legally protectable intangible assets (patents, trademarks, copyrights, trade secrets) that give the business its unique advantage</CardDescription>
              </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="patentFile">Patent List File</Label>
                {patentFileUrl && (
                  <div className="flex items-center gap-2 p-2 bg-secondary rounded text-sm">
                    <span className="text-green-600">✓</span>
                    <span className="flex-1">{patentFileUrl.split('/').pop()}</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => downloadAndParsePatentFile(patentFileUrl)}
                    >
                      Re-parse
                    </Button>
                  </div>
                )}
                <Input
                  id="patentFile"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setPatentFile(file);
                      setPatentFileUrl("");
                      // Auto-parse Excel/CSV files
                      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv')) {
                        await parsePatentFile(file);
                      }
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Upload Excel or CSV file with patent list - data will be extracted automatically
                </p>
                {patentFile && (
                  <p className="text-xs text-green-600">
                    ✓ {patentFile.name}
                    {patents.length > 0 && ` - ${patents.length} patents extracted`}
                  </p>
                )}
                
                {/* Display extracted patent data */}
                {(patents.length > 0 || patentCount > 0) && (
                  <div className="mt-4 p-4 bg-secondary rounded-lg space-y-2">
                    <h4 className="font-semibold text-sm">Extracted Patent Data</h4>
                    <p className="text-sm">
                      <strong>Total Patents:</strong> {patents.length || patentCount}
                    </p>
                    {patents.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Patent List Preview (first 5):</p>
                        <ul className="text-xs space-y-1 max-h-32 overflow-y-auto">
                          {patents.slice(0, 5).map((patent, idx) => (
                            <li key={idx} className="text-muted-foreground">• {patent}</li>
                          ))}
                        </ul>
                        {patents.length > 5 && (
                          <p className="text-xs text-muted-foreground italic">
                            ...and {patents.length - 5} more
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

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
                <p className="text-xs text-muted-foreground">
                  Enter the total count - will be shown even for anonymized listings
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="patents">Individual Patents (Optional)</Label>
                <div className="flex gap-2">
                  <Input
                    id="patents"
                    placeholder="Add patent name or number"
                    value={patentInput}
                    onChange={(e) => setPatentInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (patentInput.trim()) {
                          setPatents([...patents, patentInput.trim()]);
                          setPatentInput("");
                        }
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (patentInput.trim()) {
                        setPatents([...patents, patentInput.trim()]);
                        setPatentInput("");
                      }
                    }}
                  >
                    Add
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Add individual patents for display (optional - can rely on file upload only)
                </p>
                {patents.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {patents.map((patent, idx) => (
                      <Badge key={idx} variant="secondary">
                        {patent}
                        <button
                          type="button"
                          onClick={() => setPatents(patents.filter((_, i) => i !== idx))}
                          className="ml-2 hover:text-destructive"
                        >
                          ×
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="trademarks">Trademarks</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={(!companyName.trim() && !trademarkSerialNumber.trim()) || searchingTrademarks}
                    onClick={handleSearchTrademarks}
                  >
                    {searchingTrademarks ? "Searching USPTO..." : "Lookup from USPTO"}
                  </Button>
                </div>
                <div className="space-y-2">
                  <Input
                    placeholder="Enter serial number (e.g., 88817224)"
                    value={trademarkSerialNumber}
                    onChange={(e) => setTrademarkSerialNumber(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSearchTrademarks();
                      }
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter a USPTO serial number to lookup trademark details, or use company name above
                  </p>
                </div>
                <div className="flex gap-2">
                  <Input
                    id="trademarks"
                    placeholder="Add trademark name manually"
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

              <div className="space-y-2">
                <Label htmlFor="copyrights">Copyrights</Label>
                <div className="flex gap-2">
                  <Input
                    id="copyrights"
                    placeholder="Add copyright description"
                    value={copyrightInput}
                    onChange={(e) => setCopyrightInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (copyrightInput.trim()) {
                          setCopyrights([...copyrights, copyrightInput.trim()]);
                          setCopyrightInput("");
                        }
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (copyrightInput.trim()) {
                        setCopyrights([...copyrights, copyrightInput.trim()]);
                        setCopyrightInput("");
                      }
                    }}
                  >
                    Add
                  </Button>
                </div>
                {copyrights.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {copyrights.map((copyright, idx) => (
                      <Badge key={idx} variant="secondary">
                        {copyright}
                        <button
                          type="button"
                          onClick={() => setCopyrights(copyrights.filter((_, i) => i !== idx))}
                          className="ml-2 hover:text-destructive"
                        >
                          ×
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="intellectualPropertyDetails">Intellectual Property Assets (JSON Array)</Label>
                <Textarea
                  id="intellectualPropertyDetails"
                  placeholder='["15 granted patents", "3 trademarks registered", "Brand identity and goodwill"]'
                  value={intellectualPropertyDetails}
                  onChange={(e) => setIntellectualPropertyDetails(e.target.value)}
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">Detailed IP breakdown for offering memorandum</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dataBreakdown">Data Available for Sale</Label>
                <Textarea
                  id="dataBreakdown"
                  placeholder='Enter JSON format, e.g., {"customer_records": 50000, "transactions": 1000000}'
                  rows={4}
                  value={dataBreakdown}
                  onChange={(e) => setDataBreakdown(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Enter data breakdown in JSON format
                </p>
              </div>
            </CardContent>
          </Card>
          )}

          {/* Offering Memorandum Details */}
          <Card>
            <CardHeader>
              <CardTitle>Offering Memorandum Details</CardTitle>
              <CardDescription>Additional structured data for offering memorandum presentation (optional)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div className="space-y-0.5">
                  <Label>Is this an ABC (Assignment for Benefit of Creditors)?</Label>
                  <p className="text-sm text-muted-foreground">Enable if this is an ABC transaction</p>
                </div>
                <Switch checked={isABC} onCheckedChange={setIsABC} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="offerDeadline">Offer Deadline</Label>
                <Input
                  id="offerDeadline"
                  placeholder="e.g., Friday, August 15, 2025"
                  value={offerDeadline}
                  onChange={(e) => setOfferDeadline(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Letter of Intent deadline for buyers
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="marketData">Market Data (JSON)</Label>
                <Textarea
                  id="marketData"
                  placeholder='e.g., {"global_market": "$20B+", "cagr": "33.9%", "registered_users": "13,000+"}'
                  value={marketData}
                  onChange={(e) => setMarketData(e.target.value)}
                  rows={5}
                />
                <p className="text-xs text-muted-foreground">
                  Market opportunity stats in JSON format for stat tiles
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="targetMarkets">Target Markets (JSON Array)</Label>
                <Textarea
                  id="targetMarkets"
                  placeholder='["AI/ML Hardware Acceleration", "Edge Computing", "IoT Devices"]'
                  value={targetMarkets}
                  onChange={(e) => setTargetMarkets(e.target.value)}
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="competitiveAdvantages">Competitive Advantages (JSON Array)</Label>
                <Textarea
                  id="competitiveAdvantages"
                  placeholder='["100x cost reduction", "Open-source ecosystem", "Proven track record"]'
                  value={competitiveAdvantages}
                  onChange={(e) => setCompetitiveAdvantages(e.target.value)}
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="termsConditions">Terms & Conditions Summary</Label>
                <Textarea
                  id="termsConditions"
                  placeholder="Brief summary of key terms and conditions..."
                  value={termsConditions}
                  onChange={(e) => setTermsConditions(e.target.value)}
                  rows={4}
                />
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
                <p className="text-xs text-muted-foreground">
                  {visibilityLevel === 'public' && 'Listing will appear in the marketplace and search results'}
                  {visibilityLevel === 'private' && 'Only accessible via direct link (share token will be generated)'}
                </p>
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
                <p className="text-xs text-muted-foreground">
                  {status === 'draft' && 'Draft listings are hidden and not accessible to buyers'}
                  {status === 'active' && 'Active listings are visible based on visibility level'}
                </p>
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
