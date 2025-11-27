import { useState, useEffect, useCallback } from "react";
import { documents, templates, ListingDocument, GeneratedDocument, DocumentTemplate } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  Upload,
  FileText,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Download,
  Trash2,
  Sparkles,
  RefreshCw,
  File,
  FileImage,
  FileSpreadsheet,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface DocumentGeneratorProps {
  listingId: string;
}

export function DocumentGenerator({ listingId }: DocumentGeneratorProps) {
  const { toast } = useToast();
  const [uploadedDocs, setUploadedDocs] = useState<ListingDocument[]>([]);
  const [generatedDocs, setGeneratedDocs] = useState<GeneratedDocument[]>([]);
  const [availableTemplates, setAvailableTemplates] = useState<DocumentTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [docsRes, genRes, templatesRes] = await Promise.all([
        documents.list(listingId),
        documents.listGenerated(listingId),
        templates.list(),
      ]);
      setUploadedDocs(docsRes.documents);
      setGeneratedDocs(genRes.generatedDocuments);
      setAvailableTemplates(templatesRes.templates);
      if (templatesRes.templates.length > 0 && !selectedTemplate) {
        setSelectedTemplate(templatesRes.templates[0].id);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }, [listingId, selectedTemplate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Poll for status updates
  useEffect(() => {
    const hasPending = uploadedDocs.some(d => d.extraction_status === 'pending' || d.extraction_status === 'processing') ||
                       generatedDocs.some(d => d.generation_status === 'pending' || d.generation_status === 'processing');
    
    if (hasPending) {
      const interval = setInterval(fetchData, 3000);
      return () => clearInterval(interval);
    }
  }, [uploadedDocs, generatedDocs, fetchData]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const result = await documents.upload(listingId, Array.from(files));
      toast({
        title: "Upload successful",
        description: result.message,
      });
      fetchData();
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    try {
      await documents.delete(docId);
      toast({
        title: "Document deleted",
        description: "The document has been removed.",
      });
      fetchData();
    } catch (error: any) {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleGenerate = async () => {
    if (!selectedTemplate) {
      toast({
        title: "Select a template",
        description: "Please select a document template first.",
        variant: "destructive",
      });
      return;
    }

    setGenerating(true);
    try {
      const result = await documents.generate(listingId, selectedTemplate);
      toast({
        title: "Generation started",
        description: result.message,
      });
      fetchData();
    } catch (error: any) {
      toast({
        title: "Generation failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = (docId: string, format: 'pdf' | 'docx') => {
    const url = documents.getDownloadUrl(docId, format);
    const token = localStorage.getItem('auth_token');
    
    // Create a temporary link with auth
    fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.blob())
      .then(blob => {
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `generated-document.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      })
      .catch(err => {
        toast({
          title: "Download failed",
          description: err.message,
          variant: "destructive",
        });
      });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'processing':
        return <Badge variant="default"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Processing</Badge>;
      case 'completed':
        return <Badge variant="outline" className="border-green-500 text-green-600"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <FileImage className="h-4 w-4" />;
    if (mimeType.includes('pdf')) return <FileText className="h-4 w-4" />;
    if (mimeType.includes('spreadsheet') || mimeType.includes('csv')) return <FileSpreadsheet className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const completedDocs = uploadedDocs.filter(d => d.extraction_status === 'completed').length;
  const totalDocs = uploadedDocs.length;
  const processingProgress = totalDocs > 0 ? (completedDocs / totalDocs) * 100 : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Source Documents
          </CardTitle>
          <CardDescription>
            Upload documents about this company (PDFs, Word docs, presentations, images, text files).
            These will be analyzed to generate professional documents.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Upload Area */}
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-muted/50 hover:bg-muted transition-colors">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                {uploading ? (
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                ) : (
                  <>
                    <Upload className="h-8 w-8 mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      <span className="font-semibold">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-muted-foreground">
                      PDF, DOCX, PPTX, images, TXT, CSV, MD (max 20MB)
                    </p>
                  </>
                )}
              </div>
              <input
                type="file"
                className="hidden"
                multiple
                accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.csv,.md,.png,.jpg,.jpeg,.gif,.webp"
                onChange={handleFileUpload}
                disabled={uploading}
              />
            </label>

            {/* Processing Progress */}
            {totalDocs > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Processing Progress</span>
                  <span>{completedDocs} / {totalDocs} documents ready</span>
                </div>
                <Progress value={processingProgress} />
              </div>
            )}

            {/* Document List */}
            {uploadedDocs.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">Uploaded Documents</h4>
                  <Button variant="ghost" size="sm" onClick={fetchData}>
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Refresh
                  </Button>
                </div>
                <div className="divide-y rounded-md border">
                  {uploadedDocs.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-3">
                      <div className="flex items-center gap-3">
                        {getFileIcon(doc.mime_type)}
                        <div>
                          <p className="text-sm font-medium truncate max-w-[200px]">
                            {doc.original_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(doc.size_bytes)}
                            {doc.chunk_count !== undefined && doc.extraction_status === 'completed' && 
                              ` • ${doc.chunk_count} chunks`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(doc.extraction_status)}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete document?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete "{doc.original_name}" and all its processed data.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteDocument(doc.id)}>
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Generate Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Generate Document
          </CardTitle>
          <CardDescription>
            Use AI to generate professional documents from your uploaded source materials.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-4">
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger className="w-[300px]">
                  <SelectValue placeholder="Select a template..." />
                </SelectTrigger>
                <SelectContent>
                  {availableTemplates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                      {template.variable_count !== undefined && (
                        <span className="text-muted-foreground ml-2">
                          ({template.variable_count} variables)
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={handleGenerate}
                disabled={generating || completedDocs === 0 || !selectedTemplate}
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate
                  </>
                )}
              </Button>
            </div>

            {completedDocs === 0 && totalDocs > 0 && (
              <p className="text-sm text-amber-600">
                Please wait for documents to finish processing before generating.
              </p>
            )}

            {totalDocs === 0 && (
              <p className="text-sm text-muted-foreground">
                Upload source documents first to enable document generation.
              </p>
            )}

            {availableTemplates.length === 0 && (
              <p className="text-sm text-amber-600">
                No document templates available. Please contact an administrator.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Generated Documents */}
      {generatedDocs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Generated Documents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y rounded-md border">
              {generatedDocs.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between p-4">
                  <div className="space-y-1">
                    <p className="font-medium">{doc.template_name || 'Generated Document'}</p>
                    <p className="text-sm text-muted-foreground">
                      Created {new Date(doc.created_at).toLocaleString()}
                    </p>
                    {doc.error_message && (
                      <p className="text-sm text-destructive">{doc.error_message}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {getStatusBadge(doc.generation_status)}
                    {doc.generation_status === 'completed' && (
                      <div className="flex gap-2">
                        {doc.pdf_path && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownload(doc.id, 'pdf')}
                          >
                            <Download className="h-4 w-4 mr-1" />
                            PDF
                          </Button>
                        )}
                        {doc.docx_path && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownload(doc.id, 'docx')}
                          >
                            <Download className="h-4 w-4 mr-1" />
                            DOCX
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

