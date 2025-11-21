import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Shield, FileSearch, TrendingUp, Lock, Search, Filter } from "lucide-react";
import { Header } from "@/components/Header";
import { ListingCard } from "@/components/ListingCard";
import { supabase } from "@/integrations/supabase/client";
import heroImage from "@/assets/hero-ma-platform.jpg";

const Index = () => {
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      <Header />

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/90 to-primary-hover/90 z-10" />
        <img 
          src={heroImage} 
          alt="Professional M&A platform" 
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="relative z-20 container mx-auto px-4 py-16 md:py-24">
          <div className="max-w-3xl">
            <h1 className="text-3xl md:text-5xl font-bold text-primary-foreground mb-4">
              Premium Acquisition Opportunities
            </h1>
            <p className="text-base md:text-lg text-primary-foreground/90 leading-relaxed">
              Browse carefully vetted businesses with comprehensive data rooms, secure NDA management, and full confidentiality controls.
            </p>
          </div>
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
      <section className="container mx-auto px-4 pb-12">
        <div className="mb-6">
          <p className="text-sm text-muted-foreground">
            Showing <span className="font-semibold text-foreground">{listings.length}</span> opportunities
          </p>
        </div>
        {loading ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground">Loading opportunities...</p>
          </div>
        ) : listings.length === 0 ? (
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

      {/* Features Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Built for Confidential Transactions
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Every feature designed to protect your privacy while showcasing your opportunity to qualified buyers.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <Card className="border-2 hover:border-primary/30 transition-all hover:shadow-lg">
            <CardContent className="pt-6">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">AI-Powered Listings</h3>
              <p className="text-muted-foreground">
                Create professional listings with our AI canvas. Intelligent formatting and data presentation to showcase your business.
              </p>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-primary/30 transition-all hover:shadow-lg">
            <CardContent className="pt-6">
              <div className="h-12 w-12 rounded-lg bg-success/10 flex items-center justify-center mb-4">
                <Shield className="h-6 w-6 text-success" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">NDA Management</h3>
              <p className="text-muted-foreground">
                Built-in NDA workflow. Control access to sensitive documents and track who has signed confidentiality agreements.
              </p>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-primary/30 transition-all hover:shadow-lg">
            <CardContent className="pt-6">
              <div className="h-12 w-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                <FileSearch className="h-6 w-6 text-accent" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">Comprehensive Data Rooms</h3>
              <p className="text-muted-foreground">
                Organize financials, contracts, and documentation. Pre-NDA and post-NDA access controls for staged disclosure.
              </p>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-primary/30 transition-all hover:shadow-lg">
            <CardContent className="pt-6">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Lock className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">Password Protection</h3>
              <p className="text-muted-foreground">
                Add an extra layer of security with optional password protection. Share access codes only with serious buyers.
              </p>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-primary/30 transition-all hover:shadow-lg">
            <CardContent className="pt-6">
              <div className="h-12 w-12 rounded-lg bg-success/10 flex items-center justify-center mb-4">
                <Search className="h-6 w-6 text-success" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">SEO Controls</h3>
              <p className="text-muted-foreground">
                Choose your visibility. Toggle search engine indexing and AI discoverability for each listing individually.
              </p>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-primary/30 transition-all hover:shadow-lg">
            <CardContent className="pt-6">
              <div className="h-12 w-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                <TrendingUp className="h-6 w-6 text-accent" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">Rich Analytics</h3>
              <p className="text-muted-foreground">
                Track listing performance, buyer engagement, and NDA completion rates. Data-driven insights for sellers.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>


      {/* Footer */}
      <footer className="border-t border-border bg-card/50 py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-sm text-muted-foreground">
              © 2025 M&A Platform. All rights reserved.
            </div>
            <div className="flex items-center gap-6">
              <a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Privacy Policy
              </a>
              <a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Terms of Service
              </a>
              <a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Contact
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
