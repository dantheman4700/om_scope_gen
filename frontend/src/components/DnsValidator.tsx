import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Copy, CheckCircle2, Clock, XCircle, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface DnsValidatorProps {
  domain: string;
  onDomainChange: (domain: string) => void;
  verificationStatus: {
    spf: "pending" | "verified" | "failed";
    dkim: "pending" | "verified" | "failed";
    cname: "pending" | "verified" | "failed";
  };
  onVerificationStatusChange: (status: any) => void;
}

export const DnsValidator = ({
  domain,
  onDomainChange,
  verificationStatus,
  onVerificationStatusChange,
}: DnsValidatorProps) => {
  const { toast } = useToast();
  const [isVerifying, setIsVerifying] = useState(false);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${label} copied to clipboard`,
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "verified":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      verified: "default",
      failed: "destructive",
      pending: "secondary",
    };
    return (
      <Badge variant={variants[status as keyof typeof variants] as any}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const handleVerify = async () => {
    setIsVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("validate-dns", {
        body: { domain },
      });

      if (error) throw error;

      onVerificationStatusChange({
        spf: data.spf ? "verified" : "failed",
        dkim: data.dkim ? "verified" : "failed",
        cname: data.cname ? "verified" : "failed",
      });

      toast({
        title: "DNS Verification Complete",
        description: data.spf && data.dkim && data.cname
          ? "All DNS records verified successfully!"
          : "Some DNS records failed verification. Please check your DNS settings.",
      });
    } catch (error) {
      console.error("DNS verification error:", error);
      toast({
        title: "Verification Failed",
        description: "Failed to verify DNS records. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const dnsRecords = [
    {
      type: "TXT (SPF)",
      name: "@",
      value: "v=spf1 include:mailgun.org ~all",
      status: verificationStatus.spf,
    },
    {
      type: "TXT (DKIM)",
      name: "mg._domainkey",
      value: "k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC...",
      status: verificationStatus.dkim,
    },
    {
      type: "CNAME",
      name: "email",
      value: "mailgun.org",
      status: verificationStatus.cname,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="domain">Your Domain</Label>
        <Input
          id="domain"
          placeholder="example.com"
          value={domain}
          onChange={(e) => onDomainChange(e.target.value)}
        />
      </div>

      <div className="space-y-3">
        <h4 className="font-semibold text-sm">Add these DNS records to your domain:</h4>
        {dnsRecords.map((record, idx) => (
          <Card key={idx}>
            <CardContent className="pt-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{record.type}</span>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(record.status)}
                    {getStatusBadge(record.status)}
                  </div>
                </div>
                <div className="grid grid-cols-[80px_1fr_auto] gap-2 items-center text-sm">
                  <span className="text-muted-foreground">Name:</span>
                  <code className="bg-muted px-2 py-1 rounded text-xs">{record.name}</code>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => copyToClipboard(record.name, "Name")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-[80px_1fr_auto] gap-2 items-center text-sm">
                  <span className="text-muted-foreground">Value:</span>
                  <code className="bg-muted px-2 py-1 rounded text-xs break-all">
                    {record.value}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => copyToClipboard(record.value, "Value")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button onClick={handleVerify} disabled={isVerifying || !domain} className="w-full">
        {isVerifying ? "Verifying..." : "Verify DNS Configuration"}
      </Button>

      <div className="flex items-start gap-2 text-sm text-muted-foreground">
        <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
        <p>DNS changes can take up to 48 hours to propagate</p>
      </div>
    </div>
  );
};
