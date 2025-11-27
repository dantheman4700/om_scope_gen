import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Settings, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface EmailAutomationSummaryProps {
  listingId: string;
  emailAutomationEnabled: boolean;
  domainPreference?: string;
  sequenceName?: string;
  emailCount?: number;
  stats?: {
    prospectsEnrolled: number;
    emailsSent: number;
    openRate: number;
    responseRate: number;
  };
}

export const EmailAutomationSummary = ({
  listingId,
  emailAutomationEnabled,
  domainPreference = "platform",
  sequenceName = "60-Day Nurture",
  emailCount = 4,
  stats = {
    prospectsEnrolled: 0,
    emailsSent: 0,
    openRate: 0,
    responseRate: 0,
  },
}: EmailAutomationSummaryProps) => {
  const navigate = useNavigate();

  const getDomainDisplay = () => {
    if (domainPreference === "platform") return "Platform (@sherwoodpartners.com)";
    if (domainPreference === "client") return "Client Domain";
    return "Dynamics CRM";
  };

  if (!emailAutomationEnabled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Email Automation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 text-muted-foreground mb-4">
            <AlertCircle className="h-5 w-5" />
            <p>Email automation is not enabled for this listing</p>
          </div>
          <Button
            onClick={() => navigate(`/dashboard/listing/${listingId}/settings`)}
            variant="outline"
          >
            Enable Automation
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle>Email Automation</CardTitle>
        <Badge variant="default" className="bg-green-500">Active</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground leading-relaxed">
          Sending {emailCount} emails over 60 days. Following up every 2 weeks until response or until 60 days pass. 
          Auto-updating prospect stages when emails hit inbox (Reviewing), when they respond (Engaged), when NDA is 
          signed (NDA Signed), or marking as Passed after 60 days of no response.
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Prospects Enrolled</p>
            <p className="text-2xl font-bold">{stats.prospectsEnrolled}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Emails Sent</p>
            <p className="text-2xl font-bold">{stats.emailsSent}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Open Rate</p>
            <p className="text-2xl font-bold">{stats.openRate}%</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Response Rate</p>
            <p className="text-2xl font-bold">{stats.responseRate}%</p>
          </div>
        </div>

        <div className="pt-4 border-t space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Domain:</span>
            <span className="font-medium">{getDomainDisplay()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Sequence:</span>
            <span className="font-medium">{sequenceName} ({emailCount} emails)</span>
          </div>
        </div>

        <Button
          onClick={() => navigate(`/dashboard/listing/${listingId}/settings`)}
          variant="outline"
          className="w-full"
        >
          <Settings className="h-4 w-4 mr-2" />
          Automation Settings
        </Button>
      </CardContent>
    </Card>
  );
};
