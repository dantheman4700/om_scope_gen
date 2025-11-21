import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Edit, ExternalLink, Copy, Archive, ArchiveRestore, Eye, Users, TrendingUp, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import { EmailAutomationSummary } from "@/components/EmailAutomationSummary";

interface Listing {
  id: string;
  title: string;
  slug: string;
  status: string;
  visibility_level: string;
  is_anonymized: boolean;
  created_at: string;
  description: string;
  company_name: string;
  asking_price: number;
  revenue: number;
  ebitda: number;
  email_automation_enabled?: boolean;
  email_domain_preference?: string;
  meta?: any;
}

interface AccessRequest {
  id: string;
  email: string;
  full_name: string;
  company: string | null;
  status: string;
  nda_signed_at: string | null;
  created_at: string;
}

interface ListingAnalytics {
  total_views: number;
  unique_visitors: number;
  access_requests: number;
  nda_signed: number;
  conversion_rate: number;
}

const ListingProfile = () => {
  const { id } = useParams<{ id: string }>();
  const { user, hasRole, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [listing, setListing] = useState<Listing | null>(null);
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [analytics, setAnalytics] = useState<ListingAnalytics>({
    total_views: 0,
    unique_visitors: 0,
    access_requests: 0,
    nda_signed: 0,
    conversion_rate: 0,
  });
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && (!user || (!hasRole('admin') && !hasRole('editor')))) {
      navigate('/auth');
    }
  }, [user, loading, hasRole, navigate]);

  useEffect(() => {
    if (user && (hasRole('admin') || hasRole('editor')) && id) {
      fetchListingData();
    }
  }, [user, hasRole, id]);

  const fetchListingData = async () => {
    if (!id) return;
    
    setLoadingData(true);

    // Fetch all data in parallel for optimization
    const [listingResult, requestsResult, analyticsResult, uniqueVisitorsResult] = await Promise.all([
      supabase.from('listings').select('*').eq('id', id).single(),
      supabase.from('access_requests').select('*').eq('listing_id', id).order('created_at', { ascending: false }),
      supabase.from('audit_events').select('id').eq('listing_id', id).eq('event_type', 'listing_view'),
      supabase.from('audit_events').select('ip_address').eq('listing_id', id).eq('event_type', 'listing_view'),
    ]);

    if (listingResult.data) setListing(listingResult.data);
    if (requestsResult.data) setAccessRequests(requestsResult.data);

    // Calculate analytics
    const totalViews = analyticsResult.data?.length || 0;
    const uniqueIps = new Set(uniqueVisitorsResult.data?.map(e => e.ip_address).filter(Boolean));
    const uniqueVisitors = uniqueIps.size;
    const accessRequestsCount = requestsResult.data?.length || 0;
    const ndaSigned = requestsResult.data?.filter(r => r.nda_signed_at).length || 0;
    const conversionRate = accessRequestsCount > 0 ? (ndaSigned / accessRequestsCount) * 100 : 0;

    setAnalytics({
      total_views: totalViews,
      unique_visitors: uniqueVisitors,
      access_requests: accessRequestsCount,
      nda_signed: ndaSigned,
      conversion_rate: Math.round(conversionRate),
    });

    setLoadingData(false);
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
    
    const newStatus = listing.status === 'active' ? 'archived' : 'active';
    const updateData: any = { status: newStatus };
    
    if (newStatus === 'active') {
      updateData.published_at = new Date().toISOString();
    }
    
    const { error } = await supabase
      .from('listings')
      .update(updateData)
      .eq('id', listing.id);

    if (error) {
      sonnerToast.error("Failed to update listing status");
      return;
    }

    sonnerToast.success(`Listing ${newStatus === 'active' ? 'activated' : 'archived'}`);
    fetchListingData();
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
        <Button
          variant="ghost"
          onClick={() => navigate('/dashboard')}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>

        <div className="mb-6 flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold mb-2">{listing.title}</h1>
            <div className="flex gap-2 items-center">
              {getStatusBadge(listing.status)}
              <Badge variant={listing.visibility_level === 'public' ? 'default' : 'secondary'}>
                {listing.visibility_level}
              </Badge>
              {listing.is_anonymized && <Badge>Anonymized</Badge>}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => navigate(`/dashboard/listing/${listing.id}/prospects`)}
            >
              <Users className="h-4 w-4 mr-2" />
              Prospects
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate(`/admin/create?id=${listing.id}`)}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate(`/listing/${listing.id}`)}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              View
            </Button>
            <Button
              variant="outline"
              onClick={copyShareLink}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy Link
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate(`/dashboard/listing/${listing.id}/settings`)}
            >
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
            <Button
              variant="outline"
              onClick={toggleListingStatus}
            >
              {listing.status === 'active' ? (
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
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.access_requests}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.conversion_rate}%</div>
              <p className="text-xs text-muted-foreground">
                {analytics.nda_signed} NDAs signed
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Access Requests</CardTitle>
            <CardDescription>View all access requests for this listing</CardDescription>
          </CardHeader>
          <CardContent>
            {accessRequests.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No access requests yet</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>NDA Signed</TableHead>
                    <TableHead>Requested</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accessRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell className="font-medium">{request.full_name}</TableCell>
                      <TableCell>{request.email}</TableCell>
                      <TableCell>{request.company || '-'}</TableCell>
                      <TableCell>{getStatusBadge(request.status)}</TableCell>
                      <TableCell>
                        {request.nda_signed_at ? (
                          <Badge>Signed</Badge>
                        ) : (
                          <span className="text-muted-foreground">Not signed</span>
                        )}
                      </TableCell>
                      <TableCell>{new Date(request.created_at).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <EmailAutomationSummary
          listingId={id!}
          emailAutomationEnabled={listing.email_automation_enabled || false}
          domainPreference={listing.email_domain_preference}
          sequenceName={(listing.meta as any)?.email_automation?.sequence_name}
          emailCount={(listing.meta as any)?.email_automation?.email_count}
          stats={(listing.meta as any)?.email_automation?.stats}
        />
      </main>
    </div>
  );
};

export default ListingProfile;
