#!/usr/bin/env bash
# HTTP sweep of every logged-in RAG endpoint the new preview UI calls.
#
# Usage:
#   1. Log into the app in your browser.
#   2. DevTools -> Application -> Cookies -> copy the value of connect.sid
#   3. ./scripts/rag-http-sweep.sh '<connect.sid value>' [base-url]
#
# Default base-url is http://localhost:5001 (the local dev server).
# Every call is one request. /api/ai/chat and /api/ai/drafting/generate
# call the LLM, so they cost credits and count against the account quota.

set -uo pipefail

SID="${1:?paste your connect.sid value as the first argument}"
BASE="${2:-http://localhost:5001}"
COOKIE="connect.sid=${SID}"
Q='What is the punishment for murder under section 302 PPC?'

hr() { printf '\n%s\n' "────────────────────────────────────────────────────────"; }

hr; echo "[1] /api/rag/ask        (PreviewChat: Vault Grounded)"
curl -s -w '\nHTTP %{http_code}  %{time_total}s\n' -X POST "$BASE/api/rag/ask" \
  -H 'Content-Type: application/json' --cookie "$COOKIE" \
  -d "{\"query\":\"$Q\"}" | head -c 1500

hr; echo "[2] /api/ai/chat        (PreviewChat + PreviewDocumentAnalyzer)"
curl -s -w '\nHTTP %{http_code}  %{time_total}s\n' -X POST "$BASE/api/ai/chat" \
  -H 'Content-Type: application/json' --cookie "$COOKIE" \
  -d "{\"messages\":[{\"role\":\"user\",\"content\":\"$Q\"}],\"type\":\"al-wakeelo\",\"moduleIntent\":\"chat.general\",\"stream\":false}" | head -c 2000

hr; echo "[3] /api/statutes?q=    (PreviewStatutes / statute lookup fix)"
curl -s -w '\nHTTP %{http_code}  %{time_total}s\n' --cookie "$COOKIE" \
  "$BASE/api/statutes?q=$(printf '%s' "$Q" | sed 's/ /%20/g; s/?//g')" | head -c 900

hr; echo "[4] /api/documents      (PreviewKnowledgeVault: list before indexing)"
curl -s -w '\nHTTP %{http_code}  %{time_total}s\n' --cookie "$COOKIE" \
  "$BASE/api/documents" | head -c 600

hr; echo "[5] /api/ai/drafting/generate  (PreviewDrafting)"
curl -s -w '\nHTTP %{http_code}  %{time_total}s\n' -X POST "$BASE/api/ai/drafting/generate" \
  -H 'Content-Type: application/json' --cookie "$COOKIE" \
  -d '{"prompt":"bail application under section 497 CrPC","documentType":"application"}' | head -c 1200

hr; echo "done"
