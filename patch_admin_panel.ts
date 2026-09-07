import fs from 'fs';

const filePath = 'client/src/experimental/pages/PreviewAdminPanel.tsx';
let code = fs.readFileSync(filePath, 'utf-8');

// Add imports
if (!code.includes('@tanstack/react-query')) {
  code = code.replace(
    'import { PreviewShell } from "@/experimental/components/PreviewShell";',
    `import { PreviewShell } from "@/experimental/components/PreviewShell";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";`
  );
}
if (!code.includes('Trash2')) {
  code = code.replace('AlertTriangle,', 'AlertTriangle,\n  Trash2,\n  Ban,\n  Clock,');
}

// Add types
const typeInjection = `
interface AdminUser {
  id: string;
  email: string;
  username: string;
  firstName?: string;
  lastName?: string;
  tier?: string;
  isAdmin?: boolean;
  isBanned?: boolean;
  createdAt: string;
}

interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resource: string;
  createdAt: string;
}
`;
if (!code.includes('interface AdminUser')) {
  code = code.replace('interface AdminStats {', typeInjection + '\ninterface AdminStats {');
}

// Add state and queries to component
const stateInjection = `  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: usersData, isLoading: loadingUsers } = useQuery<AdminUser[]>({
    queryKey: ["/api/admin/users"],
    enabled: activeTab === "users"
  });

  const { data: logsData, isLoading: loadingLogs } = useQuery<AuditLog[]>({
    queryKey: ["/api/admin/audit-logs"],
    enabled: activeTab === "telemetry"
  });

  const resetQuotaMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiRequest("POST", \`/api/admin/users/\${userId}/reset-monthly-quota\`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Monthly quota reset successfully." });
    }
  });`;

if (!code.includes('const queryClient = useQueryClient();')) {
  code = code.replace(
    'const [error, setError] = useState<string | null>(null);',
    'const [error, setError] = useState<string | null>(null);\n' + stateInjection
  );
}

// Replace the Main Content Area
const oldMainContent = `{/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <Server size={16} className="text-[#105B38]" /> System Health &amp; Platform Services
            </h3>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
              Operational
            </span>
          </div>

          <div className="space-y-3 pt-2">
            {[
              { service: "Pakistani Precedent Vector Store (pgvector)", status: "Active", capacity: \`\${formatNumber(stats?.totalJudgments)} judgments\` },
              { service: "Statutory Compendium Lookup Engine", status: "Active", capacity: \`\${formatNumber(stats?.totalStatutes)} sections\` },
              { service: "Official Microsoft Word Add-in Gateway", status: "Active", capacity: "Multi-tenant" },
              { service: "MCP External SSE / Stream Bridge (Claude & ChatGPT)", status: "Active", capacity: "API Key Authenticated" },
            ].map((srv, idx) => (
              <div key={idx} className="p-3 rounded-xl border border-border bg-background flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 font-medium text-foreground">
                  <CheckCircle2 size={14} className="text-[#105B38]" />
                  <span>{srv.service}</span>
                </div>
                <div className="flex items-center gap-4 text-muted-foreground text-[11px]">
                  <span>Status: <strong className="text-foreground">{srv.status}</strong></span>
                  <span>Cap: <strong className="text-foreground">{srv.capacity}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <Lock size={16} className="text-[#105B38]" /> Security &amp; Compliance
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            All database transactions and advocate work product are isolated under PECA 2016 and advocate-client privilege protocols.
          </p>

          <div className="space-y-2.5 pt-2">
            <div className="p-3 rounded-xl border border-border bg-background text-xs space-y-1">
              <div className="font-bold text-foreground">Multi-Factor Authentication</div>
              <div className="text-[11px] text-muted-foreground">Enforced for chamber administrators</div>
            </div>
            <div className="p-3 rounded-xl border border-border bg-background text-xs space-y-1">
              <div className="font-bold text-foreground">Strict Production Isolation</div>
              <div className="text-[11px] text-muted-foreground">0 cross-talk between preview sandbox &amp; production</div>
            </div>
            <div className="p-3 rounded-xl border border-border bg-background text-xs space-y-1">
              <div className="font-bold text-foreground">Bar Council Audit Trail</div>
              <div className="text-[11px] text-muted-foreground">Verification logging active</div>
            </div>
          </div>
        </div>
      </div>`;

