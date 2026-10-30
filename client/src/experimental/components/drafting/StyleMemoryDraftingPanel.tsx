import { StyleMemoryPanel } from "@/components/style-memory-panel";

// Use the same persisted settings, scoped sample API and upload pipeline as the
// other drafting workspace. Local-only controls silently left generation unchanged.
export function StyleMemoryDraftingPanel({ className = "" }: { className?: string }) {
  return <StyleMemoryPanel module="legal-drafting" className={className} />;
}
