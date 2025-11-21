import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";
import { DomainSelector } from "@/components/DomainSelector";
import { DnsValidator } from "@/components/DnsValidator";
import { SequencePreview } from "@/components/SequencePreview";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const ListingSettings = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();
  const { toast } = useToast();

  const [emailAutomationEnabled, setEmailAutomationEnabled] = useState(false);
  const [domainPreference, setDomainPreference] = useState("platform");
  const [clientDomain, setClientDomain] = useState("");
  const [dnsVerificationStatus, setDnsVerificationStatus] = useState({
    spf: "pending" as const,
    dkim: "pending" as const,
    cname: "pending" as const,
  });
  const [selectedSequenceId, setSelectedSequenceId] = useState<string>("");
  const [automationRules, setAutomationRules] = useState({
    auto_update_reviewing: true,
    auto_update_engaged: true,
    auto_update_nda_signed: true,
    mark_passed_after_sequence: true,
    stop_on_reply: true,
  });
  const [emailSequences, setEmailSequences] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!user || (!hasRole("admin") && !hasRole("editor"))) {
      navigate("/auth");
      return;
    }

    fetchListingSettings();
    fetchEmailSequences();
  }, [user, hasRole, id, navigate]);

  const fetchListingSettings = async () => {
    const { data, error } = await supabase
      .from("listings")
      .select("email_automation_enabled, email_domain_preference, meta")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching listing settings:", error);
      return;
    }

    setEmailAutomationEnabled(data.email_automation_enabled || false);
    setDomainPreference(data.email_domain_preference || "platform");

    if (data.meta && typeof data.meta === 'object' && 'email_automation' in data.meta) {
      const automation = (data.meta as any).email_automation;
      setSelectedSequenceId(automation.sequence_id || "");
      setClientDomain(automation.client_domain || "");
      if (automation.automation_rules) {
        setAutomationRules(automation.automation_rules);
      }
      if (automation.dns_verification) {
        setDnsVerificationStatus({
          spf: automation.dns_verification.spf || "pending",
          dkim: automation.dns_verification.dkim || "pending",
          cname: automation.dns_verification.cname || "pending",
        });
      }
    }
  };

  const fetchEmailSequences = async () => {
    const { data, error } = await supabase
      .from("email_sequences")
      .select("*")
      .eq("is_template", true);

    if (error) {
      console.error("Error fetching email sequences:", error);
      return;
    }

    setEmailSequences(data || []);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("listings")
        .update({
          email_automation_enabled: emailAutomationEnabled,
          email_domain_preference: domainPreference as "platform" | "client" | "dynamics",
          meta: {
            email_automation: {
              sequence_id: selectedSequenceId,
              automation_rules: automationRules,
              client_domain: domainPreference === "client" ? clientDomain : null,
              dns_verification: domainPreference === "client" ? dnsVerificationStatus : null,
            },
          },
        })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Settings Saved",
        description: "Email automation settings have been updated successfully.",
      });
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({
        title: "Save Failed",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const selectedSequence = emailSequences.find((seq) => seq.id === selectedSequenceId);
  const sequenceSteps = selectedSequence?.steps || [];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto py-8 space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/dashboard/listing/${id}`)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Listing Settings</h1>
            <p className="text-muted-foreground">Configure email automation and other settings</p>
          </div>
        </div>

        <Tabs defaultValue="automation" className="w-full">
          <TabsList>
            <TabsTrigger value="automation">Email Automation</TabsTrigger>
            <TabsTrigger value="general">General</TabsTrigger>
          </TabsList>

          <TabsContent value="automation" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Enable Email Automation</CardTitle>
                  <Switch
                    checked={emailAutomationEnabled}
                    onCheckedChange={setEmailAutomationEnabled}
                  />
                </div>
              </CardHeader>
            </Card>

            {emailAutomationEnabled && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Sequence Selection</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Choose Email Sequence Template</Label>
                      <Select value={selectedSequenceId} onValueChange={setSelectedSequenceId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a sequence" />
                        </SelectTrigger>
                        <SelectContent>
                          {emailSequences.map((sequence) => (
                            <SelectItem key={sequence.id} value={sequence.id}>
                              {sequence.name} ({sequenceSteps.length} emails)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedSequence && sequenceSteps.length > 0 && (
                      <SequencePreview steps={sequenceSteps} />
                    )}

                    <Button variant="outline" className="w-full">
                      + Create Custom Sequence
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Domain Configuration</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <DomainSelector value={domainPreference} onChange={setDomainPreference} />
                  </CardContent>
                </Card>

                {domainPreference === "client" && (
                  <Card>
                    <CardHeader>
                      <CardTitle>DNS Validation</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <DnsValidator
                        domain={clientDomain}
                        onDomainChange={setClientDomain}
                        verificationStatus={dnsVerificationStatus}
                        onVerificationStatusChange={setDnsVerificationStatus}
                      />
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader>
                    <CardTitle>Automation Rules</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="reviewing"
                        checked={automationRules.auto_update_reviewing}
                        onCheckedChange={(checked) =>
                          setAutomationRules((prev) => ({
                            ...prev,
                            auto_update_reviewing: checked as boolean,
                          }))
                        }
                      />
                      <Label htmlFor="reviewing" className="text-sm font-normal cursor-pointer">
                        Auto-update stage to "Reviewing" when email is opened
                      </Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="engaged"
                        checked={automationRules.auto_update_engaged}
                        onCheckedChange={(checked) =>
                          setAutomationRules((prev) => ({
                            ...prev,
                            auto_update_engaged: checked as boolean,
                          }))
                        }
                      />
                      <Label htmlFor="engaged" className="text-sm font-normal cursor-pointer">
                        Auto-update stage to "Engaged" when prospect replies
                      </Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="nda"
                        checked={automationRules.auto_update_nda_signed}
                        onCheckedChange={(checked) =>
                          setAutomationRules((prev) => ({
                            ...prev,
                            auto_update_nda_signed: checked as boolean,
                          }))
                        }
                      />
                      <Label htmlFor="nda" className="text-sm font-normal cursor-pointer">
                        Auto-update stage to "NDA Signed" when NDA signature detected
                      </Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="passed"
                        checked={automationRules.mark_passed_after_sequence}
                        onCheckedChange={(checked) =>
                          setAutomationRules((prev) => ({
                            ...prev,
                            mark_passed_after_sequence: checked as boolean,
                          }))
                        }
                      />
                      <Label htmlFor="passed" className="text-sm font-normal cursor-pointer">
                        Mark as "Passed" after sequence completes with no response
                      </Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="stop"
                        checked={automationRules.stop_on_reply}
                        onCheckedChange={(checked) =>
                          setAutomationRules((prev) => ({
                            ...prev,
                            stop_on_reply: checked as boolean,
                          }))
                        }
                      />
                      <Label htmlFor="stop" className="text-sm font-normal cursor-pointer">
                        Stop sending when prospect replies
                      </Label>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            <div className="flex gap-4">
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Settings"}
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate(`/dashboard/listing/${id}`)}
              >
                Cancel
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="general" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>General Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">General settings coming soon...</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ListingSettings;
