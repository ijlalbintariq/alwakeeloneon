#!/usr/bin/env python3
import urllib.request
import json
import base64
import sys
import os

LOGIN = "ijlalbintariq420@gmail.com"
PASSWORD = "4a5d398e345ba227"
DOMAIN = "alwakeelo.com"

def make_post_request(url, payload):
    data_bytes = json.dumps(payload).encode('utf-8')
    auth_str = base64.b64encode(f"{LOGIN}:{PASSWORD}".encode('ascii')).decode('ascii')
    
    req = urllib.request.Request(url, data=data_bytes, method='POST')
    req.add_header('Authorization', f'Basic {auth_str}')
    req.add_header('Content-Type', 'application/json')
    
    try:
        with urllib.request.urlopen(req) as response:
            return response.getcode(), json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        err_body = e.read().decode('utf-8')
        try:
            return e.code, json.loads(err_body)
        except:
            return e.code, {"status_message": err_body}
    except Exception as e:
        return 500, {"status_message": str(e)}

def run_report():
    print(f"=== Running DataForSEO Report for {DOMAIN} ===")
    
    # 1. Backlinks Summary
    backlink_code, backlink_res = make_post_request(
        "https://api.dataforseo.com/v3/backlinks/summary/live",
        [{"target": DOMAIN}]
    )
    
    # Check for account verification error
    if backlink_code == 403 or (isinstance(backlink_res, dict) and backlink_res.get("status_code") == 40104):
        print("\n[ALERT] API request was rejected by DataForSEO.")
        print(f"Message: {backlink_res.get('status_message', 'Forbidden')}")
        print("Please log in to https://app.dataforseo.com/ and verify your account first (complete email/card verification).")
        return False

    # 2. Domain Rank Overview
    labs_code, labs_res = make_post_request(
        "https://api.dataforseo.com/v3/dataforseo_labs/google/domain_rank_overview/live",
        [{"target": DOMAIN, "location_code": 2840, "language_code": "en"}]
    )
    
    # 3. Organic SERP for Brand "al wakeelo" (location: Pakistan - 2170)
    serp1_code, serp1_res = make_post_request(
        "https://api.dataforseo.com/v3/serp/google/organic/live/advanced",
        [{"keyword": "al wakeelo", "location_code": 2170, "language_code": "en"}]
    )

    # 4. Organic SERP for Category keyword "ai lawyer pakistan"
    serp2_code, serp2_res = make_post_request(
        "https://api.dataforseo.com/v3/serp/google/organic/live/advanced",
        [{"keyword": "ai lawyer pakistan", "location_code": 2170, "language_code": "en"}]
    )

    report_lines = []
    report_lines.append(f"# Live DataForSEO Report: {DOMAIN}")
    report_lines.append(f"\n*Generated automatically via DataForSEO Live APIs.*\n")
    
    # Compile Backlinks section
    report_lines.append("## 1. Backlink Profile Summary")
    if backlink_code == 200 and backlink_res.get("tasks"):
        task = backlink_res["tasks"][0]
        if task.get("result"):
            res = task["result"][0]
            report_lines.append(f"- **Rank (Domain Rank):** {res.get('rank', 'N/A')}")
            report_lines.append(f"- **Total Backlinks:** {res.get('backlinks', 0):,}")
            report_lines.append(f"- **Referring Domains:** {res.get('referring_domains', 0):,}")
            report_lines.append(f"- **Dofollow Backlinks:** {res.get('dofollow', 0):,}")
            report_lines.append(f"- **Nofollow Backlinks:** {res.get('nofollow', 0):,}")
            report_lines.append(f"- **Referring IPs:** {res.get('referring_ips', 0):,}")
            report_lines.append(f"- **Referring Class C Networks:** {res.get('referring_links_tld', {}).get('gov', 0)} (.gov), {res.get('referring_links_tld', {}).get('edu', 0)} (.edu)")
        else:
            report_lines.append("No backlinks data found.")
    else:
        report_lines.append(f"Failed to fetch: {backlink_res.get('status_message', 'Unknown error')}")

    # Compile Domain Rank Overview
    report_lines.append("\n## 2. Organic Search Rank Overview")
    if labs_code == 200 and labs_res.get("tasks"):
        task = labs_res["tasks"][0]
        if task.get("result"):
            res = task["result"][0]
            metrics = res.get("metrics", {}).get("organic", {})
            report_lines.append(f"- **Estimated Monthly Traffic:** {metrics.get('etv', 0):,}")
            report_lines.append(f"- **Total Ranking Keywords:** {metrics.get('pos_1', 0) + metrics.get('pos_2_3', 0) + metrics.get('pos_4_10', 0):,}")
            report_lines.append(f"- **Position Breakdown:**")
            report_lines.append(f"  - Position 1: {metrics.get('pos_1', 0)}")
            report_lines.append(f"  - Positions 2-3: {metrics.get('pos_2_3', 0)}")
            report_lines.append(f"  - Positions 4-10: {metrics.get('pos_4_10', 0)}")
            report_lines.append(f"  - Positions 11-100: {metrics.get('pos_11_100', 0)}")
        else:
            report_lines.append("No search metrics data found.")
    else:
        report_lines.append(f"Failed to fetch: {labs_res.get('status_message', 'Unknown error')}")

    # Compile SERP results
    for kw, code, res in [("al wakeelo", serp1_code, serp1_res), ("ai lawyer pakistan", serp2_code, serp2_res)]:
        report_lines.append(f"\n## 3. Live Google SERP: '{kw}' (Pakistan)")
        if code == 200 and res.get("tasks"):
            task = res["tasks"][0]
            if task.get("result"):
                results_items = task["result"][0].get("items", [])
                organic_items = [item for item in results_items if item.get("type") == "organic"]
                
                report_lines.append("| Rank | Title | Domain | URL |")
                report_lines.append("|------|-------|--------|-----|")
                for item in organic_items[:10]:
                    rank = item.get("rank_group", "-")
                    title = item.get("title", "No Title").replace("|", "\\|")
                    domain = item.get("domain", "")
                    url = item.get("url", "")
                    report_lines.append(f"| {rank} | {title} | {domain} | [Link]({url}) |")
            else:
                report_lines.append("No SERP items returned.")
        else:
            report_lines.append(f"Failed to fetch: {res.get('status_message', 'Unknown error')}")

    report_path = "dataforseo_report.md"
    with open(report_path, "w") as f:
        f.write("\n".join(report_lines))
    print(f"\nSuccess! Written report to {report_path}")
    return True

if __name__ == "__main__":
    run_report()
