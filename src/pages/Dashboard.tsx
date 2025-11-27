import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/Header";
import { listings as listingsApi, Listing } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  FileText, 
  Users, 
  Eye, 
  TrendingUp,
  Building2,
  ArrowRight
} from "lucide-react";

const Dashboard = () => {
  const { user, hasRole, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalListings: 0,
    activeListings: 0,
    draftListings: 0,
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
      return;
    }

    if (!authLoading && user && !hasRole('admin') && !hasRole('editor')) {
      navigate('/');
      return;
    }

    if (user) {
      fetchData();
    }
  }, [user, authLoading, hasRole, navigate]);

  const fetchData = async () => {
    try {
      const { listings: data } = await listingsApi.list();
      setListings(data);
      
      setStats({
        totalListings: data.length,
        activeListings: data.filter(l => l.status === 'active').length,
        draftListings: data.filter(l => l.status === 'draft').length,
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusToggle = async (listing: Listing) => {
    try {
      const newStatus = listing.status === 'active' ? 'archived' : 'active';
      await listingsApi.update(listing.id, { status: newStatus });
    fetchData();
    } catch (error) {
      console.error('Error updating listing status:', error);
    }
  };

  if (authLoading || loading) {
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
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Manage your listings and track performance
            </p>
          </div>
          <Link to="/admin/create">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Listing
            </Button>
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-6 mb-8 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Listings</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalListings}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Listings</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeListings}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Draft Listings</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.draftListings}</div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Listings */}
            <Card>
              <CardHeader>
            <CardTitle>Recent Listings</CardTitle>
              </CardHeader>
          <CardContent>
            {listings.length === 0 ? (
              <div className="text-center py-8">
                <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No listings yet</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first listing to get started
                </p>
                <Link to="/admin/create">
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Listing
                  </Button>
                </Link>
                </div>
            ) : (
              <div className="space-y-4">
                {listings.slice(0, 5).map((listing) => (
                  <div
                          key={listing.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                        >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold">{listing.title}</h4>
                        <Badge variant={listing.status === 'active' ? 'default' : 'secondary'}>
                          {listing.status}
                            </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {listing.industry || 'No industry'} • {listing.location || 'No location'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                              <Button
                        variant="ghost"
                                size="sm"
                        onClick={() => handleStatusToggle(listing)}
                              >
                        {listing.status === 'active' ? 'Archive' : 'Activate'}
                              </Button>
                      <Link to={`/dashboard/listing/${listing.id}`}>
                        <Button variant="outline" size="sm">
                          <ArrowRight className="h-4 w-4" />
                              </Button>
                      </Link>
                    </div>
                  </div>
                ))}
                            </div>
            )}
              </CardContent>
            </Card>
      </main>
    </div>
  );
};

export default Dashboard;
