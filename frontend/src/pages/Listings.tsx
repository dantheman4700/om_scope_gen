import { ListingCard } from "@/components/ListingCard";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Filter } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const Listings = () => {
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    fetchListings();
  }, []);

  const fetchListings = async () => {
    try {
      const { data, error } = await supabase
        .from('listings')
        .select('*')
        .eq('visibility_level', 'public')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setListings(data || []);
    } catch (error) {
      console.error('Error fetching listings:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 flex items-center justify-center">
        <p className="text-muted-foreground">Loading listings...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <a href="/" className="text-2xl font-bold text-primary">
              M&A Platform
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-r from-primary to-primary-hover text-primary-foreground py-16">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Acquisition Opportunities
          </h1>
          <p className="text-lg text-primary-foreground/90 max-w-2xl">
            Browse premium acquisition opportunities across industries. All listings are carefully vetted and include comprehensive data rooms.
          </p>
        </div>
      </section>

      {/* Search & Filters */}
      <section className="container mx-auto px-4 py-8">
        <div className="bg-card p-6 rounded-lg shadow-md border border-border">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search by industry, location, or keyword..." 
                className="pl-10"
              />
            </div>
            <Select defaultValue="all">
              <SelectTrigger className="w-full md:w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Industry" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Industries</SelectItem>
                <SelectItem value="tech">Technology</SelectItem>
                <SelectItem value="healthcare">Healthcare</SelectItem>
                <SelectItem value="manufacturing">Manufacturing</SelectItem>
                <SelectItem value="consumer">Consumer Goods</SelectItem>
              </SelectContent>
            </Select>
            <Select defaultValue="all-status">
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all-status">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="under-nda">Under NDA</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      {/* Listings Grid */}
      <section className="container mx-auto px-4 pb-16">
        <div className="mb-6">
          <p className="text-sm text-muted-foreground">
            Showing <span className="font-semibold text-foreground">{listings.length}</span> opportunities
          </p>
        </div>
        {listings.length === 0 ? (
          <div className="text-center py-16">
            <h3 className="text-xl font-semibold mb-2">No listings available</h3>
            <p className="text-muted-foreground">Check back soon for new acquisition opportunities.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default Listings;
