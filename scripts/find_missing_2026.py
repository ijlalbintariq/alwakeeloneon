#!/usr/bin/env python3
"""
Find 2026 cases in legal_scraper_data/judgments.jsonl that are missing from the live DB,
then output them as a JSONL file ready for upload.
"""
import json
import re
import sys

JSONL_PATH = "/Users/macbook/Downloads/legal_scraper_data/judgments.jsonl"
EXISTING_PATH = "/Users/macbook/Downloads/Alwakeelo/scratch_existing_citations.json"
OUTPUT_PATH = "/Users/macbook/Downloads/Alwakeelo/missing_2026_cases.jsonl"

# Load existing citations from live DB
with open(EXISTING_PATH) as f:
    existing_citations = set(json.load(f))

print(f"Existing 2026 citations in live DB: {len(existing_citations)}")

# Journal code mapping from scraper format to DB format
JOURNAL_MAP = {
    "CLC": "CLC",
    "CLD": "CLD",
    "MLD": "MLD",
    "PCrLJ": "PCRLJ",
    "PLC": "PLC",
    "PLC(CS)": "PLC(CS)",
    "PLD": "PLD",
    "PTD": "PTD",
    "SCMR": "SCMR",
    "YLR": "YLR",
    "LHC": "LHC",
}

# Parse citation to extract page number
def parse_citation(citation_str):
    """Parse '2026 CLC 1' -> (2026, 'CLC', 1)"""
    m = re.match(r'(\d{4})\s+(.+?)\s+(\d+)', citation_str.strip())
    if m:
        return int(m.group(1)), m.group(2).strip(), int(m.group(3))
    return None, None, None

# Normalize citation to match DB format
def normalize_citation(citation_str, db_journal_code):
    """Rebuild citation in DB format: '2026 PCRLJ 123'"""
    year, _, page = parse_citation(citation_str)
    if year and page:
        return f"{year} {db_journal_code} {page}"
    return citation_str

missing = []
total_2026 = 0

with open(JSONL_PATH) as f:
    for line_num, line in enumerate(f, 1):
        try:
            data = json.loads(line)
        except:
            continue
        
        if data.get("year") != "2026":
            continue
        
        total_2026 += 1
        citation = data.get("citation", "")
        journal = data.get("journal", "")
        db_journal = JOURNAL_MAP.get(journal, journal)
        
        # Build the citation string as it would appear in the DB
        db_citation = normalize_citation(citation, db_journal)
        
        if db_citation not in existing_citations:
            missing.append({
                "case_name": data.get("case_name"),
                "citation": citation,
                "db_citation": db_citation,
                "title": data.get("title", ""),
                "court": data.get("court", ""),
                "year": "2026",
                "journal": journal,
                "db_journal": db_journal,
                "text": data.get("text", ""),
            })

print(f"Total 2026 cases in JSONL: {total_2026}")
print(f"Missing from live DB: {len(missing)}")

# Breakdown by journal
journal_counts = {}
for m in missing:
    j = m["db_journal"]
    journal_counts[j] = journal_counts.get(j, 0) + 1
print(f"\nMissing by journal:")
for j, c in sorted(journal_counts.items()):
    print(f"  {j}: {c}")

# Write missing cases to JSONL
with open(OUTPUT_PATH, 'w') as f:
    for m in missing:
        f.write(json.dumps(m) + "\n")

print(f"\nMissing cases written to: {OUTPUT_PATH}")
