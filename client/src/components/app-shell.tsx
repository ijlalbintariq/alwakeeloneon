import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  Scale, LayoutDashboard, Gavel, Book, FileText, Bookmark,
  History, FileBadge, Sparkles, Database, LogOut,
  User as UserIcon, Shield, Settings, Building2
} from "lucide-react";
import {
  SidebarProvider,
  Sidebar,
  SidebarRail,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
  SidebarFooter,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const NAVIGATION_ITEMS = [
  { id: "dashboard", label: "Chambers Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { id: "judgments", label: "Judgments", icon: Gavel, href: "/judgments" },
  { id: "statute-search", label: "Statute Search", icon: Book, href: "/statute-search" },
  { id: "al-wakeelo", label: "Al Wakeelo Engine", icon: Scale, href: "/al-wakeelo" },
  { id: "legal-drafting", label: "Legal Drafting", icon: FileText, href: "/legal-drafting" },
  { id: "contract-drafting", label: "Contract Drafting", icon: Sparkles, href: "/contract-drafting" },
  { id: "case-documents", label: "Case Documents", icon: FileBadge, href: "/case-documents" },
  { id: "bookmarks", label: "Bookmarks", icon: Bookmark, href: "/bookmarks" },
  { id: "history", label: "Search History", icon: History, href: "/history" },
  { id: "knowledge-vault", label: "Knowledge Vault", icon: Database, href: "/knowledge-vault" },
  { id: "organization", label: "Organization", icon: Building2, href: "/organization" },
];

function AppSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  return (
    <Sidebar className={cn(
      "bg-gradient-to-b from-[#131f33]/85 to-[#0d1627]/80 border-r border-[hsl(var(--preview-border))] backdrop-blur-xl",
      "app-sidebar mac-glass-panel"
    )}>
      <SidebarHeader className="p-3 border-b border-[hsl(var(--preview-border))]">
        <div className="rounded-2xl border border-[hsl(var(--preview-border))] bg-[#0f1a2d]/65 backdrop-blur-lg px-2.5 py-2.5 shadow-[0_18px_34px_-26px_rgba(0,0,0,0.9)]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 bg-gradient-to-br from-amber-300 to-amber-500 rounded-xl flex items-center justify-center text-slate-900 shadow-xl shadow-amber-500/30 flex-shrink-0">
              <Scale size={16} />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-white tracking-tighter uppercase italic leading-tight truncate" style={{ fontFamily: "'Playfair Display', serif" }}>
                Al Wakeelo
              </h1>
              <p className="text-[8px] uppercase tracking-[0.24em] text-slate-500 font-black">Legal Intelligence</p>
            </div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="scrollbar-hide px-1.5 py-2">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[8px] font-black uppercase tracking-[0.28em] text-slate-500 px-3 pb-1.5">
            Workspace
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {NAVIGATION_ITEMS.map((item) => {
                const Icon = item.icon;
                const isJudgmentsItem = item.id === "judgments";
                const isActive =
                  (isJudgmentsItem && location.startsWith("/judgments")) ||
                  location === item.href ||
                  (item.href === "/dashboard" && location === "/");
                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      data-testid={`nav-${item.id}`}
                      className={cn(
                        "nav-glow-button rounded-xl py-2.5 border border-transparent bg-transparent transition-all",
                        "hover:border-[hsl(var(--preview-border))] hover:bg-[#1a2740]/70",
                        isActive && "bg-gradient-to-r from-amber-300 to-amber-500 text-slate-950 font-black border-amber-300/40 shadow-[0_16px_30px_-24px_rgba(251,191,36,0.8)] data-[active=true]:bg-gradient-to-r data-[active=true]:from-amber-300 data-[active=true]:to-amber-500 data-[active=true]:text-slate-950"
                      )}
                    >
                      <Link href={item.href}>
                        <Icon size={16} className={isActive ? "text-slate-900" : "text-slate-400"} />
                        <span className="nav-label text-[9px] font-black uppercase tracking-[0.13em]">{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-[hsl(var(--preview-border))] p-3">
        <div className="mb-2.5 rounded-xl border border-[hsl(var(--preview-border))] bg-[#0f1a2d]/55 backdrop-blur-md px-2.5 py-2">
          <p className="text-[8px] uppercase tracking-[0.2em] text-slate-500 font-black">Signed in as</p>
          <p className="text-xs font-bold text-slate-200 truncate">{user?.email || "Advocate"}</p>
        </div>
        <SidebarMenu className="space-y-1">
          {user?.isAdmin && (
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={location === "/admin"}
                data-testid="nav-admin"
                className={cn(
                  "nav-glow-button rounded-xl py-2.5 border border-transparent transition-all",
                  "hover:border-[hsl(var(--preview-border))] hover:bg-[#1a2740]/70",
                  location === "/admin" && "bg-gradient-to-r from-amber-300 to-amber-500 text-slate-950 font-black border-amber-300/40 data-[active=true]:bg-gradient-to-r data-[active=true]:from-amber-300 data-[active=true]:to-amber-500 data-[active=true]:text-slate-950"
                )}
              >
                <Link href="/admin">
                  <Shield size={16} className={location === "/admin" ? "text-slate-900" : "text-slate-400"} />
                  <span className="nav-label text-[9px] font-black uppercase tracking-[0.13em]">Admin Panel</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={location === "/settings"}
              data-testid="nav-settings"
              className={cn(
                "nav-glow-button rounded-xl py-2.5 border border-transparent transition-all",
                "hover:border-[hsl(var(--preview-border))] hover:bg-[#1a2740]/70",
                location === "/settings" && "bg-gradient-to-r from-amber-300 to-amber-500 text-slate-950 font-black border-amber-300/40 data-[active=true]:bg-gradient-to-r data-[active=true]:from-amber-300 data-[active=true]:to-amber-500 data-[active=true]:text-slate-950"
              )}
            >
              <Link href="/settings">
                <Settings size={16} className={location === "/settings" ? "text-slate-900" : "text-slate-400"} />
                <span className="nav-label text-[9px] font-black uppercase tracking-[0.13em]">Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => logout()}
              data-testid="button-logout"
              className="nav-glow-button rounded-xl border border-transparent py-2.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/30 transition-all"
            >
              <LogOut size={16} />
              <span className="nav-label text-[9px] font-black uppercase tracking-[0.13em]">Exit Vault</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail
        data-testid="button-sidebar-minimize-line"
        className="hidden sm:flex after:bg-amber-400/45 hover:after:bg-amber-300"
      />
    </Sidebar>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [location] = useLocation();
  const isWideChatLayout =
    location === "/al-wakeelo" ||
    location === "/legal-drafting" ||
    location === "/contract-drafting" ||
    location === "/case-documents" ||
    location === "/knowledge-vault" ||
    location === "/organization";
  const isEdgeAttachedLayout = location === "/al-wakeelo";

  const style = {
    "--sidebar-width": "14.75rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className={cn(
        "flex h-[100dvh] md:h-screen w-full bg-[#0f172a] text-slate-200 font-sans selection:bg-amber-500/40",
        "app-ui-compact",
        "mac-app-shell"
      )}>
        <AppSidebar />

        <div className="flex flex-col flex-1 min-w-0">
          <header className={cn(
            "h-12 border-b border-[hsl(var(--preview-border))] bg-[#0f172a]/55 backdrop-blur-xl flex items-center justify-between px-2.5 md:px-3.5 gap-3 z-50 sticky top-0",
            "mac-glass-panel"
          )}>
            <SidebarTrigger data-testid="button-sidebar-toggle" className="text-slate-400 hover:text-white" />
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-[11px] font-black uppercase text-white tracking-wider" data-testid="text-username">
                  {user?.firstName || user?.email || "Advocate"}
                </p>
                <p className="text-[8px] font-black uppercase text-amber-500/70 tracking-[0.2em]">Counsel</p>
              </div>
              <div className="w-8 h-8 rounded-xl bg-[#131f33] border border-[hsl(var(--preview-border))] flex items-center justify-center text-slate-400 shadow-xl overflow-hidden" data-testid="img-avatar">
                {user?.profileImageUrl ? (
                  <img src={user.profileImageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <UserIcon size={14} />
                )}
              </div>
            </div>
          </header>

          <main className={cn(
            `flex-1 overflow-y-auto bg-[#0f172a]/65 backdrop-blur-lg scrollbar-hide ${
              isEdgeAttachedLayout
                ? "p-0"
                : isWideChatLayout
                  ? "p-1 sm:p-1.5 md:p-2.5"
                  : "p-1.5 sm:p-2 md:p-6"
            }`,
            "mac-main-layer"
          )}>
            <div className={`${isWideChatLayout ? "max-w-none" : "max-w-6xl"} mx-auto h-full w-full`}>
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
