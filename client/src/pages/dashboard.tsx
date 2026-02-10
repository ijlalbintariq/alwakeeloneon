import { useAuth } from "@/hooks/use-auth";
import { useThreads } from "@/hooks/use-threads";
import { useDocuments } from "@/hooks/use-documents";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { 
  Plus, 
  MessageSquare, 
  FileText, 
  ArrowRight, 
  Clock,
  ExternalLink
} from "lucide-react";
import { format } from "date-fns";

export default function Dashboard() {
  const { user } = useAuth();
  const { data: threads, isLoading: threadsLoading } = useThreads();
  const { data: documents, isLoading: docsLoading } = useDocuments();

  const recentThreads = threads?.slice(0, 3) || [];
  const recentDocs = documents?.slice(0, 3) || [];

  return (
    <div className="p-6 md:p-12 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold text-foreground">
            Welcome back, {user?.firstName || user?.username}
          </h1>
          <p className="text-muted-foreground mt-2">
            Here's an overview of your legal consultations and documents.
          </p>
        </div>
        <div className="flex gap-3">
            <Link href="/documents">
                <Button variant="outline" className="gap-2">
                    <FileText className="h-4 w-4" /> Upload Document
                </Button>
            </Link>
            <Link href="/chat">
                <Button className="gap-2 shadow-lg shadow-primary/20">
                    <Plus className="h-4 w-4" /> New Consultation
                </Button>
            </Link>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Recent Consultations Card */}
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-border/50 flex justify-between items-center bg-muted/20">
            <div className="flex items-center gap-2 font-heading font-semibold text-lg">
              <MessageSquare className="h-5 w-5 text-primary" />
              Recent Consultations
            </div>
            <Link href="/chat" className="text-sm text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          
          <div className="p-6 flex-1 min-h-[300px]">
            {threadsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted/50 rounded-lg animate-pulse" />)}
              </div>
            ) : recentThreads.length > 0 ? (
              <div className="space-y-4">
                {recentThreads.map(thread => (
                  <Link key={thread.id} href={`/chat/${thread.id}`}>
                    <div className="p-4 rounded-xl border border-border/50 hover:border-primary/50 hover:bg-muted/30 transition-all cursor-pointer group">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                          {thread.title}
                        </h3>
                        <span className="text-xs text-muted-foreground flex items-center gap-1 whitespace-nowrap">
                          <Clock className="h-3 w-3" />
                          {format(new Date(thread.createdAt!), 'MMM d, yyyy')}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        Click to continue your consultation regarding this legal matter.
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground py-10">
                <MessageSquare className="h-12 w-12 mb-4 opacity-20" />
                <p>No consultations yet.</p>
                <Link href="/chat">
                    <Button variant="link" className="mt-2">Start your first one</Button>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Recent Documents Card */}
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-border/50 flex justify-between items-center bg-muted/20">
            <div className="flex items-center gap-2 font-heading font-semibold text-lg">
              <FileText className="h-5 w-5 text-accent" />
              Analyzed Documents
            </div>
            <Link href="/documents" className="text-sm text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          
          <div className="p-6 flex-1 min-h-[300px]">
            {docsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted/50 rounded-lg animate-pulse" />)}
              </div>
            ) : recentDocs.length > 0 ? (
              <div className="space-y-4">
                {recentDocs.map(doc => (
                  <div key={doc.id} className="p-4 rounded-xl border border-border/50 bg-background">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-foreground flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        {doc.title}
                      </h3>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(doc.createdAt!), 'MMM d')}
                      </span>
                    </div>
                    {doc.summary && (
                      <div className="bg-muted/30 p-3 rounded-lg text-xs text-muted-foreground mt-2 border border-border/30">
                        <span className="font-semibold text-primary block mb-1">AI Summary:</span>
                        <p className="line-clamp-2">{doc.summary}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground py-10">
                <FileText className="h-12 w-12 mb-4 opacity-20" />
                <p>No documents uploaded.</p>
                <Link href="/documents">
                    <Button variant="link" className="mt-2">Upload a contract</Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
