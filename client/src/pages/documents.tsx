import { useState } from "react";
import { useDocuments, useCreateDocument } from "@/hooks/use-documents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  FileText, 
  Upload, 
  Plus, 
  Loader2,
  Calendar,
  Search,
  CheckCircle2
} from "lucide-react";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertDocumentSchema, type InsertDocument } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { cn } from "@/lib/utils";

export default function DocumentsPage() {
  const { data: documents, isLoading } = useDocuments();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredDocs = documents?.filter(doc => 
    doc.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (doc.summary && doc.summary.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="p-6 md:p-12 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold text-foreground">Legal Documents</h1>
          <p className="text-muted-foreground mt-2">
            Upload and manage your legal documents. AI will auto-summarize them.
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 shadow-lg shadow-primary/20">
              <Upload className="h-4 w-4" /> Upload Document
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Upload Legal Document</DialogTitle>
              <DialogDescription>
                Paste the text content of your document for AI analysis and storage.
              </DialogDescription>
            </DialogHeader>
            <UploadDocumentForm onSuccess={() => setIsDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Search & Filter */}
      <div className="relative mb-8">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Search documents..." 
          className="pl-10 max-w-md bg-card border-border"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-48 bg-card rounded-xl border border-border/50 animate-pulse" />
          ))}
        </div>
      ) : filteredDocs && filteredDocs.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDocs.map(doc => (
            <div 
              key={doc.id} 
              className="bg-card rounded-xl border border-border shadow-sm hover:shadow-md hover:border-primary/50 transition-all p-5 flex flex-col group h-full"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                   <Calendar className="h-3 w-3" />
                   {format(new Date(doc.createdAt!), 'MMM d, yyyy')}
                </div>
              </div>
              
              <h3 className="font-heading font-semibold text-lg mb-2 line-clamp-1" title={doc.title}>
                {doc.title}
              </h3>
              
              <div className="flex-1">
                {doc.summary ? (
                  <p className="text-sm text-muted-foreground line-clamp-4 leading-relaxed">
                    {doc.summary}
                  </p>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-accent animate-pulse">
                    <Loader2 className="h-3 w-3 animate-spin" /> Generating AI summary...
                  </div>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-border/50 flex justify-between items-center">
                 <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded">
                   Legal Text
                 </span>
                 <Button variant="ghost" size="sm" className="h-8 text-primary hover:text-primary/80">
                   View Details
                 </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-card rounded-2xl border border-dashed border-border">
          <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <Upload className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-bold mb-2">No documents yet</h3>
          <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
            Upload contracts, agreements, or legal letters to get AI-powered summaries and insights.
          </p>
          <Button onClick={() => setIsDialogOpen(true)}>
            Upload Your First Document
          </Button>
        </div>
      )}
    </div>
  );
}

function UploadDocumentForm({ onSuccess }: { onSuccess: () => void }) {
  const createDocument = useCreateDocument();
  
  const form = useForm<InsertDocument>({
    resolver: zodResolver(insertDocumentSchema),
    defaultValues: {
      title: "",
      content: ""
    }
  });

  const onSubmit = (data: InsertDocument) => {
    createDocument.mutate(data, {
      onSuccess: () => {
        form.reset();
        onSuccess();
      }
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Document Title</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Non-Disclosure Agreement" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="content"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Content (Text)</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Paste document content here..." 
                  className="min-h-[200px] resize-none"
                  {...field} 
                  value={field.value || ""} // Handle potential null
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onSuccess}>Cancel</Button>
          <Button type="submit" disabled={createDocument.isPending}>
            {createDocument.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" /> Save Document
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
