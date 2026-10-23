import sqlite3
import re
import json
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

def normalize_citation(cit):
    if not cit:
        return ""
    cit = cit.strip().upper()
    cit = re.sub(r'\s+', ' ', cit)
    # Normalize common journal variations
    cit = cit.replace('PCRLJ', 'PCRLJ').replace('PCR LJ', 'PCRLJ').replace('P CR L J', 'PCRLJ')
    return cit

def normalize_title(t):
    if not t:
        return ""
    t = t.strip().lower()
    t = re.sub(r'[\r\n\t]+', ' ', t)
    t = re.sub(r'\s+', ' ', t)
    return t

# 2. Load Neon DB metadata
print("Loading Neon DB metadata...")
neon_keys = set()
neon_citations = set()
neon_titles = set()

with open('/tmp/neon_full_meta.tsv', 'r') as f:
    for line in f:
        parts = line.strip().split('|')
        if len(parts) >= 3:
            y, jid, p = parts[0], parts[1], parts[2]
            neon_keys.add(f"{y}:{jid}:{p}")
        if len(parts) >= 4:
            ncit = normalize_citation(parts[3])
            if ncit:
                neon_citations.add(ncit)
        if len(parts) >= 5:
            ntitle = normalize_title(parts[4])
            if ntitle:
                neon_titles.add(ntitle)

print(f"Neon: {len(neon_keys)} keys, {len(neon_citations)} citations, {len(neon_titles)} titles")

# 3. Load Local DB metadata
print("Loading Local DB metadata...")
local_keys = set()
local_citations = set()
local_titles = set()

with open('/tmp/local_full_meta.tsv', 'r') as f:
    for line in f:
        parts = line.strip().split('|')
        if len(parts) >= 3:
            y, jid, p = parts[0], parts[1], parts[2]
            local_keys.add(f"{y}:{jid}:{p}")
        if len(parts) >= 4:
            lcit = normalize_citation(parts[3])
            if lcit:
                local_citations.add(lcit)
        if len(parts) >= 5:
            ltitle = normalize_title(parts[4])
            if ltitle:
                local_titles.add(ltitle)

print(f"Local: {len(local_keys)} keys, {len(local_citations)} citations, {len(local_titles)} titles")

# 4. Load SQLite documents
print("Loading SQLite legal_docs.db...")
conn = sqlite3.connect('/Users/macbook/Downloads/legal_scraper_data/legal_docs.db')
c = conn.cursor()
c.execute("SELECT case_name, citation, title, court, year, journal FROM documents")
rows = c.fetchall()
conn.close()
print(f"Loaded {len(rows)} documents from SQLite.")

neon_present = 0
neon_missing = []

local_present = 0
local_missing = []

for r in rows:
    case_name, raw_cit, title, court, raw_year, raw_journal = r
    raw_cit = (raw_cit or "").strip()
    raw_year = (raw_year or "").strip()
    raw_journal = (raw_journal or "").strip()
    title_norm = normalize_title(title or case_name)

    # 1. Parse year
    year = None
    if raw_year.isdigit():
        year = int(raw_year)

    # 2. Parse journal
    jid = None
    if raw_journal:
        jid = journal_map.get(raw_journal.upper())

    # 3. Parse page
    page = None
    if raw_cit:
        m = re.search(r'\b(\d+)\s*$', raw_cit)
        if m:
            page = int(m.group(1))

        if not year:
            m_year = re.match(r'^(\d{4})\b', raw_cit)
            if m_year:
                year = int(m_year.group(1))

        if not jid:
            parts = raw_cit.split()
            if len(parts) >= 2:
                for p in parts[1:-1]:
                    if p.upper() in journal_map:
                        jid = journal_map[p.upper()]
                        break

    # If page still missing, check suit/petition pattern
    if not page:
        pm = re.search(r"(?:Suit|Bail|Petition|Appeal|Cr\.Bail|F\.R\.A|I\.\s*A|Revision|H\.\s*C|No\.?|HYD_|KHI_|SUK_)\s*(\d+)", (title or "") + " " + (case_name or ""), re.IGNORECASE)
        if pm:
            page = int(pm.group(1))

    if not year:
        ym = re.search(r"\b(19\d{2}|20\d{2})\b", (title or "") + " " + (case_name or ""))
        if ym:
            year = int(ym.group(1))

    key = f"{year}:{jid}:{page}" if (year and jid and page) else None
    norm_cit = normalize_citation(raw_cit)

    # --- Match against Neon ---
    in_neon = False
    match_type_neon = None
    if key and key in neon_keys:
        in_neon = True
        match_type_neon = "key"
    elif norm_cit and norm_cit in neon_citations:
        in_neon = True
        match_type_neon = "citation"
    elif title_norm and title_norm in neon_titles:
        in_neon = True
        match_type_neon = "title"

    if in_neon:
        neon_present += 1
    else:
        neon_missing.append({
            "case_name": case_name,
            "citation": raw_cit,
            "title": title,
            "court": court,
            "year": year or raw_year,
            "journal": raw_journal,
            "journal_id": jid,
            "page": page
        })

    # --- Match against Local ---
    in_local = False
    if key and key in local_keys:
        in_local = True
    elif norm_cit and norm_cit in local_citations:
        in_local = True
    elif title_norm and title_norm in local_titles:
        in_local = True

    if in_local:
        local_present += 1
    else:
        local_missing.append({
            "case_name": case_name,
            "citation": raw_cit,
            "title": title,
            "court": court,
            "year": year or raw_year,
            "journal": raw_journal,
            "journal_id": jid,
            "page": page
        })

# Save missing files for inspection and upload
with open('/tmp/final_neon_missing.json', 'w') as f:
    json.dump(neon_missing, f, indent=2)

with open('/tmp/final_local_missing.json', 'w') as f:
    json.dump(local_missing, f, indent=2)

print("\n" + "="*60)
print("🎯 EXACT AUDIT REPORT")
print("="*60)
print(f"Total case records in /Users/macbook/Downloads/legal_scraper_data/: {len(rows)}")
print(f"\n1. APP CLOUD DATABASE (Neon PostgreSQL - production DB):")
print(f"   ✅ Already in Database: {neon_present} cases ({(neon_present/len(rows))*100:.2f}%)")
print(f"   ❌ Missing from Database: {len(neon_missing)} cases ({(len(neon_missing)/len(rows))*100:.2f}%)")

print(f"\n2. LOCAL DATABASE (alwakeelo_local):")
print(f"   ✅ Already in Local DB: {local_present} cases ({(local_present/len(rows))*100:.2f}%)")
print(f"   ❌ Missing from Local DB: {len(local_missing)} cases ({(len(local_missing)/len(rows))*100:.2f}%)")

neon_missing_years = defaultdict(int)
neon_missing_journals = defaultdict(int)
for m in neon_missing:
    neon_missing_years[m['year']] += 1
    neon_missing_journals[m['journal']] += 1

print("\nBreakdown of Missing Cases from Neon DB by Year:")
for y in sorted(neon_missing_years.keys(), reverse=True):
    print(f"   Year {y}: {neon_missing_years[y]} cases")

print("\nBreakdown of Missing Cases from Neon DB by Journal:")
for j, cnt in sorted(neon_missing_journals.items(), key=lambda x: x[1], reverse=True):
    print(f"   {j or 'Unknown'}: {cnt} cases")
