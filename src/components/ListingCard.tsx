import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, MapPin, DollarSign, TrendingUp, EyeOff, Share2 } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

interface ListingCardProps {
  listing: {
    id: string;
    title: string;
    company_name?: string;
    industry: string;
    location: string;
    revenue?: number;
    ebitda?: number;
    status: string;
    is_anonymized?: boolean;
    description: string;
  };
}

export const ListingCard = ({ listing }: ListingCardProps) => {
  const getStatusVariant = () => {
    switch (listing.status) {
      case "active":
        return "success";
      case "under-nda":
        return "default";
      default:
        return "secondary";
    }
  };

  const getStatusLabel = () => {
    switch (listing.status) {
      case "active":
        return "Active Listing";
      case "under-nda":
        return "Under NDA";
      default:
        return "Pending";
    }
  };

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`;
    }
    return `$${(amount / 1000).toFixed(0)}K`;
  };

  return (
    <Card className="group hover:shadow-lg transition-all duration-300 border-border hover:border-primary/30 h-full">
      <Link to={`/listing/${listing.id}`}>
        <CardHeader>
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="p-2 rounded-lg bg-primary/10">
                {listing.is_anonymized ? (
                  <EyeOff className="h-5 w-5 text-primary" />
                ) : (
                  <Building2 className="h-5 w-5 text-primary" />
                )}
              </div>
              <Badge variant={getStatusVariant()}>{getStatusLabel()}</Badge>
              {listing.is_anonymized && (
                <Badge variant="outline" className="bg-muted/50">
                  Anonymized
                </Badge>
              )}
            </div>
          </div>
          <h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">
            {listing.title}
          </h3>
          <p className="text-sm text-muted-foreground">{listing.industry}</p>
        </CardHeader>
      </Link>
      <CardContent className="space-y-4">
        <Link to={`/listing/${listing.id}`}>
          <p className="text-sm text-muted-foreground line-clamp-2">{listing.description}</p>
          
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="text-foreground">{listing.location}</span>
            </div>
            {listing.revenue && (
              <div className="flex items-center gap-2 text-sm">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-foreground">{formatCurrency(listing.revenue)}</span>
              </div>
            )}
            {listing.ebitda && (
              <div className="flex items-center gap-2 text-sm col-span-2">
                <TrendingUp className="h-4 w-4 text-success" />
                <span className="text-foreground">
                  EBITDA: <span className="font-semibold">{formatCurrency(listing.ebitda)}</span>
                </span>
              </div>
            )}
          </div>
        </Link>

        <div className="flex items-center gap-2 mt-2">
          <Link to={`/listing/${listing.id}`} className="flex-1">
            <Button className="w-full" variant="outline">
              View Details
            </Button>
          </Link>
          <Button 
            variant="outline" 
            size="icon"
            onClick={(e) => {
              e.preventDefault();
              navigator.clipboard.writeText(`${window.location.origin}/listing/${listing.id}`);
              toast.success("Link copied to clipboard");
            }}
          >
            <Share2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
