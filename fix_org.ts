import fs from 'fs';

const filePath = './client/src/experimental/pages/PreviewOrganization.tsx';
let code = fs.readFileSync(filePath, 'utf-8');

// Replace handleRemoveMember
code = code.replace(/const handleRemoveMember = \(memberId: string\) => \{[\s\S]*?access credentials have been revoked\.",\n    \}\);\n  \};/m, 
`const handleRemoveMember = (memberId: string) => {
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
  };`);

// Replace handleConfirmReassign
code = code.replace(/const handleConfirmReassign = \(\) => \{[\s\S]*?setSelectedMatterForReassign\(null\);\n\n    toast\(\{[\s\S]*?\}\);\n  \};/m,
`const handleConfirmReassign = () => {
    if (!selectedMatterForReassign) return;
    reallocateMatterMutation.mutate({
      matterId: selectedMatterForReassign.id,
      leadId: reassignLeadId,
      assistingId: reassignAssistingId
    });
  };`);

fs.writeFileSync(filePath, code);
