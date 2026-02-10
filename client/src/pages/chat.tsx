import { useState, useEffect, useRef } from "react";
import { useThreads, useThread, useCreateThread, useSendMessage, useDeleteThread } from "@/hooks/use-threads";
import { useLocation, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Send, 
  Bot, 
  User as UserIcon, 
  Plus, 
  MessageSquare, 
  MoreVertical, 
  Trash2,
  Loader2,
  AlertTriangle
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";

// Component for the chat interface
export default function ChatPage() {
  const [match, params] = useRoute("/chat/:id");
  const threadId = match && params?.id ? parseInt(params.id) : null;
  const [, setLocation] = useLocation();

  const { data: threads, isLoading: threadsLoading } = useThreads();
  const { data: threadData, isLoading: threadLoading } = useThread(threadId);
  
  const createThread = useCreateThread();
  const sendMessage = useSendMessage();
  const deleteThread = useDeleteThread();

  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [threadData?.messages, threadLoading]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const messageContent = input;
    setInput(""); // Optimistic clear

    if (!threadId) {
      // Create new thread
      createThread.mutate({ firstMessage: messageContent }, {
        onSuccess: (newThread) => {
          setLocation(`/chat/${newThread.id}`);
        }
      });
    } else {
      // Send to existing thread
      sendMessage.mutate({ threadId, message: messageContent });
    }
  };

  const handleDeleteThread = (id: number, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent navigation
    if (confirm("Are you sure you want to delete this conversation?")) {
      deleteThread.mutate(id, {
        onSuccess: () => {
          if (threadId === id) setLocation("/chat");
        }
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isPending = createThread.isPending || sendMessage.isPending;

  return (
    <div className="h-[calc(100vh-64px)] md:h-screen flex bg-background">
      {/* Sidebar - History */}
      <div className="w-80 border-r bg-card flex flex-col hidden md:flex">
        <div className="p-4 border-b">
          <Button 
            className="w-full justify-start gap-2 border-dashed border-2 bg-transparent hover:bg-accent/5 text-foreground hover:border-accent" 
            variant="outline"
            onClick={() => setLocation("/chat")}
          >
            <Plus className="h-4 w-4" /> New Consultation
          </Button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {threadsLoading ? (
            <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            threads?.map(thread => (
              <div 
                key={thread.id}
                onClick={() => setLocation(`/chat/${thread.id}`)}
                className={cn(
                  "group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors text-sm",
                  threadId === thread.id 
                    ? "bg-primary/10 text-primary font-medium" 
                    : "hover:bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                <div className="flex items-center gap-2 truncate">
                  <MessageSquare className="h-4 w-4 shrink-0" />
                  <span className="truncate">{thread.title}</span>
                </div>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100">
                      <MoreVertical className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem 
                      className="text-destructive focus:text-destructive"
                      onClick={(e) => handleDeleteThread(thread.id, e as any)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-background/50">
        {/* Chat Header */}
        <div className="h-16 border-b flex items-center px-6 justify-between bg-card/50 backdrop-blur-sm sticky top-0 z-10">
          <div>
            <h2 className="font-heading font-semibold text-lg">
              {threadData ? threadData.thread.title : "New Consultation"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {threadData ? `Started ${format(new Date(threadData.thread.createdAt!), 'MMM d, h:mm a')}` : "AI Legal Assistant"}
            </p>
          </div>
          
          <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-3 py-1.5 rounded-full border border-amber-200 dark:border-amber-800">
            <AlertTriangle className="h-3 w-3" />
            <span>Informational purposes only. Not legal advice.</span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
          {!threadId ? (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-50 p-8">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
                <Bot className="h-10 w-10 text-primary" />
              </div>
              <h3 className="font-heading text-2xl font-bold mb-2">How can I help you today?</h3>
              <p className="max-w-md">I can assist with legal research, document drafting, and explaining complex legal terms.</p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8 w-full max-w-2xl">
                {["Draft a Non-Disclosure Agreement", "Explain intellectual property rights", "What are the tenant rights in Dubai?", "Summarize a rental contract"].map(suggestion => (
                  <Button 
                    key={suggestion} 
                    variant="outline" 
                    className="h-auto py-3 px-4 text-left justify-start text-sm font-normal whitespace-normal"
                    onClick={() => setInput(suggestion)}
                  >
                    "{suggestion}"
                  </Button>
                ))}
              </div>
            </div>
          ) : threadLoading ? (
             <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
             </div>
          ) : (
            threadData?.messages.map((msg) => (
              <div 
                key={msg.id} 
                className={cn(
                  "flex gap-4 max-w-3xl mx-auto",
                  msg.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {msg.role === "assistant" && (
                  <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center shrink-0 mt-1">
                    <Bot className="h-5 w-5 text-primary-foreground" />
                  </div>
                )}
                
                <div 
                  className={cn(
                    "rounded-2xl px-5 py-3 shadow-sm text-sm md:text-base leading-relaxed whitespace-pre-wrap max-w-[85%]",
                    msg.role === "user" 
                      ? "bg-primary text-primary-foreground rounded-tr-sm" 
                      : "bg-card border border-border rounded-tl-sm text-foreground"
                  )}
                >
                  {msg.content}
                </div>

                {msg.role === "user" && (
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0 mt-1">
                    <UserIcon className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))
          )}
          
          {isPending && (
            <div className="flex gap-4 max-w-3xl mx-auto justify-start">
               <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center shrink-0 mt-1">
                 <Bot className="h-5 w-5 text-primary-foreground" />
               </div>
               <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-5 py-4 shadow-sm flex items-center gap-2">
                 <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }}/>
                 <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }}/>
                 <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }}/>
               </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-background border-t">
          <div className="max-w-3xl mx-auto relative flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a legal question..."
              className="pr-12 py-6 rounded-full shadow-sm border-muted-foreground/20 focus-visible:ring-primary/20"
              disabled={isPending}
            />
            <Button 
              size="icon" 
              className={cn(
                "absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full transition-all",
                input.trim() ? "bg-primary" : "bg-muted text-muted-foreground hover:bg-muted"
              )}
              onClick={handleSend}
              disabled={!input.trim() || isPending}
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-center text-[10px] text-muted-foreground mt-2">
            AI can make mistakes. Please verify important legal information.
          </p>
        </div>
      </div>
    </div>
  );
}
