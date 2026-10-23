import json
import sqlite3
import os
import re

MISSING_CASES_JSON = '/tmp/truly_missing_cases.json'
OUT_JSON = '/tmp/missing_judgments_to_upload.json'
TEXT_DIR = '/Users/macbook/Downloads/legal_scraper_data/judgments_text'
SQLITE_PATH = '/Users/macbook/Downloads/legal_scraper_data/legal_docs.db'
NEON_TAB_META = '/tmp/neon_tab_meta.tsv'

COURT_MAP = {
    'SUPREME-COURT': {'id': 1, 'name': 'Supreme Court of Pakistan'},
    'ISLAMABAD': {'id': 2, 'name': 'Islamabad High Court'},
    'LAHORE': {'id': 3, 'name': 'Lahore High Court'},
    'SINDH': {'id': 4, 'name': 'Sindh High Court'},
    'KARACHI': {'id': 4, 'name': 'Sindh High Court'},
    'PESHAWAR': {'id': 5, 'name': 'Peshawar High Court'},
    'QUETTA': {'id': 6, 'name': 'Balochistan High Court'},
    'BALOCHISTAN': {'id': 6, 'name': 'Balochistan High Court'},
    'FEDERAL-SHARIAT': {'id': 7, 'name': 'Federal Shariat Court'},
    'SHARIAT': {'id': 7, 'name': 'Federal Shariat Court'}
}

def split_title(title):
    if not title:
        return None, None
    for sep in [' VS ', ' V. ', ' VERSUS ', ' vs ', ' v. ', ' versus ', ' V/S ', ' v/s ']:
        if sep in title:
            idx = title.find(sep)
            p = title[:idx].strip()[:300]
            r = title[idx + len(sep):].strip()[:300]
            return p or None, r or None
    return title.strip()[:300], None

def main():
    with open(MISSING_CASES_JSON) as f:
        cases = json.load(f)

    # Load existing keys from Neon
    assigned_keys = set()
    with open(NEON_TAB_META) as f:
        for line in f:
            parts = line.split('\t')
            if len(parts) >= 3:
                assigned_keys.add(f'{parts[0]}:{parts[1]}:{parts[2]}')

    print(f'Existing Neon DB keys: {len(assigned_keys)}')

    conn = sqlite3.connect(SQLITE_PATH)
    cur = conn.cursor()

    to_insert = []

    for item in cases:
        case_name = item['case_name']
        year = int(item['year'])
        journal_id = int(item['journal_id'])
        page = item.get('page')
        citation = (item.get('citation') or '').strip()
        title = (item.get('title') or '').strip()
        raw_court = (item.get('court') or '').strip()

        # Resolve missing page
        if not page or page == 'None':
            pm = re.search(r'(?:Suit|Bail|Petition|Appeal|Cr\.Bail|F\.R\.A|I\.\s*A|Revision|H\.\s*C|No\.?|HYD_|KHI_|SUK_|\.P\.)\s*(\d+)', (title or '') + ' ' + (case_name or ''), re.IGNORECASE)
            if pm:
                page = int(pm.group(1))
            else:
                num_m = re.findall(r'\d+', case_name)
                if num_m:
                    page = int(num_m[-1])
                else:
                    page = (abs(hash(case_name)) % 800000) + 100000

        # Check collision on (year, journal_id, page)
        key = f'{year}:{journal_id}:{page}'
        orig_page = page
        while key in assigned_keys:
            page += 1
            key = f'{year}:{journal_id}:{page}'

        assigned_keys.add(key)

        if not citation:
            j_code = item.get('journal', 'LAW')
            citation = f'{year} {j_code} {page}'

        # Split petitioner / respondent
        petitioner, respondent = split_title(title)

        # Map court
        court_id = None
        court_name_snapshot = raw_court
        court_upper = raw_court.upper()

        if 'AZAD KASHMIR' in court_upper or 'AJK' in court_upper:
            court_id = None
            court_name_snapshot = raw_court
        else:
            for k, v in COURT_MAP.items():
                if k in court_upper:
                    court_id = v['id']
                    court_name_snapshot = v['name']
                    break

        if not court_id:
            if journal_id == 82:
                court_id = 4
                court_name_snapshot = 'Sindh High Court'
            elif journal_id == 81:
                court_id = 2
                court_name_snapshot = 'Islamabad High Court'
            elif journal_id == 80:
                court_id = 3
                court_name_snapshot = 'Lahore High Court'

        # Full text
        txt_path = os.path.join(TEXT_DIR, f'{case_name}.txt')
        full_text = None
        if os.path.exists(txt_path):
            with open(txt_path, 'r', encoding='utf-8') as tf:
                full_text = tf.read()

        if not full_text or len(full_text) < 50:
            cur.execute('SELECT content FROM documents WHERE case_name = ?', (case_name,))
            r = cur.fetchone()
            if r and r[0]:
                raw_html = r[0]
                text_clean = re.sub(r'<[^>]+>', ' ', raw_html)
                full_text = re.sub(r'\s+', ' ', text_clean).strip()

        if not full_text or len(full_text) < 50:
            full_text = f"Judgment for {citation}: {title}"

        # Clean null characters
        full_text = full_text.replace('\x00', '')
        title = title.replace('\x00', '')

        to_insert.append({
            'year': year,
            'journalId': journal_id,
            'page': page,
            'citationString': citation[:200],
            'title': title[:500],
            'petitioner': petitioner,
            'respondent': respondent,
            'courtId': court_id,
            'courtNameSnapshot': court_name_snapshot[:200] if court_name_snapshot else None,
            'fullText': full_text
        })

    conn.close()

    print(f'Prepared {len(to_insert)} judgments for upload.')
    with open(OUT_JSON, 'w', encoding='utf-8') as f:
        json.dump(to_insert, f, ensure_ascii=False)

    size_mb = os.path.getsize(OUT_JSON) / (1024 * 1024)
    print(f'Saved payload to {OUT_JSON} ({size_mb:.2f} MB)')

if __name__ == '__main__':
    main()
