import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useDocumentHead } from "@/hooks/use-document-head";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2, ArrowLeft, ShieldCheck } from "lucide-react";

export default function UploadSessionPage() {
  useDocumentHead({
    title: "Upload Document | AL WAKEELO",
    description: "Upload document directly to your case file",
    path: "/upload/session",
  });

  const [, params] = useRoute("/upload/session/:sessionId");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const sessionId = params?.sessionId || "";

  const [loading, setLoading] = useState(true);
  const [sessionData, setSessionData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      setError("Invalid upload link.");
      setLoading(false);
      return;
    }

    // Fetch upload session details
    fetch(`/api/upload/session/${sessionId}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || "Upload link expired or invalid.");
        }
        return res.json();
      })
      .then((data) => {
        setSessionData(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load upload session.");
        setLoading(false);
      });
  }, [sessionId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file || !sessionId) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (sessionData?.label) {
        formData.append("label", sessionData.label);
      }

      const res = await fetch(`/api/upload/session/${sessionId}/upload`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to upload document.");
      }

      setCompleted(true);
      toast({ title: "Document Uploaded!", description: `"${file.name}" linked to case successfully.` });
    } catch (err: any) {
      toast({ title: "Upload Failed", description: err.message || "Error uploading file.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto my-12 p-4">
        <Card className="rounded-3xl border-destructive/30 bg-destructive/5 text-center p-6 space-y-4">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
          <CardTitle className="text-lg font-bold">Upload Link Expired or Invalid</CardTitle>
          <CardDescription className="text-xs text-muted-foreground">{error}</CardDescription>
          <Button onClick={() => navigate("/case-files")} variant="outline" className="rounded-xl text-xs">
            <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Return to Case Files
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto my-12 p-4 fade-in">
      <Card className="rounded-3xl border-border shadow-xl">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-1">
            <ShieldCheck className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-xl font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>
            Upload Document to Case
          </CardTitle>
          <CardDescription className="text-xs">
            Secure, single-use upload link for <strong className="text-foreground">{sessionData?.caseTitle || `Case #${sessionData?.caseId}`}</strong>
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {completed ? (
            <div className="text-center py-6 space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto animate-bounce" />
              <h3 className="text-base font-bold text-foreground">Upload Complete!</h3>
              <p className="text-xs text-muted-foreground">
                Document <strong>"{file?.name}"</strong> has been securely uploaded and linked to your case. You can close this window.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div 
                className={`border-2 border-dashed rounded-2xl p-6 text-center transition-colors cursor-pointer ${file ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
                onClick={() => document.getElementById("file-input")?.click()}
              >
                <input 
                  id="file-input" 
                  type="file" 
                  className="hidden" 
                  onChange={handleFileChange}
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.txt"
                />
                {file ? (
                  <div className="space-y-1">
                    <FileText className="w-8 h-8 text-primary mx-auto" />
                    <p className="text-xs font-bold text-foreground truncate">{file.name}</p>
                    <p className="text-[10px] text-muted-foreground">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="w-8 h-8 text-muted-foreground mx-auto" />
                    <p className="text-xs font-bold text-foreground">Click to browse or drop file here</p>
                    <p className="text-[10px] text-muted-foreground">PDF, DOCX, JPG, PNG, WEBP (up to 50MB)</p>
                  </div>
                )}
              </div>

              <Button
                onClick={handleUpload}
                disabled={!file || uploading}
                className="w-full rounded-xl text-xs font-bold py-2.5"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading Document...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload & Link to Case
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>

        <CardFooter className="justify-center border-t border-border pt-3">
          <p className="text-[10px] text-muted-foreground text-center">
            AL WAKEELO Encrypted Upload Protocol • Token expires in {sessionData?.expiresInMinutes || 15} minutes
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
