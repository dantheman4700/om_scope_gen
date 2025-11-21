import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, ExternalLink, Eye, FileText, Users, Edit, Archive, ArchiveRestore, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";

interface Listing {
  id: string;
  title: string;
  slug: string;
  status: string;
  visibility_level: string;
  is_anonymized: boolean;
  created_at: string;
}

interface AccessRequest {
  id: string;
  email: string;
  full_name: string;
  company: string | null;
  status: string;
  nda_signed_at: string | null;
  created_at: string;
  listing_id: string;
  listings: {
    title: string;
  };
}

const Dashboard = () => {
  const { user, hasRole, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [listings, setListings] = useState<Listing[]>([]);
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    if (!loading && (!user || (!hasRole('admin') && !hasRole('editor')))) {
      navigate('/auth');
    }
  }, [user, loading, hasRole, navigate]);

  useEffect(() => {
    if (user && (hasRole('admin') || hasRole('editor'))) {
      fetchData();
    }
  }, [user, hasRole]);

  const fetchData = async () => {
    setLoadingData(true);
    
    // Fetch listings
    const { data: listingsData } = await supabase
      .from('listings')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (listingsData) setListings(listingsData);

    // Fetch access requests
    const { data: requestsData } = await supabase
      .from('access_requests')
      .select('*, listings(title)')
      .order('created_at', { ascending: false });
    
    if (requestsData) setAccessRequests(requestsData);

    setLoadingData(false);
  };

  const copyShareLink = (listingId: string) => {
    const url = `${window.location.origin}/listing/${listingId}`;
    navigator.clipboard.writeText(url);
    toast({
      title: "Link copied",
      description: "Share link copied to clipboard",
    });
  };

  const toggleListingStatus = async (listingId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'archived' : 'active';
    
    const updateData: any = { status: newStatus };
    
    // When activating, ensure published_at is set
    if (newStatus === 'active') {
      updateData.published_at = new Date().toISOString();
    }
    
    const { error } = await supabase
      .from('listings')
      .update(updateData)
      .eq('id', listingId);

    if (error) {
      sonnerToast.error("Failed to update listing status");
      console.error("Error updating listing:", error);
      return;
    }

    sonnerToast.success(`Listing ${newStatus === 'active' ? 'activated' : 'deactivated'}`);
    fetchData();
  };

  const filteredListings = listings.filter((listing) => {
    const matchesSearch = listing.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || listing.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      active: "default",
      draft: "secondary",
      archived: "outline",
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

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Dashboard</h1>
          <p className="text-muted-foreground">Manage listings, access requests, and view analytics</p>
        </div>

        <Tabs defaultValue="listings" className="space-y-6">
          <TabsList>
            <TabsTrigger value="listings" className="gap-2">
              <FileText className="h-4 w-4" />
              Listings
            </TabsTrigger>
            <TabsTrigger value="access-requests" className="gap-2">
              <Users className="h-4 w-4" />
              Access Requests
            </TabsTrigger>
          </TabsList>

          <TabsContent value="listings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>All Listings</CardTitle>
                <CardDescription>View and manage all business listings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search listings..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Visibility</TableHead>
                      <TableHead>Anonymized</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredListings.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          No listings found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredListings.map((listing) => (
                        <TableRow 
                          key={listing.id}
                          onClick={() => navigate(`/dashboard/listing/${listing.id}`)}
                          className="cursor-pointer hover:bg-muted/50"
                        >
                          <TableCell className="font-medium">{listing.title}</TableCell>
                          <TableCell>{getStatusBadge(listing.status)}</TableCell>
                          <TableCell>
                            <Badge variant={listing.visibility_level === 'public' ? 'default' : 'secondary'}>
                              {listing.visibility_level}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {listing.is_anonymized ? <Badge>Yes</Badge> : <span className="text-muted-foreground">No</span>}
                          </TableCell>
                          <TableCell>{new Date(listing.created_at).toLocaleDateString()}</TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate(`/admin/create?id=${listing.id}`)}
                                title="Edit listing"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate(`/listing/${listing.id}`)}
                                title="View listing"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => copyShareLink(listing.id)}
                                title="Copy share link"
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => toggleListingStatus(listing.id, listing.status)}
                                title={listing.status === 'active' ? 'Deactivate listing' : 'Activate listing'}
                              >
                                {listing.status === 'active' ? (
                                  <Archive className="h-4 w-4" />
                                ) : (
                                  <ArchiveRestore className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="access-requests" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Access Requests</CardTitle>
                <CardDescription>View and manage NDA access requests</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Listing</TableHead>
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
                        <TableCell>{request.listings.title}</TableCell>
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
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </main>
    </div>
  );
};

export default Dashboard;
