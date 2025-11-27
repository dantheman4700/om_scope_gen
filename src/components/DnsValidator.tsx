import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DnsVerificationStatus {
  spf: "pending" | "verified" | "failed";
  dkim: "pending" | "verified" | "failed";
  cname: "pending" | "verified" | "failed";
}

interface DnsValidatorProps {
  domain: string;
  onDomainChange: (domain: string) => void;
  verificationStatus: DnsVerificationStatus;
  onVerificationStatusChange: (status: DnsVerificationStatus) => void;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const DnsValidator = ({
  domain,
  onDomainChange,
  verificationStatus,
  onVerificationStatusChange,
}: DnsValidatorProps) => {
  const [isVerifying, setIsVerifying] = useState(false);
  const { toast } = useToast();

  const handleVerify = async () => {
    if (!domain) {
      toast({
        title: "Domain Required",
        description: "Please enter a domain to verify",
        variant: "destructive",
      });
      return;
    }

    setIsVerifying(true);

    try {
      const response = await fetch(`${API_BASE}/validate-dns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Verification failed');
      }

      if (data.success) {
      onVerificationStatusChange({
        spf: data.spf ? "verified" : "failed",
        dkim: data.dkim ? "verified" : "failed",
        cname: data.cname ? "verified" : "failed",
      });

        const allVerified = data.spf && data.dkim && data.cname;
      toast({
          title: allVerified ? "DNS Verified" : "Partial Verification",
          description: allVerified
            ? "All DNS records have been verified successfully"
            : "Some DNS records need attention. Check the details below.",
          variant: allVerified ? "default" : "destructive",
      });
      }
    } catch (error: any) {
      console.error("DNS verification error:", error);
      toast({
        title: "Verification Failed",
        description: error.message || "Unable to verify DNS records. Please try again.",
        variant: "destructive",
      });
      onVerificationStatusChange({
        spf: "failed",
        dkim: "failed",
        cname: "failed",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const getStatusIcon = (status: "pending" | "verified" | "failed") => {
    switch (status) {
      case "verified":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <div className="h-4 w-4 rounded-full bg-gray-300" />;
    }
  };

  const getStatusBadge = (status: "pending" | "verified" | "failed") => {
    switch (status) {
      case "verified":
        return <Badge variant="default" className="bg-green-500">Verified</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="client-domain">Client Domain</Label>
        <div className="flex gap-2">
        <Input
            id="client-domain"
            placeholder="mail.yourdomain.com"
          value={domain}
          onChange={(e) => onDomainChange(e.target.value)}
        />
          <Button onClick={handleVerify} disabled={isVerifying || !domain}>
            {isVerifying ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Verifying...
              </>
            ) : (
              "Verify DNS"
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Enter your custom domain for sending emails
        </p>
      </div>

      <div className="space-y-4">
        <h4 className="font-medium">DNS Records Status</h4>

      <div className="space-y-3">
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-3">
              {getStatusIcon(verificationStatus.spf)}
              <div>
                <p className="font-medium text-sm">SPF Record</p>
                <p className="text-xs text-muted-foreground">
                  v=spf1 include:_spf.yourdomain.com ~all
                </p>
                  </div>
                </div>
            {getStatusBadge(verificationStatus.spf)}
                </div>

          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-3">
              {getStatusIcon(verificationStatus.dkim)}
              <div>
                <p className="font-medium text-sm">DKIM Record</p>
                <p className="text-xs text-muted-foreground">
                  selector._domainkey.{domain || "yourdomain.com"}
                </p>
              </div>
            </div>
            {getStatusBadge(verificationStatus.dkim)}
      </div>

          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-3">
              {getStatusIcon(verificationStatus.cname)}
              <div>
                <p className="font-medium text-sm">CNAME Record</p>
                <p className="text-xs text-muted-foreground">
                  mail.{domain || "yourdomain.com"} → platform.example.com
                </p>
              </div>
            </div>
            {getStatusBadge(verificationStatus.cname)}
          </div>
        </div>
      </div>
    </div>
  );
};
