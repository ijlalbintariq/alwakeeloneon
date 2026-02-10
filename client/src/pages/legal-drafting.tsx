import { ChatModule } from "./chat";

export default function LegalDraftingPage() {
  return (
    <div className="fade-in" data-testid="legal-drafting-page">
      <ChatModule type="draft" title="Legal Drafting" />
    </div>
  );
}
