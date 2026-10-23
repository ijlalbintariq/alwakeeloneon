import sqlite3
import re
import json
import os
from collections import defaultdict

# 1. Load journal mapping
journal_map = {}
with open('/tmp/neon_journals.tsv', 'r') as f:
    for line in f:
        line = line.strip()
        if line:
            jid, code = line.split('|')
            journal_map[code.upper()] = int(jid)

journal_map['PCRLJ'] = 6
journal_map['PCrLJ'.upper()] = 6
journal_map['PLC(CS)'.upper()] = 9961
journal_map['YLRN'.upper()] = 9962
journal_map['PCRLJN'.upper()] = 9963
journal_map['CLCN'.upper()] = 9964
journal_map['PLC(CS)N'.upper()] = 9965
journal_map['GBLR'.upper()] = 9966
journal_map['PLCN'.upper()] = 9967

# 2. Load DB metadata sets
neon_keys = set()
neon_citations = set()
with open('/tmp/neon_judgments_meta.tsv', 'r') as f:
    for line in f:
        parts = line.strip().split('|')
        if len(parts) >= 3:
            y, jid, p = parts[0], parts[1], parts[2]
            neon_keys.add(f"{y}:{jid}:{p}")
        if len(parts) >= 4:
            cit = parts[3].strip().upper()
            if cit:
                neon_citations.add(' '.join(cit.split()))

local_keys = set()
local_citations = set()
with open('/tmp/local_judgments_meta.tsv', 'r') as f:
    for line in f:
        parts = line.strip().split('|')
        if len(parts) >= 3:
            y, jid, p = parts[0], parts[1], parts[2]
            local_keys.add(f"{y}:{jid}:{p}")
        if len(parts) >= 4:
            cit = parts[3].strip().upper()
            if cit:
                local_citations.add(' '.join(cit.split()))

print(f"Loaded Neon DB: {len(neon_keys)} keys, {len(neon_citations)} citations")
print(f"Loaded Local DB: {len(local_keys)} keys, {len(local_citations)} citations")

# 3. Read SQLite documents
print("Querying SQLite legal_docs.db...")
conn = sqlite3.connect('/Users/macbook/Downloads/legal_scraper_data/legal_docs.db')
c = conn.cursor()
c.execute("SELECT case_name, citation, title, court, year, journal FROM documents")
rows = c.fetchall()
conn.close()

print(f"Loaded {len(rows)} rows from SQLite legal_docs.db")

neon_missing = []
neon_present = 0

local_missing = []
local_present = 0

parse_failed = []

for r in rows:
    case_name, raw_cit, title, court, raw_year, raw_journal = r
    raw_cit = (raw_cit or "").strip()
    raw_year = (raw_year or "").strip()
    raw_journal = (raw_journal or "").strip()

    # Parse year
    year = None
    if raw_year.isdigit():
        year = int(raw_year)

    # Parse journal
    jid = None
    if raw_journal:
        jid = journal_map.get(raw_journal.upper())

    # Parse page from citation
    page = None
    if raw_cit:
        # e.g. "2026 PLD 41" -> page 41
        m = re.search(r'\b(\d+)\s*$', raw_cit)
        if m:
            page = int(m.group(1))

        # If year not parsed from raw_year, try citation
        if not year:
            m_year = re.match(r'^(\d{4})\b', raw_cit)
            if m_year:
                year = int(m_year.group(1))

        # If jid not parsed, try citation journal part
        if not jid:
            parts = raw_cit.split()
            if len(parts) >= 2:
                for p in parts[1:-1]:
                    if p.upper() in journal_map:
                        jid = journal_map[p.upper()]
                        break

    if not year or not jid or not page:
        parse_failed.append({
            "case_name": case_name,
            "citation": raw_cit,
            "year": raw_year,
            "journal": raw_journal,
            "reason": f"missing: year={year}, jid={jid}, page={page}"
        })
        continue

    key = f"{year}:{jid}:{page}"
    norm_cit = ' '.join(raw_cit.upper().split()) if raw_cit else ""

    # Check Neon
    in_neon = (key in neon_keys) or (norm_cit and norm_cit in neon_citations)
    if in_neon:
        neon_present += 1
    else:
        neon_missing.append({
            "case_name": case_name,
            "citation": raw_cit,
            "title": title,
            "court": court,
            "year": year,
            "journal": raw_journal,
            "journal_id": jid,
            "page": page,
            "key": key
        })

    # Check Local
    in_local = (key in local_keys) or (norm_cit and norm_cit in local_citations)
    if in_local:
        local_present += 1
    else:
        local_missing.append({
            "case_name": case_name,
            "citation": raw_cit,
            "title": title,
            "court": court,
            "year": year,
            "journal": raw_journal,
            "journal_id": jid,
            "page": page,
            "key": key
        })

print("\n" + "="*50)
print("📊 NEON DB (APP CLOUD DATABASE) COMPARISON RESULTS")
print("="*50)
print(f"Total cases evaluated from legal_scraper_data: {len(rows)}")
print(f"Already present in Neon DB: {neon_present}")
print(f"NOT present in Neon DB (Missing): {len(neon_missing)}")
print(f"Unparseable records: {len(parse_failed)}")

neon_missing_by_year = defaultdict(int)
neon_missing_by_journal = defaultdict(int)
for m in neon_missing:
    neon_missing_by_year[m['year']] += 1
    neon_missing_by_journal[m['journal']] += 1

print("\nMissing in Neon by Year:")
for y in sorted(neon_missing_by_year.keys(), reverse=True):
    print(f"  {y}: {neon_missing_by_year[y]}")

print("\nMissing in Neon by Journal:")
for j, cnt in sorted(neon_missing_by_journal.items(), key=lambda x: x[1], reverse=True):
    print(f"  {j}: {cnt}")

print("\n" + "="*50)
print("📊 LOCAL DB (alwakeelo_local) COMPARISON RESULTS")
print("="*50)
print(f"Already present in Local DB: {local_present}")
print(f"NOT present in Local DB (Missing): {len(local_missing)}")

local_missing_by_year = defaultdict(int)
for m in local_missing:
    local_missing_by_year[m['year']] += 1

print("\nMissing in Local by Year:")
for y in sorted(local_missing_by_year.keys(), reverse=True):
    print(f"  {y}: {local_missing_by_year[y]}")

# Save missing cases to json for review/upload
with open('/tmp/neon_missing_cases.json', 'w') as f:
    json.dump(neon_missing, f, indent=2)

with open('/tmp/unparseable_cases.json', 'w') as f:
    json.dump(parse_failed, f, indent=2)

print("\nSaved detailed missing list to /tmp/neon_missing_cases.json")