const newMainContent = `{/* Main Content Area */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4">
          <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Server size={16} className="text-[#105B38]" /> System Health &amp; Platform Services
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                Operational
              </span>
            </div>

            <div className="space-y-3 pt-2">
              {[
                { service: "Pakistani Precedent Vector Store (pgvector)", status: "Active", capacity: \`\${formatNumber(stats?.totalJudgments)} judgments\` },
                { service: "Statutory Compendium Lookup Engine", status: "Active", capacity: \`\${formatNumber(stats?.totalStatutes)} sections\` },
                { service: "Official Microsoft Word Add-in Gateway", status: "Active", capacity: "Multi-tenant" },
                { service: "MCP External SSE / Stream Bridge (Claude & ChatGPT)", status: "Active", capacity: "API Key Authenticated" },
              ].map((srv, idx) => (
                <div key={idx} className="p-3 rounded-xl border border-border bg-background flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 font-medium text-foreground">
                    <CheckCircle2 size={14} className="text-[#105B38]" />
                    <span>{srv.service}</span>
                  </div>
                  <div className="flex items-center gap-4 text-muted-foreground text-[11px]">
                    <span>Status: <strong className="text-foreground">{srv.status}</strong></span>
                    <span>Cap: <strong className="text-foreground">{srv.capacity}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <Lock size={16} className="text-[#105B38]" /> Security &amp; Compliance
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              All database transactions and advocate work product are isolated under PECA 2016 and advocate-client privilege protocols.
            </p>

            <div className="space-y-2.5 pt-2">
              <div className="p-3 rounded-xl border border-border bg-background text-xs space-y-1">
                <div className="font-bold text-foreground">Multi-Factor Authentication</div>
                <div className="text-[11px] text-muted-foreground">Enforced for chamber administrators</div>
              </div>
              <div className="p-3 rounded-xl border border-border bg-background text-xs space-y-1">
                <div className="font-bold text-foreground">Strict Production Isolation</div>
                <div className="text-[11px] text-muted-foreground">0 cross-talk between preview sandbox &amp; production</div>
              </div>
              <div className="p-3 rounded-xl border border-border bg-background text-xs space-y-1">
                <div className="font-bold text-foreground">Bar Council Audit Trail</div>
                <div className="text-[11px] text-muted-foreground">Verification logging active</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "users" && (
        <div className="mt-4 rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border bg-muted/20 flex justify-between items-center">
            <h3 className="font-bold text-sm flex items-center gap-2"><Users size={16} /> Advocates & Chambers Directory</h3>
            <span className="text-xs text-muted-foreground">{usersData?.length || 0} Registered Users</span>
          </div>
          <div className="overflow-x-auto">
            {loadingUsers ? (
              <div className="p-10 flex justify-center text-muted-foreground"><Loader2 className="animate-spin" /></div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="p-3 font-medium text-muted-foreground">User</th>
                    <th className="p-3 font-medium text-muted-foreground">Tier</th>
                    <th className="p-3 font-medium text-muted-foreground">Role</th>
                    <th className="p-3 font-medium text-muted-foreground">Joined</th>
                    <th className="p-3 font-medium text-muted-foreground text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {usersData?.map(u => (
                    <tr key={u.id} className="hover:bg-muted/20 transition-colors">
                      <td className="p-3">
                        <div className="font-bold text-foreground">{u.firstName} {u.lastName}</div>
                        <div className="text-muted-foreground text-[11px]">{u.email}</div>
                      </td>
                      <td className="p-3 uppercase text-[10px] font-black tracking-wider text-[#105B38]">{u.tier || "FREE"}</td>
                      <td className="p-3">
                        {u.isAdmin ? <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">Admin</span> : "User"}
                      </td>
                      <td className="p-3 text-muted-foreground">{new Date(u.createdAt).toLocaleDateString()}</td>
                      <td className="p-3 text-right space-x-2">
                         <button 
                            onClick={() => resetQuotaMutation.mutate(u.id)}
                            disabled={resetQuotaMutation.isPending}
                            className="px-2 py-1 bg-secondary text-secondary-foreground rounded text-[10px] hover:bg-secondary/80"
                          >
                            Reset Quota
                         </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {activeTab === "telemetry" && (
        <div className="mt-4 rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border bg-muted/20 flex justify-between items-center">
            <h3 className="font-bold text-sm flex items-center gap-2"><Activity size={16} /> Audit & Telemetry Logs</h3>
          </div>
          <div className="overflow-x-auto">
            {loadingLogs ? (
              <div className="p-10 flex justify-center text-muted-foreground"><Loader2 className="animate-spin" /></div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="p-3 font-medium text-muted-foreground">Time</th>
                    <th className="p-3 font-medium text-muted-foreground">Action</th>
                    <th className="p-3 font-medium text-muted-foreground">Resource</th>
                    <th className="p-3 font-medium text-muted-foreground">User ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {logsData?.slice(0, 50).map(log => (
                    <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                      <td className="p-3 text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</td>
                      <td className="p-3 font-mono text-[10px] bg-muted/30 px-2 rounded">{log.action}</td>
                      <td className="p-3 text-muted-foreground truncate max-w-[200px]">{log.resource}</td>
                      <td className="p-3 font-mono text-[10px]">{log.userId?.slice(0, 8)}...</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {activeTab === "caselaw" && (
        <div className="mt-4 p-10 rounded-2xl border border-border bg-card flex flex-col items-center justify-center text-center space-y-4">
          <Database size={48} className="text-[#105B38]/20" />
          <div className="space-y-1">
            <h3 className="font-bold text-lg text-foreground">Judgment Corpus Browser</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              You have {formatNumber(stats?.totalJudgments)} active judgments in the database. Use the live Library module to search, filter, and audit the primary citations.
            </p>
          </div>
          <button className="px-4 py-2 bg-[#105B38] text-white rounded-xl text-sm font-bold shadow-md shadow-[#105B38]/20 hover:bg-[#0D4A2E] transition-colors" onClick={() => window.location.href='/preview/judgments'}>
            Open Library Sandbox
          </button>
        </div>
      )}`;

if (code.includes('const [activeTab, setActiveTab]')) {
  code = code.replace(oldMainContent, newMainContent);
}

fs.writeFileSync(filePath, code);
