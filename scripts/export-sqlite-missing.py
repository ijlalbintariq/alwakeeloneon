"""
export-sqlite-missing.py

Reads SQLite legal_docs.db, filters against production keys,
and exports only the missing records to /tmp/missing_judgments_to_upload.json
"""

import sqlite3
import json
import os
import re

SQLITE_PATH = "/Users/macbook/Downloads/legal_scraper_data/legal_docs.db"
PROD_META_PATH = "/tmp/prod_metadata.json"
OUT_PATH = "/tmp/missing_judgments_to_upload.json"

JOURNAL_MAP = {
    "PLD": 1, "SCMR": 2, "PLJ": 3, "MLD": 4, "CLC": 5, "PCrLJ": 6, "PCRLJ": 6,
    "PLC": 7, "YLR": 8, "NLR": 9, "CLD": 10, "PTD": 11, "PSC": 12, "SLR": 13,
    "LHC": 80, "IHC": 81, "SHC": 82, "PHC": 83, "BHC": 84, "AJKHC": 85,
    "PLC(CS)": 9961, "YLRN": 9962, "PCrLJN": 9963, "PCRLJN": 9963,
    "CLCN": 9964, "PLC(CS)N": 9965, "GBLR": 9966, "PLCN": 9967
}

COURT_MAP = {
    "SUPREME-COURT": {"id": 1, "name": "Supreme Court of Pakistan"},
    "ISLAMABAD": {"id": 2, "name": "Islamabad High Court"},
    "LAHORE-HIGH-COURT-LAHORE": {"id": 3, "name": "Lahore High Court"},
    "KARACHI-HIGH-COURT-SINDH": {"id": 4, "name": "Sindh High Court"},
    "PESHAWAR-HIGH-COURT": {"id": 5, "name": "Peshawar High Court"},
    "QUETTA-HIGH-COURT-BALOCHISTAN": {"id": 6, "name": "Balochistan High Court"},
    "FEDERAL-SHARIAT-COURT": {"id": 7, "name": "Federal Shariat Court"}
}

def sanitize(s):
    return (s or "").replace("\0", "").strip()

def parse_title_parts(title):
    m = re.match(r"^(.+?)\s+(?:VS\.?|Versus|vs\.?|V\/S)\s+(.+)", title, re.IGNORECASE)
    if m:
        return sanitize(m.group(1)), sanitize(m.group(2))
    return sanitize(title), ""

def main():
    print("🔍 Loading production keys...")
    with open(PROD_META_PATH) as f:
        prod = json.load(f)

    existing_keys = set()
    existing_citations = set()

    for j in prod["judgments"]:
        y = j.get("year")
        jid = j.get("journal_id")
        p = j.get("page")
        if y and jid and p:
            existing_keys.add(f"{y}:{jid}:{p}")
        if j.get("citation_string"):
            existing_citations.add(" ".join(j["citation_string"].strip().upper().split()))

    print(f"   Existing in Neon DB: {len(existing_keys)} keys")

    print("📂 Reading SQLite legal_docs.db...")
    conn = sqlite3.connect(SQLITE_PATH)
    c = conn.cursor()
    c.execute("SELECT case_name, citation, title, court, content, year, journal FROM documents")
    rows = c.fetchall()
    print(f"   Total SQLite rows: {len(rows)}")

    to_insert = []
    assigned_keys = set(existing_keys)

    for r in rows:
        raw_case_name, raw_citation, raw_title, raw_court, raw_content, raw_year, raw_journal = r
        if not raw_content or len(raw_content) < 50:
            continue

        year = int(raw_year) if (raw_year and raw_year.isdigit()) else 0
        journal_id = None
        page = None
        citation = sanitize(raw_citation)

        if citation:
            parts = citation.split()
            if len(parts) >= 3:
                try:
                    y_match = int(parts[0])
                    if not year and 1900 <= y_match <= 2030: year = y_match
                except:
                    pass
                j_code = parts[1].upper()
                journal_id = JOURNAL_MAP.get(j_code)
                try:
                    page = int(parts[-1])
                except:
                    pass

        if not journal_id and raw_journal:
            journal_id = JOURNAL_MAP.get(raw_journal.upper())

        if not journal_id:
            journal_id = 82 # Default to SHC

        if not year:
            ym = re.search(r"\b(19\d{2}|20\d{2})\b", (raw_title or "") + " " + (raw_case_name or ""))
            year = int(ym.group(1)) if ym else 2026

        if not page:
            pm = re.search(r"(?:Suit|Bail|Petition|Appeal|Cr\.Bail|F\.R\.A|I\.\s*A|Revision|H\.\s*C|No\.?|HYD_|KHI_|SUK_)\s*(\d+)", (raw_title or "") + " " + (raw_case_name or ""), re.IGNORECASE)
            if pm:
                page = int(pm.group(1))
            else:
                page = (abs(hash(raw_case_name or raw_title or "")) % 800000) + 100000

        j_code_str = [k for k, v in JOURNAL_MAP.items() if v == journal_id][0]
        if not citation:
            citation = f"{year} {j_code_str} {page}"

        norm_cit = " ".join(citation.upper().split())
        key = f"{year}:{journal_id}:{page}"

        if key in existing_keys or norm_cit in existing_citations:
            continue

        while key in assigned_keys:
            page += 1
            citation = f"{year} {j_code_str} {page}"
            key = f"{year}:{journal_id}:{page}"

        assigned_keys.add(key)

        title = sanitize(raw_title or raw_case_name or citation)
        petitioner, respondent = parse_title_parts(title)

        court_id = None
        court_name_snapshot = sanitize(raw_court)

        if raw_court:
            for ckey, cval in COURT_MAP.items():
                if ckey in raw_court.upper():
                    court_id = cval["id"]
                    court_name_snapshot = cval["name"]
                    break

        if not court_id:
            if journal_id == 82:
                court_id = 4
                court_name_snapshot = "Sindh High Court"
            elif journal_id == 81:
                court_id = 2
                court_name_snapshot = "Islamabad High Court"
            elif journal_id == 80:
                court_id = 3
                court_name_snapshot = "Lahore High Court"

        to_insert.append({
            "year": year,
            "journalId": journal_id,
            "page": page,
            "citationString": citation,
            "title": title[:500],
            "petitioner": petitioner[:300] if petitioner else None,
            "respondent": respondent[:300] if respondent else None,
            "courtId": court_id,
            "courtNameSnapshot": court_name_snapshot[:200] if court_name_snapshot else None,
            "fullText": sanitize(raw_content)
        })

    print(f"\n📊 Total Missing Judgments Prepared: {len(to_insert)}")
    with open(OUT_PATH, "w") as f:
        json.dump(to_insert, f)
    print(f"✅ Saved payload to {OUT_PATH} (Size: {os.path.getsize(OUT_PATH) / (1024*1024):.2f} MB)")

if __name__ == "__main__":
    main()
