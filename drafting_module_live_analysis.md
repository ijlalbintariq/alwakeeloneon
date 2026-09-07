
## 6. Second Pass Live Testing (Test Run 2)

After applying the fixes for the initial 5 bugs, a second test pass was executed. The test confirmed fixes for the ````references```` tag leak (Bug 1), the clarification fallback loop (Bug 2), Tiptap duplicate extension registration (Bug 3), and Court Fee calculation wording (Bug 4). 

However, the second pass uncovered two new critical issues:

### 🔴 Bug 6: AI Chat Raw JSON Dump on Rate Limit (Frontend)
- **Location:** `client/src/experimental/components/drafting/RightDraftingSidebar.tsx`
- **The Issue:** When a free-tier user reaches their draft generation limit, the backend correctly responds with HTTP 429. However, the frontend `fetch` handler treats this non-200 status as a generic exception and dumps the raw JSON payload directly into the chat drawer: `⚠️ 429: {"message":"Your free-tier legal draft limit of 1 has been used...`.
- **Consequence:** Identical in root cause to the previous 422 error dump, exposing raw backend JSON to the end-user rather than rendering a styled warning card with an upgrade CTA.

### 🔴 Bug 7: Section-Edit Overgeneration / Document Duplication (Backend/LLM)
- **Location:** `server/routes.ts` (LLM `section-edit` targeted update logic)
- **The Issue:** When the Risk Scanner triggers a "Draft Fix" via `applyRiskFixViaAI(prompt)`, the backend correctly classifies the operation as a `section-edit` and targets the specific section (e.g., `GROUNDS`). The AI prompt explicitly demands: "Edit ONLY the identified target... Keep all other draft text unchanged."
- **The LLM Failure:** The AI successfully rewrites the `GROUNDS` section, but ignores the instruction to stop there. It continues hallucinating the rest of the document (PRAYER, Verification, Signatures) inside its "replacement text". 
- **The Pipeline Failure:** The backend blindly applies this overgenerated replacement back into the original document (`patched = applyLegalDraftEdit`).
- **Consequence:** The final patched draft returned to the user contains duplicated trailing sections (e.g., the original prayer and signatures, preceded immediately by the newly hallucinated prayer and signatures).
