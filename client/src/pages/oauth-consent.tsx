import { useState } from "react";
import { useDocumentHead } from "@/hooks/use-document-head";
import { Card, CardHeader, CardContent, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Compass, ShieldCheck, AlertTriangle } from "lucide-react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function OauthConsentPage() {
  useDocumentHead({
    title: "App Authorization | AL WAKEELO",
    description: "Authorize third-party applications to access your AL WAKEELO account.",
    path: "/oauth/authorize",
  });

  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const params = new URLSearchParams(window.location.search);
  const clientId = params.get("client_id") || "unknown";
  const redirectUri = params.get("redirect_uri");
  const state = params.get("state") || "";
  const responseType = params.get("response_type") || "code";

  // Detect app name from redirect_uri or client_id
  const appName = (() => {
    const uri = redirectUri?.toLowerCase() || "";
    if (uri.includes("claude.ai") || uri.includes("anthropic")) return "Claude";
    if (uri.includes("openai.com") || uri.includes("chatgpt")) return "ChatGPT";
    if (uri.includes("cursor")) return "Cursor";
    if (uri.includes("windsurf") || uri.includes("codeium")) return "Windsurf";
    if (uri.includes("copilot") || uri.includes("github")) return "GitHub Copilot";
    if (clientId.startsWith("alw_")) return "MCP Client";
    return "External App";
  })();

  const handleAuthorize = async () => {
    if (!redirectUri) {
      toast({
        title: "Invalid request",
        description: "Missing redirect_uri parameter.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/oauth/authorize/confirm", {
        client_id: clientId,
        redirect_uri: redirectUri,
        state,
        response_type: responseType,
      });
      const data = await res.json();
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      } else {
        throw new Error("Missing redirectUrl in response");
      }
    } catch (err: any) {
      toast({
        title: "Authorization failed",
        description: err.message || "An error occurred during authorization.",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (redirectUri) {
      window.location.href = `${redirectUri}?error=access_denied&state=${state}`;
    } else {
      navigate("/dashboard");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[75vh] px-4">
      <Card className="max-w-md w-full rounded-3xl border border-border shadow-xl">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-2">
            <Compass size={22} className="animate-pulse" />
          </div>
          <CardTitle className="text-xl font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>
            Authorize {appName} Connection
          </CardTitle>
          <CardDescription className="text-xs">
            A request has been made to connect your account to {appName}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-xs text-muted-foreground leading-relaxed">
          <div className="flex gap-2.5 items-start bg-primary/5 border border-primary/20 p-3.5 rounded-xl text-foreground">
            <ShieldCheck size={16} className="text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-[11px] mb-1">What this app can do:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground text-[10.5px]">
                <li>Search 600,000+ judgments and statutory acts</li>
                <li>Generate court-ready legal drafts and petitions</li>
                <li>Review risk clauses and draft custom agreements</li>
              </ul>
            </div>
          </div>

          <div className="flex gap-2.5 items-start bg-amber-500/5 border border-amber-500/20 p-3.5 rounded-xl text-foreground">
            <AlertTriangle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-[11px] mb-1">Important Details:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground text-[10.5px]">
                <li>All integration queries count against your active AL WAKEELO subscription limits</li>
                <li>Your secure API key credentials are never exposed directly to the AI models</li>
                <li>You can revoke this integration at any time in your Settings panel</li>
              </ul>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex gap-3 justify-end p-6 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={loading}
            className="rounded-xl text-xs h-10 px-4"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleAuthorize}
            disabled={loading}
            className="rounded-xl text-xs h-10 px-5 bg-primary text-primary-foreground hover:bg-primary/95"
          >
            {loading ? "Authorizing..." : "Authorize App"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
