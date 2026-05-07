import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  Scale, LayoutDashboard, Gavel, Book, FileText, Bookmark,
  History, FileBadge, Sparkles, Database, LogOut,
  User as UserIcon, Shield, Settings, Building2, Sun, Moon
} from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
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

type NavigationItem = {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  href: string;
};

type NavigationGroup = {
  id: string;
  label: string;
  items: NavigationItem[];
};

const NAVIGATION_GROUPS: NavigationGroup[] = [
  {
    id: "workspace",
    label: "Workspace",
    items: [
      {
        id: "dashboard",
        label: "Chambers Dashboard",
        description: "Overview and quick actions",
        icon: LayoutDashboard,
        href: "/dashboard",
      },
      {
        id: "al-wakeelo",
        label: "Al Wakeelo Engine",
        description: "Main legal AI workspace",
        icon: Scale,
        href: "/al-wakeelo",
      },
    ],
  },
  {
    id: "research",
    label: "Research",
    items: [
      {
        id: "judgments",
        label: "Judgments",
        description: "Case law search and citations",
        icon: Gavel,
        href: "/judgments",
      },
      {
        id: "statute-search",
        label: "Statute Search",
        description: "Browse laws and sections",
        icon: Book,
        href: "/statute-search",
      },
      {
        id: "knowledge-vault",
        label: "Knowledge Vault",
        description: "Your legal knowledge base",
        icon: Database,
        href: "/knowledge-vault",
      },
    ],
  },
  {
    id: "drafting",
    label: "Drafting",
    items: [
      {
        id: "legal-drafting",
        label: "Legal Drafting",
        description: "Court-ready litigation drafting",
        icon: FileText,
        href: "/legal-drafting",
      },
      {
        id: "contract-drafting",
        label: "Contract Drafting",
        description: "Contracts and clause workflows",
        icon: Sparkles,
        href: "/contract-drafting",
      },
    ],
  },
  {
    id: "records",
    label: "Records",
    items: [
      {
        id: "case-documents",
        label: "Case Documents",
        description: "Uploaded files and case records",
        icon: FileBadge,
        href: "/case-documents",
      },
      {
        id: "bookmarks",
        label: "Bookmarks",
        description: "Saved AI and research outputs",
        icon: Bookmark,
        href: "/bookmarks",
      },
      {
        id: "history",
        label: "Search History",
        description: "Recent legal queries",
        icon: History,
        href: "/history",
      },
      {
        id: "organization",
        label: "Organization",
        description: "Chamber collaboration settings",
        icon: Building2,
        href: "/organization",
      },
    ],
  },
];

function AppSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const tier = String(user?.subscriptionTier || "").toLowerCase();
  const canSeeOrganization = !!user && (user.isAdmin || tier === "chamber" || tier === "enterprise");
  const visibleNavigationGroups = NAVIGATION_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.id !== "organization" || canSeeOrganization),
  })).filter((group) => group.items.length > 0);

  return (
    <Sidebar className={cn(
      "bg-sidebar border-r border-sidebar-border",
      "app-sidebar"
    )}>
      <SidebarHeader className="p-2.5 border-b border-sidebar-border">
        <div className="rounded-xl border border-sidebar-border bg-sidebar px-2.5 py-2">
          <div className="flex items-center gap-3 min-w-0">
            {/* Brand mark — hardcoded gold accents on purpose. The logo is the
                product identity and must look the same regardless of light/dark
                theme. Do NOT swap these to bg-primary / border-primary. */}
            <div className="w-8 h-8 rounded-lg overflow-hidden border border-amber-400/40 shadow-lg shadow-amber-500/20 flex-shrink-0">
              <img src="/logo.svg" alt="Al Wakeelo logo" className="w-full h-full object-cover" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-sidebar-foreground tracking-tighter uppercase italic leading-tight truncate" style={{ fontFamily: "'Playfair Display', serif" }}>
                Al Wakeelo
              </h1>
              <p className="text-[7px] uppercase tracking-[0.24em] text-sidebar-foreground/60 font-black">Legal Intelligence</p>
            </div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="scrollbar-hide px-1.5 py-1">
        {visibleNavigationGroups.map((group) => (
          <SidebarGroup key={group.id} className="p-1.5 mb-1 last:mb-0">
            <SidebarGroupLabel className="h-5 px-2 pb-0.5 text-[7px] font-black uppercase tracking-[0.26em] text-sidebar-foreground/50">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {group.items.map((item) => {
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
                          "nav-glow-button h-auto rounded-lg border border-transparent px-1.5 py-1 transition-all",
                          "hover:border-sidebar-border hover:bg-sidebar-accent",
                          isActive &&
                            "border-sidebar-primary/35 bg-sidebar-accent text-sidebar-accent-foreground"
                        )}
                      >
                        <Link href={item.href} className="flex w-full items-center gap-2" title={item.description}>
                          <span
                            className={cn(
                              "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all",
                              isActive
                                ? "border-sidebar-primary/45 bg-sidebar-primary text-sidebar-primary-foreground"
                                : "border-sidebar-border bg-sidebar-accent text-sidebar-foreground/60"
                            )}
                          >
                            <Icon size={12} />
                          </span>
                          <span className="nav-label min-w-0 flex-1">
                            <span className={cn("block truncate text-[11px] font-semibold leading-tight", isActive ? "text-sidebar-foreground" : "text-sidebar-foreground/80")}>
                              {item.label}
                            </span>
                          </span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2.5">
        <div className="mb-2 rounded-lg border border-sidebar-border bg-sidebar px-2.5 py-1.5">
          <p className="text-[7px] uppercase tracking-[0.2em] text-sidebar-foreground/50 font-black">Signed in as</p>
          <p className="text-[11px] font-bold text-sidebar-foreground truncate">{user?.email || "Advocate"}</p>
        </div>
        <SidebarMenu className="gap-0.5">
          {user?.isAdmin && (
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={location === "/admin"}
                data-testid="nav-admin"
                className={cn(
                  "nav-glow-button rounded-lg py-1.5 border border-transparent transition-all",
                  "hover:border-sidebar-border hover:bg-sidebar-accent",
                  location === "/admin" && "bg-sidebar-primary text-sidebar-primary-foreground font-black border-sidebar-primary/40"
                )}
              >
                <Link href="/admin">
                  <Shield size={14} className={location === "/admin" ? "text-sidebar-primary-foreground" : "text-sidebar-foreground/60"} />
                  <span className="nav-label text-[10px] font-bold">Admin Panel</span>
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
                "nav-glow-button rounded-lg py-1.5 border border-transparent transition-all",
                "hover:border-sidebar-border hover:bg-sidebar-accent",
                location === "/settings" && "bg-sidebar-primary text-sidebar-primary-foreground font-black border-sidebar-primary/40"
              )}
            >
              <Link href="/settings">
                <Settings size={14} className={location === "/settings" ? "text-sidebar-primary-foreground" : "text-sidebar-foreground/60"} />
                <span className="nav-label text-[10px] font-bold">Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => logout()}
              data-testid="button-logout"
              className="nav-glow-button rounded-lg border border-transparent py-1.5 text-sidebar-foreground/60 hover:text-red-500 hover:bg-red-500/10 hover:border-red-500/20 transition-all"
            >
              <LogOut size={14} />
              <span className="nav-label text-[10px] font-bold">Exit Vault</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail
        data-testid="button-sidebar-minimize-line"
        className="hidden sm:flex after:bg-primary/45 hover:after:bg-primary"
      />
    </Sidebar>
  );
}

function ThemeToggleButton() {
  const { resolvedTheme, toggle } = useTheme();
  const isDark = resolvedTheme === "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      className="w-8 h-8 rounded-xl border border-[hsl(var(--preview-border))] bg-[hsl(var(--preview-surface-elevated))] hover:border-[hsl(var(--preview-border-active))] flex items-center justify-center text-[hsl(var(--preview-text-secondary))] hover:text-[hsl(var(--preview-text-primary))] transition-colors"
      data-testid="button-theme-toggle"
    >
      {isDark ? <Sun size={14} /> : <Moon size={14} />}
    </button>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [location] = useLocation();
  const isWideChatLayout =
    location === "/" ||
    location === "/dashboard" ||
    location === "/al-wakeelo" ||
    location === "/legal-drafting" ||
    location === "/contract-drafting" ||
    location === "/case-documents" ||
    location === "/organization" ||
    location.startsWith("/judgments") ||
    location.startsWith("/judgment") ||
    location.startsWith("/statute") ||
    location.startsWith("/knowledge-vault");
  const isEdgeAttachedLayout = location === "/al-wakeelo";

  const style = {
    "--sidebar-width": "14.5rem",
    "--sidebar-width-icon": "2.75rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className={cn(
        "flex h-[100dvh] md:h-screen w-full font-sans bg-background text-foreground selection:bg-primary/40",
        "app-ui-compact",
        "mac-app-shell"
      )}>
        <AppSidebar />

        <div className="flex flex-col flex-1 min-w-0">
          <header className={cn(
            "h-12 border-b border-[hsl(var(--preview-border))] bg-background/70 backdrop-blur-xl flex items-center justify-between px-2.5 md:px-3.5 gap-3 z-50 sticky top-0",
            "mac-glass-panel"
          )}>
            <SidebarTrigger data-testid="button-sidebar-toggle" className="text-muted-foreground hover:text-foreground" />
            <div className="flex items-center gap-4">
              <ThemeToggleButton />
              <div className="text-right hidden sm:block">
                <p className="text-[11px] font-black uppercase text-foreground tracking-wider" data-testid="text-username">
                  {user?.firstName || user?.email || "Advocate"}
                </p>
                <p className="text-[8px] font-black uppercase text-primary/70 tracking-[0.2em]">Counsel</p>
              </div>
              <div className="w-8 h-8 rounded-xl bg-card border border-[hsl(var(--preview-border))] flex items-center justify-center text-muted-foreground shadow-xl overflow-hidden" data-testid="img-avatar">
                {user?.profileImageUrl ? (
                  <img src={user.profileImageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <UserIcon size={14} />
                )}
              </div>
            </div>
          </header>

          <main className={cn(
            `flex-1 overflow-y-auto bg-background/80 backdrop-blur-lg scrollbar-hide ${
              isEdgeAttachedLayout
                ? "p-0"
                : isWideChatLayout
                  ? "p-1 sm:p-1.5 md:p-2.5"
                  : "p-2 sm:p-3 md:p-6"
            }`,
            "mac-main-layer"
          )}>
            <div className={cn(
              `${isWideChatLayout ? "max-w-none" : "max-w-6xl"} mx-auto h-full w-full`,
              "module-typography-harmony",
              !isWideChatLayout && "rounded-[1.75rem] border border-[hsl(var(--preview-border))] bg-[linear-gradient(180deg,hsl(var(--preview-surface-elevated))/0.55,hsl(var(--preview-surface))/0.45)] shadow-[0_24px_48px_-30px_rgba(2,6,23,0.95)] p-3 sm:p-4 md:p-6"
            )}>
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
