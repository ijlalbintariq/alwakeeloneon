# Alwakeelo AI Engine audit — 31 October 2026

Scope: the current direct-chat module (`PreviewChat`), its composer, consultation history, reference cards and inspector, plus the shared chat, Vault and turn-persistence endpoints it calls. Existing drafting and precedent-graph changes are preserved. All work remains local.

## Fixed defects

| Area | Defect and resulting behavior |
| --- | --- |
| Conversation switching | Starting a new chat, loading another thread, or leaving the page did not reliably cancel generation. Responses could populate the wrong conversation. Abort signals and conversation identities now guard both standard and Vault requests, history loads, and late save responses. |
| Turn ownership | Saving read the active thread at completion instead of using the conversation that started the request. Each turn now saves against its original thread, and a late newly-created thread ID cannot replace a newer selection. |
| History restoration | A saved thread could race an explicit thread link, and query refreshes could reopen an old consultation after New Chat. Restoration runs once per account, explicit links take priority, and active-thread storage is account-specific and tolerates storage denial. |
| Deep links | History and command-palette links supplied `q` or `prompt`, but chat ignored them. They now prefill the composer without sending automatically, including links received while mounted. Consumed parameters are removed while preserving the current path, unrelated parameters and hash. |
| Stream framing | The parser required a space after `data:`, dropped unterminated final events, and did not reliably release a connection at the completion marker. The small SSE reader handles fragmented UTF-8, CRLF, multiline data, terminal events and reader cleanup. |
| Stream failures | Partial text could hide stream errors and be silently saved as a complete answer. Explicit errors and missing completion markers now remain visible, preserve partial output for copying, and prevent successful-turn persistence. Provider warnings that accompany completion are attached to the saved answer, so reload does not remove the warning. Empty answers restore the prompt and selected files for retry. |
| Status indicators | Search/thinking indicators could survive a failed or stopped request. Completion and cancellation now clear them without allowing an older request to clear a newer request's state. |
| Save failures | Failed autosaves were only logged. They now leave the answer visible, show an unsaved status and retry action, and hold further sends until the save succeeds or the user changes consultation. Retrying a save does not call the AI again. Sharing waits for the save and reports errors. |
| Database turn writes | Thread creation, user text and assistant text were separate writes. They now run in one database transaction, with an ownership check and row lock for an existing thread. Missing/deleted threads return 404 instead of silently recreating a thread. History orders equal timestamps by message ID to retain user/assistant order after a batch insert. |
| Structured references | Cleaning the answer before persistence discarded statutory reference data. Raw reference blocks now survive persistence and reload; cleaning applies to display. References without court metadata no longer acquire an invented Supreme Court label. |
| Attachments | The server returned embedded attachment content but chat discarded it, so follow-up questions and saved history lost the document text. Chat now retains that content in context and persistence, while showing the original prompt in the bubble and consultation title. JSON and cached server responses now supply it too. |
| Vault context | The current question was included in conversation history as well as the query. History now contains prior turns only. Source titles, document IDs and excerpts survive saving as a readable source section. |
| Vault scope | Selecting an unavailable or empty case file silently broadened retrieval. Such scopes now return an explicit error before charging usage. Lazy indexing and subsequent retrieval retain the selected case's document IDs. |
| Vault deadline | The eight-second timeout was created only after the judgment search had resolved. The existing deadline helper now bounds the wait while the search is pending. |
| Voice input | Manual transcription returned text without inserting it into the prompt. Both manual and automatic transcription now insert into the originating consultation; results from a previous consultation are ignored. Cancelling aborts pending transcription and immediately releases the composer. Recording sessions isolate late microphone permission and stop callbacks; failed starts release the microphone. Recording errors surface through the existing toast. |
| Reference indicators | All retrieved precedents could be marked AI Cited, and the latest turn's citation set was applied to older answers. Each answer now derives that badge from its own visible prose. Model-supplied reference blocks use a referenced label; the verified-database label is reserved for the server's retrieved card event. PLD citations appear in the inspector through the shared citation extractor. |
| Composer and history controls | Enter could submit during IME composition or bypass the disabled state. Those cases are now guarded. The mobile textarea can shrink within the viewport, history search trims whitespace, history entries support keyboard activation, and delete controls are available on touch and keyboard focus. |
| Clipboard and actions | Copy/bookmark/share/delete failures could disappear into logs or create unhandled rejections. The relevant actions now show an error. Share requests cannot overlap; sharing is disabled while generating, saving, or reporting an unsaved turn. |
| API validation and streamed errors | Chat now validates message shape and requires a final user message before consuming quota. Errors after SSE headers are sent return a stream error and close the response instead of attempting a second HTTP response. |

No dependencies or database schema migrations were added.

## Validation

- **23 unit checks passed**, including the new stream and registered-route regressions, existing transcription tests and citation-scrubbing tests. No failures or skips.
- **22 Chrome browser checks passed** against the local chat UI. The two voice cases were rerun after the final shared-hook correction; the strengthened automatic-transcription check first reproduced the disabled-composer defect before that correction.
- TypeScript (`npm run check`) passed.
- The production frontend build passed (`vite build --outDir /tmp/alwakeelo-chat-build`). Existing chunk-size and outdated Browserslist-data warnings remain.
- The production server bundle passed using esbuild with external packages and the production environment definition.
- The 390 × 844 mobile composer screenshot was visually inspected.
- `git diff --check` passed.

Regression files:

- `tests/unit/ai-engine-regressions.test.ts`
- `playwright-tests/ai-engine-regressions.spec.ts`

The browser suite runs with `CHAT_TEST_BASE_URL` and installed Chrome. Registered-route unit tests execute the actual handler source with injected dependencies rather than starting production services.

## Limits

Browser/API responses, transcription and persistence are synthetic in this audit; server route tests inject database/storage dependencies. Actual model availability, answer correctness, production retrieval data, microphone hardware, and PostgreSQL behavior under concurrency still require integration validation. The deadline bounds request waiting and does not cancel the underlying optional search. A save retry after a lost success response can still duplicate a turn; schema-level request idempotency was not added.

The older standalone chat implementation and other AI tools were checked for compatibility with the shared endpoint's final-user-message requirement, but were not otherwise audited here. No live customer records were changed. Nothing was committed, pushed or deployed, and this report does not certify the application as bug-free.
