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
  { id: "judgment-search", label: "Judgment Search", icon: Gavel, href: "/judgment-search" },
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
    <Sidebar className="bg-[#1e293b] border-r border-slate-800">
      <SidebarHeader className="p-4 border-b border-slate-800/50">
        <div className="flex items-center gap-3 px-2">
          <div className="w-9 h-9 bg-amber-500 rounded-xl flex items-center justify-center text-slate-900 shadow-xl shadow-amber-500/20 flex-shrink-0">
            <Scale size={18} />
          </div>
          <h1 className="text-lg font-bold text-white tracking-tighter uppercase italic" style={{ fontFamily: "'Playfair Display', serif" }}>
            Al Wakeelo
          </h1>
        </div>
      </SidebarHeader>

      <SidebarContent className="scrollbar-hide">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-600 px-4">
            Modules
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAVIGATION_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = location === item.href || (item.href === "/dashboard" && location === "/");
                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      data-testid={`nav-${item.id}`}
                      className={cn(
                        "rounded-xl py-3 transition-all",
                        isActive && "bg-amber-500 text-slate-950 font-black data-[active=true]:bg-amber-500 data-[active=true]:text-slate-950"
                      )}
                    >
                      <Link href={item.href}>
                        <Icon size={18} className={isActive ? "text-slate-950" : "text-slate-500"} />
                        <span className="text-[10px] uppercase tracking-widest">{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-slate-800/50 p-4">
        <SidebarMenu>
          {user?.isAdmin && (
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={location === "/admin"}
                data-testid="nav-admin"
                className={cn(
                  "rounded-xl py-3 transition-all",
                  location === "/admin" && "bg-amber-500 text-slate-950 font-black data-[active=true]:bg-amber-500 data-[active=true]:text-slate-950"
                )}
              >
                <Link href="/admin">
                  <Shield size={18} className={location === "/admin" ? "text-slate-950" : "text-slate-500"} />
                  <span className="text-[10px] uppercase tracking-widest">Admin Panel</span>
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
                "rounded-xl py-3 transition-all",
                location === "/settings" && "bg-amber-500 text-slate-950 font-black data-[active=true]:bg-amber-500 data-[active=true]:text-slate-950"
              )}
            >
              <Link href="/settings">
                <Settings size={18} className={location === "/settings" ? "text-slate-950" : "text-slate-500"} />
                <span className="text-[10px] uppercase tracking-widest">Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => logout()}
              data-testid="button-logout"
              className="rounded-xl text-slate-500 hover:text-red-500 hover:bg-red-500/5"
            >
              <LogOut size={18} />
              <span className="text-[10px] font-black uppercase tracking-widest">Exit Vault</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  const style = {
    "--sidebar-width": "18rem",
    "--sidebar-width-icon": "3.5rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full bg-[#0f172a] text-slate-200 font-sans selection:bg-amber-500/40">
        <AppSidebar />

        <div className="flex flex-col flex-1 min-w-0">
          <header className="h-14 border-b border-slate-800 bg-[#0f172a]/50 flex items-center justify-between px-4 gap-4 z-50 sticky top-0">
            <SidebarTrigger data-testid="button-sidebar-toggle" className="text-slate-500 hover:text-white" />
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-black uppercase text-white tracking-widest" data-testid="text-username">
                  {user?.firstName || user?.email || "Advocate"}
                </p>
                <p className="text-[8px] font-black uppercase text-amber-500/60 tracking-[0.2em]">Counsel</p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 shadow-xl overflow-hidden" data-testid="img-avatar">
                {user?.profileImageUrl ? (
                  <img src={user.profileImageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <UserIcon size={16} />
                )}
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-6 md:p-10 bg-[#0f172a] scrollbar-hide">
            <div className="max-w-7xl mx-auto h-full">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
