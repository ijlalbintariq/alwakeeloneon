import fs from 'fs';

const filePath = './client/src/experimental/pages/PreviewOrganization.tsx';
let code = fs.readFileSync(filePath, 'utf-8');

// Add react-query imports
if (!code.includes('useMutation')) {
  code = code.replace(
    `import React, { useState, useEffect } from "react";`,
    `import React, { useState, useEffect } from "react";\nimport { useMutation, useQueryClient } from "@tanstack/react-query";\nimport { apiRequest } from "@/lib/queryClient";`
  );
}

// Locate PreviewOrganization body
const hooksTarget = `  // Chamber Organization State`;
const newHooks = `  const queryClient = useQueryClient();
  const [orgId, setOrgId] = useState<string | number | null>(null);

  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      if (!orgId) throw new Error("No organization ID");
      await apiRequest("DELETE", \`/api/org/\${orgId}/members/\${memberId}\`);
    },
    onSuccess: (_, memberId) => {
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
      toast({
        title: "Counsel Removed",
        description: "Access credentials have been revoked.",
      });
    }
  });

  const reallocateMatterMutation = useMutation({
    mutationFn: async (vars: { matterId: string, leadId: string, assistingId: string }) => {
      await apiRequest("PATCH", \`/api/case-files/\${vars.matterId}\`, {
        leadCounselId: vars.leadId,
        assistingCounselId: vars.assistingId,
      });
    },
    onSuccess: (_, vars) => {
      setMatters((prev) => prev.map((mat) => {
        if (mat.id === vars.matterId) {
          return {
            ...mat,
            leadCounselId: vars.leadId,
            assistingCounselId: vars.assistingId,
          };
        }
        return mat;
      }));
      setSelectedMatterForReassign(null);
      toast({
        title: "Matter Reassigned",
        description: "The counsel allocation has been updated.",
      });
    }
  });

  // Chamber Organization State`;

code = code.replace(hooksTarget, newHooks);

// Fix the fetch logic to save orgId
const fetchTarget = `const orgId = orgs[0].id;`;
const fetchNew = `const orgId = orgs[0].id;\n            setOrgId(orgId);`;
code = code.replace(fetchTarget, fetchNew);

// Fix the case-files fetch mapping to use real fields
const cfTarget = `                leadCounselId: "1",
                assistingCounselId: "2",`;
const cfNew = `                leadCounselId: cf.leadCounselId || "1",
                assistingCounselId: cf.assistingCounselId || "2",`;
code = code.replace(cfTarget, cfNew);

// Fix handleRemoveMember
const removeMemberTarget = `  const handleRemoveMember = (memberId: string) => {
    const targetMember = members.find((m) => m.id === memberId);
    if (!targetMember) return;

    if (targetMember.role === "Senior Partner") {
      toast({
        title: "Action Forbidden",
        description: "Senior Managing Partner profile cannot be removed from Chambers roster.",
      });
      return;
    }

    const updatedMembers = members.filter((m) => m.id !== memberId);
    const newLog: ChamberActivityLog = {
      id: "act-" + Date.now(),
      memberId: "admin",
      memberName: "System Admin",
      action: "Revoked roster access for " + targetMember.name,
      matterRef: "Chambers Internal",
      timestamp: "Just now",
      category: "Security",
    };

    syncData(updatedMembers, matters, [newLog, ...activity]);

    toast({
      title: "Counsel Removed from Chambers",
      description: targetMember.name + " access credentials have been revoked.",
    });
  };`;

const removeMemberNew = `  const handleRemoveMember = (memberId: string) => {
    const targetMember = members.find((m) => m.id === memberId);
    if (!targetMember) return;

    if (targetMember.role === "Senior Partner") {
      toast({
        title: "Action Forbidden",
        description: "Senior Managing Partner profile cannot be removed from Chambers roster.",
      });
      return;
    }
    
    removeMemberMutation.mutate(memberId);
  };`;
code = code.replace(removeMemberTarget, removeMemberNew);

// Fix handleConfirmReassign
const reassignTarget = `  const handleConfirmReassign = () => {
    if (!selectedMatterForReassign) return;

    const matterId = selectedMatterForReassign.id;
    const updatedMatters = matters.map((mat) => {
      if (mat.id === matterId) {
        return {
          ...mat,
          leadCounselId: reassignLeadId,
          assistingCounselId: reassignAssistingId,
        };
      }
      return mat;
    });

    const lead = members.find((m) => m.id === reassignLeadId);
    const newLog: ChamberActivityLog = {
      id: "act-" + Date.now(),
      memberId: reassignLeadId,
      memberName: lead ? lead.name : "Counsel",
      action: "Reassigned as Lead Counsel for " + selectedMatterForReassign.ref,
      matterRef: selectedMatterForReassign.ref,
      timestamp: "Just now",
      category: "Hearing",
    };

    syncData(members, updatedMatters, [newLog, ...activity]);
    setSelectedMatterForReassign(null);

    toast({
      title: "Matter Reassignment Confirmed",
      description: "Counsel allocation updated successfully.",
    });
  };`;

const reassignNew = `  const handleConfirmReassign = () => {
    if (!selectedMatterForReassign) return;
    reallocateMatterMutation.mutate({
      matterId: selectedMatterForReassign.id,
      leadId: reassignLeadId,
      assistingId: reassignAssistingId
    });
  };`;
code = code.replace(reassignTarget, reassignNew);

fs.writeFileSync(filePath, code);
