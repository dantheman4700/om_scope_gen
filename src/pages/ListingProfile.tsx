import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/Header";
import { listings as listingsApi, Listing } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DocumentGenerator } from "@/components/DocumentGenerator";
import {
  ArrowLeft,
  Copy,
  Edit,
  ExternalLink,
  Eye,
  Users,
  Settings,
  Archive,
  ArchiveRestore,
  FileText,
  Shield,
  TrendingUp,
  Sparkles,
  LayoutDashboard,
} from "lucide-react";

const ListingProfile = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, hasRole, loading } = useAuth();
  const { toast } = useToast();

  const [listing, setListing] = useState<Listing | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [analytics, setAnalytics] = useState({
    total_views: 0,
    unique_visitors: 0,
    access_requests: 0,
    nda_signed: 0,
    conversion_rate: 0,
  });

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
      return;
    }
    if (!loading && user && !hasRole("admin") && !hasRole("editor")) {
      navigate("/");
      return;
    }
  }, [user, loading, hasRole, navigate]);

  useEffect(() => {
    if (user && (hasRole("admin") || hasRole("editor")) && id) {
      fetchListingData();
    }
  }, [user, hasRole, id]);

  const fetchListingData = async () => {
    if (!id) return;
    
    setLoadingData(true);

    try {
      const { listing: data } = await listingsApi.get(id);
      setListing(data);

      // Mock analytics for now (would need separate API endpoints)
    setAnalytics({
        total_views: 0,
        unique_visitors: 0,
        access_requests: 0,
        nda_signed: 0,
        conversion_rate: 0,
      });
    } catch (error: any) {
      console.error("Error fetching listing:", error);
      toast({
        title: "Error",
        description: "Failed to load listing data",
        variant: "destructive",
    });
    } finally {
    setLoadingData(false);
    }
  };

  const copyShareLink = () => {
    if (!listing) return;
    const url = `${window.location.origin}/listing/${listing.id}`;
    navigator.clipboard.writeText(url);
    toast({
      title: "Link copied",
      description: "Share link copied to clipboard",
    });
  };

  const toggleListingStatus = async () => {
    if (!listing) return;
    
    try {
      const newStatus = listing.status === "active" ? "archived" : "active";
      await listingsApi.update(listing.id, { status: newStatus });
      sonnerToast.success(`Listing ${newStatus === "active" ? "activated" : "archived"}`);
      fetchListingData();
    } catch (error: any) {
      sonnerToast.error("Failed to update listing status");
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      active: "default",
      draft: "secondary",
      archived: "outline",
      approved: "default",
      pending: "secondary",
      rejected: "destructive",
    };
    return <Badge variant={variants[status] || "secondary"}>{status}</Badge>;
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <p>Loading...</p>
        </main>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <p>Listing not found</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <Button variant="ghost" onClick={() => navigate("/dashboard")} className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>

        <div className="mb-6 flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold mb-2">{listing.title}</h1>
            <div className="flex gap-2 items-center">
              {getStatusBadge(listing.status)}
              <Badge variant={listing.visibility_level === "public" ? "default" : "secondary"}>
                {listing.visibility_level}
              </Badge>
              {listing.is_anonymized && <Badge>Anonymized</Badge>}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate(`/dashboard/listing/${listing.id}/prospects`)}>
              <Users className="h-4 w-4 mr-2" />
              Prospects
            </Button>
            <Button variant="outline" onClick={() => navigate(`/admin/create?id=${listing.id}`)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
            <Button variant="outline" onClick={() => navigate(`/listing/${listing.id}`)}>
              <ExternalLink className="h-4 w-4 mr-2" />
              View
            </Button>
            <Button variant="outline" onClick={copyShareLink}>
              <Copy className="h-4 w-4 mr-2" />
              Copy Link
            </Button>
            <Button variant="outline" onClick={() => navigate(`/dashboard/listing/${listing.id}/settings`)}>
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
            <Button variant="outline" onClick={toggleListingStatus}>
              {listing.status === "active" ? (
                <>
                  <Archive className="h-4 w-4 mr-2" />
                  Archive
                </>
              ) : (
                <>
                  <ArchiveRestore className="h-4 w-4 mr-2" />
                  Activate
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="grid gap-6 mb-6 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Views</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.total_views}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unique Visitors</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.unique_visitors}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Access Requests</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.access_requests}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">NDA Signed</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.nda_signed}</div>
              <p className="text-xs text-muted-foreground">{analytics.conversion_rate}% conversion</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <LayoutDashboard className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="documents" className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Documents
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Listing Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Company</p>
                    <p>{listing.company_name || "Not specified"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Industry</p>
                    <p>{listing.industry || "Not specified"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Location</p>
                    <p>{listing.location || "Not specified"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Revenue</p>
                    <p>{listing.revenue ? `$${(listing.revenue / 1000000).toFixed(1)}M` : "Not specified"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">EBITDA</p>
                    <p>{listing.ebitda ? `$${(listing.ebitda / 1000000).toFixed(1)}M` : "Not specified"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Asking Price</p>
                    <p>{listing.asking_price ? `$${(listing.asking_price / 1000000).toFixed(1)}M` : "Not specified"}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Intellectual Property</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Patents</p>
                    <p>{listing.patent_count || 0} patents</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Trademarks</p>
                    <p>{listing.trademarks?.length || 0} trademarks</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Copyrights</p>
                    <p>{listing.copyrights?.length || 0} copyrights</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="documents">
            <DocumentGenerator listingId={listing.id} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default ListingProfile;
