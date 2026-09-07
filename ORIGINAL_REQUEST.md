# Original User Request

## 2026-08-29T00:02:18Z

# Teamwork Project Prompt — Draft

> Status: Launched
> Goal: Craft prompt → get user approval → delegate to teamwork_preview
> Requested team: Full Agent Team

Comprehensive audit, testing, and bug-fixing of all Al Wakeelo experimental preview modules to ensure end-to-end functionality, dual database connectivity (Postgres & Vector), and production-readiness through automated testing.

Working directory: /Users/macbook/Downloads/Alwakeelo
Integrity mode: development

## Requirements

### R1. Comprehensive Module Audit & Remediation
Audit all UI components and logic flows within the experimental preview application (`client/src/experimental/*`). Identify and resolve any broken features, layout anomalies, or failing interactions to ensure a polished user experience.

### R2. End-to-End Database Integration
Ensure all experimental modules are fully wired to the backend architecture. Migrate any temporary `localStorage` or mock states to the live PostgreSQL database (via Drizzle ORM). Ensure that AI-driven features correctly interact with the vector database for RAG retrieval.

### R3. Automated Verification Suite
Develop an automated test suite to objectively verify the core workflows of the experimental application. The tests must confirm that the modules are stable and production-ready.

## Acceptance Criteria

### Audit & Remediation
- [ ] All pages under the `/preview/*` routes render cleanly without React hydration errors or console warnings.
- [ ] Core module functions (e.g., Document Analyzer deep scan, Chat Inspector, Drafting Studio) execute completely without silent failures.

### Database Connectivity
- [ ] Experimental modules perform real CRUD operations against the Postgres database (e.g., saving bookmarks, retrieving case files, managing organizations).
- [ ] RAG workflows successfully extract and query the vector database for legal context.

### Verification
- [ ] The newly created automated test suite executes successfully and passes, confirming the stability of the audited modules.
