import { useParams, Link, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Building2, 
  MapPin, 
  DollarSign, 
  TrendingUp, 
  Users, 
  Calendar,
  FileText,
  Lock,
  Shield,
  ArrowLeft,
  Download,
  Globe,
  EyeOff,
  Share2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Edit,
  Sparkles,
  Target,
  BarChart3,
  Package
} from "lucide-react";
import { listings as listingsApi, Listing } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { PatentDisplay } from "@/components/PatentDisplay";
import { updateChipFoundryListing } from "@/utils/updateChipFoundryListing";
import { ProcessTimeline } from "@/components/ProcessTimeline";

const ListingDetail = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { user, hasRole } = useAuth();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasNdaAccess, setHasNdaAccess] = useState(false);
  const [ndaSigned, setNdaSigned] = useState(false);
  const [disclaimerExpanded, setDisclaimerExpanded] = useState(true);

  useEffect(() => {
    if (id) {
      fetchListing();
    }
  }, [id, user]);

  // Auto-update ChipFoundry listing if update param is present
  useEffect(() => {
    const shouldUpdate = searchParams.get('update') === 'chipfoundry';
    if (shouldUpdate && id === '57cd2671-3ec9-4e81-b5a6-2b97b373041a' && (hasRole('admin') || hasRole('editor'))) {
      updateChipFoundryListing().then(({ error }) => {
        if (error) {
          console.error('Update error:', error);
          toast.error('Failed to update listing');
        } else {
          toast.success('ChipFoundry listing updated successfully!');
          fetchListing();
          // Remove the update param
          window.history.replaceState({}, '', `/listing/${id}`);
        }
      });
    }
  }, [searchParams, id, hasRole]);

  const fetchListing = async () => {
    try {
      const { listing: data } = await listingsApi.get(id!);
      setListing(data);
    } catch (error: any) {
      console.error('Error fetching listing:', error);
      toast.error("Listing not available");
    } finally {
      setLoading(false);
    }
  };

  const getDisplayTitle = () => {
    if (!listing) return "";
    
    // If anonymized and no NDA access, show generic title
    if (listing.is_anonymized && !hasNdaAccess) {
      return listing.title; // Keep the listing title generic
    }
    
    // If has NDA access or not anonymized, can show company name in title
    if (listing.company_name) {
      return `${listing.company_name} - ${listing.title}`;
    }
    
    return listing.title;
  };

  const shouldShowCompanyInfo = () => {
    if (!listing) return false;
    return !listing.is_anonymized || hasNdaAccess;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Listing not found</h2>
          <Link to="/listings">
            <Button>Back to Listings</Button>
          </Link>
        </div>
      </div>
    );
  }

  const publicDocuments = [
    { name: "Offering Memorandum", size: "3.2 MB", type: "PDF" },
    { name: "Non-Disclosure Agreement", size: "450 KB", type: "PDF" }
  ];

  const confidentialDocuments = [
    { name: "Financial Statements (3 Years)", size: "5.2 MB", type: "PDF" },
    { name: "Customer List & Contracts", size: "8.1 MB", type: "PDF" },
    { name: "Technical Architecture", size: "3.5 MB", type: "PDF" },
    { name: "Cap Table & Equity Structure", size: "1.2 MB", type: "PDF" },
    { name: "Product Roadmap", size: "2.8 MB", type: "PDF" }
  ];

  const meta = listing.meta as Record<string, any> | null;
  const dataBreakdown = listing.data_breakdown as Record<string, any> | null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {user && (
                <>
                  <Link to="/listings">
                    <Button variant="ghost" size="sm">
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back to Listings
                    </Button>
                  </Link>
                  <div className="border-l border-border h-6" />
                </>
              )}
              {(hasRole('admin') || hasRole('editor')) && (
                <>
                  <Link to={`/admin/create?id=${id}`}>
                    <Button variant="outline" size="sm">
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Listing
                    </Button>
                  </Link>
                  <div className="border-l border-border h-6" />
                </>
              )}
              <span className="text-2xl font-bold text-primary">M&A Platform</span>
            </div>
            <Button 
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                toast.success("Link copied to clipboard");
              }}
            >
              <Share2 className="h-4 w-4 mr-2" />
              Share / Copy Link
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-r from-primary to-primary-hover text-primary-foreground py-16 relative">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-lg bg-primary-foreground/10">
                {listing.is_anonymized && !hasNdaAccess ? (
                  <EyeOff className="h-8 w-8" />
                ) : (
                  <Building2 className="h-8 w-8" />
                )}
              </div>
              <div className="flex-1">
                <h1 className="text-3xl md:text-5xl font-bold mb-2">
                  {getDisplayTitle()}
                </h1>
                <p className="text-xl text-primary-foreground/90 mb-4">
                  Acquire a proven semiconductor design platform with 13,000+ users, 15 patents, and complete IP assets
                </p>
                <div className="flex items-center gap-3 flex-wrap">
                  <Badge variant="success" className="bg-success/20 text-primary-foreground border-primary-foreground/20">
                    {listing.status === 'active' ? 'Active Listing' : listing.status}
                  </Badge>
                  {listing.is_anonymized && !hasNdaAccess && (
                    <Badge variant="outline" className="bg-primary-foreground/10 border-primary-foreground/20">
                      <EyeOff className="h-3 w-3 mr-1" />
                      Anonymized
                    </Badge>
                  )}
                  <span className="text-sm text-primary-foreground/80">{listing.industry}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Disclaimer - Collapsible */}
            <Card className="border-2 border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20">
              <CardHeader className="cursor-pointer" onClick={() => setDisclaimerExpanded(!disclaimerExpanded)}>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-amber-900 dark:text-amber-100">
                    <AlertTriangle className="h-5 w-5" />
                    Important Disclosure
                  </CardTitle>
                  <Button variant="ghost" size="sm">
                    {disclaimerExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </div>
              </CardHeader>
              {disclaimerExpanded && (
                <CardContent>
                  <p className="text-sm text-amber-900/90 dark:text-amber-100/90 leading-relaxed">
                    This offering memorandum contains information regarding certain operations and the business of the Company. The information contained herein has been prepared for the purpose of providing interested parties with general information to assist them in their evaluation of certain assets of the Company. Nothing contained in this offering memorandum is, or shall be relied upon as, a promise or representation as to the past or future performance of the Company or its products. In furnishing this offering memorandum, neither the Company nor the Trustee undertakes any obligation to provide the recipient with access to any additional information.
                  </p>
                </CardContent>
              )}
            </Card>

            {/* Company Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  Company Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground leading-relaxed">
                  {listing.description?.split('\n\n')[0] || listing.description}
                </p>
              </CardContent>
            </Card>

            {/* Market Opportunity */}
            {meta?.offering_memorandum_summary?.market_data && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-primary" />
                    Market Opportunity
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                      <CardContent className="p-4 text-center">
                        <p className="text-3xl font-bold text-primary mb-1">$20B+</p>
                        <p className="text-xs text-muted-foreground">Global Custom Silicon Market</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-accent/5 to-accent/10 border-accent/20">
                      <CardContent className="p-4 text-center">
                        <p className="text-3xl font-bold text-accent-foreground mb-1">$16B</p>
                        <p className="text-xs text-muted-foreground">Edge AI Market (2023)</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-success/5 to-success/10 border-success/20">
                      <CardContent className="p-4 text-center">
                        <p className="text-3xl font-bold text-success mb-1">33.9%</p>
                        <p className="text-xs text-muted-foreground">CAGR Through 2030</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                      <CardContent className="p-4 text-center">
                        <p className="text-3xl font-bold text-primary mb-1">$200B+</p>
                        <p className="text-xs text-muted-foreground">Addressable Opportunity</p>
                      </CardContent>
                    </Card>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Public Documents */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Public Documents
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {publicDocuments.map((doc, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded bg-primary/10">
                          <FileText className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-sm text-foreground">{doc.name}</p>
                          <p className="text-xs text-muted-foreground">{doc.type} • {doc.size}</p>
                        </div>
                      </div>
                      <Button size="sm" variant="ghost">
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* NDA Section */}
            <Card className="border-2 border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  Non-Disclosure Agreement
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!ndaSigned ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      To access the full data room including financial statements, customer lists, and proprietary information, 
                      you must first review and sign the Non-Disclosure Agreement.
                    </p>
                    <Button variant="default" className="w-full" onClick={() => setNdaSigned(true)}>
                      Review & Sign NDA
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-success/10 border border-success/20">
                      <Shield className="h-5 w-5 text-success" />
                      <p className="text-sm font-medium text-success-foreground">NDA Signed - Data Room Access Granted</p>
                    </div>
                    <div className="space-y-3">
                      <h4 className="font-semibold text-sm text-foreground">Confidential Documents</h4>
                      {confidentialDocuments.map((doc, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded bg-success/10">
                              <Lock className="h-4 w-4 text-success" />
                            </div>
                            <div>
                              <p className="font-medium text-sm text-foreground">{doc.name}</p>
                              <p className="text-xs text-muted-foreground">{doc.type} • {doc.size}</p>
                            </div>
                          </div>
                          <Button size="sm" variant="ghost">
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Facts */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Facts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {shouldShowCompanyInfo() && listing.company_name && (
                  <div className="flex items-center gap-3 pb-3 border-b border-border">
                    <Building2 className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-xs text-muted-foreground">Company</p>
                      <p className="font-medium text-foreground">{listing.company_name}</p>
                    </div>
                  </div>
                )}
                {shouldShowCompanyInfo() && listing.company_website && (
                  <div className="flex items-center gap-3 pb-3 border-b border-border">
                    <Globe className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Website</p>
                      <a 
                        href={listing.company_website.startsWith('http') ? listing.company_website : `https://${listing.company_website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-primary hover:underline"
                      >
                        {listing.company_website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                      </a>
                    </div>
                  </div>
                )}
                {listing.revenue && (
                  <div className="flex items-center gap-3">
                    <DollarSign className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Revenue</p>
                      <p className="font-medium text-foreground">
                        ${(listing.revenue / 1000000).toFixed(1)}M
                      </p>
                    </div>
                  </div>
                )}
                {listing.ebitda && (
                  <div className="flex items-center gap-3">
                    <TrendingUp className="h-5 w-5 text-success" />
                    <div>
                      <p className="text-xs text-muted-foreground">EBITDA</p>
                      <p className="font-medium text-foreground">
                        ${(listing.ebitda / 1000000).toFixed(1)}M
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Contact Card */}
            <Card className="border-2 border-primary/20">
              <CardHeader>
                <CardTitle>Interested in this opportunity?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Contact us to schedule a confidential discussion or request additional information.
                </p>
                <Button className="w-full" variant="default">
                  Request Information
                </Button>
                <Button className="w-full" variant="outline">
                  Schedule Call
                </Button>
              </CardContent>
            </Card>

            {/* Process & Key Dates */}
            <Card className="border-2 border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Process & Key Dates
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ProcessTimeline />
                <div className="mt-4 p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">
                    Contact us for detailed process documentation and to schedule a confidential discussion.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ListingDetail;
