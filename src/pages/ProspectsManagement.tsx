import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ArrowLeft, Plus, Download, Search, MoreVertical, Mail, Eye, Edit, XCircle } from "lucide-react";
import { prospects as prospectsApi, Prospect } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const ProspectsManagement = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();
  const { toast } = useToast();

  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [selectedProspects, setSelectedProspects] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user || (!hasRole("admin") && !hasRole("editor"))) {
      navigate("/auth");
      return;
    }
    fetchProspects();
  }, [user, hasRole, id, navigate]);

  const fetchProspects = async () => {
    if (!id) return;
    
    setIsLoading(true);
    try {
      const { prospects: data } = await prospectsApi.list(id);
      setProspects(data);
    } catch (error: any) {
      console.error("Error fetching prospects:", error);
      toast({
        title: "Error",
        description: "Failed to fetch prospects",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStageUpdate = async (prospectId: string, newStage: string) => {
    try {
      await prospectsApi.update(prospectId, { stage: newStage });
      fetchProspects();
      toast({
        title: "Updated",
        description: "Prospect stage updated successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to update prospect stage",
        variant: "destructive",
      });
    }
  };

  const getStageColor = (stage: string) => {
    const colors: Record<string, string> = {
      unknown: "bg-gray-500",
      sent_outreach: "bg-blue-500",
      response: "bg-cyan-500",
      reviewing: "bg-yellow-500",
      call_demo: "bg-purple-500",
      nda_signed: "bg-green-500",
      passed: "bg-red-500",
    };
    return colors[stage] || "bg-gray-500";
  };

  const filteredProspects = prospects.filter((prospect) => {
    const matchesSearch =
      prospect.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      prospect.contact_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      prospect.contact_email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStage = stageFilter === "all" || prospect.stage === stageFilter;
    return matchesSearch && matchesStage;
  });

  const toggleProspectSelection = (prospectId: string) => {
    setSelectedProspects((prev) =>
      prev.includes(prospectId) ? prev.filter((pId) => pId !== prospectId) : [...prev, prospectId]
    );
  };

  const toggleAllProspects = () => {
    if (selectedProspects.length === filteredProspects.length) {
      setSelectedProspects([]);
    } else {
      setSelectedProspects(filteredProspects.map((p) => p.id));
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(`/dashboard/listing/${id}`)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Prospects Management</h1>
              <p className="text-muted-foreground">Manage prospects for this listing</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Prospect
            </Button>
          </div>
        </div>

        <Tabs defaultValue="all" className="w-full">
          <TabsList>
            <TabsTrigger value="all">All Prospects</TabsTrigger>
            <TabsTrigger value="activity">Email Activity</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4">
            <Card className="p-4">
              <div className="flex gap-4 items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search prospects..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={stageFilter} onValueChange={setStageFilter}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="All Stages" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Stages</SelectItem>
                    <SelectItem value="unknown">Unknown</SelectItem>
                    <SelectItem value="sent_outreach">Sent Outreach</SelectItem>
                    <SelectItem value="response">Response</SelectItem>
                    <SelectItem value="reviewing">Reviewing</SelectItem>
                    <SelectItem value="call_demo">Call/Demo</SelectItem>
                    <SelectItem value="nda_signed">NDA Signed</SelectItem>
                    <SelectItem value="passed">Passed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </Card>

            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedProspects.length === filteredProspects.length && filteredProspects.length > 0}
                        onCheckedChange={toggleAllProspects}
                      />
                    </TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Last Contact</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">
                        Loading prospects...
                      </TableCell>
                    </TableRow>
                  ) : filteredProspects.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">
                        No prospects found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredProspects.map((prospect) => (
                      <TableRow key={prospect.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedProspects.includes(prospect.id)}
                            onCheckedChange={() => toggleProspectSelection(prospect.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{prospect.company}</TableCell>
                        <TableCell>{prospect.contact_name || "-"}</TableCell>
                        <TableCell>{prospect.contact_email || "-"}</TableCell>
                        <TableCell>
                          <Select
                            value={prospect.stage}
                            onValueChange={(value) => handleStageUpdate(prospect.id, value)}
                          >
                            <SelectTrigger className="w-[140px]">
                              <Badge className={`${getStageColor(prospect.stage)} text-white`}>
                                {prospect.stage.replace("_", " ")}
                              </Badge>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unknown">Unknown</SelectItem>
                              <SelectItem value="new">New</SelectItem>
                              <SelectItem value="sent_outreach">Sent Outreach</SelectItem>
                              <SelectItem value="reviewing">Reviewing</SelectItem>
                              <SelectItem value="nda_signed">NDA Signed</SelectItem>
                              <SelectItem value="loi_submitted">LOI Submitted</SelectItem>
                              <SelectItem value="passed">Passed</SelectItem>
                              <SelectItem value="disqualified">Disqualified</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(prospect.updated_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground truncate max-w-[200px]">
                          {prospect.notes || "-"}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Mail className="h-4 w-4 mr-2" />
                                Send Email
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive">
                                <XCircle className="h-4 w-4 mr-2" />
                                Remove
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="activity" className="mt-6">
            <Card className="p-6">
              <p className="text-muted-foreground">Email activity tracking coming soon...</p>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="mt-6">
            <Card className="p-6">
              <p className="text-muted-foreground">Prospect analytics coming soon...</p>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ProspectsManagement;
